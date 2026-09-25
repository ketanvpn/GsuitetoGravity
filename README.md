<div align="center">

# ⚡ Gsuiteto9router

**Automated Bulk Google Workspace Onboarding for 9Router AntiGravity Provider**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Puppeteer Stealth](https://img.shields.io/badge/Puppeteer-Stealth%20Mode-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![9Router](https://img.shields.io/badge/9Router-v1.x-blue?style=for-the-badge)](https://9router.com)
[![Platform](https://img.shields.io/badge/Platform-Linux%20VPS%20%7C%20Windows%20%7C%20macOS-orange?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

</div>

---

## 📌 Ringkasan Proyek

**GSuite to 9Router** adalah automasi cerdas berbasis **Hybrid API + Headless Browser Stealth** untuk mendaftarkan akun Google / GSuite Workspace secara massal ke provider **AntiGravity (AG)** di [9Router](https://github.com/9router/9router).

Tool ini dirancang agar dapat berjalan mulus di **VPS Linux (Headless)** tanpa memerlukan desktop GUI, dilengkapi dengan simulasi pengetikan alami manusiawi dan bypass otomatis untuk layar onboarding & persetujuan Google Workspace for Education.

---

## ✨ Fitur Unggulan

- 🥷 **Puppeteer Stealth Plugin:** Menyamarkan sidik jari otomasi browser (`navigator.webdriver`, canvas, audio, plugins) agar tidak terdeteksi oleh sistem keamanan Google.
- ⌨️ **Simulasi Ketikan Manusiawi (*Human-like Typing*):** Kecepatan ketikan dinamis dan acak (40ms – 100ms) dengan jeda alami pada simbol (`@`, `.`, `_`) untuk menghindari bot challenge.
- 🎓 **Bypass Otomatis Layar Onboarding GSuite:**
  - Auto-scroll dan auto-click tombol **"I understand"** / **"Saya mengerti"** pada akun baru Google Workspace for Education.
  - Auto-confirm peringatan keamanan Google Antigravity (**"Login"** / **"Sign in"**).
  - Auto-accept OAuth Consent & Permissions.
- ⚡ **Hybrid Architecture (High Speed):** Autentikasi dan token exchange dijalankan langsung melalui REST API 9Router; browser hanya dibuka saat proses Google OAuth berlangsung.
- 🧹 **Auto-Cleaning `akun.txt`:** Akun yang berhasil diinjeksi otomatis dihapus dari daftar `akun.txt`, sehingga jika proses terhenti, Anda cukup melanjutkan tanpa menduplikasi akun.
- 🛡️ **Pembersih Kuota Cerdas (`delete.js`):** Memindai dan menghapus akun yang terkena limit kuota `429 Too Many Requests` tanpa membuka browser.

---

## 🏗️ Cara Kerja Sistem

```
┌────────────────────────────────────────────────────────┐
│ 1. POST /api/auth/login          → Dapatkan Auth Token  │  9Router
│ 2. GET  /api/oauth/.../authorize → Dapatkan URL OAuth   │   REST API
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│ 3. Buka URL OAuth via Headless Chromium (Stealth)      │
│ 4. Ketik Email (Human-like) → Klik Next                │
│ 5. Ketik Password (Human-like) → Klik Next             │  Puppeteer
│ 6. Handle Onboarding ("I understand" / "Login Warning")│   Stealth
│ 7. Tangkap parameter ?code= dari redirect URI          │
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│ 8. POST /api/oauth/.../exchange → Simpan ke 9Router    │  9Router
│ 9. Hapus baris akun dari akun.txt                      │   Database
└────────────────────────────────────────────────────────┘
```

---

## 📋 Kebutuhan Sistem

- **Node.js:** Versi 18.x atau lebih baru
- **OS:** Linux (Ubuntu 20.04/22.04/24.04), Debian, CentOS, Windows, atau macOS
- **Chromium / Google Chrome:** Terinstal di sistem
- **9Router:** Berjalan lokal di port `20128` (atau remote via Nginx reverse proxy)

---

## 🚀 Panduan Instalasi

### 1. Clone Repositori
```bash
git clone https://github.com/ketanvpn/Gsuiteto9router.git
cd Gsuiteto9router
```

### 2. Pasang Dependensi
```bash
npm install
```

---

## ⚙️ Konfigurasi & Format Akun

### 1. Masukkan Daftar Akun
Buat atau edit file `akun.txt`:
```bash
nano akun.txt
```
Masukkan daftar akun dengan format `email|password` (satu akun per baris):
```text
user1@domainkamu.com|password123
user2@domainkamu.com|password123
user3@domainkamu.com|password123
```

### 2. Variabel Lingkungan (Opsional)
Anda dapat menyesuaikan parameter melalui environment variable:
| Variabel | Default | Keterangan |
|---|---|---|
| `ROUTER_URL` | `http://localhost:20128` | Alamat dashboard 9Router |
| `ROUTER_PASSWORD` | `123456` | Kata sandi dashboard 9Router |
| `CONCURRENCY` | `1` | Jumlah akun yang diproses bersamaan |

---

## 💻 Cara Menjalankan

### Menjalankan Bot Tambah Akun Massal
```bash
npm run add
# atau
node bot.js
```

### Tips: Menjalankan di Background VPS (Termius Mobile Safe)
Gunakan `screen` agar proses tetap berjalan saat koneksi SSH terputus:
```bash
# 1. Buat sesi screen
screen -S ag

# 2. Jalankan bot
npm run add

# 3. Keluar dari screen (detach): Tekan Ctrl+A lalu D
# 4. Membuka kembali layar bot:
screen -r ag
```

---

## 🧹 Membersihkan Akun yang Habis Kuota (Limit 429)

Untuk membersihkan akun yang sudah terkena batas limit Google mingguan secara otomatis:
```bash
npm run delete
# atau
node delete.js
```

---

## 📂 Struktur Direktori

```text
├── bot.js             # Skrip utama: Puppeteer Stealth + OAuth Auto-Consent
├── delete.js          # Skrip pembersih akun limit 429 (Pure REST API)
├── run.sh             # Runner pembungkus praktis
├── package.json       # Metadata & daftar modul dependensi
├── akun.txt           # File input daftar akun (terproteksi di .gitignore)
└── README.md          # Dokumentasi teknis proyek
```

---

## ⚠️ Keamanan & Catatan Penting

1. Berkas `akun.txt` sudah otomatis dimasukkan ke `.gitignore` sehingga kredensial akun Anda **tidak akan pernah terunggah** ke GitHub.
2. Gunakan delay yang wajar dan hindari *concurrency* terlalu tinggi (disarankan `1` atau `2`) agar IP server VPS Anda tidak terkena rate limit sementara dari Google.
3. Segera kosongkan berkas `akun.txt` setelah seluruh proses impor akun selesai.

---

## 📄 Lisensi
Didistribusikan di bawah lisensi **MIT**. Bebas dimodifikasi dan digunakan untuk kebutuhan pribadi.
