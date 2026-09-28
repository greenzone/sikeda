'use strict';
/* ============================================================
   Lokasi folder uploads — dapat dipindah di luar folder aplikasi.
   - Node.js (Hostinger/Render/VPS): set UPLOADS_DIR agar aman dari
     penimpaan saat redeploy. Default: <app>/public/uploads.
   - Vercel: filesystem READ-ONLY kecuali /tmp → default otomatis
     /tmp/sikeda-uploads, dan path relatif 'uploads/...' dari DB
     diarahkan ke folder itu (bukan public/).
   ============================================================ */
const path = require('path');
const fs = require('fs');

const IS_VERCEL = !!process.env.VERCEL;

function uploadsRoot() {
  const custom = process.env.UPLOADS_DIR;
  if (custom) {
    try { fs.mkdirSync(custom, { recursive: true }); } catch(e){}
    return custom;
  }
  if (IS_VERCEL) {
    const tmp = '/tmp/sikeda-uploads';
    try { fs.mkdirSync(tmp, { recursive: true }); } catch(e){}
    return tmp;
  }
  return path.join(__dirname, '..', 'public', 'uploads');
}

/* Path relatif untuk disimpan di DB (dipakai URL /uploads/...)
   Vercel: file fisik ada di /tmp/sikeda-uploads/<nama>, jadi
   resolusi lokal = uploadsRoot() + '/<nama>' (tanpa 'public'). */
function uploadsRelDir(){ return 'uploads'; }

/* Lokal path untuk nama relatif 'uploads/xxx' */
function uploadsLocalPath(rel){
  const name = String(rel || '').replace(/^\/?(?:public\/)?uploads\//, '');
  return path.join(uploadsRoot(), name);
}

module.exports = { uploadsRoot, uploadsRelDir, uploadsLocalPath, IS_VERCEL };
