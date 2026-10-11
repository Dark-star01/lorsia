import sys, os, json, shutil, tempfile, re; sys.path.insert(0,'/home/claude/tests')
from common import *
from playwright.sync_api import sync_playwright
OUT='/home/claude/tests/out'; shutil.rmtree(OUT,ignore_errors=True); os.makedirs(OUT)
UD=tempfile.mkdtemp(); URL='http://127.0.0.1:8765/index.html'
srv=serve()
errs=[]; ext=[]
def opn(p, vp=(360,640)):
    ctx=p.chromium.launch_persistent_context(UD, viewport={'width':vp[0],'height':vp[1]}, locale='ar', accept_downloads=True)
    pg=ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('request',lambda r: ext.append(r.url) if not (r.url.startswith('http://127.0.0.1') or r.url.startswith('data:') or r.url.startswith('blob:')) else None)
    pg.goto(URL); pg.wait_for_function('window.__lorsiaReady===true'); return ctx,pg
def modal_fill(pg, **vals):
    for k,v in vals.items(): pg.fill(f'.modal-box [name="{k}"]', v)
    pg.click('.modal-box [data-ok]'); pg.wait_for_timeout(450)
def prompt(pg, text):
    pg.fill('.modal-box input', text); pg.click('.modal-box [data-ok]')
def hash_(pg): return pg.evaluate('location.hash')

LONG = '\n\n'.join(('هذه فقرة رقم %d من الفصل الطويل: الشمس تشرق على مدينة لورسيا، and the English line %d continues here، مع علامات ترقيم؛ «اقتباس» (قوسان) 123.' % (i,i))*3 for i in range(1,400))
AR_NAME = 'فصل: الحُلم الأوّل — "البداية" / مرحباً؟ *نجمة*'
with sync_playwright() as p:
    ctx,pg=opn(p)
    # 1) كتاب
    pg.click('#newBook'); prompt(pg,'رواية الاختبار الكبرى'); pg.wait_for_selector('.cont')
    bid=hash_(pg).split('/')[2]
    ctx.close(); ctx,pg=opn(p)
    check('T1 book survives restart','رواية الاختبار الكبرى' in pg.inner_text('#view'))
    # مكتبة: عمودان وحفظ النمط
    pg.click('#colsBtn'); pg.wait_for_timeout(500); check('T1b two-column mode', 'c2' in pg.get_attribute('#list','class'))
    ctx.close(); ctx,pg=opn(p); check('T1c cols pref persisted','c2' in pg.get_attribute('#list','class'))
    pg.click('#colsBtn')
    # 2) فصل طويل
    pg.click('.book'); pg.wait_for_selector('.cont'); pg.click('#booknav a:nth-child(2)'); pg.wait_for_selector('#newCh')
    pg.click('#newCh'); prompt(pg, AR_NAME); pg.wait_for_selector('#ta')
    cid=hash_(pg).split('/')[4]
    pg.fill('#ta', LONG)
    pg.evaluate("()=>{const t=document.getElementById('ta');t.setSelectionRange(40000,40000);t.scrollTop=5000;t.dispatchEvent(new Event('scroll'));t.dispatchEvent(new KeyboardEvent('keyup'))}")
    pg.click('#notesBtn'); pg.fill('#nta','ملاحظة الفصل الأول فقط')
    pg.wait_for_function("document.getElementById('st').textContent==='تم الحفظ'", timeout=8000)
    check('T2 save status shows saved', True)
    pg.click('#backBtn'); pg.wait_for_selector('.chap')
    ctx.close(); ctx,pg=opn(p)
    pg.goto(f'http://127.0.0.1:8765/index.html#/b/{bid}/c/{cid}'); pg.wait_for_selector('#ta'); pg.wait_for_timeout(600)
    v=pg.input_value('#ta'); check('T2 long chapter text identical after restart', v==LONG, (len(v),len(LONG)))
    st=pg.evaluate("()=>({s:document.getElementById('ta').selectionStart,t:document.getElementById('ta').scrollTop})")
    check('T3 caret restored', st['s']==40000, st); check('T3 scroll restored', abs(st['t']-5000)<60, st)
    pg.click('#notesBtn'); check('T4a notes restored', pg.input_value('#nta')=='ملاحظة الفصل الأول فقط')
    # فصل ثانٍ + عزل الملاحظات
    pg.click('#nClose'); pg.click('#backBtn'); pg.wait_for_selector('#newCh'); pg.click('#newCh'); prompt(pg,'الفصل الثاني'); pg.wait_for_selector('#ta')
    pg.fill('#ta','نص الثاني'); pg.click('#notesBtn'); check('T4b notes of ch2 empty (isolated)', pg.input_value('#nta')=='')
    pg.fill('#nta','ملاحظات الثاني'); pg.click('#nClose'); pg.click('#backBtn'); pg.wait_for_selector('.chap')
    pg.click('.chap:nth-child(1) .cb'); pg.wait_for_selector('#ta'); pg.click('#notesBtn')
    check('T4c ch1 notes unchanged', pg.input_value('#nta')=='ملاحظة الفصل الأول فقط'); pg.click('#nClose')
    # focus mode
    pg.click('#focusBtn'); check('focus hides header', not pg.is_visible('#top') and pg.is_visible('#unfocus'))
    check('focus keeps text', pg.input_value('#ta')==LONG)
    pg.click('#unfocus'); check('unfocus restores UI', pg.is_visible('#top'))
    # 8) تصدير
    pg.click('#expBtn'); 
    with pg.expect_download() as d: pg.click('.modal-box .btn:has-text("TXT")')
    dl=d.value; check('T8 txt filename uses chapter name', 'فصل' in dl.suggested_filename and dl.suggested_filename.endswith('.txt') and not re.search(r'[\\/:*?"<>|]',dl.suggested_filename), dl.suggested_filename)
    f=OUT+'/c.txt'; dl.save_as(f); t=open(f,encoding='utf-8-sig').read(); check('T8 txt content ok', LONG in t and t.startswith(AR_NAME))
    pg.click('#expBtn')
    with pg.expect_download() as d: pg.click('.modal-box .btn:has-text("MD")')
    dl=d.value; dl.save_as(OUT+'/c.md'); t=open(OUT+'/c.md',encoding='utf-8').read(); check('T8 md content ok', t.startswith('# '+AR_NAME) and 'الشمس تشرق' in t)
    pg.click('#expBtn')
    with pg.expect_download(timeout=60000) as d: pg.click('.modal-box .btn:has-text("PDF")')
    dl=d.value; dl.save_as(OUT+'/c.pdf'); check('T8 pdf downloaded', os.path.getsize(OUT+'/c.pdf')>5000, os.path.getsize(OUT+'/c.pdf'))
    # شخصيات وأفكار وعالم
    pg.click('#backBtn'); pg.wait_for_selector('.chap'); pg.click('#backBtn'); pg.wait_for_selector('.toolbar')
    pg.click('.book'); pg.wait_for_selector('.cont')
    pg.click('#booknav a:nth-child(3)'); pg.wait_for_selector('#add')
    for n in ['ليلى','Ahmad أحمد','سارة بنت عبد الله']:
        pg.click('#add'); modal_fill(pg,name=n,role='بطل',desc='وصف '+n); pg.wait_for_selector('.rec')
    check('T5 characters added', pg.locator('.rec').count()==3)
    pg.click('#booknav a:nth-child(4)'); pg.wait_for_selector('#add')
    for n in ['فكرة أولى','فكرة ثانية']:
        pg.click('#add'); modal_fill(pg,title=n,text='تفاصيل '+n)
    pg.wait_for_selector('.rec'); check('T5 ideas added', pg.locator('.rec').count()==2)
    pg.click('#booknav a:nth-child(5)'); pg.wait_for_selector('#addCat')
    pg.click('#addCat'); modal_fill(pg,name='الأماكن والمدن'); pg.wait_for_selector('.cathead')
    pg.click('#add'); modal_fill(pg,name='مدينة لورسيا',desc='عاصمة الشمال'); pg.wait_for_selector('.rec')
    pg.click('#add'); modal_fill(pg,name='قلعة الريح',desc='على الجبل'); pg.wait_for_timeout(300)
    pg.click('#addCat'); modal_fill(pg,name='القوانين'); pg.wait_for_selector('.cathead')
    pg.click('#add'); modal_fill(pg,name='قانون السحر',desc='ممنوع'); pg.wait_for_timeout(300)
    check('T5 world cat+items', pg.locator('.rec').count()==1)
    # حذف تصنيف فيه عناصر: يجب أن يظهر خيار وليس حذفًا صامتًا
    pg.click('#delCat'); txt=pg.inner_text('.modal-box'); check('T6 delete non-empty category warns with options', 'نقل العناصر' in txt and 'حذف التصنيف مع عناصره' in txt, txt)
    pg.click('.modal-box .btn:has-text("نقل العناصر")'); pg.click('.modal-box [data-ok]'); pg.wait_for_timeout(500)
    check('T6 move+delete category keeps items', 'قانون السحر' in pg.inner_text('#view') and pg.locator('.chip:not(.add):not(:has-text("الكل"))').count()==1, pg.inner_text('#view')[:200])
    # إعادة تسمية / حذف مع تأكيد
    pg.click('#booknav a:nth-child(3)'); pg.wait_for_selector('.rec'); pg.click('.rec >> nth=0')
    check('T6 edit form opens with delete', pg.is_visible('.modal-box [data-del]'))
    pg.fill('.modal-box [name=name]','ليلى المعدّلة'); pg.click('.modal-box [data-ok]'); pg.wait_for_timeout(300)
    check('T6 character renamed', 'ليلى المعدّلة' in pg.inner_text('#view'))
    pg.click('.rec >> nth=0'); pg.click('.modal-box [data-del]'); check('T6 delete asks confirmation', 'تأكيد الحذف' in pg.inner_text('.modal-box')); pg.click('.modal-box [data-no]')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # لوحة الكتاب
    pg.click('#booknav a:nth-child(1)'); pg.wait_for_selector('.cont'); d=pg.inner_text('#view')
    check('T-dash real data', 'الفصل الثاني' in d and 'ليلى المعدّلة' in d and 'فكرة ثانية' in d and 'فصل' in d, d[:400])
    check('T-dash continue goes to last chapter', pg.get_attribute('.cont a.btn','href').endswith('/c/'+cid))
    ctx.close()
    # إعادة فتح: كل شيء باقٍ
    ctx,pg=opn(p); pg.goto(f'http://127.0.0.1:8765/index.html#/b/{bid}/world'); pg.wait_for_selector('.chips'); pg.wait_for_timeout(300)
    check('T5 world persisted', 'قانون السحر' in pg.inner_text('#view') and 'مدينة لورسيا' in pg.inner_text('#view'))
    # 14) ثيم
    pg.goto('http://127.0.0.1:8765/index.html#/themes'); pg.wait_for_selector('.tcard'); pg.click('.th-night'); pg.wait_for_timeout(200)
    ctx.close(); ctx,pg=opn(p); check('T14 theme persisted', pg.get_attribute('html','data-theme')=='night')
    pg.goto('http://127.0.0.1:8765/index.html#/themes'); pg.wait_for_selector('.tcard'); pg.click('.th-modern')
    # 9/10) نسخ احتياطي
    pg.goto('http://127.0.0.1:8765/index.html#/backup'); pg.wait_for_selector('#bkExp')
    with pg.expect_download() as d: pg.click('#bkExp')
    dl=d.value; bk=OUT+'/backup.json'; dl.save_as(bk); data=json.load(open(bk,encoding='utf-8'))
    check('T9 backup file structured', data['app']=='lorsia' and data['schema']==1 and len(data['books'])==1 and len(data['chapters'])==2 and len(data['characters'])==3 and len(data['ideas'])==2 and len(data['items'])==3 and len(data['cats'])==1, {k:(len(v) if isinstance(v,list) else v) for k,v in data.items()})
    check('T9 backup has chapter text + notes + pos', any(b['text']==LONG and b['notes'] for b in data['bodies']) and any(c['pos']['sel']==40000 for c in data['chapters']))
    # ملف تالف
    open(OUT+'/bad1.json','w').write('{ not json')
    json.dump({'app':'lorsia','schema':1,'books':[{'id':'x','title':'y'}],'chapters':[{'id':'c','bookId':'ZZZ','title':'t'}],'bodies':[],'characters':[],'ideas':[],'cats':[],'items':[],'settings':[]},open(OUT+'/bad2.json','w'))
    json.dump({'app':'other'},open(OUT+'/bad3.json','w'))
    def books_count(): return pg.evaluate("()=>new Promise(r=>{const q=indexedDB.open('lorsia');q.onsuccess=()=>{const t=q.result.transaction('books').objectStore('books').count();t.onsuccess=()=>{r(t.result);q.result.close()}}})")
    for i,msg in [(1,'تالف'),(2,'غير موجود'),(3,'ليس نسخة')]:
        pg.set_input_files('#bkFile', OUT+f'/bad{i}.json'); pg.wait_for_timeout(500)
        check(f'T10 corrupt file {i} rejected', '❌' in pg.inner_text('#bkMsg') and not pg.is_visible('.modal-box'), pg.inner_text('#bkMsg'))
    check('T10 data intact after bad imports', books_count()==1)
    # دمج: يجب أن يُنشئ نسخة
    pg.set_input_files('#bkFile', bk); pg.wait_for_selector('.modal-box'); pg.click('.modal-box .btn:has-text("دمج")'); pg.wait_for_timeout(800)
    check('T9 merge duplicates as copy', books_count()==2 and 'نسخة جديدة' in pg.inner_text('#bkMsg'), pg.inner_text('#bkMsg'))
    # استبدال: ثم تحقق من النص
    pg.set_input_files('#bkFile', bk); pg.wait_for_selector('.modal-box'); pg.click('.modal-box .btn:has-text("استبدال")'); 
    check('T9 replace needs 2nd confirm', 'استبدال كامل' in pg.inner_text('.modal-box')); pg.click('.modal-box [data-ok]'); pg.wait_for_timeout(800)
    check('T9 replace restores 1 book', books_count()==1)
    pg.goto(f'http://127.0.0.1:8765/index.html#/b/{bid}/c/{cid}'); pg.wait_for_selector('#ta'); pg.wait_for_timeout(400)
    check('T9 restored chapter text identical', pg.input_value('#ta')==LONG)
    # 7) بلا إنترنت: أوقف الخادم بعد التحميل ثم نفّذ عمليات
    srv.shutdown(); srv.server_close()
    pg.click('#backBtn'); pg.wait_for_selector('#newCh'); pg.click('#newCh'); prompt(pg,'فصل بلا إنترنت'); pg.wait_for_selector('#ta'); pg.fill('#ta','يعمل دون خادم'); pg.wait_for_function("document.getElementById('st').textContent==='تم الحفظ'")
    check('T7 works with server+network down', True)
    check('T7 no external requests during whole run', not ext, ext)
    # 13) أبعاد صغيرة
    ctx.close(); srv=serve()
    ctx,pg=opn(p,(320,568))
    routes=['#/','#/settings','#/themes','#/backup','#/why',f'#/b/{bid}/home',f'#/b/{bid}/chapters',f'#/b/{bid}/c/{cid}',f'#/b/{bid}/chars',f'#/b/{bid}/ideas',f'#/b/{bid}/world']
    for r in routes:
        pg.goto('http://127.0.0.1:8765/index.html'+r); pg.wait_for_function('window.__lorsiaReady===true'); pg.wait_for_timeout(350)
        ov=pg.evaluate("()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})")
        off=pg.evaluate("""()=>[...document.querySelectorAll('button,a.btn,.fab,input,select,#booknav a')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<-1||r.right>innerWidth+1)&&!e.closest('.chips')}).map(e=>e.id||e.className||e.tagName)""")
        check(f'T13 320px no overflow {r.split("/")[-1] or "lib"}', ov['sw']<=ov['cw'] and not off, (ov,off))
        pg.screenshot(path=OUT+'/s320_'+re.sub(r'\W','_',r)[-14:]+'.png')
    check('no console/page errors', not errs, errs[:5])
    ctx.close()
print('\nTOTAL', sum(1 for _,c in RES if c), '/', len(RES))
sys.exit(0 if all(c for _,c in RES) else 1)
