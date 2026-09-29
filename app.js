/* ============================================================
   SIKEDA — App Express untuk Vercel (Serverless Functions)
   Dipakai api/index.js. TANPA listen/log file/rate-limit in-memory
   (di Vercel: instance ephemeral, request di-throttle platform).
   ============================================================ */
const express = require('express');
const path = require('path');
const { pool } = require('./src/db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); /* selalu di balik proxy Vercel */
app.use(express.json({ limit: '2mb' }));

/* ---------- Deteksi beban & halaman antrian ----------
   Per-instance (serverless): hanya signal lag & concurrency instance ini.
   Default normal — aktif saat melewati ambang atau dipaksa superadmin. */
app.use(require('./src/busy').middleware);

/* ---------- Security headers ---------- */
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('X-XSS-Protection', '0');
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if(req.secure || req.headers['x-forwarded-proto'] === 'https'){
    res.header('Strict-Transport-Security', 'max-age=15552000');
  }
  next();
});

/* ---------- CORS (bila frontend di domain terpisah) ---------- */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if(origin && ALLOWED_ORIGINS.length){
    if(!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Vary', 'Origin');
  }
  if(req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------- Migrasi ringan idempotent (sekali per cold start) ---------- */
let migrated = null;
function ensureMigrated(){
  if(migrated) return migrated;
  migrated = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS pengumuman (
      id INT AUTO_INCREMENT PRIMARY KEY,
      target ENUM('umum','personal') NOT NULL DEFAULT 'umum',
      anggota_id INT NULL,
      kategori ENUM('pengumuman','pemberitahuan','pesan') NOT NULL DEFAULT 'pengumuman',
      judul VARCHAR(160) NOT NULL,
      isi TEXT NOT NULL,
      prioritas ENUM('normal','penting') NOT NULL DEFAULT 'normal',
      channels VARCHAR(64) NULL,
      aktif TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      INDEX idx_peng_target (target, anggota_id, aktif),
      INDEX idx_peng_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
    await pool.query(`CREATE TABLE IF NOT EXISTS data_drafts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      anggota_id INT NOT NULL,
      payload JSON NOT NULL,
      status ENUM('draft','pending','disetujui','ditolak') NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submitted_at DATETIME NULL,
      reviewed_at DATETIME NULL,
      reviewed_by INT NULL,
      catatan_review VARCHAR(255) NULL,
      INDEX idx_draft_anggota (anggota_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
    const [pgCols] = await pool.query("SHOW COLUMNS FROM pengumuman LIKE 'channels'").catch(() => [[]]);
    if(!pgCols.length){
      await pool.query("ALTER TABLE pengumuman ADD COLUMN channels VARCHAR(64) NOT NULL DEFAULT '' AFTER prioritas").catch(() => {});
    }
  })().catch(e => { migrated = null; throw e; });
  return migrated;
}

/* ---------- Open Graph share routes ---------- */
const publicRoutes = require('./src/routes/public');
app.get('/kta/:kode', publicRoutes.ogHandler);
app.get('/share-card/:kode', publicRoutes.shareCardHandler);
app.get('/qrcode/:signed', publicRoutes.qrcodeHandler);

/* ---------- API ---------- */
app.use('/api', async (req, res, next) => { try { await ensureMigrated(); } catch(e){ console.error('migrasi:', e.message); } next(); });
app.use('/api/public', require('./src/routes/public'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/vcard', require('./src/routes/vcard'));
app.use('/api', require('./src/routes/api'));

/* ---------- 404 API ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

/* ---------- Error handler produksi ---------- */
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, '-', err.message);
  if(res.headersSent) return next(err);
  res.status(500).json({ error: 'Kesalahan server internal.' });
});

module.exports = app;
