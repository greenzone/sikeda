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
        - cloudinary : Cloudinary free tier
        - supabase   : Supabase Storage free tier
        - gdrive     : Google Drive 15 GB (OAuth refresh token)
        - cdn        : hanya base URL CDN kustom (file tetap lokal)
      Kegagalan mirror TIDAK menggagalkan upload (log + hasil uji).
   3. Pelayanan /uploads/* — bila driver remote punya URL publik,
      request diarahkan (302) ke sana; kalau tidak, dilayani lokal.

   Driver dipilih dari env STORAGE_DRIVER (menang) atau settings DB
   ('storage_driver') yang dikelola superadmin di dashboard.

   KREDENSIAL PER DRIVER (baru):
   - Sumber: ENV VARS (menang) > DB tabel `storage_creds`
     (diisi superadmin dari dashboard Pengaturan).
   - Nilai di DB dienkripsi AES-256-GCM (kunci diturunkan dari
     NIK_ENC_KEY + konteks khusus, tidak pernah plaintext).
   - API TIDAK pernah mengembalikan isi kredensial — hanya status
     {set, sumber} per field (lihat credStatus()).
   ============================================================ */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uploadsRoot } = require('./uploads-path');

const DRIVERS = ['local', 'cdn', 'cloudinary', 'supabase', 'gdrive'];

/* ---------- Definisi field kredensial per driver ---------- */
const CREDS_FIELDS = {
  cloudinary: {
    cloud:  { secret: false, required: true },
    key:    { secret: true,  required: true },
    secret: { secret: true,  required: true }
  },
  supabase: {
    url:         { secret: false, required: true },
    service_key: { secret: true,  required: true },
    bucket:      { secret: false, required: false }
  },
  gdrive: {
    client_id:     { secret: false, required: true },
    client_secret: { secret: true,  required: true },
    refresh_token: { secret: true,  required: true },
    folder_id:     { secret: false, required: false }
  }
};
const ENV_MAP = {
  cloudinary: { cloud: 'CLOUDINARY_CLOUD', key: 'CLOUDINARY_KEY', secret: 'CLOUDINARY_SECRET' },
  supabase:   { url: 'SUPABASE_URL', service_key: 'SUPABASE_SERVICE_KEY', bucket: 'SUPABASE_BUCKET' },
  gdrive:     { client_id: 'GDRIVE_CLIENT_ID', client_secret: 'GDRIVE_CLIENT_SECRET', refresh_token: 'GDRIVE_REFRESH_TOKEN', folder_id: 'GDRIVE_FOLDER_ID' }
};

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

/* ============================================================
   KREDENSIAL — enkripsi & tabel storage_creds
   ============================================================ */
let _credsCache = null;
function credsKey(){
  return crypto.createHash('sha256').update(String(process.env.NIK_ENC_KEY || '') + '|sikeda-storage-creds-v1').digest();
}
function encJSON(obj){
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', credsKey(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return iv.toString('base64') + '.' + enc.toString('base64') + '.' + c.getAuthTag().toString('base64');
}
function decJSON(str){
  try {
    const [ivS, dataS, tagS] = String(str).split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', credsKey(), Buffer.from(ivS, 'base64'));
    d.setAuthTag(Buffer.from(tagS, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(dataS, 'base64')), d.final()]).toString('utf8'));
  } catch(e){ return null; }
}
function ensureCredsTable(){
  const { q } = require('./db');
  return q(`CREATE TABLE IF NOT EXISTS storage_creds (
    driver VARCHAR(32) PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
}
async function loadCreds(force){
  if(_credsCache && !force) return _credsCache;
  const out = { cloudinary: null, supabase: null, gdrive: null };
  try {
    const { q } = require('./db');
    const rows = await q('SELECT driver, data FROM storage_creds');
    rows.forEach(r => {
      const o = decJSON(r.data);
      if(o && typeof o === 'object') out[r.driver] = o;
      else if(o === null) console.warn('[storage] kredensial ' + r.driver + ' tidak dapat didekripsi (NIK_ENC_KEY berubah?)');
    });
  } catch(_){ /* tabel belum ada / DB belum siap */ }
  _credsCache = out;
  return out;
}
/* partial=null → hapus; partial={field:val} → merge ke yang tersimpan */
async function saveCreds(drv, partial){
  await ensureCredsTable();
  const { q } = require('./db');
  if(partial === null){
    await q('DELETE FROM storage_creds WHERE driver = ?', [drv]).catch(() => {});
  } else {
    const db = (await loadCreds(true))[drv] || {};
    const merged = Object.assign({}, db);
    for(const [k, v] of Object.entries(partial || {})){
      const s = String(v || '').trim();
      /* kosong / bullet mask = abaikan (tidak mengubah nilai lama) */
      if(s && !/^[•\u2022]+$/.test(s)) merged[k] = s;
    }
    if(Object.keys(merged).length){
      await q('INSERT INTO storage_creds (driver, data) VALUES (?,?) ON DUPLICATE KEY UPDATE data = VALUES(data)', [drv, encJSON(merged)]);
    } else {
      await q('DELETE FROM storage_creds WHERE driver = ?', [drv]).catch(() => {});
    }
  }
  _credsCache = null;
}
/* Status per field untuk UI: set/sumber — TANPA nilai kredensial */
async function credStatus(){
  const db = await loadCreds();
  const out = {};
  for(const drv of Object.keys(CREDS_FIELDS)){
    const fields = {};
    let ready = true;
    const srcs = [];
    for(const [f, meta] of Object.entries(CREDS_FIELDS[drv])){
      const envSet = !!(ENV_MAP[drv][f] && process.env[ENV_MAP[drv][f]]);
      const dbSet = !!(db[drv] && db[drv][f] !== undefined && String(db[drv][f]).trim() !== '');
      const set = envSet || dbSet;
      fields[f] = { set, src: envSet ? 'env' : (dbSet ? 'db' : null), secret: !!meta.secret, required: !!meta.required };
      if(meta.required && !set) ready = false;
      if(set) srcs.push(envSet ? 'env' : 'db');
    }
    out[drv] = { ready, source: srcs.length ? (srcs.every(s => s === 'env') ? 'env' : srcs.every(s => s === 'db') ? 'db' : 'mixed') : null, fields };
  }
  return out;
}

/* ---------- Config gabungan per driver (env > DB) ---------- */
async function cloudCfg(){
  const db = (await loadCreds()).cloudinary || {};
  return {
    cloud:  process.env.CLOUDINARY_CLOUD  || db.cloud  || '',
    key:    process.env.CLOUDINARY_KEY    || db.key    || '',
    secret: process.env.CLOUDINARY_SECRET || db.secret || ''
  };
}
async function supaCfg(){
  const db = (await loadCreds()).supabase || {};
  return {
    url:        process.env.SUPABASE_URL        || db.url         || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || db.service_key || '',
    bucket:     process.env.SUPABASE_BUCKET     || db.bucket      || 'sikeda'
  };
}
async function gdriveCfg(){
  const db = (await loadCreds()).gdrive || {};
  return {
    clientId:     process.env.GDRIVE_CLIENT_ID     || db.client_id     || '',
    clientSecret: process.env.GDRIVE_CLIENT_SECRET || db.client_secret || '',
    refreshToken: process.env.GDRIVE_REFRESH_TOKEN || db.refresh_token || '',
    folderId:     process.env.GDRIVE_FOLDER_ID     || db.folder_id     || ''
  };
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
    const c = await cloudCfg();
    if(!c.cloud) return null;
    const noExt = r.replace(/\.[^.]+$/, '');
    return 'https://res.cloudinary.com/' + c.cloud + '/image/upload/f_auto,q_auto/' + noExt;
  }
  if(d === 'supabase'){
    const c = await supaCfg();
    return c.url ? c.url.replace(/\/+$/, '') + '/storage/v1/object/public/' + c.bucket + '/' + r : null;
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
      const c = await cloudCfg();
      if(c.cloud && c.key && c.secret){
        const ts = Date.now();
        const sig = crypto.createHash('sha1').update('public_id=' + r.replace(/\.[^.]+$/, '') + '&timestamp=' + ts + c.secret).digest('hex');
        const body = new URLSearchParams({ public_id: r.replace(/\.[^.]+$/, ''), timestamp: String(ts), api_key: c.key, signature: sig });
        await fetch('https://api.cloudinary.com/v1_1/' + c.cloud + '/auto/destroy', { method: 'POST', body }).catch(() => {});
      }
    } else if(d === 'supabase'){
      const c = await supaCfg();
      if(c.url && c.serviceKey) await fetch(c.url.replace(/\/+$/, '') + '/storage/v1/object/' + c.bucket + '/' + r, { method: 'DELETE', headers: { Authorization: 'Bearer ' + c.serviceKey } }).catch(() => {});
    }
  } catch(_){ /* best effort */ }
}

/* ---------- Uploader per driver ---------- */
async function upCloudinary(rel, buf){
  const c = await cloudCfg();
  if(!c.cloud || !c.key || !c.secret) throw new Error('Kredensial Cloudinary belum lengkap (ENV atau dashboard).');
  const ts = Date.now();
  const publicId = rel.replace(/\.[^.]+$/, '');
  const sig = crypto.createHash('sha1').update('public_id=' + publicId + '&timestamp=' + ts + c.secret).digest('hex');
  const body = new URLSearchParams({
    file: 'data:application/octet-stream;base64,' + buf.toString('base64'),
    api_key: c.key, timestamp: String(ts), public_id: publicId, signature: sig
  });
  const resp = await fetch('https://api.cloudinary.com/v1_1/' + c.cloud + '/auto/upload', { method: 'POST', body });
  if(!resp.ok) throw new Error('Cloudinary ' + resp.status + ': ' + (await resp.text()).slice(0, 140));
}

async function upSupabase(rel, buf){
  const c = await supaCfg();
  if(!c.url || !c.serviceKey) throw new Error('Kredensial Supabase belum lengkap (ENV atau dashboard).');
  const resp = await fetch(c.url.replace(/\/+$/, '') + '/storage/v1/object/' + c.bucket + '/' + rel, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.serviceKey, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
    body: buf
  });
  if(!resp.ok) throw new Error('Supabase ' + resp.status + ': ' + (await resp.text()).slice(0, 140));
}

let _gTok = null;
async function gToken(){
  if(_gTok && _gTok.exp > Date.now() + 60000) return _gTok.t;
  const c = await gdriveCfg();
  if(!c.clientId || !c.clientSecret || !c.refreshToken) throw new Error('Kredensial Google Drive belum lengkap (ENV atau dashboard).');
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: 'refresh_token' })
  });
  const j = await resp.json().catch(() => ({}));
  if(!j.access_token) throw new Error('GDrive token: ' + JSON.stringify(j).slice(0, 120));
  _gTok = { t: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return _gTok.t;
}

async function upGdrive(rel, buf){
  const c = await gdriveCfg();
  const tok = await gToken();
  const boundary = 'sikeda' + Date.now();
  const meta = { name: path.basename(rel), parents: [c.folderId || 'root'] };
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

module.exports = { DRIVERS, driver, setDriver, setCdnBase, cdnBase, publicUrl, writeFile, removeFile, serveUploads, CREDS_FIELDS, ENV_MAP, credStatus, loadCreds, saveCreds, ensureCredsTable, cloudCfg, supaCfg, gdriveCfg };
