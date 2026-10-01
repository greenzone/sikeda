/* ============================================================
   SIKEDA — Dashboard views (async, data dari API)
   ============================================================ */
(function(){
  'use strict';

  var IC = window.DASH_ICONS;

  var styleEl = document.createElement('style');
  styleEl.textContent =
    '.mobile-list{display:none;}'
    + '@media (max-width:680px){ .desktop-table{display:none;} .mobile-list{display:block;} }'
    + '.mini-stat{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}'
    + '@media (min-width:681px){ .mini-stat{grid-template-columns:repeat(4,1fr);} }'
    + '.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;}'
    + '.bar-col .bar{width:100%;max-width:26px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,var(--gold-400),var(--gold-600));min-height:6px;}'
    + '.bar-col .bar-lbl{font-size:.62rem;color:var(--ink-faint);font-weight:600;}'
    + '.dist-row{display:grid;grid-template-columns:110px 1fr 52px;gap:12px;align-items:center;padding:8px 0;font-size:.85rem;}'
    + '.dist-row .dist-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.row-actions{display:inline-flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:nowrap;}'
    + '.desktop-table td:last-child{text-align:right;}'
    + '.mobile-list .row-actions{justify-content:flex-end;}'
    + '.row-actions .btn{flex-shrink:0;white-space:nowrap;}'
    + '.th-right{text-align:right;}'
    + '.ck-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;}'
    + /* Grup terakhir yang ganjil membentang penuh — kartu tidak menggantung
         setengah kolom saat jumlah grup ganjil (mis. 1 grup di Halaman Lainnya) */
      '.ck-grid > .ck-group:last-child:nth-child(odd){grid-column:1 / -1;}'
    + '@media (max-width:760px){ .ck-grid{grid-template-columns:1fr;} }'
    + /* Kartu pratinjau langkah/paragraf (editor Halaman Lainnya) */
      '.ckb-wrap{margin-top:12px;padding:14px;border:1px dashed var(--line);border-radius:12px;background:rgba(255,255,255,.02);}'
    + '.ckb-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;}'
    + '.ckb-item{display:flex;gap:12px;align-items:flex-start;font-size:.92rem;line-height:1.55;}'
    + '.ckb-item.ckb-par .ckb-n{display:none;}'
    + '.ckb-item.ckb-par{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.03);}'
    + '.ckb-n{flex:0 0 26px;height:26px;border-radius:50%;background:var(--gold-soft,rgba(212,175,55,.15));color:var(--gold,#d4af37);font-weight:700;font-size:.8rem;display:flex;align-items:center;justify-content:center;}'
    + '@media (max-width:560px){ .ckb-item{font-size:.88rem;} }'
    + /* Kartu statistik: teks panjang (ID anggota, nama wilayah) tidak boleh
         terhimpit atau terpotong di layar kecil */
      '.stat-card{min-width:0;}'
    + '.sc-num{font-size:1.5rem;overflow-wrap:anywhere;word-break:break-word;line-height:1.25;}'
    + '.sc-mono{font-size:1rem;letter-spacing:.02em;}'
    + '@media (max-width:560px){ .sc-num{font-size:1.15rem;} .sc-mono{font-size:.9rem;} }'
    + /* Kartu bertumpuk langsung (adik-kakak) di konten dashboard: beri jarak
         seragam bila belum punya margin apa pun */
    + '.dash-content .card + .card:not(.stat-card):not([class*="mt-"]){margin-top:16px;}'
    + /* Tabbar: item tetap terbaca — bisa digulir samping bila sempit */
      '.tabbar{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;}'
    + '.tabbar::-webkit-scrollbar{display:none;}'
    + '.tabbar a{flex:1 0 64px;min-width:0;padding-left:4px;padding-right:4px;}'
    + '.tabbar a span:not(.tab-dot){max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.ck-group{border:1px solid var(--line);border-radius:var(--r-m);padding:16px;background:var(--paper);}'
    + /* Sticky-save: elemen tak boleh berhimpit saat teks panjang / layar sempit */
      '.sticky-save{flex-wrap:wrap;row-gap:10px;}'
    + '.sticky-save > div:first-child{flex:1 1 240px;min-width:0;}'
    + '.sticky-save .btn{flex-shrink:0;}'
    + '@media (max-width:680px){'
    + '  .sticky-save{flex-direction:column;align-items:stretch;gap:10px;}'
    + '  .sticky-save > div:first-child{flex:1 1 auto;}'
    + '  .sticky-save > .btn{width:100%;justify-content:center;}'
    + '}'
    + '.ck-group h4{margin:0 0 12px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);}'
    + '.ck-group .field{margin-bottom:12px;}'
    + '.ck-group .field:last-child{margin-bottom:0;}'
    + '.ck-sec{padding:0;overflow:hidden;margin-bottom:16px;}'
    + '.ck-sec:last-child{margin-bottom:0;}'
    + '.ck-sec summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;cursor:pointer;user-select:none;transition:background .15s;}'
    + '.ck-sec summary::-webkit-details-marker{display:none;}'
    + '.ck-sec summary:hover{background:rgba(19,26,36,.035);}'
    + '.ck-sec-title{font-weight:800;font-size:.95rem;}'
    + '.ck-chev{color:var(--gold-600);display:inline-flex;transition:transform .18s ease;}'
    + '.ck-sec[open] .ck-chev{transform:rotate(90deg);}'
    + '.ck-sec[open] summary{border-bottom:1px solid var(--line);}'
    + '.ck-sec .ck-grid{padding:16px;}'
    + /* Textarea editor konten: tinggi default nyaman untuk menulis isi panjang
         (min-height 280px, bisa ditarik lebih tinggi — resize:vertical */
      '.ck-group textarea.textarea{min-height:280px;line-height:1.6;}'
    + '.ck-group textarea.textarea[disabled]{min-height:280px;}'
    + /* Isi pengumuman & alamat profil: juga lebih lega */
      '#pgIsi{min-height:200px;line-height:1.6;}'
    + '.prof-edit textarea.textarea{min-height:120px;}'
    + '.tm-preset{display:grid;grid-template-columns:1fr 1fr;gap:9px;}'
    + '.tm-sw{width:18px;height:18px;border-radius:6px;display:inline-block;border:1px solid rgba(0,0,0,.14);flex-shrink:0;}'
    + '.tm-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start;}'
    + '@media (max-width:900px){ .tm-grid{grid-template-columns:1fr;} }'
    + '@media (max-width:560px){ .tm-preset{grid-template-columns:1fr;} }'
    + '.ck-prev-wrap{display:none;margin-top:24px;}'
    + '.ck-prev-wrap.is-open{display:block;}'
    + '.ck-prev-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border:1px solid var(--line);border-bottom:none;border-radius:14px 14px 0 0;background:var(--paper);}'
    + '.ck-prev-frame{width:100%;height:640px;border:1px solid var(--line);border-radius:0 0 14px 14px;background:#fff;display:block;}'
    + '/* ===== Pengumuman: layout halaman & popup ===== */'
    + '.pg-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px;}'
    + '.pg-head .pg-sub{margin:4px 0 0;}'
    + '.pg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}'
    + '.pg-stat{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);}'
    + '.pg-stat .p-ic{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:rgba(11,21,36,.06);color:var(--navy-700,#12203a);flex:none;}'
    + '.pg-stat .p-ic.gold{background:rgba(202,162,39,.14);color:#8a6d14;}'
    + '.pg-stat b{display:block;font-size:1.05rem;line-height:1.1;}'
    + '.pg-stat .tiny{margin-top:2px;}'
    + '.pg-chips{display:inline-flex;gap:6px;flex-wrap:wrap;vertical-align:middle;}'
    + '.pg-chip{font-size:.68rem;font-weight:600;padding:2px 9px;border-radius:99px;border:1px solid var(--line);background:var(--bg-soft,#f6f7fa);color:var(--muted);white-space:nowrap;}'
    + '.pg-chip.on-wa{background:#e7f7ee;border-color:#bfe8d2;color:#14724a;}'
    + '.pg-chip.on-tg{background:#e8f1fb;border-color:#c5dcf5;color:#1c5d99;}'
    + '.pg-chip.on-mail{background:#fdf1e2;border-color:#f3ddba;color:#96660f;}'
    + '.pg-title-wrap{display:flex;align-items:flex-start;gap:10px;min-width:0;}'
    + '.pg-title-wrap > div{min-width:0;}'
    + '.pg-title-wrap .list-sub{margin-top:3px;}'
    + '.pg-tbody td{vertical-align:middle;}'
    + '.pg-tbody .row-actions .btn{padding:6px 12px;}'
    + '.pg-form .field{margin:0 0 14px;}'
    + '.pg-form .field label{display:block;margin-bottom:6px;}'
    + '.pg-form .field:last-child{margin-bottom:0;}'
    + '.pg-form .grid-2{align-items:start;}'
    + '.pg-sec-title{font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);margin:2px 0 12px;display:flex;align-items:center;gap:8px;}'
    + '.pg-sec-title::after{content:"";flex:1;height:1px;background:var(--line-soft,rgba(0,0,0,.07));}'
    + '.pg-chk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}'
    + '.pg-chk{display:flex;align-items:center;gap:10px;border:1.5px solid var(--line);border-radius:12px;padding:11px 12px;cursor:pointer;user-select:none;background:var(--paper);transition:border-color .15s,background .15s,box-shadow .15s;}'
    + '.pg-chk:hover{border-color:#c8cfda;}'
    + '.pg-chk input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none;}'
    + '.pg-chk .ck-ic{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:rgba(11,21,36,.06);color:var(--navy-700,#12203a);flex:none;transition:.15s;}'
    + '.pg-chk .ck-ic svg{width:17px;height:17px;}'
    + '.pg-chk b{display:block;font-size:.86rem;line-height:1.2;}'
    + '.pg-chk .tiny{display:block;margin-top:1px;}'
    + '.pg-chk .ck-dot{width:18px;height:18px;border-radius:50%;border:2px solid #c3cad6;margin-left:auto;flex:none;display:inline-flex;align-items:center;justify-content:center;transition:.15s;}'
    + '.pg-chk .ck-dot::after{content:"";width:8px;height:8px;border-radius:50%;background:transparent;transition:.15s;}'
    + '.pg-chk:has(input:checked){border-color:var(--gold-600,#b8860b);background:rgba(202,162,39,.07);box-shadow:0 0 0 3px rgba(202,162,39,.12);}'
    + '.pg-chk:has(input:checked) .ck-dot{border-color:var(--gold-600,#b8860b);background:var(--gold-600,#b8860b);}'
    + '.pg-chk:has(input:checked) .ck-dot::after{background:#fff;}'
    + '@media (max-width:560px){'
    + '  .pg-chk-grid{grid-template-columns:1fr;gap:9px;}'
    + '  .pg-chk{padding:10px 12px;gap:9px;}'
    + '  .pg-chk b{font-size:.84rem;}'
    + '  .pg-chk .tiny{display:none;}'
    + '  .pg-chk .ck-ic{display:none;}'
    + '  .pg-stats{grid-template-columns:repeat(3,1fr);gap:8px;}'
    + '  .pg-stat{padding:9px 10px;gap:8px;border-radius:10px;}'
    + '  .pg-stat .p-ic{width:28px;height:28px;border-radius:8px;}'
    + '  .pg-stat b{font-size:.92rem;}'
    + '  .pg-stat .tiny{font-size:.62rem;line-height:1.25;}'
    + '}'
    + '.pg-sheet{width:min(640px,100%);max-height:min(86vh,760px);display:flex;flex-direction:column;padding:0;overflow:hidden;}'
    + '.pg-sheet-head{flex:none;padding:18px 22px 14px;border-bottom:1px solid var(--line-soft,rgba(0,0,0,.07));background:var(--paper);}'
    + '.pg-sheet-head .display-m{font-size:1.25rem;}'
    + '.pg-sheet-body{flex:1;min-height:0;overflow:auto;padding:16px 22px;background:var(--paper);}'
    + '.pg-sheet-foot{flex:none;display:flex;justify-content:flex-end;gap:10px;padding:13px 22px calc(15px + var(--safe-b,0px));border-top:1px solid var(--line-soft,rgba(0,0,0,.07));background:var(--paper);}'
    + '.pg-sheet .textarea{min-height:120px;resize:vertical;}'
    + '@media (max-width:560px){'
    + '  .pg-sheet-head{padding:14px 16px 12px;}'
    + '  .pg-sheet-head .display-m{font-size:1.08rem;}'
    + '  .pg-sheet-body{padding:14px 16px;}'
    + '  .pg-sheet-foot{padding:11px 16px calc(13px + var(--safe-b,0px));}'
    + '  .pg-sheet-foot .btn{flex:1;}'
    + '  .modal-backdrop.centered{padding:10px;}'
    + '}'
    + '.pg-note{display:flex;gap:8px;align-items:flex-start;background:var(--bg-soft,#f6f7fa);border:1px dashed var(--line);border-radius:10px;padding:10px 12px;}'
    + '.pg-mrow{display:block;}'
    + '.pg-mrow .pg-mrow-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:7px;}'
    + '.pg-mrow .pg-mrow-title{display:block;font-size:.95rem;line-height:1.35;}'
    + '.pg-mrow .list-sub{margin-top:3px;}'
    + '.pg-mrow .pg-mrow-meta{margin-top:6px;font-size:.72rem;color:var(--muted);}'
    + '.pg-mrow .row-actions{display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line-soft,rgba(0,0,0,.07));}'
    + '@media (max-width:760px){ .ck-prev-frame{height:480px;} }'
    /* Sticky toolbar daftar anggota (di bawah topbar) */
    + '.list-sticky{position:sticky;top:calc(var(--appbar-h) + 8px);z-index:30;background:rgba(246,244,238,.94);backdrop-filter:blur(10px);border:1px solid var(--line);border-radius:var(--r-m);box-shadow:var(--shadow-float);padding:12px 14px;margin-bottom:14px;}'
    + '@media (max-width:1000px){ .list-sticky{top:8px;} }'
    /* Timeline pengumuman */
    + '.tl{position:relative;margin:4px 0 0;padding-left:26px;}'
    + '.tl:before{content:"";position:absolute;left:9px;top:6px;bottom:6px;width:2px;background:linear-gradient(180deg,var(--gold-400),var(--paper-dim));border-radius:2px;}'
    + '.tl-item{position:relative;padding:2px 0 18px;}'
    + '.tl-item:last-child{padding-bottom:2px;}'
    + '.tl-dot{position:absolute;left:-26px;top:5px;width:18px;height:18px;border-radius:50%;background:var(--card);border:2px solid var(--gold-500);display:flex;align-items:center;justify-content:center;color:var(--gold-600);font-size:9px;font-weight:800;}'
    + '.tl-dot.is-unread{box-shadow:0 0 0 4px rgba(221,165,46,.18);}'
    + '/* Titik biru + hover tanda dibaca: pengumuman belum dibaca */'
    + '.tl-item{position:relative;}'
    + '.tl-item.is-new .tl-dot{border-color:var(--info,#2563eb);background:var(--info,#2563eb);box-shadow:0 0 0 4px rgba(37,99,235,.15);}'
    + '.tl-item.is-new .tl-dot::after{content:\'\';width:6px;height:6px;border-radius:50%;background:#fff;}'
    + '.tl-item.is-new{cursor:pointer;}'
    + '.tl-item.is-new:hover .tl-title{color:var(--info,#2563eb);}'
    + '.tl-item.is-new .tl-mark{display:inline-flex;margin-left:8px;}'
    + '.tl-mark{display:none;align-items:center;gap:4px;font-size:.68rem;font-weight:700;color:var(--info,#2563eb);}'
    + '.tl-mark svg{width:12px;height:12px;}'
    + '.tl-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}'
    + '.tl-time{font-size:.72rem;color:var(--ink-faint);}'
    + '.tl-new{background:var(--gold-500);color:var(--navy-950);font-size:.62rem;font-weight:800;padding:1px 7px;border-radius:var(--r-full);letter-spacing:.04em;}'
    + '.tl-body{font-size:.88rem;color:var(--ink-soft);margin-top:4px;white-space:pre-line;}'
    /* Layout profil anggota 2 kolom: data pribadi (kiri) + Kartu Anda (kanan) */
    + '.prof-2col{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;align-items:start;}'
    + '@media (max-width:920px){ .prof-2col{grid-template-columns:1fr;} }'
    + /* ===== Desain Kartu Fisik: layout 2 kolom (panel kiri, pratinjau kanan) ===== */
      '.kd-wrap{display:grid;grid-template-columns:minmax(0,560px) minmax(0,1fr);gap:24px;align-items:start;}'
    + '.kd-right{position:sticky;top:calc(var(--appbar-h) + 88px);}'
    + '@media (max-width:1100px){ .kd-wrap{grid-template-columns:1fr;} .kd-right{position:static;} }'
    + '.kd-live .kta-card{box-shadow:0 18px 40px -18px rgba(23,16,0,.45);}'
    + '.kd-live .kf-photo .kf-ini{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}'
    /* Pratinjau Desain Kartu: tiruan presisi markup & font kartu PDF (buildCardHtml)
       agar pratinjau = vcard.html = PDF. Base .kf-data/.kf-code di dashboard CSS
       salah memindahkan blok — dinetralkan di sini. */
    + '.kd-live .kf-data{max-width:82cqw;text-shadow:0 .2cqw 0 rgba(255,255,255,.5),0 0 1cqw rgba(255,255,255,.55);}'
    + '.kd-live .kf-nama{text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.12cqw;line-height:1.1;}'
    + '.kd-live .kf-wil,.kd-live .kf-wil2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;font-weight:600;color:#191300;}'
    + '.kd-live .kf-wil2{margin-top:.5cqw;}'
    + '.kd-live .kf-npapg{font-family:Sora,Arial,sans-serif;font-weight:700;font-size:3.6cqw;margin-top:.45cqw;line-height:1.2;white-space:nowrap;}'
    + '.kd-live .kf-code{bottom:2.3cqw;right:3.6cqw;text-align:right;}'
    + '.kd-live .kf-code .val{font-family:Sora,Arial,sans-serif;font-weight:800;font-size:1.55cqw;letter-spacing:.16cqw;color:#241c02;text-transform:uppercase;}'
    + '.kd-live .kf-org{text-align:center;letter-spacing:.34cqw;}'
    + '.kd-live .kf-sub{text-align:center;letter-spacing:.62cqw;}'
    /* Drag & drop elemen langsung di kartu pratinjau */
    + '.kd-live [data-kddrag]{cursor:grab;touch-action:none;}'
    + '.kd-live [data-kddrag]:hover{outline:1.5px dashed rgba(25,19,0,.35);outline-offset:3px;}'
    + '.kd-live .kf-dragging{cursor:grabbing !important;opacity:.88;}'
    + '.kd-live.kd-noselect{user-select:none;-webkit-user-select:none;}'
    + '.kd-panel input[type=range]{accent-color:var(--gold-500);}'
    /* Galeri preset: thumbnail 2 sisi digambar dari data template */
    + '.kd-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px;margin-top:14px;}'
    + '.kd-gal-item{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:8px;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:border-color .15s,box-shadow .15s;text-align:left;}'
    + '.kd-gal-item:hover{border-color:var(--gold-500);box-shadow:0 6px 16px -10px rgba(23,16,0,.35);}'
    + '.kd-gal-item.is-active{border-color:var(--gold-500);box-shadow:0 0 0 1px var(--gold-500);}'
    + '.kd-gal-thumb{position:relative;aspect-ratio:1.586/1;border-radius:8px;overflow:hidden;border:1px solid var(--line-soft);display:flex;}'
    + '.kd-gal-face{position:relative;height:100%;}'
    + '.kd-gal-dots{position:absolute;background:rgba(12,26,48,.30);border:1px solid rgba(12,26,48,.45);border-radius:1.5px;}'
    + '.kd-gal-photo{position:absolute;background:linear-gradient(160deg,#fff,#cfd9e6);border:1px solid rgba(0,0,0,.14);border-radius:2px;}'
    + '.kd-gal-chip{position:absolute;bottom:4px;right:4px;font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:999px;background:rgba(8,17,32,.75);color:#fff;}'
    + '.kd-gal-name{font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.kd-gal-meta{font-size:11px;color:var(--ink-faint);display:flex;align-items:center;justify-content:space-between;gap:6px;}'
    /* Avatar fallback ikon user */
    + '.icon-badge{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(150deg,var(--navy-600),var(--navy-900));color:var(--gold-400);flex-shrink:0;}'
    /* Banner & panel draft perubahan data */
    + '.draft-banner{border:1px solid var(--line);border-left:4px solid var(--gold-500);background:var(--gold-100);border-radius:12px;padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;}'
    + '.draft-banner.is-pending{border-left-color:#b7791f;background:#fdf6e3;}'
    + '.draft-review{border:1px dashed var(--gold-500);background:var(--gold-100);border-radius:12px;padding:12px 14px;margin-top:14px;}'
    + '.diff-row{display:flex;gap:10px;align-items:flex-start;padding:7px 10px;border-radius:8px;font-size:13px;}'
    + '.diff-row + .diff-row{margin-top:4px;}'
    + '.diff-changed{background:var(--gold-100, #fdf6e3);}'
    + '.diff-k{min-width:130px;color:var(--muted);font-weight:600;}'
    + '.diff-arrow{color:var(--muted);margin:0 6px;}'
    + '.diff-old{color:var(--danger,#b91c1c);text-decoration:line-through;word-break:break-word;}'
    + '.diff-new{color:#166534;font-weight:700;word-break:break-word;}'
    + '.crop-backdrop{position:fixed;inset:0;background:rgba(10,15,30,.62);backdrop-filter:blur(4px);z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;}'
    + '.crop-modal{background:var(--paper,#fff);border-radius:18px;max-width:460px;width:100%;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.35);}'
    + '.crop-stage{position:relative;margin:14px auto;border-radius:14px;overflow:hidden;touch-action:none;'
    + '  width:min(300px,72vw);height:min(400px,96vw);background:repeating-conic-gradient(#e8eaf0 0% 25%, #f6f7fb 0% 50%) 50%/18px 18px;user-select:none;}'
    + '.crop-stage img{position:absolute;top:0;left:0;cursor:grab;max-width:none;will-change:transform;}'
    + '.crop-stage img.dragging{cursor:grabbing;}'
    + '.crop-hint{font-size:12px;color:var(--muted);text-align:center;margin-top:6px;}'
    + '.crop-zoom{display:flex;align-items:center;gap:10px;margin-top:10px;}'
    + '.crop-zoom input[type=range]{flex:1;accent-color:var(--primary,#1a3358);}'
  document.head.appendChild(styleEl);

  /* ---------- Shared builders ---------- */
  function esc(s){ return SIK.escape(s); }

  /* Avatar dengan thumbnail foto anggota (fallback: inisial).
     dipakai di tabel daftar anggota, calon, dan antrean kartu. */
  var IC_USER_SVG = '<svg width="55%" height="55%" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="7" r="3.6" stroke="currentColor" stroke-width="1.7"/></svg>';

  /* Fallback global: gambar foto gagal dimuat → fallback default /favicon */
  var SIKAVA_FALLBACK = '/favicon/web-app-manifest-192x192.png';
  window.SIKavatarFallback = function(img){
    if(!img) return;
    img.onerror = null;
    var src = String(img.getAttribute('src') || '');
    if(src.indexOf(SIKAVA_FALLBACK) === 0) return;
    img.src = SIKAVA_FALLBACK + '?v=' + Date.now();
  };
  /* Avatar tanpa foto → gambar fallback default (folder /favicon) */
  function fallbackAvatar(size){
    var s = size || 30;
    var st = 'width:' + s + 'px;height:' + s + 'px;border-radius:' + Math.round(s * 0.3) + 'px;padding:0;overflow:hidden;';
    return '<span class="avatar" style="' + st + '"><img src="' + SIKAVA_FALLBACK + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></span>';
  }

  function photoAvatar(a, size){
    var s = size || 30;
    var st = 'width:' + s + 'px;height:' + s + 'px;border-radius:' + Math.round(s * 0.3) + 'px;';
    if(!a.foto_path){
      /* Tanpa foto → gambar fallback default */
      return fallbackAvatar(s);
    }
    return '<span class="avatar" style="' + st + 'padding:0;overflow:hidden;font-size:' + (s * 0.4).toFixed(1) + 'px;position:relative;flex-shrink:0;">'
      + SIK.initials(a.nama)
      + '<span style="position:absolute;inset:0;"><img src="' + esc(a.foto_path) + '?v=' + esc(String(a.id || '')) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="SIKavatarFallback(this)"></span>'
      + '</span>';
  }

  function statCard(label, value, icon){
    return '<div class="card stat-card">'
      + '<span class="sc-ic" style="background:var(--gold-100);color:var(--gold-600);">' + (icon || IC.grid) + '</span>'
      + '<span class="tiny" style="font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);">' + label + '</span>'
      + '<span class="stat-num display-m sc-num">' + value + '</span>'
      + '</div>';
  }

  function badgeStatus(s){
    var map = { 'Aktif':'badge-success', 'Pending':'badge-warn', 'Revisi':'badge-info', 'Ditolak':'badge-danger' };
    return '<span class="badge ' + (map[s] || 'badge-neutral') + '"><span class="dot"></span>' + esc(s) + '</span>';
  }

  function infoRow(label, value){
    return '<div class="between" style="gap:16px;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:.88rem;">'
      + '<span class="muted" style="flex-shrink:0;">' + label + '</span>'
      + '<span style="font-weight:600;text-align:right;">' + value + '</span></div>';
  }

  function table(cols, rows){
    return '<table class="table"><thead><tr>'
      + cols.map(function(c){ return '<th>' + c + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table>';
  }

  function mobRow(parts, extraAttr){
    return '<div class="list-row" ' + (extraAttr || '') + '>'
      + parts.map(function(p, i){
          if(i === 0) return p;
          if(i === parts.length - 1) return '<span style="margin-left:auto;">' + p + '</span>';
          return '<div class="grow" style="min-width:0;">' + p + '</div>';
        }).join('')
      + '</div>';
  }

  function closeSheetNow(){
    var bd = document.querySelector('.modal-backdrop');
    if(bd) bd.remove();
    document.body.style.overflow = '';
  }

  window.VIEWS = {

    /* ================= BERANDA ================= */
    home: async function(host, role, me){
      if(role === 'anggota'){
        var prof = (await SIKAPI.get('/me/profile')).data;
        host.innerHTML =
          '<div class="card-dark card-pad">'
          + '<div class="kicker on-dark">Selamat datang,</div>'
          + '<h2 class="display-l" style="margin-top:6px;">' + esc(prof.nama) + '</h2>'
          + '<p class="small mt-8" style="color:rgba(238,242,248,.7);">Keanggotaan Anda ' + esc(prof.status).toLowerCase() + ' — kartu digital selalu siap di HP Anda.</p>'
          + '<div class="row gap-12 mt-24 wrap-flex">'
          + '<a class="btn btn-gold" href="vcard.html">Buka kartu digital</a>'
          + '<button class="btn btn-outline-light" onclick="UI.go(\'profil\')">Data saya</button>'
          + '</div></div>'
          + '<div class="mini-stat mt-24">'
          + statCard('Status', esc(prof.status), IC.check)
          + statCard('ID Anggota', '<span class="mono sc-mono">' + esc(prof.kode_unik) + '</span>', IC.idcard)
          + statCard('Ranting', esc(prof.desa), IC.map)
          + statCard('DPC', esc(prof.kecamatan), IC.calendar)
          + '</div>'
          + '<div class="card card-pad mt-24">'
          + '<div class="between wrap-flex gap-12"><h3 class="display-s">Pengumuman</h3>'
          + '<span class="tiny muted" id="pgmUnread"></span></div>'
          + '<div class="mt-16" id="pgmTimeline"><div class="skeleton" style="height:90px;"></div></div>'
          + '</div>';
        /* Timeline pengumuman: umum + personal milik anggota ini */
        try {
          var pgRes = await SIKAPI.get('/pengumuman');
          var pg = pgRes.data || [];
          var unreadN = (pgRes && pgRes.unread) || 0;
          var KAT = { pengumuman: ['Pengumuman', 'badge-info'], pemberitahuan: ['Pemberitahuan', 'badge-warn'], pesan: ['Pesan', 'badge-gold'] };
          var tl = document.getElementById('pgmTimeline');
          var unreadEl = document.getElementById('pgmUnread');
          if(unreadEl){
            unreadEl.innerHTML = pg.length
              ? (unreadN > 0
                ? unreadN + ' belum dibaca — <a href="#" onclick="return window.VIEWS._pgMarkRead();">tandai semua</a>'
                : 'semua sudah dibaca')
              : '';
          }
          if(tl){
            tl.innerHTML = pg.length
              ? '<div class="tl">' + pg.map(function(u){
                  var k = KAT[u.kategori] || KAT.pengumuman;
                  var isNew = !u.read_at;
                  return '<div class="tl-item' + (isNew ? ' is-new' : '') + '"' + (isNew ? ' onclick="return window.VIEWS._pgMarkOne(' + u.id + ', this);"' : '') + '>'
                    + '<span class="tl-dot">' + (u.prioritas === 'penting' ? '!' : '') + '</span>'
                    + '<div class="tl-head">'
                    + '<span class="badge ' + k[1] + '">' + k[0] + '</span>'
                    + (u.target === 'personal' ? '<span class="badge badge-success">Khusus Anda</span>' : '')
                    + (u.prioritas === 'penting' ? '<span class="badge badge-danger">Penting</span>' : '')
                    + (isNew ? '<span class="tl-new">BARU</span><span class="tl-mark">' + IC.check + ' tandai dibaca</span>' : '')
                    + '<span class="tl-time">' + SIK.fmtDate(String(u.created_at || '').slice(0,10)) + '</span>'
                    + '</div>'
                    + '<div class="tl-title" style="font-weight:700;margin-top:5px;">' + esc(u.judul) + '</div>'
                    + '<div class="tl-body">' + esc(u.isi) + '</div>'
                    + '</div>';
                }).join('') + '</div>'
              : '<div class="empty" style="padding:22px;"><strong>Belum ada pengumuman</strong>Pemberitahuan dari pengurus akan tampil di sini.</div>';
          }
        } catch(e){ /* timeline opsional */ }
        return;
      }

      var s = (await SIKAPI.get('/stats')).data;
      var BULAN_MAP = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'Mei','06':'Jun','07':'Jul','08':'Agu','09':'Sep','10':'Okt','11':'Nov','12':'Des'};
      var maxB = Math.max.apply(null, s.perBulan.map(function(x){ return x.n; }).concat([1]));
      var maxK = Math.max.apply(null, s.perKecamatan.map(function(x){ return x.n; }).concat([1]));

      host.innerHTML =
        '<div class="card-dark card-pad between wrap-flex">'
        + '<div><div class="kicker on-dark">' + (role === 'superadmin' ? 'Kontrol penuh' : 'Operasional harian') + '</div>'
        + '<h2 class="display-m mt-8" style="color:#fff;">' + (s.pending > 0 ? s.pending + ' pengajuan menunggu tindakan Anda.' : 'Semua pengajuan sudah tertangani.') + '</h2>'
        + '<p class="small mt-8" style="color:rgba(238,242,248,.7);">Verifikasi cepat menjaga kepercayaan calon anggota.</p></div>'
        + (s.pending ? '<button class="btn btn-gold" onclick="UI.go(\'calon\')">Tinjau sekarang</button>' : '')
        + '</div>'
        + '<div class="mini-stat mt-24">'
        + statCard('Total anggota aktif', SIK.fmtNum(s.totalAktif), IC.users)
        + statCard('Pending approval', s.pending, IC.inbox)
        + statCard('Perlu revisi', s.revisi, IC.upload)
        + statCard('Ditolak', s.ditolak, IC.x)
        + '</div>'
        + '<div class="grid-2 mt-24" style="grid-template-columns:1.15fr .85fr;">'
        + '<div class="card card-pad">'
        + '<div class="between"><h3 class="display-s">Pendaftaran 8 bulan terakhir</h3></div>'
        + '<div style="display:flex;gap:10px;align-items:flex-end;height:150px;margin-top:22px;">'
        +   s.perBulan.map(function(x){
              var lbl = BULAN_MAP[x.ym.slice(5,7)] || x.ym;
              return '<div class="bar-col"><div class="bar" style="height:' + Math.max(4, Math.round(x.n/maxB*110)) + 'px"></div><div class="bar-lbl">' + lbl + '</div></div>';
            }).join('')
        + '</div></div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Anggota per kecamatan</h3><div class="mt-16">'
        +   s.perKecamatan.map(function(d){
              return '<div class="dist-row"><span class="dist-name">' + esc(d.kecamatan) + '</span>'
                + '<span class="progress"><i style="width:' + Math.round(d.n/maxK*100) + '%"></i></span>'
                + '<span class="mono" style="text-align:right;font-weight:700;">' + d.n + '</span></div>';
            }).join('')
        + '</div></div></div>';
    },

    /* ================= PROFIL (anggota) ================= */
    profil: async function(host, role, me){
      var p = (await SIKAPI.get('/me/profile')).data;
      var avatarHtml = p.foto_path
        ? '<span class="avatar xl gold" style="padding:0;overflow:hidden;"><img id="profAvatarImg" src="' + esc(p.foto_path) + '?v=' + Date.now() + '" alt="Foto ' + esc(p.nama) + '" style="width:100%;height:100%;object-fit:cover;" onerror="SIKavatarFallback(this)"></span>'
        : '<span class="avatar xl gold" style="padding:0;overflow:hidden;"><img id="profAvatarImg" src="/favicon/web-app-manifest-192x192.png" alt="Foto ' + esc(p.nama) + '" style="width:100%;height:100%;object-fit:cover;"></span>';
      host.innerHTML =
        '<div class="prof-2col">'
        + '<div>'
        + '<div class="card card-pad">'
        + '<div class="row gap-16">'
        + avatarHtml
        + '<div><div class="display-m">' + esc(p.nama) + '</div>'
        + '<div class="small muted mono">' + esc(p.kode_unik) + '</div>'
        + '<div class="mt-8">' + badgeStatus(p.status) + '</div></div></div>'
        + '<div class="divider-soft" style="margin:20px 0;"></div>'
        + '<div class="stack gap-14">'
        + infoRow('NIK', '<span class="mono">' + esc(p.nik) + '</span> <span class="tiny faint">(terenkripsi; ditampilkan sebagian)</span>')
        + infoRow('Jabatan', esc(p.jabatan || 'Anggota'))
        + infoRow('Tempat, tanggal lahir', esc(p.tempat_lahir) + ', ' + SIK.fmtDate(p.tanggal_lahir))
        + infoRow('Jenis kelamin', esc(p.gender))
        + infoRow('Pekerjaan', esc(p.pekerjaan))
        + infoRow('Wilayah', esc(p.kecamatan) + ' — ' + esc(p.desa))
        + infoRow('Alamat', esc(p.alamat || '—'))
        + infoRow('Nomor WhatsApp', p.whatsapp ? SIK.fmtPhone(p.whatsapp) : '—')
        + (p.telegram ? infoRow('Telegram', esc(p.telegram)) : '')
        + infoRow('Email', esc(p.email || '—'))
        + infoRow('Terdaftar sejak', SIK.fmtDate(String(p.registered_at).slice(0,10)))
        + '</div>'
        + '<div id="photoWrap" class="mt-16"></div>'
        + '<div id="draftBanner" class="mt-16"></div>'
        + '<div class="row gap-12 mt-24 wrap-flex">'
        + '<button class="btn btn-primary" id="btnEditData">Edit data pribadi</button>'
        + '<a class="btn btn-gold" href="vcard.html">Buka kartu digital</a>'
        + '</div>'
        + '<div class="card card-pad mt-16" style="background:var(--paper-dim);">'
        + '<div class="small muted">Perubahan NIK, nama, TTL, dan wilayah hanya dapat dilakukan pengurus sesuai matriks hak akses. Data pribadi lain — termasuk <b>nomor WhatsApp</b> dan <b>foto profil</b> — bisa Anda ubah sendiri: nomor WhatsApp tersimpan sebagai <b>draft</b> dan baru berlaku setelah pengurus menyetujui, foto profil langsung aktif.</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Kartu Anda</h3>'
        + '<div class="prof-cards mt-16" id="profCards"><div class="skeleton" style="height:200px;"></div></div>'
        + '<div class="row gap-12 mt-16 wrap-flex">'
        + '<a class="btn btn-soft btn-sm" href="vcard.html">Buka halaman vCard lengkap</a>'
        + '</div></div>'
        + '</div>'
        + '</div>'
        + '<div id="editDataWrap" class="mt-16"></div>';
      /* Pratinjau kartu PNG (sisi depan & belakang) via endpoint bertoken */
      try {
        var sides = ['depan', 'belakang'];
        var imgs = await Promise.all(sides.map(async function(side){
          var resp = await SIKAPI.raw('/api/vcard/png?side=' + side);
          if(!resp.ok) return null;
          var blob = await resp.blob();
          if(!blob || blob.size < 1024) return null;
          return URL.createObjectURL(blob);
        }));
        var wrap = document.getElementById('profCards');
        if(wrap){
          wrap.innerHTML = imgs.map(function(u, i){
            return u
              ? '<figure class="prof-card"><img src="' + u + '" alt="Kartu sisi ' + sides[i] + '"><figcaption class="tiny muted">Sisi ' + sides[i] + '</figcaption></figure>'
              : '<div class="empty card" style="grid-column:1/-1;"><strong>Kartu belum tersedia</strong>Kartu aktif setelah keanggotaan disetujui pengurus.</div>';
          }).join('');
        }
      } catch(e){ /* pratinjau opsional */ }

      /* ---------- Edit data pribadi mandiri: draft → ajukan ---------- */
      var editWrap = document.getElementById('editDataWrap');
      var draftInfo = null;
      try { draftInfo = (await SIKAPI.get('/me/draft')).data; } catch(e){ /* tanpa draft */ }

      /* ---------- Upload / hapus foto profil mandiri ---------- */
      var photoWrap = document.getElementById('photoWrap');
      if(photoWrap){
        photoWrap.innerHTML =
          '<div class="card card-pad">'
          + '<div class="between wrap-flex gap-12"><h3 class="display-s">Foto profil</h3>'
          + '<span class="tiny muted">Otomatis dipotong ke rasio kartu 3:4 (720×960)</span></div>'
          + '<div class="row gap-12 mt-12 wrap-flex">'
          + '<button class="btn btn-soft btn-sm" id="btnPickPhoto">' + (p.foto_path ? 'Ganti foto' : 'Unggah foto') + '</button>'
          + (p.foto_path ? '<button class="btn btn-ghost btn-sm" id="btnDelPhoto" style="color:var(--danger);">Hapus foto</button>' : '')
          + '</div>'
          + '<input type="file" id="photoInput" accept="image/png,image/jpeg,image/webp" style="display:none;">'
          + '</div>';
        var pi = document.getElementById('photoInput');
        document.getElementById('btnPickPhoto').onclick = function(){ pi.click(); };
        pi.onchange = async function(){
          var f = pi.files && pi.files[0];
          if(!f) return;
          if(f.size > 8 * 1024 * 1024){ showToast('Ukuran foto maksimal 8 MB.', 'danger'); pi.value = ''; return; }
          try {
            var dataUrl = await new Promise(function(res2, rej2){
              var rd = new FileReader();
              rd.onload = function(){ res2(rd.result); };
              rd.onerror = function(){ rej2(new Error('Gagal membaca berkas.')); };
              rd.readAsDataURL(f);
            });
            openCropModal(dataUrl);
          } catch(e){ showToast(e.message, 'danger'); }
          pi.value = '';
        };

      /* ---------- Modal crop foto (pan & zoom → 720×960) ---------- */
      function openCropModal(srcDataUrl){
        var backdrop = document.createElement('div');
        backdrop.className = 'crop-backdrop';
        backdrop.innerHTML =
          '<div class="crop-modal">'
          + '<h3 class="display-s">Atur foto profil</h3>'
          + '<div class="crop-stage" id="cropStage"><img id="cropImg" alt=""></div>'
          + '<div class="crop-hint">Geser foto untuk memposisikan · gunakan slider untuk zoom</div>'
          + '<div class="crop-zoom"><span class="tiny muted">Kecil</span>'
          + '<input type="range" id="cropZoom" min="1" max="3" step="0.01" value="1">'
          + '<span class="tiny muted">Besar</span></div>'
          + '<div class="row gap-8 mt-16" style="justify-content:flex-end;">'
          + '<button class="btn btn-ghost btn-sm" id="cropCancel">Batal</button>'
          + '<button class="btn btn-primary" id="cropSave">Simpan foto</button>'
          + '</div></div>';
        document.body.appendChild(backdrop);
        var stage = backdrop.querySelector('#cropStage');
        var img = backdrop.querySelector('#cropImg');
        var zoom = backdrop.querySelector('#cropZoom');
        var W = stage.clientWidth, H = stage.clientHeight;
        var natW = 0, natH = 0, base = 1, scale = 1, px = 0, py = 0, minX = 0, maxX = 0, minY = 0, maxY = 0;
        img.onload = function(){
          natW = img.naturalWidth; natH = img.naturalHeight;
          base = Math.max(W / natW, H / natH);
          scale = base; zoom.min = base.toFixed(4); zoom.value = base.toFixed(4);
          px = (W - natW * scale) / 2; py = (H - natH * scale) / 2;
          clamp(); apply();
        };
        img.src = srcDataUrl;
        function apply(){ img.style.width = natW + 'px'; img.style.height = natH + 'px'; img.style.transform = 'translate(' + px + 'px,' + py + 'px)'; }
        function clamp(){
          var w = natW * scale, h = natH * scale;
          minX = W - w; maxX = 0; minY = H - h; maxY = 0;
          if(w <= W){ px = (W - w) / 2; } else { px = Math.min(maxX, Math.max(minX, px)); }
          if(h <= H){ py = (H - h) / 2; } else { py = Math.min(maxY, Math.max(minY, py)); }
        }
        zoom.oninput = function(){
          var old = scale;
          scale = parseFloat(zoom.value);
          if(!natW) return;
          var cx = W / 2, cy = H / 2;
          px = cx - (cx - px) * (scale / old);
          py = cy - (cy - py) * (scale / old);
          clamp(); apply();
        };
        var drag = null;
        function down(x, y){ drag = { x: x, y: y, px: px, py: py }; img.classList.add('dragging'); }
        function move(x, y){ if(!drag) return; px = drag.px + (x - drag.x); py = drag.py + (y - drag.y); clamp(); apply(); }
        function up(){ drag = null; img.classList.remove('dragging'); }
        stage.addEventListener('mousedown', function(e){ e.preventDefault(); down(e.clientX, e.clientY); });
        window.addEventListener('mousemove', function(e){ move(e.clientX, e.clientY); });
        window.addEventListener('mouseup', up);
        stage.addEventListener('touchstart', function(e){ var t = e.touches[0]; down(t.clientX, t.clientY); }, { passive: true });
        stage.addEventListener('touchmove', function(e){ var t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
        stage.addEventListener('touchend', up);
        function close(){ backdrop.remove(); }
        backdrop.querySelector('#cropCancel').onclick = close;
        backdrop.addEventListener('click', function(e){ if(e.target === backdrop) close(); });
        backdrop.querySelector('#cropSave').onclick = async function(){
          var btn = this; btn.disabled = true; btn.textContent = 'Menyimpan…';
          try {
            var cv = document.createElement('canvas'); cv.width = 720; cv.height = 960;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 720, 960);
            ctx.drawImage(img, px * (720 / W), py * (960 / H), natW * scale * (720 / W), natH * scale * (960 / H));
            var out = cv.toDataURL('image/jpeg', 0.9);
            var r = await SIKAPI.post('/me/photo', { dataUrl: out });
            showToast(r.message || 'Foto profil diperbarui.', 'success');
            close();
            setTimeout(function(){ location.reload(); }, 900);
          } catch(e){
            showToast(e.message, 'danger');
            btn.disabled = false; btn.textContent = 'Simpan foto';
          }
        };
      }
        var dp = document.getElementById('btnDelPhoto');
        if(dp) dp.onclick = async function(){
          if(!confirm('Hapus foto profil Anda?')) return;
          dp.disabled = true;
          try {
            await SIKAPI.post('/me/photo', { remove: true });
            showToast('Foto profil dihapus.', 'info');
            setTimeout(function(){ location.reload(); }, 900);
          } catch(e){ showToast(e.message, 'danger'); dp.disabled = false; }
        };
      }

      renderDraftUI();
      function renderDraftUI(){
        var b = document.getElementById('draftBanner');
        if(!b) return;
        if(draftInfo && draftInfo.status === 'pending'){
          b.innerHTML = '<div class="draft-banner is-pending"><div><b>Pengajuan sedang ditinjau pengurus</b>'
            + '<div class="tiny" style="margin-top:2px;">Perubahan data Anda menunggu persetujuan — edit terkunci sementara.</div></div>'
            + '<button class="btn btn-ghost btn-sm" id="draftCancel" style="color:var(--danger);">Batalkan pengajuan</button></div>';
        } else if(draftInfo && draftInfo.status === 'draft'){
          b.innerHTML = '<div class="draft-banner"><div><b>Tersimpan sebagai draft</b>'
            + '<div class="tiny" style="margin-top:2px;">Perubahan belum berlaku — ajukan agar ditinjau pengurus.</div></div>'
            + '<div class="row gap-8"><button class="btn btn-ghost btn-sm" id="draftDiscard" style="color:var(--danger);">Buang draft</button>'
            + '<button class="btn btn-gold btn-sm" id="draftSubmit">Ajukan perubahan data</button></div></div>';
        } else {
          b.innerHTML = '';
        }
        var s1 = document.getElementById('draftSubmit');
        if(s1) s1.onclick = doSubmit;
        var s2 = document.getElementById('draftDiscard');
        if(s2) s2.onclick = doDiscard;
        var s3 = document.getElementById('draftCancel');
        if(s3) s3.onclick = doDiscard;
      }
      async function doSubmit(){
        try {
          await SIKAPI.post('/me/draft/submit', {});
          draftInfo = (await SIKAPI.get('/me/draft')).data;
          renderDraftUI();
          openEdit();
          showToast('Perubahan data diajukan — menunggu peninjauan pengurus.', 'success');
        } catch(e){ showToast(e.message, 'danger'); }
      }
      async function doDiscard(){
        try {
          await SIKAPI.del('/me/draft');
          draftInfo = null;
          renderDraftUI();
          openEdit();
          showToast('Draft dihapus.', 'info');
        } catch(e){ showToast(e.message, 'danger'); }
      }
      function fieldHtml(key, label, val, ph, rows){
        var base = 'data-k="' + key + '" placeholder="' + esc(ph || label) + '"';
        if(rows) return '<div class="field"><label>' + label + '</label><textarea class="textarea" rows="' + rows + '" ' + base + '>' + esc(val || '') + '</textarea></div>';
        return '<div class="field"><label>' + label + '</label><div class="input-shell"><input ' + base + ' value="' + esc(val || '') + '"></div></div>';
      }
      function openEdit(){
        if(!editWrap) return;
        if(draftInfo && draftInfo.status === 'pending'){
          editWrap.innerHTML = '<div class="card card-pad"><div class="small muted">Edit data dinonaktifkan selama pengajuan ditinjau pengurus. Batalkan pengajuan bila ingin mengubah lagi.</div></div>';
          return;
        }
        var rawP = (draftInfo && draftInfo.status === 'draft') ? draftInfo.payload : null;
        var d = rawP ? (typeof rawP === 'string' ? (JSON.parse(rawP) || {}) : rawP) : {};
        editWrap.innerHTML =
          '<div class="card card-pad prof-edit">'
          + '<div class="between wrap-flex gap-12"><div><h3 class="display-s">Edit data pribadi</h3>'
          + '<p class="small muted mt-8">Hanya data pribadi non-kritis yang boleh diubah mandiri. Simpan dulu sebagai draft, lalu ajukan ke pengurus.</p></div>'
          + '<button class="btn btn-ghost btn-sm" id="editClose">Tutup</button></div>'
          + '<div class="grid-2 mt-16">'
          + fieldHtml('pekerjaan', 'Pekerjaan', d.pekerjaan != null ? d.pekerjaan : p.pekerjaan)
          + fieldHtml('email', 'Email', d.email != null ? d.email : p.email)
          + '</div>'
          + '<div class="grid-2">'
          + fieldHtml('telegram', 'Telegram', d.telegram != null ? d.telegram : (p.telegram || ''), 'contoh: @username')
          + fieldHtml('whatsapp', 'Nomor WhatsApp', d.whatsapp != null ? d.whatsapp : p.whatsapp, '08xxxxxxxxxx')
          + '</div>'
          + fieldHtml('alamat', 'Alamat', d.alamat != null ? d.alamat : p.alamat, 'Alamat lengkap', 4)
          + '<div class="row gap-12 mt-16 wrap-flex">'
          + '<button class="btn btn-primary" id="draftSave">Simpan sebagai draft</button>'
          + '<span class="tiny muted" style="align-self:center;">Draft belum mengubah data resmi — berlaku setelah pengurus menyetujui.</span>'
          + '</div></div>';
        var ic = document.getElementById('editClose');
        if(ic) ic.onclick = function(){ editWrap.innerHTML = ''; };
        var sb = document.getElementById('draftSave');
        if(sb) sb.onclick = async function(){
          sb.disabled = true; sb.textContent = 'Menyimpan…';
          try {
            var r = await SIKAPI.put('/me/draft', {
              pekerjaan: editWrap.querySelector('[data-k="pekerjaan"]').value,
              alamat: editWrap.querySelector('[data-k="alamat"]').value,
              telegram: editWrap.querySelector('[data-k="telegram"]').value,
              email: editWrap.querySelector('[data-k="email"]').value,
              whatsapp: editWrap.querySelector('[data-k="whatsapp"]').value
            });
            draftInfo = r.data;
            renderDraftUI();
            openEdit();
            showToast('Tersimpan sebagai draft — tekan Ajukan perubahan data bila sudah benar.', 'success', 4200);
          } catch(e){ showToast(e.message, 'danger'); }
          sb.disabled = false; sb.textContent = 'Simpan sebagai draft';
        };
      }
      var eb = document.getElementById('btnEditData');
      if(eb) eb.onclick = openEdit;
    },

    /* ================= KARTU ================= */
    kartu: async function(host, role, me){
      if(role === 'anggota'){
        var p = (await SIKAPI.get('/me/profile')).data;
        var url = location.origin + '/vcard.html';
        host.innerHTML =
          '<div class="card card-pad" style="max-width:520px;text-align:center;">'
          + '<h2 class="display-m">Kartu anggota digital</h2>'
          + '<p class="muted small mt-8">Tunjukkan QR ini saat kegiatan atau buka halaman vCard Anda.</p>'
          + '<div class="qr-box mt-24" style="margin-left:auto;margin-right:auto;" id="myQr"></div>'
          + '<div class="mono small muted mt-12">' + esc(p.kode_unik) + '</div>'
          + '<div class="row gap-12 mt-24" style="justify-content:center;flex-wrap:wrap;">'
          + '<a class="btn btn-primary" href="vcard.html">Buka vCard</a>'
          + '</div></div>';
        document.getElementById('myQr').innerHTML = SIK.qr(url, { scale:5, size:116 });
        return;
      }
      var res = await SIKAPI.get('/members?status=Aktif');
      var aktif = res.data;
      /* Statistik nyata dari data — tanpa angka hardcode */
      var aktifCount = aktif.length;
      VIEWS._kartuCache = aktif;
      var kecSet = {};
      var desaSet = {};
      aktif.forEach(function(a){
        if(a.kecamatan) kecSet[a.kecamatan] = 1;
        if(a.desa) desaSet[a.kecamatan + '/' + a.desa] = 1;
      });
      var kecCount = Object.keys(kecSet).length;
      var desaCount = Object.keys(desaSet).length;
      host.innerHTML =
        '<div class="mini-stat">'
        + statCard('Kartu aktif', aktifCount, IC.idcard)
        + statCard('Kecamatan tercakup', kecCount, IC.map)
        + statCard('Ranting terdaftar', desaCount, IC.print)
        + '</div>'
        + '<div class="card mt-24">'
        + '<div class="card-pad between" style="padding-bottom:10px;"><h3 class="display-s">Antrean cetak terbaru</h3>'
        + '<button class="btn btn-primary btn-sm" onclick="showToast(\'12 kartu dikirim ke antrean cetak PDF (simulasi).\',\'success\')">Cetak massal</button></div>'
        + '<div class="desktop-table table-wrap card-flat" style="border:none;border-top:1px solid var(--line);">'
        +   table(['Anggota','ID','Wilayah','Status','<div class="th-right">Aksi</div>'], aktif.slice(0,8).map(function(a){
              return ['<div class="row gap-8">' + photoAvatar(a) + '<strong>' + esc(a.nama) + '</strong></div>', '<span class="mono">' + esc(a.kode_unik) + '</span>', esc(a.kecamatan), badgeStatus(a.status),
                '<span class="row-actions">'
                + '<a class="btn btn-soft btn-sm" href="vcard.html?id=' + encodeURIComponent(a.kode_unik) + '" target="_blank" rel="noopener" title="Buka halaman vCard ' + esc(a.nama) + ' di tab baru">' + (IC.user || '') + ' vCard</a>'
                + '<button class="btn btn-soft btn-sm" data-kode="' + esc(a.kode_unik) + '" onclick="VIEWS._kirimKartu(this.dataset.kode)" title="Kirim PDF kartu via WhatsApp / Telegram / Email">Kirim…</button>'
                + '</span>'];
            }))
        + '</div>'
        + '<div class="mobile-list">'
        +   aktif.slice(0,8).map(function(a){
              return mobRow([photoAvatar(a), '<strong>' + esc(a.nama) + '</strong><div class="list-sub">' + esc(a.kode_unik) + '</div>', badgeStatus(a.status),
                '<span class="row-actions"><a class="btn btn-soft btn-sm" href="vcard.html?id=' + encodeURIComponent(a.kode_unik) + '" target="_blank" rel="noopener">' + (IC.user || '') + '</a>'
                + '<button class="btn btn-soft btn-sm" data-kode="' + esc(a.kode_unik) + '" onclick="VIEWS._kirimKartu(this.dataset.kode)">Kirim</button></span>']);
            }).join('')
        + '</div></div>';

      /* ---------- Kirim PDF kartu via WhatsApp / Telegram / Email ---------- */
      VIEWS._kirimKartu = function(kode){
        var a = (VIEWS._kartuCache || []).find(function(x){ return x.kode_unik === kode; });
        if(!a) return;
        openSheet(
          '<div class="row gap-16">'
          + photoAvatar(a, 46)
          + '<div><div class="display-m">Kirim kartu PDF</div>'
          + '<div class="small muted">' + esc(a.nama) + ' · <span class="mono">' + esc(a.kode_unik) + '</span></div></div></div>'
          + '<p class="small muted mt-12">PDF kartu (sisi depan, belakang, dan master cetak) dibuat server lalu dikirim ke tujuan pilihan.</p>'
          + '<div class="stack gap-12 mt-16">'
          + '<button class="btn btn-soft btn-block" style="justify-content:flex-start;" onclick="VIEWS._kirimDo(\'wa\',\'' + esc(a.kode_unik) + '\')">💬 WhatsApp — ' + esc(a.whatsapp ? SIK.fmtPhone(a.whatsapp) : 'nomor belum ada') + '</button>'
          + '<button class="btn btn-soft btn-block" style="justify-content:flex-start;" onclick="VIEWS._kirimDo(\'telegram\',\'' + esc(a.kode_unik) + '\')">✈️ Telegram — ' + esc(a.telegram || 'belum diisi') + '</button>'
          + '<button class="btn btn-soft btn-block" style="justify-content:flex-start;" onclick="VIEWS._kirimDo(\'email\',\'' + esc(a.kode_unik) + '\')">✉️ Email — ' + esc(a.email || 'belum diisi') + '</button>'
          + '</div>'
        );
      };
      VIEWS._kirimDo = async function(channel, kode){
        var a = (VIEWS._kartuCache || []).find(function(x){ return x.kode_unik === kode; });
        var btns = document.querySelectorAll('.modal-backdrop .btn-block');
        btns.forEach(function(b2){ b2.disabled = true; b2.style.opacity = '.6'; });
        try {
          var res = await SIKAPI.post('/vcard/' + encodeURIComponent(kode) + '/send', {
            channel: channel,
            whatsapp: a ? a.whatsapp : undefined,
            telegram: a ? a.telegram : undefined,
            email: a ? a.email : undefined
          });
          closeSheetNow();
          showToast(res.message || 'PDF kartu terkirim.', 'success', 4500);
        } catch(e){
          btns.forEach(function(b2){ b2.disabled = false; b2.style.opacity = ''; });
          showToast(e.message, 'danger', 5000);
        }
      };
    },

    /* ================= PENGUMUMAN (admin) ================= */
    pengumuman: async function(host, role, me){
      var cache = [];
      var anggotaCache = [];
      try { anggotaCache = (await SIKAPI.get('/members?status=Aktif')).data; } catch(e){}
      var KAT = { pengumuman: ['Pengumuman', 'badge-info'], pemberitahuan: ['Pemberitahuan', 'badge-warn'], pesan: ['Pesan', 'badge-gold'] };
      var CH = {
        wa:       { label: 'WhatsApp',  cls: 'on-wa',  ic: IC.chat   || IC.user },
        telegram: { label: 'Telegram',  cls: 'on-tg',  ic: IC.send   || IC.chev   },
        email:    { label: 'Email',     cls: 'on-mail',ic: IC.inbox  || IC.grid   }
      };
      await load();
      function chanChips(u){
        var list = String(u.channels || '').split(',').filter(Boolean);
        if(!list.length) return '<span class="tiny faint">—</span>';
        return '<span class="pg-chips">' + list.map(function(c){
          var d = CH[c] || { label: c, cls: '', ic: '' };
          return '<span class="pg-chip ' + d.cls + '">' + (d.ic ? d.ic : '') + d.label + '</span>';
        }).join('') + '</span>';
      }

      async function load(){
        var res = await SIKAPI.get('/pengumuman?scope=all');
        cache = res.data || [];
        await render();
      }

      async function render(){
        var nWa = cache.filter(function(u){ return String(u.channels).indexOf('wa') >= 0; }).length;
        var nTg = cache.filter(function(u){ return String(u.channels).indexOf('telegram') >= 0; }).length;
        var nMail = cache.filter(function(u){ return String(u.channels).indexOf('email') >= 0; }).length;
        var rowsHtml = cache.map(function(u){
          var k = KAT[u.kategori] || KAT.pengumuman;
          return [
            '<span class="badge ' + k[1] + '">' + k[0] + '</span>',
            '<div class="pg-title-wrap">' + (u.prioritas === 'penting' ? '<span class="badge badge-danger" style="flex:none;" title="Prioritas penting">!</span>' : '')
              + '<div><strong>' + esc(u.judul) + '</strong><div class="list-sub">' + esc(String(u.isi).slice(0, 90)) + (String(u.isi).length > 90 ? '…' : '') + '</div></div></div>',
            u.target === 'personal'
              ? '<span class="badge badge-success">Personal</span><div class="tiny muted" style="margin-top:3px;">' + esc(u.anggota_nama || '—') + '</div>'
              : '<span class="badge badge-info">Umum</span><div class="tiny faint" style="margin-top:3px;">Semua anggota</div>',
            chanChips(u),
            '<span class="tiny muted">' + SIK.fmtDate(String(u.created_at || '').slice(0,10)) + '</span>',
            '<span class="row-actions"><button class="btn btn-ghost btn-sm" data-id="' + u.id + '" onclick="VIEWS._pgEdit(this.dataset.id)">Edit</button>'
            + '<button class="btn btn-ghost btn-sm" data-id="' + u.id + '" onclick="VIEWS._pgDel(this.dataset.id)" style="color:var(--danger);">Hapus</button></span>'
          ];
        });
        host.innerHTML =
          '<div class="pg-head">'
          + '<p class="small muted pg-sub" style="margin:0;max-width:640px;">Kirim pengumuman umum atau pesan personal ke dashboard anggota. Centang kanal tambahan untuk sekaligus mengirimkannya via WhatsApp, Telegram, atau Email. Pesan personal selalu dinotifikasikan otomatis ke semua kanal yang terisi di profil anggota.</p>'
          + '<button class="btn btn-primary" id="pgNew" style="flex:none;">' + (IC.plus || '+') + ' Buat baru</button>'
          + '</div>'
          + '<div class="pg-stats">'
          +   '<div class="pg-stat"><span class="p-ic gold">' + (IC.chat || IC.user) + '</span><div><b>' + nWa + '</b><span class="tiny muted">terkirim via WhatsApp</span></div></div>'
          +   '<div class="pg-stat"><span class="p-ic">' + (IC.send || IC.chev) + '</span><div><b>' + nTg + '</b><span class="tiny muted">terkirim via Telegram</span></div></div>'
          +   '<div class="pg-stat"><span class="p-ic">' + (IC.inbox || IC.grid) + '</span><div><b>' + nMail + '</b><span class="tiny muted">terkirim via Email</span></div></div>'
          + '</div>'
          + '<div class="card">'
          + (cache.length === 0
              ? '<div class="empty"><strong>Belum ada pengumuman</strong>Buat pengumuman atau pesan personal untuk anggota Anda.</div>'
              : '<div class="desktop-table table-wrap card-flat" style="border:none;">'
              + table(['Kategori','Judul & isi','Tujuan','Kanal kirim','Tanggal',''], rowsHtml)
                  .replace('class="table"', 'class="table pg-tbody"')
              + '</div>'
              + '<div class="mobile-list">'
              + cache.map(function(u){
                  var k2 = KAT[u.kategori] || KAT.pengumuman;
                  return '<div class="list-row pg-mrow">'
                    + '<div class="pg-mrow-top">'
                    +   '<span class="badge ' + k2[1] + '">' + k2[0] + '</span>'
                    +   (u.prioritas === 'penting' ? '<span class="badge badge-danger" title="Prioritas penting">!</span>' : '')
                    +   chanChips(u)
                    + '</div>'
                    + '<strong class="pg-mrow-title">' + esc(u.judul) + '</strong>'
                    + '<div class="list-sub">' + esc(String(u.isi).slice(0, 110)) + (String(u.isi).length > 110 ? '…' : '') + '</div>'
                    + '<div class="pg-mrow-meta">' + (u.target === 'personal' ? ('Personal — ' + esc(u.anggota_nama || '—')) : 'Umum — semua anggota') + ' · ' + SIK.fmtDate(String(u.created_at || '').slice(0,10)) + '</div>'
                    + '<div class="row-actions"><button class="btn btn-ghost btn-sm" data-id="' + u.id + '" onclick="VIEWS._pgEdit(this.dataset.id)">Edit</button>'
                    + '<button class="btn btn-ghost btn-sm" data-id="' + u.id + '" onclick="VIEWS._pgDel(this.dataset.id)" style="color:var(--danger);">Hapus</button></div>'
                    + '</div>';
                }).join('')
              + '</div>')
          + '</div>';
        document.getElementById('pgNew').onclick = function(){ openForm(null); };
      }

      function chanChecks(sel){
        return '<div class="pg-chk-grid">'
          + ['wa','telegram','email'].map(function(c){
              var d = CH[c];
              var on = sel && sel.indexOf(c) >= 0;
              return '<label class="pg-chk"><input type="checkbox" value="' + c + '"' + (on ? ' checked' : '') + '>'
                + '<span class="ck-ic">' + d.ic + '</span>'
                + '<span><b>' + d.label + '</b><span class="tiny muted">' + (c === 'wa' ? 'Via gateway Fonnte' : c === 'telegram' ? 'Chat pribadi anggota' : 'Alamat email terdaftar') + '</span></span>'
                + '<span class="ck-dot"></span></label>';
            }).join('')
          + '</div>';
      }
      function readChans(scopeEl){
        return Array.prototype.slice.call(scopeEl.querySelectorAll('.pg-chk input:checked')).map(function(i){ return i.value; });
      }

      function openForm(item){
        var isEdit = !!item;
        var optAnggota = anggotaCache.map(function(a){
          return '<option value="' + a.id + '" ' + (item && item.anggota_id === a.id ? 'selected' : '') + '>' + esc(a.nama) + ' — ' + esc(a.kode_unik) + '</option>';
        }).join('');
        var selChans = isEdit ? String(item.channels || '').split(',').filter(Boolean) : [];
        openSheet(
          '<div class="pg-sheet-head">'
          + '<div class="display-m">' + (isEdit ? 'Edit pengumuman' : 'Buat pengumuman') + '</div>'
          + '<p class="small muted" style="margin:4px 0 0;">' + (isEdit ? 'Perbarui isi pengumuman dan kanal kirimnya.' : 'Isi detail di bawah, lalu terbitkan ke dashboard anggota.') + '</p>'
          + '</div>'
          + '<div class="pg-sheet-body">'
          + '<div class="pg-form stack gap-0">'
          + '<div class="pg-sec-title">Detail</div>'
          + '<div class="grid-2">'
          +   '<div class="field"><label>Kategori</label><select class="select" id="pgKat">'
          +     ['pengumuman','pemberitahuan','pesan'].map(function(k){ return '<option value="' + k + '" ' + (item && item.kategori === k ? 'selected' : '') + '>' + k.charAt(0).toUpperCase() + k.slice(1) + '</option>'; }).join('')
          +   '</select></div>'
          +   '<div class="field"><label>Prioritas</label><select class="select" id="pgPri">'
          +     '<option value="normal" ' + (item && item.prioritas === 'penting' ? '' : 'selected') + '>Normal</option>'
          +     '<option value="penting" ' + (item && item.prioritas === 'penting' ? 'selected' : '') + '>Penting</option>'
          +   '</select></div>'
          + '</div>'
          + (isEdit
              ? '<div class="field"><label>Tujuan</label><div class="input-shell"><input value="' + (item.target === 'personal' ? ('Personal — ' + esc(item.anggota_nama || '')) : 'Umum — semua anggota') + '" disabled></div><div class="tiny muted mt-8">Tujuan tidak dapat diubah setelah dibuat.</div></div>'
              : '<div class="field"><label>Tujuan</label><select class="select" id="pgTarget" onchange="VIEWS._pgTargetFlip(this.value)">'
              +   '<option value="umum">Umum — semua anggota</option>'
              +   '<option value="personal">Personal — anggota tertentu</option>'
              + '</select></div>'
              + '<div class="field" id="pgTargetWrap" style="display:none;"><label>Anggota tujuan</label><select class="select" id="pgAnggota">' + optAnggota + '</select></div>')
          + '<div class="field"><label>Judul</label><div class="input-shell"><input id="pgJudul" maxlength="160" value="' + esc(item ? item.judul : '') + '" placeholder="Judul pengumuman"></div></div>'
          + '<div class="field"><label>Isi</label><textarea class="textarea" id="pgIsi" rows="5" placeholder="Tulis isi pengumuman…">' + esc(item ? item.isi : '') + '</textarea></div>'
          + '<div class="pg-sec-title" style="margin-top:6px;">Kanal kirim</div>'
          + '<div id="pgChanWrap">' + chanChecks(selChans) + '</div>'
          + '<div class="pg-note mt-8"><span class="tiny muted">Dashboard anggota selalu menerima pengumuman ini. Centang kanal tambahan bila ingin sekaligus dikirim via WhatsApp, Telegram, atau Email ke ' + (isEdit && item.target === 'personal' ? 'anggota yang dituju' : 'seluruh anggota aktif') + '. Pesan personal: notifikasi otomatis dikirim ke kanal yang terisi profil anggota, centangan tidak diperlukan.</span></div>'
          + '</div></div>'
          + '<div class="pg-sheet-foot">'
          +   '<button class="btn btn-ghost" data-close>Batal</button>'
          +   '<button class="btn btn-primary" id="pgSave">' + (isEdit ? 'Simpan perubahan' : 'Terbitkan') + '</button>'
          + '</div>',
          { centered: true, sheetClass: 'pg-sheet' }
        );
        var sb = document.getElementById('pgSave');
        sb.onclick = async function(){
          var judul = document.getElementById('pgJudul').value.trim();
          var isi = document.getElementById('pgIsi').value.trim();
          if(judul.length < 3){ showToast('Judul minimal 3 karakter.', 'danger'); return; }
          if(!isi){ showToast('Isi pengumuman wajib diisi.', 'danger'); return; }
          var channels = readChans(document.querySelector('.pg-sheet'));
          sb.disabled = true; sb.textContent = 'Menyimpan…';
          try {
            if(isEdit){
              await SIKAPI.put('/pengumuman/' + item.id, {
                kategori: document.getElementById('pgKat').value,
                prioritas: document.getElementById('pgPri').value,
                judul: judul, isi: isi, channels: channels
              });
            } else {
              var body = {
                kategori: document.getElementById('pgKat').value,
                prioritas: document.getElementById('pgPri').value,
                target: document.getElementById('pgTarget').value,
                judul: judul, isi: isi, channels: channels
              };
              if(body.target === 'personal') body.anggota_id = parseInt(document.getElementById('pgAnggota').value, 10);
              await SIKAPI.post('/pengumuman', body);
            }
            closeSheetNow();
            showToast(isEdit ? 'Pengumuman diperbarui.' : 'Pengumuman diterbitkan.' + (channels.length ? ' Kanal: ' + channels.join(', ') : ''), 'success');
            load().catch(function(){});
          } catch(e){
            sb.disabled = false; sb.textContent = isEdit ? 'Simpan perubahan' : 'Terbitkan';
            showToast(e.message, 'danger', 5000);
          }
        };
      }
      VIEWS._pgTargetFlip = function(v){
        var w = document.getElementById('pgTargetWrap');
        if(w) w.style.display = (v === 'personal') ? '' : 'none';
      };
      VIEWS._pgEdit = function(id){
        var item = cache.find(function(x){ return String(x.id) === String(id); });
        if(item) openForm(item);
      };
      VIEWS._pgDel = async function(id){
        if(!confirm('Hapus pengumuman ini?')) return;
        try {
          await SIKAPI.del('/pengumuman/' + id);
          showToast('Pengumuman dihapus.', 'info');
          load().catch(function(){});
        } catch(e){ showToast(e.message, 'danger'); }
      };
    },

    /* ================= CALON ANGGOTA ================= */
    calon: async function(host, role, me){
      var filter = 'Pending';
      var listCache = [];
      await render();

      async function render(){
        var res = await SIKAPI.get('/members' + (filter === 'Semua' ? '' : '?status=' + encodeURIComponent(filter)));
        listCache = res.data;
        host.innerHTML =
          '<div class="chip-row" style="margin-bottom:14px;">'
          + ['Pending','Revisi','Ditolak','Semua'].map(function(s){
              return '<button class="chip ' + (filter===s?'is-active':'') + '" data-f="' + s + '" onclick="VIEWS._calonFilter(this.dataset.f)">' + s + '</button>';
            }).join('')
          + '</div>'
          + '<div class="card">'
          + '<div class="card-pad between" style="padding-bottom:10px;"><h3 class="display-s">Pengajuan (' + listCache.length + ')</h3></div>'
          + (listCache.length === 0
              ? '<div class="empty"><strong>Tidak ada pengajuan</strong>Semua beres!</div>'
              : '<div class="desktop-table table-wrap card-flat" style="border:none;border-top:1px solid var(--line);">'
              + table(['Calon','NIK','Wilayah','Tanggal','Status',''],
                listCache.map(function(a){
                  return [ '<div class="row gap-8">'+photoAvatar(a)+'<strong>'+esc(a.nama)+'</strong></div>',
                    '<span class="mono">'+esc(a.nik)+'</span>', esc(a.kecamatan), SIK.fmtDate(String(a.registered_at).slice(0,10)), badgeStatus(a.status),
                    '<button class="btn btn-soft btn-sm" data-id="' + a.id + '" onclick="VIEWS._detailCalon(this.dataset.id)">Tinjau</button>' ];
                }))
              + '</div>'
              + '<div class="mobile-list">'
              + listCache.map(function(a){
                  return mobRow([photoAvatar(a), '<strong>' + esc(a.nama) + '</strong><div class="list-sub">' + esc(a.kode_unik) + ' · ' + SIK.fmtDate(String(a.registered_at).slice(0,10)) + '</div>', badgeStatus(a.status)],
                    'data-id="' + a.id + '" onclick="VIEWS._detailCalon(this.dataset.id)"');
                }).join('')
              + '</div>')
          + '</div>';
      }

      VIEWS._calonFilter = function(s){ filter = s; render().catch(function(e){ showToast(e.message,'danger'); }); };

      VIEWS._detailCalon = async function(id){
        var a = listCache.find(function(x){ return String(x.id) === String(id); });
        if(!a) return;
        var isPending = a.status === 'Pending';
        openSheet(
          '<div class="row gap-16">'
          + '<div class="avatar lg gold" style="padding:0;overflow:hidden;"><img src="/favicon/web-app-manifest-192x192.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'
          + '<div><div class="display-m">' + esc(a.nama) + '</div>'
          + '<div class="small muted mono">' + esc(a.kode_unik) + '</div>'
          + '<div class="mt-8">' + badgeStatus(a.status) + '</div></div></div>'
          + '<div class="stack gap-10 mt-24">'
          + infoRow('NIK', '<span class="mono">' + esc(a.nik) + '</span> <span class="tiny faint">(termask — terenkripsi di DB)</span>')
          + infoRow('TTL', esc(a.tempat_lahir) + ', ' + SIK.fmtDate(a.tanggal_lahir))
          + infoRow('Jenis kelamin', esc(a.gender))
          + infoRow('Pekerjaan', esc(a.pekerjaan))
          + infoRow('Wilayah', esc(a.kecamatan) + ' — ' + esc(a.desa))
          + infoRow('Alamat', esc(a.alamat || '—'))
          + infoRow('WhatsApp', SIK.fmtPhone(a.whatsapp))
          + infoRow('Email', esc(a.email || '—'))
          + (a.catatan ? infoRow('Catatan sebelumnya', esc(a.catatan)) : '')
          + '</div>'
          + (isPending
            ? '<div class="field mt-24"><label>Catatan (untuk revisi/penolakan)</label><textarea class="textarea" rows="2" id="catatanCalon" placeholder="mis. Foto KTP tidak terbaca jelas"></textarea></div>'
            + '<div class="row gap-12 mt-24 wrap-flex">'
            + '<button class="btn btn-success grow" data-id="' + a.id + '" onclick="VIEWS._aksi(this.dataset.id,\'approve\')">' + IC.check + ' Setujui</button>'
            + '<button class="btn btn-soft grow" data-id="' + a.id + '" onclick="VIEWS._aksi(this.dataset.id,\'revisi\')">Minta revisi</button>'
            + '<button class="btn btn-danger grow" data-id="' + a.id + '" onclick="VIEWS._aksi(this.dataset.id,\'reject\')">' + IC.x + ' Tolak</button>'
            + '</div>'
            : '<div class="row gap-12 mt-24"><button class="btn btn-primary btn-block" data-close>Tutup</button></div>')
        );
      };

      VIEWS._aksi = async function(id, aksi){
        var catatan = (document.getElementById('catatanCalon') || {}).value || '';
        try {
          var res = await SIKAPI.post('/members/' + id + '/' + aksi, { catatan: catatan });
          closeSheetNow();
          showToast(res.message || 'Berhasil.', 'success', 4200);
          if(typeof UI.refreshCounts === 'function') UI.refreshCounts();
          await render();
        } catch(e){
          showToast(e.message, 'danger', 4500);
        }
      };
    },

    /* ================= DAFTAR ANGGOTA ================= */
    anggota: async function(host, role, me){
      var q = '', kec = 'Semua';
      var cache = [];
      var KEC_LIST = [];
      try {
        var w = (await SIKAPI.get('/wilayah')).data;
        KEC_LIST = Object.keys(w);
      } catch(e){}

      await render();

      async function render(){
        var params = new URLSearchParams();
        if(kec !== 'Semua') params.set('kecamatan', kec);
        if(q) params.set('q', q);
        var res = await SIKAPI.get('/members?status=Aktif' + (params.toString() ? '&' + params.toString() : ''));
        cache = res.data;
        host.innerHTML =
          '<div class="table-toolbar list-sticky">'
          + '<div class="input-shell grow" style="max-width:320px;min-height:42px;">'
          + '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.7"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
          + '  <input id="qAnggota" placeholder="Cari nama / ID / desa / WA…" value="' + esc(q) + '" oninput="VIEWS._cari(this.value)">'
          + '</div>'
          + '<select class="select" style="min-height:42px;width:auto;" onchange="VIEWS._filterKec(this.value)">'
          +   ['Semua'].concat(KEC_LIST).map(function(k){ return '<option ' + (kec===k?'selected':'') + '>' + esc(k) + '</option>'; }).join('')
          + '</select>'
          + '<button class="btn btn-soft btn-sm" id="btnDraftPanel" style="margin-left:auto;position:relative;">' + IC.inbox + ' Perubahan Data<span id="draftBtnBadge" style="display:none;margin-left:6px;background:var(--danger,#dc2626);color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px;vertical-align:middle;"></span></button>'
          + '<button class="btn btn-soft btn-sm" onclick="showToast(\'Ekspor Excel tersedia di modul Import/Export.\',\'info\')">' + IC.download + ' Ekspor</button>'
          + '</div>'
          + '<div id="draftPanelWrap"></div>'
          + '<div class="card">'
          + (cache.length === 0
              ? '<div class="empty"><strong>Tidak ditemukan</strong>Coba kata kunci atau filter lain.</div>'
              : '<div class="desktop-table table-wrap card-flat" style="border:none;">'
              + table(['Anggota','ID','Kecamatan','Desa','Sejak','Status',''],
                cache.map(function(a){
                  return [ '<div class="row gap-8">'+photoAvatar(a)+'<strong>'+esc(a.nama)+'</strong></div>',
                    '<span class="mono">'+esc(a.kode_unik)+'</span>', esc(a.kecamatan), esc(a.desa), SIK.fmtDate(String(a.registered_at).slice(0,10)), badgeStatus(a.status),
                    '<button class="btn btn-soft btn-sm" data-id="'+a.id+'" onclick="VIEWS._detail(this.dataset.id)">Detail</button>' ];
                }))
              + '</div>'
              + '<div class="mobile-list">'
              + cache.map(function(a){
                  return mobRow([photoAvatar(a), '<strong>' + esc(a.nama) + '</strong><div class="list-sub">' + esc(a.kode_unik) + ' · ' + esc(a.kecamatan) + '</div>', badgeStatus(a.status)],
                    'data-id="' + a.id + '" onclick="VIEWS._detail(this.dataset.id)"');
                }).join('')
              + '</div>')
          + '</div>';
        var el = document.getElementById('qAnggota');
        if(el && q){ el.focus(); el.setSelectionRange(q.length, q.length); }
        var bdp = document.getElementById('btnDraftPanel');
        if(bdp) bdp.onclick = toggleDraftPanel;
      }

      /* ---------- Panel review perubahan data anggota ---------- */
      var draftOpen = false, draftTab = 'pending';
      /* Badge jumlah pengajuan pending pada tombol (ambil dari stats) */
      (async function(){
        try {
          var st = (await SIKAPI.get('/stats')).data;
          var b = document.getElementById('draftBtnBadge');
          if(b && st.draftPending > 0){ b.textContent = st.draftPending; b.style.display = 'inline-block'; }
        } catch(e){ /* diam */ }
      })();
      var DRAFT_LABEL = { pekerjaan: 'Pekerjaan', alamat: 'Alamat', telegram: 'Telegram', email: 'Email', whatsapp: 'Nomor WhatsApp' };
      async function toggleDraftPanel(){
        draftOpen = !draftOpen;
        var w = document.getElementById('draftPanelWrap');
        if(!w) return;
        if(!draftOpen){ w.innerHTML = ''; return; }
        w.innerHTML = '<div class="card card-pad" id="draftPanel"><div class="skeleton" style="height:120px;"></div></div>';
        try {
          var list = (await SIKAPI.get('/drafts?status=' + draftTab)).data;
          renderDraftPanel(list);
        } catch(e){ showToast(e.message, 'danger'); w.innerHTML = ''; draftOpen = false; }
      }
      function diffHtml(field, before, after){
        var sama = String(before || '') === String(after || '');
        return '<div class="diff-row' + (sama ? '' : ' diff-changed') + '">'
          + '<span class="diff-k">' + esc(DRAFT_LABEL[field] || field) + '</span>'
          + '<span>' + (sama
            ? '<span>' + esc(after || '—') + '</span>'
            : '<span class="diff-old">' + esc(before || '(kosong)') + '</span><span class="diff-arrow">→</span><span class="diff-new">' + esc(after || '(dihapus)') + '</span>')
          + '</span></div>';
      }
      function renderDraftPanel(list){
        var w = document.getElementById('draftPanelWrap');
        if(!w) return;
        var tabs = ['pending','disetujui','ditolak'].map(function(t){
          return '<button class="btn btn-sm ' + (draftTab === t ? 'btn-primary' : 'btn-ghost') + '" data-t="' + t + '">'
            + (t === 'pending' ? 'Menunggu' : (t === 'disetujui' ? 'Disetujui' : 'Ditolak')) + '</button>';
        }).join('');
        w.innerHTML =
          '<div class="card card-pad" id="draftPanel">'
          + '<div class="between wrap-flex gap-12"><h3 class="display-s">Pengajuan perubahan data anggota</h3>'
          + '<button class="btn btn-ghost btn-sm" id="draftPanelClose">Tutup</button></div>'
          + '<div class="row gap-8 mt-12">' + tabs + '</div>'
          + (list.length === 0
              ? '<div class="empty mt-16"><strong>Tidak ada pengajuan</strong>Belum ada anggota yang mengajukan perubahan data pada tab ini.</div>'
              : list.map(function(d){
                var fields = Object.keys(d.payload || {});
                var diffs = fields.map(function(f){ return diffHtml(f, d.before[f], d.payload[f]); }).join('');
                var waktu = d.submitted_at ? String(d.submitted_at).slice(0, 16).replace('T', ' ') : '-';
                var foot = '';
                if(draftTab === 'pending'){
                  foot = '<div class="row gap-8 mt-12 wrap-flex">'
                    + '<input id="rejNote' + d.id + '" placeholder="Alasan penolakan (wajib bila menolak)" style="flex:1;min-width:220px;height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--paper);font:inherit;">'
                    + '<button class="btn btn-primary btn-sm" data-id="' + d.id + '" onclick="VIEWS._draftReview(\'approve\',this.dataset.id)">Setujui</button>'
                    + '<button class="btn btn-ghost btn-sm" style="color:var(--danger);" data-id="' + d.id + '" onclick="VIEWS._draftReview(\'reject\',this.dataset.id)">Tolak</button>'
                    + '</div>';
                } else {
                  foot = '<div class="tiny muted mt-8">Direview ' + (d.reviewed_at ? String(d.reviewed_at).slice(0, 16).replace('T', ' ') : '-')
                    + (d.catatan_review ? ' · catatan: ' + esc(d.catatan_review) : '') + '</div>';
                }
                return '<div class="draft-review mt-16">'
                  + '<div class="between wrap-flex gap-8"><div><strong>' + esc(d.nama) + '</strong> <span class="mono tiny muted">' + esc(d.kode_unik) + '</span>'
                  + '<div class="tiny muted">Diajukan ' + esc(waktu) + '</div></div></div>'
                  + '<div class="mt-8">' + diffs + '</div>'
                  + foot
                  + '</div>';
              }).join(''))
          + '</div>';
        var cl = document.getElementById('draftPanelClose');
        if(cl) cl.onclick = toggleDraftPanel;
        w.querySelectorAll('[data-t]').forEach(function(b){
          b.onclick = async function(){
            draftTab = b.getAttribute('data-t');
            try { renderDraftPanel((await SIKAPI.get('/drafts?status=' + draftTab)).data); }
            catch(e){ showToast(e.message, 'danger'); }
          };
        });
      }
      VIEWS._draftReview = async function(aksi, id){
        var noteEl = document.getElementById('rejNote' + id);
        var catatan = noteEl ? noteEl.value.trim() : '';
        if(aksi === 'reject' && !catatan){ showToast('Isi alasan penolakan dulu.', 'danger'); if(noteEl) noteEl.focus(); return; }
        try {
          var r = await SIKAPI.post('/drafts/' + id + '/' + aksi, { catatan: catatan });
          showToast(r.message || 'Berhasil.', 'success');
          renderDraftPanel((await SIKAPI.get('/drafts?status=' + draftTab)).data);
          /* Perbarui badge tombol & sidebar setelah review */
          try {
            var st = (await SIKAPI.get('/stats')).data;
            var b = document.getElementById('draftBtnBadge');
            if(b){ if(st.draftPending > 0){ b.textContent = st.draftPending; b.style.display = 'inline-block'; } else { b.style.display = 'none'; } }
            if(window.UI && typeof window.UI.refreshBadges === 'function') window.UI.refreshBadges();
          } catch(e){ /* diam */ }
        } catch(e){ showToast(e.message, 'danger'); }
      };

      var tId = null;
      VIEWS._cari = function(v){
        q = v;
        clearTimeout(tId);
        tId = setTimeout(function(){ render().catch(function(e){ showToast(e.message,'danger'); }); }, 300);
      };
      VIEWS._filterKec = function(v){ kec = v; render().catch(function(e){ showToast(e.message,'danger'); }); };

      VIEWS._detail = async function(id){
        try {
          var a = (await SIKAPI.get('/members/' + id)).data;
          var canEdit = (me && me.level === 'superadmin');
          var stCls = a.status === 'Aktif' ? 'badge-success' : (a.status === 'Pending' ? 'badge-warn' : 'badge-danger');
          var avatarHtml = a.foto_path
            ? '<span class="avatar lg gold" style="padding:0;overflow:hidden;"><img src="' + esc(a.foto_path) + '?v=' + Date.now() + '" alt="Foto ' + esc(a.nama) + '" style="width:100%;height:100%;object-fit:cover;" onerror="SIKavatarFallback(this)"></span>'
            : '<span class="avatar lg gold" style="padding:0;overflow:hidden;"><img src="/favicon/web-app-manifest-192x192.png" alt="Foto ' + esc(a.nama) + '" style="width:100%;height:100%;object-fit:cover;"></span>';
          openSheet(
            '<div class="detail-head">'
            + '<div class="detail-title"><div style="min-width:0;">'
            +   '<div class="display-m">' + esc(a.nama) + '</div>'
            +   '<div class="row gap-8 mt-8" style="align-items:center;flex-wrap:wrap;">'
            +     '<span class="badge ' + stCls + '"><span class="dot"></span>' + esc(a.status) + '</span>'
            +     '<span class="small muted mono">' + esc(a.kode_unik) + '</span>'
            +   '</div></div></div>'
            + '<button class="detail-close" data-close aria-label="Tutup" title="Tutup (Esc)">'
            +   '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>'
            + '</div>'
            + '<div class="detail-grid">'
            +   '<div class="detail-aside">'
            +     avatarHtml
            +     '<div style="min-width:0;text-align:center;"><div style="font-weight:700;">' + esc(a.jabatan || 'Anggota') + '</div>'
            +     '<div class="tiny muted mt-8">Wilayah ' + esc(a.kecamatan) + '</div></div>'
            +     (canEdit
              ? '<div class="stack gap-8" style="width:100%;">'
              +   '<label class="btn btn-soft btn-sm btn-block" style="cursor:pointer;">' + IC.upload + ' ' + (a.foto_path ? 'Ganti foto' : 'Unggah foto')
              +   '<input type="file" id="angFoto" accept="image/png,image/jpeg,image/webp" style="display:none;"></label>'
              +   (a.foto_path ? '<button class="btn btn-ghost btn-sm btn-block" id="angFotoDel" style="color:var(--danger);">Hapus foto</button>' : '')
              +   '<span class="tiny faint">PNG/JPG/WEBP \u00b7 maks 2 MB</span></div>'
              : '')
            +   '</div>'
            +   '<div class="detail-body">'
            +     '<div id="detailView">'
            +       '<div class="stack gap-0">' + infoRow('NIK', '<span class="mono">' + esc(a.nik) + '</span>')
            +       infoRow('TTL', esc(a.tempat_lahir || '\u2014') + ', ' + (a.tanggal_lahir ? SIK.fmtDate(a.tanggal_lahir) : '\u2014'))
            +       infoRow('Pekerjaan', esc(a.pekerjaan || '\u2014'))
            +       infoRow('Wilayah', esc(a.kecamatan) + ' \u2014 ' + esc(a.desa))
            +       infoRow('Alamat', esc(a.alamat || '\u2014'))
            +       infoRow('WhatsApp', a.whatsapp ? esc(SIK.fmtPhone(a.whatsapp)) : '\u2014')
            +       (a.telegram ? infoRow('Telegram', esc(a.telegram)) : '')
            +       infoRow('Email', esc(a.email || '\u2014'))
            +       infoRow('Jabatan', esc(a.jabatan || 'Anggota'))
            +       infoRow('Terdaftar', SIK.fmtDate(String(a.registered_at).slice(0,10))) + '</div>'
            +       '<div class="detail-actions">'
            +         '<a class="btn btn-primary" href="vcard.html?id=' + encodeURIComponent(a.kode_unik) + '" target="_blank" rel="noopener">' + IC.idcard + ' Buka vCard</a>'
            +         (canEdit ? '<button class="btn btn-gold" id="btnEditAnggota">\u270e Edit data</button>' : '')
            +         (me && me.level !== 'anggota' ? '<button class="btn btn-success" id="btnKirimKta">\u27a4 Kirim KTA</button>' : '')
            +       '</div>'
            +     '</div>'
            +     '<div id="sendView" class="hidden"></div>'
            +     '<div id="editView" class="hidden"></div>'
            +   '</div>'
            + '</div>',
            { centered: true, sheetClass: 'sheet-detail' }
          );

          /* ---- Panel Kirim KTA: WhatsApp / Telegram / Email terdaftar anggota ---- */
          var icsWa = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
          var icsTg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
          var icsEm = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M22 7l-10 7L2 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          var icsPdf = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
          var icsPng = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="2" stroke="currentColor" stroke-width="1.8"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          function chBtn(ic, title, sub, ok, ch, fmt){
            return '<button class="btn btn-soft btn-block btn-ch" data-ok="' + (ok ? '1' : '') + '"' + (ch ? ' data-ch="' + ch + '" data-fmt="' + (fmt || 'pdf') + '"' : '') + (ok ? '' : ' disabled') + '>'
              + '<span class="ch-ic">' + ic + '</span>'
              + '<span class="ch-txt"><b>' + title + '</b><span class="tiny muted">' + sub + '</span></span>'
              + (ok ? '<span class="ch-go">Kirim \u203a</span>' : '<span class="ch-go" style="color:var(--danger);">Belum terdaftar</span>')
              + '</button>';
          }
          function drawSend(){
            document.getElementById('detailView').classList.add('hidden');
            var sv = document.getElementById('sendView');
            sv.classList.remove('hidden');
            var fmtBtn = function(v, lab, sub){
              return '<button class="btn btn-soft btn-block btn-fmt" data-fmt="' + v + '">'
                + '<span class="ch-ic">' + (v === 'png' ? icsPng : icsPdf) + '</span>'
                + '<span class="ch-txt"><b>' + lab + '</b><span class="tiny muted">' + sub + '</span></span>'
                + '<span class="ch-go">Pilih \u203a</span>'
                + '</button>';
            };
            sv.innerHTML =
              '<div class="stack gap-14">'
              + '<button class="btn btn-ghost btn-sm btn-back" id="sendBack">\u2039 Kembali ke detail</button>'
              + '<h3 class="display-m" style="margin:0;">Kirim Kartu Tanda Anggota</h3>'
              + '<p class="small muted" style="margin:0;">Pilih dulu bentuk berkas yang dikirim:</p>'
              + '<div class="stack gap-10" id="fmtList">'
              + fmtBtn('pdf', 'PDF', 'Dokumen resmi siap cetak (sisi depan, belakang, master)')
              + fmtBtn('png', 'Gambar PNG', 'Tampil langsung di chat — ringkas &amp; cepat dilihat')
              + '</div>'
              + '<div id="chanWrap" class="stack gap-10 hidden"></div>'
              + '<div class="tiny muted">Pengiriman tercatat otomatis di Log Aktivitas.</div>'
              + '</div>';
            document.getElementById('sendBack').onclick = function(){
              sv.classList.add('hidden');
              document.getElementById('detailView').classList.remove('hidden');
            };
            /* Pilih format → tampilkan daftar kanal */
            sv.querySelectorAll('.btn-fmt').forEach(function(fb){
              fb.onclick = function(){
                var fmt = this.dataset.fmt;
                var cw = document.getElementById('chanWrap');
                cw.classList.remove('hidden');
                cw.innerHTML =
                  '<div class="tiny muted" style="margin-top:2px;">Format <b>' + (fmt === 'png' ? 'Gambar PNG' : 'PDF') + '</b> — pilih kanal tujuan:</div>'
                  + chBtn(icsWa, 'WhatsApp', a.whatsapp ? esc(SIK.fmtPhone(a.whatsapp)) : 'Nomor belum terdaftar', !!a.whatsapp, 'wa', fmt)
                  + chBtn(icsTg, 'Telegram', a.telegram ? esc(a.telegram) : 'Chat ID belum terdaftar', !!a.telegram, 'telegram', fmt)
                  + chBtn(icsEm, 'Email', a.email ? esc(a.email) : 'Email belum terdaftar', !!a.email, 'email', fmt);
                cw.querySelectorAll('.btn-ch').forEach(function(b){
                  if(b.dataset.ok){
                    b.onclick = function(){ doSend(b.dataset.ch, b.dataset.fmt, b); };
                  }
                });
                cw.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              };
            });
            async function doSend(channel, format, btn){
              var oldHtml = btn.innerHTML;
              btn.disabled = true; btn.style.opacity = '.65';
              btn.querySelector('.ch-go').textContent = 'Memproses\u2026';
              try {
                var res = await SIKAPI.post('/vcard/' + encodeURIComponent(a.kode_unik) + '/send', {
                  channel: channel,
                  format: format,
                  whatsapp: a.whatsapp || undefined,
                  telegram: a.telegram || undefined,
                  email: a.email || undefined
                });
                showToast(res.message || 'Kartu terkirim.', 'success', 5000);
              } catch(e){
                showToast(e.message, 'danger', 5000);
              }
              btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = oldHtml;
            }
          }
          document.getElementById('btnKirimKta').onclick = drawSend;

          /* ---- Upload / hapus foto profil (superadmin) ---- */
          var fotoFi = document.getElementById('angFoto');
          if(fotoFi){
            fotoFi.onchange = function(){
              var file = fotoFi.files && fotoFi.files[0];
              if(!file) return;
              if(file.size > 2 * 1024 * 1024){ showToast('Ukuran foto maksimal 2 MB.', 'danger'); fotoFi.value=''; return; }
              var rd = new FileReader();
              rd.onload = async function(){
                try {
                  var r = await SIKAPI.uploadJSON('/members/' + id + '/photo', { dataUrl: rd.result });
                  showToast(r.message || 'Foto profil diperbarui.', 'success');
                  closeSheetNow();
                  await render();
                } catch(e){ showToast(e.message, 'danger', 4500); }
              };
              rd.readAsDataURL(file);
            };
          }
          var fotoDel = document.getElementById('angFotoDel');
          if(fotoDel){
            fotoDel.onclick = async function(){
              fotoDel.disabled = true;
              try {
                await SIKAPI.uploadJSON('/members/' + id + '/photo', { remove: true });
                showToast('Foto profil dihapus.', 'success');
                closeSheetNow();
                await render();
              } catch(e){ showToast(e.message, 'danger', 4500); fotoDel.disabled = false; }
            };
          }

          /* ---- Edit data (superadmin) — form asli, kini dalam modal tengah ---- */
          if(canEdit){
            document.getElementById('btnEditAnggota').onclick = function(){
              var w = null;
              SIKAPI.get('/wilayah').then(function(r){ w = r.data; drawEdit(); }).catch(drawEdit);
              function drawEdit(){
                var kecOpts = w ? Object.keys(w) : [a.kecamatan];
                var desaOpts = (w && w[a.kecamatan]) ? w[a.kecamatan] : [a.desa];
                document.getElementById('detailView').classList.add('hidden');
                var ev = document.getElementById('editView');
                ev.classList.remove('hidden');
                ev.innerHTML =
                  '<div class="stack gap-14">'
                  + '<div class="field"><label>Nama</label><div class="input-shell"><input id="eNama" value="' + esc(a.nama) + '"></div></div>'
                  + '<div class="grid-2">'
                  + '<div class="field"><label>NIK (16 digit)</label><div class="input-shell"><input id="eNik" maxlength="16" value="' + esc(a.nik) + '"></div></div>'
                  + '<div class="field"><label>Jenis kelamin</label><select class="select" id="eGender"><option ' + (a.gender==='Laki-laki'?'selected':'') + '>Laki-laki</option><option ' + (a.gender==='Perempuan'?'selected':'') + '>Perempuan</option></select></div>'
                  + '</div>'
                  + '<div class="grid-2">'
                  + '<div class="field"><label>Tempat lahir</label><div class="input-shell"><input id="eTempat" value="' + esc(a.tempat_lahir || '') + '"></div></div>'
                  + '<div class="field"><label>Tanggal lahir</label><div class="input-shell"><input id="eTgl" type="date" value="' + (a.tanggal_lahir || '') + '"></div></div>'
                  + '</div>'
                  + '<div class="grid-2">'
                  + '<div class="field"><label>Kecamatan</label><select class="select" id="eKec">' + kecOpts.map(function(k){ return '<option ' + (k===a.kecamatan?'selected':'') + '>' + esc(k) + '</option>'; }).join('') + '</select></div>'
                  + '<div class="field"><label>Desa</label><select class="select" id="eDesa">' + desaOpts.map(function(d){ return '<option ' + (d===a.desa?'selected':'') + '>' + esc(d) + '</option>'; }).join('') + '</select></div>'
                  + '</div>'
                  + '<div class="field"><label>Alamat</label><div class="input-shell"><input id="eAlamat" value="' + esc(a.alamat || '') + '"></div></div>'
                  + '<div class="grid-2">'
                  + '<div class="field"><label>WhatsApp</label><div class="input-shell"><input id="eWa" value="' + esc(a.whatsapp) + '"></div></div>'
                  + '<div class="field"><label>Telegram</label><div class="input-shell"><input id="eTg" value="' + esc(a.telegram || '') + '" placeholder="@username / chat id"></div></div>'
                  + '</div>'
                  + '<div class="grid-2">'
                  + '<div class="field"><label>Email</label><div class="input-shell"><input id="eEmail" value="' + esc(a.email || '') + '"></div></div>'
                  + '<div class="field"><label>Jabatan</label><div class="input-shell"><input id="eJab" value="' + esc(a.jabatan || 'Anggota') + '"></div></div>'
                  + '</div>'
                  + '<div class="field"><label>Status</label><select class="select" id="eStatus">'
                  + ['Pending','Revisi','Ditolak','Aktif'].map(function(s){ return '<option ' + (s===a.status?'selected':'') + '>' + s + '</option>'; }).join('')
                  + '</select></div>'
                  + '<div class="row gap-12 mt-8">'
                  + '<button class="btn btn-primary grow" id="eSave">Simpan perubahan</button>'
                  + '<button class="btn btn-soft" id="eCancel">Batal</button>'
                  + '</div></div>';
                document.getElementById('eKec').onchange = function(){
                  if(!w) return;
                  document.getElementById('eDesa').innerHTML = (w[this.value] || []).map(function(d){ return '<option>' + esc(d) + '</option>'; }).join('');
                };
                document.getElementById('eCancel').onclick = function(){
                  ev.classList.add('hidden'); ev.innerHTML = '';
                  document.getElementById('detailView').classList.remove('hidden');
                };
                document.getElementById('eSave').onclick = async function(){
                  var btn = this; btn.disabled = true; btn.textContent = 'Menyimpan\u2026';
                  try {
                    await SIKAPI.put('/members/' + id, {
                      nama: document.getElementById('eNama').value.trim(),
                      nik: document.getElementById('eNik').value.trim(),
                      gender: document.getElementById('eGender').value,
                      tempat_lahir: document.getElementById('eTempat').value.trim(),
                      tanggal_lahir: document.getElementById('eTgl').value,
                      kecamatan: document.getElementById('eKec').value,
                      desa: document.getElementById('eDesa').value,
                      alamat: document.getElementById('eAlamat').value.trim(),
                      whatsapp: document.getElementById('eWa').value.trim(),
                      telegram: document.getElementById('eTg').value.trim(),
                      email: document.getElementById('eEmail').value.trim(),
                      jabatan: document.getElementById('eJab').value.trim(),
                      status: document.getElementById('eStatus').value
                    });
                    showToast('Data anggota diperbarui.', 'success');
                    closeSheetNow();
                    await render();
                  } catch(e){
                    showToast(e.message, 'danger', 4500);
                    btn.disabled = false; btn.textContent = 'Simpan perubahan';
                  }
                };
              }
            };
          }
        } catch(e){ showToast(e.message, 'danger'); }
      };
    },

    /* ================= WEBSITE: BERANDA / LOGIN (skema dari server) ================= */
    _contentEditor: async function(host, role, pageId){
      var res = await SIKAPI.get('/content');
      var d = res.data, schema = res.schema || [], canEdit = !!res.canEdit;
      var sections = schema.filter(function(s){ return s.page === pageId; });
      function renderField(f){
        var val = d[f.key] || '';
        if(f.type === 'image'){
          var has = !!val;
          return '<div class="field" data-fkey="' + f.key + '">'
            + '<label>' + esc(f.label) + '</label>'
            + '<div class="row gap-12">'
            +   '<div class="ck-img-prev" data-prev="' + f.key + '">' + (has ? '<img src="/' + esc(val) + '" alt="">' : '<span class="tiny faint">Belum ada gambar</span>') + '</div>'
            +   '<div class="stack gap-8">'
            +     (canEdit ? '<label class="btn btn-soft btn-sm" style="cursor:pointer;">Pilih gambar…<input type="file" accept="image/png,image/jpeg,image/webp" style="display:none;" onchange="VIEWS._ckUpload(this, \'' + f.key + '\')"></label>'
            +                  (has ? '<button type="button" class="btn btn-ghost btn-sm" onclick="VIEWS._ckRemoveImg(\'' + f.key + '\')">Hapus</button>' : '')
                       : '')
            +     '<span class="tiny faint">PNG / JPG / WEBP · maks 3 MB</span>'
            +   '</div>'
            + '</div></div>';
        }
        if(f.type === 'area'){
          return '<div class="field"><label>' + esc(f.label) + '</label>'
            + '<textarea class="textarea" data-key="' + f.key + '" rows="8" placeholder="' + esc(f.ph) + '"' + (canEdit ? '' : ' disabled') + '>' + esc(val) + '</textarea></div>';
        }
        return '<div class="field"><label>' + esc(f.label) + '</label>'
          + '<div class="input-shell"><input data-key="' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.ph) + '"' + (canEdit ? '' : ' disabled') + '></div></div>';
      }
      /* Untuk halaman bantuan (page "pages"): isi textarea panjang dirender
         sebagai kartu langkah/paragraf + preview langsung di bawahnya. */
      function renderFieldRich(f){
        var isBody = /_body$/.test(f.key);
        var html = renderField(f);
        if(!isBody) return html;
        var blocks = String(d[f.key] || '').split(/\n+/).map(function(s){ return s.trim(); }).filter(Boolean);
        var priv = /privacy/.test(f.key);
        var items = blocks.map(function(b, i){
          return '<li class="ckb-item' + (priv ? ' ckb-par' : '') + '"><span class="ckb-n">' + (i + 1) + '</span><span>' + esc(b.replace(/^\d+\.\s*/, '')) + '</span></li>';
        }).join('') || '<li class="ckb-item ckb-par"><span class="tiny faint">Belum ada isi — kolom masih kosong (fallback bawaan dipakai di website).</span></li>';
        return html
          + '<div class="ckb-wrap"><span class="tiny faint" style="margin-bottom:8px;display:block;">Pratinjau langsung — otomatis mengikuti kolom di atas:</span>'
          + '<ol class="ckb-list">' + items + '</ol></div>';
      }
      var pageTitle = pageId === 'home' ? 'Beranda' : (pageId === 'login' ? 'Halaman Login' : 'Halaman Lainnya');
      host.innerHTML =
        '<div class="sticky-save between wrap-flex gap-12">'
        + '<div><h3 class="display-s">Konten ' + pageTitle + '</h3>'
        + '<p class="small muted mt-8">Klik section untuk membuka pengaturannya. Kosongkan kolom &rarr; teks bawaan yang dipakai. Perubahan tampil setelah tombol Simpan ditekan.</p></div>'
        + '<div class="row gap-8 wrap-flex">'
        + (canEdit ? '<button class="btn btn-primary" id="ckSave">Simpan konten</button>' : '<span class="badge badge-warn">Hanya superadmin dapat mengubah</span>')
        + '<button class="btn btn-soft" id="ckPreview">' + (IC.globe || '') + ' Preview</button>'
        + '</div>'
        + '</div>'
        + '<div class="mt-24">'
        + sections.map(function(sec, i){
            return '<details class="card ck-sec"' + (i === 0 ? ' open' : '') + '>'
              + '<summary><span class="ck-sec-title">' + esc(sec.title) + '</span><span class="ck-chev">' + IC.chev + '</span></summary>'
              + '<div class="ck-grid">'
              + sec.groups.map(function(g){
                  return '<div class="ck-group"><h4>' + esc(g.label) + '</h4>'
                    + g.fields.map(pageId === 'pages' ? renderFieldRich : renderField).join('')
                    + '</div>';
                }).join('')
              + '</div></details>';
          }).join('')
        + '</div>'
        + '</div>';

      var prevWrap = '<div class="ck-prev-wrap" id="ckPrevWrap">'
        + '<div class="ck-prev-bar">'
        + '<span class="small" style="font-weight:700;">Preview — perubahan yang belum disimpan ikut ditampilkan</span>'
        + '<span class="row gap-8">'
        + '<button class="btn btn-soft btn-sm" id="ckPrevReload">Muat ulang</button>'
        + '<button class="btn btn-ghost btn-sm" id="ckPrevClose">Tutup</button>'
        + '</span></div>'
        + '<iframe class="ck-prev-frame" id="ckPrevFrame" title="Preview halaman"></iframe>'
        + '</div>';
      host.insertAdjacentHTML('beforeend', prevWrap);
      function collectEdits(){
        var o = {};
        host.querySelectorAll('[data-key]').forEach(function(el){
          var v = el.value.trim();
          if(v) o[el.getAttribute('data-key')] = v;
          else delete o[el.getAttribute('data-key')];
        });
        return o;
      }
      function openPreview(){
        var edits = collectEdits();
        fetch('/api/public/content').then(function(r){ return r.json(); }).then(function(j){
          var saved = (j && j.ok && j.data) || {};
          var merged = Object.assign({}, saved, edits);
          var vals = JSON.stringify(merged).replace(/<\/script/gi, '<\\/script');
          var wrap = document.getElementById('ckPrevWrap');
          wrap.classList.add('is-open');
          wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          fetch(pageId === 'home' ? '/index.html' : (pageId === 'login' ? '/login.html' : '/help-verify.html')).then(function(r){ return r.text(); }).then(function(html){
            /* Intersep fetch /api/public/content di dalam iframe → skrip bawaan
               halaman menerapkan data gabungan (tersimpan + editan form) sendiri,
               termasuk tema warna — tanpa konflik race dengan skrip halaman. */
            var injected = '<script>(function(){window.CK_PREVIEW=' + vals + ';'
              + 'var of=window.fetch;window.fetch=function(u,o){'
              + 'if(String(u).indexOf("/api/public/content")>-1){'
              + 'return Promise.resolve(new Response(JSON.stringify({ok:true,data:window.CK_PREVIEW}),{status:200,headers:{"Content-Type":"application/json"}}));}'
              + 'return of.apply(this,arguments);};})();</scr' + 'ipt>';
            html = html.replace(/<head([^>]*)>/i, function(m){ return m + injected; });
            document.getElementById('ckPrevFrame').srcdoc = html;
          });
        });
      }
      document.getElementById('ckPreview').onclick = openPreview;
      document.getElementById('ckPrevReload').onclick = openPreview;
      document.getElementById('ckPrevClose').onclick = function(){
        document.getElementById('ckPrevWrap').classList.remove('is-open');
        document.getElementById('ckPrevFrame').srcdoc = '';
      };
      if(!canEdit) return;
      document.getElementById('ckSave').onclick = async function(){
        var btn = this; btn.disabled = true; btn.textContent = 'Menyimpan…';
        var body = {};
        host.querySelectorAll('[data-key]').forEach(function(el){ body[el.dataset.key] = el.value.trim(); });
        try {
          var r = await SIKAPI.put('/content', body);
          showToast(r.message || 'Konten situs disimpan.', 'success');
        } catch(e){ showToast(e.message, 'danger', 4500); }
        btn.disabled = false; btn.textContent = 'Simpan konten';
      };
    },

    _ckUpload: async function(input, key){
      var file = input.files && input.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = async function(){
        try {
          var r = await SIKAPI.uploadJSON('/content/image', { key: key, dataUrl: reader.result });
          var prev = document.querySelector('[data-prev="' + key + '"]');
          if(prev) prev.innerHTML = '<img src="/' + r.path + '?t=' + Date.now() + '" alt="">';
          var field = input.closest('[data-fkey]');
          if(field && !field.querySelector('.btn-ghost')){
            var rm = document.createElement('button');
            rm.type = 'button'; rm.className = 'btn btn-ghost btn-sm';
            rm.textContent = 'Hapus'; rm.setAttribute('onclick', "VIEWS._ckRemoveImg('" + key + "')");
            field.querySelector('.stack').appendChild(rm);
          }
          showToast('Gambar tersimpan dan langsung tampil di website.', 'success');
        } catch(e){ showToast(e.message, 'danger', 4500); }
      };
      reader.readAsDataURL(file);
    },

    _ckRemoveImg: async function(key){
      try {
        var r = await SIKAPI.raw('/api/content/image/' + encodeURIComponent(key), 'DELETE');
        var j = await r.json();
        if(!j.ok) throw new Error(j.error || 'Gagal menghapus gambar.');
        var prev = document.querySelector('[data-prev="' + key + '"]');
        if(prev) prev.innerHTML = '<span class="tiny faint">Belum ada gambar</span>';
        var field = document.querySelector('[data-fkey="' + key + '"]');
        if(field){ var b = field.querySelector('.stack .btn-ghost'); if(b) b.remove(); }
        showToast('Gambar dihapus — website kembali memakai tampilan bawaan.', 'success');
      } catch(e){ showToast(e.message, 'danger', 4500); }
    },

    /* ================= FORM PENDAFTARAN (field dinamis) =================
       Kelola definisi field formulir pendaftaran publik: label, wajib,
       aktif, urutan, opsi select, dan field tambahan (reg_extra_*). */
    /* ================= BEBAN SISTEM & HALAMAN ANTRIAN =================
       Kontrol terpusat deteksi sibuk: saklar aktif/nonaktif, mode manual,
       ambang, dan status langsung — dipindah dari dalam Pengaturan agar
       mudah dijangkau saat sistem sedang bermasalah. */
    beban: async function(host, role){
      if(VIEWS._bebanTimer){ clearInterval(VIEWS._bebanTimer); VIEWS._bebanTimer = null; }
      var canEdit = role === 'superadmin';
      var first = null;
      try { first = await SIKAPI.get('/busy'); } catch(e){}
      var b = (first && first.data) || { mode:'auto', manualOn:false, busy:false, state:'normal', inflight:0, peak:0, lagMs:0, maxConc:8, maxLagMs:250, holdSecs:10, releaseSecs:20, platform:'node', uptimeSecs:0, warming:false };

      var stateTxt = { normal:'Normal — antrian tertutup', busy:'Sibuk — antrian TERBUKA', recovering:'Pemulihan — antrian akan menutup', off:'Mati — semua pengunjung dilayani langsung' };
      var stateCls = { normal:'badge-success', busy:'badge-danger', recovering:'badge-warn', off:'badge-neutral' };
      var isOn = b.mode !== 'off';

      host.innerHTML =
        '<div class="sticky-save between wrap-flex gap-12">'
        + '<div><h3 class="display-s">Beban Sistem &amp; Antrian</h3>'
        + '<p class="small muted mt-8">Deteksi sibuk otomatis + halaman antrian (busy.html). Aktifkan bila server sering kewalahan; matikan bila halaman antrian justru mengganggu — semua pengunjung langsung dilayani tanpa antrian.</p></div>'
        + '<div class="row gap-8 wrap-flex">'
        + (canEdit
          ? '<button class="btn ' + (isOn ? 'btn-ghost' : 'btn-primary') + '" id="bbToggle">' + (isOn ? 'Matikan deteksi sibuk' : 'Aktifkan deteksi sibuk') + '</button>'
          : '<span class="badge badge-warn">Hanya superadmin dapat mengubah</span>')
        + '</div></div>'

        /* ---------- Status langsung ---------- */
        + '<div class="card card-pad mt-16">'
        + '<div class="between wrap-flex gap-8"><h4 style="margin:0;">Status langsung</h4><span class="badge ' + (stateCls[b.state] || 'badge-neutral') + '" id="bbState">' + esc(stateTxt[b.state] || b.state) + '</span></div>'
        + '<div class="grid-2 mt-16" id="bbMetrics">'
        + statCard('Permintaan aktif', String(b.inflight || 0), IC.activity || IC.grid)
        + statCard('Puncak (10 dtk)', String(b.peak || 0), IC.chart)
        + statCard('Jeda event-loop', (b.lagMs || 0) + ' ms', IC.pulse)
        + statCard('Platform', (b.platform === 'node' ? 'Node persisten' : 'Serverless (' + esc(b.platform) + ')') + (b.warming ? ' · fase bangun' : ''), IC.globe)
        + '</div>'
        + '<p class="tiny faint mt-12" id="bbDetail">Mode ' + esc(b.mode) + ' · ambang ' + (b.maxConc || 8) + ' permintaan / ' + (b.maxLagMs || 250) + ' ms · rilis di bawah ' + Math.round((b.maxLagMs || 250) * 0.6) + ' ms'
        + (b.gateSuppressed ? ' · <b style="color:var(--warn);">pemutus alihan aktif (' + (b.suppressSecs || 0) + ' dtk) — pengunjung sementara masuk langsung</b>' : '')
        + (b.graceActive ? ' · ambang lag diperketat sementara (pasca-rilis)' : '')
        + '.</p>'
        + '</div>'

        /* ---------- Pengaturan ---------- */
        + '<div class="card card-pad mt-16">'
        + '<h4 style="margin:0;">Pengaturan deteksi</h4>'
        + '<div class="grid-2 mt-16">'
        + '<div class="field"><label>Mode deteksi</label>'
        + '<div class="input-shell"><select id="bbMode" ' + (canEdit ? '' : 'disabled') + '>'
        + '<option value="off"' + (b.mode === 'off' ? ' selected' : '') + '>Mati — antrian tidak pernah terbuka</option>'
        + '<option value="auto"' + (b.mode === 'auto' ? ' selected' : '') + '>Auto — deteksi otomatis (disarankan)</option>'
        + '<option value="manual"' + (b.mode === 'manual' ? ' selected' : '') + '>Manual — dikendalikan di bawah</option>'
        + '</select></div></div>'
        + '<div class="field" id="bbManualWrap" style="display:' + (b.mode === 'manual' ? 'block' : 'none') + ';"><label>Status antrian (manual)</label>'
        + '<div class="input-shell"><select id="bbManual" ' + (canEdit ? '' : 'disabled') + '>'
        + '<option value="0"' + (!b.manualOn ? ' selected' : '') + '>Tutup — sistem normal</option>'
        + '<option value="1"' + (b.manualOn ? ' selected' : '') + '>Buka — paksa pengunjung mengantri</option>'
        + '</select></div></div>'
        + '</div>'
        + '<div class="grid-2 mt-12">'
        + '<div class="field"><label>Ambang permintaan aktif</label><div class="input-shell"><input id="bbConc" type="number" min="1" value="' + (b.maxConc || 8) + '" ' + (canEdit ? '' : 'disabled') + '></div><span class="hint">Antrian terbuka bila permintaan bersamaan melebihi angka ini.</span></div>'
        + '<div class="field"><label>Ambang jeda server (ms)</label><div class="input-shell"><input id="bbLag" type="number" min="20" value="' + (b.maxLagMs || 250) + '" ' + (canEdit ? '' : 'disabled') + '></div><span class="hint">Keterlambatan event-loop yang dianggap kewalahan.</span></div>'
        + '</div>'
        + '<div class="grid-2 mt-12">'
        + '<div class="field"><label>Tahan sebelum antrian (detik)</label><div class="input-shell"><input id="bbHold" type="number" min="1" value="' + (b.holdSecs || 10) + '" ' + (canEdit ? '' : 'disabled') + '></div><span class="hint">Lonjakan sesaat tidak langsung membuka antrian.</span></div>'
        + '<div class="field"><label>Lepas setelah normal (detik)</label><div class="input-shell"><input id="bbRelease" type="number" min="5" value="' + (b.releaseSecs || 20) + '" ' + (canEdit ? '' : 'disabled') + '></div><span class="hint">Antrian ditutup setelah beban stabil normal selama durasi ini.</span></div>'
        + '</div>'
        + (canEdit ? '<div class="row gap-12 mt-16"><button class="btn btn-primary btn-sm" id="bbSave">Simpan Pengaturan</button><button class="btn btn-soft btn-sm" id="bbTest">Lihat halaman antrian</button></div>' : '')
        + (!first ? '<p class="hint mt-8">Backend belum mendukung modul beban sistem — perbarui server ke versi terbaru.</p>' : '')
        + '</div>'
        + '<p class="tiny faint mt-8">Catatan: admin &amp; superadmin tidak pernah di-antrikan (tetap bisa masuk mengendalikan sistem). Status juga tersedia publik via /api/public/busy-status.</p>';

      function el(id){ return document.getElementById(id); }

      /* Saklar utama: langsung PUT tanpa lewat form — keputusan darurat satu klik */
      var tgl = el('bbToggle');
      if(tgl) tgl.onclick = async function(){
        tgl.disabled = true;
        try {
          await SIKAPI.put('/busy', { mode: isOn ? 'off' : 'auto' });
          showToast(isOn ? 'Deteksi sibuk dimatikan — halaman antrian tidak akan muncul.' : 'Deteksi sibuk diaktifkan (mode auto).', 'success');
          return VIEWS.beban(host, role);
        } catch(e){ showToast(e.message, 'danger'); tgl.disabled = false; }
      };

      var modeSel = el('bbMode');
      if(modeSel){
        modeSel.onchange = function(){ var w = el('bbManualWrap'); if(w) w.style.display = modeSel.value === 'manual' ? 'block' : 'none'; };
      }

      var saveBtn = el('bbSave');
      if(saveBtn) saveBtn.onclick = async function(){
        try {
          var body = { mode: el('bbMode').value };
          if(body.mode === 'manual') body.manualOn = el('bbManual').value === '1';
          body.maxConc = parseInt(el('bbConc').value, 10);
          body.maxLagMs = parseInt(el('bbLag').value, 10);
          body.holdSecs = parseInt(el('bbHold').value, 10);
          body.releaseSecs = parseInt(el('bbRelease').value, 10);
          await SIKAPI.put('/busy', body);
          showToast('Pengaturan beban sistem disimpan.', 'success');
        } catch(e){ showToast(e.message, 'danger'); }
      };

      var testBtn = el('bbTest');
      if(testBtn) testBtn.onclick = function(){ window.open('/busy.html?n=preview&ret=/dashboard', '_blank'); };

      /* Status langsung menyegarkan diri tiap 5 dtk selama view terbuka */
      async function refreshStatus(){
        var stEl = el('bbState');
        if(!stEl){ if(VIEWS._bebanTimer){ clearInterval(VIEWS._bebanTimer); VIEWS._bebanTimer = null; } return; }
        try {
          var r = await SIKAPI.get('/busy');
          var d = (r && r.data) || {};
          stEl.textContent = stateTxt[d.state] || d.state || '—';
          stEl.className = 'badge ' + (stateCls[d.state] || 'badge-neutral');
          var det = el('bbDetail');
          if(det){
            det.innerHTML = 'Mode ' + esc(d.mode || '-') + ' · ambang ' + (d.maxConc || 8) + ' permintaan / ' + (d.maxLagMs || 250) + ' ms · rilis di bawah ' + Math.round((d.maxLagMs || 250) * 0.6) + ' ms'
              + (d.gateSuppressed ? ' · <b style="color:var(--warn);">pemutus alihan aktif (' + (d.suppressSecs || 0) + ' dtk) — pengunjung sementara masuk langsung</b>' : '')
              + (d.graceActive ? ' · ambang lag diperketat sementara (pasca-rilis)' : '')
              + '.';
          }
          var m = el('bbMetrics');
          if(m){
            m.innerHTML = statCard('Permintaan aktif', String(d.inflight || 0), IC.activity || IC.grid)
              + statCard('Puncak (10 dtk)', String(d.peak || 0), IC.chart)
              + statCard('Jeda event-loop', (d.lagMs || 0) + ' ms', IC.pulse)
              + statCard('Platform', (d.platform === 'node' ? 'Node persisten' : 'Serverless (' + esc(d.platform || '-') + ')') + (d.warming ? ' · fase bangun' : ''), IC.globe);
          }
        } catch(e){ /* diam — coba lagi pada tick berikutnya */ }
      }
      VIEWS._bebanTimer = setInterval(refreshStatus, 5000);
    },

    /* ================= FORM PENDAFTARAN (field dinamis) ================= */
    formFields: async function(host, role){
      var canEdit = role === 'superadmin';
      var res = await SIKAPI.get('/reg-fields');
      var fields = (res.data || []).slice();
      var maxExtra = (res.maxExtra != null) ? res.maxExtra : 8;

      host.innerHTML =
        '<div class="sticky-save between wrap-flex gap-12">'
        + '<div><h3 class="display-s">Field Form Pendaftaran</h3>'
        + '<p class="small muted mt-8">Atur label, wajib/tidak, aktif/nonaktif, dan urutan field formulir pendaftaran publik — termasuk halaman daftar &amp; widget embed. '
        + '<span class="badge badge-neutral mt-8">12 field inti + maks ' + maxExtra + ' tambahan</span>'
        + '</p></div>'
        + '<div class="row gap-8 wrap-flex">'
        + (canEdit
          ? '<button class="btn btn-soft" id="rfAdd">+ Field tambahan</button><button class="btn btn-ghost" id="rfReset">Kembalikan bawaan</button><button class="btn btn-primary" id="rfSave">Simpan perubahan</button>'
          : '<span class="badge badge-warn">Hanya superadmin dapat mengubah</span>')
        + '</div></div>'
        + '<div class="card mt-16"><div class="stack gap-8" id="rfRows"></div></div>'
        + '<p class="tiny faint mt-8">Field bertanda 📌 terhubung kolom database &amp; alur verifikasi — selalu aktif dan tidak dapat dihapus. Field tambahan disimpan di kolom reg_extra anggota.</p>';

      function el(id){ return document.getElementById(id); }
      function isExtra(f){ return String(f.key).indexOf('reg_extra_') === 0; }
      function reindex(){ fields.forEach(function(f, i){ f.order = i + 1; }); }
      function typeBadge(t){
        var m = { text:'Teks', textarea:'Teks panjang', tel:'Telepon', email:'Email', date:'Tanggal', number:'Angka', select:'Pilihan', wilayah:'Wilayah' };
        return m[t] || t;
      }

      function rowHtml(f, i){
        var locked = !!f.locked;
        return '<div class="rf-row" data-i="' + i + '" style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--card);">'
          + '<div class="row gap-8 wrap-flex" style="align-items:center;flex-wrap:nowrap;">'
          +   '<span class="tiny muted" style="width:22px;text-align:center;flex-shrink:0;">' + (i + 1) + '</span>'
          +   '<div class="input-shell" style="flex:1;min-width:150px;"><input data-act="label" value="' + esc(f.label) + '" placeholder="' + esc(f.label) + '"' + (canEdit && !locked ? '' : ' disabled') + '></div>'
          +   '<span class="badge badge-neutral mono" style="flex-shrink:0;">' + esc(f.key) + '</span>'
          +   '<span class="tiny muted" style="flex-shrink:0;">' + typeBadge(f.type) + '</span>'
          +   '<button type="button" class="btn btn-sm ' + (f.required ? 'btn-soft' : 'btn-ghost') + '" data-act="req" title="Wajib diisi pengguna"' + (canEdit && !locked ? '' : ' disabled') + ' style="flex-shrink:0;">Wajib: ' + (f.required ? 'Ya' : 'Tidak') + '</button>'
          +   (locked
              ? '<span class="badge badge-success" style="flex-shrink:0;">📌 Wajib aktif</span>'
              : '<button type="button" class="btn btn-sm ' + (f.active ? 'btn-soft' : 'btn-ghost') + '" data-act="act" title="Tampilkan di form"' + (canEdit ? '' : ' disabled') + ' style="flex-shrink:0;">' + (f.active ? 'Aktif' : 'Nonaktif') + '</button>')
          +   '<span style="margin-left:auto;display:inline-flex;gap:4px;flex-shrink:0;">'
          +     (canEdit ? '<button type="button" class="btn btn-ghost btn-sm" data-act="up" title="Naikkan urutan">↑</button><button type="button" class="btn btn-ghost btn-sm" data-act="down" title="Turunkan urutan">↓</button>' : '')
          +     (canEdit && isExtra(f) ? '<button type="button" class="btn btn-ghost btn-sm" data-act="del" title="Hapus field" style="color:var(--danger);">✕</button>' : '')
          +   '</span>'
          + '</div>'
          + (f.type === 'select'
            ? '<div class="mt-8" style="padding-left:30px;"><label class="tiny muted">Opsi pilihan (pisahkan dengan koma)</label>'
              + '<textarea class="textarea" data-act="opts" rows="2" placeholder="Opsi 1, Opsi 2, Opsi 3"' + (canEdit && !locked ? '' : ' disabled') + '>' + esc((f.options || []).join(', ')) + '</textarea></div>'
            : '')
          + '</div>';
      }

      function renderRows(){
        var box = el('rfRows'); if(!box) return;
        reindex();
        box.innerHTML = fields.map(rowHtml).join('');
        if(!canEdit) return;
        box.querySelectorAll('[data-act]').forEach(function(node){
          var act = node.dataset.act, i = +node.closest('.rf-row').dataset.i;
          if(act === 'label'){
            node.addEventListener('input', function(){ fields[i].label = node.value; });
          } else if(act === 'opts'){
            node.addEventListener('input', function(){
              fields[i].options = node.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
            });
          } else if(act === 'req'){
            node.onclick = function(){ fields[i].required = !fields[i].required; renderRows(); };
          } else if(act === 'act'){
            node.onclick = function(){ fields[i].active = !fields[i].active; renderRows(); };
          } else if(act === 'up' || act === 'down'){
            node.onclick = function(){
              var j = act === 'up' ? i - 1 : i + 1;
              if(j < 0 || j >= fields.length) return;
              var tmp = fields[i]; fields[i] = fields[j]; fields[j] = tmp;
              renderRows();
            };
          } else if(act === 'del'){
            node.onclick = function(){
              if(!confirm('Hapus field "' + (fields[i].label || fields[i].key) + '"? Data lama yang sudah tersimpan pada anggota tidak ikut terhapus.')) return;
              fields.splice(i, 1); renderRows();
            };
          }
        });
      }

      function addField(){
        var n = fields.filter(isExtra).length;
        if(n >= maxExtra){ showToast('Maksimal ' + maxExtra + ' field tambahan.', 'danger'); return; }
        var label = prompt('Label field baru (mis. "Golongan Darah"):', '');
        if(label == null) return;
        label = label.trim().slice(0, 60);
        if(!label) return;
        var base = 'reg_extra_' + (label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || ('field_' + (n + 1)));
        var key = base, k = 2;
        while(fields.some(function(f){ return f.key === key; })){ key = base + '_' + k; k++; }
        fields.push({ key: key, label: label, type: 'text', options: null, required: false, active: true, locked: false, order: fields.length + 1, placeholder: '' });
        renderRows();
        var box = el('rfRows');
        if(box && box.lastElementChild) box.lastElementChild.scrollIntoView({ behavior:'smooth', block:'center' });
      }

      async function save(){
        reindex();
        var btn = el('rfSave');
        btn.disabled = true; btn.textContent = 'Menyimpan…';
        try {
          var r = await SIKAPI.put('/reg-fields', { fields: fields });
          showToast(r.message || 'Konfigurasi field pendaftaran tersimpan.', 'success');
          return VIEWS.formFields(host, role);
        } catch(e){
          showToast(e.message, 'danger', 5200);
          btn.disabled = false; btn.textContent = 'Simpan perubahan';
        }
      }

      async function reset(){
        if(!confirm('Kembalikan semua field pendaftaran ke bawaan? Label kustom & field tambahan akan dihapus dari konfigurasi (data anggota tidak terpengaruh).')) return;
        var btn = el('rfReset');
        btn.disabled = true;
        try {
          var r = await SIKAPI.del('/reg-fields');
          showToast(r.message || 'Field pendaftaran kembali ke bawaan.', 'success');
          return VIEWS.formFields(host, role);
        } catch(e){ showToast(e.message, 'danger', 5200); btn.disabled = false; }
      }

      renderRows();
      var bSave = el('rfSave'); if(bSave) bSave.onclick = save;
      var bReset = el('rfReset'); if(bReset) bReset.onclick = reset;
      var bAdd = el('rfAdd'); if(bAdd) bAdd.onclick = addField;
    },

    /* ================= DESAIN KARTU FISIK (template kustom) ================= */
    kartuDesain: async function(host, role){
      var res = await SIKAPI.get('/kta-template');
      var t = res.data, canEdit = !!res.canEdit, isCustom = !!res.custom;
      var presets = res.presets || { list: [], active: null };
      /* Pilihan field untuk pemetaan konten kartu (bawaan + field form pendaftaran) */
      var fieldOpts = [];
      try { fieldOpts = (await SIKAPI.get('/kta-fields')).data || []; } catch(e){ fieldOpts = []; }
      /* Migrasi semantik: dulu x dipakai sebagai tepi KANAN saat rata kanan
         (14 & 82) — sekarang x = tepi kiri elemen, jadi tepi kanan = 96.4
         (sejajar QR/foto, persis vcard.html). */
      if(res.data.front && res.data.front.data && res.data.front.data.x === 14 && res.data.front.data.align !== 'left'){ res.data.front.data.x = 96.4; }
      if(res.data.front && res.data.front.title && res.data.front.title.x === 82){ res.data.front.title.x = 96.4; }
      var DEF = {
        front: { qr:{x:85.5,y:6.6,w:10}, photo:{x:78.6,y:20.4,w:17.9}, data:{x:96.4,y:40,align:'right'}, title:{x:96.4,y:58.95} },
        back:  { bg_color:'#f5efdc', qr:{x:8,y:22,w:22} }
      };
      var activeSide = 'front';
      var member = (VIEWS._kartuCache && VIEWS._kartuCache[0]) || { nama:'Ahmad Fauzi', kode_unik:'GLKR-TA-2026-000001', desa:'Ngantru', kecamatan:'Ngantru' };

      host.innerHTML =
        '<div class="sticky-save between wrap-flex gap-12">'
        + '<div><h3 class="display-s">Desain Kartu Fisik</h3>'
        + '<p class="small muted mt-8">Atur latar, posisi QR/foto/data, teks, dan isi kartu dari data field pendaftaran. Pratinjau langsung — hasil sama dengan PDF cetak. ' + (isCustom ? '<span class="badge badge-info">Template kustom aktif</span>' : '<span class="badge badge-neutral">Masih bawaan tema</span>') + '</p></div>'
        + '<div class="row gap-8 wrap-flex">'
        + (canEdit ? '<button class="btn btn-primary" id="kdSave">Simpan desain</button><button class="btn btn-ghost" id="kdReset">Kembalikan bawaan</button>' : '<span class="badge badge-warn">Hanya superadmin dapat mengubah</span>')
        + '</div></div>'
        + '<div class="kd-wrap">'
        + '<div class="kd-left">'
        +   '<div class="card card-pad mt-16" id="kdPresetBar">'
        +     '<div class="row gap-8 wrap-flex" style="align-items:flex-end;">'
        +       '<div class="field grow" style="min-width:180px;margin:0;">'
        +         '<label>Preset desain</label>'
        +         '<select class="select" id="kdPresetSel"' + (canEdit ? '' : ' disabled') + '>'
        +           '<option value="">— Bawaan tema —</option>'
        +         '</select>'
        +       '</div>'
        +       (canEdit ?
                  '<button class="btn btn-soft btn-sm" id="kdPresetSaveAs">Simpan sbg preset…</button>'
        +         '<button class="btn btn-primary btn-sm" id="kdPresetActivate" disabled>Aktifkan</button>'
        +         '<button class="btn btn-ghost btn-sm" id="kdPresetRename" disabled>Ganti nama</button>'
        +         '<button class="btn btn-ghost btn-sm" id="kdPresetUpdate" disabled>Perbarui isi</button>'
        +         '<button class="btn btn-ghost btn-sm" id="kdPresetDelete" disabled>Hapus</button>'
        +         '<button class="btn btn-ghost btn-sm" id="kdPresetDup" disabled>Duplikat</button>'
        +         '<button class="btn btn-ghost btn-sm" id="kdPresetExport" title="Unduh preset terpilih (atau semua bila belum memilih) sebagai file JSON">Ekspor</button>'
        +         '<button class="btn btn-soft btn-sm" id="kdPresetImport">Impor JSON…</button>'
        +         '<span class="badge badge-neutral">Bawaan tema</span>' : '')
        +       (canEdit ? '<p class="tiny faint" style="flex-basis:100%;margin:4px 0 0;">Aktifkan preset untuk menerapkannya ke PDF cetak &amp; halaman vCard. "Perbarui isi" menimpa preset terpilih dengan desain yang sedang diedit.</p>' : '<p class="tiny faint" style="flex-basis:100%;margin:4px 0 0;">Hanya superadmin dapat mengubah preset.</p>')
        +     '</div>'
        +     '<div class="kd-gal" id="kdGal"></div>'
        +   '</div>'
        +   '<div class="card card-pad mt-16" id="kdFields">'
        +     '<div class="between wrap-flex gap-8" style="align-items:flex-start;">'
        +       '<div><h4 style="margin:0;">Isi kartu dari data field</h4>'
        +       '<p class="tiny faint mt-8" style="margin-bottom:0;">Baris data tambahan di kartu (di bawah blok data depan / info belakang). Pilih field dari form pendaftaran atau data bawaan — nilai diambil dari data anggota.</p></div>'
        +       (canEdit ? '<button type="button" class="btn btn-soft btn-sm" id="kdFieldAdd">+ Tambah baris</button>' : '')
        +     '</div>'
        +     '<div class="stack gap-8 mt-16" id="kdFieldRows"></div>'
        +   '</div>'
        +   '<div class="row gap-8 mt-16" id="kdSideBtns">'
        +     '<button class="btn btn-soft btn-sm" data-side="front">Tampak Depan</button>'
        +     '<button class="btn btn-ghost btn-sm" data-side="back">Tampak Belakang</button>'
        +   '</div>'
        +   '<div class="mt-16" id="kdPanel"></div>'
        + '</div>'
        + '<div class="kd-right">'
        +   '<div class="small muted" style="margin-bottom:8px;font-weight:700;">Pratinjau langsung — kartu sebenarnya</div>'
        +   '<div id="kdPrev"></div>'
        +   '<p class="tiny faint mt-8">Seret QR, foto, blok data, atau judul langsung di kartu untuk memindahkannya (tampak depan).</p>'
        +   '<p class="tiny faint">Ukuran sebenarnya: ID-1 85,6 × 54 mm · PDF cetak memakai template ini apa adanya.</p>'
        + '</div>'
        + '</div>';

      function el(id){ return document.getElementById(id); }
      function sideObj(){ return t[activeSide]; }
      function rowsFor(side){
        if(!t[side]) t[side] = {};
        if(!Array.isArray(t[side].fields)) t[side].fields = [];
        return t[side].fields;
      }
      function fieldLabel(key){
        var f = fieldOpts.find(function(x){ return x.key === key; });
        return f ? f.label : key;
      }
      function renderFieldRows(){
        var box = el('kdFieldRows'); if(!box) return;
        var rows = rowsFor(activeSide);
        if(!rows.length){ box.innerHTML = '<p class="tiny faint" style="margin:0;">Belum ada baris tambahan — kartu memakai isi bawaan.</p>'; return; }
        var opts = function(sel){
          var groups = {};
          fieldOpts.forEach(function(f){ (groups[f.group || 'Lainnya'] = groups[f.group || 'Lainnya'] || []).push(f); });
          var h = '<option value="">— pilih field —</option>';
          Object.keys(groups).forEach(function(g){
            h += '<optgroup label="' + esc(g) + '">' + groups[g].map(function(f){ return '<option value="' + esc(f.key) + '"' + (sel === f.key ? ' selected' : '') + '>' + esc(f.label) + '</option>'; }).join('') + '</optgroup>';
          });
          return h;
        };
        box.innerHTML = rows.map(function(r, i){
          return '<div class="row gap-8 wrap-flex" style="align-items:center;flex-wrap:nowrap;">'
            + '<select class="select kd-fsel" data-i="' + i + '" style="min-height:38px;flex:1;"' + (canEdit ? '' : ' disabled') + '>' + opts(r.field) + '</select>'
            + '<div class="input-shell kd-flbl" style="flex:1;"><input value="' + esc(r.label || '') + '" placeholder="' + esc(fieldLabel(r.field)) + '" data-i="' + i + '"' + (canEdit ? '' : ' disabled') + '></div>'
            + (canEdit ? '<button type="button" class="btn btn-ghost btn-sm kd-fdel" data-i="' + i + '" title="Hapus baris" style="color:var(--danger);">✕</button>' : '')
            + '</div>';
        }).join('');
        if(!canEdit) return;
        box.querySelectorAll('.kd-fsel').forEach(function(s){
          s.onchange = function(){ rowsFor(activeSide)[+s.dataset.i].field = s.value; preview(); };
        });
        box.querySelectorAll('.kd-flbl input').forEach(function(inp){
          inp.oninput = function(){ rowsFor(activeSide)[+inp.dataset.i].label = inp.value; preview(); };
        });
        box.querySelectorAll('.kd-fdel').forEach(function(b){
          b.onclick = function(){ rowsFor(activeSide).splice(+b.dataset.i, 1); renderFieldRows(); preview(); };
        });
      }
      var addBtn = el('kdFieldAdd');
      if(addBtn) addBtn.onclick = function(){
        var rows = rowsFor(activeSide);
        if(rows.length >= 8){ showToast('Maksimal 8 baris per sisi kartu.', 'danger'); return; }
        rows.push({ field: '', label: '' });
        renderFieldRows();
      };
      function cssColor(v){ return /^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : (activeSide === 'front' ? '#e9d826' : '#f5efdc'); }

      function panel(){
        var s = sideObj(), isF = activeSide === 'front';
        var html = '<details class="card ck-sec" open><summary><span class="ck-sec-title">Latar kartu</span><span class="ck-chev">' + IC.chev + '</span></summary>'
          + '<div class="ck-grid"><div class="ck-group">'
          + '<div class="field"><label>Warna latar</label><div class="row gap-12"><input type="color" id="kdBg" value="' + cssColor(s.bg_color) + '" style="width:52px;height:38px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--card);"' + (canEdit?'':' disabled') + '>'
          + '<span class="mono tiny muted" id="kdBgVal">' + cssColor(s.bg_color) + '</span></div></div>'
          + '<div class="field"><label>Gambar latar (opsional)</label>'
          + '<div class="row gap-12">'
          + '<div class="ck-img-prev" style="width:96px;height:60px;">' + (s.bg_image ? '<img src="/' + esc(s.bg_image) + '?v=' + Date.now() + '" alt="">' : '<span class="tiny faint">Belum ada</span>') + '</div>'
          + '<div class="stack gap-8">'
          + (canEdit ? '<label class="btn btn-soft btn-sm" style="cursor:pointer;">Pilih gambar…<input type="file" id="kdBgFile" accept="image/png,image/jpeg,image/webp" style="display:none;"></label>'
                      + (s.bg_image ? '<button type="button" class="btn btn-ghost btn-sm" id="kdBgDel">Hapus gambar</button>' : '') : '')
          + '<span class="tiny faint">PNG/JPG/WEBP · maks 5 MB</span>'
          + '</div></div></div>'
          + '<div class="field"><label>Cara mengisi gambar</label><select class="select" id="kdBgFit"' + (canEdit?'':' disabled') + '>'
          + '<option value="cover"' + (s.bg_fit !== 'contain' && s.bg_fit !== 'stretch' ? ' selected' : '') + '>Cover — penuh, potong sisa</option>'
          + '<option value="contain"' + (s.bg_fit === 'contain' ? ' selected' : '') + '>Contain — utuh di dalam kartu</option>'
          + '<option value="stretch"' + (s.bg_fit === 'stretch' ? ' selected' : '') + '>Stretch — direntangkan</option>'
          + '</select></div>'
          + '</div></div></details>'
          + '<details class="card ck-sec" open><summary><span class="ck-sec-title">Posisi & ukuran elemen</span><span class="ck-chev">' + IC.chev + '</span></summary>'
          + '<div class="ck-grid">'
          + kdSlider('QR / Barcode', activeSide + '.qr', true)
          + (isF ? kdSlider('Foto anggota', activeSide + '.photo', true) : '')
          + (isF ? kdAlign('Blok data (nama, NPAPG, wilayah)', activeSide + '.data') : '')
          + (isF ? kdSlider('Label judul kartu', activeSide + '.title', false) : '')
          + '</div></details>'
          + '<details class="card ck-sec" open><summary><span class="ck-sec-title">Teks & tampilan</span><span class="ck-chev">' + IC.chev + '</span></summary>'
          + '<div class="ck-grid"><div class="ck-group">'
          + '<div class="field"><label>' + (isF ? 'Teks judul kartu (kanan bawah)' : 'Teks header belakang') + '</label>'
          + '<div class="input-shell"><input id="kdTitle" value="' + esc(isF ? (s.title_text || 'Kartu Tanda Anggota') : (s.header_text || 'Kartu Tanda Anggota')) + '"' + (canEdit?'':' disabled') + '></div></div>'
          + (isF ? '<div class="field"><label>Ukuran font nama</label><div class="row gap-12"><input type="range" min="2.5" max="7" step="0.1" value="' + (s.nama_size || 4.2) + '" id="kdNamaSize" style="flex:1;"' + (canEdit?'':' disabled') + '><span class="mono tiny" id="kdNamaSizeV">' + (s.nama_size || 4.2) + '</span></div></div>'
                 + '<div class="field"><label>Ukuran font wilayah</label><div class="row gap-12"><input type="range" min="2" max="5" step="0.05" value="' + (s.wil_size || 3.05) + '" id="kdWilSize" style="flex:1;"' + (canEdit?'':' disabled') + '><span class="mono tiny" id="kdWilSizeV">' + (s.wil_size || 3.05) + '</span></div></div>'
                 + '<label class="row gap-8" style="align-items:center;"><input type="checkbox" id="kdNpapg"' + (s.npapg_visible !== false ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan baris NPAPG</label>'
                 + '<label class="row gap-8 mt-8" style="align-items:center;"><input type="checkbox" id="kdOrg"' + (s.org_visible === true ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan nama organisasi (untuk latar polos)</label>'
              : '<div class="field"><label>Ukuran font nama</label><div class="row gap-12"><input type="range" min="2.5" max="7" step="0.1" value="' + (s.nama_size || 4.4) + '" id="kdNamaSize" style="flex:1;"' + (canEdit?'':' disabled') + '><span class="mono tiny" id="kdNamaSizeV">' + (s.nama_size || 4.4) + '</span></div></div>'
                 + '<label class="row gap-8" style="align-items:center;"><input type="checkbox" id="kdChips"' + (s.chips_visible !== false ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan chip NPAPG & No. Kartu</label>'
                 + '<label class="row gap-8 mt-8" style="align-items:center;"><input type="checkbox" id="kdUrl"' + (s.url_visible !== false ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan URL vCard</label>'
                 + '<label class="row gap-8 mt-8" style="align-items:center;"><input type="checkbox" id="kdSeal"' + (s.seal_visible !== false ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan stempel Resmi & masa berlaku</label>')
          + '</div></div></details>';
        el('kdPanel').innerHTML = html;
        wirePanel();
        preview();
      }

      function kdSlider(label, path, withW){
        var parts = path.split('.'), s = t[parts[0]][parts[1]];
        var xLabel = (parts[1] === 'title') ? 'Tepi kanan (diukur dari kiri)' : 'Posisi X (dari kiri)';
        return '<div class="ck-group"><h4>' + label + '</h4>'
          + kdRange(xLabel, s.x, 0, 98, 'kdX_' + parts[1])
          + kdRange('Posisi Y (dari atas)', s.y, 0, 90, 'kdY_' + parts[1])
          + (withW ? kdRange('Ukuran', s.w, 5, 45, 'kdW_' + parts[1]) : '')
          + '<label class="row gap-8" style="align-items:center;margin-top:8px;"><input type="checkbox" data-vis="' + path + '"' + (s.visible !== false ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan elemen ini</label>'
          + '</div>';
      }
      function kdRange(label, val, min, max, id){
        return '<div class="field"><label>' + label + ' <span class="mono tiny muted" id="' + id + 'V">' + (+val).toFixed(1) + '</span></label>'
          + '<input type="range" min="' + min + '" max="' + max + '" step="0.1" value="' + (+val).toFixed(1) + '" id="' + id + '" style="width:100%;"' + (canEdit?'':' disabled') + '></div>';
      }
      function kdAlign(label, path){
        var s = t.front.data;
        return '<div class="ck-group"><h4>' + label + '</h4>'
          + '<div class="field"><label>Perataan teks</label><select class="select" id="kdDataAlign"' + (canEdit?'':' disabled') + '>'
          + ['right','left','center'].map(a => '<option value="' + a + '"' + (s.align === a ? ' selected' : '') + '>' + (a === 'right' ? 'Rata kanan (seperti kartu fisik)' : a === 'left' ? 'Rata kiri' : 'Tengah') + '</option>').join('')
          + '</select></div>'
          + kdRange('Tepi kanan (diukur dari kiri)', s.x, 2, 98, 'kdX_data')
          + kdRange('Posisi Y (dari atas)', s.y, 10, 90, 'kdY_data')
          + '<label class="row gap-8" style="align-items:center;"><input type="checkbox" data-vis="front.data"' + (s.visible !== false ? ' checked' : '') + (canEdit?'':' disabled') + '> Tampilkan blok data</label>'
          + '</div>';
      }

      function preview(){
        var s = sideObj(), isF = activeSide === 'front';
        var memberUrl = location.origin + '/kta/' + String(member.kode_unik || '').toLowerCase();
        var qrSvg = SIK.qr(memberUrl, { scale: 4 });
        var ov = '.kd-live .kf-qr{left:' + (+s.qr.x).toFixed(2) + 'cqw;right:auto;top:' + (+s.qr.y).toFixed(2) + 'cqw;width:' + (+s.qr.w).toFixed(2) + 'cqw;height:' + (+s.qr.w * 0.94).toFixed(2) + 'cqw;' + (s.qr.visible === false ? 'display:none;' : '') + '}';
        if(isF){
          ov += '.kd-live .kf-photo{left:' + (+s.photo.x).toFixed(2) + 'cqw;right:auto;top:' + (+s.photo.y).toFixed(2) + 'cqw;width:' + (+s.photo.w).toFixed(2) + 'cqw;height:' + (+s.photo.w).toFixed(2) + 'cqw;' + (s.photo.visible === false ? 'display:none;' : '') + '}';
          var dAlign = s.data.align === 'left' ? 'left:' + (+s.data.x).toFixed(2) + 'cqw;right:auto;text-align:left;' : (s.data.align === 'center' ? 'left:' + (+s.data.x).toFixed(2) + 'cqw;right:auto;text-align:center;' : 'right:' + (100 - (+s.data.x)).toFixed(2) + 'cqw;left:auto;text-align:right;');
          ov += '.kd-live .kf-data{' + dAlign + 'top:' + (+s.data.y).toFixed(2) + 'cqw;' + (s.data.visible === false ? 'display:none;' : '') + '}';
          ov += '.kd-live .kf-nama{font-size:' + (+s.nama_size || 4.2) + 'cqw;}.kd-live .kf-wil,.kd-live .kf-wil2{font-size:' + (+s.wil_size || 3.05) + 'cqw;}';
          ov += '.kd-live .kf-npapg{' + (s.npapg_visible === false ? 'display:none;' : '') + '}';
          ov += '.kd-live .kf-code{' + (s.title.visible === false ? 'display:none;' : 'bottom:auto;top:' + (+s.title.y).toFixed(2) + 'cqw;right:' + (100 - (+s.title.x)).toFixed(2) + 'cqw;') + '}';
          ov += '.kd-live .kf-org,.kd-live .kf-sub{display:' + (s.org_visible === true ? 'block' : 'none') + ';}';
        } else {
          ov += '.kd-live .kb-qr{width:' + (+s.qr.w).toFixed(2) + 'cqw;height:' + (+s.qr.w).toFixed(2) + 'cqw;}'
             + '.kd-live .kb-qrwrap{' + (s.qr.visible === false ? 'display:none;' : '') + '}'
             + '.kd-live .kb-chips{' + (s.chips_visible === false ? 'display:none;' : '') + '}'
             + '.kd-live .kb-url{' + (s.url_visible === false ? 'display:none;' : '') + '}'
             + '.kd-live .kb-sealcol{' + (s.seal_visible === false ? 'display:none;' : '') + '}'
             + '.kd-live .kb-nama{font-size:' + (+s.nama_size || 4.4) + 'cqw;}';
        }
        /* Baris pemetaan field (isi kartu customizable) — nilai contoh */
        var PREV_VALS = {
          nama: member.nama, kode_unik: member.kode_unik,
          wilayah: (member.desa || '') + (member.desa && member.kecamatan ? ' - ' : '') + (member.kecamatan || ''),
          desa: member.desa, kecamatan: member.kecamatan,
          org_nama: 'DPD Nusantara Bersatu', org_wilayah: 'Kabupaten Tulungagung',
          npapg: '••••••••••••••••', jabatan: 'Anggota', status: 'Aktif',
          qr_url: memberUrl, exp_label: 'Feb 2029', gender: 'Laki-laki'
        };
        function prevRowsHtml(side){
          var rows = (t[side] && t[side].fields) || [];
          return rows.map(function(r){
            if(!r || !r.field) return '';
            var v = PREV_VALS[r.field] != null ? PREV_VALS[r.field] : ('Contoh ' + (r.label || fieldLabel(r.field)));
            var lbl = r.label || '';
            return side === 'back'
              ? '<div class="kb-extra">' + (lbl ? '<b>' + esc2(lbl) + '</b>' : '') + esc2(v) + '</div>'
              : '<div class="kf-extra">' + (lbl ? esc2(lbl) + ': ' : '') + esc2(v) + '</div>';
          }).join('');
        }
        var bgCss = 'background-color:' + cssColor(s.bg_color) + ';';
        if(s.bg_image){
          var fit = s.bg_fit === 'contain' ? 'contain' : (s.bg_fit === 'stretch' ? '100% 100%' : 'cover');
          bgCss += "background-image:url('/" + s.bg_image + "?v=' + Date.now() + ');background-size:" + fit + ";background-position:center;background-repeat:no-repeat;";
        }
        var esc2 = esc;
        el('kdPrev').innerHTML =
          '<style>' + ov + '</style>'
          + '<div class="kta-wrap kd-live">'
          + '<div class="kta-card"><div class="kta-face ' + (isF ? 'kta-front' : 'kta-back') + '" style="' + bgCss + '">'
          + (isF
              ? '<div class="kf-qr" data-kddrag="qr">' + qrSvg + '</div>'
                + '<div class="kf-org">DPD NUSANTARA BERSATU</div><div class="kf-sub">KABUPATEN TULUNGAGUNG</div>'
                + '<div class="kf-photo" data-kddrag="photo"><span class="kf-ini">AF</span></div>'
                + '<div class="kf-data" data-kddrag="data"><div class="kf-nama">' + esc2(member.nama) + '</div><div class="kf-npapg"><span class="lbl">NPAPG</span>••••••••••••••••</div><div class="kf-wil">' + esc2((member.desa || '') + (member.desa && member.kecamatan ? ' - ' : '') + (member.kecamatan || '')) + '</div><div class="kf-wil2">Kabupaten Tulungagung</div>' + prevRowsHtml('front') + '</div>'
                + '<div class="kf-code" data-kddrag="title"><div class="rule"></div><div class="val">' + esc2(s.title_text || 'Kartu Tanda Anggota') + '</div></div>'
              : '<div class="kb-top"><span class="t">' + esc2(s.header_text || 'Kartu Tanda Anggota') + '</span><span class="o">DPD Nusantara Bersatu</span></div><div class="kb-toprule"></div><div class="kb-mag"></div>'
                + '<div class="kb-body"><div class="kb-qrwrap"><div class="kb-qr">' + qrSvg + '</div><div class="kb-qrhint">Pindai untuk verifikasi</div></div>'
                + '<div class="kb-info"><div class="kb-nama">' + esc2(member.nama) + '</div><div class="kb-role">Anggota · ' + esc2((member.desa || '') + ', ' + (member.kecamatan || '')) + '</div>'
                + '<div class="kb-chips"><div class="kb-chip"><span class="k">NPAPG</span><span class="v">••••••••••••••••</span></div><div class="kb-chip"><span class="k">No. Kartu</span><span class="v">' + esc2(member.kode_unik) + '</span></div></div>'
                + '<div class="kb-url">sikeda.id/kta/' + esc2(String(member.kode_unik || '').toLowerCase()) + '</div>' + prevRowsHtml('back') + '</div>'
                + '<div class="kb-sealcol"><div class="kb-seal"><span class="s1">✓</span><span class="s2">Resmi</span></div><div class="kb-valid"><span class="k">SD</span> 2031</div></div></div>')
          + '</div></div></div>';
        wireDrag();
      }

      /* ---------- Drag & drop: seret elemen langsung di kartu ----------
         Dipakai saat edit & tampak depan. Satuan gerak = cqw (% lebar kartu)
         sehingga hasil identik dengan slider & PDF cetak. */
      function wireDrag(){
        if(!canEdit || activeSide !== 'front') return;
        var live = document.querySelector('#kdPrev .kd-live');
        if(!live) return;
        live.querySelectorAll('[data-kddrag]').forEach(function(elm){
          var name = elm.getAttribute('data-kddrag');
          elm.addEventListener('pointerdown', function(ev){
            ev.preventDefault();
            var card = live.querySelector('.kta-card');
            if(!card) return;
            var cw = card.getBoundingClientRect().width;
            if(!cw) return;
            var o = t.front[name] || {};
            var rightAnchor = (name === 'data' && o.align === 'right') || name === 'title';
            var startX = (+o.x || 0), startY = (+o.y || 0);
            var lastX = ev.clientX, lastY = ev.clientY;
            elm.classList.add('kf-dragging'); live.classList.add('kd-noselect');
            function move(e){
              var dx = (e.clientX - lastX) * 100 / cw;
              var dy = (e.clientY - lastY) * 100 / cw;
              lastX = e.clientX; lastY = e.clientY;
              var nx = Math.min(98, Math.max(name === 'data' ? 2 : 0, startX += dx));
              var ny = Math.min(90, Math.max(0, startY += dy));
              o.x = Math.round(nx * 10) / 10; o.y = Math.round(ny * 10) / 10;
              /* posisikan langsung tanpa re-render agar drag mulus */
              if(rightAnchor){ elm.style.right = (100 - o.x) + 'cqw'; elm.style.left = 'auto'; }
              else { elm.style.left = o.x + 'cqw'; elm.style.right = 'auto'; }
              elm.style.top = o.y + 'cqw';
              if(name === 'title') elm.style.bottom = 'auto';
              var xi = el('kdX_' + name), yi = el('kdY_' + name);
              if(xi){ xi.value = o.x; var xv = el('kdX_' + name + 'V'); if(xv) xv.textContent = o.x.toFixed(1); }
              if(yi){ yi.value = o.y; var yv = el('kdY_' + name + 'V'); if(yv) yv.textContent = o.y.toFixed(1); }
            }
            function up(){
              document.removeEventListener('pointermove', move);
              document.removeEventListener('pointerup', up);
              elm.classList.remove('kf-dragging'); live.classList.remove('kd-noselect');
              preview(); /* render ulang bersih dari nilai tersimpan */
            }
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
          });
        });
      }

      function wirePanel(){
        if(!canEdit) { preview(); return; }
        el('kdBg').oninput = function(){ sideObj().bg_color = this.value; el('kdBgVal').textContent = this.value; preview(); };
        el('kdBgFit').onchange = function(){ sideObj().bg_fit = this.value; preview(); };
        var f = el('kdBgFile');
        if(f) f.onchange = function(){
          var file = this.files && this.files[0]; if(!file) return;
          var rd = new FileReader();
          rd.onload = async function(){
            try {
              var r = await SIKAPI.uploadJSON('/kta-template/bg/' + activeSide, { dataUrl: rd.result });
              sideObj().bg_image = r.path;
              panel(); preview();
              showToast('Latar kartu terunggah.', 'success');
            } catch(e){ showToast(e.message, 'danger', 4500); }
          };
          rd.readAsDataURL(file);
        };
        var del = el('kdBgDel');
        if(del) del.onclick = async function(){
          try { await SIKAPI.del('/kta-template/bg/' + activeSide); sideObj().bg_image = ''; panel(); preview(); showToast('Gambar latar dihapus.', 'success'); }
          catch(e){ showToast(e.message, 'danger', 4500); }
        };
        el('kdTitle').oninput = function(){ if(activeSide === 'front') sideObj().title_text = this.value; else sideObj().header_text = this.value; preview(); };
        [['kdX_qr','qr','x'],['kdY_qr','qr','y'],['kdW_qr','qr','w'],['kdX_photo','photo','x'],['kdY_photo','photo','y'],['kdW_photo','photo','w'],['kdX_data','data','x'],['kdY_data','data','y'],['kdX_title','title','x'],['kdY_title','title','y']].forEach(function(cfg){
          var i = el(cfg[0]); if(!i) return;
          i.oninput = function(){
            var v = parseFloat(this.value);
            if(cfg[1] === 'data' && t.front.data.align === 'right' && cfg[2] === 'x'){ t.front.data.x = v; }
            else { t[activeSide][cfg[1]][cfg[2]] = v; }
            var vs = el(cfg[0] + 'V'); if(vs) vs.textContent = v.toFixed(1);
            preview();
          };
        });
        var da = el('kdDataAlign');
        if(da) da.onchange = function(){ t.front.data.align = this.value; preview(); };
        [['kdNamaSize','nama_size'],['kdWilSize','wil_size']].forEach(function(cfg){
          var i = el(cfg[0]); if(!i) return;
          i.oninput = function(){ var v = parseFloat(this.value); sideObj()[cfg[1]] = v; var vs = el(cfg[0] + 'V'); if(vs) vs.textContent = v.toFixed(1); preview(); };
        });
        [['kdNpapg','npapg_visible'],['kdOrg','org_visible'],['kdChips','chips_visible'],['kdUrl','url_visible'],['kdSeal','seal_visible']].forEach(function(cfg){
          var i = el(cfg[0]); if(!i) return;
          i.onchange = function(){ sideObj()[cfg[1]] = this.checked; preview(); };
        });
        document.querySelectorAll('[data-vis]').forEach(function(cb){
          cb.onchange = function(){
            var parts = this.getAttribute('data-vis').split('.');
            t[parts[0]][parts[1]].visible = this.checked; preview();
          };
        });
      }

      /* ---------- Preset desain kartu ---------- */
      function presetById(id){ return presets.list.find(function(p){ return p.id === id; }) || null; }
      function renderPresetSel(){
        var sel = el('kdPresetSel'); if(!sel) return;
        var cur = sel.value;
        sel.innerHTML = '<option value="">— Bawaan tema —</option>'
          + presets.list.map(function(p){ return '<option value="' + esc(p.id) + '">' + esc(p.nama) + '</option>'; }).join('');
        sel.value = presetById(cur) ? cur : (presets.active || '');
        syncPresetBtns();
        renderGallery();
        var badge = document.getElementById('kdPresetBar').querySelector('.badge');
        if(badge){
          var act = presetById(presets.active);
          badge.className = 'badge ' + (act ? 'badge-info' : 'badge-neutral');
          badge.textContent = act ? 'Aktif: ' + act.nama : 'Bawaan tema';
        }
      }
      function syncPresetBtns(){
        var has = !!presetById(el('kdPresetSel').value);
        ['kdPresetActivate','kdPresetRename','kdPresetUpdate','kdPresetDelete','kdPresetDup'].forEach(function(id){ var b = el(id); if(b) b.disabled = !has; });
      }
      /* Galeri thumbnail — digambar dari data template (tanpa render berat) */
      function kdThumb(s, isFront){
        var bg = 'background:' + (/^#[0-9a-fA-F]{3,8}$/.test(s && s.bg_color || '') ? s.bg_color : (isFront ? '#e9d826' : '#f5efdc')) + ';';
        if(s && s.bg_image){ bg += "background-image:url('/" + esc(s.bg_image) + "');background-size:" + (s.bg_fit === 'contain' ? 'contain' : (s.bg_fit === 'stretch' ? '100% 100%' : 'cover')) + ';background-position:center;background-repeat:no-repeat;'; }
        var inner = '';
        if(isFront){
          var qw = (+s.qr.w || 10), pw = (+s.photo.w || 17.9);
          inner = '<span class="kd-gal-dots" style="left:' + (+s.qr.x || 85.5) + '%;top:' + ((+s.qr.y || 6.6) * 0.63) + '%;width:' + qw + '%;height:' + (qw * 1.49) + '%;opacity:' + (s.qr.visible === false ? 0 : 1) + '"></span>'
            + '<span class="kd-gal-photo" style="left:' + (+s.photo.x || 78.6) + '%;top:' + ((+s.photo.y || 20.4) * 0.63) + '%;width:' + pw + '%;height:' + (pw * 1.586) + '%;opacity:' + (s.photo.visible === false ? 0 : 1) + '"></span>'
            + '<span class="kd-gal-chip" style="bottom:' + (100 - ((+s.data.y || 40) * 0.63)) + '%;opacity:' + (s.data && s.data.visible === false ? 0 : 1) + '">ABC</span>';
        } else {
          var bw = (+s.qr.w || 22);
          inner = '<span class="kd-gal-dots" style="left:' + (+s.qr.x || 8) + '%;top:' + ((+s.qr.y || 22) * 0.63) + '%;width:' + bw + '%;height:' + (bw * 1.586) + '%;opacity:' + (s.qr.visible === false ? 0 : 1) + '"></span>';
        }
        return '<span class="kd-gal-face" style="flex:1;' + bg + '">' + inner + '</span>';
      }
      function renderGallery(){
        var g = el('kdGal'); if(!g) return;
        var sel = el('kdPresetSel');
        var cur = presetById(sel.value) ? sel.value : '';
        g.innerHTML = presets.list.map(function(p){
          var act = presets.active === p.id;
          return '<button type="button" class="kd-gal-item' + (cur === p.id ? ' is-active' : '') + '" data-id="' + esc(p.id) + '">'
            + '<span class="kd-gal-thumb">' + kdThumb(p.tpl.front, true) + kdThumb(p.tpl.back, false) + '</span>'
            + '<span class="kd-gal-name">' + esc(p.nama) + '</span>'
            + '<span class="kd-gal-meta"><span>' + esc(p.dibuat || '') + '</span>' + (act ? '<span class="badge badge-info" style="font-size:10px;padding:1px 8px;">Aktif</span>' : '') + '</span>'
            + '</button>';
        }).join('') || '<p class="tiny faint" style="grid-column:1/-1;margin:0;">Belum ada preset tersimpan — atur desain lalu "Simpan sbg preset…".</p>';
        g.querySelectorAll('.kd-gal-item').forEach(function(b){
          b.onclick = function(){
            sel.value = this.getAttribute('data-id');
            g.querySelectorAll('.kd-gal-item').forEach(function(x){ x.classList.toggle('is-active', x === b); });
            syncPresetBtns();
          };
        });
      }
      function refreshView(){ return VIEWS.kartuDesain(host, role); }
      function wirePresets(){
        var sel = el('kdPresetSel');
        if(sel && canEdit) sel.onchange = function(){ syncPresetBtns(); renderGallery(); };
        var bSave = el('kdPresetSaveAs');
        if(bSave) bSave.onclick = async function(){
          var nama = prompt('Nama preset baru:', 'Desain ' + (presets.list.length + 1));
          if(nama == null) return;
          nama = nama.trim(); if(!nama){ showToast('Nama preset wajib diisi.', 'danger'); return; }
          bSave.disabled = true;
          try {
            await SIKAPI.put('/kta-template', t); /* pastikan preset = apa yang terlihat di editor sekarang */
            var r = await SIKAPI.post('/kta-presets', { nama: nama });
            presets = { list: r.list || [], active: r.active || null };
            renderPresetSel();
            isCustom = true;
            showToast(r.message || 'Preset tersimpan.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
          bSave.disabled = false;
        };
        var bAct = el('kdPresetActivate');
        if(bAct) bAct.onclick = async function(){
          var id = el('kdPresetSel').value; var p = presetById(id);
          if(!p) return;
          if(!confirm('Aktifkan preset "' + p.nama + '"? Desain yang sedang aktif akan diganti (yang belum disimpan sebagai preset akan hilang).')) return;
          bAct.disabled = true;
          try {
            await SIKAPI.put('/kta-presets/' + encodeURIComponent(id) + '/activate', {});
            showToast('Preset "' + p.nama + '" kini aktif.', 'success');
            await refreshView(); /* muat ulang: editor & pratinjau mengikuti desain aktif */
          } catch(e){ showToast(e.message, 'danger', 4500); bAct.disabled = false; }
        };
        var bRen = el('kdPresetRename');
        if(bRen) bRen.onclick = async function(){
          var id = el('kdPresetSel').value; var p = presetById(id);
          if(!p) return;
          var nama = prompt('Ganti nama preset:', p.nama);
          if(nama == null) return;
          nama = nama.trim(); if(!nama){ showToast('Nama preset wajib diisi.', 'danger'); return; }
          try {
            var r = await SIKAPI.put('/kta-presets/' + encodeURIComponent(id), { nama: nama });
            presets.list = r.list || presets.list;
            renderPresetSel();
            showToast('Nama preset diganti.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
        };
        var bUpd = el('kdPresetUpdate');
        if(bUpd) bUpd.onclick = async function(){
          var id = el('kdPresetSel').value; var p = presetById(id);
          if(!p) return;
          if(!confirm('Timpa isi preset "' + p.nama + '" dengan desain yang sedang diedit?')) return;
          try {
            await SIKAPI.put('/kta-presets/' + encodeURIComponent(id), { tpl: t });
            var pr = presetById(id); if(pr) pr.tpl = JSON.parse(JSON.stringify(t));
            renderGallery();
            showToast('Isi preset diperbarui dari desain saat ini.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
        };
        var bDel = el('kdPresetDelete');
        if(bDel) bDel.onclick = async function(){
          var id = el('kdPresetSel').value; var p = presetById(id);
          if(!p) return;
          if(!confirm('Hapus preset "' + p.nama + '"? Desain aktif tidak ikut terhapus.')) return;
          try {
            var r = await SIKAPI.del('/kta-presets/' + encodeURIComponent(id));
            presets = { list: r.list || [], active: r.active || null };
            renderPresetSel();
            showToast('Preset dihapus.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
        };
        var bDup = el('kdPresetDup');
        if(bDup) bDup.onclick = async function(){
          var id = el('kdPresetSel').value; var p = presetById(id);
          if(!p) return;
          bDup.disabled = true;
          try {
            var r = await SIKAPI.post('/kta-presets/' + encodeURIComponent(id) + '/duplicate', {});
            presets = { list: r.list || [], active: r.active || null };
            renderPresetSel();
            el('kdPresetSel').value = r.id;
            syncPresetBtns(); renderGallery();
            showToast(r.message || 'Preset diduplikasi.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
          bDup.disabled = false;
        };
        var bExp = el('kdPresetExport');
        if(bExp) bExp.onclick = async function(){
          var id = el('kdPresetSel').value;
          bExp.disabled = true;
          try {
            var resp = await SIKAPI.raw(SIKAPI.base + '/kta-presets/export' + (presetById(id) ? '?id=' + encodeURIComponent(id) : ''), 'GET');
            if(!resp.ok){ var j = null; try { j = await resp.json(); } catch(_){} throw new Error((j && j.error) || 'Ekspor gagal (' + resp.status + ').'); }
            var blob = await resp.blob();
            var cd = resp.headers.get('Content-Disposition') || '';
            var mfn = /filename="?([^";]+)"?/.exec(cd);
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = mfn ? mfn[1] : 'sikeda-preset-kartu.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
            showToast('File preset diunduh.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
          bExp.disabled = false;
        };
        var bImp = el('kdPresetImport');
        if(bImp) bImp.onclick = function(){
          var inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'application/json,.json';
          inp.onchange = async function(){
            var f = inp.files && inp.files[0]; if(!f) return;
            if(f.size > 1024 * 1024){ showToast('File terlalu besar (maks 1 MB).', 'danger'); return; }
            var data;
            try { data = JSON.parse(await f.text()); }
            catch(_){ showToast('File bukan JSON yang valid.', 'danger'); return; }
            try {
              var r = await SIKAPI.post('/kta-presets/import', data);
              presets = { list: r.list || [], active: r.active || null };
              renderPresetSel();
              showToast(r.message || 'Preset diimpor.', 'success');
            } catch(e){ showToast(e.message, 'danger', 4500); }
          };
          inp.click();
        };
      }

      el('kdSideBtns').querySelectorAll('[data-side]').forEach(function(b){
        b.onclick = function(){
          activeSide = this.getAttribute('data-side');
          el('kdSideBtns').querySelectorAll('[data-side]').forEach(function(x){ x.className = x.getAttribute('data-side') === activeSide ? 'btn btn-soft btn-sm' : 'btn btn-ghost btn-sm'; });
          panel();
          renderFieldRows();
        };
      });

      if(canEdit){
        el('kdSave').onclick = async function(){
          var btn = this; btn.disabled = true; btn.textContent = 'Menyimpan…';
          try {
            var r = await SIKAPI.put('/kta-template', t);
            showToast(r.message || 'Desain kartu disimpan.', 'success');
            isCustom = true;
          } catch(e){ showToast(e.message, 'danger', 4500); }
          btn.disabled = false; btn.textContent = 'Simpan desain';
        };
        el('kdReset').onclick = async function(){
          if(!confirm('Kembalikan desain kartu ke bawaan tema? Gambar latar kustom juga dihapus.')) return;
          try {
            await SIKAPI.del('/kta-template');
            var r2 = await SIKAPI.get('/kta-template');
            t = r2.data; isCustom = false;
            panel(); preview();
            showToast('Desain kembali ke bawaan tema.', 'success');
          } catch(e){ showToast(e.message, 'danger', 4500); }
        };
      }
      renderPresetSel();
      wirePresets();
      panel();
      renderFieldRows();
    },

    webHome: async function(host, role){ return VIEWS._contentEditor(host, role, 'home'); },
    webLogin: async function(host, role){ return VIEWS._contentEditor(host, role, 'login'); },
    webPages: async function(host, role){ return VIEWS._contentEditor(host, role, 'pages'); },

    /* ================= TEMA WARNA WEBSITE ================= */
    tema: async function(host, role){
      var t = (await SIKAPI.get('/tema')).data;
      var canEdit = role === 'superadmin';

      var presets = [
        ['#1a3358', '#dda52e', 'Navy & Emas (bawaan)'],
        ['#0f3d2e', '#c9a227', 'Hijau & Emas'],
        ['#3b0d11', '#d4a24e', 'Maroon & Tembaga'],
        ['#1f2937', '#2563eb', 'Abu-abu & Biru'],
        ['#312e81', '#8b5cf6', 'Indigo & Violet'],
        ['#134e4a', '#14b8a6', 'Teal & Mint']
      ];
      function swatches(p){
        return '<span class="stack gap-4" style="display:inline-flex;">'
          + '<span class="tm-sw" style="background:' + p[0] + ';"></span>'
          + '<span class="tm-sw" style="background:' + p[1] + ';"></span>'
          + '</span>';
      }
      host.innerHTML =
        '<div class="tm-grid">'
        + '<div class="stack gap-16">'
        + '<div class="card card-pad">'
        +   '<h3 class="display-s">Warna tema website</h3>'
        +   '<p class="small muted mt-8">Warna utama dipakai tombol &amp; header gelap; warna aksen dipakai elemen sorotan pada beranda. Perubahan langsung terlihat pada pratinjau di samping.</p>'
        +   '<div class="field mt-16"><label>Warna utama (primary)</label>'
        +     '<div class="row gap-12"><input type="color" id="tmPrimary" value="' + (t.primary || '#1a3358') + '"' + (canEdit ? '' : ' disabled') + ' style="width:52px;height:46px;padding:4px;border:1px solid var(--line);border-radius:10px;background:#fff;">'
        +     '<div class="input-shell grow"><input id="tmPrimaryHex" value="' + esc(t.primary || '#1a3358') + '"' + (canEdit ? '' : ' disabled') + '></div></div></div>'
        +   '<div class="field mt-16"><label>Warna aksen (accent)</label>'
        +     '<div class="row gap-12"><input type="color" id="tmAccent" value="' + (t.accent || '#dda52e') + '"' + (canEdit ? '' : ' disabled') + ' style="width:52px;height:46px;padding:4px;border:1px solid var(--line);border-radius:10px;background:#fff;">'
        +     '<div class="input-shell grow"><input id="tmAccentHex" value="' + esc(t.accent || '#dda52e') + '"' + (canEdit ? '' : ' disabled') + '></div></div></div>'
        +   '<div class="row gap-12 mt-24">'
        +     (canEdit ? '<button class="btn btn-primary" id="tmSave">Simpan tema</button><button class="btn btn-ghost" id="tmReset">Kembalikan bawaan</button>' : '<span class="badge badge-warn">Hanya superadmin dapat mengubah</span>')
        +   '</div>'
        + '</div>'
        + '<div class="card card-pad">'
        +   '<h3 class="display-s">Preset cepat</h3>'
        +   '<p class="small muted mt-8">Klik untuk menerapkan pasangan warna siap pakai.</p>'
        +   '<div class="tm-preset mt-16">'
        +   presets.map(function(p){
              return '<button class="btn btn-soft" style="justify-content:flex-start;gap:10px;" data-p1="' + p[0] + '" data-p2="' + p[1] + '"' + (canEdit ? '' : ' disabled') + '>'
                + swatches(p) + esc(p[2]) + '</button>';
            }).join('')
        +   '</div>'
        + '</div>'
        + '</div>'
        + '<div class="card ck-prev-wrap is-open" style="margin-top:0;display:block;">'
        +   '<div class="ck-prev-bar">'
        +     '<span class="small" style="font-weight:800;">Pratinjau warna — tanpa perlu menyimpan</span>'
        +     '<button class="btn btn-soft btn-sm" id="tmPrevReload">Muat ulang</button>'
        +   '</div>'
        +   '<iframe class="ck-prev-frame" id="tmPrevFrame" title="Pratinjau tema"></iframe>'
        + '</div>'
        + '</div>';

      /* Pratinjau tema: muat index.html ke iframe lalu terapkan pasangan warna saat ini */
      function loadTmPreview(){
        fetch('/index.html').then(function(r){ return r.text(); }).then(function(html){
          var f = document.getElementById('tmPrevFrame');
          f.onload = function(){ setTimeout(previewColors, 300); };
          f.srcdoc = html;
        });
      }
      loadTmPreview();
      document.getElementById('tmPrevReload').onclick = loadTmPreview;
      function previewColors(){
        var f = document.getElementById('tmPrevFrame');
        if(!f || !f.contentDocument) return;
        var doc = f.contentDocument;
        var st = doc.getElementById('tmPreviewStyle');
        if(!st){ st = doc.createElement('style'); st.id = 'tmPreviewStyle'; doc.head.appendChild(st); }
        var p1 = document.getElementById('tmPrimaryHex').value.trim();
        var p2 = document.getElementById('tmAccentHex').value.trim();
        st.textContent = ':root{--navy-700:' + p1 + ';--navy-800:' + p1 + ';--navy-900:' + p1 + ';--navy-600:' + p1 + ';--gold-500:' + p2 + ';--gold-400:' + p2 + ';--gold-600:' + p2 + ';}';
      }
      ['tmPrimary','tmPrimaryHex','tmAccent','tmAccentHex'].forEach(function(id){
        var el = document.getElementById(id);
        el.addEventListener('input', function(){ setTimeout(previewColors, 10); });
        el.addEventListener('change', function(){ setTimeout(previewColors, 10); });
      });
      host.querySelectorAll('[data-p1]').forEach(function(b){
        b.onclick = function(){
          document.getElementById('tmPrimary').value = b.dataset.p1;
          document.getElementById('tmPrimaryHex').value = b.dataset.p1;
          document.getElementById('tmAccent').value = b.dataset.p2;
          document.getElementById('tmAccentHex').value = b.dataset.p2;
          setTimeout(previewColors, 10);
        };
      });
      /* Tinggi iframe mengikuti konten halaman (max 720px) agar penuh terlihat */
      function fitTmFrame(){
        var f = document.getElementById('tmPrevFrame');
        if(!f) return;
        try {
          var h = f.contentDocument.documentElement.scrollHeight;
          f.style.height = Math.max(480, Math.min(720, h + 24)) + 'px';
        } catch(e){}
      }
      setInterval(function(){ fitTmFrame(); previewColors(); }, 800);
      setTimeout(function(){ fitTmFrame(); previewColors(); }, 1200);
      if(!canEdit) return;
      async function save(primary, accent){
        try {
          var r = await SIKAPI.put('/tema', { primary: primary, accent: accent });
          showToast(r.message || 'Tema disimpan.', 'success');
        } catch(e){ showToast(e.message, 'danger', 4500); }
      }
      document.getElementById('tmSave').onclick = function(){
        save(document.getElementById('tmPrimaryHex').value.trim(), document.getElementById('tmAccentHex').value.trim());
      };
      document.getElementById('tmReset').onclick = function(){
        document.getElementById('tmPrimary').value = '#1a3358'; document.getElementById('tmPrimaryHex').value = '#1a3358';
        document.getElementById('tmAccent').value = '#dda52e'; document.getElementById('tmAccentHex').value = '#dda52e';
        save('#1a3358', '#dda52e');
      };
    },

    /* ================= WILAYAH ================= */
    wilayah: async function(host){
      var w = (await SIKAPI.get('/wilayah')).data;
      var res = await SIKAPI.get('/stats');
      var perKec = {};
      res.data.perKecamatan.forEach(function(x){ perKec[x.kecamatan] = x.n; });
      var max = Math.max.apply(null, Object.values(perKec).concat([1]));
      var kecList = Object.keys(w);
      host.innerHTML =
        '<div class="card card-pad">'
        + '<h3 class="display-s">Sebaran anggota per kecamatan</h3><div class="mt-16">'
        + kecList.map(function(k){
            var n = perKec[k] || 0;
            return '<div class="dist-row"><span class="dist-name">' + esc(k) + '</span>'
              + '<span class="progress"><i style="width:' + Math.round(n/max*100) + '%"></i></span>'
              + '<span class="mono" style="text-align:right;font-weight:700;">' + n + '</span></div>';
          }).join('')
        + '</div></div>'
        + '<div class="grid-3 mt-24">'
        + kecList.map(function(k){
            return '<div class="card card-pad">'
              + '<div class="row between"><h4 class="display-s" style="font-size:.98rem;">' + esc(k) + '</h4>'
              + '<span class="badge badge-dark">' + (perKec[k] || 0) + ' anggota</span></div>'
              + '<div class="chip-row mt-12">'
              + w[k].map(function(d){ return '<span class="chip" style="pointer-events:none;">' + esc(d) + '</span>'; }).join('')
              + '</div></div>';
          }).join('')
        + '</div>';
    },

    /* ================= IMPORT / EXPORT ================= */
    impor: async function(host){
      host.innerHTML =
        '<div class="grid-2">'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Import Excel</h3>'
        + '<p class="muted small mt-8">Unduh template, isi data anggota, lalu unggah kembali. Setiap baris tervalidasi: NIK 16 digit unik, wilayah dikenal, WhatsApp valid. Baris valid langsung masuk sebagai <strong>calon anggota (Pending)</strong> dan di-broadcast ke Telegram channel.</p>'
        + '<div class="row gap-12 mt-16 wrap-flex">'
        + '<button class="btn btn-primary" id="tplDl">' + IC.download + ' Unduh template Excel</button>'
        + '</div>'
        + '<div id="dropZone" class="mt-16" style="border:1.5px dashed var(--line);border-radius:var(--r-m);padding:26px;text-align:center;color:var(--ink-soft);cursor:pointer;transition:all .15s ease;">'
        + '<strong id="dropLabel">Klik untuk memilih file .xlsx</strong>'
        + '<div class="tiny faint" style="margin-top:4px;">atau seret & letakkan di sini · maks 500 baris</div>'
        + '<input type="file" id="xlsxFile" accept=".xlsx" style="display:none;">'
        + '</div>'
        + '<div id="importResult" class="mt-16"></div>'
        + '</div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Format kolom template</h3>'
        + '<div class="stack gap-6 mt-16 tiny">'
        + '<div class="between"><span class="mono">nama*</span><span class="faint">wajib</span></div>'
        + '<div class="between"><span class="mono">nik*</span><span class="faint">16 digit, unik</span></div>'
        + '<div class="between"><span class="mono">gender*</span><span class="faint">Laki-laki / Perempuan</span></div>'
        + '<div class="between"><span class="mono">kecamatan* · desa*</span><span class="faint">harus sesuai wilayah</span></div>'
        + '<div class="between"><span class="mono">whatsapp*</span><span class="faint">aktif, untuk OTP</span></div>'
        + '<div class="between"><span class="mono">tempat_lahir · tanggal_lahir</span><span class="faint">opsional (YYYY-MM-DD)</span></div>'
        + '<div class="between"><span class="mono">pekerjaan · alamat</span><span class="faint">opsional</span></div>'
        + '<div class="between"><span class="mono">telegram · email</span><span class="faint">opsional</span></div>'
        + '</div>'
        + '<hr class="divider-soft mt-16">'
        + '<h3 class="display-s mt-16">Ekspor</h3>'
        + '<div class="stack gap-12 mt-16">'
        + '<button class="btn btn-soft btn-block" style="justify-content:flex-start;" id="expAktif">' + IC.download + ' Anggota aktif (CSV)</button>'
        + '<button class="btn btn-soft btn-block" style="justify-content:flex-start;" id="expCalon">' + IC.download + ' Calon pending (CSV)</button>'
        + '</div></div></div>';

      /* ---------- Template .xlsx asli (zip builder mini) ---------- */
      function crc32(buf){
        var c, table = crc32.t;
        if(!table){
          table = crc32.t = new Int32Array(256);
          for(var n = 0; n < 256; n++){
            c = n;
            for(var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c;
          }
        }
        c = -1;
        for(var i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ -1) >>> 0;
      }
      function zipStore(files){
        var enc = new TextEncoder(), chunks = [], central = [], offset = 0;
        files.forEach(function(f){
          var nameB = enc.encode(f.name), dataB = enc.encode(f.data);
          var crc = crc32(dataB);
          var lh = new DataView(new ArrayBuffer(30));
          lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
          lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
          lh.setUint32(14, crc, true); lh.setUint32(18, dataB.length, true); lh.setUint32(22, dataB.length, true);
          lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
          chunks.push(new Uint8Array(lh.buffer), nameB, dataB);
          var ch = new DataView(new ArrayBuffer(46));
          ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
          ch.setUint16(8, 0, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0, true);
          ch.setUint32(16, crc, true); ch.setUint32(20, dataB.length, true); ch.setUint32(24, dataB.length, true);
          ch.setUint16(28, nameB.length, true);
          ch.setUint32(42, offset, true);
          central.push(new Uint8Array(ch.buffer), nameB);
          offset += 30 + nameB.length + dataB.length;
        });
        var centralSize = central.reduce(function(s, c){ return s + c.length; }, 0);
        var eocd = new DataView(new ArrayBuffer(22));
        eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, files.length, true);
        eocd.setUint16(10, files.length, true); eocd.setUint32(12, centralSize, true); eocd.setUint32(16, offset, true);
        var total = chunks.concat(central).concat([new Uint8Array(eocd.buffer)]);
        var out = new Uint8Array(total.reduce(function(s, c){ return s + c.length; }, 0));
        var p = 0; total.forEach(function(c){ out.set(c, p); p += c.length; });
        return out;
      }
      function escX(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      function colRef(i){ var s = ''; i++; while(i){ var m = (i-1)%26; s = String.fromCharCode(65+m) + s; i = Math.floor((i-1)/26); } return s; }
      function sheetXml(header, rows){
        function rowXml(cells, r){
          return '<row r="' + r + '">' + cells.map(function(v, c){
            return '<c r="' + colRef(c) + r + '" t="inlineStr"><is><t>' + escX(v) + '</t></is></c>';
          }).join('') + '</row>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
          + rowXml(header, 1)
          + rows.map(function(r, i){ return rowXml(r, i + 2); }).join('')
          + '</sheetData></worksheet>';
      }
      function buildTemplateXlsx(){
        var header = ['nama','nik','gender','tempat_lahir','tanggal_lahir','pekerjaan','kecamatan','desa','alamat','whatsapp','telegram','email'];
        var contoh = [
          ['Budi Santoso','3514010101010001','Laki-laki','Tulungagung','2001-01-01','Petani','Boyolangu','Grogol','Jl. Melati 10','081111000001','@budi_s','budi@mail.com'],
          ['Sari Wulandari','3514010101010002','Perempuan','Tulungagung','2002-02-02','Guru','Kedungwaru','Bendosari','Jl. Mawar 8','081111000002','','sari@mail.com']
        ];
        return zipStore([
          { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
          { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
          { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import" sheetId="1" r:id="rId1"/></sheets></workbook>' },
          { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
          { name: 'xl/worksheets/sheet1.xml', data: sheetXml(header, contoh) }
        ]);
      }
      document.getElementById('tplDl').onclick = function(){
        var blob = new Blob([buildTemplateXlsx()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'template-import-anggota-sikeda.xlsx';
        a.click();
        showToast('Template Excel diunduh — isi lalu unggah kembali.', 'success', 4200);
      };

      /* ---------- Upload & proses ---------- */
      var dz = document.getElementById('dropZone'), fi = document.getElementById('xlsxFile');
      dz.onclick = function(){ fi.click(); };
      dz.ondragover = function(e){ e.preventDefault(); dz.style.background = 'var(--gold-100)'; };
      dz.ondragleave = function(){ dz.style.background = 'transparent'; };
      dz.ondrop = function(e){ e.preventDefault(); dz.style.background = 'transparent'; if(e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); };
      fi.onchange = function(){ if(fi.files[0]) handle(fi.files[0]); };

      function handle(file){
        if(!/\.xlsx$/i.test(file.name)){ showToast('Hanya file .xlsx yang didukung.', 'danger'); return; }
        document.getElementById('dropLabel').textContent = 'Membaca ' + file.name + '…';
        var rd = new FileReader();
        rd.onload = async function(){
          try {
            var rows = window.SIKXLSX.parseXlsx(rd.result);
            if(!rows.length) throw new Error('File kosong — tidak ada baris data.');
            var res = await SIKAPI.uploadJSON('/members/import', { rows: rows });
            var box = document.getElementById('importResult');
            var failRows = res.details && res.details.length
              ? '<div class="stack gap-4 mt-8 tiny">' + res.details.map(function(d){ return '<div>• Baris ' + d.baris + ' (' + esc(d.nama) + '): ' + esc(d.alasan) + '</div>'; }).join('') + '</div>' : '';
            box.innerHTML = '<div class="card card-pad" style="background:' + (res.failed ? 'var(--warn-bg)' : 'var(--success-bg)') + ';">'
              + '<strong>' + res.inserted + ' baris berhasil diimport' + (res.failed ? ', ' + res.failed + ' gagal' : '') + '</strong>'
              + failRows + '</div>';
            document.getElementById('dropLabel').textContent = 'Klik untuk memilih file .xlsx';
            showToast(res.inserted + ' calon anggota ditambahkan.', res.inserted ? 'success' : 'danger', 4200);
            if(typeof UI.refreshCounts === 'function') UI.refreshCounts();
          } catch(e){
            document.getElementById('dropLabel').textContent = 'Klik untuk memilih file .xlsx';
            showToast(e.message, 'danger', 4500);
          }
        };
        rd.readAsArrayBuffer(file);
      }

      /* ---------- Ekspor CSV ---------- */
      function csvDownload(rows, fname){
        var head = ['kode_unik','nama','nik_masked','gender','kecamatan','desa','whatsapp','email','status','terdaftar'];
        var csv = [head.join(';')].concat(rows.map(function(r){
          return [r.kode_unik, r.nama, r.nik, r.gender, r.kecamatan, r.desa, r.whatsapp, r.email || '', r.status, String(r.registered_at).slice(0,10)].join(';');
        })).join('\n');
        var blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        a.click();
        showToast(fname + ' diunduh.', 'success');
      }
      document.getElementById('expAktif').onclick = async function(){
        csvDownload((await SIKAPI.get('/members?status=Aktif')).data, 'anggota-aktif.csv');
      };
      document.getElementById('expCalon').onclick = async function(){
        csvDownload((await SIKAPI.get('/members?status=Pending')).data, 'calon-pending.csv');
      };
    },

    /* ================= STRUKTUR ================= */
    struktur: async function(host){
      var w = (await SIKAPI.get('/wilayah')).data;
      var res = await SIKAPI.get('/stats');
      var perKec = {};
      res.data.perKecamatan.forEach(function(x){ perKec[x.kecamatan] = x.n; });
      function node(title, sub, count, gold){
        return '<div class="card card-pad" style="' + (gold ? 'background:linear-gradient(150deg,var(--navy-800),var(--navy-950));border-color:var(--line-dark);' : '') + '">'
          + '<div class="row between"><div><div class="text-display" style="font-weight:700;' + (gold?'color:#fff;':'') + '">' + title + '</div>'
          + '<div class="tiny" style="color:' + (gold ? 'rgba(238,242,248,.6)' : 'var(--ink-faint)') + ';">' + sub + '</div></div>'
          + '<span class="badge ' + (gold ? 'badge-gold' : 'badge-neutral') + '">' + count + '</span></div></div>';
      }
      host.innerHTML =
        '<div style="max-width:760px;margin:0 auto;" class="stack gap-8">'
        + node('DPD — Kab. Tulungagung', 'Pengurus cabang daerah', SIK.fmtNum(res.data.totalAktif), true)
        + '<div class="center faint">▼</div>'
        + '<div class="grid-3" style="gap:12px;">'
        + Object.keys(w).map(function(k){
            var n = perKec[k] || 0;
            return '<div class="stack gap-8">'
              + node('DPC — ' + esc(k), 'Kecamatan', n)
              + '<div class="center faint tiny">▼</div>'
              + node('Ranting ' + esc(w[k][0]), 'Desa/Kelurahan', Math.max(1, Math.round(n/2)))
              + '</div>';
          }).join('')
        + '</div></div>';
    },

    /* ================= LOG AKTIVITAS ================= */
    log: async function(host){
      var rows = (await SIKAPI.get('/activity?limit=100')).data;
      /* Status kirim notifikasi per kanal (wa/telegram/email) + filter + kirim ulang */
      var sendRows = [];
      try { sendRows = (await SIKAPI.get('/sends?limit=200')).data || []; } catch(e){}
      var chLabel = { wa:'WhatsApp', telegram:'Telegram', email:'Email' };
      var fState = { ch: 'semua', st: 'semua' };
      function sendBadge(ok, ket){
        return '<span class="badge ' + (ok ? 'badge-success' : 'badge-danger') + '"><span class="dot"></span>' + (ok ? 'Terkirim' : 'Gagal') + '</span>'
          + (!ok && ket ? '<div class="tiny faint" style="margin-top:3px;max-width:220px;">' + esc(ket) + '</div>' : '');
      }
      function retryBtn(x){
        if(x.ok || !x.pengumuman_id) return '';
        return '<button type="button" class="btn btn-soft btn-sm snd-retry" data-id="' + esc(String(x.pengumuman_id)) + '">Kirim ulang</button>';
      }
      function renderSendCard(){
        var f = sendRows.filter(function(x){
          return (fState.ch === 'semua' || x.kanal === fState.ch) && (fState.st === 'semua' || (fState.st === 'ok' ? !!x.ok : !x.ok));
        });
        return '<div class="card" id="sndCard" style="margin-bottom:16px;">'
          + '<h3 class="display-s" style="margin-bottom:4px;">Status Kirim Notifikasi</h3>'
          + '<p class="tiny muted" style="margin-bottom:12px;">Hasil kirim per kanal — pesan personal dikirim otomatis via semua kanal terisi; centang kanal saat terbit untuk pesan umum.</p>'
          + '<div class="row gap-8" style="margin-bottom:12px;flex-wrap:wrap;">'
          + ['semua','wa','telegram','email'].map(function(k){ return '<button type="button" class="btn btn-sm ' + (fState.ch === k ? 'btn-primary' : 'btn-soft') + ' snd-f" data-ch="' + k + '">' + (k === 'semua' ? 'Semua kanal' : (chLabel[k] || k)) + '</button>'; }).join('')
          + '<span style="width:12px;"></span>'
          + [['semua','Semua status'],['ok','Terkirim'],['gagal','Gagal']].map(function(p){ return '<button type="button" class="btn btn-sm ' + (fState.st === p[0] ? 'btn-primary' : 'btn-soft') + ' snd-s" data-st="' + p[0] + '">' + p[1] + '</button>'; }).join('')
          + '</div>'
          + (f.length === 0 ? '<div class="empty"><strong>Tidak ada kiriman pada filter ini</strong></div>'
            : '<div class="desktop-table table-wrap card-flat" style="border:none;">'
            + table(['Waktu','Kanal','Tujuan','Pengumuman','Status',''], f.map(function(x){
                return [ '<span class="mono small">' + esc(String(x.created_at).slice(11,16)) + '<div class="tiny faint">' + SIK.fmtDate(String(x.created_at).slice(0,10)) + '</div></span>',
                  '<strong>' + esc(chLabel[x.kanal] || x.kanal) + '</strong>',
                  '<span class="small">' + esc(x.tujuan || '') + '</span>',
                  '<span class="muted small">' + esc(x.judul || ('#' + (x.pengumuman_id || '—'))) + '</span>',
                  sendBadge(!!x.ok, x.ket),
                  retryBtn(x) ];
              }))
            + '</div>'
            + '<div class="mobile-list">'
            + f.map(function(x){
                return mobRow([ '<span style="color:' + (x.ok ? 'var(--gold-600)' : 'var(--danger)') + ';">●</span>',
                  '<strong>' + esc(chLabel[x.kanal] || x.kanal) + ' — ' + (x.ok ? 'Terkirim' : 'Gagal') + '</strong><div class="list-sub">' + esc(x.tujuan || '') + ' · ' + esc(String(x.created_at).slice(11,16)) + '</div>', retryBtn(x) ]);
              }).join('')
            + '</div>')
          + '</div>';
      }
      host.innerHTML = renderSendCard()
        + '<div class="card">'
        + (rows.length === 0 ? '<div class="empty"><strong>Belum ada aktivitas</strong></div>' :
          '<div class="desktop-table table-wrap card-flat" style="border:none;">'
          + table(['Waktu','Aktor','Aksi','Detail'], rows.map(function(x){
              return [ '<span class="mono small">' + esc(String(x.created_at).slice(11,16)) + '<div class="tiny faint">' + SIK.fmtDate(String(x.created_at).slice(0,10)) + '</div></span>',
                '<strong>' + esc(x.actor) + '</strong>', esc(x.aksi), '<span class="muted small">' + esc(x.detail || '') + '</span>' ];
            }))
          + '</div>'
          + '<div class="mobile-list">'
          + rows.map(function(x){
              return mobRow([ '<span style="color:var(--gold-600);">●</span>', '<strong>' + esc(x.aksi) + '</strong><div class="list-sub">' + esc(x.actor) + ' · ' + esc(String(x.created_at).slice(11,16)) + '</div>', '' ]);
            }).join('')
          + '</div>')
        + '</div>'
        + '<p class="tiny faint mt-16">Log audit bersifat append-only — setiap aksi approve/reject/edit data krusial tercatat permanen.</p>';
      /* Filter kartu Status Kirim + tombol kirim ulang kanal gagal */
      function wireSends(){
        host.querySelectorAll('.snd-f').forEach(function(b){
          b.onclick = function(){ fState.ch = b.getAttribute('data-ch'); var c = document.getElementById('sndCard'); if(c) c.outerHTML = renderSendCard(); wireSends(); };
        });
        host.querySelectorAll('.snd-s').forEach(function(b){
          b.onclick = function(){ fState.st = b.getAttribute('data-st'); var c = document.getElementById('sndCard'); if(c) c.outerHTML = renderSendCard(); wireSends(); };
        });
        host.querySelectorAll('.snd-retry').forEach(function(b){
          b.onclick = async function(){
            var id = parseInt(b.getAttribute('data-id'), 10);
            b.disabled = true; b.textContent = 'Mengirim…';
            try {
              var r = await SIKAPI.post('/sends/retry', { id: id });
              showToast(r.ok ? ('Kirim ulang dijalankan ke kanal: ' + (r.retry || []).join(', ')) : (r.error || 'Gagal.'), r.ok ? 'success' : 'danger', 5000);
              setTimeout(function(){ VIEWS.log(document.getElementById('dashContent')); }, 1200);
            } catch(e){ showToast(e.message, 'danger', 5000); b.disabled = false; b.textContent = 'Kirim ulang'; }
          };
        });
      }
      wireSends();
    },

    /* ================= PENGATURAN ================= */
    pengaturan: async function(host, role){
      var res = await SIKAPI.get('/settings');
      /* Info default tersimpan (untuk tombol Reset/Jadikan Default) */
      var defInfo = null;
      try { var diRes = await SIKAPI.get('/settings/default-info'); defInfo = (diRes && diRes.data) || null; } catch(e){}
      var s = res.data;
      var canEdit = res.canEdit;

      /* Tombol simpan sticky di atas — selalu terjangkau + reset/abadikan default */
      var defInfoTxt = defInfo
        ? 'Default diabadikan ' + new Date(defInfo.setAt).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + ' oleh ' + esc(defInfo.setBy || '—')
        : 'Belum ada default tersimpan — abadikan tatanan sekarang';
      var stickyBar = canEdit
        ? '<div class="sticky-save"><button class="btn btn-primary" id="stSave">Simpan Pengaturan</button>'
          + '<button class="btn btn-ghost btn-sm" id="stResetDefault" title="Pulihkan SEMUA pengaturan ke tatanan default tersimpan" style="color:var(--danger);">Reset ke Default</button>'
          + '<button class="btn btn-soft btn-sm" id="stSetDefault" title="Abadikan tatanan tersimpan saat ini sebagai default">Jadikan Default</button>'
          + '<span class="tiny faint" id="stDefaultInfo">' + defInfoTxt + '</span></div>'
        : '';

      function logoTile(kind, label, pathVal){
        var img = pathVal
          ? '<img src="' + esc(pathVal) + '?v=' + Date.now() + '" alt="Logo ' + label + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">'
          : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5V11c0 5.2 3.6 9.9 9 11 5.4-1.1 9-5.8 9-11V6.5L12 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        return ''
          + '<div class="field"><label>' + esc(label) + '</label>'
          + '<div class="row gap-12" style="align-items:center;">'
          +   '<div id="lgPrev-' + kind + '" style="width:64px;height:64px;border-radius:16px;background:linear-gradient(150deg,var(--navy-600),var(--navy-900));color:var(--gold-400);display:grid;place-items:center;overflow:hidden;flex-shrink:0;">' + img + '</div>'
          +   '<div class="stack gap-8" style="flex:1;">'
          +     '<input type="file" id="lgFile-' + kind + '" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="font-size:.78rem;" ' + (canEdit?'':'disabled') + '>'
          +     '<span class="hint">PNG/JPG/WEBP/SVG · maks 512 KB' + (pathVal ? ' · aktif' : '') + '</span>'
          +   '</div>'
          + '</div>'
          + (pathVal && canEdit ? '<button class="btn btn-soft btn-sm mt-8" id="lgDel-' + kind + '" style="color:var(--danger);">Hapus logo</button>' : '')
          + '</div>';
      }

      /* ---------- Background halaman depan — paling atas untuk mempermudah pengelolaan ---------- */
      var heroCard =
        '<div class="card card-pad" style="margin-bottom:16px;">'
        + '<h3 class="display-s">Background halaman depan</h3>'
        + '<p class="small muted mt-8">Gambar latar section #beranda (hero). Kosong → otomatis memakai foto gratis dari sumber terbuka (Unsplash).</p>'
        + '<div class="stack gap-14 mt-16">'
        + '<div id="heroPrev" style="height:120px;border-radius:var(--r-m);border:1px solid var(--line);background-size:cover;background-position:center;display:grid;place-items:end start;padding:10px;">'
        + (s.hero_bg ? '' : '<span class="badge badge-dark">Fallback online</span>')
        + '</div>'
        + '<div class="field"><label>URL gambar background</label>'
        + '<div class="input-shell"><input id="stHeroBg" placeholder="https://… (kosongkan untuk fallback gratis)" value="' + esc(s.hero_bg || '') + '" ' + (canEdit?'':'disabled') + '></div>'
        + '<span class="hint">Disarankan 1920px lebar, format JPG/WebP.</span></div>'
        + '<div class="row gap-12">'
        + '<input type="file" id="heroFile" accept="image/png,image/jpeg,image/webp" style="font-size:.78rem;" ' + (canEdit?'':'disabled') + '>'
        + (s.hero_bg && canEdit ? '<button class="btn btn-soft btn-sm" id="heroDel" style="color:var(--danger);">Hapus (pakai fallback)</button>' : '')
        + '</div></div></div>';

      /* ---------- Kartu penunjuk ke menu Beban Sistem ---------- */
      var bzCard =
        '<div class="card card-pad" style="margin-bottom:16px;">'
        + '<h3 class="display-s">Beban sistem &amp; antrian</h3>'
        + '<p class="small muted mt-8">Kontrol deteksi sibuk &amp; halaman antrian kini punya menu sendiri — lengkap dengan status langsung, saklar aktif/mati, mode manual, dan seluruh ambang.</p>'
        + '<a class="btn btn-soft btn-sm" style="margin-top:8px;" href="#" onclick="return UI.go(\'beban\');">Buka menu Beban Sistem →</a>'
        + '</div>';

      /* ---------- Kartu penyimpanan uploads (multi-driver + kredensial) ---------- */
      var stRes = null;
      try { stRes = await SIKAPI.get('/storage'); } catch(_){}
      var st = (stRes && stRes.data) || { driver: 'local', cdnBase: '', credStatus: {} };
      var cs = st.credStatus || {};
      var stLabels = {
        cloudinary: { judul: 'Cloudinary', fields: { cloud: ['Cloud name', false], key: ['API Key', true], secret: ['API Secret', true] } },
        supabase:   { judul: 'Supabase Storage', fields: { url: ['Project URL', false], service_key: ['Service role key', true], bucket: ['Bucket (kosong = sikeda)', false] } },
        gdrive:     { judul: 'Google Drive', fields: { client_id: ['Client ID', false], client_secret: ['Client secret', true], refresh_token: ['Refresh token', true], folder_id: ['Folder ID (kosong = root)', false] } },
        s3:         { judul: 'S3 / Backblaze B2', fields: { endpoint: ['Endpoint (https://…)', false], region: ['Region (mis. us-east-1)', false], access_key: ['Access Key ID', false], secret_key: ['Secret Access Key', true], bucket: ['Nama bucket', false] } }
      };
      function stSrcTxt(src){ return src === 'env' ? 'environment variables (menang atas dashboard)' : src === 'db' ? 'dashboard — tersimpan terenkripsi di database' : src === 'mixed' ? 'campuran env + dashboard' : 'belum ada kredensial'; }
      var stDocLinks = st.docLinks || { cloudinary: { label: 'Dokumentasi Cloudinary', url: 'https://cloudinary.com/documentation/how_to_integrate_cloudinary' }, supabase: { label: 'Dokumentasi Supabase Storage', url: 'https://supabase.com/docs/guides/storage' }, gdrive: { label: 'Google Drive API', url: 'https://developers.google.com/drive/api/guides/about-sdk' }, s3: { label: 'Backblaze B2 S3-Compatible API', url: 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api' } };
      var stSummary =
        '<p class="hint mt-8" id="stSummary">Kesiapan kredensial — ' + Object.keys(stLabels).map(function(drv){
          var s2 = cs[drv] || { ready: false, source: null };
          return stLabels[drv].judul + ': ' + (s2.ready ? '<span style="color:var(--ok);">✓ siap</span>' : '<span style="color:var(--warn);">belum lengkap</span>') + ' (' + (s2.source === 'env' ? 'env' : s2.source === 'db' ? 'dashboard' : s2.source === 'mixed' ? 'env+dashboard' : 'kosong') + ')';
        }).join(' · ') + '</p>';
      var credSections = Object.keys(stLabels).map(function(drv){
        var L = stLabels[drv];
        var stat = cs[drv] || { ready: false, source: null, fields: {} };
        var rows = Object.keys(L.fields).map(function(f){
          var meta = L.fields[f];
          var fs2 = (stat.fields || {})[f] || { set: false, src: null };
          return '<div class="field"><label>' + meta[0] + (fs2.set ? ' <span class="hint" style="display:inline;">— terisi (' + (fs2.src === 'env' ? 'env' : 'dashboard') + ')</span>' : '') + '</label>'
            + '<div class="input-shell"><input id="stc_' + drv + '_' + f + '" type="' + (meta[1] ? 'password' : 'text') + '" autocomplete="off" spellcheck="false" placeholder="' + (fs2.set ? '••••••••  terisi — kosongkan untuk mempertahankan nilai lama' : 'belum diisi') + '" ' + (canEdit ? '' : 'disabled') + '></div></div>';
        }).join('');
        return '<div class="card card-pad" id="stCred_' + drv + '" style="margin-top:12px;display:' + (st.driver === drv ? 'block' : 'none') + ';">'
          + '<h4 style="margin:0 0 6px;font-size:.92rem;">Kesiapan kredensial — ' + L.judul + '</h4>'
          + (stDocLinks[drv] ? '<p class="hint" style="margin:0 0 6px;"><a href="' + esc(stDocLinks[drv].url) + '" target="_blank" rel="noopener">📘 ' + esc(stDocLinks[drv].label) + ' ↗</a></p>' : '')
          + '<p class="hint" id="stSrc_' + drv + '">Sumber aktif: <b>' + stSrcTxt(stat.source) + '</b> — kesiapan: ' + (stat.ready ? '<span style="color:var(--ok);">✓ lengkap</span>' : '<span style="color:var(--warn);">belum lengkap</span>') + '</p>'
          + '<div class="stack gap-14 mt-16">' + rows + '</div>'
          + (canEdit ? '<div class="row gap-12 mt-12"><button class="btn btn-primary btn-sm st-cred-save" data-drv="' + drv + '">Simpan Kredensial</button><button class="btn btn-soft btn-sm st-cred-del" data-drv="' + drv + '">Hapus yang tersimpan</button></div>' : '')
          + '</div>';
      }).join('');
      var storageCard =
        '<div class="card card-pad" style="margin-bottom:16px;">'
        + '<h3 class="display-s">Penyimpanan file uploads</h3>'
        + '<p class="small muted mt-8">Folder server bawaan selalu aktif sebagai fallback — instalasi pertama tanpa konfigurasi tetap berjalan normal. Driver remote mengarahkan pembacaan (redirect ke CDN) dan menyalin file baru ke layanan penyimpanan gratis. Kredensial bisa diisi di seksi sesuai driver (tersimpan terenkripsi), atau lewat environment variables yang selalu menang.</p>'
        + '<div class="grid-2 mt-16">'
        + '<div class="field"><label>Driver penyimpanan</label>'
        + '<div class="input-shell"><select id="stStorage" ' + (canEdit ? '' : 'disabled') + '>'
        + '<option value="local"' + (st.driver === 'local' ? ' selected' : '') + '>Lokal — server bawaan (default)</option>'
        + '<option value="cdn"' + (st.driver === 'cdn' ? ' selected' : '') + '>CDN kustom — file tetap di server</option>'
        + '<option value="cloudinary"' + (st.driver === 'cloudinary' ? ' selected' : '') + '>Cloudinary — 25 GB gratis</option>'
        + '<option value="supabase"' + (st.driver === 'supabase' ? ' selected' : '') + '>Supabase Storage — 1 GB gratis</option>'
        + '<option value="gdrive"' + (st.driver === 'gdrive' ? ' selected' : '') + '>Google Drive — 15 GB gratis</option>'
        + '<option value="s3"' + (st.driver === 's3' ? ' selected' : '') + '>S3 / Backblaze B2 — 10 GB gratis</option>'
        + '</select></div></div>'
        + '<div class="field" id="stCdnWrap" style="display:' + (st.driver === 'cdn' || st.driver === 'gdrive' ? 'block' : 'none') + ';"><label>CDN base URL (https://…)</label>'
        + '<div class="input-shell"><input id="stCdnBase" placeholder="https://cdn.contoh.com" value="' + esc(st.cdnBase || '') + '" ' + (canEdit ? '' : 'disabled') + '></div>'
        + '<span class="hint">Dipakai driver CDN kustom &amp; Google Drive untuk membentuk URL publik berkas.</span></div>'
        + '</div>'
        + stSummary
        + (canEdit ? '<div class="row gap-12 mt-12"><button class="btn btn-primary btn-sm" id="stStorageSave">Simpan Penyimpanan</button><button class="btn btn-soft btn-sm" id="stStorageTest">Uji Simpan &amp; Baca</button></div>' : '')
        + (!stRes ? '<p class="hint mt-8">Backend belum mendukung modul penyimpanan — perbarui server ke versi terbaru.</p>' : '')
        + '</div>'
        + credSections;

      /* ---------- Kartu migrasi file lama: manual + otomatis ---------- */
      var amRes = null;
      try { amRes = await SIKAPI.get('/storage/automig'); } catch(_){}
      var am = (amRes && amRes.data) || { enabled: false, batch: 10, intervalSecs: 30, done: 0, ok: 0, failedCount: 0, total: 0, lastRun: null, lastErr: null };
      var migrateCard =
        '<div class="card card-pad" id="stMigrateCard" style="display:' + (['local','cdn'].includes(st.driver) ? 'none' : 'block') + ';margin-bottom:16px;">'
        + '<h3 class="display-s">Migrasi file lama ke driver aktif</h3>'
        + '<p class="small muted mt-8">File yang diunggah sebelum driver ini aktif belum tersalin ke layanan remote. Kirim manual per berkas/massal (maks 100), atau aktifkan <b>migrasi otomatis</b> yang berjalan bertahap di latar belakang. Penyimpanan lokal tidak pernah diubah — mirror murni tambahan.</p>'
        + '<div class="grid-2 mt-12">'
        + '<div class="field"><label>Migrasi otomatis (latar belakang)</label>'
        + '<div class="input-shell"><select id="stAmEnabled" ' + (canEdit ? '' : 'disabled') + '>'
        + '<option value="0"' + (!am.enabled ? ' selected' : '') + '>Nonaktif</option>'
        + '<option value="1"' + (am.enabled ? ' selected' : '') + '>Aktif — kirim otomatis bertahap</option>'
        + '</select></div></div>'
        + '<div class="field"><label>Ukuran batch &amp; interval</label>'
        + '<div class="row gap-8"><div class="input-shell" style="flex:1;"><input id="stAmBatch" type="number" min="1" max="100" value="' + (am.batch || 10) + '" title="berkas per langkah" ' + (canEdit ? '' : 'disabled') + '></div>'
        + '<div class="input-shell" style="flex:1;"><input id="stAmInt" type="number" min="10" max="3600" value="' + (am.intervalSecs || 30) + '" title="detik antar langkah" ' + (canEdit ? '' : 'disabled') + '></div></div>'
        + '<span class="hint">Kiri: berkas per langkah (1–100) · Kanan: detik antar langkah (10–3600).</span></div>'
        + '</div>'
        + '<p class="hint mt-8" id="stAmProg">Progres: ' + (am.done || 0) + ' tersalin' + (am.total ? ' dari ' + am.total + ' berkas' : '') + ' · gagal ' + (am.failedCount || 0) + (am.lastRun ? ' · terakhir jalan: ' + esc(String(am.lastRun).replace('T', ' ').slice(0, 19)) : '') + '</p>'
        + (am.lastErr ? '<p class="hint" style="color:var(--warn);">Catatan terakhir: ' + esc(am.lastErr) + '</p>' : '')
        + (canEdit ? '<div class="row gap-12 mt-8"><button class="btn btn-primary btn-sm" id="stAmSave">Simpan Migrasi Otomatis</button><button class="btn btn-soft btn-sm" id="stAmRun">Jalankan satu langkah sekarang</button></div>' : '')
        + '<div class="row gap-12 mt-16" style="align-items:center;">'
        + '<button class="btn btn-soft btn-sm" id="stMigRefresh">Muat daftar berkas</button>'
        + '<label class="small"><input type="checkbox" id="stMigAll"> Pilih semua</label>'
        + '<button class="btn btn-primary btn-sm" id="stMigSend" disabled>Kirim terpilih</button>'
        + '<span class="hint" id="stMigInfo"></span>'
        + '</div>'
        + '<div id="stMigList" class="mt-12" style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:10px;"></div>'
        + '</div>';

      host.innerHTML = stickyBar
        + heroCard
        + storageCard
        + migrateCard
        + bzCard
        + '<div class="grid-2">'

      host.innerHTML = stickyBar
        + heroCard
        + storageCard
        + bzCard
        + '<div class="grid-2">'
        + '<div class="stack gap-16">'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Profil organisasi</h3>'
        + '<div class="stack gap-14 mt-16">'
        + '<div class="field"><label>Nama organisasi</label><div class="input-shell"><input id="stNama" value="' + esc(s.org_nama || '') + '" ' + (canEdit?'':'disabled') + '></div></div>'
        + '<div class="field"><label>Wilayah</label><div class="input-shell"><input id="stWil" value="' + esc(s.org_wilayah || '') + '" ' + (canEdit?'':'disabled') + '></div></div>'
        + '</div>'
        + (canEdit ? '' : '<p class="tiny faint mt-16">Hanya Superadmin yang dapat mengubah pengaturan.</p>')
        + '</div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Logo aplikasi</h3>'
        + '<p class="small muted mt-8">Logo tampil di header dashboard, halaman depan, login, dan pendaftaran.</p>'
        + '<div class="stack gap-16 mt-16">'
        + logoTile('dashboard', 'Logo dashboard', s.logo_dashboard)
        + logoTile('landing', 'Logo halaman depan', s.logo_landing)
        + '<div class="field"><label>Favicon (tab browser)</label>'
        + '<div class="row gap-12" style="align-items:center;">'
        +   '<div id="favPrev" style="width:44px;height:44px;border-radius:11px;background:#fff;border:1px solid var(--line);display:grid;place-items:center;overflow:hidden;flex-shrink:0;">'
        +     (s.favicon ? '<img src="' + esc(s.favicon) + '?v=' + Date.now() + '" style="width:100%;height:100%;object-fit:contain;">' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.6"/></svg>')
        +   '</div>'
        +   '<div class="stack gap-6" style="flex:1;">'
        +     '<input type="file" id="favFile" accept="image/png,image/x-icon,image/svg+xml,image/webp" style="font-size:.78rem;" ' + (canEdit?'':'disabled') + '>'
        +     '<span class="hint">PNG/ICO/SVG/WEBP · sisi 32–64px · maks 200 KB</span>'
        +   '</div>'
        + '</div></div>'
        + '</div></div>'
        + '</div>'
        + '<div class="stack gap-16">'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">OTP & WhatsApp gateway</h3>'
        + (canEdit ? '<div class="gw-status" id="gwWa" data-ch="fonnte"><span class="gws-dot"></span><span class="gws-txt">Status: belum ada percobaan kirim</span></div>' : '')
        + '<div class="stack gap-10 mt-16">'
        + '<div class="field"><label>API Key Fonnte</label>'
        + '<div class="input-shell"><input id="stFonnte" type="text" autocomplete="off" spellcheck="false" placeholder="Tempel API key dari dashboard Fonnte" value="' + esc(s.fonnte_api_key || '') + '" ' + (canEdit?'':'disabled') + '></div>'
        + '<span class="hint">Diisi → OTP WhatsApp dikirim via Fonnte. Kosong → kode tampil sebagai <strong>kode dev</strong> (mode simulasi).</span></div>'
        + (canEdit ? '<div class="test-row"><div class="field" style="flex:1;min-width:200px;"><label>Nomor tujuan uji</label><div class="input-shell"><input id="stWaTestTo" inputmode="tel" autocomplete="off" placeholder="081234567890"></div></div>'
        + '<button type="button" class="btn btn-soft btn-sm test-btn" id="stWaTest">Kirim uji WhatsApp</button></div>'
        + '<span class="hint test-hint">Pesan uji ke nomor tujuan, memakai API key di atas (disimpan dulu otomatis).</span>' : '')
        + '<label class="checkbox-line"><input type="checkbox" checked disabled> OTP via WhatsApp / Telegram / Email</label>'
        + '<label class="checkbox-line"><input type="checkbox" disabled> Rate limit ' + esc(s.otp_rate_limit || '3/10menit') + ' per nomor</label>'
        + '<label class="checkbox-line"><input type="checkbox" checked disabled> NIK tersimpan AES-256-GCM</label>'
        + '<label class="checkbox-line"><input type="checkbox" checked disabled> Password pengelola di-hash bcrypt</label>'
        + '</div></div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Uji OTP alur penuh</h3>'
        + '<p class="small muted mt-8">Menerbitkan OTP sungguhan lewat gateway terpilih — tanpa perlu akun terdaftar. Penerima mengetik kodenya di halaman login seperti anggota biasa; kode tidak pernah tampil di dasbor.</p>'
        + (canEdit ? '<div class="test-row"><div class="field" style="flex:1;min-width:200px;"><label>Tujuan uji OTP</label><div class="input-shell"><input id="stOtpTo" autocomplete="off" placeholder="0812… / nama@domain.com / 123456789"></div></div>'
        + '<button type="button" class="btn btn-soft btn-sm test-btn" id="stOtpTest">Kirim uji OTP</button></div>'
        + '<span class="hint test-hint">OTP diterbitkan sungguhan dan dikirim ke tujuan — verifikasi di halaman login seperti anggota biasa.</span>'
        + '<div class="field" style="max-width:280px;"><label>Kanal</label><div class="input-shell"><select id="stOtpCh">'
        + '<option value="wa">WhatsApp (Fonnte)</option>'
        + '<option value="email">Email (SMTP)</option>'
        + '<option value="telegram">Telegram</option>'
        + '</select></div><span class="hint">Rate limit pendaftar tidak terpengaruh — uji ini jalur terpisah.</span></div>' : '')
        + '</div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Telegram Bot & Channel</h3>'
        + (canEdit ? '<div class="gw-status" id="gwTg" data-ch="telegram"><span class="gws-dot"></span><span class="gws-txt">Status: belum ada percobaan kirim</span></div>' : '')
        + '<div class="stack gap-14 mt-16">'
        + '<div class="field"><label>Bot Token</label>'
        + '<div class="input-shell"><input id="stTgToken" type="text" autocomplete="off" spellcheck="false" placeholder="123456789:AA... dari @BotFather" value="' + esc(s.telegram_bot_token || '') + '" ' + (canEdit?'':'disabled') + '></div>'
        + '<span class="hint">Dipakai mengirim OTP Telegram & broadcast data pendaftaran.</span></div>'
        + '<div class="field"><label>Chat ID Channel Tujuan</label>'
        + '<div class="input-shell"><input id="stTgChat" type="text" autocomplete="off" spellcheck="false" placeholder="contoh: -1001234567890" value="' + esc(s.telegram_chat_id || '') + '" ' + (canEdit?'':'disabled') + '></div>'
        + '<span class="hint">Semua proses pendaftaran anggota dikirim ke channel ini. Ambil ID via <strong>@userinfobot</strong> setelah bot ditambahkan ke channel.</span></div>'
        + (canEdit ? '<div class="test-row"><div class="field" style="flex:1;min-width:200px;"><label>Chat ID tujuan uji</label><div class="input-shell"><input id="stTgTestTo" inputmode="numeric" autocomplete="off" placeholder="contoh: 123456789"></div><span class="hint">Pesan uji ke chat pribadi ini (angka). Kosong → uji ke channel penyimpanan data.</span></div>'
        + '<button type="button" class="btn btn-soft btn-sm test-btn" id="stTgTest">Kirim uji Telegram</button></div>' : '')
        + '</div></div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Email (SMTP)</h3>'
        + (canEdit ? '<div class="gw-status" id="gwSmtp" data-ch="smtp"><span class="gws-dot"></span><span class="gws-txt">Status: belum ada percobaan kirim</span></div>' : '')
        + '<div class="stack gap-14 mt-16">'
        + '<div class="grid-2">'
        + '<div class="field"><label>SMTP Host</label><div class="input-shell"><input id="stSmtpHost" placeholder="smtp.gmail.com" value="' + esc(s.smtp_host || '') + '" ' + (canEdit?'':'disabled') + '></div></div>'
        + '<div class="field"><label>Port</label><div class="input-shell"><input id="stSmtpPort" type="number" placeholder="587" value="' + esc(s.smtp_port || '587') + '" ' + (canEdit?'':'disabled') + '></div></div>'
        + '</div>'
        + '<div class="grid-2">'
        + '<div class="field"><label>User</label><div class="input-shell"><input id="stSmtpUser" autocomplete="off" placeholder="notifikasi@domain.com" value="' + esc(s.smtp_user || '') + '" ' + (canEdit?'':'disabled') + '></div></div>'
        + '<div class="field"><label>Password / App Password</label><div class="input-shell"><input id="stSmtpPass" type="password" autocomplete="new-password" placeholder="••••••••" value="' + esc(s.smtp_pass || '') + '" ' + (canEdit?'':'disabled') + '></div></div>'
        + '</div>'
        + '<span class="hint">Diisi → OTP email dikirim nyata. Kosong → simulasi dev.</span>'
        + (canEdit ? '<div class="test-row"><div class="field" style="flex:1;min-width:200px;"><label>Alamat email tujuan uji</label><div class="input-shell"><input id="stSmtpTestTo" type="email" autocomplete="off" placeholder="nama@domain.com"></div></div>'
        + '<button type="button" class="btn btn-soft btn-sm test-btn" id="stSmtpTest">Kirim uji email</button></div>'
        + '<span class="hint test-hint">Email uji ke alamat tujuan, memakai konfigurasi SMTP di atas (disimpan dulu otomatis).</span>' : '')
        + '</div></div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Kode pendaftaran</h3>'
        + '<p class="small muted mt-8">Prefix ini dipakai server saat menerbitkan kode anggota baru — format <span class="mono">prefix + C + 6 digit</span>.</p>'
        + '<div class="field mt-16"><label>Prefix aktif</label>'
        + '<div class="input-shell"><input id="stPrefix2" class="mono" placeholder="GLKR-TA-2026-" maxlength="30" value="' + esc(s.id_prefix || '') + '" ' + (canEdit?'':'disabled') + '></div>'
        + '<span class="hint">Huruf, angka, dan tanda hubung — 3–30 karakter. Contoh: <span class="mono">GLKR-TA-2026-</span></span></div>'
        + '<div class="field"><label>Pratinjau format kode berikutnya</label>'
        + '<div class="input-shell"><span class="mono" id="stPrefixPrev" style="font-weight:700;">' + esc(s.id_prefix || '(prefix)') + 'C' + String(Date.now()).slice(-6) + '</span></div>'
        + '<span class="hint">6 digit terakhir dihasilkan dari waktu penerbitan — pratinjau hanya ilustrasi format.</span></div>'
        + (canEdit ? '<button type="button" class="btn btn-primary btn-sm" id="stPrefixSave" style="margin-top:6px;">Simpan prefix</button>' : '<p class="tiny faint mt-16">Hanya Superadmin yang dapat mengubah prefix.</p>')
        + '</div>'
        + '<div class="card card-pad">'
        + '<h3 class="display-s">Akun demo (login tanpa OTP)</h3>'
        + '<p class="small muted mt-8">Akun anggota yang bisa masuk dari tombol <strong>Masuk Demo</strong> tanpa OTP — untuk koreksi, simulasi sistem &amp; desain.</p>'
        + (function(){
            var off = String(s.demo_enabled || '').trim().toLowerCase() === 'off';
            return '<div class="demo-status ' + (off ? 'is-off' : 'is-on') + '">'
              + '<span class="ds-dot" aria-hidden="true"></span>'
              + '<div class="ds-txt"><strong>Login demo ' + (off ? 'NONAKTIF' : 'AKTIF') + '</strong>'
              + '<span>' + (off ? 'Tombol Masuk Demo tersembunyi di halaman login — akun demo tidak bisa masuk.' : 'Tombol Masuk Demo tampil di halaman login.') + '</span></div>'
              + (canEdit ? '<button type="button" class="btn ' + (off ? 'btn-gold' : 'btn-soft') + ' btn-sm" id="stDemoToggle">' + (off ? 'Aktifkan' : 'Nonaktifkan') + '</button>' : '')
              + '</div>';
          })()
        + '<div class="field mt-16"><label>Username akun demo</label>'
        + '<div class="input-shell"><input id="stDemoAccounts" placeholder="demo.anggota" value="' + esc(s.demo_accounts || '') + '" ' + (canEdit?'':'disabled') + '></div>'
        + '<span class="hint">Pisahkan beberapa akun dengan koma, mis. <span class="mono">demo.anggota, demo.anggota2</span>. Hanya berlaku untuk level anggota dengan akun aktif.</span></div>'
        + (canEdit ? '<div class="demo-actions"><button type="button" class="btn btn-primary btn-sm" id="stDemoSave">Simpan daftar akun</button><span class="hint">Nonaktifkan = fitur dimatikan meski daftar masih terisi, tanpa perlu menghapusnya.</span></div>' : '')
        + '</div></div></div>';

      if(!canEdit) return;

      /* ---------- Status gateway: ambil & render tiap kartu ---------- */
      (function(){
        function render(s){
          var map = { fonnte: 'gwWa', telegram: 'gwTg', smtp: 'gwSmtp' };
          Object.keys(map).forEach(function(ch){
            var box = document.getElementById(map[ch]);
            if(!box) return;
            var st = s && s[ch];
            var txt = box.querySelector('.gws-txt');
            if(!st){
              box.classList.remove('is-ok','is-err');
              if(txt) txt.textContent = 'Status: belum ada percobaan kirim';
              return;
            }
            var t = new Date(st.at);
            var jam = ('0'+t.getHours()).slice(-2)+':'+('0'+t.getMinutes()).slice(-2);
            box.classList.toggle('is-ok', !!st.ok);
            box.classList.toggle('is-err', !st.ok);
            if(txt) txt.innerHTML = (st.ok ? '<strong>Berhasil</strong> terkirim · ' : '<strong>Gagal</strong> · ') + 'terakhir ' + jam + (st.err ? ' — ' + String(st.err).replace(/[&<>"]/g, '').slice(0, 70) : '');
          });
        }
        SIKAPI.get('/settings/gateway-status', { noRedirect: true }).then(function(r){ render(r && r.data); }).catch(function(){});
        window._gwRender = render;
      })();

      /* ---------- Uji OTP alur penuh (WA / Telegram / Email) ---------- */
      (function(){
        var btn = document.getElementById('stOtpTest');
        if(!btn) return;
        var sel = document.getElementById('stOtpCh');
        var inp = document.getElementById('stOtpTo');
        btn.onclick = async function(){
          var target = (inp.value || '').trim();
          if(!target){ showToast('Isi dulu nomor/email/chat ID tujuan uji OTP.', 'danger'); return; }
          btn.disabled = true; btn.textContent = 'Mengirim OTP…';
          try {
            var r = await SIKAPI.post('/settings/otp-test', { target: target, channel: sel ? sel.value : 'wa' });
            showToast(r.ok ? (r.detail || 'OTP terkirim.') : (r.error || 'Gagal.'), r.ok ? 'success' : 'danger', 6000);
            SIKAPI.get('/settings/gateway-status', { noRedirect: true }).then(function(g){ if(window._gwRender) window._gwRender(g && g.data); }).catch(function(){});
          } catch(e){ showToast(e.message, 'danger', 6000); }
          btn.disabled = false; btn.textContent = 'Kirim uji OTP';
        };
      })();

      /* Kode pendaftaran: pratinjau format + simpan prefix (divalidasi server) */
      (function(){
        var inp = document.getElementById('stPrefix2');
        var prev = document.getElementById('stPrefixPrev');
        if(inp && prev){
          inp.addEventListener('input', function(){
            var v = inp.value.trim();
            prev.textContent = (v || '(prefix)') + 'C' + String(Date.now()).slice(-6);
          });
        }
        var pb = document.getElementById('stPrefixSave');
        if(pb){
          pb.onclick = async function(){
            var v = (document.getElementById('stPrefix2').value || '').trim();
            if(!/^[A-Za-z0-9-]{3,30}$/.test(v)){
              showToast('Prefix hanya boleh huruf, angka, dan tanda hubung (3–30 karakter).', 'danger');
              return;
            }
            pb.disabled = true; pb.textContent = 'Menyimpan…';
            try {
              await SIKAPI.put('/settings', { id_prefix: v });
              s.id_prefix = v;
              showToast('Prefix kode pendaftaran tersimpan: ' + v, 'success', 4000);
            } catch(e){ showToast(e.message, 'danger', 4500); }
            pb.disabled = false; pb.textContent = 'Simpan prefix';
          };
        }
      })();

      /* Akun demo: saklar aktif/nonaktif + simpan daftar */
      (function(){
        var tgBtn = document.getElementById('stDemoToggle');
        if(tgBtn){
          tgBtn.onclick = async function(){
            var off = String(s.demo_enabled || '').trim().toLowerCase() === 'off';
            var next = off ? 'on' : 'off';
            tgBtn.disabled = true;
            try {
              await SIKAPI.put('/settings', { demo_enabled: next });
              s.demo_enabled = next;
              /* Perbarui kartu status langsung — tanpa perlu render ulang */
              var box = tgBtn.closest('.demo-status');
              if(box){
                box.classList.toggle('is-on', next === 'on');
                box.classList.toggle('is-off', next === 'off');
                var st = box.querySelector('.ds-txt strong');
                var sd = box.querySelector('.ds-txt span');
                if(st) st.textContent = 'Login demo ' + (next === 'off' ? 'NONAKTIF' : 'AKTIF');
                if(sd) sd.textContent = next === 'off'
                  ? 'Tombol Masuk Demo tersembunyi di halaman login — akun demo tidak bisa masuk.'
                  : 'Tombol Masuk Demo tampil di halaman login.';
              }
              tgBtn.textContent = next === 'off' ? 'Aktifkan' : 'Nonaktifkan';
              tgBtn.className = 'btn ' + (next === 'off' ? 'btn-gold' : 'btn-soft') + ' btn-sm';
              tgBtn.disabled = false;
              showToast(next === 'off'
                ? 'Login demo dinonaktifkan — tombol Masuk Demo disembunyikan di halaman login.'
                : 'Login demo diaktifkan — tombol Masuk Demo kembali tampil.', 'success', 4200);
            } catch(e){ tgBtn.disabled = false; showToast(e.message, 'danger'); }
          };
        }
        var svBtn = document.getElementById('stDemoSave');
        if(svBtn){
          svBtn.onclick = async function(){
            svBtn.disabled = true;
            try {
              await SIKAPI.put('/settings', { demo_accounts: document.getElementById('stDemoAccounts').value });
              s.demo_accounts = document.getElementById('stDemoAccounts').value;
              showToast('Daftar akun demo disimpan.', 'success');
            } catch(e){ showToast(e.message, 'danger'); }
            svBtn.disabled = false;
          };
        }
      })();

      /* Preview background hero saat ini */
      (function(){
        var p = document.getElementById('heroPrev');
        var bgVal = s.hero_bg || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=60';
        p.style.backgroundImage = 'url("' + bgVal + '")';
      })();

      /* ---------- Penyimpanan uploads: driver, kredensial, uji, simpan ---------- */
      var stSel = document.getElementById('stStorage');
      if(stSel){
        var stWrap = document.getElementById('stCdnWrap');
        stSel.onchange = function(){
          if(stWrap) stWrap.style.display = (stSel.value === 'cdn' || stSel.value === 'gdrive') ? 'block' : 'none';
          Object.keys(stLabels).forEach(function(drv){
            var el = document.getElementById('stCred_' + drv);
            if(el) el.style.display = stSel.value === drv ? 'block' : 'none';
          });
        };
      }
      /* Kumpulkan field kredensial driver aktif yang terisi (tanpa nilai bullet) */
      function stCollectCreds(drv){
        var out = {};
        Object.keys(stLabels[drv].fields).forEach(function(f){
          var el = document.getElementById('stc_' + drv + '_' + f);
          var v = el && el.value ? String(el.value).trim() : '';
          if(v && !/^[•\u2022]+$/.test(v)) out[f] = v;
        });
        return out;
      }
      async function stRefreshStatus(){
        try {
          var r2 = await SIKAPI.get('/storage');
          var d2 = (r2 && r2.data) || {};
          var cs2 = d2.credStatus || {};
          Object.keys(stLabels).forEach(function(drv){
            var stat = cs2[drv] || { ready: false, source: null, fields: {} };
            var srcEl = document.getElementById('stSrc_' + drv);
            if(srcEl) srcEl.innerHTML = 'Sumber aktif: <b>' + stSrcTxt(stat.source) + '</b> — kesiapan: ' + (stat.ready ? '<span style="color:var(--ok);">✓ lengkap</span>' : '<span style="color:var(--warn);">belum lengkap</span>');
            Object.keys(stLabels[drv].fields).forEach(function(f){
              var el = document.getElementById('stc_' + drv + '_' + f);
              var fs2 = (stat.fields || {})[f] || { set: false };
              if(el && fs2.set){ el.placeholder = '••••••••  terisi — kosongkan untuk mempertahankan nilai lama'; }
            });
          });
          var sumEl = document.getElementById('stSummary');
          if(sumEl) sumEl.innerHTML = 'Kesiapan kredensial — ' + Object.keys(stLabels).map(function(drv){
            var s2 = cs2[drv] || { ready: false, source: null };
            return stLabels[drv].judul + ': ' + (s2.ready ? '<span style="color:var(--ok);">✓ siap</span>' : '<span style="color:var(--warn);">belum lengkap</span>') + ' (' + (s2.source === 'env' ? 'env' : s2.source === 'db' ? 'dashboard' : s2.source === 'mixed' ? 'env+dashboard' : 'kosong') + ')';
          }).join(' · ');
        } catch(_){ }
      }
      var stSave2 = document.getElementById('stStorageSave');
      if(stSave2){
        stSave2.onclick = async function(){
          try {
            var drv = document.getElementById('stStorage').value;
            var body = { driver: drv, cdnBase: (document.getElementById('stCdnBase') || {}).value || '' };
            if(stLabels[drv]){
              var cr = stCollectCreds(drv);
              if(Object.keys(cr).length) body.creds = cr;
            }
            await SIKAPI.put('/storage', body);
            showToast('Konfigurasi penyimpanan disimpan.', 'success');
            if(body.creds){
              Object.keys(body.creds).forEach(function(f){ var el = document.getElementById('stc_' + drv + '_' + f); if(el) el.value = ''; });
              await stRefreshStatus();
            }
          } catch(e){ showToast(e.message, 'danger'); }
        };
      }
      Array.prototype.forEach.call(document.querySelectorAll('.st-cred-save'), function(btn){
        btn.onclick = async function(){
          var drv = btn.getAttribute('data-drv');
          try {
            var cr = stCollectCreds(drv);
            if(!Object.keys(cr).length){ showToast('Tidak ada kredensial baru untuk disimpan.', 'danger'); return; }
            await SIKAPI.put('/storage', { driver: document.getElementById('stStorage').value, creds: cr });
            Object.keys(cr).forEach(function(f){ var el = document.getElementById('stc_' + drv + '_' + f); if(el) el.value = ''; });
            showToast('Kredensial ' + stLabels[drv].judul + ' disimpan terenkripsi.', 'success');
            await stRefreshStatus();
          } catch(e){ showToast(e.message, 'danger'); }
        };
      });
      Array.prototype.forEach.call(document.querySelectorAll('.st-cred-del'), function(btn){
        btn.onclick = async function(){
          var drv = btn.getAttribute('data-drv');
          if(!confirm('Hapus kredensial ' + stLabels[drv].judul + ' yang tersimpan di database?')) return;
          try {
            await SIKAPI.del('/storage/creds?driver=' + drv);
            showToast('Kredensial ' + stLabels[drv].judul + ' dihapus.', 'success');
            await stRefreshStatus();
          } catch(e){ showToast(e.message, 'danger'); }
        };
      });
      var stTestBtn = document.getElementById('stStorageTest');
      if(stTestBtn){
        stTestBtn.onclick = async function(){
          stTestBtn.disabled = true;
          try {
            var r = await SIKAPI.post('/storage/test', {});
            var q2 = r.quota || {};
            var extra = '';
            if(q2.usage){
              if(q2.usage.storage_bytes !== undefined){
                var lim = q2.usage.storage_limit_bytes;
                extra = ' — terpakai ' + (q2.usage.storage_bytes/1073741824).toFixed(2) + ' GB' + (lim ? ' / ' + (lim/1073741824).toFixed(0) + ' GB' : '');
                if(q2.usage.files !== undefined) extra += ', ' + q2.usage.files + ' berkas';
              } else if(q2.usage.note) extra = ' — ' + q2.usage.note;
            } else if(q2.err) extra = ' (kuota: ' + q2.err + ')';
            showToast((r.message || ('Driver aktif: ' + (r.driver || '?'))) + extra, r.remoteOk === false ? 'danger' : 'success');
          } catch(e){ showToast(e.message, 'danger'); }
          stTestBtn.disabled = false;
        };
      }

      /* ---------- Migrasi file lama: muat daftar, pilih, kirim ---------- */
      var stMigFiles = [];
      var migRefresh = document.getElementById('stMigRefresh');
      if(migRefresh){
        migRefresh.onclick = async function(){
          var info = document.getElementById('stMigInfo');
          var list = document.getElementById('stMigList');
          info.textContent = 'Memuat…';
          try {
            var r = await SIKAPI.get('/storage/files?limit=500');
            var d = (r && r.data) || { files: [], total: 0 };
            stMigFiles = d.files || [];
            var belum = stMigFiles.filter(function(f){ return !f.mirrored; }).length;
            info.textContent = d.total + ' berkas lokal — ' + belum + ' belum tersalin.';
            list.innerHTML = stMigFiles.map(function(f){
              var cek = f.mirrored
                ? '<span class="hint" style="color:var(--ok);white-space:nowrap;">✓ tersalin</span>'
                : '<input type="checkbox" class="st-mig-chk" data-rel="' + esc(f.rel) + '">';
              return '<label class="small" style="display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line);">' + cek + ' <span style="flex:1;word-break:break-all;">' + esc(f.rel) + '</span> <span class="hint">' + Math.ceil(f.size/1024) + ' KB</span></label>';
            }).join('') || '<p class="hint" style="padding:10px;">Tidak ada berkas.</p>';
            document.getElementById('stMigSend').disabled = false;
          } catch(e){ info.textContent = e.message; }
        };
      }
      var migAll = document.getElementById('stMigAll');
      if(migAll){
        migAll.onchange = function(){
          document.querySelectorAll('.st-mig-chk').forEach(function(c){ c.checked = migAll.checked; });
        };
      }
      var migSend = document.getElementById('stMigSend');
      if(migSend){
        migSend.onclick = async function(){
          var rels = Array.prototype.map.call(document.querySelectorAll('.st-mig-chk:checked'), function(c){ return c.getAttribute('data-rel'); });
          if(!rels.length){ showToast('Belum ada berkas dipilih.', 'danger'); return; }
          migSend.disabled = true;
          try {
            var r = await SIKAPI.post('/storage/mirror', { rel: rels });
            showToast((r.ok || 0) + '/' + (r.total || 0) + ' berkas berhasil di-mirror ke ' + r.driver + '.', r.ok === r.total ? 'success' : 'danger');
          } catch(e){ showToast(e.message, 'danger'); }
          migSend.disabled = false;
        };
      }

      /* ---------- Migrasi otomatis: simpan pengaturan & jalan satu langkah ---------- */
      var amSaveBtn = document.getElementById('stAmSave');
      if(amSaveBtn){
        amSaveBtn.onclick = async function(){
          try {
            await SIKAPI.put('/storage/automig', {
              enabled: document.getElementById('stAmEnabled').value === '1',
              batch: parseInt(document.getElementById('stAmBatch').value, 10),
              intervalSecs: parseInt(document.getElementById('stAmInt').value, 10)
            });
            showToast('Migrasi otomatis disimpan — berjalan bertahap di latar belakang.', 'success');
          } catch(e){ showToast(e.message, 'danger'); }
        };
      }
      var amRunBtn = document.getElementById('stAmRun');
      if(amRunBtn){
        amRunBtn.onclick = async function(){
          amRunBtn.disabled = true;
          try {
            var r = await SIKAPI.post('/storage/automig-run', {});
            var x = r.result || {};
            if(x.ok) showToast('Batch: ' + x.okN + '/' + x.batch + ' berhasil — total tersalin ' + x.done + '.', x.okN === x.batch ? 'success' : 'danger');
            else showToast(x.reason ? 'Dilewati: ' + x.reason : (x.error || 'Tidak ada yang dikerjakan.'), 'danger');
          } catch(e){ showToast(e.message, 'danger'); }
          amRunBtn.disabled = false;
        };
      }


      /* Favicon upload */
      var favFi = document.getElementById('favFile');
      if(favFi){
        favFi.onchange = function(){
          var file = favFi.files && favFi.files[0];
          if(!file) return;
          if(file.size > 200 * 1024){ showToast('Favicon maksimal 200 KB.', 'danger'); favFi.value=''; return; }
          var rd = new FileReader();
          rd.onload = async function(){
            try {
              await SIKAPI.uploadJSON('/settings/logo', { kind: 'favicon', dataUrl: rd.result });
              var prev = document.getElementById('favPrev');
              if(prev) prev.innerHTML = '<img src="uploads-favicon" style="width:100%;height:100%;object-fit:contain;">'.replace('uploads-favicon', rd.result);
              showToast('Favicon diperbarui — refresh tab untuk melihat.', 'success');
            } catch(e){ showToast(e.message, 'danger'); }
          };
          rd.readAsDataURL(file);
        };
      }

      var heroFi = document.getElementById('heroFile');
      heroFi.onchange = function(){
        var file = heroFi.files && heroFi.files[0];
        if(!file) return;
        if(file.size > 512 * 1024){ showToast('Ukuran maksimal 512 KB.', 'danger'); heroFi.value=''; return; }
        var rd = new FileReader();
        rd.onload = async function(){
          try {
            await SIKAPI.uploadJSON('/settings/logo', { kind: 'hero', dataUrl: rd.result });
            showToast('Background hero diperbarui.', 'success');
            VIEWS.pengaturan(document.getElementById('dashContent'), ROLE, SESSION_USER);
          } catch(e){ showToast(e.message, 'danger'); }
        };
        rd.readAsDataURL(file);
      };
      var heroDel = document.getElementById('heroDel');
      if(heroDel){
        heroDel.onclick = async function(){
          try {
            var p2 = {}; p2.hero_bg = '';
            await SIKAPI.put('/settings', p2);
            showToast('Background kembali ke fallback gratis.', 'success');
            VIEWS.pengaturan(document.getElementById('dashContent'), ROLE, SESSION_USER);
          } catch(e){ showToast(e.message, 'danger'); }
        };
      }

      document.getElementById('stSave').onclick = async function(){
        try {
          var payload = {
            org_nama: document.getElementById('stNama').value,
            org_wilayah: document.getElementById('stWil').value,
            hero_bg: document.getElementById('stHeroBg').value.trim()
          };
          var fk = document.getElementById('stFonnte');
          if(fk && !/••••/.test(fk.value)) payload.fonnte_api_key = fk.value.trim();
          payload.telegram_bot_token = document.getElementById('stTgToken').value.trim();
          payload.telegram_chat_id = document.getElementById('stTgChat').value.trim();
          payload.smtp_host = document.getElementById('stSmtpHost').value.trim();
          payload.smtp_port = document.getElementById('stSmtpPort').value.trim() || '587';
          payload.smtp_user = document.getElementById('stSmtpUser').value.trim();
          payload.smtp_pass = document.getElementById('stSmtpPass').value;
          payload.demo_accounts = document.getElementById('stDemoAccounts').value;
          await SIKAPI.put('/settings', payload);
          showToast('Pengaturan disimpan.', 'success');
        } catch(e){ showToast(e.message, 'danger'); }
      };

      /* ---------- Reset ke default & abadikan default ---------- */
      var resetDef = document.getElementById('stResetDefault');
      if(resetDef){
        resetDef.onclick = async function(){
          if(!confirm('Pulihkan SEMUA pengaturan ke tatanan default tersimpan?\n\nSemua perubahan setelah default diabadikan akan HILANG — termasuk logo, tema, konten halaman, kredensial gateway, dan beban sistem.\n\nLanjutkan?')) return;
          resetDef.disabled = true;
          try {
            var r = await SIKAPI.post('/settings/reset', {});
            showToast(r.message || 'Pengaturan dipulihkan ke default.', 'success', 5200);
            return VIEWS.pengaturan(host, role);
          } catch(e){
            showToast(e.message, 'danger', 6500);
            resetDef.disabled = false;
          }
        };
      }
      var setDef = document.getElementById('stSetDefault');
      if(setDef){
        setDef.onclick = async function(){
          if(!confirm('Abadikan tatanan pengaturan tersimpan saat ini sebagai default? Reset berikutnya akan memulihkan tatanan ini.')) return;
          setDef.disabled = true;
          try {
            var r = await SIKAPI.post('/settings/default-set', {});
            showToast(r.message || 'Default diabadikan.', 'success', 5200);
            var info = document.getElementById('stDefaultInfo');
            if(info) info.textContent = 'Default diabadikan baru saja oleh Anda';
          } catch(e){ showToast(e.message, 'danger', 6500); }
          setDef.disabled = false;
        };
      }
      var waTest = document.getElementById('stWaTest');
      if(waTest){
        waTest.onclick = async function(){
          var to = (document.getElementById('stWaTestTo') || {}).value || '';
          if(!to.trim()){ showToast('Isi dulu nomor WhatsApp tujuan uji.', 'danger'); return; }
          waTest.disabled = true; waTest.textContent = 'Mengirim…';
          try {
            var fk = document.getElementById('stFonnte');
            if(fk && !/••••/.test(fk.value)) await SIKAPI.put('/settings', { fonnte_api_key: fk.value.trim() });
            var r = await SIKAPI.post('/settings/wa-test', { target: to });
            showToast(r.ok ? ('Terkirim! ' + (r.detail || '')) : ('Gagal: ' + (r.error || 'tidak diketahui')), r.ok ? 'success' : 'danger', 5000);
            SIKAPI.get('/settings/gateway-status', { noRedirect: true }).then(function(g){ if(window._gwRender) window._gwRender(g && g.data); }).catch(function(){});
          } catch(e){ showToast(e.message, 'danger', 5000); }
          waTest.disabled = false; waTest.textContent = 'Kirim uji WhatsApp';
        };
      }

      /* Uji kirim email (SMTP) — simpan konfigurasi dulu agar yang diuji persis isi form */
      var smtpTest = document.getElementById('stSmtpTest');
      if(smtpTest){
        smtpTest.onclick = async function(){
          var to = (document.getElementById('stSmtpTestTo') || {}).value || '';
          if(!to.trim()){ showToast('Isi dulu alamat email tujuan uji.', 'danger'); return; }
          smtpTest.disabled = true; smtpTest.textContent = 'Mengirim…';
          try {
            await SIKAPI.put('/settings', {
              smtp_host: document.getElementById('stSmtpHost').value.trim(),
              smtp_port: document.getElementById('stSmtpPort').value.trim() || '587',
              smtp_user: document.getElementById('stSmtpUser').value.trim(),
              smtp_pass: document.getElementById('stSmtpPass').value
            });
            var r = await SIKAPI.post('/settings/smtp-test', { to: to });
            showToast(r.ok ? ('Terkirim! ' + (r.detail || '')) : ('Gagal: ' + (r.error || 'tidak diketahui')), r.ok ? 'success' : 'danger', 5000);
            SIKAPI.get('/settings/gateway-status', { noRedirect: true }).then(function(g){ if(window._gwRender) window._gwRender(g && g.data); }).catch(function(){});
          } catch(e){ showToast(e.message, 'danger', 5000); }
          smtpTest.disabled = false; smtpTest.textContent = 'Kirim uji email';
        };
      }

      var tgTest = document.getElementById('stTgTest');
      if(tgTest){
        tgTest.onclick = async function(){
          tgTest.disabled = true; tgTest.textContent = 'Mengirim…';
          try {
            await SIKAPI.put('/settings', {
              telegram_bot_token: document.getElementById('stTgToken').value.trim(),
              telegram_chat_id: document.getElementById('stTgChat').value.trim()
            });
            var to = (document.getElementById('stTgTestTo') || {}).value || '';
            var r = to.trim()
              ? await SIKAPI.post('/settings/otp-test', { target: to.trim(), channel: 'telegram' })
              : await SIKAPI.post('/settings/telegram-test', {});
            showToast(r.ok ? ('Terkirim! ' + (r.detail || '')) : ('Gagal: ' + (r.error || 'tidak diketahui')), r.ok ? 'success' : 'danger', 6000);
            SIKAPI.get('/settings/gateway-status', { noRedirect: true }).then(function(g){ if(window._gwRender) window._gwRender(g && g.data); }).catch(function(){});
          } catch(e){ showToast(e.message, 'danger'); }
          tgTest.disabled = false; tgTest.textContent = 'Kirim uji Telegram';
        };
      }

      ['dashboard','landing'].forEach(function(kind){
        var fi = document.getElementById('lgFile-' + kind);
        if(!fi) return;
        fi.onchange = async function(){
          var file = fi.files && fi.files[0];
          if(!file) return;
          if(file.size > 512 * 1024){ showToast('Ukuran maksimal 512 KB.', 'danger'); fi.value=''; return; }
          var rd = new FileReader();
          rd.onload = async function(){
            try {
              var r = await SIKAPI.uploadJSON('/settings/logo', { kind: kind, dataUrl: rd.result });
              var prev = document.getElementById('lgPrev-' + kind);
              if(prev) prev.innerHTML = '<img src="' + r.path + '?v=' + Date.now() + '" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
              showToast('Logo ' + kind + ' diperbarui — langsung aktif di semua halaman.', 'success');
            } catch(e){ showToast(e.message, 'danger'); }
          };
          rd.readAsDataURL(file);
        };
        var del = document.getElementById('lgDel-' + kind);
        if(del) del.onclick = async function(){
          try {
            var payload = {}; payload['logo_' + kind] = '';
            await SIKAPI.put('/settings', payload);
            var prev = document.getElementById('lgPrev-' + kind);
            if(prev) prev.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5V11c0 5.2 3.6 9.9 9 11 5.4-1.1 9-5.8 9-11V6.5L12 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
            del.remove();
            showToast('Logo dihapus — kembali ke default.', 'success');
          } catch(e){ showToast(e.message, 'danger'); }
        };
      });
    },

    /* Helper: tandai satu pengumuman dibaca (klik item di beranda anggota) */
    _pgMarkOne: async function(id, el){
      try {
        await SIKAPI.post('/pengumuman/' + id + '/read', {});
        if(el){ el.classList.remove('is-new'); var m = el.querySelector('.tl-mark'); if(m) m.remove(); var n = el.querySelector('.tl-new'); if(n) n.remove(); }
        if(window.UI && typeof UI.refreshBadges === 'function') UI.refreshBadges();
        showToast('Pengumuman ditandai dibaca.', 'success');
      } catch(e){ showToast(e.message, 'danger'); }
      return false;
    },

    /* Helper: tandai semua pengumuman dibaca (link di beranda anggota) */
    _pgMarkRead: async function(){
      try {
        var r = await SIKAPI.post('/pengumuman/read', {});
        if(window.UI && typeof UI.refreshBadges === 'function') UI.refreshBadges();
        var host = document.getElementById('dashContent');
        var me = window.SIKAPI && SIKAPI.user();
        if(host && me) window.VIEWS.home(host, 'anggota', me);
        showToast('Pengumuman ditandai dibaca (' + ((r && r.updated) || 0) + ')', 'success');
      } catch(e){ showToast(e.message, 'danger'); }
      return false;
    }
  };
})();
