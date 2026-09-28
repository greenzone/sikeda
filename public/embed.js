/* ============================================================
   SIKEDA — Widget formulir pendaftaran embeddable
   Pakai di website mana pun:

     <div id="sikeda-daftar"></div>
     <script src="https://ALAMAT-PORTAL:4321/embed.js"></script>
     <script>sikedaDaftar('sikeda-daftar');</script>

   Semua style di-scope di bawah .sikeda-embed — tidak mengganggu
   CSS host. Data tetap masuk ke database website utama.
   ============================================================ */
(function(){
  'use strict';

  /* Portal = asal tempat embed.js dimuat */
  var PORTAL = (function(){
    var s = document.currentScript && document.currentScript.src;
    if(!s) return 'http://localhost:4321';
    var a = document.createElement('a'); a.href = s;
    return a.protocol + '//' + a.host;
  })();

  window.sikedaDaftar = function(targetSel){
    var root = typeof targetSel === 'string' ? document.querySelector(targetSel) : targetSel;
    if(!root) return;
    root.classList.add('sikeda-embed');

    var css = document.createElement('style');
    css.textContent =
      '.sikeda-embed{--sd-navy:#081120;--sd-navy2:#122544;--sd-gold:#dda52e;--sd-paper:#f6f4ee;--sd-line:#ded7c6;--sd-ink:#131a24;--sd-soft:#54606f;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Plus Jakarta Sans",sans-serif;color:var(--sd-ink);max-width:560px;margin:0 auto;' +
      'background:#fff;border:1px solid var(--sd-line);border-radius:20px;box-shadow:0 18px 40px -22px rgba(12,26,48,.28);overflow:hidden;}' +
      '.sikeda-embed *{box-sizing:border-box;}' +
      '.sd-head{background:linear-gradient(150deg,var(--sd-navy2),var(--sd-navy) 70%);color:#fff;padding:22px 24px;}' +
      '.sd-head h3{margin:0;font-size:1.15rem;letter-spacing:-.02em;}' +
      '.sd-head p{margin:6px 0 0;font-size:.8rem;color:rgba(238,242,248,.72);line-height:1.5;}' +
      '.sd-body{padding:22px 24px;display:grid;gap:13px;}' +
      '.sd-f label{display:block;font-size:.76rem;font-weight:700;margin-bottom:5px;}' +
      '.sd-f input,.sd-f select{width:100%;height:44px;border:1.5px solid var(--sd-line);border-radius:11px;padding:0 12px;font-size:.9rem;font-family:inherit;background:#fff;outline:none;}' +
      '.sd-f input:focus,.sd-f select:focus{border-color:var(--sd-navy2);box-shadow:0 0 0 3px rgba(18,37,68,.12);}' +
      '.sd-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
      '.sd-btn{grid-column:1/-1;height:50px;border:none;border-radius:13px;background:linear-gradient(140deg,#eac06a,#dda52e);color:#081120;font-weight:800;font-size:.95rem;cursor:pointer;font-family:inherit;}' +
      '.sd-btn:disabled{opacity:.55;cursor:wait;}' +
      '.sd-note{grid-column:1/-1;font-size:.72rem;color:var(--sd-soft);text-align:center;line-height:1.5;}' +
      '.sd-ok{text-align:center;padding:34px 22px;}' +
      '.sd-ok .tick{width:64px;height:64px;border-radius:22px;background:#e2f4ea;color:#1e8a55;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px;}' +
      '.sd-ok h4{margin:0 0 6px;font-size:1.1rem;}' +
      '.sd-ok .tiket{font-family:ui-monospace,monospace;font-weight:700;color:var(--sd-navy2);}' +
      '@media(max-width:480px){.sd-2{grid-template-columns:1fr;}}';
    document.head.appendChild(css);

    root.innerHTML =
      '<div class="sd-head"><h3>Pendaftaran Anggota</h3>' +
      '<p>DPD Nusantara Bersatu — Kab. Tulungagung.<br>Isi data dengan benar; verifikasi dilakukan pengurus dalam 1–2 hari kerja.</p></div>' +
      '<form class="sd-body" id="sdForm" autocomplete="off">' +
      '<div class="sd-f"><label>Nama lengkap *</label><input name="nama" required minlength="3"></div>' +
      '<div class="sd-2">' +
      '<div class="sd-f"><label>NIK *</label><input name="nik" required maxlength="16" inputmode="numeric" placeholder="16 digit"></div>' +
      '<div class="sd-f"><label>Jenis kelamin *</label><select name="gender" required><option value="">— pilih —</option><option>Laki-laki</option><option>Perempuan</option></select></div>' +
      '</div>' +
      '<div class="sd-2">' +
      '<div class="sd-f"><label>Tempat lahir</label><input name="tempat_lahir"></div>' +
      '<div class="sd-f"><label>Tanggal lahir</label><input name="tanggal_lahir" type="date"></div>' +
      '</div>' +
      '<div class="sd-f"><label>Pekerjaan</label><input name="pekerjaan"></div>' +
      '<div class="sd-2">' +
      '<div class="sd-f"><label>Kecamatan *</label><select name="kecamatan" id="sdKec" required><option value="">memuat…</option></select></div>' +
      '<div class="sd-f"><label>Desa *</label><select name="desa" id="sdDesa" required><option value="">—</option></select></div>' +
      '</div>' +
      '<div class="sd-f"><label>Alamat</label><input name="alamat"></div>' +
      '<div class="sd-2">' +
      '<div class="sd-f"><label>WhatsApp *</label><input name="whatsapp" required inputmode="numeric" placeholder="08…"></div>' +
      '<div class="sd-f"><label>Email</label><input name="email" type="email"></div>' +
      '</div>' +
      '<div class="sd-f"><label>Telegram (opsional)</label><input name="telegram" placeholder="@username / chat id"></div>' +
      '<button class="sd-btn" type="submit">Kirim Pendaftaran</button>' +
      '<div class="sd-note" id="sdErr" style="color:#bb4332;display:none;"></div>' +
      '<div class="sd-note">Data terkirim ke sistem keanggotaan resmi (SIKEDA). Status pengajuan dinotifikasikan via WhatsApp/Telegram/Email.</div>' +
      '</form>';

    /* Wilayah dari portal */
    var WIL = {};
    fetch(PORTAL + '/api/public/branding').catch(function(){ return null; });
    fetch(PORTAL + '/api/public/wilayah').then(function(r){ return r.json(); }).then(function(j){
      WIL = j.data || {};
      var kec = document.getElementById('sdKec');
      kec.innerHTML = '<option value="">— pilih —</option>' + Object.keys(WIL).map(function(k){ return '<option>' + k + '</option>'; }).join('');
      kec.onchange = function(){
        var d = document.getElementById('sdDesa');
        d.innerHTML = '<option value="">— pilih —</option>' + (WIL[kec.value] || []).map(function(x){ return '<option>' + x + '</option>'; }).join('');
      };
    }).catch(function(){});

    function showErr(msg){
      var el = document.getElementById('sdErr');
      if(el){ el.textContent = msg; el.style.display = 'block'; }
    }
    function clearErr(){
      var el = document.getElementById('sdErr');
      if(el){ el.textContent = ''; el.style.display = 'none'; }
    }

    document.getElementById('sdForm').onsubmit = function(e){
      e.preventDefault();
      clearErr();
      var f = e.target, btn = f.querySelector('.sd-btn');
      var val = function(n){ return f.elements[n].value.trim(); };
      if(val('nik').replace(/\D/g,'').length !== 16){ showErr('NIK harus tepat 16 digit.'); return; }
      if(!val('nama') || val('nama').length < 3){ showErr('Nama minimal 3 karakter.'); return; }
      btn.disabled = true; btn.textContent = 'Mengirim…';
      fetch(PORTAL + '/api/daftar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: val('nama'), nik: val('nik'), gender: val('gender'),
          tempat_lahir: val('tempat_lahir'), tanggal_lahir: val('tanggal_lahir'),
          pekerjaan: val('pekerjaan'), kecamatan: val('kecamatan'), desa: val('desa'),
          alamat: val('alamat'), whatsapp: val('whatsapp'), telegram: val('telegram'), email: val('email')
        })
      }).then(function(r){ return r.json().then(function(j){ return { code: r.status, j: j }; });      }).then(function(res){
        if(!res.j.ok){
          btn.disabled = false; btn.textContent = 'Kirim Pendaftaran';
          showErr('Gagal: ' + (res.j.error || ('HTTP ' + res.code)));
          return;
        }
        root.innerHTML =
          '<div class="sd-ok"><div class="tick">✓</div><h4>Pendaftaran terkirim!</h4>' +
          '<p style="margin:0;font-size:.86rem;color:var(--sd-soft);">Nomor tiket Anda<br><span class="tiket">' + res.j.kode_unik + '</span></p>' +
          '<p style="margin:12px 0 0;font-size:.78rem;color:var(--sd-soft);">Simpan nomor ini. Notifikasi verifikasi dikirim ke kontak Anda.</p></div>';
      }).catch(function(err){
        btn.disabled = false; btn.textContent = 'Kirim Pendaftaran';
        showErr('Gagal: ' + err.message);
      });
    };
  };
})();
