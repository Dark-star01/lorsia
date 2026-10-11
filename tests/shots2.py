import sys,json; sys.path.insert(0,'/home/claude/tests')
from common import *
from playwright.sync_api import sync_playwright
from PIL import Image
s=serve(); OUT='/home/claude/tests/out/v/'; import os; os.makedirs(OUT,exist_ok=True)
SEED="""async()=>{const T='كان الليل قد أرخى سدوله على مدينة لورسيا، وكانت ليلى تقف عند النافذة.\\n\\n"Where are you going?" she whispered.\\n\\nلم يجب أحد، فقط صدى الريح بين الأبراج.';
const b=await LDB.createBook('أسطورة لورسيا');await LDB.createBook('ظلال الشمال');await LDB.createBook('The Last Lighthouse');await LDB.createBook('رحلة إلى ما وراء الجبال البعيدة والغيوم');
const w=[1200,640,2400];const c=[];for(const [i,t] of ['الفصل الأول: الوصول','الفصل الثاني','الفصل الثالث: العاصفة'].entries()){const x=await LDB.createChapter(b.id,t);await LDB.saveChapter(x.id,{text:T.repeat(w[i]/20|1)});c.push(x)}
for(const [n,r,d] of [['ليلى','بطلة','فتاة شجاعة من الشمال تحمل سرّاً قديماً'],['Ahmad أحمد','خصم','قائد الحرس الملكي'],['سارة','صديقة','طبيبة القرية']])await LDB.saveRec('characters',{bookId:b.id,name:n,role:r,age:'٢٥',desc:d});
for(const [n,d] of [['سر الأبراج','الأبراج تهمس عند الفجر وتكشف طريق العودة'],['نهاية مفتوحة','ماذا لو لم تعد ليلى؟'],['رسالة قديمة','رسالة مدفونة تحت الشجرة']])await LDB.saveRec('ideas',{bookId:b.id,title:n,text:d});
const k=await LDB.saveRec('cats',{bookId:b.id,name:'الأماكن والمدن'});const k2=await LDB.saveRec('cats',{bookId:b.id,name:'القوانين'});
await LDB.saveRec('items',{bookId:b.id,catId:k.id,name:'مدينة لورسيا',desc:'عاصمة الشمال'});await LDB.saveRec('items',{bookId:b.id,catId:k2.id,name:'قانون السحر',desc:'ممنوع إلا بإذن'});
return [b.id,c[0].id]}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':720},locale='ar')
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function('window.__lorsiaReady===true')
    bid,cid=pg.evaluate(SEED)
    def shot(name,h,theme='modern',wait=900,full=False):
        pg.goto('http://127.0.0.1:8765/index.html'+h); pg.wait_for_function('window.__lorsiaReady===true'); pg.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme); pg.wait_for_timeout(wait)
        pg.screenshot(path=OUT+name+'.png',full_page=full)
    shot('lib1','#/'); 
    pg.click('#colsBtn'); pg.wait_for_timeout(600); pg.screenshot(path=OUT+'lib2.png')
    pg.click('#colsBtn')
    shot('dash',f'#/b/{bid}/home',full=True); shot('chars',f'#/b/{bid}/chars'); shot('ideas',f'#/b/{bid}/ideas'); shot('world',f'#/b/{bid}/world'); shot('chaps',f'#/b/{bid}/chapters'); shot('editor',f'#/b/{bid}/c/{cid}')
    pg.click('#helpBtn'); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'help.png'); pg.keyboard.press('Escape')
    shot('themes','#/themes'); shot('backup','#/backup')
    for th in ['library','snow','night']:
        shot('dash_'+th,f'#/b/{bid}/home',th,full=True); shot('lib_'+th,'#/',th)
    def sheet(names,out,cols):
        ims=[Image.open(OUT+n+'.png') for n in names]; w=max(i.width for i in ims); h=max(i.height for i in ims)
        rows=(len(ims)+cols-1)//cols; sh=Image.new('RGB',(w*cols,h*rows),'white')
        for i,im in enumerate(ims): sh.paste(im,((i%cols)*w,(i//cols)*h))
        sh.save(OUT+out+'.png'); print(out,sh.size)
    sheet(['lib1','lib2','dash'],'A',3); sheet(['chars','ideas','world','chaps'],'B',4); sheet(['editor','help','themes','backup'],'C',4); sheet(['dash_library','dash_snow','dash_night','lib_night'],'D',4)
