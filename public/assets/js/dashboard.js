/* ============================================================
   SIKEDA — Dashboard core: sesi JWT, navigasi, routing
   ============================================================ */
(function(){
  'use strict';

  var IC = {
    chat:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.7-.8L3 20l1.2-5.2a8 8 0 0 1-.7-3.3A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    send:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    file:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    grid:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/></svg>',
    users:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="7" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    user:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="7" r="3.6" stroke="currentColor" stroke-width="1.7"/></svg>',
    inbox:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 12h-6l-2 3h-4l-2-3H2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    idcard:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="11" r="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M5.8 16.5c.6-1.4 1.8-2.1 3.2-2.1s2.6.7 3.2 2.1M15 10h3M15 13.5h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    map:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 4v13M15 6.5v13" stroke="currentColor" stroke-width="1.7"/></svg>',
    chart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    print:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><rect x="6" y="14" width="12" height="7" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>',
    upload:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    shield:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    globe:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h18M12 3c2.7 2.7 4 5.7 4 9s-1.3 6.3-4 9c-2.7-2.7-4-5.7-4-9s1.3-6.3 4-9z" stroke="currentColor" stroke-width="1.7"/></svg>',
    settings:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    check:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    download:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chev:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  window.DASH_ICONS = IC;

  /* ---------- Guard: harus login (token basi = belum login) ---------- */
  var SESSION_USER = SIKAPI.user();
  if(!SIKAPI.token() || !SESSION_USER || (SIKAPI.sessionValid && !SIKAPI.sessionValid())){
    SIKAPI.clearSession();
    location.href = 'login.html';
    return;
  }

  var ROLE = SESSION_USER.level; /* dari JWT session, bukan query param */
  var ROLES = {
    anggota:    { label:'Anggota',    cls:'badge-info' },
    admin:      { label:'Admin',      cls:'badge-warn' },
    superadmin: { label:'Superadmin', cls:'badge-gold' }
  };

  /* Grup menu sidebar — dikelompokkan sesuai konteks & fungsi */
  var NAV = {
    anggota: [
      { group:null,        items:[
        { id:'home',   label:'Beranda',     icon:'grid', countKey:'pgUnread' },
        { id:'profil', label:'Profil Saya', icon:'user' },
        { id:'kartu',  label:'Kartu Digital', icon:'idcard' }
      ]}
    ],
    admin: [
      { group:null,      items:[
        { id:'home', label:'Dashboard', icon:'grid' }
      ]},
      { group:'Website', items:[
        { id:'webHome',  label:'Beranda',   icon:'globe' },
        { id:'webLogin', label:'Halaman Login', icon:'shield' },
        { id:'webPages', label:'Halaman Lainnya', icon:'file' }
      ]},
      { group:'Keanggotaan', items:[
        { id:'calon',   label:'Calon Anggota',  icon:'inbox', countKey:'pending' },
        { id:'anggota', label:'Daftar Anggota', icon:'users', countKey:'draftPending' }
      ]},
      { group:'Komunikasi', items:[
        { id:'pengumuman', label:'Pengumuman', icon:'inbox' }
      ]},
      { group:'KTA & Desain', items:[
        { id:'kartu',   label:'Kartu Anggota', icon:'print' }
      ]},
      { group:'Data & Struktur', items:[
        { id:'wilayah', label:'Wilayah',       icon:'map' },
        { id:'impor',   label:'Import/Export', icon:'upload' }
      ]}
    ],
    superadmin: [
      { group:null,      items:[
        { id:'home', label:'Dashboard', icon:'grid' }
      ]},
      { group:'Website', items:[
        { id:'webHome',  label:'Beranda',   icon:'globe' },
        { id:'webLogin', label:'Halaman Login', icon:'shield' },
        { id:'webPages', label:'Halaman Lainnya', icon:'file' }
      ]},
      { group:'Keanggotaan', items:[
        { id:'calon',   label:'Calon Anggota',  icon:'inbox', countKey:'pending' },
        { id:'anggota', label:'Daftar Anggota', icon:'users', countKey:'draftPending' }
      ]},
      { group:'Komunikasi', items:[
        { id:'pengumuman', label:'Pengumuman', icon:'inbox' }
      ]},
      { group:'KTA & Desain', items:[
        { id:'kartu',   label:'Kartu Anggota', icon:'print' },
        { id:'kartuDesain', label:'Desain Kartu', icon:'idcard' }
      ]},
      { group:'Data & Struktur', items:[
        { id:'wilayah',  label:'Wilayah',             icon:'map' },
        { id:'struktur', label:'Struktur Organisasi', icon:'chart' },
        { id:'impor',    label:'Import/Export',       icon:'upload' }
      ]},
      { group:'Pengaturan', items:[
        { id:'pengaturan', label:'Pengaturan', icon:'settings' },
        { id:'tema', label:'Warna Tema', icon:'check' }
      ]},
      { group:null, items:[
        { id:'log', label:'Log Aktivitas', icon:'shield' }
      ]}
    ]
  };

  function flatNav(){
    var out = [];
    NAV[ROLE].forEach(function(g){ g.items.forEach(function(i){ out.push(i); }); });
    return out;
  }

  var TABBAR = {
    anggota:    ['home','profil','kartu'],
    admin:      ['home','webHome','calon','anggota','pengumuman','kartu','impor'],
    superadmin: ['home','webHome','calon','anggota','pengumuman','tema','log']
  };

  var currentView = 'home';
  /* Hitungan badge per countKey: 'pending' = calon anggota, 'draftPending' = pengajuan data,
     'pgUnread' = pengumuman belum dibaca (anggota) */
  var COUNTS = { pending: 0, draftPending: 0, pgUnread: 0 };
  /* Cache pengumuman untuk dropdown lonceng (anggota) */
  var pgCache = { list: [], unread: 0 };
  /* Cache hitungan untuk lonceng admin (draft + calon) */
  var adminCache = { draft: 0, calon: 0 };

  /* Avatar sesi: foto bila ada, fallback ikon user (bukan inisial) */
  function sessionAvatarHtml(){
    var fp = SESSION_USER.foto_path;
    if(fp){
      return '<div class="avatar" style="padding:0;overflow:hidden;position:relative;">'
        + '<span style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;">' + IC.user + '</span>'
        + '<img src="' + SIK.escape(fp) + '?v=' + Date.now() + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;position:relative;" '
        + 'onerror="this.style.display=\'none\';this.previousElementSibling.style.display=\'flex\';">'
        + '</div>';
    }
    return '<div class="avatar">' + IC.user + '</div>';
  }

  function renderSidebar(){
    var nav = document.getElementById('sideNav');
    nav.innerHTML = NAV[ROLE].map(function(group){
      var items = group.items.map(function(item){
        var cval = item.countKey ? (COUNTS[item.countKey] || 0) : 0;
        var count = cval > 0 ? '<span class="count">' + cval + '</span>' : '';
        return '<a href="#" class="side-link" data-view="' + item.id + '" onclick="UI.go(\'' + item.id + '\');return false;">'
          + (IC[item.icon] || IC.grid) + '<span>' + item.label + '</span>' + count + '</a>';
      }).join('');
      return (group.group ? '<div class="side-label">' + group.group + '</div>' : '') + items;
    }).join('');
    var sideUser = document.getElementById('sideUser');
    if(sideUser){
      sideUser.innerHTML =
        sessionAvatarHtml()
        + '<div style="min-width:0;"><div style="font-weight:700;font-size:.86rem;color:#fff;">' + SIK.escape(SESSION_USER.nama) + '</div>'
        + '<div class="tiny" style="color:rgba(238,242,248,.5);">' + ROLES[ROLE].label + '</div></div>';
    }
    var userIcBig = IC.user.replace('width="18" height="18"', 'width="58%" height="58%"');
    document.getElementById('topAvatar').innerHTML = SESSION_USER.foto_path
      ? '<img src="' + SIK.escape(SESSION_USER.foto_path) + '?v=' + Date.now() + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" onerror="this.remove()">'
      : userIcBig;
    var badge = document.getElementById('roleBadge');
    badge.textContent = ROLES[ROLE].label;
    badge.className = 'badge ' + ROLES[ROLE].cls;
  }

  function renderTabbar(){
    var tb = document.getElementById('tabbar');
    var items = TABBAR[ROLE];
    if(window.innerWidth <= 1000){
      tb.style.display = 'flex';
      document.querySelector('.dash-content').classList.add('has-tabbar');
    } else {
      tb.style.display = 'none';
      document.querySelector('.dash-content').classList.remove('has-tabbar');
    }
    tb.innerHTML = items.map(function(id){
      var item = flatNav().find(function(n){ return n.id === id; });
      var active = id === currentView;
      var cval = item.countKey ? (COUNTS[item.countKey] || 0) : 0;
      var badge = cval > 0 ? '<span class="tab-badge">' + cval + '</span>' : '';
      return '<a href="#" class="' + (active ? 'is-active' : '') + '" onclick="UI.go(\'' + id + '\');return false;">'
        + '<span class="tab-dot">' + (IC[item.icon] || IC.grid) + '</span><span>' + item.label + '</span>' + badge + '</a>';
    }).join('');
  }

  var SUBS = {
    home:      'Ringkasan keadaan keanggotaan hari ini',
    webHome:   'Kelola seluruh isi halaman depan per section',
    webLogin:  'Kelola konten halaman masuk',
    webPages:  'Verifikasi kartu, privasi, kontak & halaman lain',
    kartuDesain: 'Template desain kartu fisik: latar, posisi & teks',
    calon:     'Pengajuan menunggu tindakan Anda',
    anggota:   'Kelola dan telusuri anggota resmi',
    pengumuman:'Pengumuman & pesan untuk anggota (umum / personal)',
    wilayah:   'Master data kecamatan & desa',
    kartu:     'Terbitkan dan cetak kartu anggota',
    impor:     'Masuk/keluar data via Excel',
    struktur:  'Hierarki DPD → DPC → Ranting',
    tema:      'Warna utama & aksen website',
    log:       'Jejak audit seluruh aksi pengelola',
    pengaturan:'Konfigurasi sistem & akun pengelola',
    profil:    'Data diri & status keanggotaan Anda'
  };

  async function refreshPendingCount(){
    try {
      if(ROLE === 'anggota'){
        /* Anggota: badge beranda + lonceng = pengumuman belum dibaca */
        var pg = await SIKAPI.get('/pengumuman');
        COUNTS.pgUnread = (pg && pg.unread) || 0;
        pgCache.list = (pg && pg.data) || [];
        pgCache.unread = COUNTS.pgUnread;
        COUNTS.pending = 0;
        COUNTS.draftPending = 0;
      } else {
        var res = await SIKAPI.get('/stats');
        COUNTS.pending = res.data.pending || 0;
        COUNTS.draftPending = res.data.draftPending || 0;
        adminCache.calon = COUNTS.pending;
        adminCache.draft = COUNTS.draftPending;
      }
      renderSidebar();
      renderTabbar();
      updateBell();
    } catch(e){ /* diam */ }
  }

  /* ===== Lonceng notifikasi: anggota (pengumuman) & admin (tindakan) ===== */
  function bellCount(){
    return ROLE === 'anggota' ? COUNTS.pgUnread : (adminCache.draft + adminCache.calon);
  }
  function updateBell(){
    var btn = document.getElementById('bellBtn');
    var dot = document.getElementById('bellDot');
    if(!btn || !dot) return;
    var n = bellCount();
    btn.style.display = '';
    if(n > 0){ dot.textContent = n > 9 ? '9+' : String(n); dot.style.display = 'block'; }
    else dot.style.display = 'none';
  }
  function bellHtml(){
    /* ADMIN/SUPERADMIN: daftar tindakan yang menunggu */
    if(ROLE !== 'anggota'){
      var rows = [
        { k:'calon', n: adminCache.calon, label:'Calon anggota menunggu verifikasi', desc:'Tinjau & setujui pendaftaran baru.', view:'calon' },
        { k:'draft', n: adminCache.draft, label:'Perubahan data menunggu review', desc:'Setujui atau tolak pengajuan anggota.', view:'anggota' }
      ].filter(function(x){ return x.n > 0; });
      var h2 = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);">'
        + '<strong style="font-size:.9rem;">Menunggu tindakan Anda</strong>'
        + '</div>';
      if(!rows.length){
        h2 += '<div class="empty" style="padding:26px 14px;"><strong>Semua beres ✓</strong>Tidak ada tindakan yang menunggu.</div>';
      } else {
        h2 += rows.map(function(x){
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);cursor:pointer;" onclick="UI.go(\'' + x.view + '\');UI.closeBell();return false;">'
            + '<span style="min-width:34px;height:34px;border-radius:10px;background:var(--gold-100,#fbeecb);color:var(--gold-700,#8a6d1a);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:.9rem;">' + x.n + '</span>'
            + '<div style="min-width:0;"><div style="font-weight:700;font-size:.86rem;">' + x.label + '</div>'
            + '<div class="tiny muted">' + x.desc + '</div></div>'
            + '<span style="margin-left:auto;color:var(--ink-faint);">›</span></div>';
        }).join('');
      }
      return h2;
    }
    /* ANGGOTA: daftar pengumuman */
    var KAT = { pengumuman:['Pengumuman','badge-info'], pemberitahuan:['Pemberitahuan','badge-warn'], pesan:['Pesan','badge-gold'] };
    var items = pgCache.list.slice(0, 8);
    var h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);">'
      + '<strong style="font-size:.9rem;">Pengumuman</strong>'
      + (pgCache.unread > 0 ? '<a href="#" onclick="return UI.bellMarkAll();" style="font-size:.75rem;font-weight:700;color:var(--info,#2563eb);text-decoration:none;">Tandai semua</a>' : '')
      + '</div>';
    if(!items.length){
      h += '<div class="empty" style="padding:26px 14px;"><strong>Belum ada pengumuman</strong>Pemberitahuan dari pengurus akan tampil di sini.</div>';
    } else {
      h += '<div style="max-height:320px;overflow:auto;">' + items.map(function(u){
        var k = KAT[u.kategori] || KAT.pengumuman;
        var isNew = !u.read_at;
        return '<div style="padding:11px 14px;border-bottom:1px solid var(--line);' + (isNew ? 'background:rgba(37,99,235,.045);' : '') + '">'
          + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
          + '<span class="badge ' + k[1] + '">' + k[0] + '</span>'
          + (u.target === 'personal' ? '<span class="badge badge-success">Khusus Anda</span>' : '')
          + (u.prioritas === 'penting' ? '<span class="badge badge-danger">Penting</span>' : '')
          + (isNew ? '<span title="Belum dibaca" style="margin-left:auto;width:8px;height:8px;border-radius:50%;background:var(--info,#2563eb);display:inline-block;"></span>' : '')
          + '</div>'
          + '<div style="font-weight:700;font-size:.86rem;margin-top:6px;">' + SIK.escape(u.judul) + '</div>'
          + '<div class="tiny muted" style="margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + SIK.escape(u.isi) + '</div>'
          + (isNew ? '<button class="btn btn-soft btn-sm" style="margin-top:8px;padding:4px 10px;font-size:.72rem;" onclick="return UI.bellMarkOne(' + u.id + ', this);">Tandai dibaca</button>' : '')
          + '</div>';
      }).join('') + '</div>';
    }
    h += '<div style="padding:10px 14px;border-top:1px solid var(--line);text-align:center;">'
      + '<a href="#" onclick="UI.go(\'home\');UI.closeBell();return false;" style="font-size:.78rem;font-weight:700;color:var(--gold-600);text-decoration:none;">Buka beranda</a></div>';
    return h;
  }

  function go(view){
    currentView = view;
    document.querySelectorAll('.side-link').forEach(function(a){
      a.classList.toggle('is-active', a.dataset.view === view);
    });
    var item = flatNav().find(function(n){ return n.id === view; });
    document.getElementById('pageTitle').textContent = item ? item.label : 'Dashboard';
    document.getElementById('pageSub').textContent = SUBS[view] || '';
    UI.closeSidebar();
    var host = document.getElementById('dashContent');
    host.innerHTML = '<div class="skeleton" style="height:180px;"></div><div class="skeleton mt-16" style="height:60px;"></div><div class="skeleton mt-16" style="height:60px;"></div>';
    var fn = window.VIEWS && window.VIEWS[view];
    if(typeof fn === 'function'){
      Promise.resolve(fn(host, ROLE, SESSION_USER)).catch(function(e){
        host.innerHTML = '<div class="empty card"><strong>Gagal memuat</strong>' + SIK.escape(e.message) + '</div>';
      });
    }
    renderTabbar();
    window.scrollTo({top:0});
  }

  window.UI = {
    go: go,
    refreshBadges: refreshPendingCount,
    /* Lonceng notifikasi */
    toggleBell: function(ev){
      if(ev) ev.stopPropagation();
      var d = document.getElementById('bellDrop');
      if(!d) return false;
      if(d.style.display === 'block'){ d.style.display = 'none'; return false; }
      d.innerHTML = bellHtml();
      d.style.display = 'block';
      return false;
    },
    closeBell: function(){ var d = document.getElementById('bellDrop'); if(d) d.style.display = 'none'; },
    bellMarkOne: async function(id){
      try {
        await SIKAPI.post('/pengumuman/' + id + '/read', {});
        await refreshPendingCount();
        var d = document.getElementById('bellDrop');
        if(d && d.style.display === 'block') d.innerHTML = bellHtml();
        showToast('Pengumuman ditandai dibaca.', 'success');
      } catch(e){ showToast(e.message, 'danger'); }
      return false;
    },
    bellMarkAll: async function(){
      try {
        await SIKAPI.post('/pengumuman/read', {});
        await refreshPendingCount();
        var d = document.getElementById('bellDrop');
        if(d && d.style.display === 'block') d.innerHTML = bellHtml();
        showToast('Semua pengumuman ditandai dibaca.', 'success');
      } catch(e){ showToast(e.message, 'danger'); }
      return false;
    },
    openSidebar: function(){ document.getElementById('dashLayout').classList.add('sidebar-open'); },
    closeSidebar: function(){ document.getElementById('dashLayout').classList.remove('sidebar-open'); },
    logout: async function(){
      var nm = (SESSION_USER && (SESSION_USER.nama || SESSION_USER.username)) || '';
      var lv = (SESSION_USER && SESSION_USER.level) || '';
      var bye = { nama: nm, level: lv, t: Date.now() };
      /* Ambil status kartu SELAMAT sesi masih valid — untuk ditampilkan di halaman perpisahan */
      try {
        if(SESSION_USER && SESSION_USER.anggota_id && SIKAPI.sessionValid()){
          var pr = await Promise.race([
            SIKAPI.get('/me/profile', { noRedirect: true }),
            new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('timeout')); }, 1500); })
          ]);
          if(pr && pr.ok && pr.data){ bye.kode = pr.data.kode_unik; bye.status = pr.data.status; }
        }
      } catch(e){ /* generic saja */ }
      try { await SIKAPI.post('/auth/logout', {}); } catch(e){}
      SIKAPI.clearSession();
      try { sessionStorage.setItem('sikeda_bye', JSON.stringify(bye)); } catch(e){}
      setTimeout(function(){ location.href = 'logout.html'; }, 250);
    },
    icons: IC,
    role: ROLE,
    user: SESSION_USER,
    refreshCounts: refreshPendingCount
  };

  function init(){
    renderSidebar();
    /* Tutup dropdown lonceng saat klik di luar */
    document.addEventListener('click', function(e){
      var w = document.getElementById('bellWrap');
      if(w && !w.contains(e.target)) UI.closeBell();
    });
    /* Hash (#kartu, #profil, …) boleh menentukan view awal bila valid untuk role ini */
    var h = (location.hash || '').replace('#', '');
    var allowed = NAV[ROLE] && NAV[ROLE].some(function(g){ return g.items.some(function(i){ return i.id === h; }); });
    go(allowed ? h : 'home');
    refreshPendingCount();
    window.addEventListener('resize', renderTabbar);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
