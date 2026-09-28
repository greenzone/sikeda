'use strict';
/* ============================================================
   Lokasi folder uploads — dapat dipindah di luar folder aplikasi.
   Di Hostinger Business/Business Premium (Node.js Web Apps), isi
   folder build DITIMPA setiap redeploy; berkas unggahan pengguna
   akan hilang bila disimpan di dalamnya. Set UPLOADS_DIR di
   environment (mis. /home/uXXXX/domains/DOMAIN/persistent-uploads)
   agar foto & konten aman antar deployment. Di VPS lokal tidak
   perlu diubah (default: <app>/public/uploads).
   ============================================================ */
const path = require('path');
const fs = require('fs');

function uploadsRoot() {
  const custom = process.env.UPLOADS_DIR;
  if (custom) {
    try { fs.mkdirSync(custom, { recursive: true }); } catch(e){}
    return custom;
  }
  return path.join(__dirname, '..', 'public', 'uploads');
}

/* Path relatif untuk disimpan di DB (dipakai URL /uploads/...) */
function uploadsRelDir(){ return 'uploads'; }

module.exports = { uploadsRoot, uploadsRelDir };
