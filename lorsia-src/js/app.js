/* لورسيا — التطبيق الرئيسي */
(function () {
  'use strict';
  var DB = window.LDB, U = window.LUI, X = window.LExport;
  var esc = U.esc, $ = function (s, r) { return (r || document).querySelector(s); };
  var viewEl, topEl, navEl, titleEl, backEl;

  var DEFAULTS = {
    theme: 'modern', font: 'naskh', cols: 1, sort: 'updated',
    adv: { on: false, accent: '', hdr: '', dens: '', card: '', edSize: 19, edLh: 1.9 },
    dash: { order: ['continue', 'stats', 'chapters', 'chars', 'ideas', 'world', 'activity'], hidden: [] }
  };
  var S = JSON.parse(JSON.stringify(DEFAULTS));
  var DASH_NAMES = { continue: 'متابعة الكتابة', stats: 'إحصاءات الكتاب', chapters: 'آخر الفصول المعدّلة', chars: 'آخر الشخصيات', ideas: 'أحدث الأفكار', world: 'عالم الرواية', activity: 'آخر النشاطات' };

  var I = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    back: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    chap: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>',
    focus: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
    exp: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    grid1: '<rect x="4" y="5" width="16" height="6" rx="1.5"/><rect x="4" y="13" width="16" height="6" rx="1.5"/>',
    grid2: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
    feather: '<path d="M20 4c-6 0-11 4-12 11l-3 5M8 15h6M20 4c0 6-3 10-8 11"/>',
    book: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M10 8h5"/>',
    warn: '<path d="M12 4l9 16H3zM12 10v4M12 17v.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  function hue(str) { var h = 0; str = String(str || ''); for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
  function initial(str) { var t = String(str || '').trim(); return t ? Array.from(t)[0] : '؟'; }
  function cover(title, cls) { return '<div class="cover ' + (cls || '') + '" style="--h:' + hue(title) + '" aria-hidden="true"><span class="ct">' + esc(title) + '</span><i class="orn"></i></div>'; }
  function ic(n, c) { return '<svg class="ic ' + (c || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + I[n] + '</svg>'; }

  /* ---------- الإعدادات ---------- */
  function mergeDeep(a, b) {
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') mergeDeep(a[k], b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  async function loadSettings() {
    var saved = await DB.getSetting('prefs', null);
    S = JSON.parse(JSON.stringify(DEFAULTS));
    if (saved && typeof saved === 'object') mergeDeep(S, saved);
    var ord = (S.dash.order || []).filter(function (k) { return DEFAULTS.dash.order.indexOf(k) >= 0; });
    DEFAULTS.dash.order.forEach(function (k) {
      if (ord.indexOf(k) >= 0) return;
      var at = k === 'world' && ord.indexOf('ideas') >= 0 ? ord.indexOf('ideas') + 1 : ord.length; // قسم جديد يوضع بعد الأفكار
      ord.splice(at, 0, k);
    });
    S.dash.order = ord;
    U.applyTheme(S);
  }
  var saveSetT = null;
  function saveSettings() {
    U.applyTheme(S);
    clearTimeout(saveSetT);
    return DB.setSetting('prefs', S).catch(function (e) { U.toast('تعذّر حفظ الإعدادات: ' + (e.message || e), 'err'); });
  }

  /* ---------- المحرر: حالة الحفظ ---------- */
  var Ed = null;

  /* ---------- التوجيه ---------- */
  var helpKey = '';
  var lastHash = '#/', routing = Promise.resolve(), curBook = null;

  function parse() {
    var h = location.hash.replace(/^#\/?/, '');
    return h ? h.split('/').map(decodeURIComponent) : [];
  }
  function go(h) { location.hash = h; }
  window.addEventListener('hashchange', function () { routing = routing.then(route).catch(function (e) { console.error(e); showErr(e); }); });

  function showErr(e) {
    viewEl.innerHTML = '<div class="empty">' + ic('warn', 'big') + '<h3>حدث خطأ</h3><p>' + esc((e && e.message) || e) + '</p><a class="btn primary" href="#/">العودة للمكتبة</a></div>';
  }

  async function route() {
    if (Ed) {
      await Ed.flush();
      if (Ed.hasUnsaved()) {
        var leave = await U.confirm('تعذّر حفظ آخر تغييراتك على هذا الفصل. إن غادرت الآن فقد تضيع. هل تريد المغادرة رغم ذلك؟', { title: 'تغييرات غير محفوظة', danger: true, ok: 'مغادرة' });
        if (!leave) { history.replaceState(null, '', lastHash); return; }
      }
      Ed.destroy(); Ed = null;
    }
    lastHash = location.hash || '#/';
    document.body.classList.remove('focus', 'in-editor');
    closeDrawer();
    viewEl.onclick = viewEl.onchange = viewEl.oninput = null;
    var p = parse();
    var HK = { home: 'dashboard', chapters: 'chapters', c: 'editor', chars: 'chars', ideas: 'ideas', world: 'world' };
    helpKey = p[0] === 'b' ? (HK[p[2] || 'home'] || '') : (({ settings: 'settings', themes: 'themes', backup: 'backup' })[p[0]] || ((!p.length || p[0] === 'lib') ? 'library' : ''));
    window.scrollTo(0, 0);
    if (!p.length || p[0] === 'lib') return vLibrary();
    if (p[0] === 'settings') return vSettings();
    if (p[0] === 'themes') return vThemes();
    if (p[0] === 'backup') return vBackup();
    if (p[0] === 'why') return vWhy();
    if (p[0] === 'b' && p[1]) {
      var book = await DB.get('books', p[1]);
      if (!book) { U.toast('هذا الكتاب غير موجود', 'err'); return go('#/'); }
      curBook = book;
      var sec = p[2] || 'home';
      if (sec === 'home') return vDash(book);
      if (sec === 'chapters') return vChapters(book);
      if (sec === 'c' && p[3]) return vEditor(book, p[3]);
      if (sec === 'chars') return vChars(book, p[3]);
      if (sec === 'ideas') return vIdeas(book, p[3]);
      if (sec === 'world') return vWorld(book, p[3], p[4]);
    }
    return go('#/');
  }

  function setChrome(o) {
    // o: {title, back, book, nav}
    titleEl.textContent = o.title || 'لورسيا';
    backEl.hidden = !o.back;
    backEl.dataset.href = o.back || '';
    document.getElementById('menuBtn').hidden = !!(o.book || o.back);
    var hb = $('#helpBtn'); hb.hidden = !(helpKey && window.LHelp && LHelp.has(helpKey)); hb.dataset.help = helpKey;
    navEl.hidden = !o.book;
    document.body.classList.toggle('has-nav', !!o.book);
    if (o.book) {
      var tabs = [['home', 'لوحة الكتاب', 'home'], ['chapters', 'الفصول', 'chap'], ['chars', 'الشخصيات', 'user'], ['ideas', 'الأفكار', 'idea'], ['world', 'عالم الرواية', 'world']];
      navEl.innerHTML = tabs.map(function (t) {
        return '<a href="#/b/' + o.book.id + '/' + t[0] + '" class="' + (o.nav === t[0] ? 'on' : '') + '">' + ic(t[2]) + '<span>' + t[1] + '</span></a>';
      }).join('');
    }
  }

  /* ---------- القائمة العامة ---------- */
  function openDrawer() { document.getElementById('drawer').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); }

    /* ---------- المكتبة ---------- */
  async function createBookFlow() {
    var t = await U.prompt('كتاب جديد', '', { label: 'عنوان الكتاب', ok: 'إنشاء' });
    if (t == null) return;
    try { var b = await DB.createBook(t); go('#/b/' + b.id + '/home'); } catch (e) { U.toast('تعذّر إنشاء الكتاب: ' + e.message, 'err'); }
  }

  async function vLibrary() {
    setChrome({ title: 'لورسيا' });
    var books = await DB.all('books'), chs = await DB.all('chapters');
    var stat = {};
    chs.forEach(function (c) { var s = stat[c.bookId] || (stat[c.bookId] = { n: 0, w: 0 }); s.n++; s.w += c.words || 0; });
    var q = '', first = true;
    viewEl.innerHTML =
      '<div class="page"><div class="lib-hero"><div><h2>مكتبتي</h2><p>' + (books.length ? U.num(books.length) + (books.length === 1 ? ' رواية' : ' روايات') : 'ابدأ روايتك الأولى') + '</p></div><span class="rule"></span></div>' +
      '<div class="toolbar"><label class="searchbox">' + ic('search') + '<input id="q" type="search" placeholder="ابحث في كتبك…" dir="auto" autocomplete="off" aria-label="بحث في الكتب"></label>' +
      '<select id="sort" aria-label="ترتيب الكتب"><option value="updated">الأحدث تعديلاً</option><option value="title">الاسم</option><option value="created">الأحدث إنشاءً</option></select>' +
      '<button class="icon-btn" id="colsBtn" aria-label="تبديل نمط العرض بين بطاقة وبطاقتين" title="نمط العرض">' + ic(S.cols === 2 ? 'grid1' : 'grid2') + '</button></div>' +
      '<div id="list"></div></div><button class="fab" id="newBook" aria-label="كتاب جديد">' + ic('plus') + '<span>كتاب جديد</span></button>';
    $('#sort').value = S.sort;
    function draw() {
      var list = books.filter(function (b) { return !q || b.title.toLowerCase().indexOf(q) >= 0; });
      list.sort(function (a, b) { return S.sort === 'title' ? a.title.localeCompare(b.title, 'ar') : (b[S.sort] || 0) - (a[S.sort] || 0); });
      var el = $('#list');
      if (!books.length) {
        el.className = '';
        el.innerHTML = '<div class="empty">' + ic('book', 'big') + '<h3>مكتبتك فارغة</h3><p>ابدأ أول كتاب لك، واكتب عالمك فصلاً فصلاً.</p><button class="btn primary" id="newBookCta">' + ic('plus', 'sm') + 'كتاب جديد</button></div>';
        $('#newBookCta').onclick = createBookFlow;
      } else if (!list.length) {
        el.className = '';
        el.innerHTML = '<div class="empty">' + ic('search', 'big') + '<h3>لا نتائج</h3><p>لا يوجد كتاب يطابق «' + esc(q) + '».</p></div>';
      } else {
        el.className = 'cards c' + S.cols + (first ? ' fresh' : '');
        el.innerHTML = list.map(function (b, i) {
          var s = stat[b.id] || { n: 0, w: 0 };
          return '<article class="card book" data-id="' + b.id + '" style="--i:' + i + '">' + cover(b.title) +
            '<div class="bi"><h3>' + esc(b.title) + '</h3><div class="chips2"><span class="tag">' + U.num(s.n) + ' فصل</span><span class="tag">' + U.num(s.w) + ' كلمة</span></div>' +
            '<div class="meta sm">آخر تعديل: ' + U.date(b.updated) + '</div></div>' +
            '<button class="icon-btn more" data-more="' + b.id + '" aria-label="خيارات الكتاب ' + esc(b.title) + '">' + ic('dots') + '</button></article>';
        }).join('');
      }
      first = false;
    }
    draw();
    $('#q').oninput = function (e) { q = e.target.value.trim().toLowerCase(); draw(); };
    $('#sort').onchange = function (e) { S.sort = e.target.value; saveSettings(); draw(); };
    $('#colsBtn').onclick = function () { S.cols = S.cols === 2 ? 1 : 2; saveSettings(); $('#colsBtn').innerHTML = ic(S.cols === 2 ? 'grid1' : 'grid2'); draw(); };
    $('#newBook').onclick = createBookFlow;
    $('#list').onclick = async function (e) {
      var more = e.target.closest('[data-more]');
      var card = e.target.closest('.book');
      if (!card) return;
      var id = card.dataset.id, b = books.filter(function (x) { return x.id === id; })[0];
      if (more) {
        var a = await U.choice(b.title, 'ماذا تريد أن تفعل بهذا الكتاب؟', [{ v: 'open', label: 'فتح', cls: 'primary' }, { v: 'ren', label: 'إعادة تسمية' }, { v: 'del', label: 'حذف الكتاب', cls: 'danger' }]);
        if (a === 'open') go('#/b/' + id + '/home');
        if (a === 'ren') {
          var t = await U.prompt('إعادة تسمية الكتاب', b.title, { label: 'العنوان' });
          if (t == null) return;
          try { await DB.patchBook(id, { title: t }); U.toast('تمت إعادة التسمية'); vLibrary(); } catch (er) { U.toast('تعذّر الحفظ: ' + er.message, 'err'); }
        }
        if (a === 'del') {
          var s = stat[id] || { n: 0 };
          var ok = await U.confirm('سيُحذف الكتاب «' + b.title + '» نهائياً مع ' + s.n + ' فصل وكل شخصياته وأفكاره وعالمه. لا يمكن التراجع عن ذلك.', { title: 'حذف الكتاب', danger: true, ok: 'حذف نهائي' });
          if (!ok) return;
          try { await DB.deleteBook(id); U.toast('تم حذف الكتاب'); vLibrary(); } catch (er) { U.toast('تعذّر الحذف: ' + er.message, 'err'); }
        }
        return;
      }
      go('#/b/' + id + '/home');
    };
  }

  /* ---------- لوحة الكتاب: جدار الملاحظات ---------- */
  async function vDash(book) {
    setChrome({ title: book.title, back: '#/', book: book, nav: 'home' });
    var r = await Promise.all([DB.byBook('chapters', book.id), DB.byBook('characters', book.id), DB.byBook('ideas', book.id), DB.byBook('items', book.id), DB.byBook('cats', book.id)]);
    var chs = r[0], chars = r[1], ideas = r[2], items = r[3], cats = r[4];
    var catName = {}; cats.forEach(function (c) { catName[c.id] = c.name; });
    function byUp(a) { return a.slice().sort(function (x, y) { return y.updated - x.updated; }); }
    var chUp = byUp(chs), last = chs.filter(function (c) { return c.id === book.lastChapterId; })[0] || chUp[0];
    var words = chs.reduce(function (a, c) { return a + (c.words || 0); }, 0);
    var nil = function (t) { return '<div class="nil">' + t + '</div>'; };
    var B = '#/b/' + book.id;
    var parts = {
      continue: function (cls) {
        return '<section class="cont ' + cls + '">' + (last
          ? '<div class="eyebrow">آخر فصل عملت عليه</div><h3>' + esc(last.title) + '</h3><div class="rs">' + U.num(last.words) + ' كلمة · ' + U.ago(last.updated) + '</div><a class="btn primary big" href="' + B + '/c/' + last.id + '">' + ic('pen', 'sm') + 'متابعة الكتابة</a>'
          : '<div class="eyebrow">ابدأ من هنا</div><h3>لا يوجد فصل بعد</h3><div class="rs">أنشئ أول فصل لتبدأ الكتابة.</div><a class="btn primary big" href="' + B + '/chapters" data-new="1">' + ic('pen', 'sm') + 'إنشاء فصل</a>') + '</section>';
      },
      stats: function (cls) {
        return '<section class="sec stats ' + cls + '"><div><b>' + U.num(chs.length) + '</b><span>فصل</span></div><div><b>' + U.num(words) + '</b><span>كلمة</span></div><div><b>' + U.num(chars.length) + '</b><span>شخصية</span></div><div><b>' + U.num(ideas.length) + '</b><span>فكرة</span></div></section>';
      },
      chapters: function (cls) {
        return '<section class="sheets ' + cls + '"><h4>آخر الفصول المعدّلة</h4>' + (chUp.length ? chUp.slice(0, 3).map(function (c) {
          return '<a class="sheet-row" href="' + B + '/c/' + c.id + '"><span class="sn">' + c.order + '</span><div class="grow"><div class="rt">' + esc(c.title) + '</div><div class="rs">' + U.num(c.words) + ' كلمة · ' + U.ago(c.updated) + '</div></div></a>';
        }).join('') : nil('لا توجد فصول.')) + '</section>';
      },
      chars: function (cls) {
        var l = byUp(chars).slice(0, 3);
        return '<section class="note chars ' + cls + '"><h4>الشخصيات</h4>' + (l.length ? l.map(function (c) {
          return '<a class="nrow hasav" href="' + B + '/chars/' + c.id + '"><span class="avatar" style="--h:' + hue(c.name) + '" aria-hidden="true">' + esc(initial(c.name)) + '</span><div><div class="rt">' + esc(c.name) + '</div><div class="rs">' + esc(c.role || '') + ' ' + U.ago(c.updated) + '</div></div></a>';
        }).join('') : nil('لم تُضف شخصيات بعد.')) + '</section>';
      },
      ideas: function (cls) {
        var l = byUp(ideas).slice(0, 3);
        return '<section class="note ideas ' + cls + '"><h4>الأفكار</h4>' + (l.length ? l.map(function (c) {
          return '<a class="nrow" href="' + B + '/ideas/' + c.id + '"><div class="rt">' + esc(c.title) + '</div><div class="rs">' + U.ago(c.updated) + '</div></a>';
        }).join('') : nil('لم تُسجَّل أفكار بعد.')) + '</section>';
      },
      world: function (cls) {
        var l = byUp(items).slice(0, 3);
        return '<section class="note world ' + cls + '"><h4>عالم الرواية</h4>' + (l.length ? l.map(function (c) {
          return '<a class="nrow" href="' + B + '/world/' + c.catId + '/' + c.id + '"><div class="rt">' + esc(c.name) + '</div><div class="rs">' + esc(catName[c.catId] || '') + ' · ' + U.ago(c.updated) + '</div></a>';
        }).join('') : nil('لا عناصر في عالم الرواية بعد.')) + '</section>';
      },
      activity: function (cls) {
        var all = [].concat(
          chs.map(function (c) { return { t: 'فصل', n: c.title, u: c.updated, h: B + '/c/' + c.id }; }),
          chars.map(function (c) { return { t: 'شخصية', n: c.name, u: c.updated, h: B + '/chars/' + c.id }; }),
          ideas.map(function (c) { return { t: 'فكرة', n: c.title, u: c.updated, h: B + '/ideas/' + c.id }; }),
          items.map(function (c) { return { t: 'عالم · ' + (catName[c.catId] || ''), n: c.name, u: c.updated, h: B + '/world/' + c.catId + '/' + c.id }; })
        ).sort(function (a, b) { return b.u - a.u; }).slice(0, 8);
        return '<section class="note activity ' + cls + '"><h4>آخر النشاطات</h4>' + (all.length ? all.map(function (a) {
          return '<a class="nrow" href="' + a.h + '"><div class="rt">' + esc(a.n) + '</div><div class="rs">' + esc(a.t) + ' · ' + U.ago(a.u) + '</div></a>';
        }).join('') : nil('لا نشاط بعد.')) + '</section>';
      }
    };
    var HALF = { chars: 1, ideas: 1, world: 1 };
    var vis = S.dash.order.filter(function (k) { return S.dash.hidden.indexOf(k) < 0 && parts[k]; });
    var cls = {}, i = 0;
    while (i < vis.length) {
      if (HALF[vis[i]] && i + 1 < vis.length && HALF[vis[i + 1]]) { cls[vis[i]] = cls[vis[i + 1]] = 'half'; i += 2; }
      else { cls[vis[i]] = 'full'; i += 1; }
    }
    var head = '<header class="manu full">' + cover(book.title, 'sm') + '<div class="mi"><h2>' + esc(book.title) + '</h2><p>آخر تعديل ' + U.ago(book.updated) + ' · ' + U.num(chs.length) + ' فصل</p></div></header>';
    var html = head + vis.map(function (k) { return parts[k](cls[k]); }).join('');
    // فهرس الظهور المتدرّج
    var n = 0; html = html.replace(/<(section|header) class="/g, function (m, t) { return '<' + t + ' style="--i:' + (n++) + '" class="'; });
    viewEl.innerHTML = '<div class="page dash"><div class="wall fresh">' + html + '</div></div>';
    var nb = $('[data-new]'); if (nb) nb.onclick = function (e) { e.preventDefault(); newChapter(book, true); };
  }

/* ---------- الفصول ---------- */
  async function newChapter(book, open) {
    var chs = await DB.byBook('chapters', book.id);
    var t = await U.prompt('فصل جديد', 'الفصل ' + (chs.length + 1), { label: 'عنوان الفصل', ok: 'إنشاء' });
    if (t == null) return;
    try {
      var c = await DB.createChapter(book.id, t);
      go('#/b/' + book.id + '/c/' + c.id);
    } catch (e) { U.toast('تعذّر إنشاء الفصل: ' + e.message, 'err'); }
  }

  async function vChapters(book) {
    setChrome({ title: book.title, back: '#/', book: book, nav: 'chapters' });
    var chs = (await DB.byBook('chapters', book.id)).sort(function (a, b) { return a.order - b.order; });
    var maxW = chs.reduce(function (m, c) { return Math.max(m, c.words || 0); }, 0) || 1;
    viewEl.innerHTML = '<div class="page"><div class="toolbar"><h2 class="grow">الفصول <small>(' + chs.length + ')</small></h2></div><div id="list" class="stack fresh"></div></div><button class="fab" id="newCh" aria-label="فصل جديد">' + ic('plus') + '<span>فصل جديد</span></button>';
    var el = $('#list');
    if (!chs.length) { el.className = 'stack'; el.innerHTML = '<div class="empty">' + ic('feather', 'big') + '<h3>لا توجد فصول</h3><p>أنشئ أول فصل وابدأ الكتابة.</p></div>'; }
    else el.innerHTML = chs.map(function (c, i) {
      var w = c.words || 0, pct = w ? Math.max(3, Math.round(w / maxW * 100)) : 0;
      return '<article class="card chap" data-id="' + c.id + '" style="--i:' + i + '"><a class="cb" href="#/b/' + book.id + '/c/' + c.id + '"><div class="num">' + (i + 1) + '</div><div class="grow"><h3>' + esc(c.title) + '</h3><div class="meta sm">' + U.num(w) + ' كلمة · ' + U.date(c.updated) + '</div><div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div></div></a>' +
        '<div class="acts"><button class="icon-btn" data-a="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="تحريك للأعلى" title="للأعلى">' + ic('up') + '</button><button class="icon-btn" data-a="down" ' + (i === chs.length - 1 ? 'disabled' : '') + ' aria-label="تحريك للأسفل" title="للأسفل">' + ic('down') + '</button><button class="icon-btn" data-a="ren" aria-label="إعادة تسمية" title="إعادة تسمية">' + ic('edit') + '</button><button class="icon-btn danger" data-a="del" aria-label="حذف" title="حذف">' + ic('trash') + '</button></div></article>';
    }).join('');
    $('#newCh').onclick = function () { newChapter(book); };
    el.onclick = async function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var id = b.closest('.chap').dataset.id, i = chs.findIndex(function (c) { return c.id === id; }), c = chs[i];
      try {
        if (b.dataset.a === 'up' || b.dataset.a === 'down') {
          var j = b.dataset.a === 'up' ? i - 1 : i + 1;
          var ids = chs.map(function (x) { return x.id; }); var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
          await DB.reorderChapters(book.id, ids); vChapters(book);
        } else if (b.dataset.a === 'ren') {
          var t = await U.prompt('إعادة تسمية الفصل', c.title, { label: 'العنوان' });
          if (t == null) return; await DB.renameChapter(id, t); vChapters(book);
        } else if (b.dataset.a === 'del') {
          var ok = await U.confirm('سيُحذف الفصل «' + c.title + '» (' + U.num(c.words) + ' كلمة) مع ملاحظاته نهائياً.', { title: 'حذف الفصل', danger: true, ok: 'حذف' });
          if (!ok) return; await DB.deleteChapter(c); U.toast('تم حذف الفصل'); vChapters(book);
        }
      } catch (er) { U.toast('تعذّرت العملية: ' + er.message, 'err'); }
    };
  }

  /* ---------- محرر الفصل ---------- */
  async function vEditor(book, cid) {
    var ch = await DB.get('chapters', cid);
    if (!ch || ch.bookId !== book.id) { U.toast('هذا الفصل غير موجود', 'err'); return go('#/b/' + book.id + '/chapters'); }
    var body = await DB.getBody(cid);
    setChrome({ title: ch.title, back: '#/b/' + book.id + '/chapters', book: null });
    document.body.classList.add('in-editor');
    viewEl.innerHTML =
      '<div class="editor"><div class="etools"><span id="st" class="st saved">تم الحفظ</span><span id="wc" class="wc"></span><span class="grow"></span>' +
      '<button class="icon-btn" id="notesBtn" aria-label="ملاحظات الفصل" title="ملاحظات الفصل">' + ic('note') + '</button>' +
      '<button class="icon-btn" id="focusBtn" aria-label="وضع بلا مشتتات" title="وضع بلا مشتتات">' + ic('focus') + '</button>' +
      '<button class="icon-btn" id="expBtn" aria-label="تصدير الفصل" title="تصدير الفصل">' + ic('exp') + '</button></div>' +
      '<textarea id="ta" class="paper" spellcheck="true" placeholder="ابدأ الكتابة هنا…" aria-label="نص الفصل"></textarea></div>' +
      '<div id="notesSheet" class="sheet" hidden><div class="sheet-h"><b>ملاحظات: <span id="nTitle"></span></b><button class="icon-btn" data-help="notes" aria-label="مساعدة ملاحظات الفصل" title="مساعدة">' + ic('info') + '</button><button class="icon-btn" id="nClose" aria-label="إغلاق الملاحظات" title="إغلاق">' + ic('close') + '</button></div>' +
      '<textarea id="nta" dir="auto" placeholder="ملاحظات هذا الفصل فقط…"></textarea></div>' +
      '<button id="unfocus" class="unfocus" hidden aria-label="استعادة الواجهة">' + ic('focus') + '</button>';
    var ta = $('#ta'), nta = $('#nta'), st = $('#st'), wc = $('#wc');
    $('#nTitle').textContent = ch.title;
    ta.value = body.text || ''; nta.value = body.notes || '';

    var E = {
      id: cid, text: ta.value, notes: nta.value, pos: ch.pos || { sel: 0, scroll: 0 },
      dirty: false, nDirty: false, pDirty: false, state: 'saved', timer: null, q: Promise.resolve(), failed: false
    };
    function setState(s) {
      E.state = s;
      st.className = 'st ' + s;
      if (s === 'saved') { void st.offsetWidth; st.classList.add('pop'); }
      st.textContent = s === 'saving' ? 'جارٍ الحفظ…' : s === 'saved' ? 'تم الحفظ' : s === 'error' ? 'تعذّر الحفظ' : 'غير محفوظ';
    }
    function doSave() {
      if (!E.dirty && !E.nDirty && !E.pDirty) return Promise.resolve();
      var patch = { pos: E.pos }, d = E.dirty, n = E.nDirty;
      if (d) patch.text = E.text; if (n) patch.notes = E.notes;
      E.dirty = E.nDirty = E.pDirty = false;
      setState('saving');
      return DB.saveChapter(cid, patch).then(function () {
        E.failed = false;
        setState(E.dirty || E.nDirty ? 'dirty' : 'saved');
      }, function (err) {
        if (d) E.dirty = true; if (n) E.nDirty = true; E.pDirty = true; E.failed = true;
        setState('error');
        U.toast('تعذّر حفظ الفصل: ' + (err && err.message || err), 'err');
      });
    }
    function enqueue() { E.q = E.q.then(doSave); return E.q; }
    function sched(ms) { clearTimeout(E.timer); E.timer = setTimeout(enqueue, ms); }
    E.flush = function () { clearTimeout(E.timer); return enqueue(); };
    E.hasUnsaved = function () { return E.dirty || E.nDirty; };
    var wcT = null;
    function updWc() { wc.textContent = U.num(DB.words(E.text)) + ' كلمة'; }
    updWc();
    function track() {
      var p = { sel: ta.selectionStart, scroll: ta.scrollTop };
      if (p.sel !== E.pos.sel || Math.abs(p.scroll - E.pos.scroll) > 2) { E.pos = p; E.pDirty = true; sched(2500); }
    }
    ta.addEventListener('input', function () {
      E.text = ta.value; E.dirty = true; setState('dirty'); sched(700);
      clearTimeout(wcT); wcT = setTimeout(updWc, 300);
      track();
    });
    ta.addEventListener('scroll', track, { passive: true });
    ta.addEventListener('keyup', track); ta.addEventListener('pointerup', track);
    nta.addEventListener('input', function () { E.notes = nta.value; E.nDirty = true; setState('dirty'); sched(700); });
    function onHide() { if (document.visibilityState === 'hidden') E.flush(); }
    function onBlurWin() { E.flush(); }
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onBlurWin);
    window.addEventListener('blur', onBlurWin);
    ta.addEventListener('blur', onBlurWin); nta.addEventListener('blur', onBlurWin);
    E.destroy = function () {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onBlurWin); window.removeEventListener('blur', onBlurWin);
    };
    Ed = E;
    DB.patchBook(book.id, { lastChapterId: cid }).catch(function () { /* غير حرج */ });

    // استعادة الموضع
    var sel = Math.min(E.pos.sel || 0, ta.value.length);
    try { ta.focus({ preventScroll: true }); ta.setSelectionRange(sel, sel); } catch (e) { /* */ }
    requestAnimationFrame(function () { ta.scrollTop = E.pos.scroll || 0; requestAnimationFrame(function () { ta.scrollTop = E.pos.scroll || 0; }); });

    $('#notesBtn').onclick = function () { var s = $('#notesSheet'); s.hidden = !s.hidden; if (!s.hidden) nta.focus(); else ta.focus(); };
    $('#nClose').onclick = function () { $('#notesSheet').hidden = true; ta.focus({ preventScroll: true }); };
    $('#focusBtn').onclick = function () { document.body.classList.add('focus'); $('#unfocus').hidden = false; ta.focus({ preventScroll: true }); };
    $('#unfocus').onclick = function () { document.body.classList.remove('focus'); $('#unfocus').hidden = true; };
    $('#expBtn').onclick = async function () {
      var f = await U.choice('تصدير «' + ch.title + '»', 'اختر صيغة التصدير للفصل الحالي:', [{ v: 'pdf', label: 'PDF', cls: 'primary' }, { v: 'txt', label: 'نص عادي TXT' }, { v: 'md', label: 'Markdown MD' }]);
      if (!f) return;
      await E.flush();
      var cur = await DB.get('chapters', cid), title = (cur && cur.title) || ch.title;
      U.toast('جارٍ إنشاء الملف…');
      try {
        var r = await X.run(f, { title: title }, E.text);
        if (r.ok) U.toast('تم تصدير الملف');
      } catch (er) { U.toast('تعذّر التصدير: ' + (er && er.message || er), 'err'); }
    };
  }

  /* ---------- أدوات القوائم الموحّدة (شخصيات/أفكار/عناصر) ---------- */
  var POP = null; // معرّف آخر سجل أُضيف لتمييزه بوميض خفيف
  function listPage(o) {
    // o: {head, items, render(i), search(i), name(i), onAdd, onOpen(i), addLabel, eico, empty, emptyHint, cls, cardCls}
    var q = '', sortK = 'updated', first = true;
    viewEl.innerHTML = '<div class="page">' + (o.head || '') + '<div class="toolbar"><label class="searchbox">' + ic('search') + '<input id="q" type="search" placeholder="بحث…" dir="auto" autocomplete="off" aria-label="بحث"></label><select id="sort" aria-label="الترتيب"><option value="updated">الأحدث تعديلاً</option><option value="name">الاسم</option></select></div><div id="list" class="stack"></div></div><button class="fab" id="add">' + ic('plus') + '<span>' + o.addLabel + '</span></button>';
    function draw() {
      var l = o.items.filter(function (i) { return !q || (o.search(i)).toLowerCase().indexOf(q) >= 0; });
      l.sort(function (a, b) { return sortK === 'name' ? o.name(a).localeCompare(o.name(b), 'ar') : b.updated - a.updated; });
      var el = $('#list');
      el.className = 'stack';
      if (!o.items.length) el.innerHTML = '<div class="empty">' + ic(o.eico, 'big') + '<h3>' + o.empty + '</h3><p>' + o.emptyHint + '</p></div>';
      else if (!l.length) el.innerHTML = '<div class="empty">' + ic('search', 'big') + '<h3>لا نتائج</h3><p>لا شيء يطابق «' + esc(q) + '».</p></div>';
      else {
        el.className = 'stack ' + (o.cls || '') + (first ? ' fresh' : '');
        el.innerHTML = l.map(function (i, n) { return '<article class="card rec ' + (o.cardCls || '') + (POP === i.id ? ' pop' : '') + '" data-id="' + i.id + '" style="--i:' + n + '">' + o.render(i) + '</article>'; }).join('');
        if (POP && l.some(function (i) { return i.id === POP; })) POP = null;
      }
      first = false;
    }
    draw();
    $('#q').oninput = function (e) { q = e.target.value.trim().toLowerCase(); draw(); };
    $('#sort').onchange = function (e) { sortK = e.target.value; draw(); };
    $('#add').onclick = o.onAdd;
    $('#list').onclick = function (e) { var c = e.target.closest('.rec'); if (c) o.onOpen(o.items.filter(function (i) { return i.id === c.dataset.id; })[0]); };
  }
  function snip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }

  async function crud(store, book, rec, fields, noun, after, defaults) {
    var isNew = !rec;
    var v = await U.form(isNew ? 'إضافة ' + noun : 'تعديل ' + noun, fields, rec || defaults || {}, { del: !isNew });
    if (!v) return after();
    try {
      if (v.__delete) {
        var ok = await U.confirm('سيُحذف ' + noun + ' «' + (rec.name || rec.title) + '» نهائياً.', { title: 'تأكيد الحذف', danger: true, ok: 'حذف' });
        if (!ok) return crud(store, book, rec, fields, noun, after, defaults);
        await DB.delRec(store, rec); U.toast('تم الحذف');
      } else {
        var r = Object.assign({ bookId: book.id }, rec || {}, v);
        var saved = await DB.saveRec(store, r);
        if (isNew && saved) POP = saved.id;
        U.toast('تم الحفظ');
      }
    } catch (e) { U.toast('تعذّر الحفظ: ' + e.message, 'err'); }
    after();
  }

  /* ---------- الشخصيات ---------- */
  var CHAR_F = [{ k: 'name', label: 'الاسم', req: true }, { k: 'role', label: 'الدور (بطل، خصم…)' }, { k: 'age', label: 'العمر' }, { k: 'desc', label: 'الوصف', type: 'area', rows: 5 }, { k: 'traits', label: 'السمات والملاحظات', type: 'area', rows: 4 }];
  async function vChars(book, openId) {
    setChrome({ title: book.title, back: '#/', book: book, nav: 'chars' });
    var items = await DB.byBook('characters', book.id);
    var again = function () { history.replaceState(null, '', '#/b/' + book.id + '/chars'); vChars(book); };
    listPage({
      items: items, addLabel: 'شخصية جديدة', eico: 'user', empty: 'لا توجد شخصيات', emptyHint: 'أضف شخصيات روايتك لتبقى معك دائماً.', cls: 'grid', cardCls: 'char',
      name: function (i) { return i.name; },
      search: function (i) { return [i.name, i.role, i.desc, i.traits].join(' '); },
      render: function (i) {
        return '<div class="cb"><span class="avatar" style="--h:' + hue(i.name) + '" aria-hidden="true">' + esc(initial(i.name)) + '</span><div class="grow"><h3>' + esc(i.name) + (i.role ? ' <span class="tag">' + esc(i.role) + '</span>' : '') + '</h3>' +
          (i.age ? '<div class="meta sm">العمر: ' + esc(i.age) + '</div>' : '') + '<div class="snip">' + esc(snip(i.desc, 110)) + '</div></div></div>';
      },
      onAdd: function () { crud('characters', book, null, CHAR_F, 'شخصية', again); },
      onOpen: function (i) { crud('characters', book, i, CHAR_F, 'الشخصية', again); }
    });
    if (openId) { var r = items.filter(function (i) { return i.id === openId; })[0]; if (r) crud('characters', book, r, CHAR_F, 'الشخصية', again); }
  }

  /* ---------- الأفكار ---------- */
  var IDEA_F = [{ k: 'title', label: 'عنوان الفكرة', req: true }, { k: 'text', label: 'تفاصيل الفكرة', type: 'area', rows: 8 }];
  async function vIdeas(book, openId) {
    setChrome({ title: book.title, back: '#/', book: book, nav: 'ideas' });
    var items = await DB.byBook('ideas', book.id);
    var again = function () { history.replaceState(null, '', '#/b/' + book.id + '/ideas'); vIdeas(book); };
    listPage({
      items: items, addLabel: 'فكرة جديدة', eico: 'idea', empty: 'لا توجد أفكار', emptyHint: 'دوّن كل فكرة تخطر لك عن الرواية.', cls: 'frags', cardCls: 'frag',
      name: function (i) { return i.title; },
      search: function (i) { return i.title + ' ' + i.text; },
      render: function (i) { return '<div class="cb"><h3>' + esc(i.title) + '</h3><div class="snip">' + esc(snip(i.text, 140)) + '</div><div class="meta sm">' + U.ago(i.updated) + '</div></div>'; },
      onAdd: function () { crud('ideas', book, null, IDEA_F, 'فكرة', again); },
      onOpen: function (i) { crud('ideas', book, i, IDEA_F, 'الفكرة', again); }
    });
    if (openId) { var r = items.filter(function (i) { return i.id === openId; })[0]; if (r) crud('ideas', book, r, IDEA_F, 'الفكرة', again); }
  }

  /* ---------- عالم الرواية ---------- */
  var QUICK_CATS = ['الأماكن والمدن', 'الممالك والدول', 'الأدوات والأشياء', 'القوانين والأنظمة', 'العلاقات', 'المصطلحات', 'التاريخ والأحداث'];
  async function vWorld(book, catId, itemId) {
    setChrome({ title: book.title, back: '#/', book: book, nav: 'world' });
    var r = await Promise.all([DB.byBook('cats', book.id), DB.byBook('items', book.id)]);
    var cats = r[0].sort(function (a, b) { return a.created - b.created; }), items = r[1];
    var cur = cats.filter(function (c) { return c.id === catId; })[0] || null;
    var catOf = {}; cats.forEach(function (c) { catOf[c.id] = c; });
    var base = '#/b/' + book.id + '/world';
    var again = function () { history.replaceState(null, '', cur ? base + '/' + cur.id : base); vWorld(book, cur && cur.id); };
    var chips = '<div class="chips"><a class="chip ' + (!cur ? 'on' : '') + '" href="' + base + '">الكل <small>' + items.length + '</small></a>' +
      cats.map(function (c) { return '<a class="chip ' + (cur && cur.id === c.id ? 'on' : '') + '" href="' + base + '/' + c.id + '">' + esc(c.name) + ' <small>' + items.filter(function (i) { return i.catId === c.id; }).length + '</small></a>'; }).join('') +
      '<button class="chip add" id="addCat">+ تصنيف</button></div>' +
      (cur ? '<div class="cathead"><b>' + esc(cur.name) + '</b><span class="grow"></span><button class="btn sm" id="renCat">إعادة تسمية</button><button class="btn sm danger" id="delCat">حذف التصنيف</button></div>' : '');
    var shown = cur ? items.filter(function (i) { return i.catId === cur.id; }) : items;
    var form = function () {
      return [{ k: 'catId', label: 'التصنيف', type: 'select', options: cats.map(function (c) { return { v: c.id, l: c.name }; }) }, { k: 'name', label: 'الاسم', req: true }, { k: 'desc', label: 'الوصف', type: 'area', rows: 7 }];
    };
    async function addItem(it) {
      if (!cats.length) { U.toast('أنشئ تصنيفاً أولاً', 'err'); return $('#addCat') && $('#addCat').click(); }
      var vals = it || { catId: cur ? cur.id : cats[0].id };
      await crud('items', book, it, form(), it ? 'العنصر' : 'عنصر', again, vals);
    }
    listPage({
      head: chips, items: shown, addLabel: 'عنصر جديد', eico: 'world', cardCls: 'lore', empty: cur ? 'لا عناصر في هذا التصنيف' : (cats.length ? 'لا عناصر بعد' : 'ابدأ ببناء عالمك'),
      emptyHint: cats.length ? 'أضف عنصراً إلى التصنيف.' : 'أنشئ تصنيفاً (أماكن، قوانين، مصطلحات…) ثم أضف عناصره.',
      name: function (i) { return i.name; },
      search: function (i) { return i.name + ' ' + i.desc; },
      render: function (i) {
        var cn = (catOf[i.catId] && catOf[i.catId].name) || '';
        return '<div class="cb"><span class="seal" style="--h:' + hue(cn) + '" aria-hidden="true">' + esc(initial(cn || i.name)) + '</span><div class="grow"><h3>' + esc(i.name) + (!cur && cn ? ' <small>· ' + esc(cn) + '</small>' : '') + '</h3><div class="meta">' + esc(snip(i.desc, 110)) + '</div></div></div>';
      },
      onAdd: function () { addItem(null); },
      onOpen: function (i) { addItem(i); }
    });
    $('#addCat').onclick = async function () {
      var used = cats.map(function (c) { return c.name; });
      var sug = QUICK_CATS.filter(function (n) { return used.indexOf(n) < 0; });
      var name = await U.form('تصنيف جديد', [{ k: 'name', label: 'اسم التصنيف', req: true, ph: sug.slice(0, 2).join('، ') + '…' }], {}, { ok: 'إنشاء' });
      if (!name) return;
      try { var c = await DB.saveRec('cats', { bookId: book.id, name: name.name }); history.replaceState(null, '', base + '/' + c.id); vWorld(book, c.id); } catch (e) { U.toast('تعذّر الإنشاء: ' + e.message, 'err'); }
    };
    if (cur) {
      $('#renCat').onclick = async function () {
        var t = await U.prompt('إعادة تسمية التصنيف', cur.name, { label: 'الاسم' });
        if (t == null) return;
        try { cur.name = t; await DB.saveRec('cats', cur); again(); } catch (e) { U.toast('تعذّر الحفظ: ' + e.message, 'err'); }
      };
      $('#delCat').onclick = async function () {
        var n = items.filter(function (i) { return i.catId === cur.id; }).length, others = cats.filter(function (c) { return c.id !== cur.id; });
        try {
          if (!n) {
            if (!(await U.confirm('سيُحذف التصنيف «' + cur.name + '» (فارغ).', { danger: true, ok: 'حذف', title: 'حذف التصنيف' }))) return;
            await DB.deleteCat(cur, null);
          } else {
            var opts = [];
            if (others.length) opts.push({ v: 'move', label: 'نقل العناصر إلى تصنيف آخر ثم حذف', cls: 'primary' });
            opts.push({ v: 'del', label: 'حذف التصنيف مع عناصره (' + n + ')', cls: 'danger' });
            var a = await U.choice('حذف «' + cur.name + '»', 'يحتوي هذا التصنيف على ' + n + ' عنصر. لن تُحذف العناصر بصمت؛ اختر ما تريد:', opts);
            if (!a) return;
            if (a === 'move') {
              var t = await U.form('نقل العناصر', [{ k: 'to', label: 'انقل إلى', type: 'select', options: others.map(function (c) { return { v: c.id, l: c.name }; }) }], { to: others[0].id }, { ok: 'نقل وحذف' });
              if (!t) return; await DB.deleteCat(cur, t.to);
            } else {
              if (!(await U.confirm('سيُحذف التصنيف وعناصره الـ' + n + ' نهائياً.', { danger: true, ok: 'حذف الكل', title: 'تأكيد أخير' }))) return;
              await DB.deleteCat(cur, null);
            }
          }
          U.toast('تم حذف التصنيف'); history.replaceState(null, '', base); vWorld(book);
        } catch (e) { U.toast('تعذّر الحذف: ' + e.message, 'err'); }
      };
    }
    if (itemId) { var it = items.filter(function (i) { return i.id === itemId; })[0]; if (it) addItem(it); }
  }

  /* ---------- الإعدادات ---------- */
  async function vSettings() {
    setChrome({ title: 'الإعدادات', back: '#/' });
    var est = null; try { est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) { /* */ }
    var persisted = null; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { /* */ }
    var books = await DB.all('books');
    var curFont = U.FONTS[S.font] ? S.font : U.DEFAULT_FONT;
    var fontList = Object.keys(U.FONTS).map(function (k) {
      return '<label class="fopt' + (k === curFont ? ' on' : '') + '" data-font="' + k + '"><input type="radio" name="appFont" value="' + k + '"' + (k === curFont ? ' checked' : '') + '><span class="fname">' + (U.FONTS[k].name ? esc(U.FONTS[k].name) + ' · ' : '') + '<bdi dir="ltr">' + esc(U.FONTS[k].latin) + '</bdi></span><span class="fprev" aria-hidden="true">لورسيا — «كان يا ما كان»، ١٢٣ 456 Lorsia ؟!</span></label>';
    }).join('');
    viewEl.innerHTML = '<div class="page narrow"><section class="sec"><h4>خط التطبيق</h4><div class="fonts" role="radiogroup" aria-label="خط التطبيق">' + fontList + '</div><p class="muted sm">يُطبَّق الخط المختار على كل التطبيق (الواجهة والمحرر والقراءة). لا يغيّر نصوصك المحفوظة.</p></section>' +
      '<section class="sec"><h4>المكتبة</h4>' +
      '<label class="fld"><span>نمط عرض بطاقات الكتب</span><select id="sCols"><option value="1">بطاقة في كل صف</option><option value="2">بطاقتان في الصف</option></select></label>' +
      '<label class="fld"><span>ترتيب الكتب</span><select id="sSort"><option value="updated">الأحدث تعديلاً</option><option value="title">الاسم</option><option value="created">الأحدث إنشاءً</option></select></label></section>' +
      '<section class="sec"><h4>التخزين</h4><p class="muted sm">الكتب المخزنة: ' + books.length + '<br>المساحة المستخدمة: ' + (est && est.usage != null ? (est.usage / 1048576).toFixed(2) + ' م.ب' : 'غير متاح') + '<br>تخزين دائم: ' + (persisted === true ? 'مفعّل' : persisted === false ? 'غير مفعّل (يُنصح بنسخة احتياطية دورية)' : 'غير معروف') + '</p>' +
      '<p class="muted sm">بياناتك محفوظة على هذا الجهاز فقط. صدّر نسخة احتياطية بانتظام من صفحة «النسخ الاحتياطي».</p></section>' +
      '<section class="sec"><a class="btn" href="#/themes">الثيمات والمظهر</a> <a class="btn" href="#/backup">النسخ الاحتياطي والاستيراد</a></section></div>';
    $('#sCols').value = String(S.cols); $('#sSort').value = S.sort;
    viewEl.onchange = function (e) {
      var r = e.target; if (!r || r.name !== 'appFont') return;
      S.font = r.value; saveSettings(); // تبديل data-font فقط؛ بلا إعادة رسم الشاشة
      Array.prototype.forEach.call(viewEl.querySelectorAll('.fopt'), function (l) { l.classList.toggle('on', l.dataset.font === S.font); });
    };
    $('#sCols').onchange = function (e) { S.cols = +e.target.value; saveSettings(); };
    $('#sSort').onchange = function (e) { S.sort = e.target.value; saveSettings(); };
  }

  /* ---------- الثيمات ---------- */
  function vThemes() {
    setChrome({ title: 'الثيمات', back: '#/' });
    var a = S.adv;
    function sw(c) { return '<button class="swatch ' + ((a.accent || U.THEMES[S.theme].accent).toLowerCase() === c.toLowerCase() ? 'on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="لون ' + c + '"></button>'; }
    function opt(k, vals) { return '<div class="seg" data-k="' + k + '">' + vals.map(function (v) { return '<button class="' + ((a[k] || '') === v[0] ? 'on' : '') + '" data-v="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>'; }
    viewEl.innerHTML = '<div class="page narrow"><section class="sec"><h4>اختر ثيماً</h4><div class="themes">' +
      Object.keys(U.THEMES).map(function (k) { var t = U.THEMES[k]; return '<button class="tcard th-' + k + ' ' + (S.theme === k ? 'on' : '') + '" data-t="' + k + '"><div class="tprev"><span class="bar1"></span><div class="pg"><i class="ln"></i><i class="ln"></i><i class="ln"></i></div><span class="btnp"></span></div><b>' + t.name + '</b><small>' + t.desc + '</small></button>'; }).join('') + '</div></section>' +
      '<section class="sec"><label class="switch"><input type="checkbox" id="advOn" ' + (a.on ? 'checked' : '') + '><span>الإعدادات المتقدمة للثيم</span></label>' +
      '<div id="advBox" ' + (a.on ? '' : 'hidden') + '>' +
      '<div class="fld"><span>لون التمييز</span><div class="swatches">' + U.THEMES[S.theme].swatches.map(sw).join('') + '<input type="color" id="accCustom" value="' + (a.accent || U.THEMES[S.theme].accent) + '" aria-label="لون مخصص"></div></div>' +
      '<div class="fld"><span>الشريط العلوي</span>' + opt('hdr', [['', 'افتراضي'], ['accent', 'بلون التمييز'], ['plain', 'شفاف']]) + '</div>' +
      '<div class="fld"><span>كثافة الواجهة</span>' + opt('dens', [['', 'مريحة'], ['compact', 'مضغوطة']]) + '</div>' +
      '<div class="fld"><span>نمط بطاقات الكتب</span>' + opt('card', [['', 'عادي'], ['flat', 'مسطّح'], ['accent', 'شريط ملوّن']]) + '</div>' +
      '<label class="fld"><span>حجم خط الكتابة: <b id="szv">' + a.edSize + '</b></span><input type="range" id="edSize" min="16" max="28" value="' + a.edSize + '"></label>' +
      '<label class="fld"><span>تباعد الأسطر: <b id="lhv">' + a.edLh + '</b></span><input type="range" id="edLh" min="1.4" max="2.4" step="0.1" value="' + a.edLh + '"></label>' +
      '<div class="fld"><span>مكوّنات لوحة الكتاب (الترتيب والإظهار)</span><div id="dashList"></div></div>' +
      '<button class="btn" id="advReset">إعادة الإعدادات المتقدمة للافتراضي</button></div></section></div>';
    function drawDash() {
      $('#dashList').innerHTML = S.dash.order.map(function (k, i) {
        return '<div class="drow"><label><input type="checkbox" data-vis="' + k + '" ' + (S.dash.hidden.indexOf(k) < 0 ? 'checked' : '') + '> ' + DASH_NAMES[k] + '</label><span><button class="icon-btn" data-mv="' + i + '" data-d="-1" ' + (i === 0 ? 'disabled' : '') + '>' + ic('up') + '</button><button class="icon-btn" data-mv="' + i + '" data-d="1" ' + (i === S.dash.order.length - 1 ? 'disabled' : '') + '>' + ic('down') + '</button></span></div>';
      }).join('');
    }
    drawDash();
    viewEl.onclick = function (e) {
      var t = e.target.closest('[data-t]');
      if (t) { S.theme = t.dataset.t; S.adv.accent = ''; saveSettings(); return vThemes(); }
      var c = e.target.closest('.swatch'); if (c) { a.accent = c.dataset.c; saveSettings(); return vThemes(); }
      var sg = e.target.closest('.seg button'); if (sg) { a[sg.parentNode.dataset.k] = sg.dataset.v; saveSettings(); return vThemes(); }
      var mv = e.target.closest('[data-mv]');
      if (mv) { var i = +mv.dataset.mv, j = i + +mv.dataset.d, o = S.dash.order; var tmp = o[i]; o[i] = o[j]; o[j] = tmp; saveSettings(); drawDash(); }
    };
    viewEl.onchange = function (e) {
      var x = e.target;
      if (x.id === 'advOn') { a.on = x.checked; $('#advBox').hidden = !x.checked; saveSettings(); }
      else if (x.id === 'accCustom') { a.accent = x.value; saveSettings(); }
      else if (x.dataset.vis) { var h = S.dash.hidden, k = x.dataset.vis; if (x.checked) S.dash.hidden = h.filter(function (z) { return z !== k; }); else if (h.indexOf(k) < 0) h.push(k); saveSettings(); }
    };
    viewEl.oninput = function (e) {
      var x = e.target;
      if (x.id === 'edSize') { a.edSize = +x.value; $('#szv').textContent = x.value; saveSettings(); }
      if (x.id === 'edLh') { a.edLh = +x.value; $('#lhv').textContent = x.value; saveSettings(); }
    };
    $('#advReset').onclick = function () { S.adv = JSON.parse(JSON.stringify(DEFAULTS.adv)); S.adv.on = true; S.dash = JSON.parse(JSON.stringify(DEFAULTS.dash)); saveSettings(); vThemes(); };
  }

  /* ---------- النسخ الاحتياطي ---------- */
  function vBackup() {
    setChrome({ title: 'النسخ الاحتياطي', back: '#/' });
    viewEl.innerHTML = '<div class="page narrow"><section class="sec"><h4>تصدير نسخة احتياطية</h4><p class="muted sm">ملف JSON واحد يضم كل كتبك: الفصول والملاحظات والشخصيات والأفكار والعالم والإعدادات ومواضع الكتابة.</p><button class="btn primary" id="bkExp">تصدير نسخة احتياطية</button></section>' +
      '<section class="sec"><h4>استيراد نسخة احتياطية</h4><p class="muted sm">يُفحص الملف أولاً، ولا يُغيَّر شيء قبل تأكيدك.</p><button class="btn" id="bkImp">اختيار ملف نسخة احتياطية</button><input type="file" id="bkFile" accept=".json,application/json,text/plain" hidden><div id="bkMsg" class="muted sm pad"></div></section></div>';
    $('#bkExp').onclick = async function () {
      try {
        var data = await DB.exportAll();
        var d = new Date(), p2 = function (n) { return String(n).padStart(2, '0'); };
        var name = 'lorsia-backup-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.json';
        var r = await X.saveFile(name, 'application/json', new TextEncoder().encode(JSON.stringify(data)));
        if (r.ok) U.toast('تم تصدير النسخة الاحتياطية (' + data.books.length + ' كتاب)');
      } catch (e) { U.toast('تعذّر التصدير: ' + (e && e.message || e), 'err'); }
    };
    $('#bkImp').onclick = function () { $('#bkFile').value = ''; $('#bkFile').click(); };
    $('#bkFile').onchange = async function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      e.target.value = '';
      var msg = $('#bkMsg'); msg.innerHTML = '';
      function say(kind, html) { msg.innerHTML = '<div class="msg ' + kind + '">' + ic(kind === 'bad' ? 'warn' : 'check', 'sm') + '<div>' + html + '</div></div>'; }
      var data;
      try { data = JSON.parse(await f.text()); } catch (er) { say('bad', 'الملف تالف أو ليس JSON صالحاً. لم يتغيّر شيء.'); return U.toast('الملف تالف', 'err'); }
      var errs = DB.validateBackup(data);
      if (errs.length) { say('bad', 'تعذّر الاستيراد، لم يتغيّر شيء:<br>' + errs.map(esc).join('<br>')); return U.toast('ملف النسخة غير صالح', 'err'); }
      var sum = data.books.length + ' كتاب، ' + data.chapters.length + ' فصل، ' + data.characters.length + ' شخصية، ' + data.ideas.length + ' فكرة، ' + data.items.length + ' عنصر عالم';
      var mode = await U.choice('استيراد النسخة', 'الملف سليم ويحتوي: ' + sum + '. كيف تريد الاستيراد؟', [
        { v: 'merge', label: 'دمج مع بياناتي الحالية (آمن)', cls: 'primary' },
        { v: 'replace', label: 'استبدال كل بياناتي الحالية', cls: 'danger' }]);
      if (!mode) return;
      if (mode === 'replace' && !(await U.confirm('سيُمسح كل ما في لورسيا الآن ويُستبدل بمحتوى الملف. الأفضل تصدير نسخة من بياناتك الحالية أولاً. هل تتابع؟', { title: 'استبدال كامل', danger: true, ok: 'استبدال' }))) return;
      try {
        var rep = await DB.importBackup(data, mode);
        if (mode === 'replace') await loadSettings();
        say('good', 'تم الاستيراد: ' + rep.books + ' كتاب' + (rep.copies ? ' (منها ' + rep.copies + ' نسخة جديدة لأن معرّفها موجود)' : '') + '.');
        U.toast('تم الاستيراد بنجاح');
      } catch (er) { say('bad', 'فشل الاستيراد وأُلغيت العملية كاملة (لم تتغير بياناتك): ' + esc(er && er.message || er)); U.toast('فشل الاستيراد', 'err'); }
    };
  }

  /* ---------- لماذا صُنعت لورسيا؟ ---------- */
  function vWhy() {
    setChrome({ title: 'لماذا صُنعت لورسيا؟', back: '#/' });
    var w = window.LORSIA_WHY || { title: 'لماذا صُنعت لورسيا؟', paragraphs: [] };
    viewEl.innerHTML = '<div class="page narrow"><section class="sec why"><h2>' + esc(w.title) + '</h2>' + w.paragraphs.map(function (p) { return '<p dir="auto">' + esc(p) + '</p>'; }).join('') + '</section></div>';
  }

  /* ---------- الإقلاع ---------- */
  async function boot() {
    viewEl = $('#view'); topEl = $('#top'); navEl = $('#booknav'); titleEl = $('#title'); backEl = $('#backBtn');
    backEl.onclick = function () { var h = backEl.dataset.href; if (h) go(h); };
    $('#menuBtn').onclick = openDrawer;
    document.addEventListener('click', function (e) { var h = e.target.closest('[data-help]'); if (h && h.dataset.help) window.LHelp.open(h.dataset.help); });
    $('#drawer').onclick = function (e) { if (e.target.id === 'drawer' || e.target.closest('a')) closeDrawer(); };
    try {
      await DB.open();
    } catch (e) {
      viewEl.innerHTML = '<div class="empty">' + ic('warn', 'big') + '<h3>تعذّر فتح التخزين المحلي</h3><p>' + esc(e.message || e) + '</p><p>لن تُحفظ أي بيانات حتى يعمل التخزين.</p></div>';
      return;
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* */ }
    await loadSettings();
    routing = routing.then(route).catch(function (e) { console.error(e); showErr(e); });
    window.__lorsiaReady = true;
  }
  window.addEventListener('error', function (e) { console.error(e.error || e.message); });
  document.addEventListener('DOMContentLoaded', boot);
})();
