# Panduan Deploy SIKEDA — Vercel (Serverless Functions)

> Paket ini sudah diadaptasi ke model **serverless Vercel**: tidak ada
> `server.js` yang menyala terus — API berupa fungsi, static assets
> dilayani CDN Vercel, dan cetak PDF memakai Chromium khusus serverless.
> Database tetap MySQL Hostinger remote (sama dengan paket Render/Hostinger).

---

## 1. Yang berubah dibanding versi Node biasa

| Aspek | Node (Hostinger/Render) | Vercel (paket ini) |
|---|---|---|
| Server | `server.js` listen terus | `api/index.js` — fungsi per request |
| Static | express.static | **CDN Vercel** (otomatis dari `public/`) |
| Rate limit & log file | in-memory / file | dihapus (instance ephemeral) |
| Trust proxy | kondisional | selalu `true` |
| Upload foto/gambar | `public/uploads` / `UPLOADS_DIR` | **`/tmp/sikeda-uploads`** (read-only FS) |
| Koneksi MySQL | pool 10 | pool 4 + keep-alive (hemat koneksi) |
| Cetak PDF | puppeteer + Chromium bundling | `api/cetak.js` + `@sparticuz/chromium` |
| Migrasi tabel ringan | saat boot server | sekali per cold start (`app.js`) |

## 2. Struktur

```
deploy-vercel/
├── api/
│   ├── index.js        ← SEMUA /api/*, /kta/*, /share-card/*, /qrcode/*
│   ├── cetak.js        ← PDF kartu (fungsi berat: 300 s)
│   └── proxy.js        ← static fallback + /uploads (clean URL, 404)
├── app.js              ← Express app (dipakai kedua fungsi di atas)
├── src/                ← kode aplikasi (patch serverless di uploads-path/db/photo)
├── public/             ← frontend (dilayani CDN Vercel)
├── db/sikeda-schema.sql← skema database
├── scripts/create-superadmin.js
├── vercel.json         ← routing + konfigurasi fungsi
├── test-server.js      ← uji lokal (simulasi routing Vercel)
└── .env.example        ← daftar env vars
```

## 3. Langkah deploy

### 3.1 Database (sekali)
Impor `db/sikeda-schema.sql` via phpMyAdmin Hostinger bila database
belum berisi. Lalu buat superadmin:
```bash
cd deploy-vercel
node scripts/create-superadmin.js   # butuh .env lokal sementara
```

### 3.2 Push ke Git
```bash
cd deploy-vercel
git init -b main
git add -A
git commit -m "SIKEDA — paket deploy Vercel"
git remote add origin git@gitlab.com:USERNAME/sikeda-vercel.git
git push -u origin main
```
> Jangan commit `.env` — sudah ada di `.gitignore`. Kredensial masuk lewat dashboard Vercel.

### 3.3 Buat project di Vercel
1. **vercel.com → Add New → Project** → import repo
2. Framework Preset: **Other** — biarkan Vercel membaca `vercel.json`
3. Root Directory: kosong (root repo)
4. **Environment Variables** (Production + Preview) — salin dari `.env.example`:

   | Kunci | Nilai | Catatan |
   |---|---|---|
   | `DB_HOST` | host MySQL Anda | Hostinger |
   | `DB_PORT` | `3306` | |
   | `DB_USER` / `DB_PASSWORD` / `DB_NAME` | kredensial DB | |
   | `JWT_SECRET` | string acak | bebas baru |
   | `NIK_ENC_KEY` | 64 hex | **harus sama persis** dgn env lama |
   | `APP_URL` | `https://<project>.vercel.app` | isi setelah tahu URL |
   | `CORS_ORIGINS` | kosong | frontend & API satu origin |

5. **Deploy** → tunggu build (~1 menit)

### 3.4 Setelah live — verifikasi
```bash
B=https://<project>.vercel.app
curl -s $B/api/public/health            # {"ok":true,...}
curl -s $B/api/public/branding          # branding JSON
curl -sfI $B/index.html | head -1       # 200
curl -sfI $B/dashboard | head -1        # 200 (clean URL)
```
Lalu uji dari browser: login dashboard (OTP/demo), buka kartu digital,
**cetak PDF** (butuh Chromium serverless — panggilan pertama ~10-20 dtk),
upload foto profil.

### 3.5 Custom domain (opsional)
Vercel → Project → Settings → Domains → tambah domain → sesuaikan DNS →
perbarui env `APP_URL` → redeploy.

## 4. Keterbatasan & catatan penting

1. **Filesystem read-only** — foto/gambar unggahan tersimpan di `/tmp`,
   bertahan selama instance hidup, **hilang saat cold start baru**. Untuk
   produksi serius, sambungkan **Vercel Blob** (lihat `src/uploads-path.js`
   sebagai titik integrasi tunggal — semua tulisan upload lewat modul ini).
2. **Cetak PDF** — via `api/cetak.js`, `maxDuration` 300 dtk (sah untuk
   Hobby & Pro dengan fluid compute; RAM mengikuti default plan —
   Hobby 2 GB, tidak dapat dikonfigurasi). Kalau di Hobby tetap
   timeout/OOM, cetak lewat paket Render/Hostinger atau upgrade Pro.
3. **Koneksi MySQL** — setiap instance cold start membuka pool baru.
   Hostinger remote MySQL mendukung, tapi pantau `Max_connections`.
4. **Warm-up** — request pertama tiap fungsi lambat (cold start). Normal.
5. **`JWT_SECRET`/`NIK_ENC_KEY`** — `NIK_ENC_KEY` HARUS sama dengan
   platform lain agar NIK terenkripsi tetap terbaca.

## 5. Uji lokal (opsional)

```bash
cd deploy-vercel
cp .env.example .env   # isi nilai asli
npm install            # (butuh mysql2, express, dst.)
node test-server.js 4588
# lalu: curl http://localhost:4588/api/public/health
```

## 6. Rollback

Vercel Dashboard → Deployments → pilih versi lama → **Instant Rollback**.
