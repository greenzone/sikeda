/* ============================================================
   SIKEDA — Init & seed database (npm run db:init)
   ============================================================ */
require('dotenv').config();
const crypto = require('crypto');
const { pool, q } = require('./db');
const { encryptNIK, hashPassword } = require('./crypto');

function sha256(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }

const KEC_DESA = {
  'Kedungwaru': ['Simo','Bendosari','Rejoso'],
  'Ngantru': ['Ngunut','Karangsari','Tulungrejo'],
  'Sumbergempol': ['Sumbergempol','Tanggung','Wonosari'],
  'Tulungagung': ['Kidul','Kauman','Kutoanyar'],
  'Boyolangu': ['Karangtalun','Sumberagung','Grogol']
};

async function main(){
  console.log('→ Membersihkan data lama …');
  await q('SET FOREIGN_KEY_CHECKS=0');
  for(const t of ['wilayah','users','anggota','otp_codes','activity_log','settings']){
    await q(`DROP TABLE IF EXISTS ${t}`);
  }
  await q('SET FOREIGN_KEY_CHECKS=1');

  console.log('→ Membuat skema …');

  await q(`CREATE TABLE IF NOT EXISTS wilayah (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kecamatan VARCHAR(80) NOT NULL,
    desa VARCHAR(80) NOT NULL,
    UNIQUE KEY uq_wilayah (kecamatan, desa)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) UNIQUE,
    password_hash VARCHAR(100),
    nama VARCHAR(120) NOT NULL,
    level ENUM('anggota','admin','superadmin') NOT NULL DEFAULT 'anggota',
    email VARCHAR(140),
    whatsapp VARCHAR(20),
    telegram VARCHAR(60),
    anggota_id INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS anggota (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_unik VARCHAR(30) UNIQUE NOT NULL,
    nama VARCHAR(120) NOT NULL,
    nik_enc VARCHAR(200) NOT NULL,
    nik_hash CHAR(64) NOT NULL,
    gender ENUM('Laki-laki','Perempuan') NOT NULL,
    tempat_lahir VARCHAR(80),
    tanggal_lahir DATE,
    pekerjaan VARCHAR(100),
    kecamatan VARCHAR(80) NOT NULL,
    desa VARCHAR(80) NOT NULL,
    alamat VARCHAR(255),
    whatsapp VARCHAR(20) NOT NULL,
    telegram VARCHAR(60),
    email VARCHAR(140),
    status ENUM('Pending','Revisi','Ditolak','Aktif') NOT NULL DEFAULT 'Pending',
    jabatan VARCHAR(80) DEFAULT 'Anggota',
    catatan VARCHAR(255),
    foto_path VARCHAR(255),
    ktp_path VARCHAR(255),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME NULL,
    approved_by INT NULL,
    INDEX idx_nikhash (nik_hash),
    INDEX idx_status (status),
    INDEX idx_wilayah (kecamatan, desa),
    INDEX idx_wa (whatsapp),
    INDEX idx_tg (telegram)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS otp_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target VARCHAR(140) NOT NULL,
    channel ENUM('wa','email','telegram') NOT NULL DEFAULT 'wa',
    code_hash VARCHAR(100) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts TINYINT DEFAULT 0,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_target (target)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    actor VARCHAR(60) NOT NULL,
    aksi VARCHAR(120) NOT NULL,
    detail VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS send_log (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS settings (
    kunci VARCHAR(60) PRIMARY KEY,
    nilai VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS data_drafts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anggota_id INT NOT NULL,
    payload JSON NOT NULL,
    status ENUM('draft','pending','disetujui','ditolak') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME NULL,
    reviewed_at DATETIME NULL,
    reviewed_by INT NULL,
    catatan_review VARCHAR(255) NULL,
    INDEX idx_draft_anggota (anggota_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await q(`CREATE TABLE IF NOT EXISTS pengumuman (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target ENUM('umum','personal') NOT NULL DEFAULT 'umum',
    anggota_id INT NULL,
    kategori ENUM('pengumuman','pemberitahuan','pesan') NOT NULL DEFAULT 'pengumuman',
    judul VARCHAR(160) NOT NULL,
    isi TEXT NOT NULL,
    prioritas ENUM('normal','penting') NOT NULL DEFAULT 'normal',
    channels VARCHAR(64) NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    INDEX idx_pg_target (aktif, target, anggota_id),
    INDEX idx_pg_read (read_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log('→ Seed wilayah …');
  for(const [kec, desaList] of Object.entries(KEC_DESA)){
    for(const desa of desaList){
      await q('INSERT INTO wilayah (kecamatan, desa) VALUES (?,?)', [kec, desa]);
    }
  }

  console.log('→ Seed anggota aktif & calon …');
  const rows = [
    /* kode, nama, nik, gender, ttl, pekerjaan, kec, desa, wa, email, status, jabatan, tgl_daftar */
    ['GLKR-TA-2026-000001','Budi Santoso','3514010101900001','Laki-laki','1990-01-01','Wiraswasta','Kedungwaru','Simo','081234567001','budi.santoso@mail.com','Aktif','Ketua DPD','2026-01-12'],
    ['GLKR-TA-2026-000002','Siti Rahmawati','3514014502850002','Perempuan','1985-02-05','Guru','Kedungwaru','Bendosari','081234567002','siti.r@mail.com','Aktif','Sekretaris','2026-01-14'],
    ['GLKR-TA-2026-000018','Ahmad Fauzi','3514011203920003','Laki-laki','1992-03-12','Karyawan Swasta','Ngantru','Ngunut','081234567018','ahmad.f@mail.com','Aktif','Anggota','2026-02-02'],
    ['GLKR-TA-2026-000034','Dewi Lestari','3514014811940004','Perempuan','1994-11-20','Perawat','Sumbergempol','Tanggung','081234567034','dewi.l@mail.com','Aktif','Anggota','2026-02-18'],
    ['GLKR-TA-2026-000047','Joko Prasetyo','3514010206880005','Laki-laki','1988-06-02','Petani','Tulungagung','Kauman','081234567047','joko.p@mail.com','Aktif','Bendahara','2026-03-05'],
    ['GLKR-TA-2026-000052','Rina Marlina','3514015310970006','Perempuan','1997-10-03','Mahasiswa','Tulungagung','Kidul','081234567052','rina.m@mail.com','Aktif','Anggota','2026-03-21'],
    ['GLKR-TA-2026-000071','Hendra Wijaya','3514012607900007','Laki-laki','1990-07-26','ASN','Boyolangu','Karangtalun','081234567071','hendra.w@mail.com','Aktif','Anggota','2026-04-09'],
    ['GLKR-TA-2026-000083','Nur Aini','3514015409000008','Perempuan','2000-09-04','Wirausaha Muda','Boyolangu','Grogol','081234567083','nuraini@mail.com','Aktif','Anggota','2026-04-25'],
    ['GLKR-TA-2026-000090','Slamet Riyadi','3514011908770009','Laki-laki','1977-08-19','Buruh','Sumbergempol','Wonosari','081234567090',null,'Aktif','Anggota','2026-05-11'],
    ['GLKR-TA-2026-000104','Fitri Handayani','3514016303960010','Perempuan','1996-03-23','Dokter','Ngantru','Karangsari','081234567104','fitri.h@mail.com','Aktif','Anggota','2026-05-30'],
    ['GLKR-TA-2026-000118','Agus Setiawan','3514012212850011','Laki-laki','1985-12-22','Pengemudi','Kedungwaru','Rejoso','081234567118','agus.s@mail.com','Aktif','Anggota','2026-06-14'],
    ['GLKR-TA-2026-000127','Maya Sari','3514015501990012','Perempuan','1999-01-15','Karyawan Swasta','Ngantru','Tulungrejo','081234567127','maya.sari@mail.com','Aktif','Anggota','2026-06-28'],
    ['GLKR-TA-2026-C0021','Rudi Hartono','3514010905890013','Laki-laki','1989-05-09','Sopir','Sumbergempol','Sumbergempol','081234568021','rudi.h@mail.com','Pending','Anggota','2026-08-27'],
    ['GLKR-TA-2026-C0022','Lilis Suryani','3514014708760014','Perempuan','1976-08-07','Pedagang','Tulungagung','Kutoanyar','081234568022',null,'Pending','Anggota','2026-08-28'],
    ['GLKR-TA-2026-C0023','Bayu Kurniawan','3514010211010015','Laki-laki','2001-11-02','Mahasiswa','Boyolangu','Sumberagung','081234568023','bayu.k@mail.com','Pending','Anggota','2026-08-29'],
    ['GLKR-TA-2026-C0024','Wulan Ramadhani','3514016607010016','Perempuan','2001-07-26','Fresh Graduate','Ngantru','Ngunut','081234568024','wulan.r@mail.com','Pending','Anggota','2026-08-30'],
    ['GLKR-TA-2026-C0018','Sugeng Purnomo','3514013103680017','Laki-laki','1968-03-31','Pensiunan','Kedungwaru','Simo','081234568018','sugeng.p@mail.com','Revisi','Anggota','2026-08-20'],
    ['GLKR-TA-2026-C0019','Dedi Mulyadi','3514012509790018','Laki-laki','1979-09-25','Mekanik','Tulungagung','Kauman','081234568019','dedi.m@mail.com','Ditolak','Anggota','2026-08-22']
  ];
  const codeToDbId = {};
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    const [kode,nama,nik,gender,ttl,kerja,kec,desa,wa,email,status,jabatan,daftar] = r;
    const res = await q(
      `INSERT INTO anggota (kode_unik,nama,nik_enc,nik_hash,gender,tempat_lahir,tanggal_lahir,pekerjaan,kecamatan,desa,alamat,whatsapp,email,status,jabatan,registered_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [kode,nama,encryptNIK(nik),sha256(nik),gender,'Tulungagung',ttl,kerja,kec,desa,'Jl. Merdeka No. '+(10+i),wa,email,status,jabatan,daftar+' 09:00:00']
    );
    codeToDbId[kode] = res.insertId;
  }

  console.log('→ Seed akun pengguna …');
  /* Anggota demo terhubung ke data anggotanya */
  await q(`INSERT INTO users (username, password_hash, nama, level, email, whatsapp, anggota_id)
           VALUES (?,?,?,?,?,?,?)`,
    ['anggota.fauzi', await hashPassword('anggota123'), 'Ahmad Fauzi', 'anggota',
     'ahmad.f@mail.com', '081234567018', codeToDbId['GLKR-TA-2026-000018']]);

  /* Akun demo: masuk tanpa OTP via tombol "Masuk Demo" (login cepat untuk uji) */
  await q(`INSERT INTO users (username, password_hash, nama, level, email, whatsapp, anggota_id)
           VALUES (?,?,?,?,?,?,?)`,
    ['demo.anggota', null, 'Budi Santoso (Demo)', 'anggota',
     'budi.santoso@mail.com', '081234567001', codeToDbId['GLKR-TA-2026-000001']]);

  await q(`INSERT INTO users (username, password_hash, nama, level, email, whatsapp)
           VALUES (?,?,?,?,?,?)`,
    ['admin', await hashPassword('admin123'), 'Rina Marlina', 'admin',
     'rina.m@mail.com', '081234567052']);

  await q(`INSERT INTO users (username, password_hash, nama, level, email, whatsapp)
           VALUES (?,?,?,?,?,?)`,
    ['superadmin', await hashPassword('super123'), 'Hendra Wijaya', 'superadmin',
     'hendra.w@mail.com', '081234567071']);

  console.log('→ Seed log aktivitas …');
  const logs = [
    ['admin','Menyetujui calon anggota','Rudi Hartono — contoh riwayat'],
    ['superadmin','Mengubah data krusial','Koreksi NIK — Dewi Lestari'],
    ['admin','Mengunduh rekap Excel','12 baris, filter Kedungwaru'],
    ['superadmin','Broadcast WhatsApp','Undangan musyawarah cabang — 412 penerima']
  ];
  for(const [actor,aksi,detail] of logs){
    await q('INSERT INTO activity_log (actor, aksi, detail) VALUES (?,?,?)', [actor, aksi, detail]);
  }

  console.log('→ Seed settings …');
  const settings = [
    ['org_nama','DPD Nusantara Bersatu'],
    ['org_wilayah','Kabupaten Tulungagung'],
    ['otp_channel_utama','wa'],
    ['otp_rate_limit','3/10menit'],
    ['id_prefix','GLKR-TA-2026-'],
    ['fonnte_api_key',''],
    ['hero_bg',''],
    ['favicon',''],
    ['telegram_bot_token',''],
    ['telegram_chat_id',''],
    ['smtp_host',''],
    ['smtp_port','587'],
    ['smtp_user',''],
    ['smtp_pass',''],
    ['logo_dashboard',''],
    ['logo_landing','']
  ];
  for(const [k,v] of settings){
    await q('INSERT INTO settings (kunci, nilai) VALUES (?,?)', [k, v]);
  }

  console.log('✓ Selesai. Akun demo:');
  console.log('  - superadmin / super123');
  console.log('  - admin / admin123');
  console.log('  - anggota.fauzi / anggota123 (OTP: 081234567018)');
  await pool.end();
}

main().catch(err => {
  console.error('✗ Gagal:', err.message);
  process.exit(1);
});
