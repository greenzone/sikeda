/* ============================================================
   SIKEDA — Field form pendaftaran yang bisa di-customize
   Definisi field tersimpan sebagai JSON di settings (kunci
   'pendaftaran_fields'). Field CORE memetakan kolom tabel anggota;
   field tambahan (reg_extra_*) dikemas ke kolom JSON anggota.reg_extra.
   ============================================================ */
'use strict';
const { q } = require('./db');

const SETTING_KEY = 'pendaftaran_fields';
const MAX_EXTRA = 8;

/* Field inti — locked = tidak boleh nonaktif/dihapus (kolom DB NOT NULL
   atau krusial untuk alur verifikasi: NIK, wilayah, WhatsApp). */
const CORE = [
  { key: 'nama',          label: 'Nama lengkap',       type: 'text',    required: true,  active: true, locked: true,  order: 1 },
  { key: 'nik',           label: 'NIK',                type: 'text',    required: true,  active: true, locked: true,  order: 2 },
  { key: 'tempat_lahir',  label: 'Tempat lahir',       type: 'text',    required: true,  active: true, locked: false, order: 3 },
  { key: 'tanggal_lahir', label: 'Tanggal lahir',      type: 'date',    required: true,  active: true, locked: false, order: 4 },
  { key: 'gender',        label: 'Jenis kelamin',      type: 'select',  required: true,  active: true, locked: true,  order: 5,  options: ['Laki-laki', 'Perempuan'] },
  { key: 'pekerjaan',     label: 'Pekerjaan',          type: 'text',    required: true,  active: true, locked: false, order: 6 },
  { key: 'kecamatan',     label: 'Kecamatan',          type: 'wilayah', required: true,  active: true, locked: true,  order: 7 },
  { key: 'desa',          label: 'Desa / Kelurahan',   type: 'wilayah', required: true,  active: true, locked: true,  order: 8 },
  { key: 'alamat',        label: 'Alamat lengkap',     type: 'textarea',required: true,  active: true, locked: false, order: 9 },
  { key: 'whatsapp',      label: 'Nomor WhatsApp',     type: 'tel',     required: true,  active: true, locked: true,  order: 10 },
  { key: 'email',         label: 'Email',              type: 'email',   required: false, active: true, locked: false, order: 11 },
  { key: 'telegram',      label: 'Telegram (opsional)',type: 'text',    required: false, active: true, locked: false, order: 12 }
];

const FKEYS = new Set(CORE.map(f => f.key));
const EXTRA_RE = /^reg_extra_[a-z0-9_]{1,40}$/i;
const TYPES = ['text', 'textarea', 'tel', 'email', 'date', 'number', 'select'];

/* ---------- Normalisasi daftar field dari tersimpanan ----------
   Selalu mengembalikan 12 field CORE + maksimal MAX_EXTRA field tambahan,
   terurut berdasarkan `order`. Aman terhadap JSON rusak/parsial. */
function normalize(stored){
  const src = Array.isArray(stored) ? stored : [];
  const out = [];
  for(const c of CORE){
    const s = src.find(f => f && f.key === c.key) || {};
    out.push({
      key: c.key,
      label: String(s.label != null && String(s.label).trim() !== '' ? String(s.label).trim().slice(0, 60) : c.label),
      type: c.type,
      options: c.options || null,
      required: !!c.required,
      active: c.locked ? true : s.active !== false,
      locked: !!c.locked,
      order: Number.isFinite(+s.order) ? +s.order : c.order,
      placeholder: String(s.placeholder || '').slice(0, 80)
    });
  }
  let n = 0;
  for(const s of src){
    if(!s || !s.key || FKEYS.has(s.key)) continue;
    if(n >= MAX_EXTRA) break;
    const key = String(s.key);
    if(!EXTRA_RE.test(key)) continue;
    const type = TYPES.includes(s.type) ? s.type : 'text';
    out.push({
      key,
      label: String(s.label || key.replace(/^reg_extra_/, '')).trim().slice(0, 60) || key.replace(/^reg_extra_/, ''),
      type,
      options: type === 'select' ? (Array.isArray(s.options) ? s.options.map(v => String(v).slice(0, 60)).filter(Boolean).slice(0, 20) : []) : null,
      required: !!s.required,
      active: s.active !== false,
      locked: false,
      order: Number.isFinite(+s.order) ? +s.order : 100 + n,
      placeholder: String(s.placeholder || '').slice(0, 80)
    });
    n++;
  }
  out.sort((a, b) => (a.order - b.order) || a.key.localeCompare(b.key));
  return out;
}

/* Validasi sebelum simpan — kembalikan daftar ternormalisasi atau throw */
function validate(list){
  if(list == null) return normalize(null);
  if(!Array.isArray(list)) throw new Error('Format field tidak valid.');
  const seen = new Set();
  let extras = 0;
  for(const f of list){
    if(!f || !f.key) throw new Error('Ada field tanpa kunci.');
    const key = String(f.key);
    if(seen.has(key)) throw new Error('Field duplikat: ' + key);
    seen.add(key);
    if(!FKEYS.has(key)){
      if(!EXTRA_RE.test(key)) throw new Error('Kunci field tambahan tidak valid: ' + key);
      if(++extras > MAX_EXTRA) throw new Error('Maksimal ' + MAX_EXTRA + ' field tambahan.');
      if(f.type === 'select' && (!Array.isArray(f.options) || f.options.filter(Boolean).length < 1)){
        throw new Error('Field pilihan "' + (f.label || key) + '" butuh minimal satu opsi.');
      }
    }
  }
  for(const c of CORE){
    const f = list.find(x => x && x.key === c.key);
    if(!f) throw new Error('Field inti "' + c.label + '" tidak boleh dihapus.');
    if(c.locked && f.active === false) throw new Error('Field "' + c.label + '" wajib aktif.');
  }
  return normalize(list);
}

/* ---------- Kolom reg_extra pada tabel anggota (dibuat otomatis) ---------- */
let regExtraReady = null;
function ensureRegExtra(){
  if(!regExtraReady){
    regExtraReady = (async () => {
      const c = await q("SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anggota' AND COLUMN_NAME = 'reg_extra'");
      if(!c[0].n) await q('ALTER TABLE anggota ADD COLUMN reg_extra TEXT NULL');
    })().catch(e => { console.error('[regfields] kolom reg_extra:', e.message); regExtraReady = null; throw e; });
  }
  return regExtraReady;
}

/* Muat daftar field (untuk API admin & validasi /api/daftar) */
async function loadFields(){
  try {
    const rows = await q('SELECT nilai FROM settings WHERE kunci = ? LIMIT 1', [SETTING_KEY]);
    let stored = null;
    if(rows[0] && rows[0].nilai){ try { stored = JSON.parse(rows[0].nilai); } catch(_){ stored = null; } }
    return normalize(stored);
  } catch(e){
    console.error('[regfields] load:', e.message);
    return normalize(null);
  }
}

/* Muat hanya field aktif (untuk form publik) */
async function loadActiveFields(){
  return (await loadFields()).filter(f => f.active);
}

module.exports = {
  SETTING_KEY, CORE, FKEYS, MAX_EXTRA, EXTRA_RE,
  normalize, validate, loadFields, loadActiveFields, ensureRegExtra
};
