/* ============================================================
   SIKEDA — Shared utilities (vanilla JS, tanpa dependensi)
   ============================================================ */
(function(){
  'use strict';

  /* ---------- Mobile nav toggle (landing/appbar) ---------- */
  window.sikedaToggleMenu = function(btn){
    var header = btn.closest('.site-header');
    if(header) header.classList.toggle('menu-open');
  };

  /* ---------- Format & util ---------- */
  function pad2(n){ return String(n).padStart(2,'0'); }

  window.SIK = {
    pad2: pad2,

    /* Format angka ribuan gaya Indonesia: 12480 -> 12.480 */
    fmtNum: function(n){ return Number(n).toLocaleString('id-ID'); },

    /* 081234567890 -> 0812-3456-7890 */
    fmtPhone: function(v){
      var d = String(v||'').replace(/\D/g,'');
      if(d.length < 10) return v || '—';
      return d.slice(0,4) + '-' + d.slice(4,8) + '-' + d.slice(8);
    },

    todayISO: function(){ return new Date().toISOString().slice(0,10); },

    /* "2026-08-14" -> "14 Agu 2026" */
    fmtDate: function(iso){
      if(!iso) return '—';
      var BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      var p = String(iso).split('-');
      if(p.length < 3) return iso;
      return Number(p[2]) + ' ' + BULAN[Number(p[1])-1] + ' ' + p[0];
    },

    escape: function(s){
      return String(s==null?'':s).replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    },

    initials: function(name){
      return String(name||'?').trim().split(/\s+/).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    },

    /* Param query sederhana */
    param: function(name){
      return new URLSearchParams(location.search).get(name);
    }
  };

  /* ---------- Toast / snackbar ---------- */
  var toastHost = null;
  window.showToast = function(msg, type, ms){
    if(!toastHost){
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      document.body.appendChild(toastHost);
    }
    var icons = {
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      danger: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.innerHTML = '<span class="t-ic">' + (icons[type] || icons.info) + '</span><span>' + SIK.escape(msg) + '</span>';
    toastHost.appendChild(t);
    setTimeout(function(){
      t.classList.add('out');
      setTimeout(function(){ t.remove(); }, 260);
    }, ms || 3200);
  };

  /* ---------- Bottom sheet / modal ---------- */
  window.openSheet = function(html, opts){
    opts = opts || {};
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop' + (opts.centered ? ' centered' : '');
    bd.innerHTML = '<div class="sheet' + (opts.sheetClass ? ' ' + opts.sheetClass : '') + '" role="dialog" aria-modal="true">'
      + (opts.centered ? '' : '<div class="grabber"></div>')
      + html + '</div>';
    document.body.appendChild(bd);
    document.body.style.overflow = 'hidden';

    function close(){
      bd.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){ if(e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    bd.addEventListener('click', function(e){ if(e.target === bd) close(); });
    bd.querySelectorAll('[data-close]').forEach(function(el){
      el.addEventListener('click', close);
    });
    if(typeof opts.onOpen === 'function') opts.onOpen(bd);
    return { el: bd, close: close };
  };

  /* ---------- OTP: kotak 6 digit, auto pindah fokus ---------- */
  window.wireOtpInputs = function(container){
    var boxes = Array.prototype.slice.call((container||document).querySelectorAll('.otp-row input'));
    boxes.forEach(function(box, idx){
      box.addEventListener('input', function(){
        box.value = box.value.replace(/\D/g,'').slice(0,1);
        if(box.value && idx < boxes.length - 1) boxes[idx+1].focus();
      });
      box.addEventListener('keydown', function(e){
        if(e.key === 'Backspace' && !box.value && idx > 0) boxes[idx-1].focus();
        if(e.key === 'ArrowLeft' && idx > 0) boxes[idx-1].focus();
        if(e.key === 'ArrowRight' && idx < boxes.length-1) boxes[idx+1].focus();
      });
      box.addEventListener('paste', function(e){
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0, boxes.length);
        if(!text) return;
        boxes.forEach(function(b, i){ b.value = text[i] || ''; });
        boxes[Math.min(text.length, boxes.length-1)].focus();
      });
    });
    return boxes;
  };

  window.otpValue = function(container){
    return Array.prototype.slice.call((container||document).querySelectorAll('.otp-row input'))
      .map(function(b){ return b.value; }).join('');
  };

  /* ---------- Toggle kata sandi ---------- */
  window.wirePasswordToggle = function(btnId, inputId){
    var btn = document.getElementById(btnId);
    var input = document.getElementById(inputId);
    if(!btn || !input) return;
    btn.addEventListener('click', function(){
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  };

  /* ============================================================
     QR Code encoder — Mode Byte, EC level L/M, versi 1-6 (satu blok).
     Digambar sebagai SVG grid. Berbasis spesifikasi ISO/IEC 18004.
     ============================================================ */
  var QR = (function(){
    /* Galois field GF(256), polinomial primitif 0x11D */
    var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
    (function(){
      var x = 1;
      for(var i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x & 0x100) x ^= 0x11d; }
      for(var j=255;j<512;j++) EXP[j]=EXP[j-255];
    })();
    function gmul(a,b){ if(!a||!b) return 0; return EXP[LOG[a]+LOG[b]]; }

    /* Polinomial generator RS: hasil kali (x + α^i), i=0..degree-1.
       Dikembangkan ascending (index = derajat), lalu DIBALIK jadi descending
       (index 0 = koefisien x^degree) agar cocok dengan konsumsi LFSR/pembagian. */
    function rsGenPoly(degree){
      var poly=[1];
      for(var i=0;i<degree;i++){
        var next=new Array(poly.length+1).fill(0);
        for(var c=0;c<poly.length;c++){
          next[c+1] ^= poly[c];          /* x · poly   */
          next[c]   ^= gmul(poly[c], EXP[i]); /* α^i · poly */
        }
        poly=next;
      }
      return poly.reverse();
    }
    function rsEncode(data, degree){
      var gen=rsGenPoly(degree);
      var res=new Array(degree).fill(0);
      data.forEach(function(byte){
        var factor=byte ^ res.shift();
        res.push(0);
        for(var i=0;i<degree;i++) res[i]^=gmul(gen[i+1],factor);
      });
      return res;
    }

    /* Kapasitas data (mode byte) versi 1-6, semua satu blok RS */
    var CAP = { L:{1:19,2:34,3:55,4:80,5:108,6:136}, M:{1:16,2:28,3:44,4:62,5:84,6:108} };
    var EC_PER_BLOCK = { L:{1:7,2:10,3:15,4:20,5:26,6:36}, M:{1:10,2:14,3:20,4:28,5:40,6:50} };

    function pickVersion(nBytes, ecl){
      for(var v=1;v<=6;v++){ if(nBytes <= CAP[ecl][v]) return v; }
      return null;
    }

    function buildCodewords(dataBytes, ver, ecl){
      var dataCW = CAP[ecl][ver];
      var ecCount = EC_PER_BLOCK[ecl][ver];

      /* Bit: mode 0100, char count 8 bit (versi 1-9), data, terminator */
      var bits = [];
      function push(val,len){ for(var i=len-1;i>=0;i--) bits.push((val>>i)&1); }
      push(4,4);
      push(dataBytes.length,8);
      dataBytes.forEach(function(b){ push(b,8); });

      var capBits = dataCW*8;
      if(capBits - bits.length > 0) push(0, Math.min(4, capBits - bits.length));
      while(bits.length % 8 !== 0) bits.push(0);
      var pads=[0xEC,0x11], pi=0;
      while(bits.length < capBits){ push(pads[pi++ % 2],8); }

      var cw=[];
      for(var i=0;i<bits.length;i+=8){
        var v=0; for(var k=0;k<8;k++) v=(v<<1)|bits[i+k];
        cw.push(v);
      }
      return { data: cw, ec: rsEncode(cw, ecCount) };
    }

    function buildMatrix(text){
      var utf8 = new TextEncoder().encode(text);
      var ecl = pickVersion(utf8.length,'L') ? 'L' : (pickVersion(utf8.length,'M') ? 'M' : null);
      if(!ecl) return null;
      var ver = pickVersion(utf8.length, ecl);
      var parts = buildCodewords(Array.from(utf8), ver, ecl);
      var cw = parts.data.concat(parts.ec);

      var n = ver*4 + 17;
      var m=[];
      for(var r=0;r<n;r++) m.push(new Array(n).fill(null));

      /* Peta fungsi: true = modul non-data (tidak ikut masking & data placement)
         PENTING: urutan isi = finder -> alignment -> timing -> reserve format */
      var fnMap=[];
      for(var fr=0;fr<n;fr++) fnMap.push(new Array(n).fill(false));

      /* Finder patterns + separator */
      function setFinder(row,col){
        for(var r=-1;r<=7;r++) for(var c=-1;c<=7;c++){
          var rr=row+r, cc=col+c;
          if(rr<0||cc<0||rr>=n||cc>=n) continue;
          var ring = (r>=0&&r<=6&&(c===0||c===6)) || (c>=0&&c<=6&&(r===0||r===6));
          var core = r>=2&&r<=4&&c>=2&&c<=4;
          m[rr][cc] = ring||core;
          fnMap[rr][cc] = true;
        }
      }
      setFinder(0,0); setFinder(0,n-7); setFinder(n-7,0);

      /* Alignment patterns (versi 2-6: satu, di (18/22/26/30/34, sama)) */
      var alignPos = {2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34]}[ver] || [];
      alignPos.forEach(function(ar){
        alignPos.forEach(function(ac){
          var last = alignPos[alignPos.length-1];
          var overlap = (ar===6&&ac===6) || (ar===6&&ac===last&&ac>=n-8) || (ac===6&&ar===last&&ar>=n-8);
          if(overlap) return;
          for(var r=-2;r<=2;r++) for(var c=-2;c<=2;c++){
            m[ar+r][ac+c] = Math.max(Math.abs(r),Math.abs(c)) !== 1;
            fnMap[ar+r][ac+c] = true;
          }
        });
      });

      /* Timing patterns */
      for(var i=8;i<n-8;i++){
        if(m[6][i]===null){ m[6][i] = (i%2===0); }
        if(m[i][6]===null){ m[i][6] = (i%2===0); }
        fnMap[6][i] = true;
        fnMap[i][6] = true;
      }

      /* Cadangkan area format (biar tidak diisi data); nilai ditulis belakangan */
      for(var f=0;f<9;f++){
        if(m[8][f]===null) m[8][f]=false;
        if(m[f][8]===null) m[f][8]=false;
        fnMap[8][f] = true;
        fnMap[f][8] = true;
      }
      for(var g=0;g<8;g++){
        if(m[8][n-1-g]===null) m[8][n-1-g]=false;
        if(m[n-1-g][8]===null) m[n-1-g][8]=false;
        fnMap[8][n-1-g] = true;
        fnMap[n-1-g][8] = true;
      }

      /* Penempatan data zigzag */
      var bitIdx=0, totalBits=cw.length*8;
      function bitAt(i){ return (cw[i>>3] >> (7-(i&7))) & 1; }
      var upward=true;
      for(var col=n-1; col>0; col-=2){
        if(col===6) col--;
        for(var k=0;k<n;k++){
          var row = upward ? n-1-k : k;
          for(var cc=col; cc>=col-1; cc--){
            if(m[row][cc]===null){
              m[row][cc] = bitIdx<totalBits ? !!bitAt(bitIdx) : false;
              bitIdx++;
            }
          }
        }
        upward=!upward;
      }

      /* Mask 0: (baris+kolom) genap — hanya modul DATA (bukan function patterns) */
      for(var r2=0;r2<n;r2++) for(var c2=0;c2<n;c2++){
        if(!fnMap[r2][c2] && m[r2][c2]!==null){
          m[r2][c2] = m[r2][c2] !== ((r2+c2)%2===0);
        }
      }

      /* Format info: EC L(01)/M(00) + mask 0(000), sudah ter-BCH + mask 0x5412 */
      var fmtBits = ecl==='L' ? 0x77C4 : 0x7C94;
      function bit(i){ return ((fmtBits>>i)&1)===1; }
      /* Salinan 1 (kiri-atas): MSB di (8,0) → path sesuai ISO 18004 */
      for(var b=0;b<=5;b++) m[8][b]=bit(14-b);        /* F14..F9 */
      m[8][7]=bit(8); m[8][8]=bit(7); m[7][8]=bit(6); /* F8, F7, F6 */
      for(var b2=0;b2<6;b2++) m[5-b2][8]=bit(5-b2);   /* F5..F0 → (5,8)..(0,8) */
      /* Salinan 2: bawah-kiri (kolom 8) & kanan-atas (baris 8) */
      for(var b3=0;b3<8;b3++) m[n-1-b3][8]=bit(14-b3); /* F14..F7 */
      m[8][n-8]=bit(6);
      for(var b4=0;b4<6;b4++) m[8][n-7+b4]=bit(5-b4);  /* F5..F0 → (8,n-7)..(8,n-2) */
      /* Modul gelap permanen */
      m[n-8][8]=true;

      return { size:n, matrix:m, version:ver };
    }

    /* Render sebagai string SVG */
    function svg(text, opts){
      opts = opts || {};
      var built = buildMatrix(String(text));
      if(!built) return '';
      var n = built.size;
      var scale = opts.scale || 8, quiet = opts.quiet!=null ? opts.quiet : 2;
      var dim = (n + quiet*2) * scale;
      var rects='';
      for(var r=0;r<n;r++) for(var c=0;c<n;c++){
        if(built.matrix[r][c]){
          rects += '<rect x="'+((c+quiet)*scale)+'" y="'+((r+quiet)*scale)+'" width="'+scale+'" height="'+scale+'"/>';
        }
      }
      var fill = opts.dark || '#081120';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+dim+' '+dim+'" width="'+(opts.size||dim)+'" height="'+(opts.size||dim)+'" shape-rendering="crispEdges" role="img" aria-label="QR code">'
        + '<rect width="'+dim+'" height="'+dim+'" fill="'+(opts.light||'#ffffff')+'"/>'
        + '<g fill="'+fill+'">'+rects+'</g></svg>';
    }

    return { svg: svg };
  })();

  window.SIK.qr = QR.svg;
})();
