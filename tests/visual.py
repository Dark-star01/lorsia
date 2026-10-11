import sys,json,time,tempfile,re; sys.path.insert(0,'/home/claude/tests')
from common import *
from playwright.sync_api import sync_playwright
s=serve(); URL='http://127.0.0.1:8765/index.html'
errs=[]; BR=[None]
def fresh(p,vp=(360,640),**kw):
    if BR[0] is None: BR[0]=p.chromium.launch()
    ctx=BR[0].new_context(viewport={'width':vp[0],'height':vp[1]},locale='ar',**kw); pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.__lorsiaReady===true'); return ctx,pg
SEED=open('/home/claude/tests/shots2.py',encoding='utf-8').read().split('SEED="""')[1].split('"""')[0]
def go(pg,h):
    pg.goto(URL+h); pg.wait_for_function('window.__lorsiaReady===true'); pg.wait_for_timeout(450)
with sync_playwright() as p:
    ctx,pg=fresh(p); bid,cid=pg.evaluate(SEED)
    # --- المساعدة السياقية: كل شاشة، محتوى مختلف، فتح/إغلاق ---
    screens={'library':'#/','dashboard':f'#/b/{bid}/home','chapters':f'#/b/{bid}/chapters','editor':f'#/b/{bid}/c/{cid}','chars':f'#/b/{bid}/chars','ideas':f'#/b/{bid}/ideas','world':f'#/b/{bid}/world','settings':'#/settings','themes':'#/themes','backup':'#/backup'}
    titles={}
    for k,h in screens.items():
        go(pg,h); vis=pg.is_visible('#helpBtn'); 
        check(f'help button visible on {k}',vis)
        pg.click('#helpBtn'); pg.wait_for_selector('.help-box'); pg.wait_for_timeout(450); t=pg.inner_text('.help-box h3'); body=pg.inner_text('.help-box')
        titles[k]=t
        check(f'help {k} has purpose+steps+tip', 'الغرض' in body and 'كيف تستخدمها' in body and 'نصيحة' in body and pg.locator('.help-box li').count()>=2)
        box=pg.evaluate("()=>{const r=document.querySelector('.help-box').getBoundingClientRect();return [r.left,r.right,innerWidth,r.bottom,innerHeight]}")
        check(f'help {k} fits 360px screen', box[0]>=-1 and box[1]<=box[2]+1 and box[3]<=box[4]+1, box)
        pg.click('.help-box .btn.primary'); pg.wait_for_timeout(100); check(f'help {k} closes', pg.locator('.help-box').count()==0)
    check('help content differs per screen', len(set(titles.values()))==len(titles), titles)
    # مساعدة الملاحظات داخل المحرر + عدم فقدان النص
    go(pg,screens['editor']); before=pg.input_value('#ta'); pg.evaluate("()=>{const t=document.getElementById('ta');t.setSelectionRange(100,100)}")
    pg.fill('#ta',before+' إضافة'); pg.click('#notesBtn'); pg.click('#notesSheet [data-help=notes]'); pg.wait_for_selector('.help-box')
    check('notes help is notes-specific','ملاحظات الفصل' in pg.inner_text('.help-box h3'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check('help does not discard editor text', pg.input_value('#ta')==before+' إضافة')
    pg.wait_for_function("document.getElementById('st').textContent==='تم الحفظ'",timeout=6000)
    pg.reload(); pg.wait_for_selector('#ta'); pg.wait_for_timeout(400); check('text saved while help interplay', pg.input_value('#ta')==before+' إضافة')
    # --- الثيمات: تبديل + بقاء + عدم كسر العناصر ---
    for th in ['library','snow','night','modern']:
        go(pg,'#/themes'); pg.click(f'.th-{th}'); pg.wait_for_timeout(500)
        check(f'theme {th} applied', pg.get_attribute('html','data-theme')==th)
        go(pg,f'#/b/{bid}/home'); pg.click('#helpBtn'); pg.wait_for_selector('.help-box')
        bg=pg.evaluate("()=>getComputedStyle(document.querySelector('.help-box')).backgroundColor"); pg.keyboard.press('Escape')
        check(f'help dialog follows theme {th}', bg!='rgba(0, 0, 0, 0)')
    # --- حركة مخفّضة ---
    ctx2,pg2=fresh(p,reduced_motion='reduce'); bid2,_=pg2.evaluate(SEED); go(pg2,f'#/b/{bid2}/home')
    d=pg2.evaluate("()=>{const e=document.querySelector('.wall > *');const c=getComputedStyle(e);return [c.animationDuration,c.transitionDuration]}")
    check('prefers-reduced-motion disables animations', all(float(x.split(',')[0].strip().rstrip('ms'))<0.001 for x in d), d)
    ctx2.close()
    ctx3,pg3=fresh(p); bid3,_=pg3.evaluate(SEED); go(pg3,f'#/b/{bid3}/home')
    d=pg3.evaluate("()=>{const e=document.querySelector('.wall > *');return getComputedStyle(e).animationName}")
    check('animations active by default', d!='none', d); ctx3.close()
    # --- فيض أفقي على 320/360/412 لكل ثيم وكل شاشة ---
    bad=[]
    for vp in [(320,568),(360,640),(412,915)]:
        ctxv,pgv=fresh(p,vp); b4,c4=pgv.evaluate(SEED)
        rs=['#/','#/settings','#/themes','#/backup','#/why',f'#/b/{b4}/home',f'#/b/{b4}/chapters',f'#/b/{b4}/c/{c4}',f'#/b/{b4}/chars',f'#/b/{b4}/ideas',f'#/b/{b4}/world']
        for th in ['modern','library','snow','night']:
            for r in rs:
                pgv.goto(URL+r); pgv.wait_for_function('window.__lorsiaReady===true'); pgv.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",th); pgv.wait_for_timeout(120)
                ov=pgv.evaluate("()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]")
                if ov[0]>ov[1]: bad.append((vp,th,r.split('/')[-1],ov))
        # مكتبة بعمودين
        pgv.goto(URL+'#/'); pgv.wait_for_function('window.__lorsiaReady===true'); pgv.click('#colsBtn'); pgv.wait_for_timeout(300)
        ov=pgv.evaluate("()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        if ov[0]>ov[1]: bad.append((vp,'lib2col',ov))
        # قائمة التطبيق
        pgv.click('#menuBtn'); pgv.wait_for_timeout(400); okd=pgv.evaluate("()=>{const r=document.querySelector('.drawer-box').getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1}")
        if not okd: bad.append((vp,'drawer'))
        ctxv.close()
    check('no horizontal overflow: 320/360/412 x 4 themes x all screens', not bad, bad[:6])
    # --- أهداف اللمس ---
    ctx5,pg5=fresh(p,(360,640)); b5,c5=pg5.evaluate(SEED); small=[]
    for r in ['#/',f'#/b/{b5}/home',f'#/b/{b5}/chapters',f'#/b/{b5}/chars',f'#/b/{b5}/c/{c5}']:
        go(pg5,r)
        small+= [ (r.split('/')[-1],x) for x in pg5.evaluate("""()=>[...document.querySelectorAll('button,a.btn,#booknav a,select,.chip,.nrow,.sheet-row')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<36||r.width<36)}).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))""")]
    check('touch targets >= 36px', not small, small[:6])
    # --- لوحة المفاتيح: تقليص الارتفاع في المحرر ---
    ctx6,pg6=fresh(p,(360,640)); b6,c6=pg6.evaluate(SEED); go(pg6,f'#/b/{b6}/c/{c6}')
    pg6.set_viewport_size({'width':360,'height':300}); pg6.wait_for_timeout(300)
    tb=pg6.evaluate("()=>{const t=document.querySelector('.etools').getBoundingClientRect(),a=document.getElementById('ta').getBoundingClientRect();return [t.top,t.bottom,a.top,a.bottom,innerHeight]}")
    check('keyboard-sized viewport: toolbar visible & editor fits', tb[0]>=0 and tb[3]<=tb[4]+1 and tb[3]-tb[2]>100, tb)
    n0=len(pg6.input_value('#ta')); pg6.focus('#ta'); pg6.keyboard.type('x'); pg6.wait_for_timeout(100); check('typing works at small height', len(pg6.input_value('#ta'))==n0+1)
    # --- أداء الكتابة في فصل طويل ---
    pg6.set_viewport_size({'width':360,'height':640})
    pg6.evaluate("()=>{const t=document.getElementById('ta');t.value='نص طويل جداً. '.repeat(15000);t.dispatchEvent(new Event('input'));t.setSelectionRange(t.value.length,t.value.length)}"); pg6.wait_for_timeout(1500)
    pg6.focus('#ta'); t0=time.time(); pg6.keyboard.type('كتابة حقيقية على فصل طويل'*2); per=(time.time()-t0)/48*1000
    check('real typing on ~200k-char chapter stays responsive (<80ms/char incl. driver)', per<80, round(per,1))
    # --- شارة الحفظ لا تغيّر أبعاد المحرر ---
    r1=pg6.evaluate("()=>{const t=document.getElementById('ta').getBoundingClientRect();return [t.width,t.height,t.top]}"); pg6.fill('#ta','ا'); pg6.wait_for_timeout(1500); r2=pg6.evaluate("()=>{const t=document.getElementById('ta').getBoundingClientRect();return [t.width,t.height,t.top]}")
    check('editor box stable during save feedback', r1==r2, (r1,r2))
    check('no console errors', not errs, errs[:4])
print('\nTOTAL', sum(1 for _,c in RES if c), '/', len(RES)); sys.exit(0 if all(c for _,c in RES) else 1)
