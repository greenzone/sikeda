/* ============================================================
   SIKEDA — Routes: Autentikasi (OTP anggota & password pengelola)
   ============================================================ */
const express = require('express');
const crypto = require('crypto');
const { q } = require('../db');
const { encryptNIK, decryptNIK, maskNIK, verifyPassword, hashPassword } = require('../crypto');
const { signToken, authRequired, otpRateLimit } = require('../middleware');
const { sendTelegram, sendFonnte, sendEmail } = require('../notify');
const { baseUrl } = require('../baseurl');
const { sikedaEmail, emailButton } = require('../mailer');

const router = express.Router();

/* Pastikan tabel send_log ada (pencatatan hasil kirim OTP; idempoten) */
let sendLogReadyA = null;
function ensureSendLogA(){
  if(!sendLogReadyA){
    sendLogReadyA = q(`CREATE TABLE IF NOT EXISTS send_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pengumuman_id INT NULL,
      kanal VARCHAR(20) NOT NULL,
      tujuan VARCHAR(190) NOT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 0,
      ket VARCHAR(255) NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sendlog_created (created_at),
      INDEX idx_sendlog_pengumuman (pengumuman_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(function(){});
  }
  return sendLogReadyA;
}

/* ============================================================
   POST /api/auth/otp/request  { target, channel }
   Deteksi otomatis: nomor WA (anggota) atau email.
   ============================================================ */
router.post('/otp/request', otpRateLimit, async (req, res) => {
  try {
    /* Terima "target" atau "contact" (kompatibilitas frontend) */
    const target = String(req.body.target || req.body.contact || '').trim();
    const channel = ['wa', 'email', 'telegram'].includes(req.body.channel) ? req.body.channel : 'wa';
    if(!target) return res.status(400).json({ error: 'Nomor, email, atau username Telegram wajib diisi.' });

    if(channel === 'wa' && target.replace(/\D/g,'').length < 10){
      return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
    }
    if(channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)){
      return res.status(400).json({ error: 'Format email tidak valid.' });
    }
    if(channel === 'telegram' && !(/^@[A-Za-z0-9_]{4,}$/.test(target) || /^\d{5,}$/.test(target))){
      return res.status(400).json({ error: 'Isi numeric Chat ID (contoh: 123456789) atau username @yang_valid.' });
    }

    /* Pastikan target terdaftar sesuai channel masing-masing */
    let exists;
    if(channel === 'wa'){
      exists = await q(
        `SELECT u.id FROM users u
         LEFT JOIN anggota a ON a.id = u.anggota_id
         WHERE u.whatsapp = ? OR a.whatsapp = ? LIMIT 1`,
        [target, target]
      );
    } else if(channel === 'telegram'){
      exists = await q(
        `SELECT u.id FROM users u
         LEFT JOIN anggota a ON a.id = u.anggota_id
         WHERE u.telegram = ? OR a.telegram = ? OR u.telegram = ? OR a.telegram = ? LIMIT 1`,
        [target, target, '@' + target.replace(/^@/, ''), '@' + target.replace(/^@/, '')]
      );
    } else {
      exists = await q(
        `SELECT u.id FROM users u
         LEFT JOIN anggota a ON a.id = u.anggota_id
         WHERE u.email = ? OR a.email = ? LIMIT 1`,
        [target, target]
      );
    }
    if(exists.length === 0){
      return res.status(404).json({ error: 'Target tidak terdaftar. Silakan daftar dulu.' });
    }

    /* Buat kode 6 digit, simpan hash, berlaku 3 menit */
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code + target).digest('hex');
    await q(
      `INSERT INTO otp_codes (target, channel, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE))`,
      [target.toLowerCase(), channel, codeHash]
    );

    /* === Kirim OTP lewat channel terpilih. Gagal kirim → error jelas. === */
    const CH_LABEL = { wa: 'WhatsApp', email: 'email', telegram: 'Telegram' };
    let devCode = code;
    let sent = false;
    let warn = null;

    if(channel === 'wa'){
      const r = await sendFonnte(target, `Kode OTP SIKEDA Anda: *${code}* (berlaku 3 menit). Jangan bagikan ke siapa pun.`);
      if(r.ok){ sent = true; devCode = undefined; } else warn = r.err;
      await ensureSendLogA();
      await q('INSERT INTO send_log (pengumuman_id, kanal, tujuan, ok, ket) VALUES (?,?,?,?,?)', [null, 'wa', target, r.ok ? 1 : 0, r.ok ? 'OTP login' : (r.err || null)]).catch(function(){});
    } else if(channel === 'telegram'){
      /* OTP bersifat pribadi → HANYA ke chat id pribadi (numerik), tidak pernah ke channel grup.
         Anggota dapat menemukan chat id-nya via @userinfobot lalu mengisinya saat daftar. */
      const tgt = target.replace(/^@/, '');
      if(/^\d+$/.test(tgt)){
        const r = await sendTelegram(tgt, `<b>Kode OTP SIKEDA Anda:</b> <code>${code}</code> (berlaku 3 menit). Jangan bagikan ke siapa pun.`);
        if(r.ok){ sent = true; devCode = undefined; } else warn = r.err;
        await ensureSendLogA();
        await q('INSERT INTO send_log (pengumuman_id, kanal, tujuan, ok, ket) VALUES (?,?,?,?,?)', [null, 'telegram', tgt, r.ok ? 1 : 0, r.ok ? 'OTP login' : (r.err || null)]).catch(function(){});
      } else {
        warn = 'login Telegram butuh numeric Chat ID pribadi (cek @userinfobot), lalu isi kolom Telegram dengan angka tsb';
        await ensureSendLogA();
        await q('INSERT INTO send_log (pengumuman_id, kanal, tujuan, ok, ket) VALUES (?,?,?,?,?)', [null, 'telegram', target, 0, 'Chat ID belum diisi (numeric diperlukan)']).catch(function(){});
      }
    } else {
      const r = await sendEmail(target, 'Kode OTP SIKEDA', `Kode OTP Anda: ${code} (berlaku 3 menit). Jangan bagikan kode ini ke siapa pun.`);
      if(r.ok){ sent = true; devCode = undefined; } else warn = r.err;
      await ensureSendLogA();
      await q('INSERT INTO send_log (pengumuman_id, kanal, tujuan, ok, ket) VALUES (?,?,?,?,?)', [null, 'email', target, r.ok ? 1 : 0, r.ok ? 'OTP login' : (r.err || null)]).catch(function(){});
    }

    if(!sent && warn){
      /* Gateway belum dikonfigurasi / gagal → jelaskan, tetap sediakan devCode agar demo tidak macet */
      return res.json({
        ok: true,
        message: `Pengiriman via ${CH_LABEL[channel]} belum tersedia (${warn}). Kode ditampilkan sebagai kode dev.`,
        devCode: code,
        gatewayWarn: warn
      });
    }

    res.json({
      ok: true,
      message: `Kode OTP dikirim via ${CH_LABEL[channel]}.`,
      devCode: devCode
    });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal mengirim kode OTP.' });
  }
});

/* ============================================================
   POST /api/auth/otp/verify  { target, code }
   → JWT level anggota
   ============================================================ */
router.post('/otp/verify', async (req, res) => {
  try {
    const target = String(req.body.target || req.body.contact || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    if(!target || code.length !== 6){
      return res.status(400).json({ error: 'Kode tidak lengkap.' });
    }

    const rows = await q(
      `SELECT * FROM otp_codes
       WHERE target = ? AND used = 0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [target]
    );
    const rec = rows[0];
    if(!rec) return res.status(400).json({ error: 'Kode kedaluwarsa atau tidak ada. Kirim ulang.' });

    if(rec.attempts >= 5){
      await q('UPDATE otp_codes SET used = 1 WHERE id = ?', [rec.id]);
      return res.status(429).json({ error: 'Terlalu banyak percobaan. Kirim kode baru.' });
    }

    const codeHash = crypto.createHash('sha256').update(code + target).digest('hex');
    if(codeHash !== rec.code_hash){
      await q('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [rec.id]);
      return res.status(400).json({ error: 'Kode salah.' });
    }

    await q('UPDATE otp_codes SET used = 1 WHERE id = ?', [rec.id]);

    /* Cari user anggota: via users.whatsapp/email atau via anggota */
    let users = await q(
      `SELECT u.* FROM users u
       LEFT JOIN anggota a ON a.id = u.anggota_id
       WHERE u.level = 'anggota' AND (u.whatsapp = ? OR u.email = ? OR a.whatsapp = ? OR a.email = ?)
       LIMIT 1`,
      [target, target, target, target]
    );
    let user = users[0];

    /* Fallback: user anggota belum ada tapi data anggota cocok → buat akun */
    if(!user){
      const ang = await q(
        `SELECT * FROM anggota WHERE (whatsapp = ? OR email = ?) AND status = 'Aktif' LIMIT 1`,
        [target, target]
      );
      if(ang.length){
        const a = ang[0];
        const ins = await q(
          `INSERT INTO users (username, nama, level, email, whatsapp, anggota_id)
           VALUES (?, ?, 'anggota', ?, ?, ?)`,
          ['anggota.' + a.id, a.nama, a.email, a.whatsapp, a.id]
        );
        user = await q('SELECT * FROM users WHERE id = ?', [ins.insertId]).then(r => r[0]);
      }
    }
    if(!user) return res.status(404).json({ error: 'Akun anggota tidak ditemukan.' });
    if(!user.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan.' });

    await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
      [user.id, user.username || ('anggota#' + user.id), 'Login OTP', 'via ' + rec.channel]);

    const token = signToken({ sub: user.id, level: user.level });
    res.json({ ok: true, token, user: await safeUserWithFoto(user) });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Verifikasi gagal.' });
  }
});

/* ============================================================
   POST /api/auth/demo  → login cepat TANPA OTP untuk akun demo.
   Untuk kebutuhan uji/simulasi desain; bisa dimatikan dengan
   env DEMO_LOGIN=off. Tidak pernah berlaku untuk level pengurus.
   ============================================================ */
/* ============================================================
   POST /api/auth/demo  → login cepat TANPA OTP untuk akun demo.
   Daftar akun demo dikelola Superadmin di menu Pengaturan
   (setting `demo_accounts`, dipisah koma; kosong → demo nonaktif).
   Bisa juga dimatikan total lewat env DEMO_LOGIN=off.
   Tidak pernah berlaku untuk level pengurus.
   ============================================================ */
router.post('/demo', async (req, res) => {
  try {
    if(String(process.env.DEMO_LOGIN || '').toLowerCase() === 'off'){
      return res.status(403).json({ error: 'Login demo dinonaktifkan.' });
    }
    /* Saklar master dari menu Pengaturan: 'off' → login demo ditutup total,
       terlepas dari isi daftar demo_accounts. */
    const erows = await q("SELECT nilai FROM settings WHERE kunci = 'demo_enabled' LIMIT 1");
    if(String((erows[0] && erows[0].nilai) || '').trim().toLowerCase() === 'off'){
      return res.status(403).json({ error: 'Login demo sedang dinonaktifkan pengurus.' });
    }
    const srows = await q("SELECT nilai FROM settings WHERE kunci = 'demo_accounts' LIMIT 1");
    const list = String((srows[0] && srows[0].nilai) || 'demo.anggota')
      .split(',').map(s => s.trim()).filter(Boolean);
    if(!list.length){
      return res.status(403).json({ error: 'Login demo sedang dinonaktifkan pengurus.' });
    }
    const want = String((req.body || {}).username || '').trim();
    if(want && !list.includes(want)){
      return res.status(403).json({ error: 'Akun itu tidak terdaftar sebagai akun demo.' });
    }
    const pick = want || list[0];
    const rows = await q(
      `SELECT u.* FROM users u WHERE u.username = ? AND u.level = 'anggota' LIMIT 1`, [pick]);
    const user = rows[0];
    if(!user || !user.is_active){
      return res.status(404).json({ error: 'Akun demo tidak tersedia. Hubungi pengurus.' });
    }
    await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
      [user.id, user.username, 'Login Demo', 'Masuk cepat tanpa OTP (akun demo)']);
    const token = signToken({ sub: user.id, level: user.level });
    res.json({ ok: true, token, user: await safeUserWithFoto(user) });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal masuk dengan akun demo.' });
  }
});

/* ============================================================
   GET /api/auth/demo-list → daftar username demo (publik, untuk
   menampilkan pilihan di halaman login). Kosong → demo nonaktif.
   ============================================================ */
router.get('/demo-list', async (req, res) => {
  try {
    if(String(process.env.DEMO_LOGIN || '').toLowerCase() === 'off') return res.json({ ok: true, accounts: [] });
    /* Hormati saklar master: nonaktif → daftar dikosongkan agar tombol
       Masuk Demo tidak tampil di halaman login. */
    const erows = await q("SELECT nilai FROM settings WHERE kunci = 'demo_enabled' LIMIT 1");
    if(String((erows[0] && erows[0].nilai) || '').trim().toLowerCase() === 'off'){
      return res.json({ ok: true, accounts: [], enabled: false });
    }
    const srows = await q("SELECT nilai FROM settings WHERE kunci = 'demo_accounts' LIMIT 1");
    const list = String((srows[0] && srows[0].nilai) || 'demo.anggota')
      .split(',').map(s => s.trim()).filter(Boolean);
    res.json({ ok: true, accounts: list, enabled: list.length > 0 });
  } catch(e){
    res.json({ ok: true, accounts: [] });
  }
});

/* ============================================================
   POST /api/auth/login  { username, password }  → Admin/Superadmin
   ============================================================ */
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if(!username || !password) return res.status(400).json({ error: 'Lengkapi username & password.' });

    const rows = await q('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    const user = rows[0];
    if(!user || !user.password_hash){
      return res.status(401).json({ error: 'Username atau password salah.' });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if(!ok) return res.status(401).json({ error: 'Username atau password salah.' });
    if(!user.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan.' });
    if(user.level === 'anggota'){
      return res.status(403).json({ error: 'Akun anggota harus login via OTP.' });
    }

    await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
      [user.id, user.username, 'Login panel', 'level ' + user.level]);

    const token = signToken({ sub: user.id, level: user.level });
    res.json({ ok: true, token, user: safeUser(user) });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Login gagal.' });
  }
});

/* ============================================================
   POST /api/auth/forgot  { username }  → kirim tautan reset via email SMTP
   POST /api/auth/reset   { token, password } → pasang password baru
   Tabel password_resets dibuat otomatis di sini (sekali, idempoten).
   ============================================================ */
let resetTableReady = false;
async function ensureResetTable(){
  if(resetTableReady) return;
  await q(`CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(100) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token_hash),
    INDEX idx_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  resetTableReady = true;
}

/* Rate limit sederhana per-username (3 permintaan / 10 menit) */
const forgotHits = new Map();
function forgotRateLimit(req, res, next){
  const key = String(req.body.username || '').trim().toLowerCase();
  const now = Date.now();
  const win = 10 * 60 * 1000;
  const hits = (forgotHits.get(key) || []).filter(t => now - t < win);
  if(hits.length >= 3){
    return res.status(429).json({ error: 'Terlalu banyak permintaan reset. Coba lagi dalam beberapa menit.' });
  }
  hits.push(now);
  forgotHits.set(key, hits);
  next();
}

router.post('/forgot', forgotRateLimit, async (req, res) => {
  try {
    await ensureResetTable();
    const username = String(req.body.username || '').trim();
    if(!username) return res.status(400).json({ error: 'Username wajib diisi.' });

    const rows = await q('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    const user = rows[0];
    /* Respons selalu ok:true agar tidak membocorkan keberadaan username.
       Pesan berbeda hanya bila akun tanpa email / level anggota. */
    if(!user){
      return res.json({ ok: true, message: 'Jika username terdaftar dengan email valid, tautan reset telah dikirim.' });
    }
    if(user.level === 'anggota'){
      return res.json({ ok: true, message: 'Akun anggota masuk via OTP (WhatsApp/Telegram/Email), tidak perlu kata sandi.' });
    }
    if(!user.email){
      return res.status(400).json({ error: 'Akun ini belum memiliki email. Hubungi superadmin untuk reset manual.' });
    }

    /* Matikan token lama yang belum terpakai untuk user ini */
    await q('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [user.id]);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await q(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
      [user.id, tokenHash]
    );

    const base = baseUrl(req);
    const link = base + '/lupa-password.html?token=' + token;
    const nama = user.nama || user.username;
    const txt = 'Halo ' + nama + ',\n\n' +
      'Kami menerima permintaan reset kata sandi akun SIKEDA Anda.\n' +
      'Klik tautan berikut untuk membuat kata sandi baru (berlaku 30 menit):\n\n' +
      link + '\n\n' +
      'Jika Anda tidak meminta reset ini, abaikan email ini — kata sandi Anda tidak berubah.\n\n' +
      'Salam,\nAdmin SIKEDA';
    const html = sikedaEmail('Reset kata sandi',
      '<p style="margin:0 0 8px;font-size:14px;color:#3b475a;line-height:1.6;">Halo <strong>' + nama + '</strong>,</p>' +
      '<p style="margin:0 0 22px;font-size:14px;color:#3b475a;line-height:1.6;">Kami menerima permintaan reset kata sandi akun Anda. Klik tombol di bawah untuk membuat kata sandi baru.</p>' +
      emailButton(link, 'Buat kata sandi baru') +
      '<p style="margin:20px 0 0;font-size:12.5px;color:#7a8598;line-height:1.6;">Tautan berlaku <strong>30 menit</strong> dan hanya bisa dipakai sekali. Bila tombol tidak berfungsi, salin tautan berikut ke browser:</p>' +
      '<p style="margin:8px 0 0;font-size:12px;word-break:break-all;color:#1d3f8f;">' + link + '</p>'
    );
    const r = await sendEmail(user.email, 'Reset Kata Sandi — SIKEDA', txt, html);
    if(!r.ok){
      console.error('[forgot] gagal kirim email:', r.err);
      return res.status(502).json({ error: 'Gagal mengirim email. Pastikan SMTP sudah dikonfigurasi di Pengaturan.' });
    }
    await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
      [user.id, user.username, 'Minta reset kata sandi', 'tautan dikirim ke ' + user.email]);
    return res.json({ ok: true, message: 'Tautan reset telah dikirim ke email terdaftar. Periksa folder spam bila tidak ditemukan.' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal memproses permintaan reset.' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    await ensureResetTable();
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    if(!token) return res.status(400).json({ error: 'Tautan tidak valid.' });
    if(password.length < 8) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await q(
      'SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    const rec = rows[0];
    if(!rec) return res.status(400).json({ error: 'Tautan reset kedaluwarsa atau sudah digunakan.' });

    const urows = await q('SELECT * FROM users WHERE id = ? LIMIT 1', [rec.user_id]);
    const user = urows[0];
    if(!user) return res.status(404).json({ error: 'Akun tidak ditemukan.' });

    const hash = await hashPassword(password);
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    await q('UPDATE password_resets SET used = 1 WHERE id = ?', [rec.id]);
    await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
      [user.id, user.username, 'Reset kata sandi', 'via tautan email']);
    res.json({ ok: true, message: 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal mereset kata sandi.' });
  }
});

/* ============================================================
   GET /api/auth/me — profil sesi aktif
   ============================================================ */
router.get('/me', authRequired, async (req, res) => {
  res.json({ user: safeUser(req.user) });
});

/* ============================================================
   POST /api/auth/logout — catat log (JWT stateless di sisi klien)
   ============================================================ */
/* Perpanjang sesi: terbitkan token baru untuk sesi yang masih valid.
   Dipakai klien untuk refresh otomatis di belakang layar. */
router.post('/refresh', authRequired, async (req, res) => {
  const token = signToken({ sub: req.user.id, level: req.user.level });
  res.json({ ok: true, token, user: safeUser(req.user) });
});

router.post('/logout', authRequired, async (req, res) => {
  await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
    [req.user.id, req.user.username || ('user#' + req.user.id), 'Logout', '-']);
  res.json({ ok: true });
});

function safeUser(u){
  return {
    id: u.id, username: u.username, nama: u.nama, level: u.level,
    email: u.email, whatsapp: u.whatsapp, anggota_id: u.anggota_id
  };
}
/* Varian sesi anggota: sertakan foto profil untuk avatar di header publik.
   Diambil terpisah agar query user tetap ringan. */
async function safeUserWithFoto(u){
  const base = safeUser(u);
  if(u.anggota_id){
    try {
      const r = await q('SELECT foto_path FROM anggota WHERE id = ? LIMIT 1', [u.anggota_id]);
      base.foto_path = (r[0] && r[0].foto_path) || null;
    } catch(e){ base.foto_path = null; }
  }
  return base;
}

module.exports = router;
