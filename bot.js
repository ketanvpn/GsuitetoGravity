const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const http = require('http');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeHumanLike(page, el, text) {
  if (!el) return;
  await el.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await sleep(150 + Math.floor(Math.random() * 100));

  for (const char of text) {
    await el.type(char);
    let delay = Math.floor(Math.random() * 60) + 40;
    if (char === '@' || char === '.' || char === '_') {
      delay += Math.floor(Math.random() * 120) + 80;
    }
    await sleep(delay);
  }
}

const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:20128';
const ROUTER_PASSWORD = process.env.ROUTER_PASSWORD || '123456';
const REDIRECT_URI = `${ROUTER_URL}/callback`;
const AKUN_FILE = path.join(__dirname, 'akun.txt');
const CONCURRENCY = parseInt(process.env.CONCURRENCY, 10) || 1;

function detectBrowser() {
  const candidates = [
    '/root/.hermes/tools/chromium-1208/chrome-linux64/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ];

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        const name = p.includes('chrome') || p.includes('Chrome') ? 'Chrome'
          : p.includes('edge') || p.includes('Edge') ? 'Edge'
          : p.includes('rave') ? 'Brave'
          : p.includes('chromium') ? 'Chromium' : 'Browser';
        return { path: p, name };
      }
    } catch {}
  }

  return { path: null, name: 'Chromium (bundled)' };
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

function request(method, urlStr, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), cookies });
        } catch {
          resolve({ status: res.statusCode, data, cookies });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function extractAuthCookie(cookies) {
  for (const c of cookies) {
    const match = c.match(/auth_token=([^;]+)/);
    if (match) return `auth_token=${match[1]}`;
  }
  return null;
}

function readAccounts() {
  const content = fs.readFileSync(AKUN_FILE, 'utf-8').trim();
  if (!content) return [];
  return content
    .split('\n')
    .map((line) => {
      const [email, password] = line.trim().split('|');
      return { email, password, raw: line.trim() };
    })
    .filter((a) => a.email && a.password);
}

function removeAccount(rawLine) {
  const content = fs.readFileSync(AKUN_FILE, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim() !== rawLine);
  fs.writeFileSync(AKUN_FILE, lines.join('\n'));
}

async function routerLogin() {
  console.log('[9Router] Login...');
  const res = await request('POST', `${ROUTER_URL}/api/auth/login`, {
    body: { password: ROUTER_PASSWORD },
  });

  if (res.status !== 200 || !res.data?.success) {
    throw new Error(`Login 9Router gagal: ${JSON.stringify(res.data)}`);
  }

  const cookie = extractAuthCookie(res.cookies);
  if (!cookie) {
    throw new Error('Cookie auth_token tidak ditemukan di response');
  }

  console.log('[9Router] ✓ Login berhasil');
  return cookie;
}

async function startOAuth(cookie) {
  const url = `${ROUTER_URL}/api/oauth/antigravity/authorize?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  const res = await request('GET', url, { cookie });

  if (res.status !== 200) {
    throw new Error(`Start OAuth gagal (${res.status}): ${JSON.stringify(res.data)}`);
  }

  const { authUrl, codeVerifier, state } = res.data;
  if (!authUrl || !codeVerifier || !state) {
    throw new Error(`Response OAuth tidak lengkap: ${JSON.stringify(res.data)}`);
  }

  return { authUrl, codeVerifier, state };
}

async function exchangeToken(cookie, { code, codeVerifier, state }) {
  const res = await request('POST', `${ROUTER_URL}/api/oauth/antigravity/exchange`, {
    cookie,
    body: { code, redirectUri: REDIRECT_URI, codeVerifier, state },
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Exchange token gagal (${res.status}): ${JSON.stringify(res.data)}`);
  }

  return res.data;
}

async function googleLogin(browser, authUrl, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
    window.chrome = { runtime: {} };
  });

  try {
    let authCode = null;

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const reqUrl = req.url();

      if (reqUrl.startsWith(REDIRECT_URI)) {
        const url = new URL(reqUrl);
        authCode = url.searchParams.get('code');
        req.abort();
        return;
      }

      const type = req.resourceType();
      if (['image', 'media'].includes(type)) {
        req.abort();
        return;
      }

      req.continue();
    });

    await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    if (authCode) {
      console.log(`  [Google] ✓ Auth code (auto-redirect)`);
      return authCode;
    }

    console.log(`  [Google] Email...`);
    await page.waitForSelector('#identifierId', { visible: true, timeout: 15000 });
    await sleep(800);

    for (let tryType = 0; tryType < 3; tryType++) {
      const idInput = await page.$('#identifierId');
      if (idInput) {
        await typeHumanLike(page, idInput, email);
      }

      const val = await page.evaluate(() => document.querySelector('#identifierId')?.value);
      if (val === email) break;
      await sleep(500);
    }

    await sleep(500);
    const nextBtn = await page.$('#identifierNext button, #identifierNext');
    if (nextBtn) {
      await nextBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    console.log(`  [Google] Password...`);
    await sleep(1500);

    try {
      const restartBtn = await page.$('button::-p-text(Restart), button::-p-text(Coba lagi)');
      if (restartBtn) {
        await restartBtn.click();
        await sleep(2000);
      }
    } catch {}

    for (let attempt = 0; attempt < 12; attempt++) {
      const url = page.url();
      if (!url.includes('/identifier') || url.includes('/challenge') || url.includes('/pwd')) break;
      const pwdEl = await page.$('input[type="password"]');
      if (pwdEl) break;
      await sleep(1000);
    }

    const pwdSelectors = [
      'input[type="password"][name="Passwd"]',
      'input[type="password"]',
      '#password input',
      'input[name="Passwd"]',
    ];

    let pwdField = null;
    for (const sel of pwdSelectors) {
      try {
        pwdField = await page.waitForSelector(sel, { visible: true, timeout: 6000 });
        if (pwdField) break;
      } catch {}
    }

    if (!pwdField) {
      const debugFile = path.join(__dirname, `debug-${email.split('@')[0]}.png`);
      await page.screenshot({ path: debugFile, fullPage: true });
      console.log(`  [DEBUG] URL: ${page.url()}`);
      console.log(`  [DEBUG] Screenshot: ${debugFile}`);
      throw new Error('Password field tidak ditemukan — cek screenshot');
    }

    await sleep(600);
    await typeHumanLike(page, pwdField, password);
    await sleep(500);

    const pwdNextBtn = await page.$('#passwordNext button, #passwordNext');
    if (pwdNextBtn) {
      await pwdNextBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    console.log(`  [Google] Consent...`);

    const consentTimeout = 35000;
    const consentStart = Date.now();

    while (!authCode && (Date.now() - consentStart < consentTimeout)) {
      // 1. Cek jika URL sudah me-redirect ke callback
      try {
        const curUrl = page.url();
        if (curUrl && curUrl.startsWith(REDIRECT_URI)) {
          authCode = new URL(curUrl).searchParams.get('code');
          if (authCode) break;
        }
      } catch {}

      // 2. Evaluasi DOM untuk klik tombol consent / TOS / konfirmasi keamanan
      try {
        const actionResult = await page.evaluate(() => {
          const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
          if (bodyText.includes('wrong password') || bodyText.includes('kata sandi salah')) {
            return { error: 'Wrong password' };
          }

          // Scroll halaman ke bawah agar tombol seperti 'I understand' aktif
          window.scrollTo(0, document.body.scrollHeight);
          const scrollables = document.querySelectorAll('div, section, main, [role="main"]');
          for (const s of scrollables) {
            if (s.scrollHeight > s.clientHeight) {
              s.scrollTop = s.scrollHeight;
            }
          }

          // Cek tombol panah ke bawah (scroll assist)
          const downButtons = document.querySelectorAll('button[aria-label*="down"], div[role="button"][aria-label*="down"], button:has(svg)');
          for (const db of downButtons) {
            if (db.offsetParent !== null) {
              db.click();
            }
          }

          // Kumpulan tombol yang mungkin muncul di alur login/persetujuan Google
          const candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a[role="button"]'));
          const keywords = [
            'i understand', 'saya mengerti', 'understand', 'mengerti',
            'login', 'sign in', 'masuk',
            'continue', 'lanjutkan',
            'allow', 'izinkan',
            'next', 'berikutnya'
          ];

          for (const el of candidates) {
            if (el.offsetParent === null) continue;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

            const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.value || '').trim().toLowerCase();
            if (!text) continue;

            // Jangan klik Batal atau Forgot
            if (text.includes('batal') || text.includes('cancel') || text.includes('forgot') || text.includes('lupa')) continue;

            for (const kw of keywords) {
              if (text === kw || text.includes(kw)) {
                el.click();
                return { clicked: text };
              }
            }
          }

          // Fallback ID selectors
          const idSelectors = [
            '#gaplustosNext button', '#gaplustosNext',
            '#submit_approve_access button', '#submit_approve_access',
            '#signin', '#next'
          ];
          for (const sel of idSelectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
              el.click();
              return { clicked: sel };
            }
          }

          return null;
        });

        if (actionResult && actionResult.error) {
          throw new Error(actionResult.error);
        }
        if (actionResult && actionResult.clicked) {
          await sleep(1500);
        } else {
          await sleep(800);
        }
      } catch (err) {
        if (err.message === 'Wrong password') {
          throw err;
        }
        await sleep(800);
      }
    }

    if (!authCode) {
      try {
        const currentUrl = page.url();
        if (currentUrl.startsWith(REDIRECT_URI)) {
          authCode = new URL(currentUrl).searchParams.get('code');
        }
      } catch {}
    }

    if (!authCode) {
      const debugFile = path.join(__dirname, `debug-${email.split('@')[0]}.png`);
      await page.screenshot({ path: debugFile, fullPage: true }).catch(() => {});
      console.log(`  [DEBUG] URL: ${page.url()}`);
      console.log(`  [DEBUG] Screenshot saved: ${debugFile}`);
      throw new Error('Auth code tidak ter-capture');
    }

    console.log(`  [Google] ✓ Auth code didapat`);
    return authCode;
  } finally {
    await page.close();
    await context.close();
  }
}

async function loginAccount(browser, cookie, account, index, total) {
  const { email, password } = account;
  const t0 = Date.now();
  console.log(`\n[${index + 1}/${total}] ${email}`);

  console.log(`  [API] OAuth authorize...`);
  const { authUrl, codeVerifier, state } = await startOAuth(cookie);

  const authCode = await googleLogin(browser, authUrl, email, password);

  console.log(`  [API] Exchange token...`);
  const result = await exchangeToken(cookie, { code: authCode, codeVerifier, state });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[✓] ${email} — ${elapsed}s (${result.connection?.id || 'OK'})`);
  removeAccount(account.raw);
}

(async () => {
  const accounts = readAccounts();
  if (accounts.length === 0) {
    console.log('Tidak ada akun di akun.txt');
    return;
  }

  console.log(`Total akun: ${accounts.length}`);

  const browser_info = detectBrowser();
  console.log(`Browser: ${browser_info.name}${browser_info.path ? ` (${browser_info.path})` : ''}`);
  console.log(`Mode: API + Browser (Google OAuth only)\n`);

  const cookie = await routerLogin();

  const launchOptions = {
    headless: process.env.HEADLESS === 'true' || !process.env.DISPLAY ? 'new' : false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  };

  if (browser_info.path) {
    launchOptions.executablePath = browser_info.path;
  }

  const browser = await puppeteer.launch(launchOptions);

  let successCount = 0;
  let failCount = 0;
  const t0 = Date.now();

  for (let i = 0; i < accounts.length; i += CONCURRENCY) {
    const batch = accounts.slice(i, i + CONCURRENCY);

    const promises = batch.map(async (account, batchIdx) => {
      try {
        await loginAccount(browser, cookie, account, i + batchIdx, accounts.length);
        successCount++;
      } catch (error) {
        console.error(`[✗] ${account.email}: ${error.message}`);
        failCount++;
      }
    });

    await Promise.all(promises);
  }

  const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`Selesai dalam ${totalTime}s`);
  console.log(`Sukses: ${successCount} | Gagal: ${failCount}`);
  console.log(`========================================`);

  await browser.close();
  console.log('\n[Browser] ✓ Ditutup');
  process.exit(0);
})().catch((err) => {
  console.error('\n[Fatal Error]:', err.message || err);
  process.exit(1);
});
