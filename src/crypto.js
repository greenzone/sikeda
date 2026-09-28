/* ============================================================
   SIKEDA — Enkripsi NIK (AES-256-GCM) & hash password
   ============================================================ */
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const KEY = Buffer.from(process.env.NIK_ENC_KEY || '', 'hex');
if(KEY.length !== 32){
  throw new Error('NIK_ENC_KEY harus 32 byte hex (64 karakter) di .env');
}

/* Enkripsi: output "iv_hex:tag_hex:cipher_hex" */
function encryptNIK(plain){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

/* Dekripsi; kembalikan null bila format rusak */
function decryptNIK(stored){
  if(!stored) return null;
  const parts = String(stored).split(':');
  if(parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch(e){
    return null;
  }
}

/* Mask untuk tampilan: 3514••••••0001 */
function maskNIK(nik){
  const s = String(nik || '');
  if(s.length < 8) return s ? '••••' : '—';
  return s.slice(0,4) + '••••••' + s.slice(-4);
}

/* Password: bcrypt */
function hashPassword(plain){
  return bcrypt.hash(plain, 10);
}
function verifyPassword(plain, hash){
  return bcrypt.compare(plain, hash);
}

module.exports = { encryptNIK, decryptNIK, maskNIK, hashPassword, verifyPassword };
