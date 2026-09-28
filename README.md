# SIKEDA — Deploy ke Render.com

> **Apa yang jalan di mana:**
> - **Aplikasi Node.js** → Render Web Service (folder ini)
> - **MySQL** → tetap di **Hostinger** (`***REDACTED-DB-HOST***`) — Render tidak
>   menyediakan MySQL managed; pola sama dengan paket Cloudflare Workers
> - **Foto/berkas unggahan** → Persistent Disk Render (via `UPLOADS_DIR`)
> - **Cetak PDF kartu** → puppeteer + Chromium (jalan penuh, beda dari
>   Cloudflare Workers yang dibatasi kuota Browser Run)

---

## Pilih jalur deploy

| | **Jalur A — Node native** (paling cepat) | **Jalur B — Docker** (paling andal untuk PDF) |
|---|---|---|
| Cara | New + → Web Service → connect repo | New + → Web Service → **Deploy an existing image** atau repo dengan Dockerfile |
| Chromium | Diunduh puppeteer saat build (±150 MB, build lebih lama) | Sudah terpasang di image (`chromium` Debian) |
| Risiko | Jarang: lib sistem kurang → PDF gagal | Nyaris nol |
| Cocok untuk | Coba cepat / uji | Produksi |

Kedua jalur memakai **kode & env yang sama persis**.

---

## 0. Sebelum mulai — siapkan 3 hal

1. **Kode di GitHub/GitLab** — push folder ini ke repo (lihat catatan
   keamanan di bawah sebelum push!).
2. **Skema database** — impor `db/sikeda-schema.sql` ke MySQL Hostinger
   lewat phpMyAdmin (database `***REDACTED-DB-NAME***`).
3. **Akses remote MySQL** — pastikan user DB Hostinger boleh koneksi dari
   luar (whitelist host `%` di panel Remote MySQL Hostinger bila ada).

> ⚠️ **Sebelum push ke repo publik**: folder ini TIDAK berisi kredensial
> (semua rahasia lewat env vars Render) — `.env` tidak ikut. Periksa lagi
> dengan `git grep -lE "PASSWORD=|SECRET=" $(git rev-list --all)` — harus nihil
> kecuali di `.env.example` (contoh nama kunci, tanpa password asli).
> Riwayat Git sudah dibersihkan via `git filter-repo` (28 Sep 2026); nilai
> kredensial diisi langsung di dashboard Render.

## 1. Buat Web Service

1. Login **dashboard.render.com** → **New + → Web Service**
2. Connect repo GitHub/GitLab Anda → pilih repo
3. Isi:
   - **Name**: `sikeda`
   - **Region**: `Singapore` (terdekat dari Indonesia)
   - **Runtime**: `Node` (Jalur A) atau `Docker` (Jalur B)
   - **Instance type**: minimal **Starter** ($7/mo) — Free tidak mendukung
     Persistent Disk dan terlalu lambat untuk Chromium
4. **Build command** (Jalur A): `npm ci --no-audit --no-fund`
   — **Start command**: `npm start`
   (Unduhan Chromium berjalan otomatis pada postinstall puppeteer;
    Jalur B: Build/Start otomatis dari Dockerfile)
5. **Advanced → Add Disk**:
   - Name: `sikeda-uploads` · Mount path: `/var/data/uploads` · Size: 1 GB
6. **Environment variables** (lihat `.env.example` untuk daftar lengkap):

   | Key | Value |
   |---|---|
   | `DB_HOST` | `***REDACTED-DB-HOST***` |
   | `DB_PORT` | `3306` |
   | `DB_USER` | `***REDACTED-DB-USER***` |
   | `DB_PASSWORD` | password DB Anda |
   | `DB_NAME` | `***REDACTED-DB-NAME***` |
   | `JWT_SECRET` | acak baru: `openssl rand -hex 32` |
   | `JWT_EXPIRES` | `12h` |
   | `NIK_ENC_KEY` | **sama persis** dengan `.env` versi lama — NIK lama tak terbaca bila beda |
   | `APP_URL` | `https://sikeda.onrender.com` |
   | `UPLOADS_DIR` | `/var/data/uploads` |
   | `NODE_ENV` | `production` |

   Atau pakai **Blueprint**: `render.yaml` di folder ini membuat layanan +
   disk + env vars sekaligus (*New + → Blueprint*).

7. **Create Web Service** → tunggu build ±3–8 menit (Jalur A mengunduh
   Chromium saat `npm install`)

## 2. Verifikasi

```bash
BASE=https://sikeda.onrender.com
curl -s $BASE/health                          # {"ok":true,...} ← server hidup
curl -s -o /dev/null -w "%{http_code}\n" $BASE/index.html        # 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/public/stats  # 200 ← DB tersambung
```

Lalu di browser:
1. Login superadmin → dashboard terbuka (DB jalan)
2. Daftar Anggota → foto tampil (Persistent Disk jalan)
3. vCard → **Cetak PDF** → file PDF terunduh (Chromium jalan)
4. Kirim kartu via WhatsApp/Telegram/Email → masuk (gateway jalan)

## 3. Superadmin pertama

Render Dashboard → Web Service `sikeda` → tab **Shell**:

```bash
node scripts/create-superadmin.js
```

(ikuti prompt username/password/email — database harus sudah terisi skema)

## 4. Update & operasional

- **Deploy ulang**: `git push` → Render auto-deploy (`autoDeploy: true`)
- **Rollback**: dashboard → Events → pilih versi lama → Rollback
- **Log real-time**: tab **Logs**
- **Domain kustom**: Settings → Custom Domains → tambahkan → update
  env var `APP_URL` → deploy ulang (APP_URL dipakai QR & lampiran WA)
- **Sleep mode**: Web Service Free tidur setelah 15 menit idle — Starter
  tidak tidur. Jangan pakai Free untuk produksi.
- **Backup DB**: dump rutin dari phpMyAdmin Hostinger.

## Catatan khusus Render

- **Cold start** build pertama lebih lama karena unduhan Chromium (Jalur A);
  Jalur B (Docker) build lebih cepat setelah image tersimpan.
- **Persistent Disk** hanya bisa dirakit di region yang sama dengan service —
  keduanya `singapore` di render.yaml.
- Jika suatu saat ingin memindahkan DB ke managed PostgreSQL Render,
  itu = migrasi skema + kode (mysql2 → pg) — tidak perlu selama MySQL
  Hostinger sehat.
