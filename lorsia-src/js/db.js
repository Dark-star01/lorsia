/* لورسيا — طبقة البيانات (IndexedDB). لا تعتمد على أي خدمة خارجية. */
(function () {
  'use strict';
  var DB_NAME = 'lorsia', DB_VER = 1, SCHEMA = 1;
  var db = null;
  var BOOK_STORES = ['chapters', 'characters', 'ideas', 'cats', 'items'];
  var ALL = ['books', 'chapters', 'bodies', 'characters', 'ideas', 'cats', 'items', 'settings'];

  function uid() {
    var a = new Uint8Array(9);
    crypto.getRandomValues(a);
    return Date.now().toString(36) + Array.prototype.map.call(a, function (b) { return b.toString(36).padStart(2, '0'); }).join('').slice(0, 10);
  }
  function now() { return Date.now(); }

  function open() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('IndexedDB غير متاح'));
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function (e) {
        var d = r.result, old = e.oldVersion;
        // الترحيل: كل إصدار جديد يضيف شرطاً هنا دون حذف بيانات
        if (old < 1) {
          d.createObjectStore('books', { keyPath: 'id' });
          BOOK_STORES.forEach(function (s) { d.createObjectStore(s, { keyPath: 'id' }).createIndex('bookId', 'bookId'); });
          d.createObjectStore('bodies', { keyPath: 'id' });
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      r.onsuccess = function () {
        db = r.result;
        db.onversionchange = function () { db.close(); };
        res(db);
      };
      r.onerror = function () { rej(r.error || new Error('تعذر فتح قاعدة البيانات')); };
      r.onblocked = function () { rej(new Error('قاعدة البيانات مقفلة بنافذة أخرى')); };
    });
  }

  function req(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  // عملية واحدة ذرّية: تنجح كلها أو تُلغى كلها
  function run(stores, mode, fn) {
    return new Promise(function (res, rej) {
      var t, out;
      try { t = db.transaction(stores, mode, { durability: 'strict' }); }
      catch (e) { try { t = db.transaction(stores, mode); } catch (e2) { return rej(e2); } }
      t.oncomplete = function () { res(out); };
      t.onerror = function () { rej(t.error || new Error('خطأ تخزين')); };
      t.onabort = function () { rej(t.error || new Error('أُلغيت عملية التخزين')); };
      Promise.resolve().then(function () { return fn(t); }).then(function (v) { out = v; }, function (e) {
        try { t.abort(); } catch (x) { /* */ }
        rej(e);
      });
    });
  }

  function words(text) {
    var m = String(text || '').match(/\S+/g);
    return m ? m.length : 0;
  }

  var D = {
    uid: uid, words: words, SCHEMA: SCHEMA, ALL: ALL,
    open: open,
    get: function (s, id) { return run([s], 'readonly', function (t) { return req(t.objectStore(s).get(id)); }); },
    all: function (s) { return run([s], 'readonly', function (t) { return req(t.objectStore(s).getAll()); }); },
    byBook: function (s, bookId) {
      return run([s], 'readonly', function (t) { return req(t.objectStore(s).index('bookId').getAll(bookId)); });
    },

    /* ---- الكتب ---- */
    createBook: function (title) {
      var b = { id: uid(), title: title, created: now(), updated: now(), lastChapterId: null };
      return run(['books'], 'readwrite', function (t) { t.objectStore('books').put(b); }).then(function () { return b; });
    },
    patchBook: function (id, patch) {
      return run(['books'], 'readwrite', function (t) {
        var s = t.objectStore('books');
        return req(s.get(id)).then(function (b) {
          if (!b) throw new Error('الكتاب غير موجود');
          Object.assign(b, patch);
          s.put(b);
          return b;
        });
      });
    },
    deleteBook: function (id) {
      return run(ALL.filter(function (s) { return s !== 'settings'; }), 'readwrite', function (t) {
        var chain = [];
        BOOK_STORES.forEach(function (s) {
          chain.push(req(t.objectStore(s).index('bookId').getAllKeys(id)).then(function (keys) {
            keys.forEach(function (k) {
              t.objectStore(s).delete(k);
              if (s === 'chapters') t.objectStore('bodies').delete(k);
            });
          }));
        });
        return Promise.all(chain).then(function () { t.objectStore('books').delete(id); });
      });
    },

    /* ---- سجلات عامة تتبع كتاباً (شخصيات/أفكار/تصنيفات/عناصر) ---- */
    saveRec: function (store, rec) {
      return run([store, 'books'], 'readwrite', function (t) {
        rec.updated = now();
        if (!rec.id) rec.id = uid();
        if (!rec.created) rec.created = rec.updated;
        t.objectStore(store).put(rec);
        return req(t.objectStore('books').get(rec.bookId)).then(function (b) {
          if (b) { b.updated = rec.updated; t.objectStore('books').put(b); }
          return rec;
        });
      });
    },
    delRec: function (store, rec) {
      return run([store, 'books'], 'readwrite', function (t) {
        t.objectStore(store).delete(rec.id);
        return req(t.objectStore('books').get(rec.bookId)).then(function (b) {
          if (b) { b.updated = now(); t.objectStore('books').put(b); }
        });
      });
    },
    // حذف تصنيف: إما نقل عناصره إلى تصنيف آخر أو حذفها معه
    deleteCat: function (cat, moveToId) {
      return run(['cats', 'items', 'books'], 'readwrite', function (t) {
        return req(t.objectStore('items').index('bookId').getAll(cat.bookId)).then(function (items) {
          items.filter(function (i) { return i.catId === cat.id; }).forEach(function (i) {
            if (moveToId) { i.catId = moveToId; i.updated = now(); t.objectStore('items').put(i); }
            else t.objectStore('items').delete(i.id);
          });
          t.objectStore('cats').delete(cat.id);
        });
      });
    },

    /* ---- الفصول ---- */
    createChapter: function (bookId, title) {
      return run(['chapters', 'bodies', 'books'], 'readwrite', function (t) {
        return req(t.objectStore('chapters').index('bookId').getAll(bookId)).then(function (list) {
          var order = list.reduce(function (m, c) { return Math.max(m, c.order); }, 0) + 1;
          var c = { id: uid(), bookId: bookId, title: title, order: order, created: now(), updated: now(), words: 0, pos: { sel: 0, scroll: 0 } };
          t.objectStore('chapters').put(c);
          t.objectStore('bodies').put({ id: c.id, text: '', notes: '' });
          return req(t.objectStore('books').get(bookId)).then(function (b) {
            if (b) { b.updated = c.updated; b.lastChapterId = c.id; t.objectStore('books').put(b); }
            return c;
          });
        });
      });
    },
    renameChapter: function (id, title) {
      return run(['chapters'], 'readwrite', function (t) {
        var s = t.objectStore('chapters');
        return req(s.get(id)).then(function (c) { c.title = title; c.updated = now(); s.put(c); return c; });
      });
    },
    getBody: function (id) {
      return D.get('bodies', id).then(function (b) { return b || { id: id, text: '', notes: '' }; });
    },
    // حفظ نص الفصل و/أو ملاحظاته و/أو موضع الكتابة في عملية واحدة
    saveChapter: function (id, patch) {
      return run(['chapters', 'bodies', 'books'], 'readwrite', function (t) {
        return Promise.all([req(t.objectStore('chapters').get(id)), req(t.objectStore('bodies').get(id))]).then(function (r) {
          var c = r[0], b = r[1] || { id: id, text: '', notes: '' };
          if (!c) throw new Error('الفصل غير موجود (ربما حُذف)');
          var contentChanged = false;
          if (patch.text !== undefined && patch.text !== b.text) { b.text = patch.text; c.words = words(b.text); contentChanged = true; }
          if (patch.notes !== undefined && patch.notes !== b.notes) { b.notes = patch.notes; contentChanged = true; }
          if (patch.pos) c.pos = patch.pos;
          if (contentChanged) c.updated = now();
          t.objectStore('bodies').put(b);
          t.objectStore('chapters').put(c);
          return req(t.objectStore('books').get(c.bookId)).then(function (bk) {
            if (bk) {
              if (contentChanged) bk.updated = c.updated;
              bk.lastChapterId = id;
              t.objectStore('books').put(bk);
            }
            return c;
          });
        });
      });
    },
    reorderChapters: function (bookId, ids) {
      return run(['chapters'], 'readwrite', function (t) {
        var s = t.objectStore('chapters');
        return Promise.all(ids.map(function (id, i) {
          return req(s.get(id)).then(function (c) { if (c) { c.order = i + 1; s.put(c); } });
        }));
      });
    },
    deleteChapter: function (c) {
      return run(['chapters', 'bodies', 'books'], 'readwrite', function (t) {
        t.objectStore('chapters').delete(c.id);
        t.objectStore('bodies').delete(c.id);
        return req(t.objectStore('books').get(c.bookId)).then(function (b) {
          if (b) { b.updated = now(); if (b.lastChapterId === c.id) b.lastChapterId = null; t.objectStore('books').put(b); }
        });
      });
    },

    /* ---- الإعدادات ---- */
    getSetting: function (k, def) {
      return D.get('settings', k).then(function (r) { return r ? r.value : def; }).catch(function () { return def; });
    },
    setSetting: function (k, v) {
      return run(['settings'], 'readwrite', function (t) { t.objectStore('settings').put({ key: k, value: v }); });
    },

    /* ---- النسخ الاحتياطي ---- */
    exportAll: function () {
      return run(ALL, 'readonly', function (t) {
        var out = { app: 'lorsia', schema: SCHEMA, exported: new Date().toISOString() };
        return Promise.all(ALL.map(function (s) {
          return req(t.objectStore(s).getAll()).then(function (v) { out[s] = v; });
        })).then(function () { return out; });
      });
    },

    // تحقق صارم قبل أي كتابة. يرجع قائمة أخطاء (فارغة = سليم)
    validateBackup: function (o) {
      var err = [];
      function isArr(k) { if (!Array.isArray(o[k])) { err.push('الحقل «' + k + '» مفقود أو غير صالح'); return false; } return true; }
      if (!o || typeof o !== 'object' || Array.isArray(o)) return ['الملف ليس نسخة احتياطية صالحة'];
      if (o.app !== 'lorsia') return ['هذا الملف ليس نسخة احتياطية من لورسيا'];
      if (typeof o.schema !== 'number') return ['رقم إصدار النسخة مفقود'];
      if (o.schema > SCHEMA) return ['النسخة أحدث من هذا التطبيق (إصدار ' + o.schema + ')، حدّث التطبيق أولاً'];
      ALL.forEach(isArr);
      if (err.length) return err;
      var ids = {};
      o.books.forEach(function (b, i) {
        if (!b || typeof b.id !== 'string' || typeof b.title !== 'string') err.push('كتاب رقم ' + (i + 1) + ' تالف');
        else ids[b.id] = true;
      });
      var chIds = {};
      BOOK_STORES.forEach(function (s) {
        o[s].forEach(function (r, i) {
          if (!r || typeof r.id !== 'string' || typeof r.bookId !== 'string') err.push('سجل تالف في «' + s + '» رقم ' + (i + 1));
          else if (!ids[r.bookId]) err.push('سجل في «' + s + '» يشير إلى كتاب غير موجود');
          else if (s === 'chapters') {
            if (typeof r.title !== 'string') err.push('فصل بلا عنوان صالح');
            chIds[r.id] = true;
          }
        });
      });
      o.bodies.forEach(function (b, i) {
        if (!b || typeof b.id !== 'string' || typeof (b.text === undefined ? '' : b.text) !== 'string') err.push('نص فصل تالف رقم ' + (i + 1));
        else if (!chIds[b.id]) err.push('نص يشير إلى فصل غير موجود');
      });
      o.items.forEach(function (it) {
        if (it && it.catId && !o.cats.some(function (c) { return c.id === it.catId; })) err.push('عنصر عالم يشير إلى تصنيف غير موجود');
      });
      return err.slice(0, 8);
    },

    // mode: 'merge' (يضيف، ويُنشئ نسخة جديدة عند تكرار المعرّف) أو 'replace' (يستبدل كل شيء)
    importBackup: function (o, mode) {
      return run(ALL, 'readwrite', function (t) {
        var chain = Promise.resolve();
        var report = { books: 0, copies: 0 };
        if (mode === 'replace') {
          ALL.forEach(function (s) { chain = chain.then(function () { return req(t.objectStore(s).clear()); }); });
        }
        return chain.then(function () { return req(t.objectStore('books').getAllKeys()); }).then(function (existing) {
          var have = {}; existing.forEach(function (k) { have[k] = true; });
          var remap = {};
          o.books.forEach(function (b) {
            var dup = !!have[b.id];
            var nb = Object.assign({}, b);
            if (dup) { nb.id = uid(); nb.title = b.title + ' (نسخة مستوردة)'; report.copies++; }
            remap[b.id] = nb.id;
            nb.updated = nb.updated || now();
            t.objectStore('books').put(nb);
            report.books++;
          });
          var idMap = {};
          function mapId(id) { return idMap[id] || id; }
          var catMap = {};
          BOOK_STORES.forEach(function (s) {
            o[s].forEach(function (r) {
              var n = Object.assign({}, r);
              n.bookId = remap[r.bookId];
              if (remap[r.bookId] !== r.bookId) { n.id = uid(); idMap[r.id] = n.id; }
              if (s === 'cats') catMap[r.id] = n.id;
            });
          });
          BOOK_STORES.forEach(function (s) {
            o[s].forEach(function (r) {
              var n = Object.assign({}, r);
              n.bookId = remap[r.bookId];
              n.id = mapId(r.id);
              if (s === 'items') n.catId = mapId(r.catId);
              t.objectStore(s).put(n);
            });
          });
          o.bodies.forEach(function (b) { t.objectStore('bodies').put({ id: mapId(b.id), text: b.text || '', notes: b.notes || '' }); });
          o.books.forEach(function (b) {
            if (remap[b.id] !== b.id && b.lastChapterId) {
              req(t.objectStore('books').get(remap[b.id])).then(function (nb) { nb.lastChapterId = mapId(b.lastChapterId); t.objectStore('books').put(nb); });
            }
          });
          if (mode === 'replace') o.settings.forEach(function (s) { if (s && typeof s.key === 'string') t.objectStore('settings').put(s); });
          return report;
        });
      });
    }
  };
  window.LDB = D;
})();
