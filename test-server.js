'use strict';
/* Server dev lokal untuk MENGGJI paket deploy-vercel tanpa Vercel:
   - /api/* + /kta/* + /share-card/* + /qrcode/* → api/index.js
   - sisanya → api/proxy.js
   Pemakaian: node test-server.js [port] */
const http = require('http');
const PORT = Number(process.argv[2]) || 4588;

const indexFn = require('./api/index');
const proxyFn = require('./api/proxy');

http.createServer(async (req, res) => {
  try {
    const p = (req.url || '/').split('?')[0];
    const isApi = p.startsWith('/api/') || p.startsWith('/kta/') || p.startsWith('/share-card/') || p.startsWith('/qrcode/');
    const fn = isApi ? indexFn : proxyFn;
    await fn(req, res);
  } catch(e){
    console.error('dev server error:', e && (e.stack || e.message));
    if(!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message || 'server error' }));
  }
}).listen(PORT, () => console.log('SIKEDA vercel-test di http://localhost:' + PORT));
