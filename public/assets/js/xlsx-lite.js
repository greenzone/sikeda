/* SIKEDA — pembaca .xlsx ringan (zip inflate + sheet1 XML).
   Cukup untuk template import: sheet pertama, nilai sel tanpa formula. */
(function(){
  'use strict';

  /* ---------- inflate (DEFLATE) + penyimpanan ---------- */
  function inflateRaw(u8){
    var pos = 0;
    function bits(n){
      var v = 0;
      for(var i = 0; i < n; i++){
        var byte = u8[pos >> 3], bit = (byte >> (pos & 7)) & 1;
        v |= bit << i; pos++;
      }
      return v;
    }
    var out = [];
    var L = new Uint8Array(32768), D = new Uint8Array(32768);
    var lbase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
    var lext  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    var dbase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
    var dext  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    var CL = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

    function buildTree(lengths){
      var maxLen = Math.max.apply(null, lengths);
      var bl = new Array(maxLen + 1).fill(0);
      lengths.forEach(function(l){ if(l) bl[l]++; });
      var next = []; var code = 0; bl[0] = 0;
      for(var b = 1; b <= maxLen; b++){ code = (code + bl[b-1]) << 1; next[b] = code; }
      var map = {};
      lengths.forEach(function(l, i){
        if(!l) return;
        var c = next[l]++;
        var str = c.toString(2).padStart(l, '0').split('').reverse().join('');
        map[str] = i;
      });
      return { map: map, max: maxLen };
    }
    function decodeSym(tree){
      var s = '';
      for(var l = 1; l <= tree.max; l++){
        s += bits(1);
        if(tree.map[s] !== undefined) return tree.map[s];
      }
      throw new Error('kode huffman tidak valid');
    }

    for(;;){
      var last = bits(1);
      var type = bits(2);
      if(type === 0){
        pos = (pos + 7) & ~7;
        var len = u8[pos >> 3] | (u8[(pos >> 3) + 1] << 8); pos += 16;
        pos += 16; /* skip nlen */
        for(var i = 0; i < len; i++) out.push(u8[pos >> 3]); pos += 8;
      } else if(type === 1){
        var litTree = buildTree(new Array(144).fill(8).concat(new Array(112).fill(9)));
        var distTree = buildTree(new Array(30).fill(5));
        inflateBlock(litTree, distTree);
      } else if(type === 2){
        var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        var clLens = new Array(19).fill(0);
        for(var c = 0; c < hclen; c++) clLens[CL[c]] = bits(3);
        var clTree = buildTree(clLens);
        var lens = [];
        while(lens.length < hlit + hdist){
          var sym = decodeSym(clTree);
          if(sym < 16) lens.push(sym);
          else if(sym === 16){ var r = 3 + bits(2); while(r--) lens.push(lens[lens.length-1]); }
          else if(sym === 17){ var r2 = 3 + bits(3); while(r2--) lens.push(0); }
          else { var r3 = 11 + bits(7); while(r3--) lens.push(0); }
        }
        inflateBlock(buildTree(lens.slice(0, hlit)), buildTree(lens.slice(hlit)));
      } else {
        throw new Error('blok terkompresi tidak valid');
      }
      if(last) break;
    }
    function inflateBlock(lt, dt){
      for(;;){
        var sym = decodeSym(lt);
        if(sym < 256){ out.push(sym); }
        else if(sym === 256){ return; }
        else {
          var li = sym - 257;
          var length = lbase[li] + bits(lext[li]);
          var di = decodeSym(dt);
          var dist = dbase[di] + bits(dext[di]);
          for(var k = 0; k < length; k++) out.push(out[out.length - dist]);
        }
      }
    }
    return new Uint8Array(out);
  }

  /* ---------- zip entry extraction ---------- */
  function zipEntry(u8, wantName){
    var i = 0;
    while(i < u8.length - 4){
      if(u8[i] === 0x50 && u8[i+1] === 0x4b && (u8[i+2] === 3 || u8[i+2] === 5)){ /* LFH / LFH64 flag area */
        /* Local file header: PK\x03\x04 */
        if(u8[i+2] === 3){
          var method = u8[i+8] | (u8[i+9] << 8);
          var csize = u8[i+18] | (u8[i+19]<<8) | (u8[i+20]<<16) | (u8[i+21]<<24);
          var nameLen = u8[i+26] | (u8[i+27] << 8);
          var extraLen = u8[i+28] | (u8[i+29] << 8);
          var name = '';
          for(var n = 0; n < nameLen; n++) name += String.fromCharCode(u8[i+30+n]);
          if(name === wantName){
            var start = i + 30 + nameLen + extraLen;
            var data = u8.slice(start, start + csize);
            if(method === 0) return data;
            if(method === 8){
              /* raw deflate → beri offset agar pembacaan bit mulai dari byte penuh */
              return inflateRaw(data);
            }
            return null;
          }
          i = i + 30 + nameLen + extraLen + csize;
        } else i++;
      } else i++;
    }
    return null;
  }

  /* ---------- XML helpers ---------- */
  function colOf(ref){ var m = /^([A-Z]+)/.exec(ref || ''); return m ? m[1] : 'A'; }
  function unescXml(s){ return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&'); }
  function textOf(tag, xml){
    var m = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>').exec(xml);
    return m ? unescXml(m[1]) : '';
  }

  /**
   * Parse buffer xlsx → array of objects dari sheet pertama (baris 1 = header).
   */
  function parseXlsx(buf){
    var u8 = new Uint8Array(buf);
    var sheet = zipEntry(u8, 'xl/worksheets/sheet1.xml');
    var sharedRaw = zipEntry(u8, 'xl/sharedStrings.xml');
    var shared = [];
    if(sharedRaw){
      var s = new TextDecoder('utf-8').decode(sharedRaw);
      var re = /<si>([\s\S]*?)<\/si>/g, m;
      while((m = re.exec(s))){
        var parts = [];
        var tre = /<t[^>]*>([\s\S]*?)<\/t>/g, t2;
        while((t2 = tre.exec(m[1]))) parts.push(unescXml(t2[1]));
        shared.push(parts.join(''));
      }
    }
    if(!sheet) throw new Error('sheet1.xml tidak ditemukan — pastikan file .xlsx asli.');
    var xml = new TextDecoder('utf-8').decode(sheet);

    var rows = [];
    var rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g, rm;
    while((rm = rowRe.exec(xml))){
      var cells = {};
      var cellRe = /<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g, cm;
      while((cm = cellRe.exec(rm[1]))){
        var ref = cm[1], attrs = cm[2], inner = cm[3];
        var typeM = /t="([^"]+)"/.exec(attrs);
        var type = typeM ? typeM[1] : 'n';
        var v = textOf('v', inner);
        if(type === 's') v = shared[parseInt(v, 10)] || '';
        else if(type === 'inlineStr') v = textOf('is', inner);
        else v = unescXml(v);
        var colName = colOf(ref), colIdx = 0;
        for(var c = 0; c < colName.length; c++) colIdx = colIdx * 26 + (colName.charCodeAt(c) - 64);
        cells[colIdx - 1] = String(v).trim();
      }
      var width = 0; Object.keys(cells).forEach(function(k){ width = Math.max(width, +k + 1); });
      var arr = [];
      for(var i2 = 0; i2 < width; i2++) arr.push(cells[i2] || '');
      rows.push(arr);
    }
    if(!rows.length) return [];
    var header = rows[0].map(function(h){ return h.toLowerCase().replace(/\s+/g, '_'); });
    return rows.slice(1)
      .filter(function(r){ return r.some(function(c){ return c !== ''; }); })
      .map(function(r){
        var obj = {};
        header.forEach(function(h, i){ obj[h] = r[i] !== undefined ? r[i] : ''; });
        return obj;
      });
  }

  window.SIKXLSX = { parseXlsx: parseXlsx };
})();
