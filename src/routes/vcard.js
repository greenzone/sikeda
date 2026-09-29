/* ============================================================
   SIKEDA — Routes kartu anggota (menghasilkan PDF cetak resmi)
   ============================================================ */
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
/* Vercel: puppeteer penuh tidak terpasang (hanya puppeteer-core +
   @sparticuz/chromium untuk api/cetak.js). Loader lazy + toleran —
   require() keras di level modul membuat seluruh app gagal boot
   (Cannot find module 'puppeteer') di serverless. */
let _puppeteer;
function getPuppeteer(){
  if(_puppeteer !== undefined) return _puppeteer;
  try { _puppeteer = require('puppeteer'); }
  catch(_){ try { _puppeteer = require('puppeteer-core'); } catch(_e){ _puppeteer = null; } }
  return _puppeteer;
}
const puppeteer = { launch: async (opts) => {
  const P = getPuppeteer();
  if(!P){ const err = new Error('Chromium tidak tersedia (puppeteer/puppeteer-core tidak terpasang).'); err.status = 503; throw err; }
  return P.launch(opts);
}};
const { q } = require('../db');
const { baseUrl } = require('../baseurl');

const router = express.Router();
const { authRequired, requireRole } = require('../middleware');

/* Dimensi fisik kartu (ISO/IEC 7810 ID-1) dalam mm */
const ID1_W = 85.6;
const ID1_H = 53.98;
/* Resolusi render gambar kartu: ID-1 @ ~475dpi (cukup untuk percetakan) */
const CARD_PX_W = 1600;
const CARD_PX_H = Math.round(CARD_PX_W * ID1_H / ID1_W); /* ≈ 1009 */

/* ------------------------------------------------------------------
   GET /api/vcard/design — template desain kartu aktif (PUBLIK, data non-sensitif).
   Dipakai halaman vcard.html agar tampilan kartu mengikuti desain
   yang diatur admin di menu Desain Kartu (sama seperti PDF cetak).
   Kredensial & data pribadi tidak disertakan.
   ------------------------------------------------------------------ */
router.get('/design', async (req, res) => {
  try {
    const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    let tpl = null;
    if(rows[0]){ try { tpl = JSON.parse(rows[0].nilai); } catch(_){ tpl = null; } }
    if(tpl){
      /* path gambar disimpan relatif → jadikan absolut root agar valid dari
         halaman mana pun (vcard.html, /kta/{id}, dsb.) */
      ['front','back'].forEach(side => {
        const s = tpl[side];
        if(s && s.bg_image) s.bg_image = '/' + String(s.bg_image).replace(/^\/+/, '');
      });
    }
    res.json({
      ok: true,
      custom: !!tpl,
      css: tpl ? tplOverrideCss(tpl, null) : '',
      front: { title_text: (tpl && tpl.front && tpl.front.title_text) || 'Kartu Tanda Anggota' },
      back:  { header_text: (tpl && tpl.back && tpl.back.header_text) || 'Kartu Tanda Anggota' }
    });
  } catch(e){
    console.error('/api/vcard/design error:', e && e.message);
    res.json({ ok: true, custom: false, css: '' });
  }
});

/* ------------------------------------------------------------------
   GET /api/vcard/pdf?kode=…
   Dipakai tombol Cetak di vcard.html.
   Harus login. Anggota boleh mencetak kartu sendiri (kode diquery
   atau dikirim dari req.user.anggota_id). Superadmin pun boleh.
   ------------------------------------------------------------------ */
router.get('/pdf', authRequired, async (req, res) => {
  try {
    const kodeParam = (req.query.kode || '').toUpperCase();

    /* Jika ada kode diquery, cek bahwa user punya akses:
       - superadmin: boleh melihat kartu siapa saja
       - anggota: hanya boleh mencetak kartu sendiri */
    let kode = kodeParam;
    if (kodeParam) {
      if (req.user.level !== 'superadmin' && req.user.level !== 'admin') {
        const my = await q('SELECT kode_unik FROM anggota WHERE id = ? LIMIT 1', [req.user.anggota_id]);
        if (!my.length || my[0].kode_unik.toUpperCase() !== kodeParam) {
          return res.status(403).json({ error: 'Anggota hanya boleh mencetak kartu sendiri.' });
        }
      }
    } else {
      const my = await q('SELECT kode_unik FROM anggota WHERE id = ? LIMIT 1', [req.user.anggota_id]);
      if (!my.length) return res.status(404).json({ error: 'Anggota belum memiliki kartu.' });
      kode = my[0].kode_unik.toUpperCase();
    }
    if (!kode) return res.status(400).json({ error: 'ID anggota wajib diberikan.' });

    const buf = await buildPdfBuffer(kode, req);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="kartu-anggota-' + kode.toLowerCase() + '.pdf"',
      'Content-Length': buf.length
    });
    res.send(buf);
  } catch (err) {
    console.error('/api/vcard/pdf error:', err && (err.stack || err.message));
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message || 'Gagal membuat PDF.' });
  }
});

/* ------------------------------------------------------------------
   GET /api/vcard/file/:kode/:exp/:sig — URL publik bertanda tangan.
   Dipakai Fonnte (WhatsApp) untuk mengunduh PDF yang dilampirkan,
   karena pengambilan sisi server tidak membawa token login.
   Berlaku 1 jam sejak ditandatangani.
   ------------------------------------------------------------------ */
router.get('/file/:kode/:exp/:sig', async (req, res) => {
  try {
    const kode = String(req.params.kode || '').toUpperCase();
    const exp = Number(req.params.exp);
    const now = Date.now();
    /* exp harus valid, belum lewat, dan dalam rentang wajar (max 24 jam)
       — mencegah tautan "abadi" dibuat sendiri lewat exp masa depan jauh. */
    if (!kode || !Number.isFinite(exp) || exp < now || exp > now + 24 * 60 * 60 * 1000) {
      return res.status(403).json({ error: 'Tautan kedaluwarsa. Minta kirim ulang.' });
    }
    if (!safeEqual(req.params.sig, signKode(kode, exp))) {
      return res.status(403).json({ error: 'Tautan tidak valid.' });
    }
    const buf = await buildPdfBuffer(kode, req);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="kartu-anggota-' + kode.toLowerCase() + '.pdf"',
      'Content-Length': buf.length
    });
    res.send(buf);
  } catch (err) {
    console.error('/api/vcard/file error:', err && (err.stack || err.message));
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message || 'Gagal membuat PDF.' });
  }
});

/* ------------------------------------------------------------------
   POST /api/vcard/:kode/send { channel: 'wa'|'telegram'|'email',
   whatsapp?, telegram?, email? }
   Buat PDF kartu lalu kirim ke channel pilihan (admin & superadmin).
   ------------------------------------------------------------------ */
router.post('/:kode/send', authRequired, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const kode = String(req.params.kode || '').toUpperCase();
    const b = req.body || {};
    const channel = String(b.channel || '').toLowerCase();
    if (!['wa', 'telegram', 'email'].includes(channel)) {
      return res.status(400).json({ error: 'Channel tidak dikenal.' });
    }
    /* format: 'pdf' (default) atau 'png' — gambar kartu tampil langsung di chat */
    const format = String(b.format || 'pdf').toLowerCase() === 'png' ? 'png' : 'pdf';

    const rows = await q('SELECT * FROM anggota WHERE kode_unik = ? LIMIT 1', [kode]);
    if (!rows.length || rows[0].status !== 'Aktif') {
      return res.status(404).json({ error: 'Kartu tidak ditemukan atau belum aktif.' });
    }
    const a = rows[0];

    /* Tentukan tujuan & pra-cek konfigurasi channel SEBELUM build PDF
       (puppeteer butuh ±10 detik — jangan sia-siakan bila channel belum siap) */
    const notify = require('../notify');
    let to = '';
    let settingsKeys = null;
    let needKey = '';

    if (channel === 'wa') {
      to = String(b.whatsapp || a.whatsapp || '').replace(/\D/g, '');
      if (!to) return res.status(400).json({ error: 'Anggota ini belum punya nomor WhatsApp. Lengkapi dulu di data anggota.' });
      settingsKeys = ['fonnte_api_key']; needKey = 'fonnte_api_key';
    } else if (channel === 'telegram') {
      to = String(b.telegram || a.telegram || '').trim().replace(/^@/, '');
      if (!to) return res.status(400).json({ error: 'Anggota ini belum punya Chat ID Telegram. Isi dulu di data anggota.' });
      settingsKeys = ['telegram_bot_token']; needKey = 'telegram_bot_token';
    } else {
      to = String(b.email || a.email || '').trim();
      if (!to) return res.status(400).json({ error: 'Anggota ini belum punya alamat email. Isi dulu di data anggota.' });
      settingsKeys = ['smtp_host', 'smtp_user']; needKey = 'smtp_host';
    }
    const cfg = await notify.getSettings(settingsKeys);
    if (!cfg[needKey]) {
      const label = channel === 'wa' ? 'Fonnte (WhatsApp)' : (channel === 'telegram' ? 'Bot Telegram' : 'SMTP email');
      return res.status(400).json({ error: 'Channel ' + label + ' belum dikonfigurasi di menu Pengaturan.' });
    }

    const caption = 'Kartu Tanda Anggota — SIKEDA\n'
      + a.nama + ' (' + kode + ')\n'
      + (format === 'png'
        ? 'Gambar kartu anggota (sisi depan & belakang) terlampir.'
        : 'Dokumen PDF kartu anggota terlampir.');

    let r;
    let targetLabel = '';

    if (format === 'png') {
      const pair = await buildPngBuffer(kode, req);
      if (channel === 'wa') {
        targetLabel = 'WhatsApp ' + to;
        /* Fonnte mengunduh file lewat URL publik bertanda tangan (1 jam).
           PNG dikirim sebagai 2 tautan (depan & belakang) → tampil langsung sebagai gambar. */
        const exp = Date.now() + 60 * 60 * 1000;
        const host = baseUrl(req);
        const mkUrl = side => host + '/api/vcard/img/' + kode + '/' + side + '/' + exp + '/' + signKode(kode + ':' + side, exp);
        const msg = caption + '\n\nSisi depan:\n' + mkUrl('depan') + '\n\nSisi belakang:\n' + mkUrl('belakang');
        r = await notify.sendFonnte(to, msg);
      } else if (channel === 'telegram') {
        targetLabel = 'Telegram ' + to;
        r = await notify.sendTelegramPhotos(to, [pair.front, pair.back], { caption });
      } else {
        targetLabel = 'email ' + to;
        r = await notify.sendEmailAttachments(to, 'Kartu Anggota — ' + a.nama, caption, [
          { filename: 'kartu-depan-' + kode.toLowerCase() + '.png', content: pair.front },
          { filename: 'kartu-belakang-' + kode.toLowerCase() + '.png', content: pair.back }
        ]);
      }
    } else {
      const buf = await buildPdfBuffer(kode, req);
      const filename = 'kartu-anggota-' + kode.toLowerCase() + '.pdf';
      if (channel === 'wa') {
        targetLabel = 'WhatsApp ' + to;
        /* Fonnte mengunduh file lewat URL publik bertanda tangan (1 jam) */
        const exp = Date.now() + 60 * 60 * 1000;
        const host = baseUrl(req);
        const fileUrl = host + '/api/vcard/file/' + kode + '/' + exp + '/' + signKode(kode, exp);
        r = await notify.sendFonnteFile(to, caption, { url: fileUrl });
      } else if (channel === 'telegram') {
        targetLabel = 'Telegram ' + to;
        r = await notify.sendTelegramDocument(to, buf, { filename, caption });
      } else {
        targetLabel = 'email ' + to;
        r = await notify.sendEmailAttachment(to, 'Kartu Anggota — ' + a.nama, caption, buf, { filename });
      }
    }

    if (!r.ok) {
      await logSend(req.user, kode, 'GAGAL via ' + targetLabel + ' — ' + (r.err || '?')).catch(() => {});
      return res.status(400).json({ error: r.err || 'Gagal mengirim kartu.' });
    }
    await logSend(req.user, kode, 'terkirim via ' + targetLabel + ' (' + format.toUpperCase() + ')').catch(() => {});
    res.json({ ok: true, message: (format === 'png' ? 'Gambar kartu' : 'PDF kartu') + ' terkirim ke ' + targetLabel + '.' });
  } catch (err) {
    console.error('/api/vcard/send error:', err && (err.stack || err.message));
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message || 'Gagal mengirim kartu.' });
  }
});

/* ------------------------------------------------------------------
   GET /api/vcard/png?kode=… — PNG kartu (sisi depan) untuk pratinjau.
   Aturan akses sama dengan /pdf: login, anggota hanya kartu sendiri.
   ------------------------------------------------------------------ */
router.get('/png', authRequired, async (req, res) => {
  try {
    const kodeParam = (req.query.kode || '').toUpperCase();
    const side = (req.query.side || 'depan').toLowerCase() === 'belakang' ? 'belakang' : 'depan';
    let kode = kodeParam;
    if (kodeParam) {
      if (req.user.level !== 'superadmin' && req.user.level !== 'admin') {
        const my = await q('SELECT kode_unik FROM anggota WHERE id = ? LIMIT 1', [req.user.anggota_id]);
        if (!my.length || my[0].kode_unik.toUpperCase() !== kodeParam) {
          return res.status(403).json({ error: 'Anggota hanya boleh melihat kartu sendiri.' });
        }
      }
    } else {
      const my = await q('SELECT kode_unik FROM anggota WHERE id = ? LIMIT 1', [req.user.anggota_id]);
      if (!my.length) return res.status(404).json({ error: 'Anggota belum memiliki kartu.' });
      kode = my[0].kode_unik.toUpperCase();
    }
    if (!kode) return res.status(400).json({ error: 'ID anggota wajib diberikan.' });

    const pair = await buildPngBuffer(kode, req);
    const img = side === 'belakang' ? pair.back : pair.front;
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="kartu-' + side + '-' + kode.toLowerCase() + '.png"',
      'Content-Length': img.length,
      'Cache-Control': 'private, max-age=60'
    });
    res.send(img);
  } catch (err) {
    console.error('/api/vcard/png error:', err && (err.stack || err.message));
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message || 'Gagal membuat PNG kartu.' });
  }
});

/* ------------------------------------------------------------------
   GET /api/vcard/img/:kode/:side/:exp/:sig — PNG publik bertanda tangan
   (1 jam), dipakai Fonnte untuk melampirkan gambar kartu via URL.
   ------------------------------------------------------------------ */
router.get('/img/:kode/:side/:exp/:sig', async (req, res) => {
  try {
    const kode = String(req.params.kode || '').toUpperCase();
    const side = String(req.params.side || '').toLowerCase() === 'belakang' ? 'belakang' : 'depan';
    const exp = Number(req.params.exp);
    const now = Date.now();
    if (!kode || !Number.isFinite(exp) || exp < now || exp > now + 24 * 60 * 60 * 1000) {
      return res.status(403).json({ error: 'Tautan kedaluwarsa. Minta kirim ulang.' });
    }
    if (!safeEqual(req.params.sig, signKode(kode + ':' + side, exp))) {
      return res.status(403).json({ error: 'Tautan tidak valid.' });
    }
    const pair = await buildPngBuffer(kode, req);
    const img = side === 'belakang' ? pair.back : pair.front;
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="kartu-' + side + '-' + kode.toLowerCase() + '.png"',
      'Content-Length': img.length
    });
    res.send(img);
  } catch (err) {
    console.error('/api/vcard/img error:', err && (err.stack || err.message));
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message || 'Gagal membuat PNG kartu.' });
  }
});

async function logSend(user, kode, detail) {
  await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
    [user ? user.id : null, user ? (user.username || user.nama) : 'sistem', 'Kirim kartu PDF (' + kode + ')', detail || '-']);
}

function signKode(kode, exp) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
    .update(kode + ':' + exp).digest('hex');
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/* ------------------------------------------------------------------
   buildPdfBuffer(kode, req) — generator PDF kartu + cache 2 menit.
   Dipakai GET /pdf, URL publik /file/…, dan POST /:kode/send.
   ------------------------------------------------------------------ */
async function buildPdfBuffer(kode, req) {
  const label = 'pdf/' + kode;
  const hit = () => req.app.get(label);
  const set = v => req.app.set(label, v);

  let buf = hit && hit();
  if (buf && buf.kode === kode && buf.born > Date.now() - 2 * 60 * 1000) {
    return buf.buf;
  }

  const rows = await q(
    `SELECT id, kode_unik, nama, jabatan, kecamatan, desa, status,
            registered_at, whatsapp, email, telegram, pekerjaan,
            tempat_lahir, tanggal_lahir, gender, alamat, nik_enc, foto_path
     FROM anggota WHERE kode_unik = ? LIMIT 1`,
    [kode]
  );
  if (!rows.length || rows[0].status !== 'Aktif') {
    const err = new Error('Kartu tidak ditemukan atau tidak aktif.');
    err.status = 404;
    throw err;
  }
  const a = rows[0];

  /* NIK terenkripsi → dekrip (GCM, sesuai crypto.js) */
  let nikPlain = null;
  try {
    const { decryptNIK } = require('../crypto');
    nikPlain = decryptNIK(a.nik_enc);
  } catch (_) { nikPlain = null; }

  /* === branding (nama organisasi + wilayah + logo) === */
  let org_nama = 'DPD Nusantara Bersatu';
  let org_wilayah = 'Kabupaten Tulungagung';
  let logo = '';
  try {
    const setRows = await q(
      "SELECT kunci, nilai FROM settings WHERE kunci IN ('org_nama','org_wilayah','logo_dashboard','logo_landing')"
    );
    for (const r of setRows) {
      if (r.nilai) {
        if (r.kunci === 'org_nama') org_nama = r.nilai;
        if (r.kunci === 'org_wilayah') org_wilayah = r.nilai;
        if (!logo && (r.kunci === 'logo_dashboard' || r.kunci === 'logo_landing')) logo = r.nilai;
      }
    }
  } catch (_) { /* branding opsional */ }

  const pdfHost = baseUrl(req);
  /* Foto & logo harus URL absolut agar Puppeteer (setContent) bisa memuatnya */
  const abs = p => (p ? pdfHost + '/' + String(p).replace(/^\/+/, '') : '');

  /* Template desain kustom (jika superadmin menyimpannya) — CSS override
     posisi/warna/ukuran elemen kartu depan & belakang. */
  let tpl = null;
  try {
    const tplRows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    if (tplRows[0] && tplRows[0].nilai) tpl = JSON.parse(tplRows[0].nilai);
  } catch (_) { tpl = null; }
  const tplCss = tpl ? tplOverrideCss(tpl, pdfHost) : '';
  /* ------------------------------------------------------------
     1) Render kartu fisik (depan + belakang) memakai CSS bersama
        public/assets/css/kta-card.css → screenshot 1600×1009 px.
     ------------------------------------------------------------ */
  const memberUrl = pdfHost + '/kta/' + kode.toLowerCase();
  const cardHtml = buildCardHtml({
    host: pdfHost,
    orgNama: org_nama,
    orgWilayah: org_wilayah,
    kode,
    nama: a.nama,
    npapg: nikPlain || (a.nik_hash ? '••••••••••••••••' : ''),
    jabatan: a.jabatan || 'Anggota',
    desa: a.desa || '',
    kecamatan: a.kecamatan || '',
    fotoUrl: abs(a.foto_path),
    memberUrl,
    expLabel: expLabelFrom(a.registered_at),
    status: a.status,
    tplCss,
    titleFront: (tpl && tpl.front && tpl.front.title_text) || '',
    titleBack: (tpl && tpl.back && tpl.back.header_text) || '',
  });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });

  let frontImg, backImg;
  try {
    const page = await browser.newPage();
    await page.setContent(cardHtml, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
    const elF = await page.$('#cardFront');
    frontImg = await elF.screenshot({ omitBackground: false, encoding: 'base64' });
    const elB = await page.$('#cardBack');
    backImg = await elB.screenshot({ omitBackground: false, encoding: 'base64' });
    await page.close();
  } finally {
    await browser.close().catch(() => {});
  }

  /* ------------------------------------------------------------
     2) Sisipkan kedua gambar ke template dokumen (halaman 1 +
        master cetak ID-1 halaman 2), lalu cetak ke PDF.
     ------------------------------------------------------------ */
  const docHtml = await renderPdfDoc({
    host: pdfHost,
    org_nama, org_wilayah, logoUrl: abs(logo),
    kode,
    nama: a.nama,
    npapg: nikPlain || (a.nik_hash ? '***' : '—'),
    jabatan: a.jabatan || '—',
    kecamatan: a.kecamatan || '', desa: a.desa || '',
    status: a.status,
    registered_at: a.registered_at,
    nik: nikPlain || (a.nik_hash ? '***' : '—'),
    whatsapp: a.whatsapp || '',
    email: a.email || '',
    telegram: a.telegram || '',
    pekerjaan: a.pekerjaan || '',
    tempat_lahir: a.tempat_lahir || '',
    tgl_lahir: a.tanggal_lahir ? String(a.tanggal_lahir).slice(0, 10) : '',
    jenis_kelamin: a.gender || '',
    alamat: a.alamat || '',
    frontImg, backImg,
  });

  const browser2 = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });
  try {
    const page2 = await browser2.newPage();
    await page2.setContent(docHtml, { waitUntil: 'load', timeout: 60000 });
    await page2.evaluate(() => document.fonts.ready);
    /* tunggu semua <img> (kartu depan/belakang, logo) selesai decode */
    await page2.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(im => im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; })));
    });
    const pdf = await page2.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true
    });
    buf = Buffer.from(pdf);
    set({ kode, buf, born: Date.now() });
  } finally {
    await browser2.close().catch(() => {});
  }

  return buf;
}

/* ------------------------------------------------------------------
   buildPngBuffer(kode, req) → { front, back } Buffer PNG kedua sisi kartu.
   Render HTML kartu yang sama persis dengan PDF, lalu screenshot
   elemen #cardFront / #cardBack per sisi (1600×1009 px).
   ------------------------------------------------------------------ */
async function buildPngBuffer(kode, req) {
  const label = 'png/' + kode;
  const hit = () => req.app.get(label);
  const set = v => req.app.set(label, v);

  let pair = hit && hit();
  if (pair && pair.kode === kode && pair.born > Date.now() - 2 * 60 * 1000) {
    return pair;
  }

  const rows = await q(
    `SELECT id, kode_unik, nama, jabatan, kecamatan, desa, status,
            registered_at, whatsapp, email, telegram, pekerjaan,
            tempat_lahir, tanggal_lahir, gender, alamat, nik_enc, foto_path
     FROM anggota WHERE kode_unik = ? LIMIT 1`,
    [kode]
  );
  if (!rows.length || rows[0].status !== 'Aktif') {
    const err = new Error('Kartu tidak ditemukan atau tidak aktif.');
    err.status = 404;
    throw err;
  }
  const a = rows[0];

  let nikPlain = null;
  try {
    const { decryptNIK } = require('../crypto');
    nikPlain = decryptNIK(a.nik_enc);
  } catch (_) { nikPlain = null; }

  let org_nama = 'DPD Nusantara Bersatu';
  let org_wilayah = 'Kabupaten Tulungagung';
  try {
    const setRows = await q(
      "SELECT kunci, nilai FROM settings WHERE kunci IN ('org_nama','org_wilayah')"
    );
    for (const r of setRows) {
      if (r.kunci === 'org_nama') org_nama = r.nilai;
      if (r.kunci === 'org_wilayah') org_wilayah = r.nilai;
    }
  } catch (_) { /* branding opsional */ }

  const pngHost = baseUrl(req);
  const abs = p => (p ? pngHost + '/' + String(p).replace(/^\/+/, '') : '');

  /* Template desain kustom (sama dengan jalur PDF) */
  let tpl = null;
  try {
    const tplRows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    if (tplRows[0] && tplRows[0].nilai) tpl = JSON.parse(tplRows[0].nilai);
  } catch (_) { tpl = null; }
  const tplCss = tpl ? tplOverrideCss(tpl, pngHost) : '';
  const memberUrl = pngHost + '/kta/' + kode.toLowerCase();
  const cardHtml = buildCardHtml({
    host: pngHost,
    orgNama: org_nama,
    orgWilayah: org_wilayah,
    kode,
    nama: a.nama,
    npapg: nikPlain || (a.nik_hash ? '••••••••••••••••' : ''),
    jabatan: a.jabatan || 'Anggota',
    desa: a.desa || '',
    kecamatan: a.kecamatan || '',
    fotoUrl: abs(a.foto_path),
    memberUrl,
    expLabel: expLabelFrom(a.registered_at),
    status: a.status,
    tplCss,
    titleFront: (tpl && tpl.front && tpl.front.title_text) || '',
    titleBack: (tpl && tpl.back && tpl.back.header_text) || '',
  });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
    await page.setContent(cardHtml, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
    const elF = await page.$('#cardFront');
    const front = Buffer.from(await elF.screenshot({ omitBackground: false, encoding: 'base64' }), 'base64');
    const elB = await page.$('#cardBack');
    const back = Buffer.from(await elB.screenshot({ omitBackground: false, encoding: 'base64' }), 'base64');
    await page.close();
    pair = { kode, front, back, born: Date.now() };
    set(pair);
    return pair;
  } finally {
    await browser.close().catch(() => {});
  }
}

/* ------------------------------------------------------------------
   Kartu masa berlaku: registered_at + 3 tahun → "Feb 2029"
   ------------------------------------------------------------------ */
function expLabelFrom(registeredAt) {
  const d = new Date(String(registeredAt).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return '—';
  d.setFullYear(d.getFullYear() + 3);
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

/* ------------------------------------------------------------------
   Halaman render kartu: kedua sisi ditumpuk; CSS bersama kta-card.css
   dipakai apa adanya → pratinjau browser & PDF 100% identik.
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   tplOverrideCss(tpl) — ubah JSON template desain kartu menjadi CSS
   override untuk kta-card.css. Posisi dalam % lebar kartu (cqw).
   ------------------------------------------------------------------ */
function tplOverrideCss(tpl, host) {
  if (!tpl || typeof tpl !== 'object') return '';
  const num = v => (Number.isFinite(+v) ? +v : null);
  const R = v => Math.round(v * 100) / 100; /* hindari artefak float di CSS */
  const lines = [];
  const bg = (side, sel, defColor) => {
    const s = tpl[side] || {};
    /* Gambar harus URL absolut — HTML kartu dirender via setContent */
    const img = s.bg_image ? (host ? host + '/' + String(s.bg_image).replace(/^\/+/, '') : String(s.bg_image)) : '';
    const color = s.bg_color || defColor;
    lines.push(sel + '{background-color:' + color + ';}');
    if (img) {
      const fit = s.bg_fit === 'contain' ? 'contain' : (s.bg_fit === 'stretch' ? '100% 100%' : 'cover');
      lines.push(sel + "{background-image:url('" + img + "');background-size:" + fit + ";background-position:center;background-repeat:no-repeat;}");
    } else if (color.toLowerCase() !== defColor.toLowerCase()) {
      /* Warna kustom tanpa gambar → template PNG bawaan dinonaktifkan agar
         warna terlihat (admin bisa menyalakan teks organisasi untuk latar polos) */
      lines.push(sel + '{background-image:none;}');
    }
  };

  /* ---------- SISI DEPAN ---------- */
  const f = tpl.front || {};
  bg('front', '.kta-front', '#e9d826');
  if (f.qr) {
    if (f.qr.visible === false) lines.push('.kf-qr{display:none;}');
    else {
      const x = num(f.qr.x), y = num(f.qr.y), w = num(f.qr.w);
      if (x != null) lines.push('.kf-qr{left:' + x + 'cqw;right:auto;top:' + (y != null ? y : 6.6) + 'cqw;}');
      if (w != null) lines.push('.kf-qr{width:' + w + 'cqw;height:' + (w * 0.94) + 'cqw;}');
    }
  }
  if (f.photo) {
    if (f.photo.visible === false) lines.push('.kf-photo{display:none;}');
    else {
      const x = num(f.photo.x), y = num(f.photo.y), w = num(f.photo.w);
      if (x != null) lines.push('.kf-photo{left:' + x + 'cqw;right:auto;top:' + (y != null ? y : 20.4) + 'cqw;}');
      if (w != null) lines.push('.kf-photo{width:' + w + 'cqw;height:' + w + 'cqw;}');
    }
  }
  if (f.data) {
    if (f.data.visible === false) lines.push('.kf-data{display:none;}');
    else {
      const x = num(f.data.x), y = num(f.data.y);
      const align = f.data.align === 'left' ? 'left' : (f.data.align === 'center' ? 'center' : 'right');
      if (align === 'left') lines.push('.kf-data{left:' + (x != null ? x : 3.6) + 'cqw;right:auto;text-align:left;}');
      else if (align === 'center') lines.push('.kf-data{left:' + (x != null ? x : 8) + 'cqw;right:auto;text-align:center;max-width:' + Math.max(20, 96.4 - (x != null ? x : 8)) + 'cqw;}');
      else lines.push('.kf-data{right:' + R(100 - (x != null ? x : 96.4)) + 'cqw;left:auto;text-align:right;}');
      if (y != null) lines.push('.kf-data{top:' + y + 'cqw;}');
    }
  }
  if (f.nama_size != null && num(f.nama_size)) lines.push('.kf-nama{font-size:' + num(f.nama_size) + 'cqw;}');
  if (f.wil_size != null && num(f.wil_size)) lines.push('.kf-wil,.kf-wil2{font-size:' + num(f.wil_size) + 'cqw;}');
  if (f.npapg_visible === false) lines.push('.kf-npapg{display:none;}');
  if (f.title) {
    if (f.title.visible === false) lines.push('.kf-code{display:none;}');
    else {
      const x = num(f.title.x), y = num(f.title.y);
      if (y != null) lines.push('.kf-code{bottom:auto;top:' + y + 'cqw;}');
      if (x != null) lines.push('.kf-code{right:' + R(100 - x) + 'cqw;}');
    }
  }
  if (f.org_visible === true) lines.push('.kta-front .kf-org,.kta-front .kf-sub{display:block;}');

  /* ---------- SISI BELAKANG ---------- */
  const b = tpl.back || {};
  bg('back', '.kta-back', '#f5efdc');
  if (b.qr) {
    if (b.qr.visible === false) lines.push('.kb-qrwrap{display:none;}');
    else {
      const x = num(b.qr.x), y = num(b.qr.y), w = num(b.qr.w);
      if (x != null) lines.push('.kb-body{grid-template-columns:' + x + 'cqw 1fr auto;}');
      if (w != null) lines.push('.kb-qr{width:' + w + 'cqw;height:' + w + 'cqw;}');
    }
  }
  if (b.url_visible === false) lines.push('.kb-url{display:none;}');
  if (b.seal_visible === false) lines.push('.kb-sealcol{display:none;}');
  if (b.chips_visible === false) lines.push('.kb-chips{display:none;}');
  if (b.nama_size != null && num(b.nama_size)) lines.push('.kb-nama{font-size:' + num(b.nama_size) + 'cqw;}');

  return lines.length ? '<style id="ktaTplOverride">' + lines.join('') + '</style>' : '';
}
function buildCardHtml(o) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const qrImg = o.memberUrl
    ? '<img src="' + o.host + '/qrcode/' + encodeURIComponent(o.memberUrl) + '" alt="QR verifikasi">'
    : '';
  const fotoHtml = o.fotoUrl
    ? '<span class="kf-ini">' + initialsOf(o.nama) + '</span>' +
      '<img src="' + o.fotoUrl + '?v=' + Date.now() + '" alt="Foto ' + esc(o.nama) +
      '" onerror="this.remove()">'
    : '<span class="kf-ini">' + initialsOf(o.nama) + '</span>';

  const npapgMasked = o.npapg || '';
  /* Baris wilayah sesuai kartu fisik referensi:
     baris 1 = Desa - Kecamatan, baris 2 = wilayah organisasi */
  const lineDesa = (o.desa && o.kecamatan)
    ? (o.desa + ' - ' + o.kecamatan)
    : (o.desa || o.kecamatan || '');
  const lineWil = o.orgWilayah || o.kecamatan || '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${o.host}/assets/css/kta-card.css">
${o.tplCss || ''}
<style>
  body { margin: 0; background: #fff; }
  .stage { width: ${CARD_PX_W}px; }
  .stage .kta-card { height: ${CARD_PX_H}px; }
  .stage .kta-card + .kta-card { margin-top: 24px; }
</style>
</head>
<body>
<div class="stage">

  <!-- ================= SISI DEPAN ================= -->
  <div class="kta-card" id="cardFront">
  <div class="kta-face kta-front">
    <div class="kf-qr">${qrImg}</div>
    <div class="kf-org">${esc(o.orgNama)}</div>
    <div class="kf-sub">${esc(o.orgWilayah)}</div>
    <div class="kf-photo">${fotoHtml}</div>
    <div class="kf-data">
      <div class="kf-nama">${esc(o.nama)}</div>
      <div class="kf-npapg"><span class="lbl">NPAPG</span>${esc(npapgMasked || '••••••••••••••••')}</div>
      <div class="kf-wil">${esc(lineDesa)}</div>
      <div class="kf-wil2">${esc(lineWil)}</div>
    </div>
    <div class="kf-code"><div class="rule"></div><div class="val">${esc(o.titleFront || 'Kartu Tanda Anggota')}</div></div>
  </div>
  </div>

  <!-- ================= SISI BELAKANG ================= -->
  <div class="kta-card" id="cardBack">
  <div class="kta-face kta-back">
    <div class="kb-top"><span class="t">${esc(o.titleBack || 'Kartu Tanda Anggota')}</span><span class="o">${esc(o.orgNama)}</span></div>
    <div class="kb-toprule"></div>
    <div class="kb-mag"></div>
    <div class="kb-body">
      <div class="kb-qrwrap"><div class="kb-qr">${qrImg}</div><div class="kb-qrhint">Pindai untuk verifikasi</div></div>
      <div class="kb-info">
        <div class="kb-nama">${esc(o.nama)}</div>
        <div class="kb-role">${esc(o.jabatan)} · ${esc(o.desa)}, ${esc(o.kecamatan)}</div>
        <div class="kb-chips">
          <div class="kb-chip"><span class="k">NPAPG</span><span class="v">${esc(npapgMasked || '—')}</span></div>
          <div class="kb-chip"><span class="k">No. Kartu</span><span class="v">${esc(o.kode)}</span></div>
        </div>
        <div class="kb-url">${esc(o.memberUrl.replace(/^https?:\/\//, ''))}</div>
      </div>
      <div class="kb-sealcol">
        <div class="kb-seal"><span class="s1">✓</span><span class="s2">Resmi</span></div>
        <div class="kb-valid"><span class="k">SD</span> ${esc(o.expLabel)}</div>
      </div>
    </div>
    <div class="kb-note">Kartu ini milik ${esc(o.nama)} dan tidak dapat dipindahtangankan. Laporkan kehilangan kepada pengurus DPC setempat.</div>
    <div class="kb-strip">Diterbitkan ${esc(o.orgNama)} — SIKEDA</div>
  </div>
  </div>

</div>
</body>
</html>`;
}

function initialsOf(nama) {
  return String(nama || '').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
}

/* ------------------------------------------------------------------
   Template dokumen (halaman 1 + master cetak halaman 2).
   Semua placeholder __X__ diinjeksikan di sini — template tanpa JS.
   ------------------------------------------------------------------ */
async function renderPdfDoc(o) {
  const tmplPath = path.join(__dirname, '..', '..', 'public', 'vcard-pdf.html');
  let tmpl = fs.readFileSync(tmplPath, 'utf8');

  const esc = s =>
    (s == null ? '' : String(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ');

  const fd = s => {
    if (!s) return '—';
    const d = new Date(String(s).length <= 10 ? String(s) + 'T00:00:00' : s);
    return isNaN(d) ? '—' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const now = new Date();
  const tglCetak = fd(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'));
  const regDate = fd(String(o.registered_at).slice(0, 10));
  const expDate = new Date();
  expDate.setFullYear(expDate.getFullYear() + 3);
  const validUntil = fd(expDate.getFullYear() + '-' + String(expDate.getMonth() + 1).padStart(2, '0') + '-' + String(expDate.getDate()).padStart(2, '0'));
  const docno = 'SIK-' + String(o.kode || '?').replace(/[^A-Za-z0-9]/g, '') + '-' + String(Math.floor(1000 + Math.random() * 9000));

  const logoHtml = o.logoUrl
    ? '<img src="' + o.logoUrl + '" alt="Logo">'
    : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5V11c0 5.2 3.6 9.9 9 11 5.4-1.1 9-5.8 9-11V6.5L12 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const badge = o.status === 'Aktif'
    ? '<span class="badge ok"><span class="dot"></span> Aktif</span>'
    : '<span class="badge wa"><span class="dot"></span> ' + esc(o.status || 'Pending') + '</span>';

  const ttl = (o.tempat_lahir || '—') + (o.tgl_lahir ? ', ' + fd(o.tgl_lahir) : '');

  const map = {
    '__DOC_TITLE__': esc('Kartu Anggota — ' + o.nama),
    '__LOGO_HTML__': logoHtml,
    '__ORG__': esc(o.org_nama || 'DPD Nusantara Bersatu'),
    '__WILAYAH__': esc(o.org_wilayah || 'Kabupaten Tulungagung'),
    '__DOCNO__': esc(docno),
    '__TGL_CETAK__': esc(tglCetak),
    '__FRONT_IMG__': o.frontImg ? 'data:image/png;base64,' + o.frontImg : '',
    '__BACK_IMG__': o.backImg ? 'data:image/png;base64,' + o.backImg : '',
    '__VERIF_URL__': esc((o.host || '') + '/kta/' + String(o.kode).toLowerCase()),
    '__NAMA__': esc(o.nama),
    '__KODE__': esc(o.kode),
    '__NPAPG__': esc(o.npapg || '—'),
    '__JABATAN__': esc(o.jabatan),
    '__DESA__': esc(o.desa || '—'),
    '__KEC__': esc(o.kecamatan || '—'),
    '__TTL__': esc(ttl),
    '__GENDER__': esc(o.jenis_kelamin || '—'),
    '__KERJA__': esc(o.pekerjaan || '—'),
    '__WA__': esc(o.whatsapp || '—'),
    '__EMAIL__': esc(o.email || '—'),
    '__TG__': esc(o.telegram || '—'),
    '__STATUS_BADGE__': badge,
    '__REG__': esc(regDate),
    '__VALID__': esc('3 tahun · s.d. ' + validUntil),
    '__ALAMAT__': esc(o.alamat || '—'),
  };
  for (const [k, v] of Object.entries(map)) {
    tmpl = tmpl.split(k).join(v);
  }
  return tmpl;
}

module.exports = router;
module.exports._buildCardHtml = buildCardHtml;   /* untuk debug/test */
module.exports._buildPngBuffer = buildPngBuffer; /* untuk debug/test */
module.exports._tplOverrideCss = tplOverrideCss; /* dipakai route /design publik */
