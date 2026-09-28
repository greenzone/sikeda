# ============================================================
# SIKEDA — Image Docker untuk Render (opsional, direkomendasikan)
# Keunggulan vs runtime Node native: Chromium + font + lib seluruhnya
# terpasang pasti → cetak PDF kartu dijamin jalan.
#
# Pola puppeteer di sini: modul puppeteer tetap dipasang (sesuai
# package.json), tapi UNDUHAN Chromium-nya dilewati
# (PUPPETEER_SKIP_DOWNLOAD=1) dan diganti Chromium sistem Debian
# lewat PUPPETEER_EXECUTABLE_PATH. Hasil: image ringan, PDF tetap jalan.
# ============================================================
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation fonts-noto-color-emoji ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    UPLOADS_DIR=/var/data/uploads

WORKDIR /app

# Dependensi dulu (layer cache) — memakai package.json + lockfile asli
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Kode aplikasi
COPY . .

EXPOSE 3000
# Render menyuntikkan $PORT; server.js produksi membaca PORT env
CMD ["node", "server.js"]
