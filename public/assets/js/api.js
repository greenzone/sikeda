/* ============================================================
   SIKEDA — Klien API (dipakai semua halaman)
   Token JWT disimpan di localStorage: sikeda_token / sikeda_user
   ============================================================ */
(function(){
  'use strict';

  /* Di dev: API berjalan di :4321. Bila frontend disajikan server yang sama, pakai origin saat ini. */
  var API_BASE = (function(){
    if(location.port === '4321') return location.origin + '/api';
    if(location.protocol === 'file:') return 'http://localhost:4321/api';
    return location.origin + '/api';
  })();

  function token(){ return localStorage.getItem('sikeda_token'); }
  function savedUser(){
    try { return JSON.parse(localStorage.getItem('sikeda_user') || 'null'); }
    catch(e){ return null; }
  }

  async function request(method, path, body, opts){
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if(token()) headers['Authorization'] = 'Bearer ' + token();
    var res;
    try {
      res = await fetch(API_BASE + path, {
        method: method,
        headers: headers,
        body: body != null ? JSON.stringify(body) : undefined
      });
    } catch(netErr){
      throw new Error('Tidak dapat terhubung ke server. Pastikan `npm start` berjalan di port 4321.');
    }
    var json = null;
    try { json = await res.json(); } catch(e){ /* body kosong */ }
    if(!res.ok){
      var msg = (json && json.error) || ('HTTP ' + res.status);
      var err = new Error(msg);
      err.status = res.status;
      /* Sesi habis → bersihkan & lempar ke login */
      if(res.status === 401 && !opts.noRedirect && window.location.pathname.indexOf('login') === -1){
        SIKAPI.clearSession();
        if(window.location.pathname.indexOf('dashboard') === -1 || !/dashboard\.html\.?$/.test(window.location.pathname)){
          setTimeout(function(){ window.location.href = 'login.html'; }, 400);
        }
      }
      throw err;
    }
    return json;
  }

  window.SIKAPI = {
    base: API_BASE,
    token: token,
    user: savedUser,

    /* Payload JWT tanpa verifikasi tanda tangan — cukup untuk cek kedaluwarsa di klien.
       Verifikasi keaslian tetap tugas server (middleware). */
    decodeToken: function(){
      var t = token(); if(!t) return null;
      var parts = t.split('.'); if(parts.length !== 3) return null;
      try {
        var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        var json = decodeURIComponent(Array.prototype.map.call(atob(b64), function(c){
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(json);
      } catch(e){ return null; }
    },

    /* Sesi dianggap valid bila token + user ada DAN exp JWT belum lewat (margin 30 dtk).
       Dipakai semua halaman publik agar token basi diperlakukan sebagai belum login. */
    sessionValid: function(){
      if(!token() || !savedUser()) return false;
      var p = window.SIKAPI.decodeToken();
      if(p && p.exp && (p.exp * 1000) < (Date.now() - 30000)) return false;
      return true;
    },

    get: function(path, opts){ return request('GET', path, null, opts); },
    post: function(path, body, opts){ return request('POST', path, body, opts); },
    put: function(path, body, opts){ return request('PUT', path, body, opts); },
    del: function(path, opts){ return request('DELETE', path, null, opts); },

    /* Ambil respons mentah (mis. PDF blob) dengan header Authorization.
       Tidak parse JSON, tidak redirect ke login — penggguna menangani responsnya sendiri. */
    raw: function(url, method, body){
      method = method || 'GET';
      var headers = { 'Accept': 'application/pdf, */*' };
      if(token()) headers['Authorization'] = 'Bearer ' + token();
      return fetch(url, {
        method: method,
        headers: headers,
        body: body != null ? JSON.stringify(body) : undefined
      });
    },

    /* POST multipart-ish: JSON berisi dataUrl gambar (dipakai upload logo) */
    uploadJSON: function(path, body){ return request('POST', path, body); },

    setSession: function(tokenVal, userVal){
      localStorage.setItem('sikeda_token', tokenVal);
      localStorage.setItem('sikeda_user', JSON.stringify(userVal));
      window.dispatchEvent(new Event('sikeda:session'));
    },
    clearSession: function(){
      localStorage.removeItem('sikeda_token');
      localStorage.removeItem('sikeda_user');
      window.dispatchEvent(new Event('sikeda:session'));
    },
    hasRole: function(){
      var u = savedUser();
      return u ? u.level : null;
    }
  };

  /* ---------- Refresh token otomatis ----------
     Token berumur 8 jam. Bila tab tetap terbuka, sesi diperpanjang di belakang
     layar menjelang kedaluwarsa (H-30 mnt), lalu tiap 30 menit. Gagal senyap:
     kalau token sudah basi, panggilan API berikutnya yang akan menangani 401. */
  (function(){
    var TIMER = null;
    function msLeft(){
      try {
        var p = window.SIKAPI.decodeToken();
        if(!p || !p.exp) return null;
        return p.exp * 1000 - Date.now();
      } catch(e){ return null; }
    }
    function schedule(){
      if(TIMER){ clearTimeout(TIMER); TIMER = null; }
      var left = msLeft();
      if(left === null || left <= 0) return;
      var wait = Math.max(left - 30 * 60 * 1000, 60 * 1000);
      if(wait > 12 * 3600 * 1000) wait = 30 * 60 * 1000;
      TIMER = setTimeout(attempt, wait);
    }
    async function attempt(){
      try {
        if(!window.SIKAPI.sessionValid()) return;
        var r = await fetch(window.SIKAPI.base + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.SIKAPI.token() },
          body: '{}'
        });
        var j = null;
        try { j = await r.json(); } catch(e){}
        if(r.ok && j && j.ok && j.token){
          window.SIKAPI.setSession(j.token, j.user || window.SIKAPI.user);
        }
      } catch(e){ /* offline / server down — coba lagi pada jadwal berikutnya */ }
      schedule();
    }
    window.addEventListener('sikeda:session', schedule);
    schedule();
  })();
})();
