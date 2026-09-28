'use strict';
/* ============================================================
   SIKEDA — Buat akun superadmin pertama (produksi)
   Pemakaian:
     Interaktif : node scripts/create-superadmin.js
     Ter-pipe   : printf "user\nNama\nemail\npassword\n" | node scripts/create-superadmin.js
   Jalankan dari root paket setelah scripts/setup-db.sh sukses.
   ============================================================ */
require('dotenv').config();
const { q, pool } = require('../src/db');
const { hashPassword } = require('../src/crypto');

/* Baca seluruh stdin bila bukan TTY (input di-pipe), else null */
function readPipedStdin(){
  return new Promise((resolve) => {
    if(process.stdin.isTTY) return resolve(null);
    let d = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => resolve(d));
    /* jaring pengaman bila stdin tak pernah ditutup */
    setTimeout(() => resolve(d), 3000).unref();
  });
}

function askRl(rl, t){
  return new Promise(r => rl.question(t, a => r(String(a || '').trim())));
}

(async () => {
  let rl = null;
  try {
    const [existing] = await q("SELECT COUNT(*) AS n FROM users WHERE level IN ('admin','superadmin')");
    if(existing.n > 0){
      console.log(`✗ Sudah ada ${existing.n} akun pengurus. Skrip ini hanya untuk akun PERTAMA.`);
      console.log('  Untuk menambah pengurus, gunakan dashboard (menu Pengaturan).');
      process.exit(1);
    }

    let username, nama, email, pass;
    const piped = await readPipedStdin();

    if(piped !== null){
      const lines = piped.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      [username, nama, email, pass] = lines;
      if(!lines.length){
        console.log('✗ Input kosong. Isi: username, nama, email, password (satu per baris).');
        process.exit(1);
      }
    } else {
      const readline = require('readline');
      rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      console.log('=== Buat akun superadmin pertama SIKEDA ===');
      username = await askRl(rl, 'Username  : ');
      nama     = await askRl(rl, 'Nama      : ');
      email    = await askRl(rl, 'Email     : ');
      pass     = await askRl(rl, 'Password  : ');
    }

    if(!username || !nama || !pass){
      console.log('✗ Username, nama, dan password wajib diisi.');
      process.exit(1);
    }
    if(pass.length < 8){
      console.log('✗ Password minimal 8 karakter.');
      process.exit(1);
    }

    const hash = await hashPassword(pass);
    await q(
      "INSERT INTO users (username, password_hash, nama, level, email, is_active) VALUES (?,?,?,'superadmin',?,1)",
      [username, hash, nama, email || null]
    );
    console.log('✓ Superadmin dibuat: ' + username);
    console.log('  Login di ' + (process.env.APP_URL || 'https://DOMAIN_PRODUCTION') + '/login.html → tab Pengurus.');
    process.exit(0);
  } catch(e){
    console.error('✗ Gagal:', e.message);
    process.exit(1);
  } finally {
    if(rl) rl.close();
    pool.end().catch(() => {});
  }
})();
