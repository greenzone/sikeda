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
        membuat interval melambat; sinyal paling jujur di server yang
        hidup terus-menerus.
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

   Pelajaran produksi (serverless — Vercel/Render gratis):
   - Instance serverless di-suspend antar request; begitu bangun, semua
     timer melompat sekaligus. Tanpa pengaman, EMA lag membaca ratusan
     ms padahal tidak ada beban → antrian terbuka terus → pengguna
     terjebak loop halaman antrian.
   - Pengaman yang dipakai di sini:
     a) WARMUP : sampel lag diabaikan selama 60 dtk pertama umur proses
        (plus 60 dtk pertama setiap kali proses kembali menerima
        trafik setelah >3 menit diam — ciri khas bangun dari suspend).
     b) OUTLIER: sampel dengan lompatan timer > 2 dtk dibuang utuh —
        itu artefak suspend/cold-start, bukan beban pengguna; sementara
        lag nyata yang berkelanjutan tetap terbaca jujur oleh EMA.
     c) CONC   : concurrency dihitung per-proses; di serverless tiap
        instance melayani sedikit request, jadi ambang default
        diturunkan agar sinyal ini yang memicu, bukan lag.
     d) GATE CACHE : keputusan open/close di-cache 5 dtk per proses —
        cukup untuk menahan lonjakan sesaat, tetap responsif saat
        beban benar-benar tinggi.

   Konfigurasi (dashboard Pengaturan → Beban Sistem, atau env):
   - busy_mode           auto | manual | off   (default auto)
   - busy_manual_on      0 | 1                 (khusus mode manual)
   - busy_max_conc       8    (default, request aktif per proses)
   - busy_max_lag_ms     250  (default, ms lag event-loop)
   - busy_hold_secs      10   (detik di atas ambang → antrian)
   - busy_release_secs   20   (detik normal → antrian ditutup)
   - BUSY_WARMUP_SECS    60   (detik tanpa sinyal lag saat proses
        boot / bangun dari suspend; 0 untuk menonaktifkan)
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
const bootAt = Date.now(); /* umur proses — untuk warmup cold start */
const _ws = parseInt(process.env.BUSY_WARMUP_SECS, 10);
const WARMUP_MS = (isNaN(_ws) || _ws < 0 ? 60 : _ws) * 1000;
const platform = process.env.VERCEL ? 'vercel'
  : (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) ? 'render'
  : process.env.AWS_LAMBDA_FUNCTION_NAME ? 'lambda'
  : 'node';
let warmUntil = bootAt + WARMUP_MS; /* sampai kapan sampel lag diabaikan */
let lastReqAt = 0; /* request terakhir — deteksi bangun dari suspend */

/* Konfigurasi efektif (di-cache, disegarkan tiap 15 dtk dari DB) */
const cfg = { mode: 'auto', manualOn: 0, maxConc: 8, maxLagMs: 250, holdSecs: 10, releaseSecs: 20 };
let cfgAt = 0;
let _initing = false;

function refreshCfg(){
  if(_initing) return Promise.resolve();
  _initing = true;
  const prevMode = cfg.mode, prevManual = cfg.manualOn;
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
    /* Perubahan mode manual berlaku seketika — tanpa menunggu tick 250 ms —
       supaya paksa-buka/paksa-tutup dari dashboard langsung terasa. */
    if(cfg.mode === 'manual' && (prevMode !== 'manual' || prevManual !== cfg.manualOn)){
      if(cfg.manualOn){ openSince = openSince || Date.now(); openState = true; }
      else { openState = false; openSince = 0; overSince = 0; underSince = 0; }
    }
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

/* ---------- Sampler lag event-loop (interval 250 ms, EMA 0.2) ----------
   Anti false-positive platform serverless:
   - Warmup: selama BUSY_WARMUP_SECS (default 60) dtk pertama umur
     proses, dan selama durasi yang sama setiap kali proses kembali
     menerima trafik setelah diam >3 menit (ciri bangun dari suspend),
     sampel lag TIDAK dihitung — timer yang melompat saat boot bukan
     beban pengguna.
   - Outlier: lompatan timer > 2 dtk dibuang utuh (artefak suspend/
     cold-start); lag nyata yang berkelanjutan tetap terbaca EMA. */
const sampler = setInterval(() => {
  const now = Date.now();
  const dt = now - lastFlush;
  lastFlush = now;
  if(now < warmUntil){
    /* fase warmup — sampel diabaikan */
  } else if(dt > 0 && dt <= 2000){
    const step = Math.max(0, dt - 250);
    if(step > 0) lagEma = lagEma * 0.8 + step * 0.2;
  }
  if(now - cfgAt > 15000) refreshCfg();
  /* Histeresis dimajukan timer — jalan terus walau tanpa trafik */
  tickState(now);
}, 250);
sampler.unref();

/* ---------- Sampler puncak concurrency (reset tiap 10 dtk) ---------- */
const flusher = setInterval(() => {
  const now = Date.now();
  if(now - lastPeakAt >= 10000){ peak = 0; lastPeakAt = now; }
}, 10000).unref();

/* ---------- Status antrian + hysteresis ---------- */
let openSince = 0, overSince = 0, underSince = 0;
let openState = false;

function overThreshold(e){
  return inflight >= e.maxConc || lagEma >= e.maxLagMs;
}
function isBusyNow(e){
  if(e.mode === 'off') return false;
  if(e.mode === 'manual') return !!e.manualOn;
  return overThreshold(e);
}

/* Histeresis dimajukan sampler tiap 250 ms (tickState) — bukan oleh
   request yang lewat gerbang — sehingga hitungan hold/release tetap
   berjalan walau TIDAK ADA trafik yang melewati gerbang, misalnya saat
   semua pengguna menunggu di halaman antrian (dulu: detik histeresis
   berhenti menghitung dan antrian terasa tidak pernah selesai). */
function tickState(now){
  const e = eff();
  if(e.mode === 'off'){ openState = false; openSince = 0; overSince = 0; underSince = 0; return; }
  if(e.mode === 'manual'){
    openState = !!e.manualOn;
    if(e.manualOn){ if(!openSince) openSince = now; } else openSince = 0;
    overSince = 0; underSince = 0;
    return;
  }
  if(overThreshold(e)){
    underSince = 0;
    if(!overSince) overSince = now;
    if(now - overSince >= e.holdSecs * 1000){ if(!openSince) openSince = now; }
  } else {
    overSince = 0;
    if(!underSince) underSince = now;
    else if(now - underSince >= e.releaseSecs * 1000) openSince = 0;
  }
  openState = !!openSince;
}

/* Keputusan gerbang membaca hasil histeresis terakhir (murah & konsisten). */
async function queueOpen(){ return openState; }

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
    queueOpenSince: openSince || null,
    /* Transparansi platform: pengguna bisa melihat sendiri apakah
       sistem benar-benar sibuk atau baru sekadar bangun dari tidur. */
    platform,
    uptimeSecs: Math.round((Date.now() - bootAt) / 1000),
    warming: Date.now() < warmUntil,
    lagSignal: platform === 'node' ? 'aktif' : 'dibatasi (serverless)'
  };
}

function setManual(on, mode){
  cfg.manualOn = on ? 1 : 0;
  if(mode) cfg.mode = mode;
  cfgAt = Date.now();
  if(on){ openSince = openSince || Date.now(); openState = true; }
  else { openSince = 0; overSince = 0; underSince = 0; openState = false; }
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
  const now = Date.now();
  /* Bangun dari suspend/di-throttle (diam >3 menit) → warmup lag lagi,
     supaya lonjakan timer saat bangun tidak membuka antrian palsu. */
  if(lastReqAt && now - lastReqAt > 3 * 60000) warmUntil = now + WARMUP_MS;
  lastReqAt = now;
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
