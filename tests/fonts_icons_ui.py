# -*- coding: utf-8 -*-
"""اختبار المتصفح لميزتي: خط التطبيق + مزامنة أيقونة المشغّل (مع بلاجن وهمي). التشغيل: python3 tests/fonts_icons_ui.py
يقدّم lorsia-src/ محلياً ويفحص السلوك الفعلي في Chromium."""
import os, sys, json, threading, http.server, socketserver, functools
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright

SRC = str(Path(__file__).resolve().parent.parent / 'lorsia-src')
OUT = Path(os.environ.get('SHOTS', '/tmp')) ; OUT.mkdir(parents=True, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 8791), functools.partial(Q, directory=SRC))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:8791/index.html'
R = []
def check(n, c, info=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ((' — ' + str(info)) if (info and not c) else ''))

MIX = 'قَالَ الكاتبُ: «لورسيا» رائعة، صفحة ١٢٣ و 456 — Chapter 7 (draft) ؟!'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, locale='ar')
    pg = ctx.new_page(); errs = []; reqs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(BASE); pg.wait_for_selector('#view')
    pg.wait_for_function('window.LUI && document.querySelector("#view").children.length>0')

    fonts = pg.evaluate('Object.keys(LUI.FONTS)')
    check('registry lists fonts: %s' % fonts, len(fonts) >= 1)
    check('EXACTLY FIVE fonts bundled (requirement)', len(fonts) == 5, 'found %d' % len(fonts))

    # ملفات الخط موجودة محلياً
    css_urls = pg.evaluate("""()=>{const o=[];for(const s of document.styleSheets){for(const r of s.cssRules){if(r.type===CSSRule.FONT_FACE_RULE)o.push(r.style.getPropertyValue('src'))}}return o}""")
    import re, urllib.request
    files = [m for u in css_urls for m in re.findall(r'url\("?([^")]+)"?\)', u)]
    ok = all(urllib.request.urlopen('http://127.0.0.1:8791/css/' + f).status == 200 for f in files)
    check('all %d @font-face files resolve locally' % len(files), ok and len(files) >= 2 * len(fonts) - 0)

    # الإعدادات
    pg.goto(BASE + '#/settings'); pg.wait_for_selector('.fopt')
    check('settings has ONE font control titled «خط التطبيق»', pg.locator('.sec h4:has-text("خط التطبيق")').count() == 1 and pg.locator('[role=radiogroup]').count() == 1)
    check('control lists every registered font with a preview sample', pg.locator('.fopt').count() == len(fonts) and pg.locator('.fopt .fprev').count() == len(fonts))
    check('no upload/import control for fonts on settings or themes', pg.locator('input[type=file]').count() == 0)
    pg.goto(BASE + '#/themes'); pg.wait_for_selector('.themes'); n_file_themes = pg.locator('input[type=file]').count()
    check('no file input on themes page', n_file_themes == 0)
    check('only ONE app-font control (no per-section font controls)', pg.evaluate("document.querySelectorAll('[name=appFont]').length") == 0)  # themes page has none
    pg.goto(BASE + '#/settings'); pg.wait_for_selector('.fopt')
    check('exactly one font radio group on settings', pg.locator('[name=appFont]').count() == len(fonts))
    check('default font is naskh', pg.evaluate("document.documentElement.dataset.font") == 'naskh')

    fam = {'naskh': 'LorsiaNaskh', 'amiri': 'LorsiaAmiri', 'dejavu': 'LorsiaDejaVu', 'kufi': 'LorsiaKufi', 'nastaliq': 'LorsiaNastaliq'}
    # مشهد المحرر لقياس تطبيق الخط في كل الأقسام
    pg.goto(BASE + '#/'); pg.wait_for_selector('#newBook'); pg.click('#newBook'); pg.fill('.modal-box input', 'كتاب الخط'); pg.click('.modal-box [data-ok]'); pg.wait_for_selector('.cont')
    pg.click('.cont a.btn'); pg.fill('.modal-box input', 'فصل أول'); pg.click('.modal-box [data-ok]'); pg.wait_for_selector('#ta')
    long = ('\n'.join(MIX + ' ' + str(i) for i in range(80)))
    pg.fill('#ta', long); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{const t=document.querySelector('#ta');t.focus();t.setSelectionRange(40,77);t.scrollTop=700;window.__node=t;t.__tag='same-node';window.__ev={v:t.value,s:t.selectionStart,e:t.selectionEnd,top:t.scrollTop}}""")
    for f in fonts:
        before = pg.evaluate("window.__ev")
        pg.evaluate("f=>LUI.applyFont(f)", f); pg.wait_for_timeout(120)
        pg.evaluate("document.fonts.ready.then(()=>0)")
        st = pg.evaluate("""()=>{const t=document.querySelector('#ta');const g=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).fontFamily:null};
          return {tag:t.__tag,v:t.value===window.__ev.v,s:t.selectionStart,e:t.selectionEnd,top:t.scrollTop,focus:document.activeElement===t,
            body:g('body'),h1:g('#top h1'),ta:g('#ta'),btn:g('button'),data:document.documentElement.dataset.font}}""")
        want = fam.get(f, f)
        check('[%s] body/header/editor/buttons all use the one font stack' % f, all(st[k].startswith(want) for k in ('body', 'h1', 'ta', 'btn')), st)
        check('[%s] editor text, selection, scroll, focus and DOM node unchanged' % f, st['tag'] == 'same-node' and st['v'] and (st['s'], st['e']) == (before['s'], before['e']) and abs(st['top'] - before['top']) <= before['top'] * 0.02 and st['top'] > 0 and st['focus'], ({k: v for k, v in before.items() if k != 'v'}, {k: v for k, v in st.items() if k in ('tag', 's', 'e', 'top', 'focus')}))
        loaded = pg.evaluate("""f=>{const fam=({naskh:'LorsiaNaskh',amiri:'LorsiaAmiri',dejavu:'LorsiaDejaVu',kufi:'LorsiaKufi',nastaliq:'LorsiaNastaliq'})[f];return document.fonts.load('16px "'+fam+'"','ب').then(r=>r.length>0&&r.every(x=>x.status==='loaded'))}""", f)
        check('[%s] font file actually loaded by the browser' % f, loaded)
        pg.screenshot(path=str(OUT / ('editor-%s.png' % f)))
    pg.evaluate("LUI.applyFont('naskh')")

    # الإعدادات عبر الواجهة + الاستمرارية بعد إعادة التشغيل
    pg.goto(BASE + '#/settings'); pg.wait_for_selector('.fopt')
    node_mark = pg.evaluate("window.__mark=1")
    pg.click('.fopt[data-font=amiri]'); pg.wait_for_timeout(300)
    check('choosing a font in settings applies instantly without re-render', pg.evaluate("document.documentElement.dataset.font") == 'amiri' and pg.evaluate("window.__mark") == 1 and pg.locator('.fopt.on[data-font=amiri]').count() == 1)
    pg.screenshot(path=str(OUT / 'settings-amiri.png'))
    pg.evaluate("localStorage.removeItem('lorsia-font')")  # أثبت أن المصدر الحقيقي هو الإعدادات في IndexedDB
    pg.reload(); pg.wait_for_selector('.fopt'); pg.wait_for_timeout(400)
    check('selected font restored after restart (from IndexedDB prefs)', pg.evaluate("document.documentElement.dataset.font") == 'amiri' and pg.locator('.fopt.on[data-font=amiri]').count() == 1)
    prefs = pg.evaluate("""()=>new Promise(r=>{const q=indexedDB.databases?indexedDB.databases():Promise.resolve([]);q.then(ds=>{const d=ds[0];const o=indexedDB.open(d.name);o.onsuccess=()=>{const t=o.result.transaction('settings').objectStore('settings').get('prefs');t.onsuccess=()=>r(t.result&&t.result.value)}})})""")
    check('prefs.font persisted in DB', prefs and prefs.get('font') == 'amiri', prefs)
    check('theme preference untouched by font change', prefs and prefs.get('theme') == 'modern')
    # قيمة غير معروفة (نسخة قديمة/مستوردة) ترجع للافتراضي بدون خطأ
    pg.evaluate("LUI.applyFont('bogus')"); check('unknown font id falls back to default', pg.evaluate("document.documentElement.dataset.font") == 'naskh')
    pg.evaluate("LUI.applyFont('amiri')")
    # الفصل المحفوظ لم يتغيّر
    pg.goto(BASE + '#/'); pg.wait_for_selector('.book, .cont'); 
    t = pg.evaluate("""()=>new Promise(r=>{indexedDB.databases().then(ds=>{const o=indexedDB.open(ds[0].name);o.onsuccess=()=>{const q=o.result.transaction('bodies').objectStore('bodies').getAll();q.onsuccess=()=>r(q.result.map(x=>x.text||x.body||JSON.stringify(x)))}})})""")
    check('saved chapter text unchanged after font changes', any(MIX in x for x in t), [x[:60] for x in t])
    check('no external network requests (everything local)', all(u.startswith('http://127.0.0.1:8791') or u.startswith('data:') for u in reqs), [u for u in reqs if not u.startswith('http://127.0.0.1:8791')][:5])
    check('no console/page errors (fonts)', not errs, errs)

    # ---------- أيقونة المشغّل ----------
    errs.clear()
    ctx2 = b.new_context(viewport={'width': 390, 'height': 800}, locale='ar'); q = ctx2.new_page(); qerr = []
    q.on('pageerror', lambda e: qerr.append(str(e))); q.on('console', lambda m: qerr.append(m.text) if m.type == 'error' else None)
    q.add_init_script("""window.__calls=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LorsiaLauncherIcon:{setIcon:async o=>{window.__calls.push(o.theme);return {supported:true,theme:o.theme}},getIcon:async()=>({supported:true})}}};
      window.__setVis=v=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>v});document.dispatchEvent(new Event('visibilitychange'))};""")
    q.goto(BASE + '#/themes'); q.wait_for_selector('.tcard')
    q.click('.tcard[data-t=night]'); q.wait_for_timeout(200)
    check('theme change while app is visible does NOT call native yet (no disruption)', q.evaluate('window.__calls.length') == 0)
    q.evaluate("window.__setVis('hidden')"); q.wait_for_timeout(200)
    check('1st switch: night applied when app goes to background', q.evaluate('window.__calls') == ['night'], q.evaluate('window.__calls'))
    q.evaluate("window.__setVis('visible')"); q.click('.tcard[data-t=snow]'); q.wait_for_timeout(100); q.click('.tcard[data-t=library]'); q.wait_for_timeout(100)
    q.evaluate("window.__setVis('hidden')"); q.wait_for_timeout(200)
    check('2nd switch: only the final choice (library) applied', q.evaluate('window.__calls') == ['night', 'library'], q.evaluate('window.__calls'))
    q.evaluate("window.__setVis('visible')"); q.click('.tcard[data-t=modern]'); q.evaluate("window.__setVis('hidden')"); q.wait_for_timeout(200)
    check('3rd switch back to default theme (modern)', q.evaluate('window.__calls') == ['night', 'library', 'modern'], q.evaluate('window.__calls'))
    q.evaluate("window.__setVis('hidden')"); q.wait_for_timeout(100)
    check('no duplicate call when theme unchanged', q.evaluate('window.__calls.length') == 3)
    # مزامنة عند الإقلاع بالثيم المحفوظ
    q.evaluate("window.__setVis('visible')"); q.click('.tcard[data-t=night]'); q.wait_for_timeout(200)
    q.reload(); q.wait_for_selector('.tcard.on'); q.wait_for_timeout(300)
    q.evaluate("window.__setVis('hidden')"); q.wait_for_timeout(200)
    check('startup sync: saved theme (night) pushed to native after restart', q.evaluate('window.__calls') == ['night'], q.evaluate('window.__calls'))
    check('theme restored after restart', q.evaluate("document.documentElement.dataset.theme") == 'night')
    check('no errors (icons, native mock)', not qerr, qerr)
    # متصفح عادي بلا Capacitor: لا شيء ولا أخطاء
    ctx3 = b.new_context(); w = ctx3.new_page(); werr = []
    w.on('pageerror', lambda e: werr.append(str(e))); w.goto(BASE + '#/themes'); w.wait_for_selector('.tcard'); w.click('.tcard[data-t=night]')
    w.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))"); w.wait_for_timeout(150)
    check('plain web: no plugin, no errors', not werr, werr)
    # بلاجن موجود لكن البناء بلا aliases (supported:false) لا يكرّر ولا يخطئ
    ctx4 = b.new_context(); z = ctx4.new_page(); zerr = []
    z.on('pageerror', lambda e: zerr.append(str(e)))
    z.add_init_script("window.__n=0;window.Capacitor={isNativePlatform:()=>true,Plugins:{LorsiaLauncherIcon:{setIcon:async()=>{window.__n++;return {supported:false}}}}};")
    z.goto(BASE + '#/themes'); z.wait_for_selector('.tcard'); z.click('.tcard[data-t=snow]')
    for _ in range(3): z.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))"); z.wait_for_timeout(100)
    check('unsupported build (no aliases): single harmless call, no errors', z.evaluate('window.__n') == 1 and not zerr, (z.evaluate('window.__n'), zerr))
    b.close()
print('\n%d/%d passed' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
