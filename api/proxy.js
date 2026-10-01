/* ============================================================
   SIKEDA — Vercel: proxy static & uploads (run_worker pendamping)
   Menyajikan file publik + /uploads dari /tmp persisten (Disk) atau
   redirect ke Blob bila dikonfigurasi. API tidak lewat sini.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { uploadsRoot } = require('../src/uploads-path');

/* Cache manifest file /uploads di /tmp (persisi seperti Node server) */
const UPL = process.env.UPLOADS_DIR || '/tmp/sikeda-uploads';
function resolveUpload(p){
  const root = uploadsRoot();
  const full = path.join(root, p);
  if(!full.startsWith(root)) return null;
  return fs.existsSync(full) ? full : null;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

module.exports = async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if(p === '/') p = '/index.html';

    /* /uploads/* → dari disk persisten (/tmp via UPLOADS_DIR) */
    if(p.startsWith('/uploads/')){
      const relUpl = p.replace(/^\/+/, '');
      /* Driver remote aktif → redirect ke URL publik (CDN/Cloudinary/Supabase) */
      try {
        const storage = require('../src/storage');
        const d = await storage.driver();
        if(d !== 'local'){
          const u = await storage.publicUrl(relUpl);
          if(u){ res.statusCode = 302; res.setHeader('Location', u); return; }
        }
      } catch(_){ /* driver bermasalah → fallback disk lokal */ }
      const f = resolveUpload(relUpl);
      if(!f){
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Berkas tidak ditemukan.' }));
        return;
      }
      const ext = path.extname(f).toLowerCase();
      res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      fs.createReadStream(f).pipe(res);
      return;
    }

    /* Fallback aset branding default (folder favicon/) — dipakai bila
       admin belum mengunggah favicon/logo/avatar sendiri. */
    const BRAND_FALLBACKS = {
      '/favicon.ico': '/favicon/favicon.ico',
      '/apple-touch-icon.png': '/favicon/apple-touch-icon.png',
      '/site.webmanifest': '/favicon/site.webmanifest',
      '/web-app-manifest-192x192.png': '/favicon/web-app-manifest-192x192.png',
      '/web-app-manifest-512x512.png': '/favicon/web-app-manifest-512x512.png',
      '/favicon-96x96.png': '/favicon/favicon-96x96.png'
    };
    if(BRAND_FALLBACKS[p]) p = BRAND_FALLBACKS[p];

    /* Static publik */
    const root = path.join(__dirname, '..', 'public');
    const full = path.join(root, p);
    if(full.startsWith(root) && fs.existsSync(full) && fs.statSync(full).isFile()){
      const ext = path.extname(full).toLowerCase();
      res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
      const cache = ['.png','.jpg','.jpeg','.webp','.svg','.ico','.woff','.woff2','.css','.js'].includes(ext) ? 'public, max-age=86400' : 'public, max-age=0, must-revalidate';
      res.setHeader('Cache-Control', cache);
      fs.createReadStream(full).pipe(res);
      return;
    }

    /* Clean URL: /dashboard → dashboard.html (pola extensions:['html']) */
    const clean = path.join(root, p + '.html');
    if(p + '.html' !== p && fs.existsSync(clean)){
      res.setHeader('Content-Type', TYPES['.html']);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      fs.createReadStream(clean).pipe(res);
      return;
    }

    /* 404 */
    const nf = path.join(root, '404.html');
    if(fs.existsSync(nf)){
      res.statusCode = 404;
      res.setHeader('Content-Type', TYPES['.html']);
      fs.createReadStream(nf).pipe(res);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
    }
  } catch(e){
    console.error('proxy error:', e.message);
    /* Raw Node res (Vercel/test-server): tanpa res.status()/res.send() */
    if(!res.headersSent){
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.end('Server error');
  }
};
