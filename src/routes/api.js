/* ============================================================
   SIKEDA — Routes: Registrasi, Anggota, Wilayah, Statistik, dll.
   ============================================================ */
const express = require('express');
const crypto = require('crypto');
const { q, pool } = require('../db');
const { encryptNIK, decryptNIK, maskNIK } = require('../crypto');
const { authRequired, requireRole } = require('../middleware');
const { baseUrl } = require('../baseurl');
const { broadcastPendaftaran, notifStatus } = require('../notify');
const storage = require('../storage');

const router = express.Router();

/* Helper: log aktivitas */
async function logAct(user, aksi, detail){
  await q('INSERT INTO activity_log (user_id, actor, aksi, detail) VALUES (?,?,?,?)',
    [user ? user.id : null, user ? (user.username || user.nama) : 'sistem', aksi, detail || '-']);
}

/* Helper: catat status pengiriman notifikasi per kanal (tabel send_log)
   — dipakai kartu "Status Kirim Notifikasi" di dashboard admin. */
async function sendLog(pengumumanId, kanal, tujuan, ok, ket, createdBy){
  await q('INSERT INTO send_log (pengumuman_id, kanal, tujuan, ok, ket, created_by) VALUES (?,?,?,?,?,?)',
    [pengumumanId || null, String(kanal || ''), String(tujuan || ''), ok ? 1 : 0, String(ket || '').slice(0, 255), createdBy || null]);
}
let sendLogReady = null;
function ensureSendLog(){
  if(!sendLogReady){
    sendLogReady = q(`CREATE TABLE IF NOT EXISTS send_log (
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
  return sendLogReady;
}

/* Helper: format anggota untuk respons */
function rowToMember(r, opts){
  opts = opts || {};
  const showFullNik = !!opts.fullNik;
  const nik = showFullNik ? decryptNIK(r.nik_enc) : null;
  return {
    id: r.id,
    kode_unik: r.kode_unik,
    nama: r.nama,
    nik: showFullNik ? nik : maskNIK(decryptNIK(r.nik_enc)),
    npapg: showFullNik ? nik : null,
    gender: r.gender,
    tempat_lahir: r.tempat_lahir,
    tanggal_lahir: r.tanggal_lahir,
    pekerjaan: r.pekerjaan,
    kecamatan: r.kecamatan,
    desa: r.desa,
    alamat: r.alamat,
    whatsapp: r.whatsapp,
    email: r.email,
    status: r.status,
    jabatan: r.jabatan,
    catatan: r.catatan || null,
    foto_path: r.foto_path || null,
    registered_at: r.registered_at,
    approved_at: r.approved_at
  };
}

/* ============================================================
   POST /api/daftar — pendaftaran publik (tanpa login)
   ============================================================ */
router.post('/daftar', async (req, res) => {
  try {
    const b = req.body || {};
    const required = ['nama','nik','tempat_lahir','tanggal_lahir','gender','pekerjaan','kecamatan','desa','alamat','whatsapp'];
    for(const f of required){
      if(!String(b[f] || '').trim()){
        return res.status(400).json({ error: 'Kolom ' + f + ' wajib diisi.' });
      }
    }
    const nik = String(b.nik).replace(/\D/g,'');
    if(nik.length !== 16) return res.status(400).json({ error: 'NIK harus tepat 16 digit.' });
    const wa = String(b.whatsapp).replace(/\D/g,'');
    if(wa.length < 10) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
    if(!['Laki-laki','Perempuan'].includes(b.gender)) return res.status(400).json({ error: 'Jenis kelamin tidak valid.' });

    /* Wilayah harus valid */
    const wil = await q('SELECT id FROM wilayah WHERE kecamatan = ? AND desa = ?', [b.kecamatan, b.desa]);
    if(wil.length === 0) return res.status(400).json({ error: 'Kombinasi kecamatan/desa tidak dikenal.' });

    /* Duplikasi NIK (via hash) & nomor WA */
    const nikHash = crypto.createHash('sha256').update(nik).digest('hex');
    const dup = await q('SELECT kode_unik, nama, status FROM anggota WHERE nik_hash = ? LIMIT 1', [nikHash]);
    if(dup.length){
      return res.status(409).json({ error: 'NIK sudah terdaftar (' + dup[0].status + ') sebagai ' + dup[0].nama + '.' });
    }
    const dupWa = await q(`SELECT kode_unik FROM anggota WHERE whatsapp = ? AND status IN ('Pending','Aktif','Revisi') LIMIT 1`, [wa]);
    if(dupWa.length){
      return res.status(409).json({ error: 'Nomor WhatsApp sudah dipakai pendaftaran lain.' });
    }

    /* Prefix ID dari settings */
    const pref = await q(`SELECT nilai FROM settings WHERE kunci = 'id_prefix'`).then(r => r[0] ? r[0].nilai : 'GLKR-TA-2026-');
    const kode = pref + 'C' + String(Date.now()).slice(-6);

    let tg = String(b.telegram || '').trim() || null;
    if(tg && !(/^@[A-Za-z0-9_]{4,}$/.test(tg) || /^\d{5,}$/.test(tg))) tg = null;
    await q(
      `INSERT INTO anggota (kode_unik, nama, nik_enc, nik_hash, gender, tempat_lahir, tanggal_lahir,
        pekerjaan, kecamatan, desa, alamat, whatsapp, telegram, email, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending')`,
      [kode, String(b.nama).trim(), encryptNIK(nik), nikHash, b.gender,
       String(b.tempat_lahir).trim(), b.tanggal_lahir, String(b.pekerjaan).trim(),
       b.kecamatan, b.desa, String(b.alamat).trim(), wa, tg, String(b.email || '').trim() || null]
    );

    await logAct(null, 'Pendaftaran baru', kode + ' — ' + String(b.nama).trim());

    /* Broadcast data pendaftaran ke Telegram channel (fire-and-forget) */
    broadcastPendaftaran({
      kode_unik: kode, nama: String(b.nama).trim(), nik: nik, gender: b.gender,
      tempat_lahir: String(b.tempat_lahir || ''), tanggal_lahir: b.tanggal_lahir,
      pekerjaan: String(b.pekerjaan || ''), kecamatan: b.kecamatan, desa: b.desa,
      alamat: String(b.alamat || ''), whatsapp: wa, telegram: tg, email: String(b.email || ''),
      status: 'Pending'
    }).catch(() => {});

    /* Konfirmasi penerimaan ke email pendaftar (fire-and-forget) */
    sendRegConfirmEmail({
      nama: String(b.nama).trim(), kode_unik: kode,
      kecamatan: b.kecamatan, desa: b.desa, email: String(b.email || '').trim() || null
    }, baseUrl(req)).catch(() => {});

    res.status(201).json({ ok: true, kode_unik: kode, message: 'Pendaftaran terkirim. Menunggu verifikasi pengurus.' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Pendaftaran gagal diproses.' });
  }
});

/* ============================================================
   GET /api/wilayah — daftar kecamatan & desa (publik)
   ============================================================ */
router.get('/wilayah', async (req, res) => {
  const rows = await q('SELECT kecamatan, desa FROM wilayah ORDER BY kecamatan, desa');
  const tree = {};
  rows.forEach(r => {
    (tree[r.kecamatan] = tree[r.kecamatan] || []).push(r.desa);
  });
  res.json({ ok: true, data: tree });
});

/* ============================================================
   GET /api/vcard/:kode — data publik-internal vCard
   (butuh login anggota/pengelola; field terkurasi)
   ============================================================ */
router.get('/vcard/:kode', authRequired, async (req, res) => {
  const rows = await q('SELECT * FROM anggota WHERE kode_unik = ? LIMIT 1', [req.params.kode]);
  if(!rows.length) return res.status(404).json({ error: 'Kartu tidak ditemukan.' });
  const r = rows[0];
  /* NPAPG kartu fisik memakai NIK — hanya untuk anggota aktif */
  let nikPlain = null;
  if(r.status === 'Aktif'){
    try { nikPlain = decryptNIK(r.nik_enc); } catch(e){ nikPlain = null; }
  }
  res.json({
    ok: true,
    data: {
      kode_unik: r.kode_unik,
      nama: r.nama,
      foto_path: r.foto_path || null,
      npapg: nikPlain,
      jabatan: r.jabatan,
      kecamatan: r.kecamatan,
      desa: r.desa,
      status: r.status,
      registered_at: r.registered_at,
      gender: r.gender,
      tempat_lahir: r.tempat_lahir,
      tanggal_lahir: r.tanggal_lahir,
      pekerjaan: r.pekerjaan,
      alamat: r.alamat,
      email: r.status === 'Aktif' ? r.email : null,
      telegram: r.status === 'Aktif' ? (r.telegram || null) : null,
      whatsapp: r.status === 'Aktif' ? r.whatsapp : null
    }
  });
});

/* ============ Area di bawah ini butuh login pengelola ============ */
router.use(authRequired);

/* ============================================================
   GET /api/stats — statistik dashboard (admin & superadmin)
   ============================================================ */
router.get('/stats', requireRole('admin','superadmin'), async (req, res) => {
  const [tot, pend, rev, tol, bulan, kec, usia, gender, drafts] = await Promise.all([
    q(`SELECT COUNT(*) n FROM anggota WHERE status='Aktif'`),
    q(`SELECT COUNT(*) n FROM anggota WHERE status='Pending'`),
    q(`SELECT COUNT(*) n FROM anggota WHERE status='Revisi'`),
    q(`SELECT COUNT(*) n FROM anggota WHERE status='Ditolak'`),
    q(`SELECT DATE_FORMAT(registered_at,'%Y-%m') ym, COUNT(*) n FROM anggota
       WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
       GROUP BY ym ORDER BY ym`),
    q(`SELECT kecamatan, COUNT(*) n FROM anggota WHERE status='Aktif' GROUP BY kecamatan ORDER BY kecamatan`),
    q(`SELECT
         SUM(CASE WHEN TIMESTAMPDIFF(YEAR, tanggal_lahir, CURDATE()) < 26 THEN 1 ELSE 0 END) remaja,
         SUM(CASE WHEN TIMESTAMPDIFF(YEAR, tanggal_lahir, CURDATE()) BETWEEN 26 AND 45 THEN 1 ELSE 0 END) dewasa,
         SUM(CASE WHEN TIMESTAMPDIFF(YEAR, tanggal_lahir, CURDATE()) > 45 THEN 1 ELSE 0 END) senior
       FROM anggota WHERE status='Aktif'`),
    q(`SELECT gender, COUNT(*) n FROM anggota WHERE status='Aktif' GROUP BY gender`),
    q(`SELECT COUNT(*) n FROM data_drafts WHERE status='pending'`)
  ]);
  res.json({
    ok: true,
    data: {
      totalAktif: tot[0].n,
      pending: pend[0].n,
      revisi: rev[0].n,
      ditolak: tol[0].n,
      draftPending: drafts[0].n,
      perBulan: bulan,
      perKecamatan: kec,
      demografi: { usia: usia[0], gender }
    }
  });
});

/* ============================================================
   GET /api/members?status=&q=&kecamatan= — daftar anggota/calon
   ============================================================ */
router.get('/members', requireRole('admin','superadmin'), async (req, res) => {
  const { status, q: search, kecamatan } = req.query;
  const conds = []; const params = [];
  if(status && status !== 'Semua'){ conds.push('status = ?'); params.push(status); }
  if(kecamatan && kecamatan !== 'Semua'){ conds.push('kecamatan = ?'); params.push(kecamatan); }
  if(search){
    conds.push('(nama LIKE ? OR kode_unik LIKE ? OR desa LIKE ? OR whatsapp LIKE ?)');
    const like = '%' + search + '%';
    params.push(like, like, like, like);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = await q(`SELECT * FROM anggota ${where} ORDER BY registered_at DESC LIMIT 500`, params);
  const fullNik = req.user.level === 'superadmin';
  res.json({ ok: true, data: rows.map(r => rowToMember(r, { fullNik })) });
});

/* ============================================================
   GET /api/members/check/:kode — cek validitas keanggotaan.
   Tersedia bagi SEMUA pengguna yang sudah masuk (anggota, admin,
   superadmin). Data yang dikembalikan tidak sensitif.
   ============================================================ */
router.get('/members/check/:kode', async (req, res) => {
  try {
    const kode = String(req.params.kode || '').trim().toUpperCase();
    if(!kode || kode.length < 6 || kode.length > 40){
      return res.status(400).json({ error: 'Format ID anggota tidak valid.' });
    }
    const rows = await q(
      'SELECT kode_unik, nama, jabatan, kecamatan, desa, status, foto_path FROM anggota WHERE UPPER(kode_unik) = ? LIMIT 1',
      [kode]
    );
    if(!rows.length) return res.status(404).json({ error: 'ID anggota tidak ditemukan. Periksa penulisan ID.' });
    const r = rows[0];
    await logAct(req.user, 'Cek keanggotaan', r.kode_unik + ' (' + r.nama + ')');
    res.json({ ok: true, data: {
      kode_unik: r.kode_unik,
      nama: r.nama,
      jabatan: r.jabatan || 'Anggota',
      kecamatan: r.kecamatan,
      desa: r.desa,
      status: r.status,
      foto_path: r.foto_path || null,
      valid: r.status === 'Aktif'
    }});
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal memeriksa keanggotaan.' });
  }
});

/* ============================================================
   GET /api/members/:id — detail (NIK penuh hanya superadmin)
   ============================================================ */
router.get('/members/:id', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q('SELECT * FROM anggota WHERE id = ?', [req.params.id]);
  if(!rows.length) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  res.json({ ok: true, data: rowToMember(rows[0], { fullNik: req.user.level === 'superadmin' }) });
});

/* ============================================================
   PATCH /api/members/:id — ubah data anggota (superadmin saja)
   ============================================================ */
router.patch('/members/:id', requireRole('superadmin'), async (req, res) => {
  try {
    const a = await q('SELECT * FROM anggota WHERE id = ? LIMIT 1', [req.params.id]);
    if(!a.length) return res.status(404).json({ error: 'Anggota tidak ditemukan.' });
    const r = a[0];
    const body = req.body || {};
    const upd = {};
    const fieldAllow = ['nama','jabatan','kecamatan','desa','alamat','pekerjaan','gender','tempat_lahir','tanggal_lahir','email','telegram','status','whatsapp'];
    for(const f of fieldAllow){
      if(body[f] !== undefined) upd[f] = body[f];
    }
    if(Object.keys(upd).length === 0) return res.status(400).json({ error: 'Tidak ada data yang diubah.' });
    await q('UPDATE anggota SET ? WHERE id = ?', [upd, req.params.id]);
    await logAct(req.user, 'edit anggota', 'ID ' + r.kode_unik + ' (' + r.nama + ') — ' + Object.keys(upd).join(', '));
    res.json({ ok: true, data: rowToMember({ ...r, ...upd }, { fullNik: true }) });
  } catch(e){ res.status(500).json({ error: e && e.message ? e.message : 'Gagal menyimpan perubahan.' }); }
});

/* Helper: kirim notifikasi approval ke pendaftar via WA (Fonnte) / Telegram / Email.
   Fire-and-forget; gagal kirim hanya tercatat di console. */
async function notifyApplicant(row, status, catatan, opts){
  opts = opts || {};
  try {
    const nama = row.nama;
    const kode = row.kode_unik;
    const judul = status === 'Aktif'
      ? `Selamat, ${nama}! Pendaftaran Anda TERVERIFIKASI ✅`
      : status === 'Revisi'
        ? `Pendaftaran ${kode} perlu REVISI`
        : `Pendaftaran ${kode} DITOLAK`;
    let isi = judul + '\n\n';
    if(status === 'Aktif') isi += `Anda kini resmi menjadi anggota aktif dengan ID ${kode}. Kartu digital & akun login OTP Anda sudah aktif — masuk lewat portal dengan nomor WhatsApp ini.`;
    else if(status === 'Revisi') isi += `Pengurus meminta revisi: ${catatan || '-'}\nSilakan perbaiki lalu daftar ulang melalui portal.`;
    else isi += `Alasan: ${catatan || '-'}\nAnda dapat mendaftar kembali bila memenuhi syarat.`;

    await notifStatus({
      whatsapp: row.whatsapp,
      telegram: row.telegram,
      email: row.email
    }, isi, null, { id: opts.id || row.id || null, createdBy: opts.createdBy || null });
  } catch(e){ console.error('notif applicant:', e.message); }
}

/* Email "Selamat bergabung" untuk anggota baru yang disetujui.
   Fire-and-forget: hanya terkirim bila anggota punya email & SMTP aktif. */
async function sendWelcomeEmail(row, base){
  try {
    if(!row.email) return;
    const { sikedaEmail, emailButton, emailRow } = require('../mailer');
    const { sendEmail } = require('../notify');
    const rows = emailRow('Nama', row.nama)
      + emailRow('ID Anggota', row.kode_unik)
      + emailRow('Jabatan', row.jabatan || 'Anggota')
      + emailRow('Wilayah', (row.kecamatan || '-') + ' / ' + (row.desa || '-'));
    const body =
      '<p style="margin:0 0 8px;font-size:14px;color:#3b475a;line-height:1.6;">Halo <strong>' + row.nama + '</strong>,</p>' +
      '<p style="margin:0 0 18px;font-size:14px;color:#3b475a;line-height:1.6;">Selamat! Pendaftaran Anda telah <strong>terverifikasi</strong> dan Anda kini resmi menjadi anggota aktif DPD Nusantara Bersatu. Berikut data keanggotaan Anda:</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6fa;border-radius:10px;">' +
      '<tr><td style="padding:12px 16px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">' + rows + '</table></td></tr></table>' +
      '<p style="margin:20px 0 18px;font-size:14px;color:#3b475a;line-height:1.6;">Akun login Anda sudah aktif — masuk lewat portal menggunakan kode OTP melalui WhatsApp, Telegram, atau email terdaftar. Kartu digital anggota tersedia setelah masuk.</p>' +
      (base ? emailButton(base + '/login.html', 'Masuk ke Portal Anggota')
            : '<p style="margin:0;font-size:13px;color:#7a8598;">Buka portal SIKEDA untuk masuk.</p>') +
      '<p style="margin:18px 0 0;font-size:12.5px;color:#7a8598;line-height:1.6;">Simpan email ini sebagai bukti keanggotaan. ID Anggota bersifat pribadi — jangan dibagikan.</p>';
    const r = await sendEmail(
      row.email,
      'Selamat Bergabung — Keanggotaan SIKEDA Aktif',
      'Selamat, ' + row.nama + '! Anda resmi menjadi anggota aktif dengan ID ' + row.kode_unik + '.',
      sikedaEmail('Selamat bergabung!', body)
    );
    if(!r.ok) console.error('[welcome] gagal kirim ke ' + row.email + ':', r.err);
  } catch(e){ console.error('[welcome]', e.message); }
}

/* Email konfirmasi bahwa pendaftaran diterima server & menunggu verifikasi.
   Fire-and-forget; hanya terkirim bila pendaftar mengisi email & SMTP aktif. */
async function sendRegConfirmEmail(row, base){
  try {
    if(!row.email) return;
    const { sikedaEmail, emailRow } = require('../mailer');
    const { sendEmail } = require('../notify');
    const rows = emailRow('Nama', row.nama)
      + emailRow('Nomor Pendaftaran', row.kode_unik)
      + emailRow('Wilayah', (row.kecamatan || '-') + ' / ' + (row.desa || '-'))
      + emailRow('Status', 'Menunggu verifikasi pengurus');
    const body =
      '<p style="margin:0 0 8px;font-size:14px;color:#3b475a;line-height:1.6;">Halo <strong>' + row.nama + '</strong>,</p>' +
      '<p style="margin:0 0 18px;font-size:14px;color:#3b475a;line-height:1.6;">Pendaftaran Anda telah <strong>diterima sistem</strong> dan sedang menunggu verifikasi pengurus. Berikut ringkasannya:</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6fa;border-radius:10px;">' +
      '<tr><td style="padding:12px 16px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">' + rows + '</table></td></tr></table>' +
      '<p style="margin:20px 0 0;font-size:14px;color:#3b475a;line-height:1.6;">Anda akan diberi tahu melalui WhatsApp/Telegram/email setelah verifikasi selesai. Nomor pendaftaran bersifat pribadi — jangan dibagikan.</p>' +
      (base ? '<p style="margin:14px 0 0;font-size:12.5px;color:#7a8598;">Cek status pendaftaran kapan saja di <a href="' + base + '/index.html" style="color:#1d3f8f;font-weight:600;">portal SIKEDA</a>.</p>' : '');
    const r = await sendEmail(
      row.email,
      'Pendaftaran Diterima — SIKEDA',
      'Halo ' + row.nama + ', pendaftaran Anda diterima dengan nomor ' + row.kode_unik + ' dan sedang menunggu verifikasi pengurus.',
      sikedaEmail('Pendaftaran diterima', body)
    );
    if(!r.ok) console.error('[reg-confirm] gagal kirim ke ' + row.email + ':', r.err);
  } catch(e){ console.error('[reg-confirm]', e.message); }
}

/* ============================================================
   POST /api/members/:id/approve — setujui calon → terbitkan ID final
   ============================================================ */
router.post('/members/:id/approve', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q(`SELECT * FROM anggota WHERE id = ? AND status = 'Pending'`, [req.params.id]);
  if(!rows.length) return res.status(404).json({ error: 'Pengajuan pending tidak ditemukan.' });

  const pref = await q(`SELECT nilai FROM settings WHERE kunci='id_prefix'`).then(r => r[0] ? r[0].nilai : 'GLKR-TA-2026-');
  const seq = String(await q(`SELECT COUNT(*) n FROM anggota WHERE status='Aktif'`).then(r => r[0].n + 1)).padStart(6,'0');
  const finalKode = pref + seq;

  await q(`UPDATE anggota SET status='Aktif', kode_unik=?, jabatan='Anggota', approved_at=NOW(), approved_by=? WHERE id=?`,
    [finalKode, req.user.id, req.params.id]);

  /* Buatkan akun user anggota agar bisa login OTP */
  const a = rows[0];
  const hasUser = await q('SELECT id FROM users WHERE anggota_id = ? LIMIT 1', [a.id]);
  if(!hasUser.length){
    await q(`INSERT INTO users (username, nama, level, email, whatsapp, anggota_id)
             VALUES (?,?, 'anggota', ?, ?, ?)`,
      ['anggota.' + a.id, a.nama, a.email, a.whatsapp, a.id]);
  }

  await logAct(req.user, 'Approve calon anggota', a.kode_unik + ' → ' + finalKode + ' (' + a.nama + ')');

  /* Notifikasi "Terverifikasi" ke pendaftar (fire-and-forget) */
  notifyApplicant(Object.assign({}, a, { kode_unik: finalKode }), 'Aktif');
  sendWelcomeEmail(Object.assign({}, a, { kode_unik: finalKode }), baseUrl(req)).catch(() => {});

  /* Update status di Telegram channel (fire-and-forget) */
  broadcastPendaftaran(
    Object.assign({}, rowToMember(Object.assign({}, a, { status: 'Aktif' })), { kode_unik: finalKode }),
    '✅ <b>DISETUJUI</b> oleh ' + (req.user.username || 'pengurus') + ' — ID final: <code>' + finalKode + '</code>'
  ).catch(() => {});

  res.json({ ok: true, kode_unik: finalKode, message: 'Disetujui. Kartu digital & akun OTP aktif.' });
});

/* ============================================================
   POST /api/members/:id/reject  { catatan }
   ============================================================ */
router.post('/members/:id/reject', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q(`SELECT * FROM anggota WHERE id = ? AND status IN ('Pending','Revisi')`, [req.params.id]);
  if(!rows.length) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const catatan = String(req.body.catatan || '').trim();
  if(!catatan) return res.status(400).json({ error: 'Alasan penolakan wajib diisi.' });
  await q(`UPDATE anggota SET status='Ditolak', catatan=? WHERE id=?`, [catatan, req.params.id]);
  await logAct(req.user, 'Tolak calon anggota', rows[0].kode_unik + ' — ' + catatan.slice(0,80));

  /* Notifikasi penolakan ke pendaftar (fire-and-forget) */
  notifyApplicant(rows[0], 'Ditolak', catatan);

  /* Update status di Telegram channel (fire-and-forget) */
  broadcastPendaftaran(
    rowToMember(Object.assign({}, rows[0], { status: 'Ditolak' })),
    '❌ <b>DITOLAK</b> — alasan: ' + catatan.slice(0, 120)
  ).catch(() => {});

  res.json({ ok: true, message: 'Ditolak. Pendaftar dinotifikasi.' });
});

/* ============================================================
   POST /api/members/:id/revisi  { catatan }
   ============================================================ */
router.post('/members/:id/revisi', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q(`SELECT * FROM anggota WHERE id = ? AND status IN ('Pending','Revisi')`, [req.params.id]);
  if(!rows.length) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const catatan = String(req.body.catatan || '').trim();
  if(!catatan) return res.status(400).json({ error: 'Catatan revisi wajib diisi.' });
  await q(`UPDATE anggota SET status='Revisi', catatan=? WHERE id=?`, [catatan, req.params.id]);
  await logAct(req.user, 'Minta revisi', rows[0].kode_unik + ' — ' + catatan.slice(0,80));

  /* Notifikasi revisi ke pendaftar (fire-and-forget) */
  notifyApplicant(rows[0], 'Revisi', catatan);
  res.json({ ok: true, message: 'Catatan revisi dikirim ke pendaftar.' });
});

/* ============================================================
   GET /api/activity — log aktivitas (admin: miliknya; super: semua)
   ============================================================ */
/* ============================================================
   GET /sends → status pengiriman notifikasi per kanal (wa/
   telegram/email) dari tabel send_log. Superadmin melihat semua;
   admin non-super hanya log kiriman yang ia terbitkan.
   ============================================================ */
router.get('/sends', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    await ensureSendLog();
    const rows = req.user.level === 'superadmin'
      ? await q('SELECT s.id, s.pengumuman_id, s.kanal, s.tujuan, s.ok, s.ket, s.created_at, p.judul FROM send_log s LEFT JOIN pengumuman p ON p.id = s.pengumuman_id ORDER BY s.id DESC LIMIT ?', [limit])
      : await q('SELECT s.id, s.pengumuman_id, s.kanal, s.tujuan, s.ok, s.ket, s.created_at, p.judul FROM send_log s LEFT JOIN pengumuman p ON p.id = s.pengumuman_id WHERE s.created_by = ? ORDER BY s.id DESC LIMIT ?', [req.user.id, limit]);
    res.json({ ok: true, data: rows });
  } catch(e){ res.status(500).json({ error: 'Gagal memuat status kirim.' }); }
});

/* ============================================================
   POST /sends/retry { id } → kirim ulang SATU pengumuman ke
   kanal yang gagal / belum terkirim (berdasar kolom channels
   pengumuman: "wa:ok + telegram:gagal + email:ok"). Hanya kanal
   dengan hasil gagal yang dikirim ulang; hasil baru menimpa log.
   ============================================================ */
router.post('/sends/retry', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const id = parseInt((req.body || {}).id, 10);
    const rows = await q('SELECT * FROM pengumuman WHERE id = ? LIMIT 1', [id]);
    if(!rows.length) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    const pg = rows[0];
    /* Ambil nama kanal gagal dari kolom channels (diparse aman): "wa:ok + telegram:gagal" */
    const gagal = String(pg.channels || '').split('+').map(s => s.trim())
      .filter(s => /:gagal$/i.test(s))
      .map(s => s.split(':')[0].toLowerCase())
      .filter(s => ['wa','telegram','email'].includes(s));
    if(!gagal.length) return res.status(409).json({ error: 'Tidak ada kanal gagal untuk dikirim ulang.' });
    /* Admin non-super hanya boleh retry pengumuman buatannya sendiri */
    if(req.user.level !== 'superadmin' && pg.created_by !== req.user.id) return res.status(403).json({ error: 'Bukan pengumuman Anda.' });
    const p = { target: pg.target, anggotaId: pg.anggota_id, kategori: pg.kategori, judul: pg.judul, isi: pg.isi, prioritas: pg.prioritas, createdBy: req.user.id, retryOnly: true, baseChannels: pg.channels };
    sendPengumumanChannels(pg.id, p, gagal.join(','));
    await logAct(req.user, 'Kirim ulang pengumuman #' + pg.id, 'kanal: ' + gagal.join(', '));
    res.json({ ok: true, retry: gagal });
  } catch(e){ res.status(500).json({ error: 'Gagal mengirim ulang.' }); }
});

router.get('/activity', requireRole('admin','superadmin'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  let rows;
  if(req.user.level === 'superadmin'){
    rows = await q(`SELECT actor, aksi, detail, created_at FROM activity_log ORDER BY id DESC LIMIT ?`, [limit]);
  } else {
    rows = await q(`SELECT actor, aksi, detail, created_at FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
      [req.user.id, limit]);
  }
  res.json({ ok: true, data: rows });
});

/* ============================================================
   GET /api/settings / PUT /api/settings (superadmin)
   ============================================================ */
router.get('/settings', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q('SELECT kunci, nilai FROM settings');
  const obj = {};
  rows.forEach(r => obj[r.kunci] = r.nilai);
  /* Superadmin: key API disamarkan sebagian; logo berupa path relatif (bukan data sensitif) */
  if(req.user.level !== 'superadmin' && obj.fonnte_api_key){
    obj.fonnte_api_key = '••••••••' + obj.fonnte_api_key.slice(-4);
  }
  res.json({ ok: true, data: obj, canEdit: req.user.level === 'superadmin' });
});
router.put('/settings', requireRole('superadmin'), async (req, res) => {
  const entries = Object.entries(req.body || {});
  for(const [k,v] of entries){
    /* Nilai disamarkan (••••1234) dikirim balik tak diubah → abaikan, jangan menimup key asli */
    if(k === 'fonnte_api_key' && /••••/.test(String(v))) continue;
    /* Prefix kode pendaftaran: divalidasi agar generator ID tetap sehat */
    if(k === 'id_prefix'){
      const pv = String(v || '').trim();
      if(!pv) return res.status(400).json({ error: 'Prefix kode pendaftaran tidak boleh kosong.' });
      if(!/^[A-Za-z0-9-]{3,30}$/.test(pv)) return res.status(400).json({ error: 'Prefix hanya boleh huruf, angka, dan tanda hubung (3–30 karakter).' });
      await q(`INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, ['id_prefix', pv]);
      continue;
    }
    await q(`INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
      [String(k).slice(0, 60), String(v).slice(0, 255)]);
  }
  await logAct(req.user, 'Ubah pengaturan', entries.map(e => e[0]).join(', '));
  res.json({ ok: true });
});

/* ============================================================
   PUT /api/members/:id — edit data anggota (superadmin saja)
   Body: field yang boleh diubah (semua opsional)
   ============================================================ */
router.put('/members/:id', requireRole('superadmin'), async (req, res) => {
  const rows = await q('SELECT * FROM anggota WHERE id = ?', [req.params.id]);
  if(!rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan.' });
  const a = rows[0];
  const b = req.body || {};

  const set = [], params = [];
  function setField(col, val){ set.push(col + ' = ?'); params.push(val); }

  if(b.nama !== undefined){
    const v = String(b.nama).trim();
    if(v.length < 3) return res.status(400).json({ error: 'Nama minimal 3 karakter.' });
    setField('nama', v);
  }
  if(b.nik !== undefined){
    const nik = String(b.nik).replace(/\D/g, '');
    if(nik.length !== 16) return res.status(400).json({ error: 'NIK harus tepat 16 digit.' });
    const nikHash = crypto.createHash('sha256').update(nik).digest('hex');
    if(nikHash !== a.nik_hash){
      const dup = await q('SELECT kode_unik FROM anggota WHERE nik_hash = ? AND id != ? LIMIT 1', [nikHash, a.id]);
      if(dup.length) return res.status(409).json({ error: 'NIK sudah dipakai anggota lain (' + dup[0].kode_unik + ').' });
    }
    setField('nik_enc', encryptNIK(nik));
    setField('nik_hash', nikHash);
  }
  if(b.gender !== undefined){
    if(!['Laki-laki','Perempuan'].includes(b.gender)) return res.status(400).json({ error: 'Jenis kelamin tidak valid.' });
    setField('gender', b.gender);
  }
  if(b.tempat_lahir !== undefined) setField('tempat_lahir', String(b.tempat_lahir).trim());
  if(b.tanggal_lahir !== undefined) setField('tanggal_lahir', b.tanggal_lahir || null);
  if(b.pekerjaan !== undefined) setField('pekerjaan', String(b.pekerjaan).trim());
  if(b.kecamatan !== undefined || b.desa !== undefined){
    const kec = b.kecamatan !== undefined ? String(b.kecamatan).trim() : a.kecamatan;
    const desa = b.desa !== undefined ? String(b.desa).trim() : a.desa;
    const wil = await q('SELECT id FROM wilayah WHERE kecamatan = ? AND desa = ?', [kec, desa]);
    if(!wil.length) return res.status(400).json({ error: 'Kombinasi kecamatan/desa tidak dikenal.' });
    setField('kecamatan', kec); setField('desa', desa);
  }
  if(b.alamat !== undefined) setField('alamat', String(b.alamat).trim());
  if(b.whatsapp !== undefined){
    const wa = String(b.whatsapp).trim();
    if(wa.replace(/\D/g,'').length < 10) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
    if(wa !== a.whatsapp){
      const dupWa = await q(`SELECT kode_unik FROM anggota WHERE whatsapp = ? AND id != ? AND status IN ('Pending','Aktif','Revisi') LIMIT 1`, [wa, a.id]);
      if(dupWa.length) return res.status(409).json({ error: 'WhatsApp sudah dipakai (' + dupWa[0].kode_unik + ').' });
    }
    setField('whatsapp', wa);
    const u = await q('SELECT id FROM users WHERE anggota_id = ? LIMIT 1', [a.id]);
    if(u.length) await q('UPDATE users SET whatsapp = ? WHERE id = ?', [wa, u[0].id]);
  }
  if(b.telegram !== undefined){
    let tg = String(b.telegram).trim() || null;
    if(tg && !(/^@[A-Za-z0-9_]{4,}$/.test(tg) || /^\d{5,}$/.test(tg))) return res.status(400).json({ error: 'Format Telegram tidak valid.' });
    setField('telegram', tg);
    const u2 = await q('SELECT id FROM users WHERE anggota_id = ? LIMIT 1', [a.id]);
    if(u2.length) await q('UPDATE users SET telegram = ? WHERE id = ?', [tg, u2[0].id]);
  }
  if(b.email !== undefined){
    const em = String(b.email).trim() || null;
    if(em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ error: 'Format email tidak valid.' });
    setField('email', em);
    const u3 = await q('SELECT id FROM users WHERE anggota_id = ? LIMIT 1', [a.id]);
    if(u3.length) await q('UPDATE users SET email = ? WHERE id = ?', [em, u3[0].id]);
  }
  if(b.jabatan !== undefined) setField('jabatan', String(b.jabatan).trim() || 'Anggota');
  if(b.status !== undefined){
    if(!['Pending','Revisi','Ditolak','Aktif'].includes(b.status)) return res.status(400).json({ error: 'Status tidak valid.' });
    setField('status', b.status);
  }
  if(b.catatan !== undefined) setField('catatan', String(b.catatan).trim() || null);

  if(!set.length) return res.status(400).json({ error: 'Tidak ada perubahan yang dikirim.' });
  params.push(a.id);
  await q('UPDATE anggota SET ' + set.join(', ') + ' WHERE id = ?', params);

  const changed = Object.keys(b).filter(k => b[k] !== undefined).join(', ');
  await logAct(req.user, 'Edit anggota ' + a.kode_unik, changed);
  const fresh = await q('SELECT * FROM anggota WHERE id = ?', [a.id]);
  res.json({ ok: true, message: 'Data anggota diperbarui.', data: rowToMember(fresh[0], { fullNik: true }) });
});

/* ============================================================
   POST /api/members/:id/photo — upload / hapus foto profil anggota (superadmin)
   Body: { dataUrl: 'data:image/…;base64,…' }  atau  { remove: true }
   Foto otomatis di-crop & dinormalisasi ke rasio slot kartu KTA
   (3:4 portrait, 720×960) — lihat src/photo.js.
   ============================================================ */
router.post('/members/:id/photo', requireRole('superadmin'), async (req, res) => {
  try {
    const rows = await q('SELECT id, kode_unik, foto_path FROM anggota WHERE id = ? LIMIT 1', [req.params.id]);
    if(!rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan.' });
    const a = rows[0];
    const { normalizePhoto } = require('../photo');
    const fs = require('fs');
    const path = require('path');
    const dir = require('../uploads-path').uploadsRoot(); /* Vercel: /tmp (UPLOADS_DIR) */

    const delOld = () => {
      if(a.foto_path){
        const oldPath = path.join(require('../uploads-path').uploadsRoot(), '..', a.foto_path.replace(/^\/+/, ''));
        if(oldPath.startsWith(dir) && fs.existsSync(oldPath)){ try { fs.unlinkSync(oldPath); } catch(e){} }
      }
    };

    /* Hapus foto */
    if(req.body && req.body.remove === true){
      delOld();
      await q('UPDATE anggota SET foto_path = NULL WHERE id = ?', [a.id]);
      await logAct(req.user, 'Hapus foto anggota', a.kode_unik);
      return res.json({ ok: true, path: null, message: 'Foto profil dihapus.' });
    }

    /* Simpan foto baru — dinormalisasi dulu ke rasio slot kartu (3:4) */
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(String((req.body || {}).dataUrl || ''));
    if(!m) return res.status(400).json({ error: 'Format gambar tidak didukung (PNG/JPG/WEBP).' });
    const mimeIn = 'image/' + (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase());
    const raw = Buffer.from(m[2], 'base64');
    if(raw.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran foto maksimal 2 MB.' });
    if(raw.length < 64) return res.status(400).json({ error: 'Berkas gambar tidak valid.' });

    let buf, ext;
    try {
      ({ buffer: buf, ext } = await normalizePhoto(raw, mimeIn));
    } catch(e){
      console.warn('photo normalize gagal, simpan apa adanya:', e.message);
      buf = raw; ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    }

    fs.mkdirSync(dir, { recursive: true });
    delOld();
    const fname = 'photo-' + a.id + '-' + Date.now() + '.' + ext;
    fs.writeFileSync(path.join(dir, fname), buf);
    /* Mirror opsional ke penyimpanan remote (CDN/Cloudinary/Supabase/Drive) — best effort */
    storage.writeFile('uploads/' + fname, buf).catch(function(){});
    const rel = 'uploads/' + fname;
    await q('UPDATE anggota SET foto_path = ? WHERE id = ?', [rel, a.id]);
    await logAct(req.user, 'Upload foto anggota', a.kode_unik + ' → ' + rel + ' (720×960)');
    res.json({ ok: true, path: rel, message: 'Foto profil diperbarui — otomatis dipotong ke rasio kartu (3:4).' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan foto.' });
  }
});

/* ============================================================
   POST /api/members/import — import massal dari template Excel (superadmin)
   Body: { rows: [ { nama, nik, gender, tempat_lahir, tanggal_lahir, pekerjaan,
                     kecamatan, desa, alamat, whatsapp, telegram, email } ] }
   ============================================================ */
router.post('/members/import', requireRole('superadmin'), async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 500) : [];
  if(!rows.length) return res.status(400).json({ error: 'Tidak ada baris untuk diimport.' });

  const pref = await q(`SELECT nilai FROM settings WHERE kunci='id_prefix'`).then(r => r[0] ? r[0].nilai : 'GLKR-TA-2026-');
  const wil = await q('SELECT kecamatan, desa FROM wilayah');
  const wilSet = new Set(wil.map(w2 => w2.kecamatan + '|' + w2.desa));

  const ok = [], gagal = [];
  for(const [idx, r] of rows.entries()){
    const no = idx + 2; /* +2: baris excel (1 header, data mulai 2) */
    const nama = String(r.nama || '').trim();
    const nik = String(r.nik || '').replace(/\D/g, '');
    const wa = String(r.whatsapp || '').trim();
    const gender = r.gender === 'Perempuan' ? 'Perempuan' : (r.gender === 'Laki-laki' ? 'Laki-laki' : '');
    const kec = String(r.kecamatan || '').trim(), desa = String(r.desa || '').trim();

    const err = !nama ? 'nama kosong'
      : nik.length !== 16 ? 'NIK harus 16 digit'
      : !gender ? 'gender harus "Laki-laki" atau "Perempuan"'
      : !wilSet.has(kec + '|' + desa) ? 'kecamatan/desa tidak dikenal'
      : wa.replace(/\D/g,'').length < 10 ? 'nomor WhatsApp tidak valid' : null;
    if(err){ gagal.push({ baris: no, nama: nama || '(kosong)', alasan: err }); continue; }

    const nikHash = crypto.createHash('sha256').update(nik).digest('hex');
    const dup = await q('SELECT kode_unik FROM anggota WHERE nik_hash = ? LIMIT 1', [nikHash]);
    if(dup.length){ gagal.push({ baris: no, nama, alasan: 'NIK sudah terdaftar (' + dup[0].kode_unik + ')' }); continue; }
    const dupWa2 = await q(`SELECT kode_unik FROM anggota WHERE whatsapp = ? AND status IN ('Pending','Aktif','Revisi') LIMIT 1`, [wa]);
    if(dupWa2.length){ gagal.push({ baris: no, nama, alasan: 'WhatsApp sudah dipakai (' + dupWa2[0].kode_unik + ')' }); continue; }

    const kode = pref + 'C' + String(Date.now()).slice(-6) + String(idx);
    await q(
      `INSERT INTO anggota (kode_unik, nama, nik_enc, nik_hash, gender, tempat_lahir, tanggal_lahir,
        pekerjaan, kecamatan, desa, alamat, whatsapp, telegram, email, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending')`,
      [kode, nama, encryptNIK(nik), nikHash, gender, String(r.tempat_lahir || '').trim(),
       r.tanggal_lahir || null, String(r.pekerjaan || '').trim(), kec, desa,
       String(r.alamat || '').trim(), wa, String(r.telegram || '').trim() || null, String(r.email || '').trim() || null]
    );
    ok.push({ baris: no, nama, kode_unik: kode });

    broadcastPendaftaran({
      kode_unik: kode, nama, nik, gender, tempat_lahir: String(r.tempat_lahir || ''),
      tanggal_lahir: r.tanggal_lahir, pekerjaan: String(r.pekerjaan || ''),
      kecamatan: kec, desa, alamat: String(r.alamat || ''), whatsapp: wa,
      telegram: String(r.telegram || ''), email: String(r.email || ''), status: 'Pending'
    }, '📥 <b>IMPORT EXCEL</b> oleh ' + (req.user.username || 'pengurus')).catch(() => {});
  }

  await logAct(req.user, 'Import anggota', ok.length + ' berhasil, ' + gagal.length + ' gagal');
  res.json({ ok: true, inserted: ok.length, failed: gagal.length,
    details: gagal.slice(0, 50), data: ok });
});

/* ============================================================
   POST /api/settings/telegram-test — kirim pesan uji ke channel (superadmin)
   ============================================================ */
router.post('/settings/telegram-test', requireRole('superadmin'), async (req, res) => {
  const { sendTelegramChannel } = require('../notify');
  const r = await sendTelegramChannel(
    '<b>✅ Uji koneksi SIKEDA</b>\nBot berhasil terhubung ke channel ini. Data pendaftaran anggota akan dikirim ke sini.'
  );
  await logAct(req.user, 'Uji gateway Telegram', r.ok ? 'BERHASIL ke channel' : ('GAGAL — ' + (r.err || 'tidak diketahui')));
  if(r.ok) return res.json({ ok: true, detail: 'Konfigurasi benar.' });
  res.status(400).json({ ok: false, error: r.err || 'Gagal mengirim pesan uji.' });
});

/* ============================================================
   POST /api/settings/wa-test — uji kirim WhatsApp via Fonnte (superadmin)
   Body: { target: '08xxx' } — pesan uji ke nomor tujuan yang diisi
   ============================================================ */
router.post('/settings/wa-test', requireRole('superadmin'), async (req, res) => {
  const { sendFonnte } = require('../notify');
  const to = String(req.body.target || '').replace(/\D/g, '');
  if(to.length < 9 || to.length > 15){
    return res.status(400).json({ ok: false, error: 'Nomor WhatsApp tujuan tidak valid (contoh: 081234567890).' });
  }
  const r = await sendFonnte(to, '✅ Uji koneksi SIKEDA\nWhatsApp gateway (Fonnte) berfungsi. OTP & pemberitahuan akan dikirim melalui kanal ini.');
  await logAct(req.user, 'Uji gateway WhatsApp', (r.ok ? 'BERHASIL' : 'GAGAL') + ' → +' + to.replace(/^0/, '62') + (r.ok ? '' : ' — ' + (r.err || 'tidak diketahui')));
  if(r.ok) return res.json({ ok: true, detail: 'Terkirim ke +' + to.replace(/^0/, '62') });
  res.status(400).json({ ok: false, error: r.err || 'Gagal mengirim pesan uji.' });
});

/* ============================================================
   POST /api/settings/smtp-test — uji kirim email via SMTP (superadmin)
   Body: { to: 'nama@domain.com' }
   ============================================================ */
router.post('/settings/smtp-test', requireRole('superadmin'), async (req, res) => {
  const { sendEmail } = require('../notify');
  const to = String(req.body.to || '').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){
    return res.status(400).json({ ok: false, error: 'Alamat email tujuan tidak valid.' });
  }
  const r = await sendEmail(to, 'Uji koneksi SMTP — SIKEDA',
    'Uji koneksi SIKEDA. Konfigurasi SMTP benar — OTP & pemberitahuan email akan dikirim dari kanal ini.',
    '<div style="font-family:Arial,sans-serif;padding:24px;background:#f6f8fb;"><div style="max-width:520px;margin:auto;background:#fff;border-radius:14px;padding:26px;border:1px solid #e4e9f2;"><h2 style="color:#0f1a2e;margin:0 0 10px;">✅ Uji koneksi SIKEDA</h2><p style="color:#42506a;line-height:1.6;">Konfigurasi SMTP <b>berfungsi</b>. OTP &amp; pemberitahuan email akan dikirim dari kanal ini.</p></div></div>');
  await logAct(req.user, 'Uji gateway SMTP', (r.ok ? 'BERHASIL' : 'GAGAL') + ' → ' + to + (r.ok ? '' : ' — ' + (r.err || 'tidak diketahui')));
  if(r.ok) return res.json({ ok: true, detail: 'Terkirim ke ' + to });
  res.status(400).json({ ok: false, error: r.err || 'Gagal mengirim email uji.' });
});

/* ============================================================
   GET /api/settings/gateway-status — hasil percobaan kirim terakhir
   per kanal (untuk indikator status di Pengaturan)
   ============================================================ */
router.get('/settings/gateway-status', requireRole('superadmin'), async (req, res) => {
  const { gwStatus } = require('../notify');
  res.json({ ok: true, data: gwStatus() });
});

/* ============================================================
   POST /api/settings/otp-test — uji ALUR PENUH OTP (superadmin)
   Body: { target, channel: 'wa'|'email'|'telegram' }
   Menerbitkan OTP sungguhan (tanpa perlu akun terdaftar, tanpa rate
   limit), dikirim via gateway — penerima memverifikasinya di halaman
   login seperti anggota biasa. Kode tidak pernah dikirim balik ke UI.
   ============================================================ */
router.post('/settings/otp-test', requireRole('superadmin'), async (req, res) => {
  const target = String(req.body.target || '').trim();
  const channel = ['wa', 'email', 'telegram'].includes(req.body.channel) ? req.body.channel : 'wa';
  if(!target) return res.status(400).json({ ok: false, error: 'Target wajib diisi.' });
  if(channel === 'wa' && target.replace(/\D/g, '').length < 10) return res.status(400).json({ ok: false, error: 'Nomor WhatsApp tidak valid.' });
  if(channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return res.status(400).json({ ok: false, error: 'Format email tidak valid.' });
  if(channel === 'telegram' && !(/^@[A-Za-z0-9_]{4,}$/.test(target) || /^\d{5,}$/.test(target))) return res.status(400).json({ ok: false, error: 'Target Telegram tidak valid (chat ID angka atau @username).' });

  const crypto = require('crypto');
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = crypto.createHash('sha256').update(code + target).digest('hex');
  await q(
    `INSERT INTO otp_codes (target, channel, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE))`,
    [target.toLowerCase(), channel, codeHash]
  );

  const CH_LABEL = { wa: 'WhatsApp', email: 'email', telegram: 'Telegram' };
  let sent = false, warn = null;
  if(channel === 'wa'){
    const { sendFonnte } = require('../notify');
    const r = await sendFonnte(target, 'Uji OTP SIKEDA (alur penuh). Kode Anda: *' + code + '* (berlaku 3 menit).');
    sent = r.ok; warn = r.err;
  } else if(channel === 'telegram'){
    const { sendTelegram } = require('../notify');
    const tgt = target.replace(/^@/, '');
    if(/^\d+$/.test(tgt)){
      const r = await sendTelegram(tgt, '<b>Uji OTP SIKEDA (alur penuh)</b> — kode: <code>' + code + '</code> (berlaku 3 menit).');
      sent = r.ok; warn = r.err;
    } else warn = 'butuh numeric Chat ID pribadi (cek @userinfobot)';
  } else {
    const { sendEmail } = require('../notify');
    const r = await sendEmail(target, 'Uji OTP SIKEDA (alur penuh)', 'Kode uji OTP Anda: ' + code + ' (berlaku 3 menit). Jangan bagikan kode ini.');
    sent = r.ok; warn = r.err;
  }

  const tujuan = channel === 'wa' ? '+' + target.replace(/\D/g, '').replace(/^0/, '62') : target;
  await logAct(req.user, 'Uji OTP alur penuh', (sent ? 'TERKIRIM' : 'GAGAL') + ' via ' + CH_LABEL[channel] + ' → ' + tujuan + (sent ? '' : ' — ' + (warn || 'tidak diketahui')));
  if(!sent) return res.status(400).json({ ok: false, error: 'Gagal mengirim OTP via ' + CH_LABEL[channel] + ': ' + (warn || 'gateway bermasalah.') });
  res.json({ ok: true, detail: 'OTP terkirim via ' + CH_LABEL[channel] + ' ke ' + tujuan + '. Verifikasi di halaman login seperti anggota biasa.' });
});

/* ============================================================
   POST /api/settings/logo { kind: 'dashboard'|'landing', dataUrl }
   → simpan berkas di /public/uploads, path-nya ke settings
   ============================================================ */
router.post('/settings/logo', requireRole('superadmin'), async (req, res) => {
  try {
    const kind = ['landing', 'dashboard', 'hero', 'favicon'].includes(req.body.kind) ? req.body.kind : 'dashboard';
    const key = kind === 'hero' ? 'hero_bg' : (kind === 'favicon' ? 'favicon' : 'logo_' + kind);
    const m = /^data:image\/(png|jpe?g|svg\+xml|webp);base64,(.+)$/i.exec(String(req.body.dataUrl || ''));
    if(!m) return res.status(400).json({ error: 'Format gambar tidak didukung (PNG/JPG/WEBP/SVG).' });
    const ext = m[1].toLowerCase() === 'svg+xml' ? 'svg' : (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase());
    const buf = Buffer.from(m[2], 'base64');
    if(buf.length > 512 * 1024) return res.status(400).json({ error: 'Ukuran maksimal 512 KB.' });
    if(ext !== 'svg' && buf.length < 64) return res.status(400).json({ error: 'Berkas gambar tidak valid.' });

    const fs = require('fs');
    const path = require('path');
    const dir = require('../uploads-path').uploadsRoot(); /* Vercel: /tmp (UPLOADS_DIR) */
    fs.mkdirSync(dir, { recursive: true });

    /* Hapus berkas lama agar uploads tidak menumpuk */
    const prev = await q('SELECT nilai FROM settings WHERE kunci = ?', [key]);
    if(prev[0] && prev[0].nilai){
      const oldPath = path.join(require('../uploads-path').uploadsRoot(), '..', prev[0].nilai.replace(/^\/+/, ''));
      if(oldPath.startsWith(dir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const fname = 'logo-' + kind + '-' + Date.now() + '.' + ext;
    fs.writeFileSync(path.join(dir, fname), buf);
    /* Mirror opsional ke penyimpanan remote (CDN/Cloudinary/Supabase/Drive) — best effort */
    storage.writeFile('uploads/' + fname, buf).catch(function(){});
    const rel = 'uploads/' + fname;
    await q('INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)',
      [key, rel]);
    await logAct(req.user, 'Unggah ' + (kind === 'hero' ? 'background hero' : 'logo ' + kind), rel);
    res.json({ ok: true, path: rel });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan logo.' });
  }
});

/* ============================================================
   GET /api/content — konten situs + skema untuk editor dashboard
   ============================================================ */
const F = (key, label, type, ph) => ({ key, label, type: type || 'text', ph: ph || '' });
function repItems(prefix, n, labels, fields) {
  const out = [];
  for(let i = 1; i <= n; i++) out.push({ label: (labels || ('Item ' + i)) + ' ' + i, fields: fields.map(f => F(prefix + i + f.suf, f.label, f.type)) });
  return out;
}
const SITE_SCHEMA = [
  { id:'header', page:'home', title:'Header & Navigasi', groups:[
    { label:'Brand (header & footer)', fields:[
      F('site.header_brand_name','Nama brand','text','SIKEDA'),
      F('site.header_brand_sub','Sub-judul brand','text','DPD Nusantara Bersatu · Kab. Tulungagung')
    ]},
    { label:'Menu navigasi', fields:[
      F('site.header_nav1','Menu 1','text','Beranda'),
      F('site.header_nav2','Menu 2','text','Alur'),
      F('site.header_nav3','Menu 3','text','Kartu Anggota'),
      F('site.header_nav4','Menu 4','text','FAQ'),
      F('site.header_cta','Label tombol Masuk','text','Masuk')
    ]},
    { label:'Logo & favicon', fields:[
      F('site.logo_header','Logo header website (mengganti ikon perisai)','image'),
      F('site.favicon','Favicon — ikon tab browser (PNG persegi)','image')
    ]}
  ]},
  { id:'hero', page:'home', title:'Hero — Sambutan Atas', groups:[
    { label:'Teks utama', fields:[
      F('site.hero_kicker','Label kecil atas','text','Portal keanggotaan resmi'),
      F('site.hero_title','Judul utama','area','Satu data anggota, terkelola rapi…'),
      F('site.hero_lead','Paragraf deskripsi','area','Daftar lewat formulir publik…')
    ]},
    { label:'Tombol', fields:[
      F('site.hero_btn1','Tombol utama','text','Daftar Jadi Anggota'),
      F('site.hero_btn2','Tombol kedua','text','Sudah punya akun? Masuk')
    ]},
    { label:'Poin keunggulan (3 badge)', fields:[
      F('site.hero_badge1','Poin 1','text','NIK disimpan terenkripsi'),
      F('site.hero_badge2','Poin 2','text','Sesi login terlindungi'),
      F('site.hero_badge3','Poin 3','text','Audit log penuh')
    ]},
    { label:'Gambar latar (opsional)', fields:[ F('site.hero_bg','Foto latar hero','image') ]}
  ]},
  { id:'stat', page:'home', title:'Strip Statistik', groups:[
    { label:'Label angka (angka otomatis dari database)', fields:[
      F('site.stat1_label','Label 1','text','anggota terverifikasi'),
      F('site.stat2_label','Label 2','text','kecamatan tercakup'),
      F('site.stat3_label','Label 3','text','ranting terdaftar'),
      F('site.stat4_label','Label 4','text','kelengkapan data')
    ]}
  ]},
  { id:'fitur', page:'home', title:'Section Keunggulan', groups:[
    { label:'Judul section', fields:[
      F('site.fitur_kicker','Label kecil','text','Kenapa SIKEDA'),
      F('site.fitur_title','Judul','area','Dibangun untuk pengurus yang serius…'),
      F('site.fitur_lead','Paragraf','area','Bukan sekadar formulir online…')
    ]},
    ...repItems('site.fitur', 6, 'Kartu', [
      { suf:'_title', label:'Judul', type:'text' },
      { suf:'_text', label:'Deskripsi', type:'area' }
    ])
  ]},
  { id:'alur', page:'home', title:'Section Alur Keanggotaan', groups:[
    { label:'Judul section', fields:[
      F('site.alur_kicker','Label kecil','text','Alur keanggotaan'),
      F('site.alur_title','Judul','area','Empat langkah, nol drama.'),
      F('site.alur_lead','Paragraf','area','Proses transparan dari pengajuan…'),
      F('site.alur_btn','Label tombol','text','Mulai pendaftaran')
    ]},
    ...repItems('site.alur', 4, 'Langkah', [
      { suf:'_title', label:'Judul', type:'text' },
      { suf:'_text', label:'Deskripsi', type:'area' }
    ])
  ]},
  { id:'kartu', page:'home', title:'Section Kartu & vCard', groups:[
    { label:'Judul section', fields:[
      F('site.kartu_kicker','Label kecil','text','Kartu anggota'),
      F('site.kartu_title','Judul','area','Satu identitas digital…')
    ]},
    ...repItems('site.kartu', 3, 'Poin', [
      { suf:'_title', label:'Judul', type:'text' },
      { suf:'_text', label:'Deskripsi', type:'area' }
    ]),
    { label:'Kartu contoh (kiri)', fields:[
      F('site.kartu_card_title','Judul kartu','text','Halaman vCard anggota'),
      F('site.kartu_url_sub','Sub-judul URL di bawah judul kartu','text','sikeda.id/kta/{id-unik}'),
      F('site.kartu_card_text','Deskripsi kartu','area','Setiap kartu punya halaman profil…'),
      F('site.kartu_btn','Label tombol','text','Lihat contoh vCard')
    ]}
  ]},
  { id:'testi', page:'home', title:'Section Kata Pengurus', groups:[
    { label:'Judul section', fields:[
      F('site.testi_kicker','Label kecil','text','Kata pengurus'),
      F('site.testi_title','Judul','area','Dipercaya di lapangan.')
    ]},
    ...repItems('site.testi', 3, 'Testimoni', [
      { suf:'_quote', label:'Kutipan', type:'area' },
      { suf:'_name', label:'Nama', type:'text' },
      { suf:'_role', label:'Jabatan', type:'text' },
      { suf:'_photo', label:'Foto (mengganti inisial)', type:'image' }
    ])
  ]},
  { id:'faq', page:'home', title:'Section FAQ', groups:[
    { label:'Judul section', fields:[
      F('site.faq_kicker','Label kecil','text','Pertanyaan umum'),
      F('site.faq_title','Judul','area','Mungkin ini yang Anda tanyakan.')
    ]},
    ...repItems('site.faq', 4, 'Pertanyaan', [
      { suf:'_q', label:'Pertanyaan', type:'text' },
      { suf:'_a', label:'Jawaban', type:'area' }
    ])
  ]},
  { id:'cta', page:'home', title:'Ajakan Penutup (CTA)', groups:[
    { label:'Teks & tombol', fields:[
      F('site.cta_title','Judul CTA','area','Siap jadi bagian dari kami?'),
      F('site.cta_lead','Deskripsi CTA','area','Proses pendaftaran kurang dari 10 menit.'),
      F('site.cta_btn1','Tombol utama','text','Daftar Sekarang'),
      F('site.cta_btn2','Tombol kedua','text','Masuk')
    ]}
  ]},
  { id:'footer', page:'home', title:'Footer', groups:[
    { label:'Teks footer', fields:[
      F('site.footer_about','Tentang organisasi','area','Sistem pendataan keanggotaan…'),
      F('site.footer_contact','Kontak / alamat','text','Tulungagung · sekretariat@example.org'),
      F('site.footer_bottom','Baris hak cipta','text','© 2026 DPD Nusantara Bersatu — Kab. Tulungagung'),
      F('site.footer_secure','Teks keamanan di baris paling bawah footer','text','Data kependudukan disimpan terenkripsi sesuai ketentuan yang berlaku')
    ]},
    { label:'Halaman bantuan (footer)', fields:[
      F('site.footer_brand','Nama organisasi (halaman keluar)','text','DPD Nusantara Bersatu — Kab. Tulungagung')
    ]}
  ]},
  { id:'helpverify', page:'pages', title:'Halaman Cara Verifikasi Kartu', groups:[
    { label:'Konten halaman', fields:[
      F('site.help_verify_title','Judul halaman','text','Cara Verifikasi Kartu Anggota'),
      F('site.help_verify_body','Isi halaman (satu langkah per baris)','area','1. Buka halaman vCard anggota…\n2. …')
    ]}
  ]},
  { id:'helpprivacy', page:'pages', title:'Halaman Kebijakan Privasi', groups:[
    { label:'Konten halaman', fields:[
      F('site.help_privacy_title','Judul halaman','text','Kebijakan Privasi'),
      F('site.help_privacy_body','Isi kebijakan (satu paragraf per blok)','area','Data kependudukan…')
    ]}
  ]},
  { id:'helpcontact', page:'pages', title:'Form Hubungi Pengurus & Halaman Lain', groups:[
    { label:'Popup "Hubungi Pengurus"', fields:[
      F('help_contact_target','Chat ID Telegram tujuan pesan (kosongkan = channel utama)','text',''),
      F('site.help_contact_note','Catatan kecil di form kontak','text','Pesan akan diteruskan ke pengurus DPD melalui Telegram resmi.')
    ]},
    { label:'Halaman Cek Anggota', fields:[
      F('site.cek_title','Judul halaman','text','Cek Anggota'),
      F('site.cek_lead','Deskripsi di atas form','area','Masukkan ID anggota (contoh: GLKR-TA-2026-000018) untuk memeriksa status keanggotaan.'),
      F('site.cek_locked_title','Judul saat belum masuk','text','Cek Anggota'),
      F('site.cek_locked_lead','Deskripsi saat belum masuk','area','Fitur ini khusus pengguna yang sudah masuk ke portal.')
    ]},
    { label:'Halaman Pendaftaran', fields:[
      F('site.daftar_kicker','Label kecil atas','text','Formulir pendaftaran'),
      F('site.daftar_title','Judul halaman','area','Empat langkah singkat menuju keanggotaan.')
    ]}
  ]},
  { id:'login', page:'login', title:'Panel Kiri Halaman Login', groups:[
    { label:'Judul & sambutan', fields:[
      F('site.login_kicker','Label kecil atas','text','Portal keanggotaan resmi'),
      F('site.login_side_title','Judul','area','Selamat datang kembali di SIKEDA.'),
      F('site.login_side_lead','Paragraf','area','Satu pintu untuk anggota dan pengurus…')
    ]},
    { label:'Poin keunggulan', fields:[
      F('site.login_point1','Poin 1','text','Kode OTP aktif 5 menit, sekali pakai'),
      F('site.login_point2','Poin 2','text','Sesi terbatas & log akses tercatat'),
      F('site.login_point3','Poin 3','text','Data NIK tersimpan terenkripsi')
    ]},
    { label:'Catatan & footer', fields:[
      F('site.login_note','Catatan keamanan','text','Koneksi terenkripsi · Sesi otomatis berakhir'),
      F('site.login_footer','Baris hak cipta','text','© 2026 DPD Nusantara Bersatu — Kab. Tulungagung')
    ]},
    { label:'Gambar latar (opsional)', fields:[ F('site.login_bg','Foto latar panel kiri','image') ]}
  ]}
];
const SITE_KEYS = SITE_SCHEMA.flatMap(s => s.groups.flatMap(g => g.fields.map(f => f.key)));

/* Nilai bawaan tiap kunci — tampil di editor (dashboard) saat belum pernah
   disimpan, supaya admin mengedit dari konten nyata, bukan kolom kosong.
   Sengaja disamakan dengan teks fallback di index.html / login.html. */
const SITE_DEFAULTS = {
  /* Header & navigasi */
  'site.header_brand_name': 'SIKEDA',
  'site.header_brand_sub': 'DPD Nusantara Bersatu · Kab. Tulungagung',
  'site.header_nav1': 'Beranda',
  'site.header_nav2': 'Alur',
  'site.header_nav3': 'Kartu Anggota',
  'site.header_nav4': 'FAQ',
  'site.header_cta': 'Masuk',
  /* Hero */
  'site.hero_kicker': 'Portal keanggotaan resmi',
  'site.hero_title': 'Satu data anggota, terkelola rapi sampai kartu digital.',
  'site.hero_lead': 'Daftar lewat formulir publik, diverifikasi pengurus berjenjang, dan setiap anggota yang disetujui langsung menerima kartu digital ber-QR yang bisa diverifikasi kapan saja.',
  'site.hero_btn1': 'Daftar Jadi Anggota',
  'site.hero_btn2': 'Sudah punya akun? Masuk',
  'site.hero_badge1': 'NIK disimpan terenkripsi',
  'site.hero_badge2': 'Sesi login terlindungi',
  'site.hero_badge3': 'Audit log penuh',
  /* Statistik */
  'site.stat1_label': 'anggota terverifikasi',
  'site.stat2_label': 'kecamatan tercakup',
  'site.stat3_label': 'ranting terdaftar',
  'site.stat4_label': 'kelengkapan data',
  /* Keunggulan */
  'site.fitur_kicker': 'Kenapa SIKEDA',
  'site.fitur_title': 'Dibangun untuk pengurus yang serius dengan data.',
  'site.fitur_lead': 'Bukan sekadar formulir online — seluruh siklus keanggotaan tertangani: dari pendaftaran, verifikasi berjenjang, sampai penerbitan kartu.',
  'site.fitur1_title': 'OTP tanpa kata sandi',
  'site.fitur1_text': 'Anggota cukup masuk lewat kode sekali pakai ke WhatsApp atau email. Tanpa risiko lupa password.',
  'site.fitur2_title': 'Verifikasi berjenjang',
  'site.fitur2_text': 'Setiap pengajuan melewati pemeriksaan Admin lalu persetujuan Superadmin — semua tercatat di log audit.',
  'site.fitur3_title': 'Kartu digital + QR',
  'site.fitur3_text': 'ID unik non-berurutan, QR menuju halaman vCard, dan kartu fisik siap cetak ukuran standar ID-1.',
  'site.fitur4_title': 'Statistik real-time',
  'site.fitur4_text': 'Sebaran anggota per kecamatan, demografi usia, dan tren pendaftaran bulanan langsung dari dashboard.',
  'site.fitur5_title': 'Struktur organisasi',
  'site.fitur5_text': 'Peta DPD → DPC → Ranting tersusun rapi, setiap anggota terhubung ke struktur dan jabatannya.',
  'site.fitur6_title': 'Data kependudukan aman',
  'site.fitur6_text': 'NIK terenkripsi, backup terjadwal, dan akses berbasis peran: Anggota, Admin, dan Superadmin.',
  /* Alur */
  'site.alur_kicker': 'Alur keanggotaan',
  'site.alur_title': 'Empat langkah, nol drama.',
  'site.alur_lead': 'Proses transparan dari pengajuan sampai kartu diterbitkan. Anda selalu tahu status pengajuan lewat WhatsApp.',
  'site.alur_btn': 'Mulai pendaftaran',
  'site.alur1_title': 'Isi formulir & unggah dokumen',
  'site.alur1_text': 'Data diri, domisili, foto, dan KTP. ± 5 menit selesai.',
  'site.alur2_title': 'Verifikasi Admin',
  'site.alur2_text': 'Pemeriksaan kelengkapan & duplikasi NIK. Jika perlu revisi, Anda diberi catatan.',
  'site.alur3_title': 'Persetujuan Superadmin',
  'site.alur3_text': 'Approval final — sistem menerbitkan ID unik & akun anggota otomatis.',
  'site.alur4_title': 'Kartu digital diterbitkan',
  'site.alur4_text': 'vCard + QR aktif seketika, kartu fisik bisa dicetak massal kapan saja.',
  /* Kartu & vCard */
  'site.kartu_kicker': 'Kartu anggota',
  'site.kartu_title': 'Satu identitas digital, siap dipakai di dunia nyata.',
  'site.kartu1_title': 'QR menuju vCard',
  'site.kartu1_text': 'Petugas event cukup memindai — status keanggotaan tampil seketika.',
  'site.kartu2_title': 'Cetak massal PDF',
  'site.kartu2_text': 'Ukuran kartu kredit (85,6 × 54 mm), siap untuk percetakan.',
  'site.kartu3_title': 'Riwayat cetak tercatat',
  'site.kartu3_text': 'Cetak ulang karena hilang tetap terkontrol dan ber-log.',
  'site.kartu_card_title': 'Halaman vCard anggota',
  'site.kartu_url_sub': 'sikeda.id/kta/{id-unik}',
  'site.kartu_card_text': 'Setiap kartu punya halaman profil internal: nama, jabatan, wilayah, status keanggotaan, dan tombol simpan kontak. Data sensitif seperti NIK tidak pernah tampil di halaman ini.',
  'site.kartu_btn': 'Lihat contoh vCard',
  /* Kata pengurus */
  'site.testi_kicker': 'Kata pengurus',
  'site.testi_title': 'Dipercaya di lapangan.',
  'site.testi1_quote': '"Dulu rekap anggota pakai Excel berserakan. Sekarang satu dashboard, semua ranting tersambung. Approval yang dulu berhari-hari, selesai sore itu juga."',
  'site.testi1_name': 'Budi Santoso',
  'site.testi1_role': 'Ketua DPD',
  'site.testi2_quote': '"Fitur revisinya membantu banget. Kalau data calon kurang lengkap, kami tinggal beri catatan — pendaftar langsung dapat notifikasi WhatsApp."',
  'site.testi2_name': 'Siti Rahmawati',
  'site.testi2_role': 'Sekretaris DPD',
  'site.testi3_quote': '"Anggota baru sekarang bisa cek kartunya sendiri lewat HP. Saat musyawarah, verifikasi peserta cukup scan QR — antrean registrasi jauh lebih cepat."',
  'site.testi3_name': 'Joko Prasetyo',
  'site.testi3_role': 'Bendahara DPD',
  /* FAQ */
  'site.faq_kicker': 'Pertanyaan umum',
  'site.faq_title': 'Mungkin ini yang Anda tanyakan.',
  'site.faq1_q': 'Apakah pendaftaran bayar?',
  'site.faq1_a': 'Pendaftaran gratis. Organisasi Anda bisa mengaktifkan modul iuran opsional di dashboard bila diperlukan.',
  'site.faq2_q': 'Berapa lama proses verifikasi?',
  'site.faq2_a': 'Umumnya 1–2 hari kerja. Anda akan menerima notifikasi WhatsApp di setiap perubahan status.',
  'site.faq3_q': 'Bagaimana keamanan data NIK saya?',
  'site.faq3_a': 'NIK dienkripsi AES-256 sebelum disimpan, hanya dibuka untuk role berwenang, dan setiap akses tercatat pada log audit.',
  'site.faq4_q': 'Saya lupa status pengajuan saya?',
  'site.faq4_a': 'Masuk dengan OTP ke nomor yang Anda daftarkan — status pengajuan tampil langsung di dashboard Anda.',
  /* CTA & footer */
  'site.cta_title': 'Siap jadi bagian dari kami?',
  'site.cta_lead': 'Proses pendaftaran kurang dari 10 menit.',
  'site.cta_btn1': 'Daftar Sekarang',
  'site.cta_btn2': 'Masuk',
  'site.footer_about': 'Sistem pendataan keanggotaan: pendaftaran publik, verifikasi berjenjang, kartu anggota digital, dan dashboard pengelolaan.',
  'site.footer_contact': 'Tulungagung · sekretariat@example.org',
  'site.footer_bottom': '© 2026 DPD Nusantara Bersatu — Kab. Tulungagung',
  'site.footer_secure': 'Data kependudukan disimpan terenkripsi sesuai ketentuan yang berlaku',
  'site.footer_brand': 'DPD Nusantara Bersatu — Kab. Tulungagung',
  'site.help_verify_title': 'Cara Verifikasi Kartu Anggota',
  'site.help_verify_body': '1. Buka halaman vCard anggota melalui tautan sikeda.id/kta/{id-unik} atau tombol pada kartu digital.\n2. Pastikan alamat halaman benar — halaman resmi hanya ada di portal SIKEDA.\n3. Scan QR pada kartu fisik: petugas cukup memindai kode untuk membuka halaman vCard.\n4. Status keanggotaan tampil langsung: nama, jabatan, wilayah, dan status aktif.\n5. Bila status tidak aktif atau halaman tidak ditemukan, hubungi pengurus melalui form Hubungi Pengurus di footer.',
  'site.help_privacy_title': 'Kebijakan Privasi',
  'site.help_privacy_body': 'Data kependudukan (NIK) dienkripsi AES-256-GCM sebelum disimpan dan hanya dibuka untuk peran yang berwenang.\n\nSetiap akses data tercatat pada log audit yang tidak dapat diubah oleh pengguna biasa.\n\nData pribadi tidak pernah ditampilkan pada halaman publik — halaman vCard hanya menampilkan nama, jabatan, wilayah, dan status keanggotaan.\n\nPengguna dapat meminta penghapusan akun melalui pengurus DPD.',
  'site.help_contact_note': 'Pesan akan diteruskan ke pengurus DPD melalui Telegram resmi.',
  'site.cek_title': 'Cek Anggota',
  'site.cek_lead': 'Masukkan ID anggota (contoh: GLKR-TA-2026-000018) untuk memeriksa status keanggotaan.',
  'site.cek_locked_title': 'Cek Anggota',
  'site.cek_locked_lead': 'Fitur ini khusus pengguna yang sudah masuk ke portal.\nSilakan masuk menggunakan akun anggota Anda terlebih dahulu.',
  'site.daftar_kicker': 'Formulir pendaftaran',
  'site.daftar_title': 'Empat langkah singkat menuju keanggotaan.',
  'help_contact_target': '',
  /* Halaman login */
  'site.login_kicker': 'Portal keanggotaan resmi',
  'site.login_side_title': 'Masuk ke portal anggota.',
  'site.login_side_lead': 'Verifikasi identitas dengan kode sekali pakai — aman tanpa perlu mengingat kata sandi.',
  'site.login_point1': 'Kode OTP aktif 5 menit, sekali pakai',
  'site.login_point2': 'Sesi terbatas & log akses tercatat',
  'site.login_point3': 'Data NIK tersimpan terenkripsi',
  'site.login_note': 'Butuh bantuan masuk? Hubungi pengurus DPD Anda melalui WhatsApp resmi.',
  'site.login_footer': '© 2026 DPD Nusantara Bersatu — Kab. Tulungagung'
};

router.get('/content', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q("SELECT kunci, nilai FROM settings WHERE kunci LIKE 'site.%' OR kunci = 'help_contact_target'");
  const obj = Object.assign({}, SITE_DEFAULTS); /* fallback dulu */
  rows.forEach(r => { obj[r.kunci] = r.nilai || ''; }); /* nilai tersimpan menimpa */
  res.json({ ok: true, data: obj, schema: SITE_SCHEMA, canEdit: req.user.level === 'superadmin' });
});

/* ============================================================
   PUT /api/content — simpan konten situs (superadmin)
   Body: { 'site.hero_kicker': '…', … } — hanya kunci yang dikenal
   ============================================================ */
router.put('/content', requireRole('superadmin'), async (req, res) => {
  try {
    const entries = Object.entries(req.body || {}).filter(([k]) => SITE_KEYS.includes(k));
    if(!entries.length) return res.status(400).json({ error: 'Tidak ada konten yang dikirim.' });
    for(const [k, v] of entries){
      await q('INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)',
        [k, String(v).slice(0, 4000)]);
    }
    await logAct(req.user, 'Ubah konten situs', entries.map(e => e[0]).join(', '));
    res.json({ ok: true, message: 'Konten situs disimpan.' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan konten situs.' });
  }
});

/* ============================================================
   POST /api/content/image { key, dataUrl } — unggah gambar untuk
   field bertipe image pada skema konten (superadmin)
   ============================================================ */
router.post('/content/image', requireRole('superadmin'), async (req, res) => {
  try {
    const field = SITE_SCHEMA.flatMap(s => s.groups).flatMap(g => g.fields)
      .find(f => f.key === req.body.key && f.type === 'image');
    if(!field) return res.status(400).json({ error: 'Kunci gambar tidak dikenal.' });
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(String(req.body.dataUrl || ''));
    if(!m) return res.status(400).json({ error: 'Format gambar tidak didukung (PNG/JPG/WEBP).' });
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const buf = Buffer.from(m[2], 'base64');
    if(buf.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran maksimal 3 MB.' });
    if(buf.length < 64) return res.status(400).json({ error: 'Berkas gambar tidak valid.' });

    const fs = require('fs');
    const path = require('path');
    const dir = require('../uploads-path').uploadsRoot(); /* Vercel: /tmp (UPLOADS_DIR) */
    fs.mkdirSync(dir, { recursive: true });

    /* Hapus berkas lama agar uploads tidak menumpuk */
    const prev = await q('SELECT nilai FROM settings WHERE kunci = ?', [field.key]);
    if(prev[0] && prev[0].nilai){
      const oldPath = path.join(require('../uploads-path').uploadsRoot(), '..', prev[0].nilai.replace(/^\/+/, ''));
      if(oldPath.startsWith(dir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const fname = 'site-' + field.key.replace('site.', '').replace(/_/g, '-') + '-' + Date.now() + '.' + ext;
    fs.writeFileSync(path.join(dir, fname), buf);
    /* Mirror opsional ke penyimpanan remote (CDN/Cloudinary/Supabase/Drive) — best effort */
    storage.writeFile('uploads/' + fname, buf).catch(function(){});
    const rel = 'uploads/' + fname;
    await q('INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)',
      [field.key, rel]);
    await logAct(req.user, 'Unggah gambar konten', field.key);
    res.json({ ok: true, path: rel });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal mengunggah gambar.' });
  }
});

/* ============================================================
   DELETE /api/content/image/:key — hapus gambar konten (superadmin)
   ============================================================ */
router.delete('/content/image/:key', requireRole('superadmin'), async (req, res) => {
  try {
    const field = SITE_SCHEMA.flatMap(s => s.groups).flatMap(g => g.fields)
      .find(f => f.key === req.params.key && f.type === 'image');
    if(!field) return res.status(400).json({ error: 'Kunci gambar tidak dikenal.' });
    const prev = await q('SELECT nilai FROM settings WHERE kunci = ?', [field.key]);
    if(prev[0] && prev[0].nilai){
      const fs = require('fs');
      const path = require('path');
      const dir = require('../uploads-path').uploadsRoot(); /* Vercel: /tmp (UPLOADS_DIR) */
      const oldPath = path.join(require('../uploads-path').uploadsRoot(), '..', prev[0].nilai.replace(/^\/+/, ''));
      if(oldPath.startsWith(dir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      await q('DELETE FROM settings WHERE kunci = ?', [field.key]);
    }
    await logAct(req.user, 'Hapus gambar konten', field.key);
    res.json({ ok: true });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menghapus gambar.' });
  }
});

/* ============================================================
   GET/PUT /api/tema — warna tema website (primary & accent)
   ============================================================ */
router.get('/tema', requireRole('admin','superadmin'), async (req, res) => {
  const rows = await q("SELECT kunci, nilai FROM settings WHERE kunci IN ('site.theme_primary','site.theme_accent')");
  const obj = {};
  rows.forEach(r => obj[r.kunci] = r.nilai || '');
  res.json({ ok: true, data: { primary: obj['site.theme_primary'] || '', accent: obj['site.theme_accent'] || '' } });
});

router.put('/tema', requireRole('superadmin'), async (req, res) => {
  try {
    const hex = v => /^#[0-9a-fA-F]{6}$/.test(String(v || ''));
    const primary = String(req.body.primary || '').trim();
    const accent = String(req.body.accent || '').trim();
    if(!hex(primary) || !hex(accent)) return res.status(400).json({ error: 'Format warna harus #RRGGBB.' });
    for(const [k, v] of [['site.theme_primary', primary], ['site.theme_accent', accent]]){
      await q('INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)', [k, v]);
    }
    await logAct(req.user, 'Ubah warna tema website', primary + ' / ' + accent);
    res.json({ ok: true, message: 'Tema warna disimpan.' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan tema.' });
  }
});

/* ============================================================
   GET /api/me/profile — profil anggota sendiri (level anggota)
   ============================================================ */
router.get('/me/profile', async (req, res) => {
  if(req.user.level !== 'anggota' || !req.user.anggota_id){
    return res.status(400).json({ error: 'Hanya untuk level anggota.' });
  }
  const rows = await q('SELECT * FROM anggota WHERE id = ?', [req.user.anggota_id]);
  if(!rows.length) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  /* Profil sendiri: pemilik boleh melihat NIK penuhnya (dipakai NPAPG kartu) */
  res.json({ ok: true, data: rowToMember(rows[0], { fullNik: true }) });
});

/* ============================================================
   Data pribadi: draft perubahan mandiri anggota
   - GET    /me/draft            → draft aktif (status draft/pending)
   - PUT    /me/draft            → simpan payload sebagai draft
   - POST   /me/draft/submit     → ajukan draft ke pengurus (draft → pending)
   - DELETE /me/draft            → buang draft (kembali edit bebas)
   Field yang boleh diubah anggota (data pribadi non-kritis):
   pekerjaan, alamat, telegram, email, whatsapp — NOT nama/NIK/TTL/wilayah/status.
   Nomor WA masuk draft (berlaku setelah disetujui pengurus) karena dipakai
   sebagai identitas login OTP. Foto profil diubah lewat POST /me/photo.
   ============================================================ */
const DRAFT_FIELDS = ['pekerjaan', 'alamat', 'telegram', 'email', 'whatsapp'];
router.get('/me/draft', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    const rows = await q("SELECT * FROM data_drafts WHERE anggota_id = ? AND status IN ('draft','pending') ORDER BY id DESC LIMIT 1", [req.user.anggota_id]);
    res.json({ ok: true, data: rows[0] || null });
  } catch(e){ res.status(500).json({ error: 'Gagal memuat draft.' }); }
});
router.put('/me/draft', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    const b = req.body || {};
    const payload = {};
    for(const f of DRAFT_FIELDS){
      if(b[f] !== undefined){
        let v = String(b[f]).trim();
        if(f === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return res.status(400).json({ error: 'Format email tidak valid.' });
        if(f === 'telegram' && v && !(/^@[A-Za-z0-9_]{4,}$/.test(v) || /^\d{5,}$/.test(v))) return res.status(400).json({ error: 'Format Telegram tidak valid.' });
        if(f === 'pekerjaan' && v.length > 100) return res.status(400).json({ error: 'Pekerjaan maksimal 100 karakter.' });
        if(f === 'alamat' && v.length > 255) return res.status(400).json({ error: 'Alamat maksimal 255 karakter.' });
        if(f === 'whatsapp'){
          v = v.replace(/\D/g, '');
          if(!v) return res.status(400).json({ error: 'Nomor WhatsApp wajib diisi — dipakai untuk login OTP.' });
          if(v.length < 10 || v.length > 16) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid (10–16 digit).' });
          const dupWa = await q(`SELECT kode_unik FROM anggota WHERE whatsapp = ? AND id <> ? AND status IN ('Pending','Aktif','Revisi') LIMIT 1`, [v, req.user.anggota_id]);
          if(dupWa.length) return res.status(409).json({ error: 'Nomor WhatsApp sudah dipakai anggota lain (' + dupWa[0].kode_unik + ').' });
        }
        payload[f] = v;
      }
    }
    if(!Object.keys(payload).length) return res.status(400).json({ error: 'Tidak ada data untuk disimpan.' });
    const cur = await q("SELECT id FROM data_drafts WHERE anggota_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1", [req.user.anggota_id]);
    if(cur.length){
      await q('UPDATE data_drafts SET payload = ? WHERE id = ?', [JSON.stringify(payload), cur[0].id]);
    } else {
      const pend = await q("SELECT id FROM data_drafts WHERE anggota_id = ? AND status = 'pending' LIMIT 1", [req.user.anggota_id]);
      if(pend.length) return res.status(409).json({ error: 'Masih ada pengajuan yang menunggu ditinjau pengurus.' });
      await q('INSERT INTO data_drafts (anggota_id, payload) VALUES (?, ?)', [req.user.anggota_id, JSON.stringify(payload)]);
    }
    const after = await q("SELECT * FROM data_drafts WHERE anggota_id = ? AND status IN ('draft','pending') ORDER BY id DESC LIMIT 1", [req.user.anggota_id]);
    res.json({ ok: true, data: after[0] || null });
  } catch(e){ res.status(500).json({ error: 'Gagal menyimpan draft.' }); }
});
router.post('/me/draft/submit', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    const rows = await q("SELECT * FROM data_drafts WHERE anggota_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1", [req.user.anggota_id]);
    if(!rows.length) return res.status(404).json({ error: 'Belum ada draft untuk diajukan.' });
    const rawP = rows[0].payload;
    const draftObj = typeof rawP === 'string' ? (JSON.parse(rawP) || {}) : (rawP || {});
    const keys = Object.keys(draftObj);
    if(!keys.length) return res.status(400).json({ error: 'Draft kosong.' });
    await q("UPDATE data_drafts SET status = 'pending', submitted_at = NOW() WHERE id = ?", [rows[0].id]);
    const meRow = await q('SELECT kode_unik, nama FROM anggota WHERE id = ? LIMIT 1', [req.user.anggota_id]);
    const label = meRow.length ? (meRow[0].kode_unik + ' (' + meRow[0].nama + ')') : ('ID ' + req.user.anggota_id);
    await logAct(req.user, 'Ajukan perubahan data', label + ' — ' + keys.join(', '));
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: 'Gagal mengajukan perubahan.' }); }
});
router.delete('/me/draft', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    await q("DELETE FROM data_drafts WHERE anggota_id = ? AND status IN ('draft','pending')", [req.user.anggota_id]);
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: 'Gagal menghapus draft.' }); }
});

/* ============================================================
   POST /api/me/photo — upload / hapus foto profil SENDIRI (anggota)
   Body: { dataUrl: 'data:image/…;base64,…' }  atau  { remove: true }
   Sama dengan /members/:id/photo tetapi untuk akun sendiri; foto tetap
   dinormalisasi ke rasio slot kartu (3:4, 720×960) via src/photo.js.
   ============================================================ */
router.post('/me/photo', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    const rows = await q('SELECT id, kode_unik, foto_path FROM anggota WHERE id = ? LIMIT 1', [req.user.anggota_id]);
    if(!rows.length) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
    const a = rows[0];
    const { normalizePhoto } = require('../photo');
    const fs = require('fs');
    const path = require('path');
    const dir = require('../uploads-path').uploadsRoot(); /* Vercel: /tmp (UPLOADS_DIR) */

    const delOld = () => {
      if(a.foto_path){
        const oldPath = path.join(require('../uploads-path').uploadsRoot(), '..', a.foto_path.replace(/^\/+/, ''));
        if(oldPath.startsWith(dir) && fs.existsSync(oldPath)){ try { fs.unlinkSync(oldPath); } catch(e){} }
      }
    };

    /* Hapus foto */
    if(req.body && req.body.remove === true){
      delOld();
      await q('UPDATE anggota SET foto_path = NULL WHERE id = ?', [a.id]);
      await logAct(req.user, 'Hapus foto profil', a.kode_unik);
      return res.json({ ok: true, path: null, message: 'Foto profil dihapus.' });
    }

    /* Simpan foto baru — dinormalisasi dulu ke rasio slot kartu (3:4) */
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(String((req.body || {}).dataUrl || ''));
    if(!m) return res.status(400).json({ error: 'Format gambar tidak didukung (PNG/JPG/WEBP).' });
    const mimeIn = 'image/' + (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase());
    const raw = Buffer.from(m[2], 'base64');
    if(raw.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran foto maksimal 2 MB.' });
    if(raw.length < 64) return res.status(400).json({ error: 'Berkas gambar tidak valid.' });

    let buf, ext;
    try {
      ({ buffer: buf, ext } = await normalizePhoto(raw, mimeIn));
    } catch(e){
      console.warn('photo normalize gagal, simpan apa adanya:', e.message);
      buf = raw; ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    }

    fs.mkdirSync(dir, { recursive: true });
    delOld();
    const fname = 'photo-' + a.id + '-' + Date.now() + '.' + ext;
    fs.writeFileSync(path.join(dir, fname), buf);
    /* Mirror opsional ke penyimpanan remote (CDN/Cloudinary/Supabase/Drive) — best effort */
    storage.writeFile('uploads/' + fname, buf).catch(function(){});
    const rel = 'uploads/' + fname;
    await q('UPDATE anggota SET foto_path = ? WHERE id = ?', [rel, a.id]);
    await logAct(req.user, 'Upload foto profil', a.kode_unik + ' → ' + rel + ' (720×960)');
    res.json({ ok: true, path: rel, message: 'Foto profil diperbarui — otomatis dipotong ke rasio kartu (3:4).' });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan foto.' });
  }
});

/* ============================================================
   Review perubahan data anggota (admin & superadmin)
   - GET  /drafts?status=pending|disetujui|ditolak → daftar pengajuan
   - POST /drafts/:id/approve { catatan? } → terapkan payload ke anggota
   - POST /drafts/:id/reject  { catatan }  → tolak pengajuan (alasan wajib)
   Field yang diterapkan hanya yang ada di DRAFT_FIELDS.
   ============================================================ */
router.get('/drafts', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const status = ['pending','disetujui','ditolak'].includes(req.query.status) ? req.query.status : 'pending';
    const rows = await q(
      `SELECT d.*, a.kode_unik, a.nama, a.pekerjaan AS cur_pekerjaan, a.alamat AS cur_alamat,
              a.telegram AS cur_telegram, a.email AS cur_email, a.whatsapp AS cur_whatsapp
         FROM data_drafts d JOIN anggota a ON a.id = d.anggota_id
        WHERE d.status = ? ORDER BY d.submitted_at DESC, d.id DESC LIMIT 100`,
      [status]);
    res.json({ ok: true, data: rows.map(r => {
      let p = {}; try { p = typeof r.payload === 'string' ? (JSON.parse(r.payload) || {}) : (r.payload || {}); } catch(e){}
      return { id: r.id, anggota_id: r.anggota_id, kode_unik: r.kode_unik, nama: r.nama,
        status: r.status, submitted_at: r.submitted_at, reviewed_at: r.reviewed_at,
        catatan_review: r.catatan_review || null, payload: p,
        before: { pekerjaan: r.cur_pekerjaan || '', alamat: r.cur_alamat || '', telegram: r.cur_telegram || '', email: r.cur_email || '', whatsapp: r.cur_whatsapp || '' } };
    }) });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal memuat pengajuan.' }); }
});

async function reviewDraft(req, res, keputusan){
  try {
    const rows = await q('SELECT d.*, a.kode_unik, a.nama FROM data_drafts d JOIN anggota a ON a.id = d.anggota_id WHERE d.id = ? LIMIT 1', [req.params.id]);
    if(!rows.length) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    const d = rows[0];
    if(d.status !== 'pending') return res.status(409).json({ error: 'Pengajuan ini sudah direview (' + d.status + ').' });
    let p = {}; try { p = typeof d.payload === 'string' ? (JSON.parse(d.payload) || {}) : (d.payload || {}); } catch(e){}
    const catatan = String((req.body || {}).catatan || '').trim().slice(0, 255);
    if(keputusan === 'ditolak' && !catatan) return res.status(400).json({ error: 'Sertakan alasan penolakan untuk anggota.' });
    if(keputusan === 'disetujui'){
      const sets = [], vals = [];
      for(const f of DRAFT_FIELDS){
        if(p[f] !== undefined){ sets.push(f + ' = ?'); vals.push(p[f]); }
      }
      if(sets.length){
        vals.push(d.anggota_id);
        await q('UPDATE anggota SET ' + sets.join(', ') + ' WHERE id = ?', vals);
      }
    }
    await q('UPDATE data_drafts SET status = ?, reviewed_at = NOW(), reviewed_by = ?, catatan_review = ? WHERE id = ?',
      [keputusan, req.user.id, catatan || null, d.id]);
    const label = d.kode_unik + ' (' + d.nama + ')';
    await logAct(req.user, keputusan === 'disetujui' ? 'Setujui perubahan data' : 'Tolak perubahan data',
      label + ' — ' + (Object.keys(p).join(', ') || '-') + (catatan ? ' · alasan: ' + catatan : ''));
    res.json({ ok: true, message: keputusan === 'disetujui' ? 'Perubahan data diterapkan ke anggota.' : 'Pengajuan ditolak.' });

    /* Notifikasi hasil review ke anggota (fire-and-forget, semua kanal tersedia)
       Kontak diambil SETELAH update — bila WA/email ikut diubah, notifikasi
       menuju kontak terbaru yang akan dipakai anggota. */
    (async () => {
      try {
        const DRAFT_LABEL_ID = { pekerjaan: 'Pekerjaan', alamat: 'Alamat', telegram: 'Telegram', email: 'Email', whatsapp: 'Nomor WhatsApp' };
        const NFY_OPTS = { id: d.anggota_id, createdBy: req.user.id };
        const me = await q('SELECT whatsapp, telegram, email FROM anggota WHERE id = ? LIMIT 1', [d.anggota_id]);
        if(!me.length) return;
        const c = me[0];
        const ubah = Object.keys(p).map(f => DRAFT_LABEL_ID[f] || f).join(', ') || '-';
        const judul = keputusan === 'disetujui'
          ? '✅ <b>Perubahan data disetujui</b>'
          : '❌ <b>Perubahan data ditolak</b>';
        const text = judul
          + '\nID: <code>' + d.kode_unik + '</code> (' + d.nama + ')'
          + '\nData diajukan: ' + ubah
          + (keputusan === 'disetujui'
              ? '\nPerubahan telah diterapkan ke data keanggotaan Anda.'
              : '\nAlasan: ' + (catatan || '-') + '\nSilakan ajukan ulang dengan perbaikan yang diminta.')
          + '\n\n— SIKEDA';
        await notifStatus({ whatsapp: c.whatsapp, telegram: c.telegram, email: c.email }, text,
          keputusan === 'disetujui' ? 'Perubahan Data Disetujui — SIKEDA' : 'Perubahan Data Ditolak — SIKEDA', NFY_OPTS);
      } catch(e){ console.warn('notif review gagal:', e.message); }
    })();
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal memproses pengajuan.' }); }
}
router.post('/drafts/:id/approve', requireRole('admin','superadmin'), (req, res) => reviewDraft(req, res, 'disetujui'));
router.post('/drafts/:id/reject',  requireRole('admin','superadmin'), (req, res) => reviewDraft(req, res, 'ditolak'));

/* ============================================================
   Pengumuman
   - GET  /pengumuman  → timeline untuk user login (umum + personal miliknya)
   - POST /pengumuman  → buat (admin & superadmin); personal wajib anggota_id valid
   - PUT  /pengumuman/:id → edit (admin & superadmin)
   - DELETE /pengumuman/:id → hapus (admin & superadmin)
   ============================================================ */  /* Kirim pengumuman via kanal tambahan (fire-and-forget; dashboard selalu kanal utama) */
  function escHtml(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function sendPengumumanChannels(id, p, channels){
    let list = String(channels || '').split(',').filter(Boolean);
    /* Pesan personal → selalu notif otomatis via semua kanal yang datanya
       terisi di profil anggota (di luar centang admin). Flag retryOnly
       (kirim ulang) menonaktifkan auto-add agar hanya kanal terpilih. */
    if(p.target === 'personal' && !p.retryOnly){
      ['wa','telegram','email'].forEach(ch => { if(!list.includes(ch)) list.push(ch); });
    }
    if(!list.length) return Promise.resolve([]);
    const { sendFonnte, sendTelegram, sendEmail } = require('../notify');
    const hasil = [];
    const createdBy = p.createdBy || null;
    const prioritasTag = p.prioritas === 'penting' ? '‼️ PENTING\n' : '';
    const judulBar = '📢 *' + p.judul + '*\n\n';
    const footer = '\n\n— ' + (p.kategori.charAt(0).toUpperCase() + p.kategori.slice(1)) + ' SIKEDA';
    const plain = p.prioritas === 'penting' ? '[PENTING] ' : '';
    const channelsStr = list.join(',');
    (async () => {
      try {
        await ensureSendLog();
        let recipients = [];
        if(p.target === 'personal' && p.anggotaId){
          recipients = await q('SELECT nama, whatsapp, telegram, email FROM anggota WHERE id = ? LIMIT 1', [p.anggotaId]);
        } else {
          recipients = await q("SELECT nama, whatsapp, telegram, email FROM anggota WHERE status = 'Aktif'");
        }
        recipients = recipients.filter(a => a.whatsapp || a.telegram || a.email);
        for(const ch of list){
          const targets = recipients.filter(a => (ch === 'wa' && a.whatsapp) || (ch === 'telegram' && a.telegram) || (ch === 'email' && a.email));
          if(!targets.length) continue;
          if(ch === 'wa'){
            for(const a of targets){
              let r = null; try { r = await sendFonnte(a.whatsapp, prioritasTag + judulBar + p.isi + footer); } catch(e){}
              hasil.push(ch + ':' + (r && r.ok ? 'ok' : 'gagal'));
              await sendLog(id, 'wa', a.whatsapp, r && r.ok, r && !r.ok ? r.err : null, createdBy).catch(function(){});
            }
          } else if(ch === 'telegram'){
            for(const a of targets){
              let r = null; try { r = await sendTelegram(a.telegram, prioritasTag.replace('‼️','<b>‼️ PENTING</b>') + '<b>' + escHtml(p.judul) + '</b>\n\n' + escHtml(p.isi).replace(/\n/g,'<br>') + '<br><br>— ' + p.kategori + ' SIKEDA'); } catch(e){}
              hasil.push(ch + ':' + (r && r.ok ? 'ok' : 'gagal'));
              await sendLog(id, 'telegram', a.telegram, r && r.ok, r && !r.ok ? r.err : null, createdBy).catch(function(){});
            }
          } else if(ch === 'email'){
            for(const a of targets){
              const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">'
                + '<div style="background:#0b1524;color:#fff;padding:18px 24px"><b style="font-size:16px">' + escHtml(p.judul) + '</b>'
                + (p.prioritas === 'penting' ? ' <span style="background:#dc2626;color:#fff;font-size:11px;padding:2px 8px;border-radius:99px;margin-left:8px">PENTING</span>' : '')
                + '</div><div style="padding:22px 24px;color:#111827;font-size:14px;line-height:1.65">'
                + String(escHtml(p.isi)).replace(/\n/g,'<br>')
                + '</div><div style="padding:14px 24px;background:#f7f8fb;color:#6b7280;font-size:12px">— ' + p.kategori.charAt(0).toUpperCase() + p.kategori.slice(1) + ' SIKEDA</div></div>';
              let r = null; try { r = await sendEmail(a.email, (plain || '') + p.judul, p.isi, html); } catch(e){}
              hasil.push(ch + ':' + (r && r.ok ? 'ok' : 'gagal'));
              await sendLog(id, 'email', a.email, r && r.ok, r && !r.ok ? r.err : null, createdBy).catch(function(){});
            }
          }
        }
        /* Simpan hasil per kanal di kolom channels → dasar tombol "Kirim ulang".
           Mode retryOnly: gabungkan — kanal yang di-retry memakai hasil baru,
           kanal lain tetap memakai hasil semula (dari p.baseChannels). */
        let strHasil = hasil.join(' + ') || '-';
        if(p.retryOnly && p.baseChannels){
          strHasil = String(p.baseChannels).split('+').map(s => s.trim()).map(s => {
            const ci = s.indexOf(':');
            const ch = (ci > -1 ? s.slice(0, ci) : s).toLowerCase();
            if(!list.includes(ch)) return s;
            return ch + ':' + (hasil.some(h => h === ch + ':ok') ? 'ok' : 'gagal');
          }).join(' + ');
        }
        await q('UPDATE pengumuman SET channels = ? WHERE id = ?', [strHasil, id]).catch(function(){});
        await logAct(null, 'Kirim pengumuman #' + id + ' via ' + list.join('+') + (p.target === 'personal' ? ' (personal: otomatis)' : ''), hasil.join(' + ') || '-').catch(function(){});
      } catch(e){ /* pengiriman kanal tidak boleh menggagalkan penerbitan */ }
    })();
    return Promise.resolve(list);
  }

  router.get('/pengumuman', authRequired, async (req, res) => {
  try {
    /* Mode manajemen (admin/superadmin): semua entri + nama anggota tujuan */
    if(req.user.level !== 'anggota' && req.query.scope === 'all'){
      const rows = await q('SELECT p.*, a.nama AS anggota_nama FROM pengumuman p LEFT JOIN anggota a ON a.id = p.anggota_id ORDER BY p.created_at DESC LIMIT 100');
      return res.json({ ok: true, data: rows });
    }
    const aid = req.user.level === 'anggota' ? req.user.anggota_id : null;
    const rows = aid
      ? await q("SELECT * FROM pengumuman WHERE aktif = 1 AND (target = 'umum' OR (target = 'personal' AND anggota_id = ?)) ORDER BY created_at DESC LIMIT 30", [aid])
      : await q("SELECT * FROM pengumuman WHERE aktif = 1 AND target = 'umum' ORDER BY created_at DESC LIMIT 30");
    const aidCol = await q("SELECT anggota_id FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    let unread = 0;
    if(aidCol.length && aidCol[0].anggota_id){
      const r2 = await q("SELECT COUNT(*) AS n FROM pengumuman WHERE aktif = 1 AND read_at IS NULL AND (target = 'umum' OR (target = 'personal' AND anggota_id = ?))", [aidCol[0].anggota_id]);
      unread = (r2[0] && r2[0].n) || 0;
    }
    res.json({ ok: true, data: rows, unread: unread });
  } catch(e){ res.status(500).json({ error: 'Gagal memuat pengumuman.' }); }
});

/* ============================================================
   POST /pengumuman/read → tandai SEMUA pengumuman yang tampil
   bagi anggota ini (umum + personal miliknya) sebagai dibaca.
   Dipakai tombol "Tandai dibaca" di beranda anggota; badge menu
   lalu di-refresh via UI.refreshBadges().
   ============================================================ */
router.post('/pengumuman/read', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    const aidCol = await q('SELECT anggota_id FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if(!aidCol.length || !aidCol[0].anggota_id) return res.status(404).json({ error: 'Profil anggota tidak ditemukan.' });
    const aid = aidCol[0].anggota_id;
    const r = await q("UPDATE pengumuman SET read_at = NOW() WHERE aktif = 1 AND read_at IS NULL AND (target = 'umum' OR (target = 'personal' AND anggota_id = ?))", [aid]);
    res.json({ ok: true, updated: r.affectedRows || 0 });
  } catch(e){ res.status(500).json({ error: 'Gagal menandai pengumuman.' }); }
});

/* POST /pengumuman/:id/read → tandai SATU pengumuman sebagai dibaca.
   Anggota hanya boleh menandai yang memang tampil untuknya. */
router.post('/pengumuman/:id/read', authRequired, requireRole('anggota'), async (req, res) => {
  try {
    const aidCol = await q('SELECT anggota_id FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if(!aidCol.length || !aidCol[0].anggota_id) return res.status(404).json({ error: 'Profil anggota tidak ditemukan.' });
    const aid = aidCol[0].anggota_id;
    const r = await q("UPDATE pengumuman SET read_at = NOW() WHERE id = ? AND aktif = 1 AND read_at IS NULL AND (target = 'umum' OR (target = 'personal' AND anggota_id = ?))", [req.params.id, aid]);
    if(!r.affectedRows) return res.status(404).json({ error: 'Pengumuman tidak ditemukan / sudah dibaca.' });
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: 'Gagal menandai pengumuman.' }); }
});
router.post('/pengumuman', authRequired, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const b = req.body || {};
    const judul = String(b.judul || '').trim();
    const isi = String(b.isi || '').trim();
    const kategori = ['pengumuman','pemberitahuan','pesan'].includes(b.kategori) ? b.kategori : 'pengumuman';
    const prioritas = b.prioritas === 'penting' ? 'penting' : 'normal';
    const target = b.target === 'personal' ? 'personal' : 'umum';
    if(judul.length < 3 || judul.length > 160) return res.status(400).json({ error: 'Judul wajib diisi (3-160 karakter).' });
    if(!isi) return res.status(400).json({ error: 'Isi wajib diisi.' });
    /* Kanal kirim tambahan: dashboard selalu; WA/Telegram/Email opsional */
    const chans = Array.isArray(b.channels) ? b.channels : [];
    const ALLOWED_CH = ['wa', 'telegram', 'email'];
    if(chans.some(c => !ALLOWED_CH.includes(c))) return res.status(400).json({ error: 'Kanal kirim tidak valid. Pilihan: wa, telegram, email.' });
    const channels = ALLOWED_CH.filter(c => chans.includes(c)).join(',');
    let anggotaId = null;
    if(target === 'personal'){
      anggotaId = parseInt(b.anggota_id, 10);
      const cek = await q("SELECT id FROM anggota WHERE id = ? AND status = 'Aktif' LIMIT 1", [anggotaId]);
      if(!cek.length) return res.status(400).json({ error: 'Anggota tujuan tidak ditemukan / tidak aktif.' });
    }
    const r = await q('INSERT INTO pengumuman (target, anggota_id, kategori, judul, isi, prioritas, channels, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [target, anggotaId, kategori, judul, isi, prioritas, channels, req.user.id]);
    await logAct(req.user, 'Buat ' + kategori + ' (' + target + ')' + (channels ? ' + kirim ' + channels.replace(/,/g, '+') : ''), judul);
    res.json({ ok: true, id: r.insertId, sent: sendPengumumanChannels(r.insertId, { target, anggotaId, kategori, judul, isi, prioritas, createdBy: req.user.id }, channels) });
  } catch(e){ res.status(500).json({ error: 'Gagal menyimpan pengumuman.' }); }
});
router.put('/pengumuman/:id', authRequired, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const rows = await q('SELECT * FROM pengumuman WHERE id = ? LIMIT 1', [req.params.id]);
    if(!rows.length) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    const b = req.body || {};
    const judul = String(b.judul || '').trim();
    const isi = String(b.isi || '').trim();
    const kategori = ['pengumuman','pemberitahuan','pesan'].includes(b.kategori) ? b.kategori : 'pengumuman';
    const prioritas = b.prioritas === 'penting' ? 'penting' : 'normal';
    if(judul.length < 3 || judul.length > 160) return res.status(400).json({ error: 'Judul wajib diisi (3-160 karakter).' });
    if(!isi) return res.status(400).json({ error: 'Isi wajib diisi.' });
    const chans = Array.isArray(b.channels) ? b.channels : [];
    const channels = ['wa','telegram','email'].filter(c => chans.includes(c)).join(',');
    const r = await q('UPDATE pengumuman SET kategori = ?, judul = ?, isi = ?, prioritas = ?, channels = ? WHERE id = ?', [kategori, judul, isi, prioritas, channels, req.params.id]);
    if(!r.affectedRows) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    await logAct(req.user, 'Edit ' + kategori, judul);
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: 'Gagal memperbarui pengumuman.' }); }
});
router.delete('/pengumuman/:id', authRequired, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const rows = await q('SELECT id, judul FROM pengumuman WHERE id = ? LIMIT 1', [req.params.id]);
    if(!rows.length) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    await q('DELETE FROM pengumuman WHERE id = ?', [req.params.id]);
    await logAct(req.user, 'Hapus pengumuman', rows[0].judul);
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: 'Gagal menghapus pengumuman.' }); }
});

/* ============================================================
   KARTU FISIK — template desain kustom (tampak depan & belakang)
   Disimpan sebagai JSON di settings (kunci 'kta_template').
   Administrator dapat mengatur: gambar latar, warna teks, posisi
   (X/Y dalam % lebar kartu), ukuran font, serta visibilitas tiap
   elemen — pratinjau live di dashboard & diterapkan ke PDF cetak.
   ============================================================ */
const KTA_DEFAULT = {
  front: {
    bg_image: '', bg_color: '#e9d826', bg_fit: 'cover', overlay: 0,
    title_text: 'Kartu Tanda Anggota',
    qr:    { x: 85.5, y: 6.6,  w: 10,   visible: true },
    photo: { x: 78.6, y: 20.4, w: 17.9, visible: true },
    data:  { x: 96.4, y: 40,   align: 'right', visible: true },
    title: { x: 96.4, y: 58.95, visible: true },
    org_visible: false,
    nama_size: 4.2, wil_size: 3.05, npapg_visible: true
  },
  back: {
    bg_image: '', bg_color: '#f5efdc',
    header_text: 'Kartu Tanda Anggota',
    qr:    { x: 8, y: 22, w: 22, visible: true },
    url_visible: true, seal_visible: true, chips_visible: true,
    nama_size: 4.4
  }
};
function ktaNormalizeSide(raw, def){
  const s = Object.assign({}, def, raw && typeof raw === 'object' ? raw : {});
  const clamp = (v, a, b) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : null);
  for(const k of ['qr','photo','data','title']){
    if(!s[k] || typeof s[k] !== 'object'){ s[k] = Object.assign({}, def[k] || {}); continue; }
    s[k] = Object.assign({}, def[k] || {}, s[k]);
    if(s[k].x != null) s[k].x = clamp(s[k].x, 0, 100) ?? def[k].x;
    if(s[k].y != null) s[k].y = clamp(s[k].y, 0, 100) ?? def[k].y;
    if(s[k].w != null) s[k].w = clamp(s[k].w, 4, 45);
  }
  for(const k of ['nama_size','wil_size']){
    if(s[k] != null){ const v = clamp(s[k], 1.5, 9); s[k] = v != null ? v : def[k]; }
  }
  if(s.nama_size_back != null){ const v = clamp(s.nama_size_back, 1.5, 9); s.nama_size_back = v != null ? v : undefined; }
  return s;
}
function ktaNormalize(raw){
  try {
    const o = raw && typeof raw === 'object' ? raw : (raw ? JSON.parse(raw) : {});
    return {
      front: ktaNormalizeSide(o.front, KTA_DEFAULT.front),
      back:  ktaNormalizeSide(o.back,  KTA_DEFAULT.back)
    };
  } catch(_) { return JSON.parse(JSON.stringify(KTA_DEFAULT)); }
}

router.get('/kta-template', requireRole('admin','superadmin'), async (req, res) => {    const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    const saved = rows[0] ? ktaNormalize(rows[0].nilai) : null;
    const pr = await ktaLoadPresets();
    /* "Aktif" hanya benar bila desain saat ini benar-benar identik dengan preset itu
       (bisa saja admin mengubah desain manual setelah mengaktifkan preset). */
    if(pr.active){
      const act = pr.list.find(p => p.id === pr.active);
      if(!act || JSON.stringify(saved || ktaNormalize(null)) !== JSON.stringify(act.tpl)) pr.active = null;
    }
    res.json({ ok: true, data: saved || ktaNormalize(null), custom: !!saved, canEdit: req.user.level === 'superadmin', presets: { list: pr.list, active: pr.active } });
});

router.put('/kta-template', requireRole('superadmin'), async (req, res) => {
  try {
    const t = ktaNormalize(req.body);
    await q("INSERT INTO settings (kunci, nilai) VALUES ('kta_template', ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)", [JSON.stringify(t)]);
    await logAct(req.user, 'Ubah desain kartu fisik', 'template ' + (req.body && req.body.reset ? 'direset' : 'disimpan'));
    res.json({ ok: true, message: 'Desain kartu disimpan.', data: t });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan desain kartu.' });
  }
});

/* Reset desain kartu ke bawaan tema (hapus template + gambar latarnya) */
router.delete('/kta-template', requireRole('superadmin'), async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    if(rows[0]){
      const used = await ktaBgUsedByPresets();
      try {
        const t = ktaNormalize(rows[0].nilai);
        ['front','back'].forEach(side => {
          const old = t[side] && t[side].bg_image;
          if(old && !used.has(String(old))){
            const p = path.join(require('../uploads-path').uploadsRoot(), '..', String(old).replace(/^\/+/, ''));
            if(p.startsWith(require('../uploads-path').uploadsRoot()) && fs.existsSync(p)) fs.unlinkSync(p);
          }
        });
      } catch(_) {}
      await q("DELETE FROM settings WHERE kunci = 'kta_template'");
      const pr = await ktaLoadPresets();
      if(pr.active){ pr.active = null; await ktaSavePresets(pr); }
      await logAct(req.user, 'Reset desain kartu fisik', 'kembali ke bawaan tema');
    }
    res.json({ ok: true, message: 'Desain kartu kembali ke bawaan tema.' });
  } catch(e){ res.status(500).json({ error: 'Gagal mereset desain kartu.' }); }
});

/* Hapus gambar latar kustom kartu (kembali ke bawaan tema) */
router.delete('/kta-template/bg/:side', requireRole('superadmin'), async (req, res) => {
  try {
    const path = require('path');
    const side = req.params.side === 'back' ? 'back' : 'front';
    const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    if(rows[0]){
      const t = ktaNormalize(rows[0].nilai);
      const old = t[side] && t[side].bg_image;
      if(old){
        const used = await ktaBgUsedByPresets();
        const fs = require('fs');
        const p = path.join(require('../uploads-path').uploadsRoot(), '..', String(old).replace(/^\/+/, ''));
        if(!used.has(String(old)) && p.startsWith(require('../uploads-path').uploadsRoot()) && fs.existsSync(p)) fs.unlinkSync(p);
      }
      t[side].bg_image = '';
      await q("UPDATE settings SET nilai = ? WHERE kunci = 'kta_template'", [JSON.stringify(t)]);
    }
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error: 'Gagal menghapus latar kartu.' }); }
});

/* Unggah gambar latar kartu (depan/belakang) — pola sama dengan /content/image */
router.post('/kta-template/bg/:side', requireRole('superadmin'), async (req, res) => {
  try {
    const path = require('path');
    const side = req.params.side === 'back' ? 'back' : 'front';
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(String(req.body.dataUrl || ''));
    if(!m) return res.status(400).json({ error: 'Format gambar tidak didukung (PNG/JPG/WEBP).' });
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const buf = Buffer.from(m[2], 'base64');
    if(buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran maksimal 5 MB.' });
    if(buf.length < 64) return res.status(400).json({ error: 'Berkas gambar tidak valid.' });
    const fs = require('fs');
    const dir = require('../uploads-path').uploadsRoot(); /* Vercel: /tmp (UPLOADS_DIR) */
    fs.mkdirSync(dir, { recursive: true });
    const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    const t = rows[0] ? ktaNormalize(rows[0].nilai) : ktaNormalize(null);
    const prev = t[side] && t[side].bg_image;
    if(prev){
      const oldPath = path.join(require('../uploads-path').uploadsRoot(), '..', String(prev).replace(/^\/+/, ''));
      if(oldPath.startsWith(dir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const fname = 'kta-bg-' + side + '-' + Date.now() + '.' + ext;
    fs.writeFileSync(path.join(dir, fname), buf);
    /* Mirror opsional ke penyimpanan remote (CDN/Cloudinary/Supabase/Drive) — best effort */
    storage.writeFile('uploads/' + fname, buf).catch(function(){});
    t[side].bg_image = 'uploads/' + fname;
    await q("INSERT INTO settings (kunci, nilai) VALUES ('kta_template', ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)", [JSON.stringify(t)]);
    await logAct(req.user, 'Unggah latar kartu fisik', side);
    res.json({ ok: true, path: t[side].bg_image });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Gagal mengunggah latar kartu.' });
  }
});

/* ============================================================
   PRESET DESAIN KARTU — pustaka beberapa template tersimpan.
   Disimpan di kunci settings 'kta_presets' (JSON):
   { list: [{ id, nama, dibuat, tpl: {front, back} }], active: id|null }
   Desain AKTIF tetap kunci 'kta_template' (dipakai PDF/PNG/vcard),
   sehingga "aktifkan preset" = salin tpl preset ke kta_template.
   ============================================================ */
const KTA_PRESET_KEY = 'kta_presets';
async function ktaLoadPresets(){
  const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_presets' LIMIT 1");
  let o = null;
  try { o = rows[0] ? JSON.parse(rows[0].nilai) : null; } catch(_) { o = null; }
  if(!o || !Array.isArray(o.list)) o = { list: [], active: null };
  o.list = o.list
    .filter(p => p && typeof p === 'object')
    .map(p => ({ id: String(p.id || ''), nama: String(p.nama || 'Tanpa nama').slice(0, 60), dibuat: p.dibuat || null, tpl: ktaNormalize(p.tpl) }))
    .filter(p => p.id);
  if(o.active != null && !o.list.some(p => p.id === o.active)) o.active = null;
  return o;
}
async function ktaSavePresets(p){
  await q("INSERT INTO settings (kunci, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)", [KTA_PRESET_KEY, JSON.stringify(p)]);
}
/* Kumpulan path gambar latar yang masih dipakai preset — file jangan dihapus */
async function ktaBgUsedByPresets(){
  const used = new Set();
  try {
    const p = await ktaLoadPresets();
    (p.list || []).forEach(pr => ['front','back'].forEach(s => {
      const bg = pr.tpl && pr.tpl[s] && pr.tpl[s].bg_image;
      if(bg) used.add(String(bg));
    }));
  } catch(_) {}
  return used;
}

/* Daftar preset + mana yang sedang aktif */
router.get('/kta-presets', requireRole('admin','superadmin'), async (req, res) => {
  const p = await ktaLoadPresets();
  res.json({ ok: true, list: p.list, active: p.active, canEdit: req.user.level === 'superadmin' });
});

/* ============================================================
   Ekspor preset → file .json (untuk cadangan / pindah instalasi).
   Bila ?id= → satu preset; tanpa id → seluruh pustaka.
   Admin boleh ekspor (baca-saja), superadmin untuk impor.
   ============================================================ */
router.get('/kta-presets/export', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const p = await ktaLoadPresets();
    const stamp = new Date().toISOString().slice(0, 10);
    if(req.query.id){
      const item = p.list.find(x => x.id === req.query.id);
      if(!item) return res.status(404).json({ error: 'Preset tidak ditemukan.' });
      const slug = String(item.nama).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preset';
      res.setHeader('Content-Disposition', 'attachment; filename="sikeda-kartu-' + slug + '-' + stamp + '.json"');
      return res.json({ sikeda_preset_export: 1, versi: 1, diekspor: new Date().toISOString(), presets: [item] });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="sikeda-kartu-semua-preset-' + stamp + '.json"');
    res.json({ sikeda_preset_export: 1, versi: 1, diekspor: new Date().toISOString(), presets: p.list });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal mengekspor preset.' }); }
});

/* Impor preset dari file .json hasil ekspor (duplikat nama otomatis diberi akhiran) */
router.post('/kta-presets/import', requireRole('superadmin'), async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if(body.sikeda_preset_export !== 1 || !Array.isArray(body.presets))
      return res.status(400).json({ error: 'File bukan ekspor preset desain kartu SIKEDA.' });
    const incoming = body.presets
      .filter(x => x && typeof x === 'object' && x.tpl && typeof x.tpl === 'object')
      .map(x => ({
        nama: String(x.nama || 'Preset impor').slice(0, 55),
        tpl: ktaNormalize(x.tpl),
      }));
    if(!incoming.length) return res.status(400).json({ error: 'Tidak ada preset valid di dalam file.' });
    if(incoming.length > 20) return res.status(400).json({ error: 'Maksimal 20 preset per file impor.' });
    const p = await ktaLoadPresets();
    const added = [];
    for(const inc of incoming){
      if(p.list.length >= 20) break;
      let nama = inc.nama;
      if(p.list.some(x => x.nama.toLowerCase() === nama.toLowerCase())){
        let i = 2; while(p.list.some(x => x.nama.toLowerCase() === (nama + ' (' + i + ')').toLowerCase()) && i < 100) i++;
        nama = nama + ' (' + i + ')';
      }
      const item = { id: 'ktp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nama, dibuat: new Date().toISOString().slice(0, 10), tpl: inc.tpl };
      p.list.push(item);
      added.push(item.nama);
    }
    await ktaSavePresets(p);
    await logAct(req.user, 'Impor preset desain kartu', added.join(', ').slice(0, 120));
    res.json({ ok: true, message: added.length + ' preset diimpor: ' + added.join(', '), list: p.list, active: p.active });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal mengimpor preset.' }); }
});

/* Simpan desain aktif saat ini sebagai preset baru */
router.post('/kta-presets', requireRole('superadmin'), async (req, res) => {
  try {
    const nama = String((req.body && req.body.nama) || '').trim();
    if(!nama) return res.status(400).json({ error: 'Nama preset wajib diisi.' });
    const rows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    const tpl = ktaNormalize(rows[0] ? rows[0].nilai : null);
    const p = await ktaLoadPresets();
    if(p.list.length >= 20) return res.status(400).json({ error: 'Maksimal 20 preset. Hapus yang tidak terpakai.' });
    const item = { id: 'ktp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nama: nama.slice(0, 60), dibuat: new Date().toISOString().slice(0, 10), tpl };
    p.list.push(item);
    p.active = item.id;
    await ktaSavePresets(p);
    await logAct(req.user, 'Simpan preset desain kartu', item.nama);
    res.json({ ok: true, message: 'Preset \"' + item.nama + '\" tersimpan.', id: item.id, list: p.list, active: p.active });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal menyimpan preset.' }); }
});

/* Aktifkan preset → salin ke desain aktif (PDF, PNG & vcard otomatis ikut) */
router.put('/kta-presets/:id/activate', requireRole('superadmin'), async (req, res) => {
  try {
    const path = require('path');
    const p = await ktaLoadPresets();
    const item = p.list.find(x => x.id === req.params.id);
    if(!item) return res.status(404).json({ error: 'Preset tidak ditemukan.' });
    /* Bersihkan gambar latar desain aktif lama bila tak dipakai preset manapun */
    const oldRows = await q("SELECT nilai FROM settings WHERE kunci = 'kta_template' LIMIT 1");
    if(oldRows[0]){
      const oldT = ktaNormalize(oldRows[0].nilai);
      const used = await ktaBgUsedByPresets();
      ['front','back'].forEach(s => {
        const old = oldT[s] && oldT[s].bg_image;
        const now = item.tpl[s] && item.tpl[s].bg_image;
        if(old && old !== now && !used.has(String(old))){
          try {
            const fs = require('fs');
            const fp = path.join(require('../uploads-path').uploadsRoot(), '..', String(old).replace(/^\/+/, ''));
            if(fp.startsWith(require('../uploads-path').uploadsRoot()) && fs.existsSync(fp)) fs.unlinkSync(fp);
          } catch(_) {}
        }
      });
    }
    await q("INSERT INTO settings (kunci, nilai) VALUES ('kta_template', ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)", [JSON.stringify(item.tpl)]);
    p.active = item.id;
    await ktaSavePresets(p);
    await logAct(req.user, 'Aktifkan preset desain kartu', item.nama);
    res.json({ ok: true, message: 'Preset \"' + item.nama + '\" kini aktif.', data: item.tpl });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal mengaktifkan preset.' }); }
});

/* Duplikasi preset (isi sama, nama baru) */
router.post('/kta-presets/:id/duplicate', requireRole('superadmin'), async (req, res) => {
  try {
    const p = await ktaLoadPresets();
    const src = p.list.find(x => x.id === req.params.id);
    if(!src) return res.status(404).json({ error: 'Preset tidak ditemukan.' });
    if(p.list.length >= 20) return res.status(400).json({ error: 'Maksimal 20 preset. Hapus yang tidak terpakai.' });
    const base = src.nama.replace(/\s*\(salinan( \d+)?\)$/, '');
    let nama = base + ' (salinan)';
    let i = 2; while(p.list.some(x => x.nama.toLowerCase() === nama.toLowerCase()) && i < 100){ nama = base + ' (salinan ' + i + ')'; i++; }
    const item = { id: 'ktp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nama, dibuat: new Date().toISOString().slice(0, 10), tpl: ktaNormalize(src.tpl) };
    p.list.push(item);
    await ktaSavePresets(p);
    await logAct(req.user, 'Duplikasi preset desain kartu', src.nama + ' → ' + nama);
    res.json({ ok: true, message: 'Preset diduplikasi sebagai "' + nama + '".', id: item.id, list: p.list, active: p.active });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal menduplikasi preset.' }); }
});

/* Ganti nama preset dan/atau perbarui isinya dengan desain aktif terbaru */
router.put('/kta-presets/:id', requireRole('superadmin'), async (req, res) => {
  try {
    const p = await ktaLoadPresets();
    const item = p.list.find(x => x.id === req.params.id);
    if(!item) return res.status(404).json({ error: 'Preset tidak ditemukan.' });
    if(req.body && req.body.nama != null){
      const nama = String(req.body.nama).trim();
      if(!nama) return res.status(400).json({ error: 'Nama preset wajib diisi.' });
      item.nama = nama.slice(0, 60);
    }
    if(req.body && req.body.tpl) item.tpl = ktaNormalize(req.body.tpl);
    await ktaSavePresets(p);
    await logAct(req.user, 'Ubah preset desain kartu', item.nama);
    res.json({ ok: true, list: p.list });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Gagal mengubah preset.' }); }
});

/* Hapus preset (desain aktif tidak ikut terhapus) */
router.delete('/kta-presets/:id', requireRole('superadmin'), async (req, res) => {
  try {
    const p = await ktaLoadPresets();
    const i = p.list.findIndex(x => x.id === req.params.id);
    if(i < 0) return res.status(404).json({ error: 'Preset tidak ditemukan.' });
    const gone = p.list.splice(i, 1)[0];
    if(p.active === gone.id) p.active = null;
    await ktaSavePresets(p);
    await logAct(req.user, 'Hapus preset desain kartu', gone.nama);
    res.json({ ok: true, list: p.list, active: p.active });
  } catch(e){ res.status(500).json({ error: 'Gagal menghapus preset.' }); }
});

/* ============================================================
   Penyimpanan uploads — multi-driver (lokal + mirror remote gratis)
   GET    /api/storage         → status driver, CDN base, status kredensial per field
   PUT    /api/storage         → superadmin: pilih driver + CDN base + simpan kredensial
   DELETE /api/storage/creds   → superadmin: hapus kredensial tersimpan satu driver
   POST   /api/storage/test    → superadmin: uji tulis+hapus berkas uji
   Kredensial di DB disimpan TERENKRIPSI (AES-256-GCM) dan tidak pernah
   dikembalikan ke klien — hanya status {set, sumber} per field.
   ============================================================ */
router.get('/storage', requireRole('admin','superadmin'), async (req, res) => {
  try {
    res.json({ ok: true, data: {
      driver: await storage.driver(),
      cdnBase: await storage.cdnBase(),
      credStatus: await storage.credStatus(),
      canEdit: req.user.level === 'superadmin'
    } });
  } catch(e){ res.status(500).json({ error: 'Gagal membaca konfigurasi penyimpanan.' }); }
});

router.put('/storage', requireRole('superadmin'), async (req, res) => {
  try {
    const b = req.body || {};
    const d = String(b.driver || '').trim().toLowerCase();
    if(!storage.DRIVERS.includes(d)) return res.status(400).json({ error: 'Driver tidak dikenal.' });
    const baseIn = String(b.cdnBase || '').trim();
    if(baseIn && !/^https:\/\//.test(baseIn)) return res.status(400).json({ error: 'CDN base harus URL https:// .' });
    await q(`INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, ['storage_driver', d]);
    await q(`INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, ['storage_cdn_base', baseIn.slice(0, 200)]);
    storage.setDriver(d); storage.setCdnBase(baseIn);
    /* Kredensial per driver (opsional): hanya field terisi yang disimpan */
    let savedCreds = 0;
    if(b.creds && typeof b.creds === 'object' && storage.CREDS_FIELDS[d]){
      const partial = {};
      for(const f of Object.keys(storage.CREDS_FIELDS[d])){
        const v = b.creds[f];
        if(v !== undefined && String(v).trim() !== '' && !/^[•\u2022]+$/.test(String(v).trim())) partial[f] = String(v).trim().slice(0, 500);
      }
      if(Object.keys(partial).length){
        await storage.saveCreds(d, partial);
        savedCreds = Object.keys(partial).length;
      }
    }
    await logAct(req.user, 'Ubah penyimpanan uploads', 'driver=' + d + (savedCreds ? ', kredensial=' + savedCreds + ' field' : ''));
    res.json({ ok: true, driver: d, savedCreds, credStatus: await storage.credStatus() });
  } catch(e){ res.status(500).json({ error: 'Gagal menyimpan konfigurasi penyimpanan.' }); }
});

router.delete('/storage/creds', requireRole('superadmin'), async (req, res) => {
  try {
    const d = String(req.query.driver || '').trim().toLowerCase();
    if(!storage.CREDS_FIELDS[d]) return res.status(400).json({ error: 'Driver tidak mendukung kredensial tersimpan.' });
    await storage.saveCreds(d, null);
    await logAct(req.user, 'Hapus kredensial penyimpanan', d);
    res.json({ ok: true, driver: d, credStatus: await storage.credStatus() });
  } catch(e){ res.status(500).json({ error: 'Gagal menghapus kredensial.' }); }
});

router.post('/storage/test', requireRole('superadmin'), async (req, res) => {
  try {
    const d = await storage.driver();
    const rel = 'uploads/storage-test-' + Date.now() + '.txt';
    const buf = Buffer.from('SIKEDA storage test ' + new Date().toISOString(), 'utf8');
    const r = await storage.writeFile(rel, buf);
    await storage.removeFile(rel);
    const remoteOk = (d === 'local' || d === 'cdn') ? null : !!r.ok;
    const msg = (d === 'local' || d === 'cdn')
      ? 'Penyimpanan lokal OK' + (d === 'cdn' ? ' (CDN base dipakai untuk membaca).' : '.')
      : (remoteOk ? 'Lokal + mirror ' + d + ' OK — berkas uji tersimpan & dihapus.' : 'Lokal OK; mirror ' + d + ' GAGAL — periksa kredensial/kuota.');
    const quota = await storage.driverQuota();
    res.json({ ok: true, driver: d, remoteOk, message: msg, quota });
  } catch(e){ res.status(500).json({ error: e.message || 'Uji penyimpanan gagal.' }); }
});

/* GET /api/storage/files → daftar file lokal (superadmin; seksi migrasi file lama) */
router.get('/storage/files', requireRole('superadmin'), async (req, res) => {
  try {
    const d = await storage.driver();
    if(d === 'local' || d === 'cdn') return res.status(400).json({ error: 'Driver aktif lokal/CDN — migrasi tidak diperlukan.' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    let files = storage.listLocalFiles().filter(f => f.rel !== 'uploads/.gitkeep' && f.size > 0);
    const total = files.length;
    let remotes = null;
    if(String(req.query.withRemote) !== '0') remotes = await storage.listRemoteKeys();
    files = files.slice(offset, offset + limit).map(f => ({ rel: f.rel, size: f.size, mirrored: remotes ? remotes.has(f.rel) : null }));
    res.json({ ok: true, data: { driver: d, total, offset, limit, files } });
  } catch(e){ res.status(500).json({ error: 'Gagal membaca daftar berkas.' }); }
});

/* POST /api/storage/mirror {rel | rel:[...]} → kirim ulang file lokal yang sudah ada
   ke driver remote aktif (mirror murni; lokal tidak ditulis ulang). */
router.post('/storage/mirror', requireRole('superadmin'), async (req, res) => {
  try {
    const b = req.body || {};
    const rels = Array.isArray(b.rel) ? b.rel.map(String).slice(0, 100) : (b.rel ? [String(b.rel)] : []);
    if(!rels.length) return res.status(400).json({ error: 'Sertakan rel (string) atau rel (array, maks 100).' });
    const d = await storage.driver();
    if(d === 'local' || d === 'cdn') return res.status(400).json({ error: 'Driver aktif lokal/CDN — tidak ada mirror remote.' });
    const results = [];
    for(const rel of rels){
      try {
        await storage.mirrorLocal(rel);
        results.push({ rel, ok: true });
      } catch(e){ results.push({ rel, ok: false, err: e.message }); }
    }
    const okN = results.filter(r => r.ok).length;
    await logAct(req.user, 'Mirror berkas lama ke penyimpanan ' + d, okN + '/' + results.length + ' berkas');
    res.json({ ok: true, driver: d, total: results.length, ok: okN, results });
  } catch(e){ res.status(500).json({ error: e.message || 'Mirror gagal.' }); }
});

/* GET /api/storage/automig → status migrasi otomatis */
router.get('/storage/automig', requireRole('superadmin'), async (req, res) => {
  try {
    const s = await storage.automigLoad();
    const failedList = Object.entries(s.failed || {}).slice(0, 20).map(([rel, err]) => ({ rel, err }));
    res.json({ ok: true, data: {
      enabled: s.enabled, batch: s.batch, intervalSecs: s.intervalSecs,
      done: s.done.length, processed: s.processed, ok: s.ok, total: s.total,
      failedCount: Object.keys(s.failed || {}).length, failedList,
      lastRun: s.lastRun, lastErr: s.lastErr
    } });
  } catch(e){ res.status(500).json({ error: 'Gagal membaca status migrasi otomatis.' }); }
});

/* PUT /api/storage/automig {enabled, batch, intervalSecs} → atur (di Vercel: berlaku per cold start) */
router.put('/storage/automig', requireRole('superadmin'), async (req, res) => {
  try {
    const b = req.body || {};
    const cur = await storage.automigLoad();
    if(b.enabled !== undefined) cur.enabled = !!b.enabled;
    if(b.batch !== undefined) cur.batch = Math.min(Math.max(parseInt(b.batch, 10) || 10, 1), 100);
    if(b.intervalSecs !== undefined) cur.intervalSecs = Math.min(Math.max(parseInt(b.intervalSecs, 10) || 30, 10), 3600);
    await storage.automigSave(cur);
    await logAct(req.user, 'Pengaturan migrasi otomatis', 'enabled=' + cur.enabled + ', batch=' + cur.batch + ', interval=' + cur.intervalSecs + 's');
    res.json({ ok: true, data: { enabled: cur.enabled, batch: cur.batch, intervalSecs: cur.intervalSecs } });
  } catch(e){ res.status(500).json({ error: 'Gagal menyimpan pengaturan migrasi otomatis.' }); }
});

/* POST /api/storage/automig-run → jalankan satu langkah sekarang */
router.post('/storage/automig-run', requireRole('superadmin'), async (req, res) => {
  try {
    const r = await storage.automigStep();
    if(r.ok) await logAct(req.user, 'Migrasi otomatis: satu batch', r.okN + '/' + r.batch + ' berkas');
    res.json({ ok: true, result: r });
  } catch(e){ res.status(500).json({ error: e.message || 'Migrasi gagal.' }); }
});

/* ============================================================
   Beban sistem & antrian (busy queue)
   GET /api/busy  → status: mode, beban saat ini, ambang
   PUT /api/busy  → superadmin: mode, manual on/off, ambang, hold & release
   ============================================================ */
const busyMod = require('../busy');

router.get('/busy', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const s = busyMod.snapshot();
    s.canEdit = req.user.level === 'superadmin';
    res.json({ ok: true, data: s });
  } catch(e){ res.status(500).json({ error: 'Gagal membaca status beban.' }); }
});

router.put('/busy', requireRole('superadmin'), async (req, res) => {
  try {
    const b = req.body || {};
    if(b.mode !== undefined){
      const m = String(b.mode).trim().toLowerCase();
      if(!['auto','manual','off'].includes(m)) return res.status(400).json({ error: 'Mode harus auto, manual, atau off.' });
      await q(`INSERT INTO settings (kunci, nilai) VALUES ('busy_mode',?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, [m]);
    }
    if(b.manualOn !== undefined){
      const v = (b.manualOn === true || b.manualOn === 1 || b.manualOn === '1') ? '1' : '0';
      await q(`INSERT INTO settings (kunci, nilai) VALUES ('busy_manual_on',?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, [v]);
    }
    const intKeys = [['maxConc','busy_max_conc',1,100000],['maxLagMs','busy_max_lag_ms',20,60000],['holdSecs','busy_hold_secs',1,300],['releaseSecs','busy_release_secs',5,600]];
    for(const [prop, key, min, max] of intKeys){
      if(b[prop] !== undefined && b[prop] !== ''){
        const n = parseInt(b[prop], 10);
        if(isNaN(n) || n < min || n > max) return res.status(400).json({ error: 'Nilai ' + prop + ' harus angka ' + min + '-' + max + '.' });
        await q(`INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, [key, String(n)]);
      }
    }
    await busyMod.refreshCfg();
    await logAct(req.user, 'Ubah pengaturan beban sistem', JSON.stringify(b).slice(0, 180));
    res.json({ ok: true, data: busyMod.snapshot() });
  } catch(e){ res.status(500).json({ error: 'Gagal menyimpan pengaturan beban.' }); }
});

module.exports = router;
module.exports.SITE_DEFAULTS = SITE_DEFAULTS;
