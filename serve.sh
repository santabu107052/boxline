#!/usr/bin/env bash
# Chạy máy chủ tĩnh trong thư mục dự án để ES module hoạt động (file:// hay bị chặn).
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
echo "Boxline đang chạy tại http://127.0.0.1:${PORT}/"
echo "Nhấn Ctrl+C để dừng."
exec python3 -m http.server "${PORT}" --bind 127.0.0.1
