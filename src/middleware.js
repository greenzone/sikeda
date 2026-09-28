/* ============================================================
   SIKEDA — Middleware: JWT auth, RBAC, rate limit OTP
   ============================================================ */
const jwt = require('jsonwebtoken');
const { q } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/* ---------- Signed token helper ---------- */
function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/* ---------- Wajib login: verifikasi JWT + ambil user terbaru ---------- */
async function authRequired(req, res, next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const rows = await q(
      'SELECT id, username, nama, level, anggota_id, is_active FROM users WHERE id = ?',
      [decoded.sub]
    );
    const user = rows[0];
    if(!user || !user.is_active) return res.status(401).json({ error: 'Sesi tidak valid.' });
    req.user = user;
    next();
  } catch(e){
    return res.status(401).json({ error: 'Sesi berakhir. Silakan login ulang.' });
  }
}

/* ---------- RBAC: batasi per level ---------- */
function requireRole(...levels){
  return function(req, res, next){
    if(!req.user) return res.status(401).json({ error: 'Belum login.' });
    if(!levels.includes(req.user.level)){
      return res.status(403).json({ error: 'Akses ditolak untuk level Anda.' });
    }
    next();
  };
}

/* ---------- Rate limit OTP: 3 kiriman / 10 menit per target ---------- */
const otpHits = new Map(); /* key: target -> [timestamps] */
function otpRateLimit(req, res, next){
  const target = String(req.body.target || '').trim().toLowerCase();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hits = (otpHits.get(target) || []).filter(t => now - t < windowMs);
  if(hits.length >= 3){
    return res.status(429).json({ error: 'Terlalu banyak permintaan kode. Coba lagi dalam beberapa menit.' });
  }
  hits.push(now);
  otpHits.set(target, hits);
  next();
}

/* ---------- Logger akses singkat ---------- */
function log(req, res, next){
  const t = new Date().toISOString().slice(11,19);
  res.on('finish', () => {
    if(req.path.startsWith('/api')){
      console.log(`[${t}] ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
    }
  });
  next();
}

module.exports = { signToken, authRequired, requireRole, otpRateLimit, log };
