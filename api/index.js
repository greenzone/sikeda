/* ============================================================
   SIKEDA — Vercel Serverless entry
   Semua request (kecuali static assets, dilayani CDN) masuk ke sini.
   Middleware berat (rate limit in-memory, log file) sengaja tidak
   dipakai — lihat app.js.

   DIAGNOSTIK: kegagalan boot (require app) ditangkap dan dilaporkan
   sebagai JSON — hanya bila request memuat ?diag=…  yang cocok.
   Token diag bisa diganti/dihapus setelah masalah selesai.
   ============================================================ */
let app = null;
let bootError = null;
try {
  app = require('../app');
} catch (e) {
  bootError = e;
}

const DIAG_TOKEN = process.env.DIAG_TOKEN || 'sikeda-cold-2026';

module.exports = async (req, res) => {
  if (bootError) {
    const url = (req.url || '');
    const show = url.indexOf('diag=' + DIAG_TOKEN) !== -1;
    res.statusCode = 500;
    res.setHeader('Content-Type', show ? 'application/json; charset=utf-8' : 'application/json; charset=utf-8');
    res.end(JSON.stringify(show ? {
      bootError: bootError.message,
      stack: String(bootError.stack || '').split('\n').slice(0, 8)
    } : { error: 'Boot gagal — tambahkan ?diag=… untuk detail.' }));
    return;
  }
  await new Promise((resolve) => app(req, res, resolve));
};
