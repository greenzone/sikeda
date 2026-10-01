/* ============================================================
   SIKEDA — Widget formulir pendaftaran embeddable
   Pakai di website mana pun:

     <div id="sikeda-daftar"></div>
     <script src="https://ALAMAT-PORTAL:4321/embed.js"></script>
     <script>sikedaDaftar('sikeda-daftar');</script>

   Semua style di-scope di bawah .sikeda-embed — tidak mengganggu
   CSS host. Data tetap masuk ke database website utama.
   Daftar field mengikuti pengaturan dinamis dari dashboard
   (/api/public/reg-fields) — field tambahan ikut tampil.
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

  /* Field inti (default) — label/wajib/aktif bisa dioverride konfigurasi */
  var BASE_FIELDS = [
    { key:'nama',          label:'Nama lengkap',        type:'text',   required:true,  active:true, locked:true,  full:true },
    { key:'nik',           label:'NIK',                 type:'text',   required:true,  active:true, locked:true },
    { key:'gender',        label:'Jenis kelamin',       type:'select', required:true,  active:true, locked:true, options:['Laki-laki','Perempuan'] },
    { key:'tempat_lahir',  label:'Tempat lahir',        type:'text',   required:false, active:true },
    { key:'tanggal_lahir', label:'Tanggal lahir',       type:'date',   required:false, active:true },
    { key:'pekerjaan',     label:'Pekerjaan',           type:'text',   required:false, active:true, full:true },
    { key:'kecamatan',     label:'Kecamatan',           type:'wilayah',required:true,  active:true, locked:true },
    { key:'desa',          label:'Desa',                type:'wilayah',required:true,  active:true, locked:true },
    { key:'alamat',        label:'Alamat',              type:'text',   required:false, active:true, full:true },
    { key:'whatsapp',      label:'WhatsApp',            type:'tel',    required:true,  active:true, locked:true },
    { key:'email',         label:'Email',               type:'email',  required:false, active:true },
    { key:'telegram',      label:'Telegram (opsional)', type:'text',   required:false, active:true, full:true }
  ];
  var PLACEHOLDERS = { nik:'16 digit', whatsapp:'08…', telegram:'@username / chat id', alamat:'Nama jalan, RT/RW' };

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
      '.sd-f input,.sd-f select,.sd-f textarea{width:100%;min-height:44px;border:1.5px solid var(--sd-line);border-radius:11px;padding:10px 12px;font-size:.9rem;font-family:inherit;background:#fff;outline:none;}' +
      '.sd-f textarea{resize:vertical;}' +
      '.sd-f input:focus,.sd-f select:focus,.sd-f textarea:focus{border-color:var(--sd-navy2);box-shadow:0 0 0 3px rgba(18,37,68,.12);}' +
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
      '<div id="sdFields" style="display:contents;"></div>' +
      '<button class="sd-btn" type="submit">Kirim Pendaftaran</button>' +
      '<div class="sd-note" id="sdErr" style="color:#bb4332;display:none;"></div>' +
      '<div class="sd-note">Data terkirim ke sistem keanggotaan resmi (SIKEDA). Status pengajuan dinotifikasikan via WhatsApp/Telegram/Email.</div>' +
      '</form>';

    var esc = function(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };

    /* ---------- Bangun daftar field aktif (inti + tambahan) ---------- */
    var FIELDS = BASE_FIELDS.slice();
    fetch(PORTAL + '/api/public/reg-fields').then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if(!j || !j.ok || !Array.isArray(j.data)) return;
      /* override atribut field inti dari konfigurasi */
      j.data.forEach(function(f){
        var b = FIELDS.find(function(x){ return x.key === f.key; });
        if(b){
          b.label = f.label || b.label;
          b.required = b.locked ? b.required : !!f.required;
          b.active = b.locked ? true : f.active !== false;
          b.options = f.options && f.options.length ? f.options : b.options;
          b.placeholder = f.placeholder || b.placeholder;
        } else if(String(f.key).indexOf('reg_extra_') === 0){
          FIELDS.push({ key:f.key, label:f.label, type:f.type || 'text', required:!!f.required, active:true, options:f.options, placeholder:f.placeholder, half:true });
        }
      });
      renderFields();
    }).catch(function(){ renderFields(); });

    function fieldHtml(f){
      var id = 'sd_' + f.key;
      var req = f.required ? ' required' : '';
      var star = f.required ? ' *' : '';
      var ph = f.placeholder || PLACEHOLDERS[f.key] || '';
      var inner;
      if(f.type === 'select'){
        inner = '<select name="' + f.key + '" id="' + id + '"' + req + '><option value="">— pilih —</option>' +
          (f.options || []).map(function(o){ return '<option>' + esc(o) + '</option>'; }).join('') + '</select>';
      } else if(f.type === 'textarea'){
        inner = '<textarea name="' + f.key + '" id="' + id + '" rows="2"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + req + '></textarea>';
      } else if(f.type === 'wilayah'){
        inner = f.key === 'kecamatan'
          ? '<select name="kecamatan" id="sdKec"' + req + '><option value="">memuat…</option></select>'
          : '<select name="desa" id="sdDesa"' + req + ' disabled><option value="">—</option></select>';
      } else {
        var t = f.type === 'email' ? 'email' : (f.type === 'tel' ? 'tel' : (f.type === 'date' ? 'date' : (f.type === 'number' ? 'number' : 'text')));
        inner = '<input name="' + f.key + '" id="' + id + '" type="' + t + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') +
          (f.key === 'nik' ? ' maxlength="16" inputmode="numeric"' : '') + (f.key === 'whatsapp' ? ' inputmode="numeric"' : '') + req + '>';
      }
      return '<div class="sd-f"><label for="' + id + '">' + esc(f.label) + star + '</label>' + inner + '</div>';
    }

    function renderFields(){
      var host = document.getElementById('sdFields');
      if(!host) return;
      var act = FIELDS.filter(function(f){ return f.active !== false; });
      var html = '', pair = [];
      function flush(){
        if(pair.length === 1) html += '<div class="sd-2">' + pair[0] + '<div></div></div>';
        else if(pair.length) html += '<div class="sd-2">' + pair.join('') + '</div>';
        pair = [];
      }
      act.forEach(function(f){
        if(f.full){ flush(); html += fieldHtml(f); return; }
        pair.push(fieldHtml(f));
        if(pair.length === 2) flush();
      });
      flush();
      host.innerHTML = html;
      wireWilayah();
    }

    /* ---------- Wilayah dari portal ---------- */
    function wireWilayah(){
      var kec = document.getElementById('sdKec');
      var desa = document.getElementById('sdDesa');
      if(!kec) return;
      fetch(PORTAL + '/api/public/wilayah').then(function(r){ return r.json(); }).then(function(j){
        var WIL = (j && j.data) || {};
        kec.innerHTML = '<option value="">— pilih —</option>' + Object.keys(WIL).map(function(k){ return '<option>' + esc(k) + '</option>'; }).join('');
        kec.onchange = function(){
          desa.innerHTML = '<option value="">— pilih —</option>' + (WIL[kec.value] || []).map(function(x){ return '<option>' + esc(x) + '</option>'; }).join('');
          desa.disabled = !kec.value;
        };
      }).catch(function(){});
    }
    wireWilayah();

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
      var val = function(n){ var el = f.elements[n]; return el ? el.value.trim() : ''; };
      var body = {};
      FIELDS.forEach(function(f2){
        if(f2.active !== false && f2.type !== 'wilayah') body[f2.key] = val(f2.key);
      });
      body.kecamatan = val('kecamatan'); body.desa = val('desa');
      if(body.nik && body.nik.replace(/\D/g,'').length !== 16){ showErr('NIK harus tepat 16 digit.'); return; }
      if('nama' in body && (!body.nama || body.nama.length < 3)){ showErr('Nama minimal 3 karakter.'); return; }
      btn.disabled = true; btn.textContent = 'Mengirim…';
      fetch(PORTAL + '/api/daftar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
