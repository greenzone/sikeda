/* ============================================================
   SIKEDA — Generator PDF kartu untuk Vercel (serverless)
   Versi buildPdfBuffer yang tidak bergantung req.app cache:
   menerima (kode, host, executablePath) murni.
   Render kartu via chromium serverless + puppeteer-core.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

async function buildPdfBufferRaw(kode, host, executablePath){
  const { q } = require('./db');
  const rows = await q(
    `SELECT id, kode_unik, nama, jabatan, kecamatan, desa, status,
            registered_at, whatsapp, email, telegram, pekerjaan,
            tempat_lahir, tanggal_lahir, gender, alamat, nik_enc, foto_path
     FROM anggota WHERE kode_unik = ? LIMIT 1`,
    [kode]
  );
  if(!rows.length || rows[0].status !== 'Aktif'){
    const err = new Error('Kartu tidak ditemukan atau tidak aktif.');
    err.status = 404;
    throw err;
  }
  const a = rows[0];

  let nikPlain = null;
  try {
    const { decryptNIK } = require('./crypto');
    nikPlain = decryptNIK(a.nik_enc);
  } catch(_) { nikPlain = null; }

  let org_nama = 'DPD Nusantara Bersatu';
  let org_wilayah = 'Kabupaten Tulungagung';
  let logo = '';
  try {
    const setRows = await q("SELECT kunci, nilai FROM settings WHERE kunci IN ('org_nama','org_wilayah','logo_dashboard','logo_landing')");
    for(const r of setRows){
      if(r.nilai){
        if(r.kunci === 'org_nama') org_nama = r.nilai;
        if(r.kunci === 'org_wilayah') org_wilayah = r.nilai;
        if(!logo && (r.kunci === 'logo_dashboard' || r.kunci === 'logo_landing')) logo = r.nilai;
      }
    }
  } catch(_) {}

  const vcard = require('./routes/vcard');
  const abs = p => (p ? host + '/' + String(p).replace(/^\/+/, '') : '');
  const memberUrl = host + '/kta/' + kode.toLowerCase();

  /* Helper yang diekspor routes/vcard (dipakai juga deploy lain) */
  const buildCardHtml = vcard._buildCardHtml;
  const renderPdfDoc = vcard._renderPdfDoc;
  const tplOverrideCss = vcard._tplOverrideCss;
  const expLabelFrom = vcard._expLabelFrom;
  if(typeof buildCardHtml !== 'function' || typeof renderPdfDoc !== 'function'){
    throw new Error('Helper vcard tidak tersedia — cek module.exports di routes/vcard.');
  }

  /* Template kustom (bila ada) */
  let tpl = null;
  try {
    const tplRows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    if(tplRows[0] && tplRows[0].nilai) tpl = JSON.parse(tplRows[0].nilai);
  } catch(_) {}
  const tplCss = tpl ? tplOverrideCss(tpl, host) : '';

  const cardHtml = buildCardHtml({
    host,
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
    titleBack: (tpl && tpl.back && tpl.back.header_text) || ''
  });

  /* === Render kartu via Chromium serverless === */
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-software-rasterizer'
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

  const docHtml = await renderPdfDoc({
    host,
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
    frontImg, backImg
  });

  const browser2 = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer']
  });
  try {
    const page = await browser2.newPage();
    await page.setContent(docHtml, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    await page.close();
    return buf;
  } finally {
    await browser2.close().catch(() => {});
  }
}

module.exports = { buildPdfBufferRaw };
