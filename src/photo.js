/* ============================================================
   SIKEDA — Normalisasi foto anggota
   Setiap foto yang diunggah dipotong (crop) & dinormalisasi agar
   mengisi slot foto kartu (rasio 3 : 4, orientasi portrait)
   secara rapi: tidak ada distorsi, tidak ada sisi kosong.

   - Rasio slot kartu: kf-photo 24cqw × 32cqw = 720 × 960 px.
   - Prioritas: sharp (jika terpasang) — cepat & berkualitas tinggi.
   - Fallback tanpa dependensi: Puppeteer (sudah ada di package.json)
     merender foto ke <canvas> di headless Chromium, lalu crop
     center + resize + ekspor JPEG. Cache halaman untuk performa.
   ============================================================ */
'use strict';

/* CATATAN PRODUKSI: puppeteer dimuat lazy. Paket produksi tidak menyertakan
   puppeteer — normalisasi foto memakai sharp bila terpasang; tanpa keduanya
   foto disimpan apa adanya (tanpa crop). Pasang `npm install sharp` untuk
   kualitas terbaik, atau puppeteer bila fitur PDF juga diaktifkan. */
let _puppeteer;
function getPuppeteer(){
  if(_puppeteer !== undefined) return _puppeteer;
  try { _puppeteer = require('puppeteer'); }
  catch(_){ _puppeteer = null; }
  return _puppeteer;
}

const CARD_W = 720;  /* px ekspor — slot 24cqw @ kartu 300dpi ≈ 283px, ini 2.5× (aman) */
const CARD_H = 960;
const CARD_RATIO = CARD_W / CARD_H; /* 0.75 (3:4) */

/* ---------- kunci proses: cegah dua puppeteer + race ---------- */
let sharpMod = undefined; /* undefined = belum dicek, null = tidak tersedia */
function getSharp() {
  if (sharpMod !== undefined) return sharpMod;
  try { sharpMod = require('sharp'); }
  catch (_) { sharpMod = null; }
  return sharpMod;
}

/* ------------------------------------------------------------------
   Jalur sharp: rotasi EXIF, crop "attention" (wajah/titik fokus),
   resize tepat ke 720×960, kompres JPEG q90.
   ------------------------------------------------------------------ */
async function normalizeWithSharp(buf) {
  const sharp = getSharp();
  const out = await sharp(buf, { failOn: 'none' })
    .rotate() /* patuhi orientasi EXIF */
    .resize(CARD_W, CARD_H, {
      fit: 'cover',
      position: sharp.strategy.attention, /* crop memusatkan wajah/subjek */
      background: '#f3e3ae'
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90, mozjpeg: false })
    .toBuffer();
  return out;
}

/* ------------------------------------------------------------------
   Fallback puppeteer: satu halaman canvas di-cache antar permintaan.
   dekode sumber (IMG) → hitung crop 3:4 center → gambar → JPEG q90.
   ------------------------------------------------------------------ */
let canvasPage = null;
let canvasBrowser = null;
let canvasBusy = Promise.resolve();

async function getCanvasPage() {
  if (canvasPage) return canvasPage;
  const _Pup = getPuppeteer();
  if (!_Pup) {
    const err = new Error('Normalisasi foto via canvas tidak tersedia (puppeteer tidak terpasang). Foto tetap disimpan tanpa crop bila sharp juga tidak ada.');
    err.status = 503;
    throw err;
  }
  canvasBrowser = await _Pup.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  canvasPage = await canvasBrowser.newPage();
  await canvasPage.setContent('<canvas id="c"></canvas>');
  return canvasPage;
}

/* tutup browser canvas saat proses keluar */
process.on('exit', () => { try { canvasBrowser && canvasBrowser.close(); } catch (_) {} });
process.on('SIGINT', () => { try { canvasBrowser && canvasBrowser.close(); } catch (_) {} process.exit(0); });

async function normalizeWithCanvas(buf, mime) {
  const dataUrl = 'data:' + (mime || 'image/jpeg') + ';base64,' + buf.toString('base64');
  async function runEval(page) {
    return page.evaluate(async (src, W, H) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error('decode-fail'));
        img.src = src;
      });
      const c = document.getElementById('c');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      /* crop center mengikuti rasio target */
      const sw = Math.min(img.naturalWidth, img.naturalHeight * (W / H));
      const sh = Math.min(img.naturalHeight, img.naturalWidth * (H / W));
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      g.fillStyle = '#f3e3ae';
      g.fillRect(0, 0, W, H);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    }, dataUrl, CARD_W, CARD_H);
  }
  let page;
  try {
    page = await getCanvasPage();
  } catch (_) {
    /* browser/page rusak — buat baru */
    canvasPage = null; canvasBrowser = null;
    page = await getCanvasPage();
  }
  let out;
  try {
    out = await runEval(page);
  } catch (_) {
    /* detached frame — reset cache, buat baru, coba sekali lagi */
    canvasPage = null; canvasBrowser = null;
    page = await getCanvasPage();
    out = await runEval(page);
  }
  /* Puppeteer ≥22 mengembalikan ArrayBuffer untuk string panjang */
  const b64 = typeof out === 'string' ? out : Buffer.from(out).toString('base64');
  return Buffer.from(b64, 'base64');
}

/* ------------------------------------------------------------------
   API utama: normalizePhoto(buffer, contentType) → { buffer, ext }
   Gagal decode → lempar Error (pemanggil memutuskan respons 400).
   ------------------------------------------------------------------ */
async function normalizePhoto(buf, contentType) {
  const sharp = getSharp();
  if (sharp) {
    try { return { buffer: await normalizeWithSharp(buf), ext: 'jpg' }; }
    catch (e) {
      /* format aneh → coba fallback canvas sebelum menyerah */
      console.warn('photo: sharp gagal, fallback canvas:', e.message);
    }
  }
  /* Tanpa sharp: coba jalur canvas (puppeteer) bila tersedia */
  if (getPuppeteer()) {
    /* serialisasi antar permintaan agar halaman canvas tidak dipakai bersamaan */
    const run = async () => ({ buffer: await normalizeWithCanvas(buf, contentType), ext: 'jpg' });
    const prev = canvasBusy;
    canvasBusy = prev.then(run, run);
    return canvasBusy;
  }
  /* Tidak ada sharp maupun puppeteer: simpan foto apa adanya */
  console.warn('photo: sharp & puppeteer tidak tersedia — foto disimpan tanpa normalisasi (pasang `sharp` untuk hasil terbaik).');
  const ext = String(contentType || '').toLowerCase().includes('png') ? 'png' : 'jpg';
  return { buffer: buf, ext };
}

module.exports = { normalizePhoto, CARD_W, CARD_H, CARD_RATIO };
