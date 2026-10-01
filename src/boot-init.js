'use strict';
/* ============================================================
   SIKEDA — Inisialisasi boot (idempoten, aman dipanggil berulang)
   1. seedDefaults : instalasi baru (tabel settings kosong) otomatis
      mendapat seluruh pengaturan bawaan dari src/site-defaults.js —
      sehingga di domain baru pun semua tatanan sudah ada.
   2. ensureRegExtra : kolom anggota.reg_extra (field pendaftaran
      dinamis) dibuat bila belum ada.
   ============================================================ */
const { q } = require('./db');
const { DEFAULTS } = require('./site-defaults');
const regfields = require('./regfields');

let ready = null;

function seedDefaults(){
  return (async () => {
    const rows = await q('SELECT COUNT(*) AS n FROM settings');
    if(rows[0] && rows[0].n > 0) return 0; /* sudah ada isi — jangan sentuh */
    const entries = Object.entries(DEFAULTS);
    for(const [k, v] of entries){
      await q('INSERT INTO settings (kunci, nilai) VALUES (?,?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)', [k, v]);
    }
    console.log('[boot-init] settings baru di-seed:', entries.length, 'kunci bawaan');
    return entries.length;
  })().catch(e => { console.error('[boot-init] seed:', e.message); });
}

/* Naikkan settings.nilai ke MEDIUMTEXT agar data logo (base64) muat */
function ensureMediumtext(){
  return (async () => {
    const c = await q("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'nilai'");
    if(c[0] && /text/i.test(String(c[0].DATA_TYPE)) && !/medium|long/i.test(String(c[0].DATA_TYPE))){
      await q('ALTER TABLE settings MODIFY nilai MEDIUMTEXT');
      console.log('[boot-init] settings.nilai dinaikkan ke MEDIUMTEXT');
    }
  })().catch(e => console.error('[boot-init] mediumtext:', e.message));
}

function run(){
  if(!ready){
    ready = (async () => {
      await seedDefaults();
      await ensureMediumtext();
      try { await regfields.ensureRegExtra(); } catch(e){ /* sudah dicatat di modul */ }
    })().catch(e => { console.error('[boot-init]', e.message); ready = null; });
  }
  return ready;
}

module.exports = { run, seedDefaults };
