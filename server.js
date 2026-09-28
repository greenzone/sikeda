/* ============================================================
   SIKEDA — Server produksi (siap deploy Hostinger VPS)
   Perbedaan dari server.js development:
   - Listen 0.0.0.0:<PORT dari env> (kompatibel reverse proxy)
   - Health check GET /health (tanpa detail sensitif)
   - Graceful shutdown SIGTERM/SIGINT (tutup server + pool)
   - TANPA migrasi otomatis saat boot — skema dibuat via db/sikeda-schema.sql
   ============================================================ */
require('dotenv').config();
const express = require('express');
const path = require('path');
const { pool } = require('./src/db');
const { log } = require('./src/middleware');

/* Validasi environment wajib sebelum apa pun */
const REQUIRED_ENV = ['DB_HOST', 'DB_NAME', 'JWT_SECRET', 'NIK_ENC_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if(missing.length){
  console.error('✗ Environment variable wajib belum diisi: ' + missing.join(', '));
  console.error('  Salin .env.example ke .env lalu isi nilainya. Lihat dokumentasi-deploy-hostinger.md');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
/* Trust proxy HANYA bila berjalan di balik reverse proxy (produksi).
   Di Hostinger + Nginx: APP_URL diisi → trust proxy aktif otomatis. */
app.set('trust proxy', !!process.env.APP_URL || process.env.TRUST_PROXY === '1');
app.use(express.json({ limit: '2mb' }));
app.use(log);

/* ---------- Health check (sebelum middleware lain yang berat) ---------- */
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

/* ---------- Security headers ---------- */
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('X-XSS-Protection', '0');
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if(req.secure || req.headers['x-forwarded-proto'] === 'https'){
    res.header('Strict-Transport-Security', 'max-age=15552000'); /* 180 hari */
  }
  next();
});

/* ---------- Rate limit global sederhana (anti brute-force) ---------- */
const rlHits = new Map();
setInterval(() => {
  const now = Date.now();
  for(const [k, v] of rlHits){ if(now - v.start > 120000) rlHits.delete(k); } /* GC tiap 2 menit */
}, 120000).unref();
app.use('/api', (req, res, next) => {
  const key = req.ip || req.socket?.remoteAddress || 'x';
  const now = Date.now();
  const rec = rlHits.get(key) || { start: now, n: 0 };
  if(now - rec.start > 60000){ rec.start = now; rec.n = 0; }
  rec.n++;
  rlHits.set(key, rec);
  if(rec.n > 240){ /* 240 req/menit/IP cukup longgar untuk dashboard normal */
    return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
  }
  next();
});

/* ---------- CORS (frontend & API satu origin) ---------- */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if(!origin || ALLOWED_ORIGINS.length === 0){
    /* Satu origin (frontend dilayani server ini) — tidak perlu CORS header.
       Bila CORS_ORIGINS diisi di .env, hanya origin itu yang diizinkan. */
    if(origin && ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)){
      return res.status(403).json({ error: 'Origin tidak diizinkan.' });
    }
  } else {
    if(!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Vary', 'Origin');
  }
  if(req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------- Open Graph share routes (harus sebelum static) ---------- */
const publicRoutes = require('./src/routes/public');
app.get('/kta/:kode', publicRoutes.ogHandler);
app.get('/share-card/:kode', publicRoutes.shareCardHandler);
app.get('/qrcode/:signed', publicRoutes.qrcodeHandler);

/* ---------- Static frontend ---------- */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* ---------- Uploads (dapat berada di luar folder app — Hostinger Business) ----------
   Bila UPLOADS_DIR diisi (mis. /home/uXXXX/domains/DOMAIN/persistent-uploads),
   berkas unggahan disimpan & disajikan dari sana agar AMAN dari penimpaan
   saat redeploy. Tanpa UPLOADS_DIR, perilaku default dipertahankan. */
const { uploadsRoot } = require('./src/uploads-path');
if (process.env.UPLOADS_DIR) {
  app.use('/uploads', express.static(uploadsRoot(), { maxAge: '7d' }));
}

/* ---------- API ---------- */
app.use('/api/public', require('./src/routes/public'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/vcard', require('./src/routes/vcard'));
app.use('/api', require('./src/routes/api'));

/* ---------- 404 API ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

/* ---------- 404 halaman (fallback terakhir untuk path non-API) ---------- */
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

/* ---------- Error handler produksi: tanpa stack trace ke klien ---------- */
app.use((err, req, res, next) => {
  console.error('[error]', new Date().toISOString(), req.method, req.originalUrl, '-', err.message);
  if(process.env.NODE_ENV !== 'production') console.error(err.stack || err);
  if(res.headersSent) return next(err);
  res.status(500).json({ error: 'Kesalahan server internal.' });
});

/* ---------- Boot ---------- */
const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3000;
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✓ MySQL terhubung:', process.env.DB_NAME);
  } catch(e){
    console.error('✗ Koneksi MySQL gagal:', e.message);
    process.exit(1);
  }
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ SIKEDA (produksi) berjalan pada port ${PORT}`);
  });

  /* ---------- Graceful shutdown ---------- */
  const shutdown = async (signal) => {
    console.log(`${signal} diterima, mematikan server…`);
    server.close(async () => {
      try { await pool.end(); } catch(e){ /* abaikan */ }
      process.exit(0);
    });
    /* Paksa keluar bila koneksi menggantung */
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();

/* Jaga proses tetap hidup dari unhandled error (log, lalu keluar bersih) */
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err && err.message ? err.message : err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.message ? err.message : err);
  shutdown('uncaughtException');
});
