# Panduan Singkat Add Mass AG (GSuite) ke 9Router

Tool ini sudah dipasang dan disesuaikan di folder:
`/root/projects/GsuitetoGravity`

## Langkah 1: Masukkan Daftar Akun
Edit file `akun.txt`:
```bash
nano /root/projects/GsuitetoGravity/akun.txt
```
Format per baris (`email|password`):
```text
akun1@gsuite-kamu.com|passwordAkun1
akun2@gsuite-kamu.com|passwordAkun2
akun3@gsuite-kamu.com|passwordAkun3
```

## Langkah 2: Jalankan Bot
Jalankan skrip runner:
```bash
cd /root/projects/GsuitetoGravity
./run.sh
```
*Catatan:* Jika password 9Router Anda bukan `123456`, jalankan dengan memasukkan password dashboard Anda:
```bash
ROUTER_PASSWORD="PASSWORD_DASHBOARD_ANDA" ./run.sh
```

## Langkah 3: Bersihkan Akun yang Kuotanya Habis (Opsional)
Jika di kemudian hari kuota akun habis (HTTP 429), Anda bisa auto-delete dengan perintah:
```bash
cd /root/projects/GsuitetoGravity
ROUTER_PASSWORD="PASSWORD_DASHBOARD_ANDA" node delete.js
```
