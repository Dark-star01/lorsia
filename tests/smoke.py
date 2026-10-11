import sys; sys.path.insert(0,'/home/claude/tests')
from common import *
from playwright.sync_api import sync_playwright
s=serve()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':360,'height':640}, locale='ar'); pg=ctx.new_page()
    errs=[]; pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
    reqs=[]; pg.on('request',lambda r: reqs.append(r.url))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function('window.__lorsiaReady===true')
    check('empty library shown', 'مكتبتك فارغة' in pg.inner_text('#view'))
    pg.click('#newBook'); pg.fill('.modal-box input','رواية الاختبار'); pg.click('.modal-box [data-ok]')
    pg.wait_for_selector('.cont'); check('dashboard opens after create', 'رواية الاختبار' in pg.inner_text('#title'))
    print(pg.inner_text('#view')[:200])
    check('no console errors', not errs, errs)
    check('no external requests', all(u.startswith('http://127.0.0.1') or u.startswith('data:') for u in reqs), [u for u in reqs if not u.startswith('http://127.0.0.1')])
    pg.screenshot(path='/home/claude/tests/s1.png')
    b.close()
