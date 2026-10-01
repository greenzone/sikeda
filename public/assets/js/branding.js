/* ============================================================
   SIKEDA — Branding dinamis
   Ambil logo & identitas org dari /api/public/branding, lalu
   terapkan ke semua .brand-mark (logo) dan .brand-sub (subjudul).
   Logo berperilaku seperti aplikasi native: image object-fit
   cover dalam mark, tanpa reflow layout.

   FALLBACK DEFAULT (folder /favicon — dipakai bila admin belum
   mengunggah aset sendiri):
     - favicon tab browser → /favicon/favicon.svg (→ .ico → .png)
     - logo dashboard/landing → /favicon/web-app-manifest-192x192.png
     - avatar user kosong → /favicon/web-app-manifest-192x192.png
   ============================================================ */
(function(){
  'use strict';

  var SHIELD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5V11c0 5.2 3.6 9.9 9 11 5.4-1.1 9-5.8 9-11V6.5L12 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  /* Aset fallback bawaan (folder /favicon) — dipakai bila admin
     belum mengunggah favicon/logo sendiri. */
  var FALLBACK_FAVICON = '/favicon/favicon.svg';
  var FALLBACK_LOGO = '/favicon/web-app-manifest-192x192.png';
  var FALLBACK_AVATAR = '/favicon/web-app-manifest-192x192.png';

  /* Pasang favicon segera (tanpa menunggu API) supaya tab browser
     tidak pernah kosong — diganti bila admin punya favicon sendiri. */
  function setFavicon(href){
    var link = document.querySelector('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon';
    link.type = /\.svg(\?|$)/i.test(href) ? 'image/svg+xml' : 'image/png';
    link.href = href;
    document.head.appendChild(link);
  }
  try { setFavicon(FALLBACK_FAVICON); } catch(_){}

  /* Avatar: foto user → gambar; kosong/gagal → fallback /favicon. */
  window.SIKavatarImg = function(src, alt){
    alt = alt || 'Foto profil';
    if(src){
      return '<img src="' + src + '" alt="' + alt + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" '
        + 'onerror="this.onerror=null;this.src=\'' + FALLBACK_AVATAR + '?v=' + Date.now() + '\';">';
    }
    return '<img src="' + FALLBACK_AVATAR + '" alt="' + alt + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">';
  };

  function apply(data){
    var urlDash = data.logo_dashboard || '';
    var urlLand = data.logo_landing || '';

    /* Favicon dinamis (admin) — fallback default sudah terpasang di atas */
    if(data.favicon){
      setFavicon(data.favicon + '?v=' + Date.now());
    }

    document.querySelectorAll('.brand-mark').forEach(function(mark){
      /* Dashboard & halaman app → logo dashboard; halaman publik → logo landing.
         Bila admin belum mengunggah logo sama sekali → fallback /favicon. */
      var isApp = !!document.querySelector('.dash-shell, .dash-topbar, .dash-layout');
      var url = (isApp ? (urlDash || urlLand) : (urlLand || urlDash));
      if(!url) url = FALLBACK_LOGO;
      mark.classList.add('has-logo');
      mark.innerHTML = '<img src="' + url + '?v=' + Date.now() + '" alt="Logo" draggable="false">';
    });

    /* Wordmark .brand-name (SIKEDA) dibiarkan — identitas produk.
       Subjudul menampilkan nama organisasi + wilayah dari pengaturan.
       #sideOrgSub (sidebar dashboard) dikecualikan — tampil 'Dashboard'. */
    if(data.org_nama && data.org_wilayah){
      document.querySelectorAll('.brand-sub').forEach(function(el){
        if(el.id === 'sideOrgSub') return;
        el.textContent = data.org_nama + ' · ' + data.org_wilayah;
      });
    }

    /* Background hero (#beranda) dari pengaturan; tanpa gambar → fallback foto gratis online (Unsplash, lisensi terbuka).
       Overlay gradien di depan menjamin teks tetap kontras. */
    var hero = document.querySelector('.hero-dark');
    if(hero){
      var FALLBACKS = [
        'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=70',
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1920&q=70',
        'https://images.unsplash.com/photo-1556484687-30636164638b?auto=format&fit=crop&w=1920&q=70'
      ];
      var bg = data.hero_bg || FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
      hero.style.backgroundImage =
        'linear-gradient(188deg, rgba(18,37,68,.84), rgba(8,17,32,.93) 78%), url("' + bg + '")';
      hero.style.backgroundSize = 'auto, cover';
      hero.style.backgroundPosition = 'center';
      hero.style.backgroundRepeat = 'no-repeat';
    }
  }

  function boot(){
    if(!window.SIKAPI) return;
    /* Halaman dengan .dash-* → pakai logo dashboard lebih dulu */
    SIKAPI.get('/public/branding', { noRedirect: true }).then(function(res){
      apply(res.data || {});
    }).catch(function(){ /* offline: fallback default tetap tampil */ });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Tandai mark dengan logo supaya CSS image bisa aktif */
  var style = document.createElement('style');
  style.textContent = '.brand-mark.has-logo{padding:0;overflow:hidden;}' +
    '.brand-mark.has-logo img{width:100%;height:100%;object-fit:cover;display:block;}' +
    'img.avatar-fallback{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;}';
  document.head.appendChild(style);
})();
