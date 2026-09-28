/* ============================================================
   SIKEDA — Vercel: cetak PDF kartu (fungsi terpisah, resource besar)
   Reuse buildPdfBuffer dari routes/vcard dengan request shim.
   Puppeteer-core + @sparticuz/chromium (Chromium khusus serverless).
   CATATAN: menerima raw Node res (bukan Express) — bantu json()
   & status() diimplementasikan manual.
   ============================================================ */
const app = require('./app'); /* reuse pool/migrasi */

function json(res, code, obj){
  if(!res.headersSent){
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.end(JSON.stringify(obj));
}

let chromiumCache = null;
async function getChromium(){
  if(chromiumCache) return chromiumCache;
  const chromium = require('@sparticuz/chromium');
  chromiumCache = await chromium.executablePath();
  return chromiumCache;
}

module.exports = async (req, res) => {
  try {
    /* URL: /api/cetak/<KODE>?exp=<ms>&sig=<hmac>
       Verifikasi tanda tangan murni dari env — TIDAK lewat router app
       (di test-server, app mencakup /api/* sebelum handler ini dieksekusi). */
    const m = /^\/api\/cetak\/([A-Za-z0-9-]+)\/?$/.exec((req.url || '').split('?')[0]);
    if(!m) return json(res, 404, { error: 'Endpoint tidak ditemukan.' });
    const kode = m[1].toUpperCase();
    const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);

    const crypto = require('crypto');
    const exp = Number(q.exp);
    const now = Date.now();
    if(!Number.isFinite(exp) || exp < now || exp > now + 24 * 60 * 60 * 1000){
      return json(res, 403, { error: 'Tautan kedaluwarsa. Minta kirim ulang.' });
    }
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const sig = crypto.createHmac('sha256', secret).update(kode + ':' + exp).digest('hex');
    const ba = Buffer.from(String(q.sig || ''));
    const bb = Buffer.from(sig);
    if(ba.length !== bb.length || !crypto.timingSafeEqual(ba, bb)){
      return json(res, 403, { error: 'Tautan tidak valid.' });
    }

    const { q: query } = require('../src/db');
    const rows = await query('SELECT id FROM anggota WHERE kode_unik = ? AND status = ? LIMIT 1', [kode, 'Aktif']);
    if(!rows.length) return json(res, 404, { error: 'Kartu tidak ditemukan atau tidak aktif.' });

    const { buildPdfBufferRaw } = require('../src/pdf-vercel');
    const { baseUrl } = require('../src/baseurl');
    const host = baseUrl(req);
    const buf = await buildPdfBufferRaw(kode, host, await getChromium());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="KTA-' + kode.toLowerCase() + '.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.end(buf);
  } catch(e){
    console.error('cetak error:', e && (e.stack || e.message));
    if(!res.headersSent) return json(res, 500, { error: e.message || 'Gagal membuat PDF.' });
    res.end();
  }
};
