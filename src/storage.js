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

const DRIVERS = ['local', 'cdn', 'cloudinary', 'supabase', 'gdrive', 's3'];

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
  },
  s3: {
    endpoint:   { secret: false, required: true },
    region:     { secret: false, required: true },
    access_key: { secret: false, required: true },
    secret_key: { secret: true,  required: true },
    bucket:     { secret: false, required: true }
  }
};
const ENV_MAP = {
  cloudinary: { cloud: 'CLOUDINARY_CLOUD', key: 'CLOUDINARY_KEY', secret: 'CLOUDINARY_SECRET' },
  supabase:   { url: 'SUPABASE_URL', service_key: 'SUPABASE_SERVICE_KEY', bucket: 'SUPABASE_BUCKET' },
  gdrive:     { client_id: 'GDRIVE_CLIENT_ID', client_secret: 'GDRIVE_CLIENT_SECRET', refresh_token: 'GDRIVE_REFRESH_TOKEN', folder_id: 'GDRIVE_FOLDER_ID' },
  s3:         { endpoint: 'S3_ENDPOINT', region: 'S3_REGION', access_key: 'S3_ACCESS_KEY', secret_key: 'S3_SECRET_KEY', bucket: 'S3_BUCKET' }
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
async function s3Cfg(){
  const db = (await loadCreds()).s3 || {};
  return {
    endpoint:  (process.env.S3_ENDPOINT || db.endpoint || '').replace(/\/+$/, ''),
    region:    process.env.S3_REGION    || db.region    || 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY || db.access_key || '',
    secretKey: process.env.S3_SECRET_KEY || db.secret_key || '',
    bucket:    process.env.S3_BUCKET    || db.bucket    || ''
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
  if(d === 's3'){
    const c = await s3Cfg();
    return (c.endpoint && c.bucket) ? c.endpoint + '/' + c.bucket + '/' + r : null;
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
  const mirror = d === 'cloudinary' ? upCloudinary : d === 'supabase' ? upSupabase : d === 's3' ? upS3 : upGdrive;
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
    } else if(d === 's3'){
      const c = await s3Cfg();
      if(c.endpoint && c.accessKey && c.secretKey && c.bucket){
        await s3Request('DELETE', c, '/' + r, '', {}).catch(() => {});
      }
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

/* ---------- S3 / Backblaze B2 (kompatibel S3, SigV4 murni tanpa dependensi) ---------- */
function s3Hmac(key, data){ return crypto.createHmac('sha256', key).update(data).digest(); }
function s3Sha256hex(data){ return crypto.createHash('sha256').update(data).digest('hex'); }

/* method PUT/DELETE, key diawali '/', payload Buffer/string, extraHeaders ikut ditandatangani */
async function s3Request(method, c, key, payload, extraHeaders){
  const url = new URL(c.endpoint);
  const host = url.host;
  const canonicalUri = '/' + c.bucket + key.split('/').map(encodeURIComponent).join('/');
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = s3Sha256hex(payload || '');
  const headers = Object.assign({
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  }, extraHeaders || {});
  const hNames = Object.keys(headers).map(h => h.toLowerCase()).sort();
  const canonicalHeaders = hNames.map(h => {
    const orig = Object.keys(headers).find(k => k.toLowerCase() === h);
    return h + ':' + String(headers[orig]).trim().replace(/\s+/g, ' ');
  }).join('\n') + '\n';
  const signedHeaders = hNames.join(';');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = dateStamp + '/' + c.region + '/s3/aws4_request';
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, s3Sha256hex(canonicalRequest)].join('\n');
  const kSigning = s3Hmac(s3Hmac(s3Hmac(s3Hmac('AWS4' + c.secretKey, dateStamp), c.region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const auth = 'AWS4-HMAC-SHA256 Credential=' + c.accessKey + '/' + scope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
  const fetchHeaders = Object.assign({}, headers, { Authorization: auth });
  delete fetchHeaders.host; /* fetch menyetel Host dari URL — nilainya sama */
  const resp = await fetch(url.origin + canonicalUri, { method, headers: fetchHeaders, body: method === 'PUT' ? payload : undefined });
  if(!resp.ok) throw new Error('S3 ' + resp.status + ': ' + (await resp.text()).slice(0, 140));
  return resp;
}

async function upS3(rel, buf){
  const c = await s3Cfg();
  if(!c.endpoint || !c.accessKey || !c.secretKey || !c.bucket) throw new Error('Kredensial S3/B2 belum lengkap (ENV atau dashboard).');
  await s3Request('PUT', c, '/' + rel, buf, { 'Content-Type': 'application/octet-stream' });
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

/* ============================================================
   Migrasi file lama & kuota driver (untuk dashboard superadmin)
   ============================================================ */
/* Daftar semua file di penyimpanan lokal (rel 'uploads/…' + ukuran) */
function listLocalFiles(){
  const root = path.resolve(uploadsRoot());
  const out = [];
  (function walk(d){
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch(_){ return; }
    for(const e of entries){
      const full = path.join(d, e.name);
      if(e.isDirectory()) walk(full);
      else if(e.isFile()){
        try { out.push({ rel: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size }); } catch(_){}
      }
    }
  })(root);
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

/* Kirim ulang satu file lokal yang sudah ada ke driver remote aktif
   (tanpa menulis ulang lokal — mirror murni). */
async function mirrorLocal(rel){
  const r = String(rel || '').replace(/^\/+/, '');
  const root = path.resolve(uploadsRoot());
  const full = path.resolve(root, r);
  if(!full.startsWith(root) || !fs.existsSync(full)) throw new Error('Berkas tidak ditemukan di penyimpanan lokal.');
  const d = await driver();
  if(d === 'local' || d === 'cdn') throw new Error('Driver aktif lokal/CDN — tidak ada mirror remote.');
  const buf = fs.readFileSync(full);
  const mirror = d === 'cloudinary' ? upCloudinary : d === 'supabase' ? upSupabase : d === 's3' ? upS3 : upGdrive;
  await mirror(r, buf);
  return { ok: true, driver: d, size: buf.length };
}

/* Kuota & pemakaian driver remote (best effort — null bila API tak menyediakan) */
async function driverQuota(){
  const d = await driver();
  const out = { driver: d, usage: null };
  try {
    if(d === 'cloudinary'){
      const c = await cloudCfg();
      if(!c.cloud || !c.key || !c.secret) return out;
      const ts = Date.now();
      const sig = crypto.createHash('sha1').update('timestamp=' + ts + c.secret).digest('hex');
      const resp = await fetch('https://api.cloudinary.com/v1_1/' + c.cloud + '/usage?timestamp=' + ts + '&api_key=' + c.key + '&signature=' + sig);
      if(!resp.ok){ out.err = 'Cloudinary usage ' + resp.status; return out; }
      const j = await resp.json();
      const u = { storage_bytes: (j.storage && j.storage.usage) || 0, storage_limit_bytes: 26843545600, bandwidth_bytes: (j.bandwidth && j.bandwidth.usage) || 0, bandwidth_limit_bytes: 26843545600 };
      if(j.objects && j.objects.usage !== undefined) u.files = j.objects.usage;
      out.usage = u;
    } else if(d === 'supabase'){
      const c = await supaCfg();
      if(!c.url || !c.serviceKey) return out;
      const resp = await fetch(c.url.replace(/\/+$/, '') + '/storage/v1/bucket', { headers: { Authorization: 'Bearer ' + c.serviceKey } });
      if(!resp.ok){ out.err = 'Supabase buckets ' + resp.status; return out; }
      const buckets = await resp.json().catch(() => []);
      const b = Array.isArray(buckets) ? buckets.find(x => x.name === c.bucket) : null;
      out.usage = {
        exists: !!b,
        storage_limit_bytes: 1073741824,
        note: b ? ('bucket "' + c.bucket + '" ada — pemakaian total tidak disediakan API; batas per-file: ' + (b.file_size_limit || 'default')) : ('bucket "' + c.bucket + '" BELUM ada — buat bucket public bernama itu di Supabase')
      };
    } else if(d === 's3'){
      const c = await s3Cfg();
      if(!c.endpoint || !c.accessKey || !c.secretKey || !c.bucket) return out;
      /* ListObjects (v1) — GET /bucket tanpa query, XML <Size> per objek */
      const resp = await s3Request('GET', c, '/', '', {});
      const xml = await resp.text();
      const sizes = xml.match(/<Size>(\d+)<\/Size>/g) || [];
      let bytes = 0;
      for(const m of sizes) bytes += parseInt(m.replace(/\D/g, ''), 10) || 0;
      out.usage = { storage_bytes: bytes, files: sizes.length, storage_limit_bytes: 10737418240, capped: sizes.length >= 1000, note: sizes.length >= 1000 ? 'rekap terpotong pada 1000 objek pertama' : null };
    } else if(d === 'gdrive'){
      const c = await gdriveCfg();
      if(!c.clientId || !c.clientSecret || !c.refreshToken) return out;
      const tok = await gToken();
      const resp = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', { headers: { Authorization: 'Bearer ' + tok } });
      if(!resp.ok){ out.err = 'Drive about ' + resp.status; return out; }
      const j = await resp.json();
      const q2 = (j && j.storageQuota) || {};
      out.usage = { storage_bytes: parseInt(q2.usage || '0', 10), storage_limit_bytes: parseInt(q2.limit || '0', 10), note: 'kuota seluruh Drive akun ini (bukan hanya folder SIKEDA)' };
    }
  } catch(e){ out.err = e.message; }
  return out;
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

module.exports = { DRIVERS, driver, setDriver, setCdnBase, cdnBase, publicUrl, writeFile, removeFile, serveUploads, CREDS_FIELDS, ENV_MAP, credStatus, loadCreds, saveCreds, ensureCredsTable, cloudCfg, supaCfg, gdriveCfg, s3Cfg, s3Request, listLocalFiles, mirrorLocal, driverQuota };
