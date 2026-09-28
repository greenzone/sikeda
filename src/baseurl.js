/* ============================================================
   SIKEDA — Basis URL publik untuk tautan & file yang dikirim
   keluar (email reset, lampiran WA/Telegram, dll).
   Prioritas: APP_URL di .env (WAJIB benar di produksi),
   fallback ke host request untuk pengembangan lokal.
   ============================================================ */
function baseUrl(req){
  if(process.env.APP_URL) return String(process.env.APP_URL).replace(/\/+$/, '');
  return req.protocol + '://' + req.get('host');
}

module.exports = { baseUrl };
