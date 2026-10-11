/* لورسيا — مزامنة أيقونة المشغّل (أندرويد) مع الثيم المحفوظ
   - معرّف الثيم الثابت (modern | library | snow | night) هو نفسه المعرّف المحفوظ في الإعدادات، ويطابق اسم الـalias الأصلي.
   - على المتصفح العادي أو إن لم يكن البلاجن موجوداً: لا يحدث شيء.
   - التبديل الفعلي يُؤجَّل إلى لحظة خروج التطبيق للخلفية (visibilitychange/pagehide) كي لا يتأثر المحرر أو التنقل أثناء الاستخدام.
   - المشغّلات (Launchers) قد تتأخر في إظهار الأيقونة الجديدة؛ لا وعد بتحديث فوري. */
(function () {
  'use strict';
  var U = window.LUI; if (!U) return;
  var wanted = null, applied = null, inflight = false, plug = null;

  function plugin() {
    var C = window.Capacitor;
    if (!(C && C.isNativePlatform && C.isNativePlatform())) return null;
    // Capacitor 3+: الأحدث يمرّ عبر registerPlugin؛ نحتفظ بالمسار القديم Plugins.* احتياطاً
    return (C.Plugins && C.Plugins.LorsiaLauncherIcon) || (C.registerPlugin ? (plug || (plug = C.registerPlugin('LorsiaLauncherIcon'))) : null);
  }
  function flush() {
    var p = plugin();
    if (!p || !wanted || wanted === applied || inflight) return;
    var t = wanted; inflight = true;
    Promise.resolve(p.setIcon({ theme: t })).then(function (r) {
      if (r && r.supported === false) { applied = t; return; } // هذا البناء بلا أيقونات بديلة: لا نكرّر المحاولة
      applied = t;
    }).catch(function (e) {
      if (e && (e.code === 'UNIMPLEMENTED' || /not implemented/i.test(e.message || ''))) { applied = t; return; } // البناء بلا البلاجن: لا تكرار
      if (window.console) console.warn('launcher icon:', e && e.message ? e.message : e);
    }).then(function () { inflight = false; if (wanted !== applied && document.visibilityState === 'hidden') flush(); });
  }
  function onHide() { if (document.visibilityState === 'hidden') flush(); }

  U.syncLauncherIcon = function (theme) { wanted = theme; if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  U._launcherIconState = function () { return { wanted: wanted, applied: applied }; };
})();
