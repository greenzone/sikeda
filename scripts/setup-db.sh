#!/usr/bin/env bash
# ============================================================
# SIKEDA — Setup database produksi (Hostinger VPS)
# Pemakaian : bash scripts/setup-db.sh
# Syarat    : file .env sudah diisi (salin dari .env.example)
# Hasil     : database + 9 tabel kosong siap pakai (tanpa data uji)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "✗ File .env belum ada. Salin dulu: cp .env.example .env lalu isi."
  exit 1
fi

set -a; source .env; set +a

DBH="${DB_HOST:-127.0.0.1}"
DBP="${DB_PORT:-3306}"

echo "→ Membuat database ${DB_NAME} (bila belum ada)…"
mysql -h"$DBH" -P"$DBP" -u"$DB_USER" -p"$DB_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "→ Mengimpor skema (9 tabel, tanpa data)…"
mysql -h"$DBH" -P"$DBP" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < db/sikeda-schema.sql

echo "→ Memastikan kolom pengumuman.channels ada (skema lama)…"
mysql -h"$DBH" -P"$DBP" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  -e "ALTER TABLE pengumuman ADD COLUMN IF NOT EXISTS channels VARCHAR(64) NOT NULL DEFAULT '' AFTER prioritas;" 2>/dev/null || true

echo "✓ Database siap. Selanjutnya buat akun superadmin: node scripts/create-superadmin.js"
