/* ============================================================
   SIKEDA — Notifikasi outbound: Telegram Bot, Fonnte WA, Email
   Semua channel gagal-aman: error tidak pernah melempar ke caller.
   ============================================================ */
const { q } = require('./db');

async function getSettings(keys){
  const rows = await q(
    'SELECT kunci, nilai FROM settings WHERE kunci IN (' + keys.map(() => '?').join(',') + ')',
    keys
  ).catch(() => []);
  const s = {};
  rows.forEach(r => s[r.kunci] = (r.nilai || '').trim());
  return s;
}

/* ---------- Status gateway (untuk indikator di Pengaturan) ----------
   Dicatat setiap kali pengiriman dicoba: { ok, at, err } per kanal. */
const gwState = { fonnte: null, telegram: null, smtp: null };
function gwMark(key, ok, err){
  gwState[key] = { ok: !!ok, at: Date.now(), err: err || null };
}
function gwStatus(){
  return { fonnte: gwState.fonnte, telegram: gwState.telegram, smtp: gwState.smtp };
}

/* ---------- Telegram Bot API ---------- */
const TG_API_BASE = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
async function tgCall(token, method, payload){
  const resp = await fetch(TG_API_BASE + '/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000) /* jangan menggantung selamanya */
  });
  const out = await resp.json().catch(() => ({}));
  return { ok: resp.ok && out.ok === true, out };
}

/**
 * Kirim pesan Telegram.
 * @returns {Promise<{ok:boolean, err?:string}>}
 */
async function sendTelegram(chatId, text){
  try {
    const s = await getSettings(['telegram_bot_token']);
    if(!s.telegram_bot_token){ gwMark('telegram', false, 'Bot token belum diisi.'); return { ok: false, err: 'Bot token belum diisi.' }; }
    if(!chatId){ gwMark('telegram', false, 'Chat ID tujuan kosong.'); return { ok: false, err: 'Chat ID tujuan kosong.' }; }
    const r = await tgCall(s.telegram_bot_token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    });
    gwMark('telegram', r.ok, r.ok ? null : (r.out.description || 'Telegram error'));
    return r.ok ? { ok: true } : { ok: false, err: (r.out.description || 'Telegram error') };
  } catch(e){
    gwMark('telegram', false, e.message);
    return { ok: false, err: e.message };
  }
}

/**
 * Kirim pesan Telegram + dokumen (file) ke chat tertentu.
 * @param {{filename?:string, caption?:string}} opts
 * @returns {Promise<{ok:boolean, err?:string}>}
 */
async function sendTelegramDocument(chatId, buffer, opts){
  try {
    opts = opts || {};
    const s = await getSettings(['telegram_bot_token']);
    if(!s.telegram_bot_token) return { ok: false, err: 'Bot token belum diisi.' };
    if(!chatId) return { ok: false, err: 'Chat ID tujuan kosong.' };
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    if(opts.caption) fd.append('caption', opts.caption);
    fd.append('document', new Blob([buffer], { type: opts.mime || 'application/pdf' }), opts.filename || 'document.pdf');
    const resp = await fetch(TG_API_BASE + '/bot' + s.telegram_bot_token + '/sendDocument', {
      method: 'POST',
      body: fd
    });
    const out = await resp.json().catch(() => ({}));
    return (resp.ok && out.ok === true) ? { ok: true } : { ok: false, err: (out.description || 'Telegram error') };
  } catch(e){
    return { ok: false, err: e.message };
  }
}

/**
 * Kirim 1–n gambar (foto) ke chat Telegram — tampil langsung di chat,
 * tidak perlu dibuka sebagai dokumen. 1 gambar → sendPhoto;
 * ≥2 gambar → sendMediaGroup (album, caption di gambar pertama).
 * @param {{caption?:string}} opts
 * @returns {Promise<{ok:boolean, err?:string}>}
 */
async function sendTelegramPhotos(chatId, buffers, opts){
  try {
    opts = opts || {};
    const s = await getSettings(['telegram_bot_token']);
    if(!s.telegram_bot_token) return { ok: false, err: 'Bot token belum diisi.' };
    if(!chatId) return { ok: false, err: 'Chat ID tujuan kosong.' };
    const arr = Array.isArray(buffers) ? buffers : [buffers];
    if(!arr.length) return { ok: false, err: 'Tidak ada gambar untuk dikirim.' };
    if(arr.length === 1){
      const fd = new FormData();
      fd.append('chat_id', String(chatId));
      if(opts.caption) fd.append('caption', opts.caption);
      fd.append('photo', new Blob([arr[0]], { type: 'image/png' }), 'kartu.png');
      const resp = await fetch(TG_API_BASE + '/bot' + s.telegram_bot_token + '/sendPhoto', { method: 'POST', body: fd });
      const out = await resp.json().catch(() => ({}));
      return (resp.ok && out.ok === true) ? { ok: true } : { ok: false, err: (out.description || 'Telegram error') };
    }
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    const media = arr.map((_, i) => ({
      type: 'photo',
      media: 'attach://foto' + i,
      ...(i === 0 && opts.caption ? { caption: opts.caption } : {})
    }));
    fd.append('media', JSON.stringify(media));
    arr.forEach((b, i) => fd.append('foto' + i, new Blob([b], { type: 'image/png' }), 'kartu-' + (i + 1) + '.png'));
    const resp = await fetch(TG_API_BASE + '/bot' + s.telegram_bot_token + '/sendMediaGroup', { method: 'POST', body: fd });
    const out = await resp.json().catch(() => ({}));
    return (resp.ok && out.ok === true) ? { ok: true } : { ok: false, err: (out.description || 'Telegram error') };
  } catch(e){
    return { ok: false, err: e.message };
  }
}

/* Kirim ke channel penyimpanan data (chat_id dari Pengaturan). */
async function sendTelegramChannel(text){
  try {
    const s = await getSettings(['telegram_bot_token', 'telegram_chat_id']);
    if(!s.telegram_bot_token || !s.telegram_chat_id) return { ok: false, err: 'Telegram belum dikonfigurasi.' };
    const r = await tgCall(s.telegram_bot_token, 'sendMessage', {
      chat_id: s.telegram_chat_id,
      text,
      parse_mode: 'HTML'
    });
    gwMark('telegram', r.ok, r.ok ? null : (r.out.description || 'Telegram error'));
    return r.ok ? { ok: true } : { ok: false, err: (r.out.description || 'Telegram error') };
  } catch(e){
    gwMark('telegram', false, e.message);
    return { ok: false, err: e.message };
  }
}

/* ---------- Fonnte (WhatsApp) ---------- */
async function sendFonnte(targetWa, text){
  try {
    const s = await getSettings(['fonnte_api_key']);
    if(!s.fonnte_api_key){ gwMark('fonnte', false, 'API key kosong (mode dev).'); return { ok: false, err: 'API key Fonnte kosong (mode dev).' }; }
    const to = String(targetWa).replace(/\D/g, '').replace(/^0/, '62');
    const resp = await fetch((process.env.FONNTE_API_BASE || 'https://api.fonnte.com') + '/send', {
      method: 'POST',
      headers: { Authorization: s.fonnte_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: to, message: text }),
      signal: AbortSignal.timeout(10000)
    });
    const out = await resp.json().catch(() => ({}));
    const ok = resp.ok && out.status === true;
    gwMark('fonnte', ok, ok ? null : (out.reason || 'Fonnte error'));
    return ok ? { ok: true } : { ok: false, err: out.reason || 'Fonnte error' };
  } catch(e){
    gwMark('fonnte', false, e.message);
    return { ok: false, err: e.message };
  }
}

/**
 * Kirim pesan WhatsApp via Fonnte + file (URL publik).
 * Dokumentasi Fonnte: field "url" = URL file publik yang dilampirkan
 * ke pesan (pdf/dokumen/gambar).
 * @param {{url?:string}} opts
 * @returns {Promise<{ok:boolean, err?:string}>}
 */
async function sendFonnteFile(targetWa, text, opts){
  try {
    opts = opts || {};
    const s = await getSettings(['fonnte_api_key']);
    if(!s.fonnte_api_key) return { ok: false, err: 'API key Fonnte kosong (mode dev).' };
    const to = String(targetWa).replace(/\D/g, '').replace(/^0/, '62');
    const payload = { target: to, message: text };
    if(opts.url) payload.url = opts.url;
    const resp = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: s.fonnte_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await resp.json().catch(() => ({}));
    return (resp.ok && out.status === true) ? { ok: true } : { ok: false, err: out.reason || 'Fonnte error' };
  } catch(e){
    return { ok: false, err: e.message };
  }
}

/* ---------- Email (SMTP via nodemailer) ---------- */
let mailer = null;         // transporter cache
let mailerConfig = '';     // fingerprint konfigurasi

async function sendEmail(to, subject, text, html){
  try {
    const s = await getSettings(['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass']);
    if(!s.smtp_host || !s.smtp_user){ gwMark('smtp', false, 'SMTP belum dikonfigurasi (mode dev).'); return { ok: false, err: 'SMTP belum dikonfigurasi (mode dev).' }; }
    const fp = [s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_pass].join('|');
    if(!mailer || mailerConfig !== fp){
      const nodemailer = require('nodemailer');
      mailer = nodemailer.createTransport({
        host: s.smtp_host,
        port: Number(s.smtp_port) || 587,
        secure: Number(s.smtp_port) === 465,
        auth: { user: s.smtp_user, pass: s.smtp_pass }
      });
      mailerConfig = fp;
    }
    const mailOpts = { from: s.smtp_user, to, subject, text };
    if(html) mailOpts.html = html;
    await mailer.sendMail(mailOpts);
    gwMark('smtp', true);
    return { ok: true };
  } catch(e){
    gwMark('smtp', false, e.message);
    return { ok: false, err: e.message };
  }
}

/**
 * Kirim email + lampiran (Buffer).
 * @param {{filename?:string}} opts
 * @returns {Promise<{ok:boolean, err?:string}>}
 */
async function sendEmailAttachment(to, subject, text, buffer, opts){
  try {
    opts = opts || {};
    const s = await getSettings(['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass']);
    if(!s.smtp_host || !s.smtp_user) return { ok: false, err: 'SMTP belum dikonfigurasi (mode dev).' };
    const fp = [s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_pass].join('|');
    if(!mailer || mailerConfig !== fp){
      const nodemailer = require('nodemailer');
      mailer = nodemailer.createTransport({
        host: s.smtp_host,
        port: Number(s.smtp_port) || 587,
        secure: Number(s.smtp_port) === 465,
        auth: { user: s.smtp_user, pass: s.smtp_pass }
      });
      mailerConfig = fp;
    }
    await mailer.sendMail({
      from: s.smtp_user,
      to,
      subject,
      text,
      attachments: [{ filename: opts.filename || 'lampiran.pdf', content: buffer }]
    });
    return { ok: true };
  } catch(e){
    return { ok: false, err: e.message };
  }
}

/* ---------- Email dengan beberapa lampiran sekaligus ---------- */
async function sendEmailAttachments(to, subject, text, files){
  try {
    const s = await getSettings(['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass']);
    if(!s.smtp_host || !s.smtp_user) return { ok: false, err: 'SMTP belum dikonfigurasi (mode dev).' };
    const fp = [s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_pass].join('|');
    if(!mailer || mailerConfig !== fp){
      const nodemailer = require('nodemailer');
      mailer = nodemailer.createTransport({
        host: s.smtp_host,
        port: Number(s.smtp_port) || 587,
        secure: Number(s.smtp_port) === 465,
        auth: { user: s.smtp_user, pass: s.smtp_pass }
      });
      mailerConfig = fp;
    }
    await mailer.sendMail({
      from: s.smtp_user,
      to,
      subject,
      text,
      attachments: (Array.isArray(files) ? files : [files]).map(f => ({
        filename: f.filename || 'lampiran.bin',
        content: f.content
      }))
    });
    return { ok: true };
  } catch(e){
    return { ok: false, err: e.message };
  }
}

/* ---------- Broadcast data pendaftaran ke Telegram channel ---------- */
function formatPendaftaran(m, extra){
  return '<b>📋 PENDAFTARAN ANGGOTA — SIKEDA</b>\n\n'
    + '<b>Nama:</b> ' + m.nama + '\n'
    + '<b>NIK:</b> ' + (m.nik || '—') + '\n'
    + '<b>Gender:</b> ' + (m.gender || '—') + '\n'
    + '<b>Tempat, Tgl Lahir:</b> ' + (m.tempat_lahir || '—') + (m.tanggal_lahir ? ', ' + m.tanggal_lahir : '') + '\n'
    + '<b>Pekerjaan:</b> ' + (m.pekerjaan || '—') + '\n'
    + '<b>Wilayah:</b> ' + (m.kecamatan || '—') + ' / ' + (m.desa || '—') + '\n'
    + '<b>Alamat:</b> ' + (m.alamat || '—') + '\n'
    + '<b>WhatsApp:</b> ' + (m.whatsapp || '—') + '\n'
    + (m.email ? '<b>Email:</b> ' + m.email + '\n' : '')
    + (m.telegram ? '<b>Telegram:</b> ' + m.telegram + '\n' : '')
    + '<b>Tiket:</b> <code>' + m.kode_unik + '</code>\n'
    + '<b>Status:</b> ' + (m.status || 'Pending') + '\n'
    + (extra ? '\n' + extra : '');
}

async function broadcastPendaftaran(memberRow, extra){
  return sendTelegramChannel(formatPendaftaran(memberRow, extra));
}

/* ---------- Pencatatan status kirim (tabel send_log) ----------
   Dipakai kartu "Status Kirim Notifikasi" di dashboard. Tabel dibuat
   otomatis bila belum ada (idempoten, aman dipanggil berulang). */
let sendLogReadyN = null;
function ensureSendLogN(){
  if(!sendLogReadyN){
    sendLogReadyN = q(`CREATE TABLE IF NOT EXISTS send_log (
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
  return sendLogReadyN;
}
async function logSendN(pengumumanId, kanal, tujuan, ok, ket, createdBy){
  await ensureSendLogN();
  await q('INSERT INTO send_log (pengumuman_id, kanal, tujuan, ok, ket, created_by) VALUES (?,?,?,?,?,?)',
    [pengumumanId || null, String(kanal || ''), String(tujuan || ''), ok ? 1 : 0, String(ket || '').slice(0, 255), createdBy || null]);
}

/* ---------- Notifikasi perubahan status ke pendaftar ----------
   Kirim ke SEMUAA channel yang tersedia (WA + Telegram + email);
   yang belum terkonfigurasi dilewati diam-diam. Hasil per kanal
   dicatat ke send_log (opts.id = id anggota/pendaftar terkait,
   opts.createdBy = user yang memicu, mis. admin yang me-approve). */
async function notifStatus(target, text, subject, opts){
  opts = opts || {};
  const hasil = [];
  if(target.whatsapp){
    const r = await sendFonnte(target.whatsapp, text);
    if(r.ok) hasil.push('wa');
    await logSendN(opts.id, 'wa', target.whatsapp, r.ok, r.ok ? null : r.err, opts.createdBy).catch(function(){});
  }
  if(target.telegram && /^\d{5,}$/.test(String(target.telegram).replace(/^@/, ''))){
    const r = await sendTelegram(String(target.telegram).replace(/^@/, ''), text.replace(/\n/g, '\n'));
    if(r.ok) hasil.push('telegram');
    await logSendN(opts.id, 'telegram', String(target.telegram).replace(/^@/, ''), r.ok, r.ok ? null : r.err, opts.createdBy).catch(function(){});
  }
  if(target.email){
    const r = await sendEmail(target.email, subject || 'Status Pendaftaran — SIKEDA', text);
    if(r.ok) hasil.push('email');
    await logSendN(opts.id, 'email', target.email, r.ok, r.ok ? null : r.err, opts.createdBy).catch(function(){});
  }
  return hasil;
}

module.exports = { sendTelegram, sendTelegramDocument, sendTelegramPhotos, sendTelegramChannel, sendFonnte, sendFonnteFile, sendEmail, sendEmailAttachment, sendEmailAttachments, broadcastPendaftaran, formatPendaftaran, getSettings, notifStatus, logSend: logSendN, ensureSendLog: ensureSendLogN, gwStatus };
