import sys; sys.path.insert(0,'/home/claude/tests')
from common import *
from playwright.sync_api import sync_playwright
def lum(c):
    if len(c)==4: c='#'+''.join(x*2 for x in c[1:])
    r,g,b=[int(c[i:i+2],16)/255 for i in (1,3,5)]
    f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
s=serve()
PAIRS=[('text','bg'),('text','surface'),('muted','bg'),('muted','surface'),('muted','surface2'),('on-accent','accent'),('accent','surface'),('accent','bg'),('paper-text','paper'),('hdr-text','hdr'),('danger','surface'),('ok','surface'),('text','note-bg'),('text','note-1'),('text','note-2'),('text','note-3'),('cv-ink','cv')]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function('window.__lorsiaReady===true')
    for th in ['modern','library','snow','night']:
        v=pg.evaluate("""t=>{document.documentElement.setAttribute('data-theme',t);const s=getComputedStyle(document.documentElement);const o={};['bg','surface','surface2','text','muted','accent','on-accent','danger','ok','paper','paper-text','hdr','hdr-text','note-bg','note-1','note-2','note-3','cv-ink'].forEach(k=>o[k]=s.getPropertyValue('--'+k).trim());return o}""",th)
        # لون الغلاف: hsl(h, s, l) أسوأ حالة نختبر عدة درجات
        for h in range(0,360,40):
            pass
        worst=[]
        for a,bk in PAIRS:
            if bk=='cv': continue
            if not (v.get(a,'').startswith('#') and v.get(bk,'').startswith('#')): continue
            r=cr(v[a],v[bk]); need=3.0 if a=='accent' else 4.5
            if r<need: worst.append((a,bk,round(r,2)))
        check(f'contrast {th}: all text/background pairs >= WCAG AA', not worst, worst)
    # الأغلفة: نص على gradient — نقيس عبر عدة hues ولون الحبر للثيم
    import colorsys
    for th,(sat,l,ink) in {'modern':(.48,.30,'#ffffff'),'library':(.38,.30,'#fbf3dc'),'snow':(.42,.30,'#ffffff'),'night':(.40,.28,'#f3f5fa')}.items():
        w=[]
        for h in range(0,360,10):
            for dl in (0,-.12):
                r,g,bb=colorsys.hls_to_rgb(h/360,l+dl if dl else l,sat); hexc='#%02x%02x%02x'%(int(r*255),int(g*255),int(bb*255))
                rr=cr(ink,hexc)
                if rr<4.5: w.append((h,round(rr,2)))
        check(f'cover title contrast {th} across all hues', not w, w[:5])
