'use strict';
/* ============================================================
   SIKEDA — Penyimpanan file uploads (multi-driver)

   Prinsip:
   1. LOCAL SELALU JALAN — setiap file tetap ditulis ke folder
      uploads server bawaan (UPLOADS_DIR / public/uploads) sebagai
      fallback; instalasi pertama tanpa konfigurasi apa pun tetap
      berfungsi seperti semula.
   2. Mirror opsional — bila driver selain 'local' dipilih (di
      dashboard Pengaturan → penyimpanan, atau env STORAGE_DRIVER),
      file juga dikirim ke layanan remote gratis:
        - cloudinary : Cloudinary free tier (kredensial via env)
        - supabase   : Supabase Storage free tier (env)
        - gdrive     : Google Drive 15 GB (env, OAuth refresh token)
        - cdn        : hanya base URL CDN kustom (file tetap lokal)
      Kegagalan mirror TIDAK menggagalkan upload (log + hasil uji).
   3. Pelayanan /uploads/* — bila driver remote punya URL publik,
      request diarahkan (302) ke sana; kalau tidak, dilayani lokal.

   Driver dipilih dari env STORAGE_DRIVER (menang) atau settings DB
   ('storage_driver') yang dikelola superadmin di dashboard.
   Kredensial remote HANYA lewat env (tidak pernah ke DB/repo).
   ============================================================ */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uploadsRoot } = require('./uploads-path');

const DRIVERS = ['local', 'cdn', 'cloudinary', 'supabase', 'gdrive'];

/* ---------- Resolusi driver & CDN base (env > settings DB) ---------- */
let _drv = null, _cdn = null, _inited = false;
function ensureInit(){
  if(_inited) return Promise.resolve();
  return (async () => {
    try {
      const { q } = require('./db');
      const rows = await q("SELECT kunci, nilai FROM settings WHERE kunci IN ('storage_driver','storage_cdn_base')");
      rows.forEach(r => {
        if(r.kunci === 'storage_driver') _drv = String(r.nilai || '').trim().toLowerCase();
        if(r.kunci === 'storage_cdn_base') _cdn = String(r.nilai || '').trim();
      });
    } catch(_){ /* DB belum siap — pakai default lokal */ }
    _inited = true;
  })();
}
function setDriver(d){ _drv = String(d || 'local').toLowerCase(); _inited = true; }
function setCdnBase(u){ _cdn = String(u || '').trim(); _inited = true; }

async function driver(){
  if(process.env.STORAGE_DRIVER) return String(process.env.STORAGE_DRIVER).trim().toLowerCase();
  await ensureInit();
  return DRIVERS.includes(_drv) ? _drv : 'local';
}
async function cdnBase(){
  if(process.env.CDN_BASE_URL) return String(process.env.CDN_BASE_URL).replace(/\/+$/, '');
  await ensureInit();
  return (_cdn || '').replace(/\/+$/, '');
}

/* ---------- URL publik untuk rel 'uploads/…' (null = dilayani lokal) ---------- */
async function publicUrl(rel){
  const d = await driver();
  if(d === 'local') return null;
  const r = String(rel || '').replace(/^\/+/, '');
  if(!r.startsWith('uploads/')) return null;
  if(d === 'cdn'){
    const b = await cdnBase();
    return b ? b + '/' + r : null;
  }
  if(d === 'cloudinary'){
    const cloud = process.env.CLOUDINARY_CLOUD;
    if(!cloud) return null;
    const noExt = r.replace(/\.[^.]+$/, '');
    return 'https://res.cloudinary.com/' + cloud + '/image/upload/f_auto,q_auto/' + noExt;
  }
  if(d === 'supabase'){
    const u = process.env.SUPABASE_URL, b = process.env.SUPABASE_BUCKET || 'sikeda';
    return u ? u.replace(/\/+$/, '') + '/storage/v1/object/public/' + b + '/' + r : null;
  }
  /* gdrive: drive bukan CDN — hanya bila CDN base diisi */
  const b = await cdnBase();
  return b ? b + '/' + r : null;
}

/* ---------- Tulis: lokal selalu, mirror best-effort ---------- */
async function writeFile(rel, buf){
  const root = uploadsRoot();
  const full = path.resolve(root, rel);
  if(!full.startsWith(path.resolve(root))) throw new Error('Path uploads tidak valid.');
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf);
  } catch(e){
    /* Vercel FS read-only: lanjut ke mirror, jangan gagalkan upload */
    if(!process.env.VERCEL) throw e;
  }
  const d = await driver();
  if(d === 'local' || d === 'cdn') return { ok: true };
  const mirror = d === 'cloudinary' ? upCloudinary : d === 'supabase' ? upSupabase : upGdrive;
  try {
    await mirror(rel, buf);
    return { ok: true };
  } catch(e){
    console.warn('[storage] mirror ' + d + ' gagal:', e.message);
    return { ok: false, err: e.message };
  }
}

/* ---------- Hapus: lokal + driver terbaik usaha (best-effort) ---------- */
async function removeFile(rel){
  const r = String(rel || '').replace(/^\/+/, '');
  const root = path.resolve(uploadsRoot());
  const full = path.resolve(root, r);
  if(full.startsWith(root) && fs.existsSync(full)){
    try { fs.unlinkSync(full); } catch(_){}
  }
  const d = await driver();
  try {
    if(d === 'cloudinary'){
      const cloud = process.env.CLOUDINARY_CLOUD, key = process.env.CLOUDINARY_KEY, secret = process.env.CLOUDINARY_SECRET;
      if(cloud && key && secret){
        const ts = Date.now();
        const sig = crypto.createHash('sha1').update('public_id=' + r.replace(/\.[^.]+$/, '') + '&timestamp=' + ts + secret).digest('hex');
        const body = new URLSearchParams({ public_id: r.replace(/\.[^.]+$/, ''), timestamp: String(ts), api_key: key, signature: sig });
        await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/auto/destroy', { method: 'POST', body }).catch(() => {});
      }
    } else if(d === 'supabase'){
      const u = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY, b = process.env.SUPABASE_BUCKET || 'sikeda';
      if(u && key) await fetch(u.replace(/\/+$/, '') + '/storage/v1/object/' + b + '/' + r, { method: 'DELETE', headers: { Authorization: 'Bearer ' + key } }).catch(() => {});
    }
  } catch(_){ /* best effort */ }
}

/* ---------- Uploader per driver ---------- */
async function upCloudinary(rel, buf){
  const cloud = process.env.CLOUDINARY_CLOUD, key = process.env.CLOUDINARY_KEY, secret = process.env.CLOUDINARY_SECRET;
  if(!cloud || !key || !secret) throw new Error('Env CLOUDINARY_CLOUD / CLOUDINARY_KEY / CLOUDINARY_SECRET belum lengkap.');
  const ts = Date.now();
  const publicId = rel.replace(/\.[^.]+$/, '');
  const sig = crypto.createHash('sha1').update('public_id=' + publicId + '&timestamp=' + ts + secret).digest('hex');
  const body = new URLSearchParams({
    file: 'data:application/octet-stream;base64,' + buf.toString('base64'),
    api_key: key, timestamp: String(ts), public_id: publicId, signature: sig
  });
  const resp = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/auto/upload', { method: 'POST', body });
  if(!resp.ok) throw new Error('Cloudinary ' + resp.status + ': ' + (await resp.text()).slice(0, 140));
}

async function upSupabase(rel, buf){
  const u = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY, b = process.env.SUPABASE_BUCKET || 'sikeda';
  if(!u || !key) throw new Error('Env SUPABASE_URL / SUPABASE_SERVICE_KEY belum lengkap.');
  const resp = await fetch(u.replace(/\/+$/, '') + '/storage/v1/object/' + b + '/' + rel, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
    body: buf
  });
  if(!resp.ok) throw new Error('Supabase ' + resp.status + ': ' + (await resp.text()).slice(0, 140));
}

let _gTok = null;
async function gToken(){
  if(_gTok && _gTok.exp > Date.now() + 60000) return _gTok.t;
  const cid = process.env.GDRIVE_CLIENT_ID, cs = process.env.GDRIVE_CLIENT_SECRET, rt = process.env.GDRIVE_REFRESH_TOKEN;
  if(!cid || !cs || !rt) throw new Error('Env GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN belum lengkap.');
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cid, client_secret: cs, refresh_token: rt, grant_type: 'refresh_token' })
  });
  const j = await resp.json().catch(() => ({}));
  if(!j.access_token) throw new Error('GDrive token: ' + JSON.stringify(j).slice(0, 120));
  _gTok = { t: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return _gTok.t;
}

async function upGdrive(rel, buf){
  const tok = await gToken();
  const boundary = 'sikeda' + Date.now();
  const meta = { name: path.basename(rel), parents: [process.env.GDRIVE_FOLDER_ID || 'root'] };
  const pre = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: application/octet-stream\r\n\r\n';
  const tail = '\r\n--' + boundary + '--';
  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body: Buffer.concat([Buffer.from(pre, 'utf8'), buf, Buffer.from(tail, 'utf8')])
  });
  const j = await resp.json().catch(() => ({}));
  if(!j.id) throw new Error('GDrive upload: ' + JSON.stringify(j).slice(0, 140));
}

/* ---------- Middleware /uploads/* untuk server Node bawaan ---------- */
function serveUploads(req, res, next){
  (async () => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\/+/, ''));
    const d = await driver();
    if(d !== 'local'){
      const u = await publicUrl('uploads/' + rel);
      if(u) return res.redirect(302, u);
    }
    /* Fallback & default: file dari disk server bawaan */
    const root = path.resolve(uploadsRoot());
    const full = path.resolve(root, rel);
    if(full.startsWith(root) && fs.existsSync(full) && fs.statSync(full).isFile()){
      return res.sendFile(full, { maxAge: '7d' });
    }
    next();
  })().catch(e => {
    console.error('[storage] serveUploads:', e.message);
    if(!res.headersSent) res.status(500).json({ error: 'Gagal membaca berkas.' });
  });
}

module.exports = { DRIVERS, driver, setDriver, setCdnBase, cdnBase, publicUrl, writeFile, removeFile, serveUploads };
