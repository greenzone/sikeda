/* ============================================================
   SIKEDA — Branding dinamis
   Ambil logo & identitas org dari /api/public/branding, lalu
   terapkan ke semua .brand-mark (logo) dan .brand-sub (subjudul).
   Logo berperilaku seperti aplikasi native: image object-fit
   cover dalam mark, tanpa reflow layout.

   DEFAULT STATIS (folder /favicon, ikut kode — TIDAK terkait DB):
     - favicon tab browser → /favicon/favicon.svg (→ .ico → .png)
     - logo dashboard/landing → /favicon/web-app-manifest-192x192.png
     - avatar user kosong → /favicon/web-app-manifest-192x192.png
   Logo ini SELALU jadi dasar; begitu admin mengunggah logo di
   dashboard (tersimpan di database), logo otomatis menggantikan
   default di semua halaman — termasuk halaman login.

   ANTI LOGO RUSAK: URL logo dinamis diberi versi (v=timestamp)
   dan img yang gagal dimuat (mis. path /uploads hilang saat
   redeploy serverless) otomatis ditukar ke aset statis — halaman
   tidak pernah menampilkan logo pecah.
   ============================================================ */
(function(){
  'use strict';

  /* Aset default statis dari repo — tidak terkait database */
  var FALLBACK_FAVICON = '/favicon/favicon.svg';
  var FALLBACK_LOGO = '/favicon/web-app-manifest-192x192.png';

  /* Pasang favicon default segera (tanpa menunggu API) supaya tab
     browser tidak pernah kosong. */
  function setFavicon(href){
    var link = document.querySelector('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon';
    link.type = /\.svg(\?|$)/i.test(href) ? 'image/svg+xml' : 'image/png';
    link.href = href;
    document.head.appendChild(link);
  }
  try { setFavicon(FALLBACK_FAVICON); } catch(_){}

  /* URL dinamis memakai versi + tanda logo khusus agar bisa dikenali
     pada onerror (bukan URL statis default). */
  function logoImg(url, isApp){
    var versioned = url + (url.indexOf('?') > -1 ? '&' : '?') + 'v=' + Date.now();
    return '<img src="' + versioned + '" alt="Logo" draggable="false" data-sik-logo="1" '
      + 'onerror="this.onerror=null;this.removeAttribute(\'data-sik-logo\');this.src=\''
      + FALLBACK_LOGO + '\';">';
  }

  /* Avatar: foto user → gambar; kosong/gagal → fallback statis. */
  window.SIKavatarImg = function(src, alt){
    alt = alt || 'Foto profil';
    var style = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;';
    if(src){
      return '<img src="' + src + '" alt="' + alt + '" style="' + style + '" '
        + 'onerror="this.onerror=null;this.src=\'' + FALLBACK_LOGO + '?v=' + Date.now() + '\';">';
    }
    return '<img src="' + FALLBACK_LOGO + '" alt="' + alt + '" style="' + style + '">';
  };

  function apply(data){
    var urlDash = data.logo_dashboard || '';
    var urlLand = data.logo_landing || '';

    /* Favicon dinamis (admin) — fallback default sudah terpasang di atas */
    if(data.favicon){
      setFavicon(data.favicon + (data.favicon.indexOf('?') > -1 ? '&' : '?') + 'v=' + Date.now());
    }

    document.querySelectorAll('.brand-mark').forEach(function(mark){
      /* Dashboard & halaman app → logo dashboard; halaman publik → logo landing.
         Bila admin belum mengunggah logo sama sekali → default statis /favicon. */
      var isApp = !!document.querySelector('.dash-shell, .dash-topbar, .dash-layout');
      var url = (isApp ? (urlDash || urlLand) : (urlLand || urlDash));
      mark.classList.add('has-logo');
      mark.innerHTML = url ? logoImg(url, isApp)
        : '<img src="' + FALLBACK_LOGO + '" alt="Logo" draggable="false">';
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

    /* Background hero (#beranda) dari pengaturan; tanpa gambar → foto statis dari repo.
       Overlay gradien di depan menjamin teks tetap kontras. */
    var hero = document.querySelector('.hero-dark');
    if(hero){
      var bg = data.hero_bg || '';
      if(!bg){
        /* Bila ingin foto hero bawaan, letakkan /img/hero-default.jpg di repo */
        bg = '/img/hero-default.jpg';
      }
      hero.style.backgroundImage =
        'linear-gradient(188deg, rgba(18,37,68,.84), rgba(8,17,32,.93) 78%), url("' + bg + '")';
      hero.style.backgroundSize = 'auto, cover';
      hero.style.backgroundPosition = 'center';
      hero.style.backgroundRepeat = 'no-repeat';
    }
  }

  function boot(){
    if(!window.SIKAPI) return;
    SIKAPI.get('/public/branding', { noRedirect: true }).then(function(res){
      apply(res.data || {});
    }).catch(function(){ /* offline: default statis tetap tampil */ });
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
