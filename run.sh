#!/bin/bash
# ==============================================================================
# Runner: Add Mass Google (GSuite) ke 9Router Antigravity (AG)
# ==============================================================================

PROJECT_DIR="/root/projects/GsuitetoGravity"
cd "$PROJECT_DIR" || exit 1

# Cek file akun.txt
if [ ! -f "akun.txt" ] || [ ! -s "akun.txt" ]; then
  echo "⚠️  File akun.txt masih kosong atau belum dibuat!"
  echo "Silakan isi file $PROJECT_DIR/akun.txt dengan format:"
  echo "email1@domain.com|password123"
  echo "email2@domain.com|password456"
  exit 1
fi

echo "🚀 Menjalankan bot add mass AG ke 9Router..."
# Menjalankan bot dengan virtual display (Xvfb) & headless mode di VPS
xvfb-run -a node bot.js
