/* ============================================================
   SIKEDA — Pemetaan konten kartu anggota ke data field
   Kartu dapat menampilkan field bawaan (nama, NPAPG/NIK, wilayah,
   jabatan, dsb.) maupun field form pendaftaran dinamis (intc &
   reg_extra_* — dari kolom anggota.reg_extra).
   Konfigurasi tersimpan di template kartu (settings 'kta_template')
   bagian front.fields / back.fields — array { field, label }.
   ============================================================ */
'use strict';

/* Nilai nilai bawaan (bukan field form) yang boleh dipakai kartu */
const BUILTIN = {
  nama:           { label: 'Nama anggota' },
  npapg:          { label: 'NPAPG (NIK terenkripsi)' },
  kode_unik:      { label: 'Nomor kartu' },
  jabatan:        { label: 'Jabatan' },
  desa:           { label: 'Desa / Ranting' },
  kecamatan:      { label: 'Kecamatan (DPC)' },
  wilayah:        { label: 'Desa - Kecamatan' },
  org_wilayah:    { label: 'Wilayah organisasi' },
  org_nama:       { label: 'Nama organisasi' },
  status:         { label: 'Status keanggotaan' },
  registered_at:  { label: 'Tanggal terdaftar' },
  exp_label:      { label: 'Masa berlaku (cth. Feb 2029)' },
  whatsapp:       { label: 'WhatsApp' },
  email:          { label: 'Email' },
  telegram:       { label: 'Telegram' },
  pekerjaan:      { label: 'Pekerjaan' },
  tempat_lahir:   { label: 'Tempat lahir' },
  tanggal_lahir:  { label: 'Tanggal lahir' },
  gender:         { label: 'Jenis kelamin' },
  alamat:         { label: 'Alamat' },
  qr_url:         { label: 'URL verifikasi' }
};

/* Kunci inti form pendaftaran (selalu tersedia sebagai pilihan) */
const FORM_CORE = ['nama', 'nik', 'tempat_lahir', 'tanggal_lahir', 'gender',
  'pekerjaan', 'kecamatan', 'desa', 'alamat', 'whatsapp', 'email', 'telegram'];

const KEY_RE = /^[a-z0-9_]{1,40}$/i;

/* ---------- Normalisasi daftar baris ({ field, label }) ---------- */
function normalizeRows(raw, defRows){
  const src = Array.isArray(raw) ? raw : (Array.isArray(defRows) ? defRows : []);
  const out = [];
  for(const r of src.slice(0, 12)){
    if(!r || typeof r !== 'object') continue;
    const field = String(r.field || '').trim();
    if(!KEY_RE.test(field)) continue;
    out.push({
      field,
      label: String(r.label != null && String(r.label).trim() !== '' ? String(r.label).trim().slice(0, 30) : '')
    });
  }
  return out;
}

/* Validasi list — hanya kunci yang dikenal (bawaan/form inti/reg_extra_*) */
function validateRows(rows){
  const list = normalizeRows(rows, null);
  for(const r of list){
    if(BUILTIN[r.field]) continue;
    if(FORM_CORE.includes(r.field)) continue;
    if(/^reg_extra_[a-z0-9_]{1,40}$/i.test(r.field)) continue;
    throw new Error('Field kartu tidak dikenal: ' + r.field);
  }
  return list;
}

/* ---------- Daftar pilihan untuk editor dashboard ---------- */
async function availableFields(){
  const out = [];
  for(const [key, v] of Object.entries(BUILTIN)) out.push({ key, label: v.label, group: 'Bawaan kartu' });
  try {
    const regfields = require('./regfields');
    for(const f of await regfields.loadFields()){
      if(!f.active) continue;
      out.push({ key: f.key, label: f.label + (f.key.startsWith('reg_extra_') ? ' (field tambahan)' : ' (form)'), group: 'Field pendaftaran' });
    }
  } catch(_){ /* DB bermasalah → bawaan saja */ }
  return out;
}

/* ---------- Resolver nilai: anggota + branding → nilai tiap field ---------- */
function fmtDateID(s){
  if(!s) return '';
  const d = new Date(String(s).length <= 10 ? String(s) + 'T00:00:00' : s);
  if(isNaN(d)) return String(s);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}
function expLabelFrom(registeredAt){
  const d = new Date(String(registeredAt).slice(0, 10) + 'T00:00:00');
  if(isNaN(d)) return '';
  d.setFullYear(d.getFullYear() + 3);
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

function buildValueMap(a, ctx){
  ctx = ctx || {};
  const extras = (() => {
    try { return a && a.reg_extra ? JSON.parse(a.reg_extra) : {}; } catch(_){ return {}; }
  })();
  const lineDesa = (a.desa && a.kecamatan) ? (a.desa + ' - ' + a.kecamatan) : (a.desa || a.kecamatan || '');
  const reg = a.registered_at ? fmtDateID(String(a.registered_at).slice(0, 10)) : '';
  return {
    nama: a.nama || '',
    npapg: ctx.npapg != null ? String(ctx.npapg) : '',
    kode_unik: a.kode_unik || '',
    jabatan: a.jabatan || '',
    desa: a.desa || '',
    kecamatan: a.kecamatan || '',
    wilayah: lineDesa,
    org_wilayah: ctx.org_wilayah || '',
    org_nama: ctx.org_nama || '',
    status: a.status || '',
    registered_at: reg,
    exp_label: ctx.expLabel || expLabelFrom(a.registered_at),
    whatsapp: a.whatsapp || '',
    email: a.email || '',
    telegram: a.telegram || '',
    pekerjaan: a.pekerjaan || '',
    tempat_lahir: a.tempat_lahir || '',
    tanggal_lahir: a.tanggal_lahir ? fmtDateID(String(a.tanggal_lahir).slice(0, 10)) : '',
    gender: a.gender || '',
    alamat: a.alamat || '',
    qr_url: ctx.memberUrl || '',
    /* field form inti (alias) & field tambahan */
    nik: ctx.nik != null ? String(ctx.nik) : (extras.nik || ''),
    ...extras
  };
}

module.exports = { BUILTIN, FORM_CORE, KEY_RE, normalizeRows, validateRows, availableFields, buildValueMap, expLabelFrom, fmtDateID };
