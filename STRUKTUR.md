```
deploy-render/
├── server.js                 ← server produksi (listen 0.0.0.0:$PORT, /health,
│                                graceful shutdown, validasi env saat boot)
├── package.json              ← dependensi + puppeteer (cetak PDF; unduhan
│                                Chromium di-skip di Docker, memakai Chromium sistem)
├── Dockerfile                ← opsional: image dengan Chromium terpasang penuh
├── .dockerignore
├── render.yaml               ← Blueprint: Web Service + Persistent Disk (satu klik)
├── .env.example              ← daftar environment variable untuk dashboard Render
├── README.md                 ← panduan deploy Render langkah demi langkah
├── db/
│   └── sikeda-schema.sql     ← skema 9 tabel (impor ke MySQL Hostinger via phpMyAdmin)
├── scripts/
│   ├── create-superadmin.js  ← buat akun superadmin pertama (jalankan via Render Shell)
│   └── setup-db.sh           ← alternatif CLI setup database
├── public/                   ← frontend + aset statis (dilayani Express)
│   └── uploads/              ← berkas unggahan JANGAN di sini di Render —
│                                memakai Persistent Disk via UPLOADS_DIR
└── src/                      ← backend (routes, db, crypto, notify, photo, dll.)
     └── …                   ← identik dengan versi deploy-hostinger
                              (lazy-puppeteer, uploads-path, guard PDF ramah)
```

## Yang wajib Anda siapkan di luar folder ini

| Kebutuhan | Sumber | Catatan |
|---|---|---|
| **MySQL** | MySQL Hostinger Anda (`***REDACTED-DB-HOST***`) | Render **tidak** menyediakan MySQL managed. Pakai DB Hostinger yang sudah ada — pola sama dengan paket Cloudflare. Izinkan akses remote dari Render (whitelist `%` atau IP keluar Render di panel DB Hostinger). |
| **Persistent Disk** | Ditambahkan di dashboard Render (atau otomatis via `render.yaml`) | Wajib agar foto anggota & latar kartu tidak hilang saat deploy. Free plan tidak mendukung disk. |
| **Environment variables** | Diisi di dashboard Render | Daftar lengkap: `.env.example` |

## Database — impor skema

Lewat **phpMyAdmin Hostinger**: impor `db/sikeda-schema.sql` ke database
`***REDACTED-DB-NAME***`. Dump data demo dari lokal juga tersedia di
`tmp/sikeda-db.sql` (hasil backup terakhir) bila ingin membawa data uji.
