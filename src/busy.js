'use strict';
/* ============================================================
   SIKEDA — Deteksi beban sistem & halaman antrian (busy queue)

   Prinsip:
   1. DEFAULT NORMAL — tanpa konfigurasi apa pun, instalasi pertama
      tidak pernah menampilkan halaman antrian (mode 'auto' hanya
      aktif bila beban benar-benar melewati ambang).
   2. Dua sinyal beban:
      - concurrency : jumlah request yang sedang diproses
        (sampel puncak 10 dtk terakhir)
      - lag         : delay event-loop (ms, EMA) — server sibuk CPU/DB
        membuat interval melambat; sinyal paling jujur.
   3. Mode (settings DB 'busy_mode', env BUSY_MODE menang):
      - auto   : halaman antrian muncul otomatis saat sibuk (default)
      - manual : superadmin paksa buka/tutup dari dashboard
      - off    : fitur mati total
   4. Hysteresis: butuh BUSY_HOLD_SECS (default 10 dtk) di atas ambang
      sebelum antrian terbuka, dan BUSY_RELEASE_SECS (default 20 dtk)
      di bawah ambang sebelum antrian ditutup (state 'recovering').
   5. Saat antrian terbuka:
      - Halaman browser (dokumen/clean-URL) → redirect 302 ke /busy.html
        yang polling otomatis & mengembalikan pengguna saat normal.
      - API non-publik → 503 JSON {busy:true, retry} (klien dashboard
        otomatis mengarahkan ke halaman antrian).
      - SELALU LEWAT: /busy.html, /assets, /uploads, /api/public/*,
        favicon/robots — agar halaman antrian sendiri tampil sempurna.
      - Admin & superadmin (JWT level) TIDAK di-antrikan — supaya
        pengelola tetap bisa mengendalikan sistem saat sibuk.
   6. Kegagalan modul TIDAK PERNAH mematikan situs (semua error = lewat).

   Konfigurasi (dashboard Pengaturan → Beban Sistem, atau env):
   - busy_mode           auto | manual | off   (default auto)
   - busy_manual_on      0 | 1                 (khusus mode manual)
   - busy_max_conc       60   (default, request aktif)
   - busy_max_lag_ms     250  (default, ms lag event-loop)
   - busy_hold_secs      10   (detik di atas ambang → antrian)
   - busy_release_secs   20   (detik normal → antrian ditutup)
   ============================================================ */
const crypto = require('crypto');

const SKIP_PREFIX = ['/uploads/', '/api/public/', '/assets/', '/favicon'];
const SKIP_FILES = new Set(['/busy.html', '/favicon.ico', '/robots.txt', '/manifest.webmanifest']);
const ACCEPT_HTML = /text\/html/;
const EXT_RE = /\.[a-z0-9]{1,8}$/i;

/* ---------- State ---------- */
let inflight = 0;
let peak = 0; /* puncak concurrency dalam sampel 10 dtk terakhir */
let lagEma = 0; /* event-loop lag (ms), EMA alfa 0.2 */
let lastFlush = Date.now();
let lastPeakAt = Date.now();

/* Konfigurasi efektif (di-cache, disegarkan tiap 15 dtk dari DB) */
const cfg = { mode: 'auto', manualOn: 0, maxConc: 60, maxLagMs: 250, holdSecs: 10, releaseSecs: 20 };
let cfgAt = 0;
let _initing = false;

function refreshCfg(){
  if(_initing) return Promise.resolve();
  _initing = true;
  return (async () => {
    try {
      const { q } = require('./db');
      const rows = await q("SELECT kunci, nilai FROM settings WHERE kunci LIKE 'busy\\_%'");
      const m = {};
      rows.forEach(r => { m[r.kunci] = r.nilai; });
      if(m.busy_mode !== undefined){
        const mv = String(m.busy_mode).trim().toLowerCase();
        if(['auto','manual','off'].includes(mv)) cfg.mode = mv;
      }
      if(m.busy_manual_on !== undefined) cfg.manualOn = String(m.busy_manual_on).trim() === '1' ? 1 : 0;
      if(m.busy_max_conc !== undefined){ const n = parseInt(m.busy_max_conc, 10); if(n > 0) cfg.maxConc = n; }
      if(m.busy_max_lag_ms !== undefined){ const n = parseInt(m.busy_max_lag_ms, 10); if(n > 0) cfg.maxLagMs = n; }
      if(m.busy_hold_secs !== undefined){ const n = parseInt(m.busy_hold_secs, 10); if(n >= 1 && n <= 300) cfg.holdSecs = n; }
      if(m.busy_release_secs !== undefined){ const n = parseInt(m.busy_release_secs, 10); if(n >= 5 && n <= 600) cfg.releaseSecs = n; }
    } catch(_){ /* DB belum siap — pakai konfigurasi sekarang */ }
    cfgAt = Date.now();
    _initing = false;
  })();
}
function cfgAsync(){ return (Date.now() - cfgAt > 15000) ? refreshCfg() : Promise.resolve(); }

/* Env menang atas DB (konsisten dengan pola storage.js) */
function eff(){
  const env = process.env.BUSY_MODE;
  const mode = env ? String(env).trim().toLowerCase() : cfg.mode;
  const mc = parseInt(process.env.BUSY_MAX_CONC, 10);
  const ml = parseInt(process.env.BUSY_MAX_LAG_MS, 10);
  const hs = parseInt(process.env.BUSY_HOLD_SECS, 10);
  const rs = parseInt(process.env.BUSY_RELEASE_SECS, 10);
  return {
    mode: ['auto','manual','off'].includes(mode) ? mode : 'auto',
    manualOn: process.env.BUSY_MANUAL_ON !== undefined ? (String(process.env.BUSY_MANUAL_ON).trim() === '1' ? 1 : 0) : cfg.manualOn,
    maxConc: mc > 0 ? mc : cfg.maxConc,
    maxLagMs: ml > 0 ? ml : cfg.maxLagMs,
    holdSecs: hs >= 1 ? hs : cfg.holdSecs,
    releaseSecs: rs >= 1 ? rs : cfg.releaseSecs
  };
}

/* ---------- Sampler lag event-loop (interval 250 ms, EMA 0.2) ---------- */
const sampler = setInterval(() => {
  const now = Date.now();
  const dt = now - lastFlush;
  lagEma = lagEma * 0.8 + Math.max(0, dt - 250) * 0.2;
  lastFlush = now;
  if(now - cfgAt > 15000) refreshCfg();
}, 250);
sampler.unref();

/* ---------- Sampler puncak concurrency (reset tiap 10 dtk) ---------- */
const flusher = setInterval(() => {
  const now = Date.now();
  if(now - lastPeakAt >= 10000){ peak = 0; lastPeakAt = now; }
}, 10000).unref();

/* ---------- Status antrian + hysteresis ---------- */
let openSince = 0, overSince = 0, underSince = 0;

function isBusyNow(e){
  if(e.mode === 'off') return false;
  if(e.mode === 'manual') return !!e.manualOn;
  return inflight >= e.maxConc || lagEma >= e.maxLagMs;
}

async function queueOpen(){
  const e = eff();
  if(e.mode === 'off') return false;
  if(e.mode === 'manual'){
    if(e.manualOn){ if(!openSince) openSince = Date.now(); }
    else openSince = 0;
    return !!e.manualOn;
  }
  /* auto + hysteresis */
  const busy = inflight >= e.maxConc || lagEma >= e.maxLagMs;
  const now = Date.now();
  if(busy){
    underSince = 0;
    if(!overSince) overSince = now;
    if(now - overSince >= e.holdSecs * 1000){ if(!openSince) openSince = now; }
  } else {
    overSince = 0;
    if(!underSince) underSince = now;
    else if(now - underSince >= e.releaseSecs * 1000){ openSince = 0; }
  }
  return !!openSince;
}

function snapshot(){
  const e = eff();
  const busy = isBusyNow(e);
  return {
    mode: e.mode,
    manualOn: !!e.manualOn,
    busy,
    state: e.mode === 'off' ? 'off' : (busy ? 'busy' : (openSince ? 'recovering' : 'normal')),
    inflight, peak, lagMs: Math.round(lagEma),
    maxConc: e.maxConc, maxLagMs: e.maxLagMs,
    holdSecs: e.holdSecs, releaseSecs: e.releaseSecs,
    queueOpenSince: openSince || null
  };
}

function setManual(on, mode){
  cfg.manualOn = on ? 1 : 0;
  if(mode) cfg.mode = mode;
  cfgAt = Date.now();
  if(on){ openSince = openSince || Date.now(); }
  else { openSince = 0; overSince = 0; underSince = 0; }
}

/* ---------- Admin bypass: decode payload JWT (tanpa verifikasi tanda tangan —
   bypass antrian bukan batas keamanan; verifikasi asli tetap di auth middleware) ---------- */
function isAdminReq(req){
  try {
    const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if(!m) return false;
    const parts = m[1].split('.');
    if(parts.length !== 3) return false;
    const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
    return payload && (payload.level === 'admin' || payload.level === 'superadmin');
  } catch(e){ return false; }
}

/* ---------- Middleware penghitung ---------- */
function track(req, res, next){
  inflight++;
  if(inflight > peak) peak = inflight;
  let done = false;
  const fin = () => { if(!done){ done = true; inflight = Math.max(0, inflight - 1); } };
  res.on('finish', fin);
  res.on('close', fin);
  next();
}

/* ---------- Middleware gerbang antrian ---------- */
function gate(req, res, next){
  (async () => {
    const url = (req.url || '/').split('?')[0];
    /* Selalu lewat: halaman antrian, aset, uploads, API publik, file khusus */
    if(url === '/busy.html' || SKIP_FILES.has(url) || SKIP_PREFIX.some(p => url.startsWith(p))) return next();

    await cfgAsync();
    if(!(await queueOpen())) return next();

    /* API non-publik → 503 JSON (kecuali admin/superadmin) */
    if(url.startsWith('/api/')){
      if(isAdminReq(req)) return next();
      const nonce = crypto.randomBytes(10).toString('hex');
      res.set('Retry-After', '5');
      return res.status(503).json({ busy: true, retry: '/busy.html?n=' + nonce });
    }

    /* Halaman browser (dokumen HTML / clean-URL) → redirect ke antrian */
    const isPage = ACCEPT_HTML.test(String(req.headers.accept || '')) || !EXT_RE.test(url);
    if(!isPage) return next();
    const nonce = crypto.randomBytes(12).toString('hex');
    res.set('Retry-After', '5');
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, '/busy.html?n=' + nonce + '&ret=' + encodeURIComponent(req.originalUrl || req.url || '/'));
  })().catch(e => {
    console.error('[busy] gate:', e.message);
    next(); /* kegagalan modul TIDAK BOLEH mematikan situs */
  });
}

/* Gabungan: track + gate untuk Express app.use() tunggal */
function middleware(req, res, next){
  track(req, res, () => { gate(req, res, next); });
}

module.exports = { middleware, track, gate, snapshot, setManual, isBusyNow, isAdminReq, queueOpen, refreshCfg, eff };
