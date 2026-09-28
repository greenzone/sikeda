/* ============================================================
   SIKEDA — Vercel Serverless entry
   Semua request (kecuali static assets, dilayani Vercel CDN)
   masuk ke sini. Middleware berat (rate limit in-memory, log
   file) sengaja tidak dipakai — lihat app.js.
   ============================================================ */
const app = require('../app');

module.exports = async (req, res) => {
  await new Promise((resolve) => app(req, res, resolve));
};
