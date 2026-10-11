/* لورسيا — أدوات الواجهة: نوافذ، تنبيهات، ثيمات */
(function () {
  'use strict';
  var U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmtD = null, fmtT = null;
  try {
    fmtD = new Intl.DateTimeFormat('ar-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
    fmtT = new Intl.DateTimeFormat('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { /* */ }
  U.date = function (ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return fmtD ? fmtD.format(d) + ' ' + fmtT.format(d) : d.toLocaleString();
  };
  U.ago = function (ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'الآن';
    if (s < 3600) return 'قبل ' + Math.floor(s / 60) + ' د';
    if (s < 86400) return 'قبل ' + Math.floor(s / 3600) + ' س';
    if (s < 86400 * 30) return 'قبل ' + Math.floor(s / 86400) + ' يوم';
    return U.date(ts);
  };
  U.num = function (n) { return Number(n || 0).toLocaleString('en-US'); };

  var toastT = null;
  U.toast = function (msg, kind) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show ' + (kind || '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = ''; }, kind === 'err' ? 5200 : kind === 'warn' ? 4200 : 2600); // kind: '' | 'warn' | 'err'
  };

  function modal(build) {
    return new Promise(function (resolve) {
      var root = document.getElementById('modal-root');
      var wrap = document.createElement('div');
      wrap.className = 'modal';
      var box = document.createElement('div');
      box.className = 'modal-box';
      box.setAttribute('role', 'dialog');
      wrap.appendChild(box);
      var done = false;
      function close(v) {
        if (done) return; done = true;
        wrap.remove(); document.removeEventListener('keydown', onKey, true);
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(null); } }
      document.addEventListener('keydown', onKey, true);
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(null); });
      build(box, close);
      root.appendChild(wrap);
      var f = box.querySelector('[autofocus],input,textarea,select');
      if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); box.scrollTop = 0; } catch (e) { /* */ } }, 30); // بلا تمرير: يبقى عنوان النافذة ظاهراً
    });
  }
  U.modal = modal;

  U.confirm = function (msg, o) {
    o = o || {};
    return modal(function (box, close) {
      box.innerHTML = '<h3>' + U.esc(o.title || 'تأكيد') + '</h3><p class="mm">' + U.esc(msg) + '</p>' +
        '<div class="mrow"><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-ok>' + U.esc(o.ok || 'تأكيد') + '</button><button class="btn" data-no' + (o.danger ? ' autofocus' : '') + '>إلغاء</button></div>';
      box.querySelector('[data-ok]').onclick = function () { close(true); };
      box.querySelector('[data-no]').onclick = function () { close(false); };
    }).then(function (v) { return v === true; });
  };

  // خطأ مهم: نافذة واضحة (لا تعتمد على اللون وحده) مع «إعادة المحاولة» عند الإمكان. ترجع true إن اختار المستخدم المحاولة.
  U.alertErr = function (title, msg, o) {
    o = o || {};
    return modal(function (box, close) {
      box.setAttribute('role', 'alertdialog');
      box.innerHTML = '<h3 class="err-h">' + U.esc(title) + '</h3><p class="mm pre">' + U.esc(msg) + '</p><div class="mrow">' +
        (o.retry ? '<button class="btn primary" data-ok>' + U.esc(o.retry) + '</button>' : '') + '<button class="btn" data-no autofocus>' + U.esc(o.close || 'إغلاق') + '</button></div>';
      var ok = box.querySelector('[data-ok]'); if (ok) ok.onclick = function () { close(true); };
      box.querySelector('[data-no]').onclick = function () { close(false); };
    }).then(function (v) { return v === true; });
  };

  U.choice = function (title, msg, opts) {
    return modal(function (box, close) {
      box.innerHTML = '<h3>' + U.esc(title) + '</h3><p class="mm">' + U.esc(msg) + '</p><div class="mcol"></div>';
      var col = box.querySelector('.mcol');
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.className = 'btn ' + (o.cls || '');
        b.textContent = o.label;
        b.onclick = function () { close(o.v); };
        col.appendChild(b);
      });
      var c = document.createElement('button'); c.className = 'btn'; c.textContent = 'إلغاء'; c.onclick = function () { close(null); };
      col.appendChild(c);
    });
  };

  // fields: [{k,label,type:'text'|'area'|'select',req,options:[{v,l}],ph}]
  U.form = function (title, fields, vals, o) {
    o = o || {};
    vals = vals || {};
    return modal(function (box, close) {
      var h = '<h3>' + U.esc(title) + '</h3><div class="mform">';
      fields.forEach(function (f) {
        h += '<label class="fld"><span>' + U.esc(f.label) + (f.req ? ' <b>*</b>' : '') + '</span>';
        var v = vals[f.k] == null ? '' : vals[f.k];
        if (f.type === 'area') h += '<textarea name="' + f.k + '" rows="' + (f.rows || 5) + '" dir="auto" placeholder="' + U.esc(f.ph || '') + '">' + U.esc(v) + '</textarea>';
        else if (f.type === 'select') {
          h += '<select name="' + f.k + '">' + f.options.map(function (op) { return '<option value="' + U.esc(op.v) + '"' + (String(op.v) === String(v) ? ' selected' : '') + '>' + U.esc(op.l) + '</option>'; }).join('') + '</select>';
        } else h += '<input name="' + f.k + '" type="text" dir="auto" value="' + U.esc(v) + '" placeholder="' + U.esc(f.ph || '') + '" autocomplete="off">';
        h += '</label>';
      });
      h += '<div class="ferr" hidden></div></div><div class="mrow"><button class="btn primary" data-ok>' + U.esc(o.ok || 'حفظ') + '</button><button class="btn" data-no>إلغاء</button>' +
        (o.del ? '<button class="btn danger" data-del>حذف</button>' : '') + '</div>';
      box.innerHTML = h;
      box.querySelector('[data-no]').onclick = function () { close(null); };
      var d = box.querySelector('[data-del]');
      if (d) d.onclick = function () { close({ __delete: true }); };
      function submit() {
        var out = {}, bad = null;
        fields.forEach(function (f) {
          var el = box.querySelector('[name="' + f.k + '"]');
          var v = el.value;
          if (f.type !== 'area') v = v.trim();
          if (f.req && !v.trim()) bad = bad || f;
          out[f.k] = v;
        });
        if (bad) {
          var e = box.querySelector('.ferr'); e.hidden = false; e.textContent = 'الحقل «' + bad.label + '» مطلوب';
          box.querySelector('[name="' + bad.k + '"]').focus();
          return;
        }
        close(out);
      }
      box.querySelector('[data-ok]').onclick = submit;
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
    });
  };
  U.prompt = function (title, value, o) {
    o = o || {};
    return U.form(title, [{ k: 'v', label: o.label || 'الاسم', req: true, ph: o.ph }], { v: value || '' }, { ok: o.ok }).then(function (r) { return r && r.v != null ? r.v : null; });
  };

  /* ---------- الثيمات ---------- */
  U.THEMES = {
    modern: { name: 'عصري', desc: 'نظيف وحديث بورق أبيض', accent: '#2f6fed', swatches: ['#2f6fed', '#0b7f70', '#7a3fe8', '#c63a31'] },
    library: { name: 'مكتبة', desc: 'ورق عاجي كدفاتر الكتب', accent: '#8a5a2b', swatches: ['#8a5a2b', '#9c3d3d', '#3f6b4f', '#4d5b8c'] },
    snow: { name: 'ثلج', desc: 'أبيض جليدي بلمسة شتوية', accent: '#2478bd', swatches: ['#2478bd', '#4a6fb0', '#1f8f9e', '#6a5ac8'] },
    night: { name: 'ليل', desc: 'سماء هادئة بفضّة قمرية', accent: '#C6CAD6', swatches: ['#C6CAD6', '#C4B8E8', '#8880AC', '#6FD39A'] }
  };

  /* ---------- خط التطبيق (إعداد واحد عام) ----------
     المعرّفات ثابتة وتُحفظ في الإعدادات. كل خط معرَّف في css/app.css بقاعدة [data-font=<id>].
     لإضافة خط: ملفات في fonts/ + @font-face + قاعدة [data-font] + سطر هنا + توثيقه في FONTS.md. */
  U.FONTS = {
    naskh: { name: 'نسخ', latin: 'Noto Naskh Arabic', family: '"LorsiaNaskh"' },
    amiri: { name: 'أميري', latin: 'Amiri', family: '"LorsiaAmiri"' },
    dejavu: { name: 'ديفاجو', latin: 'DejaVu Sans', family: '"LorsiaDejaVu"' },
    kufi: { name: 'كوفي', latin: 'Noto Kufi Arabic', family: '"LorsiaKufi"' },
    nastaliq: { name: 'نستعليق (أردو)', latin: 'Noto Nastaliq Urdu', family: '"LorsiaNastaliq"' }
  };
  U.DEFAULT_FONT = 'naskh';
  U.FONT_KEY = 'lorsia-font'; // نسخة في localStorage لتطبيق الخط قبل أول رسم فقط؛ المصدر الأصلي هو إعدادات IndexedDB
  U.applyFont = function (id) {
    var f = U.FONTS[id] ? id : U.DEFAULT_FONT, r = document.documentElement;
    if (r.getAttribute('data-font') !== f) r.setAttribute('data-font', f); // تغيير سمة واحدة فقط: لا إعادة رسم للشاشة ولا لمس للمحرر
    try { localStorage.setItem(U.FONT_KEY, f); } catch (e) { /* التخزين قد يكون معطّلاً */ }
    return f;
  };

  U.applyTheme = function (S) {
    var r = document.documentElement;
    U.applyFont(S.font);
    var t = U.THEMES[S.theme] ? S.theme : 'modern';
    if (r.getAttribute('data-theme') && r.getAttribute('data-theme') !== t) {
      r.classList.add('theme-anim'); clearTimeout(U._ta); U._ta = setTimeout(function () { r.classList.remove('theme-anim'); }, 340);
    }
    r.setAttribute('data-theme', t);
    try { localStorage.setItem('lorsia-theme', t); } catch (e) { /* نسخة للتطبيق قبل أول رسم فقط؛ المصدر الأصلي إعدادات IndexedDB */ }
    var a = S.adv || {};
    var on = !!a.on;
    ['--accent', '--on-accent', '--ed-size', '--ed-lh'].forEach(function (p) { r.style.removeProperty(p); });
    r.removeAttribute('data-hdr'); r.removeAttribute('data-dens'); r.removeAttribute('data-card');
    if (on) {
      if (a.accent && /^#[0-9a-f]{6}$/i.test(a.accent)) {
        r.style.setProperty('--accent', a.accent);
        // لون نص الأزرار يُحسب تلقائياً ليبقى مقروءاً مهما كان لون التمييز المختار
        var n = parseInt(a.accent.slice(1), 16), lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        var L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
        r.style.setProperty('--on-accent', L > 0.4 ? '#101521' : '#ffffff');
      }
      if (a.edSize) r.style.setProperty('--ed-size', a.edSize + 'px');
      if (a.edLh) r.style.setProperty('--ed-lh', a.edLh);
      if (a.hdr) r.setAttribute('data-hdr', a.hdr);
      if (a.dens) r.setAttribute('data-dens', a.dens);
      if (a.card) r.setAttribute('data-card', a.card);
    }
    if (U.syncLauncherIcon) U.syncLauncherIcon(t);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) setTimeout(function () { meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#ffffff'; }, 20);
  };

  // إيقاف الحركة غير الأساسية (النجوم) حين تُخفى الصفحة/التطبيق
  document.addEventListener('visibilitychange', function () { document.documentElement.classList.toggle('page-hidden', document.hidden); });

  window.LUI = U;
})();
