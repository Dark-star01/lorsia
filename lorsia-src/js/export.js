/* لورسيا — التصدير: TXT / MD / PDF + حفظ الملفات (متصفح أو بلاجن أندرويد) */
(function () {
  'use strict';

  function safeName(s) {
    var n = String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
    return (n || 'بدون عنوان').slice(0, 80);
  }

  function toBase64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  function nativeSaver() {
    var C = window.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LorsiaFileSaver) return C.Plugins.LorsiaFileSaver;
    return null;
  }

  // يرجع: {ok:true, where:'...'} أو {ok:false, cancelled:true} أو يرمي خطأ
  function saveFile(name, mime, bytes) {
    var native = nativeSaver();
    if (native) {
      return native.save({ filename: name, mime: mime, data: toBase64(bytes) }).then(function (r) {
        return { ok: true, where: (r && r.uri) || '' };
      }).catch(function (e) {
        if (e && /cancel/i.test(String(e.message || e))) return { ok: false, cancelled: true };
        throw e;
      });
    }
    return new Promise(function (res, rej) {
      try {
        var blob = new Blob([bytes], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name; a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
        res({ ok: true, where: 'التنزيلات' });
      } catch (e) { rej(e); }
    });
  }

  function utf8(str) { return new TextEncoder().encode(str); }
  function norm(t) { return String(t || '').replace(/\r\n?/g, '\n'); }

  function makeTXT(ch, text) { return utf8('\ufeff' + ch.title + '\n\n' + norm(text)); }
  function makeMD(ch, text) {
    // Markdown: العنوان + النص كما هو. السطر الفارغ يفصل الفقرات؛ نضيف مسافتين لحفظ الأسطر المفردة
    var body = norm(text).split('\n').map(function (l, i, a) {
      return (l.trim() && a[i + 1] !== undefined && a[i + 1].trim()) ? l + '  ' : l;
    }).join('\n');
    return utf8('# ' + ch.title + '\n\n' + body + '\n');
  }

  /* ---------- PDF ---------- */
  var libsPromise = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('تعذر تحميل ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (!libsPromise) {
      libsPromise = Promise.all([
        loadScript('js/lib/pdf-lib.min.js').then(function () { return loadScript('js/lib/fontkit.umd.min.js'); }),
        fetch('fonts/pdf-font.ttf').then(function (r) { if (!r.ok) throw new Error('الخط غير موجود'); return r.arrayBuffer(); })
      ]).then(function (r) { return { font: r[1] }; }).catch(function (e) { libsPromise = null; throw e; });
    }
    return libsPromise;
  }

  // تصنيف الحروف: R عربي/عبري، L لاتيني وأرقام، N محايد
  function cls(ch) {
    var c = ch.codePointAt(0);
    if ((c >= 0x0660 && c <= 0x0669) || (c >= 0x06F0 && c <= 0x06F9)) return 'L';
    if ((c >= 0x0590 && c <= 0x08FF) || (c >= 0xFB1D && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF)) {
      if (c === 0x060C || c === 0x061B || c === 0x061F || c === 0x06D4) return 'N'; // علامات الترقيم العربية محايدة
      return 'R';
    }
    if (/[0-9A-Za-z\u00C0-\u024F]/.test(ch)) return 'L';
    return 'N';
  }
  var MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' };

  // يقسّم الكلمة إلى مقاطع لكل منها اتجاه
  function segments(word) {
    var segs = [], prev = null;
    Array.from(word).forEach(function (ch) {
      var k = cls(ch);
      if (k === 'N') k = prev || 'N';
      if (!segs.length || segs[segs.length - 1].k !== k) {
        // المحايد في البداية يلتحق بما بعده
        if (segs.length && segs[segs.length - 1].k === 'N') segs[segs.length - 1].k = k;
        else segs.push({ k: k, t: '' });
      }
      segs[segs.length - 1].t += ch;
      prev = k;
    });
    if (!segs.length) segs.push({ k: 'N', t: word });
    return segs;
  }
  function paraDir(p) {
    for (var ch of p) { var k = cls(ch); if (k === 'R') return 'R'; if (k === 'L' && /[A-Za-z\u00C0-\u024F]/.test(ch)) return 'L'; }
    return 'R';
  }

  async function makePDF(ch, text) {
    var libs = await loadLibs();
    var PDFLib = window.PDFLib, fontkit = window.fontkit;
    var doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    var font = await doc.embedFont(libs.font, { subset: true });
    var fk = font.embedder && font.embedder.font;
    function clean(s) {
      if (!fk || !fk.hasGlyphForCodePoint) return s;
      return Array.from(s).map(function (c) { return (c === '\u200f' || c === '\u200e' || c === '\u200c' || c === '\u200d' || fk.hasGlyphForCodePoint(c.codePointAt(0))) ? c : '\u25A1'; }).join('');
    }
    var W = 595.28, H = 841.89, M = 56, size = 14, lh = 27, maxW = W - 2 * M;
    var pages = [], page, y;
    function newPage() { page = doc.addPage([W, H]); pages.push(page); y = H - M - 10; }
    function wid(t, sz) { return font.widthOfTextAtSize(t, sz || size); }
    var spaceW = wid(' ');
    newPage();

    // العنوان
    var tsegs = segments(clean(ch.title)), tsize = 22, tw = 0;
    var tRTL = paraDir(ch.title) === 'R';
    var titleParts = tRTL ? tsegs.slice().reverse() : tsegs;
    titleParts.forEach(function (s) { s.w = wid(s.k === 'R' && tRTL ? mir(s.t) : s.t, tsize); tw += s.w; });
    var tx = (W - Math.min(tw, maxW)) / 2;
    titleParts.forEach(function (s) { page.drawText(s.k === 'R' ? mir(s.t) : s.t, { x: tx, y: y, size: tsize, font: font }); tx += s.w; });
    y -= 16;
    page.drawLine({ start: { x: M, y: y }, end: { x: W - M, y: y }, thickness: 0.8, color: PDFLib.rgb(0.6, 0.6, 0.6) });
    y -= lh + 6;

    function mir(t) { return Array.from(t).map(function (c) { return MIRROR[c] || c; }).join(''); }

    function layoutPara(p) {
      var rtl = paraDir(p) === 'R';
      var ws = p.split(/[ \t\u00a0]+/).filter(Boolean).map(function (w) {
        w = clean(w);
        var segs = segments(w);
        var width = 0;
        segs.forEach(function (s) { s.d = (s.k === 'R') ? mir(s.t) : s.t; s.w = wid(s.d); width += s.w; });
        var main = segs.some(function (s) { return s.k === 'R'; }) ? 'R' : (segs.some(function (s) { return s.k === 'L'; }) ? 'L' : 'N');
        return { segs: segs, w: width, k: main };
      });
      // كلمة أطول من السطر: قصّها
      var out = [];
      ws.forEach(function (w) {
        if (w.w <= maxW) return out.push(w);
        var cur = '', segsT = [];
        Array.from(w.segs.map(function (s) { return s.t; }).join('')).forEach(function (c) {
          if (wid(cur + c) > maxW && cur) { out.push(mk(cur, w.k)); cur = ''; }
          cur += c;
        });
        if (cur) out.push(mk(cur, w.k));
        function mk(t, k) { var s = { k: k === 'N' ? 'L' : k, t: t, d: k === 'R' ? mir(t) : t }; s.w = wid(s.d); return { segs: [s], w: s.w, k: k }; }
      });
      // تقسيم الأسطر
      var lines = [], cur = [], cw = 0;
      out.forEach(function (w) {
        var add = cur.length ? spaceW : 0;
        if (cur.length && cw + add + w.w > maxW) { lines.push(cur); cur = []; cw = 0; add = 0; }
        cur.push(w); cw += add + w.w;
      });
      if (cur.length) lines.push(cur);
      return { rtl: rtl, lines: lines };
    }

    // ترتيب العرض البصري لسطر
    function visual(line, rtl) {
      var base = rtl ? 'R' : 'L', last = base;
      var tagged = line.map(function (w) { var k = w.k === 'N' ? last : w.k; last = k; return { w: w, k: k }; });
      var runs = [];
      tagged.forEach(function (t) {
        if (runs.length && runs[runs.length - 1].k === t.k) runs[runs.length - 1].ws.push(t.w);
        else runs.push({ k: t.k, ws: [t.w] });
      });
      runs.forEach(function (r) { if (r.k === 'R') r.ws = r.ws.slice().reverse(); });
      if (rtl) runs.reverse();
      var res = [];
      runs.forEach(function (r) { r.ws.forEach(function (w) { res.push(w); }); });
      return res;
    }

    var paras = norm(text).split('\n');
    for (var pi = 0; pi < paras.length; pi++) {
      var p = paras[pi];
      if (!p.trim()) { y -= lh * 0.6; if (y < M + lh) newPage(); continue; }
      var L = layoutPara(p);
      for (var li = 0; li < L.lines.length; li++) {
        if (y < M + 10) newPage();
        var line = L.lines[li];
        var order = visual(line, L.rtl);
        var total = order.reduce(function (a, w) { return a + w.w; }, 0) + spaceW * (order.length - 1);
        var x = L.rtl ? (W - M - total) : M;
        order.forEach(function (w) {
          var segs = (L.rtl ? w.segs.slice().reverse() : w.segs.slice());
          if (w.k === 'R') segs = w.segs.slice().reverse();
          segs.forEach(function (s) {
            page.drawText(s.d, { x: x, y: y, size: size, font: font });
            x += s.w;
          });
          x += spaceW;
        });
        y -= lh;
      }
      y -= 4;
    }
    pages.forEach(function (pg, i) {
      var label = String(i + 1);
      pg.drawText(label, { x: W / 2 - wid(label, 10) / 2, y: 28, size: 10, font: font, color: PDFLib.rgb(0.45, 0.45, 0.45) });
    });
    doc.setTitle(ch.title);
    doc.setProducer('Lorsia');
    return await doc.save();
  }

  window.LExport = {
    safeName: safeName, saveFile: saveFile,
    run: async function (fmt, ch, text) {
      var name = safeName(ch.title);
      if (fmt === 'txt') return saveFile(name + '.txt', 'text/plain;charset=utf-8', makeTXT(ch, text));
      if (fmt === 'md') return saveFile(name + '.md', 'text/markdown;charset=utf-8', makeMD(ch, text));
      if (fmt === 'pdf') return saveFile(name + '.pdf', 'application/pdf', await makePDF(ch, text));
      throw new Error('صيغة غير معروفة');
    },
    makePDF: makePDF, makeTXT: makeTXT, makeMD: makeMD
  };
})();
