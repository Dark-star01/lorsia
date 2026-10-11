import sys,base64,json; sys.path.insert(0,'/home/claude/tests')
from common import *
from playwright.sync_api import sync_playwright
s=serve('/home/claude/sim/www',8766)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':360,'height':700},locale='ar'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    calls=[]
    pg.add_init_script("""window.Capacitor={isNativePlatform:()=>true,Plugins:{LorsiaFileSaver:{save:async o=>{window.__saved=window.__saved||[];window.__saved.push(o);if(o.filename.endsWith('.cancel'))throw new Error('cancelled');return {uri:'content://fake/'+o.filename}}}}};""")
    pg.goto('http://127.0.0.1:8766/index.html'); pg.wait_for_function('window.__lorsiaReady===true')
    pg.wait_for_timeout(3000)
    check('splash removed after duration', pg.evaluate("!document.getElementById('ds')") or not pg.evaluate("(()=>{const e=document.getElementById('ds');return e&&getComputedStyle(e).opacity!=='0'})()"))
    pg.click('#newBook'); pg.fill('.modal-box input','كتاب'); pg.click('.modal-box [data-ok]'); pg.wait_for_selector('.cont')
    check('app usable with splash injected', True)
    pg.click('.cont a.btn'); pg.fill('.modal-box input','فصل الأصلي'); pg.click('.modal-box [data-ok]'); pg.wait_for_selector('#ta')
    T='نص عربي طويل.\nEnglish line.'; pg.fill('#ta',T)
    for fmt,ext in [('TXT','txt'),('MD','md'),('PDF','pdf')]:
        pg.click('#expBtn'); pg.click(f'.modal-box .btn:has-text("{fmt}")'); pg.wait_for_function(f"(window.__saved||[]).some(o=>o.filename.endsWith('.{ext}'))",timeout=60000)
    sv=pg.evaluate('window.__saved'); 
    check('native saver called 3x with names', [o['filename'] for o in sv]==['فصل الأصلي.txt','فصل الأصلي.md','فصل الأصلي.pdf'], [o['filename'] for o in sv])
    raw={o['filename'].split('.')[-1]:base64.b64decode(o['data']) for o in sv}
    check('native txt bytes ok', T in raw['txt'].decode('utf-8-sig')); check('native pdf bytes valid', raw['pdf'][:5]==b'%PDF-' and raw['pdf'].rstrip().endswith(b'%%EOF'))
    check('native mime passed', sv[2]['mime']=='application/pdf')
    pg.click('#backBtn'); pg.click('#backBtn'); pg.wait_for_selector('.book')
    pg.goto('http://127.0.0.1:8766/index.html#/backup'); pg.wait_for_selector('#bkExp'); pg.click('#bkExp'); pg.wait_for_function("window.__saved.length>=4")
    bk=json.loads(base64.b64decode(pg.evaluate('window.__saved[3].data'))); check('native backup json valid', bk['app']=='lorsia' and len(bk['books'])==1)
    check('no errors', not errs, errs)
