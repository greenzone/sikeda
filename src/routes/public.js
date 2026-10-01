/* ============================================================
   SIKEDA — Routes publik (tanpa auth): branding & health
   Dipakai semua halaman untuk logo dinamis + nama organisasi.
   ============================================================ */const express = require('express');
const { q } = require('../db');
const { baseUrl } = require('../baseurl');
const { sendTelegram } = require('../notify');
const router = express.Router();

/* GET /api/public/branding — logo (dashboard/landing), hero bg + identitas org */
router.get('/branding', async (req, res) => {
  try {
    const rows = await q(
      "SELECT kunci, nilai FROM settings WHERE kunci IN ('org_nama','org_wilayah','logo_dashboard','logo_landing','hero_bg','favicon','site.logo_header','site.favicon')"
    );
    const data = { org_nama: 'DPD Nusantara Bersatu', org_wilayah: '', logo_dashboard: '', logo_landing: '', hero_bg: '', favicon: '' };
    rows.forEach(r => {
      if(!r.nilai) return;
      if(r.kunci === 'site.logo_header') data.logo_landing = r.nilai;
      else if(r.kunci === 'site.favicon') data.favicon = r.nilai;
      else data[r.kunci] = r.nilai;
    });
    /* Fallback default utama (folder /favicon) — klien memakai aset
       bawaan ini bila admin belum mengunggah favicon/logo sendiri. */
    if(!data.favicon) data.favicon_default = '/favicon/favicon.svg';
    if(!data.logo_dashboard && !data.logo_landing) data.logo_default = '/favicon/web-app-manifest-192x192.png';
    res.json({ ok: true, data });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal memuat branding.' });
  }
});

/* GET /api/public/reg-fields — definisi field form pendaftaran aktif.
   Publik (dipakai daftar.html & embed.js); tanpa data sensitif. */
router.get('/reg-fields', async (req, res) => {
  try {
    const fields = await require('../regfields').loadActiveFields();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ ok: true, data: fields });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal memuat konfigurasi form.' });
  }
});

/* GET /api/health — probe sederhana */
router.get('/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

/* GET /api/public/busy-status — status antrian untuk halaman busy.html & poller klien.
   Ringan: tidak menyentuh DB (hanya counter memori proses ini). */
router.get('/busy-status', (req, res) => {
  try {
    const s = require('../busy').snapshot();
    res.json({ ok: true, data: { state: s.state, busy: s.busy, mode: s.mode, inflight: s.inflight, lagMs: s.lagMs, maxConc: s.maxConc, maxLagMs: s.maxLagMs, releaseSecs: s.releaseSecs, platform: s.platform, uptimeSecs: s.uptimeSecs, warming: s.warming, format: s.format, gateSuppressed: s.gateSuppressed, suppressSecs: s.suppressSecs, graceActive: s.graceActive } });
  } catch(e){ res.json({ ok: true, data: { state: 'normal', busy: false, mode: 'off' } }); }
});

/* GET /api/public/content — seluruh konten halaman depan & login (publik, tanpa auth).
   Dipakai index.html & login.html untuk merender teks/aset dinamis. */
router.get('/content', async (req, res) => {
  try {
    const { q } = require('../db');
    const { SITE_DEFAULTS } = require('./api');
    const rows = await q("SELECT kunci, nilai FROM settings WHERE kunci LIKE 'site.%' OR kunci = 'help_contact_target'");
    const data = Object.assign({}, SITE_DEFAULTS); /* fallback dulu */
    rows.forEach(r => { data[r.kunci] = r.nilai || ''; }); /* tersimpan menimpa */
    res.json({ ok: true, data });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal memuat konten situs.' });
  }
});

/* ============================================================
   POST /api/public/contact — pesan "Hubungi Pengurus" dari popup.
   Diteruskan ke Telegram (bot). Tanpa auth; rate-limited global.
   ============================================================ */
router.post('/contact', async (req, res) => {
  try {
    const nama = String(req.body.nama || '').trim().slice(0, 80);
    const kontak = String(req.body.kontak || '').trim().slice(0, 80);
    const pesan = String(req.body.pesan || '').trim().slice(0, 1000);
    if(!nama || !kontak || !pesan){
      return res.status(400).json({ error: 'Nama, kontak, dan pesan wajib diisi.' });
    }
    if(pesan.length < 10){
      return res.status(400).json({ error: 'Pesan terlalu pendek (minimal 10 karakter).' });
    }
    const srows = await q("SELECT kunci, nilai FROM settings WHERE kunci IN ('help_contact_target','telegram_bot_token','telegram_chat_id')");
    const st = {};
    srows.forEach(r => st[r.kunci] = (r.nilai || '').trim());
    if(!st.telegram_bot_token){
      return res.status(503).json({ error: 'Layanan pesan belum aktif. Silakan hubungi pengurus lewat kontak di footer.' });
    }
    /* Target: khusus form ini bila diisi; jika tidak, channel utama (chat_id pengaturan) */
    const chatId = st.help_contact_target || st.telegram_chat_id;
    if(!chatId){
      return res.status(503).json({ error: 'Layanan pesan belum aktif. Silakan hubungi pengurus lewat kontak di footer.' });
    }
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const text = '<b>Pesan dari portal SIKEDA</b>\n' +
      '<b>Nama:</b> ' + esc(nama) + '\n' +
      '<b>Kontak:</b> ' + esc(kontak) + '\n\n' +
      esc(pesan);
    const r = await sendTelegram(chatId, text);
    if(!r.ok){
      console.error('[contact] telegram gagal:', r.err);
      return res.status(502).json({ error: 'Pesan gagal terkirim. Coba lagi nanti atau hubungi pengurus lewat kontak di footer.' });
    }
    await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (NULL, ?, ?, ?)',
      ['publik:' + nama, 'Pesan hubungi pengurus', 'via portal — kontak: ' + kontak]);
    res.json({ ok: true, message: 'Pesan terkirim. Terima kasih! Pengurus akan menindaklanjuti.' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal mengirim pesan.' });
  }
});

/* GET /api/public/wilayah — untuk form embed di website eksternal (tanpa auth) */
router.get('/wilayah', async (req, res) => {
  try {
    const rows = await q('SELECT kecamatan, desa FROM wilayah ORDER BY kecamatan, desa');
    const data = {};
    rows.forEach(r => { (data[r.kecamatan] = data[r.kecamatan] || []).push(r.desa); });
    res.json({ ok: true, data });
  } catch(e){
    res.status(500).json({ error: 'Gagal memuat wilayah.' });
  }
});

/* GET /api/public/stats — statistik strip halaman depan (tanpa auth) */
router.get('/stats', async (req, res) => {
  try {
    const [aktif, kec, desa, lengkap] = await Promise.all([
      q("SELECT COUNT(*) n FROM anggota WHERE status='Aktif'"),
      q("SELECT COUNT(DISTINCT kecamatan) n FROM anggota WHERE status='Aktif'"),
      q("SELECT COUNT(DISTINCT desa) n FROM anggota WHERE status='Aktif'"),
      q("SELECT ROUND(100 * SUM(nik_lengkap)/COUNT(*)) n FROM (SELECT CASE WHEN nik_enc IS NOT NULL AND nik_enc != '' AND desa IS NOT NULL AND desa != '' AND whatsapp IS NOT NULL AND whatsapp != '' THEN 1 ELSE 0 END nik_lengkap FROM anggota WHERE status='Aktif') t")
    ]);
    res.json({ ok: true, data: {
      anggotaAktif: aktif[0].n,
      kecamatan: kec[0].n,
      ranting: desa[0].n,
      kelengkapan: lengkap[0].n || 0
    }});
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal memuat statistik.' });
  }
});

/* ============================================================
   GET /qrcode/<url-encoded-url> — generate QR PNG (publik, tanpa auth)
   Dipakai template PDF vCard untuk QR verifikasi.
   ============================================================ */
async function qrcodeHandler(req, res){
  try {
    const raw = decodeURIComponent(req.params.signed);
    if(!raw){ return res.status(400).type('text/plain').send('uri wajib'); }
    if(typeof raw !== 'string' || raw.length > 2048){ return res.status(400).type('text/plain').send('uri tidak valid'); }
    const qrcode = require('qrcode');
    const png = await qrcode.toDataURL(raw, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 480,
      margin: 2
    });
    /* base64 data URL → Buffer PNG mentah untuk Content-Type image/png */
    const data = Buffer.from(png.split(',')[1], 'base64');
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('image/png').send(data);
  } catch(e){
    console.error('/qrcode/ error:', e && (e.stack || e.message));
    if(!res.headersSent) res.status(500).type('text/plain').send('gagal buat qr');
  }
}

/* ============================================================
   Handler Open Graph untuk /kta/:kode & /share-card/:kode.
   Didaftarkan juga di root server.js — crawler WA/FB/Twitter
   membaca meta; manusia dialihkan ke vcard.html (butuh login).
   ============================================================ */
async function ogHandler(req, res){
  try {
    const rows = await q('SELECT kode_unik, nama, jabatan, kecamatan, status FROM anggota WHERE UPPER(kode_unik) = ? LIMIT 1', [req.params.kode.toUpperCase()]);
    if(!rows.length || rows[0].status !== 'Aktif') return res.status(404).send('Kartu tidak ditemukan.');
    const r = rows[0];
    const sambutan = r.nama.split(' ').slice(0, 2).join(' ');
    const desk = (r.jabatan || 'Anggota') + ' · ' + r.kecamatan + ' — terverifikasi resmi DPD Nusantara Bersatu.';
    const host = baseUrl(req);
    const cardUrl = host + '/share-card/' + r.kode_unik;
    const kartuUrl = host + '/kta/' + r.kode_unik.toLowerCase();
    const vcardUrl = host + '/vcard.html?id=' + r.kode_unik.toLowerCase();
    const siteName = 'SIKEDA — DPD Nusantara Bersatu';
    res.type('html').send(`<!DOCTYPE html><html lang="id"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${sambutan} — Kartu Anggota SIKEDA</title>
<meta name="description" content="${desk}">
<link rel="canonical" href="${kartuUrl}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${sambutan} — Anggota Terverifikasi">
<meta property="og:description" content="${desk}">
<meta property="og:image" content="${cardUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Kartu anggota digital ${sambutan} — Anggota Terverifikasi DPD Nusantara Bersatu">
<meta property="og:url" content="${kartuUrl}">
<meta property="og:site_name" content="${siteName}">
<meta property="og:locale" content="id_ID">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${sambutan} — Anggota Terverifikasi">
<meta name="twitter:description" content="${desk}">
<meta name="twitter:image" content="${cardUrl}">
<meta name="twitter:site" content="@sikeda_dpd">
<meta http-equiv="refresh" content="0;url=${vcardUrl}">
</head><body style="font-family:sans-serif;background:#081120;color:#eef2f8;display:grid;place-items:center;height:100vh;margin:0;">Membuka kartu anggota… <a href="${vcardUrl}" style="color:#eac06a;">lanjut</a></body></html>`);
  } catch(e){
    res.status(500).send('Kesalahan server.');
  }
}

async function shareCardHandler(req, res){
  try {
    const rows = await q('SELECT kode_unik, nama, jabatan, kecamatan, status FROM anggota WHERE UPPER(kode_unik) = ? LIMIT 1', [req.params.kode.toUpperCase()]);
    if(!rows.length || rows[0].status !== 'Aktif') return res.status(404).send('not found');
    const r = rows[0];
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#122544"/><stop offset="1" stop-color="#081120"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="60" y="70" width="1080" height="490" rx="36" fill="none" stroke="#eac06a" stroke-opacity=".35" stroke-width="2"/>
  <text x="90" y="160" fill="#eac06a" font-family="Arial" font-size="30" letter-spacing="6">KARTU ANGGOTA</text>
  <text x="90" y="290" fill="#ffffff" font-family="Arial" font-weight="bold" font-size="80">${esc(r.nama)}</text>
  <text x="90" y="360" fill="rgba(238,242,248,.75)" font-family="Arial" font-size="36">${esc(r.jabatan || 'Anggota')} · ${esc(r.kecamatan)} · Kab. Tulungagung</text>
  <text x="90" y="470" fill="#7bd8a6" font-family="Arial" font-weight="bold" font-size="32">&#10004; TERVERIFIKASI RESMI</text>
  <text x="90" y="522" fill="rgba(238,242,248,.5)" font-family="Arial" font-size="24">${esc(r.kode_unik)} · SIKEDA — DPD Nusantara Bersatu</text>
</svg>`;
    res.type('image/svg+xml').send(svg);
  } catch(e){
    res.status(500).send('error');
  }
}

router.get('/qrcode/:signed', qrcodeHandler);
router.get('/og/:kode', ogHandler);
router.get('/share-card/:kode', shareCardHandler);

module.exports = router;
module.exports.ogHandler = ogHandler;
module.exports.shareCardHandler = shareCardHandler;
module.exports.qrcodeHandler = qrcodeHandler;
