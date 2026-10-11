# -*- coding: utf-8 -*-
"""أيقونات المشغّل حسب الثيم (أندرويد) — يُستدعى من hooks/pre-build.sh بعد `cap add android` وتطبيق native/.

ماذا يفعل (ولا يفعل شيئاً إن لم توجد ملفات PNG للثيمات):
  1) يبحث عن ملفات PNG للثيمات في android/app/src/main/res/mipmap-*/ (مصدرها native/android/app/src/main/res/...).
  2) إن وُجد ثيم واحد على الأقل مكتمل: يزيل مرشّح LAUNCHER من MainActivity ويضيف 4 عناصر activity-alias
     (alias واحد مفعّل = اختصار واحد فقط)، ويولّد أيقونة adaptive (XML) للثيمات التي لها foreground.
  3) الثيم الذي بلا PNG يستخدم أيقونة التطبيق الافتراضية @mipmap/ic_launcher (وليس عملاً فنياً) مع تحذير في السجل.
لا يغيّر appId ولا حزمة MainActivity. آمن للتشغيل المتكرر (يستبدل الـaliases التي ولّدها سابقاً)."""
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path.cwd()
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
MANIFEST = ROOT / 'android' / 'app' / 'src' / 'main' / 'AndroidManifest.xml'
NS = {'android': 'http://schemas.android.com/apk/res/android', 'tools': 'http://schemas.android.com/tools'}
A = '{%s}' % NS['android']

# معرّف الثيم الثابت (نفس المحفوظ في إعدادات التطبيق) -> (الاسم المعروض، لون خلفية adaptive الاحتياطي = --bg للثيم في css/app.css)
THEMES = [
    ('modern', 'Light / Day', '#f3f5f9'),
    ('library', 'Library', '#efe6d0'),
    ('snow', 'Snow', '#e8f2fb'),
    ('night', 'Dark / Night', '#12151c'),
]
DEFAULT_THEME = 'modern'  # الـalias المفعّل افتراضياً (الثيم الافتراضي للتطبيق)
# كثافة -> (حجم الأيقونة الكلاسيكية px = 48dp, حجم foreground الـadaptive px = 108dp)
DENS = [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]


def log(m=''):
    print(m, flush=True)


def fail(m):
    log('❌ ' + m)
    sys.exit(1)


def png_size(p):
    with open(p, 'rb') as f:
        h = f.read(24)
    if h[:8] != b'\x89PNG\r\n\x1a\n' or h[12:16] != b'IHDR':
        return None
    return struct.unpack('>II', h[16:24])


def set_files(kind, theme):
    return [(d, RES / ('mipmap-%s' % d) / ('ic_launcher_%s%s.png' % (theme, kind))) for d, _, _ in DENS]


def complete(kind, theme):
    return all(p.is_file() for _, p in set_files(kind, theme))


def check_sizes(kind, theme, idx):
    for (d, p), spec in zip(set_files(kind, theme), DENS):
        want = spec[idx]
        got = png_size(p)
        if got is None:
            log('⚠️ %s ليس PNG صالحاً' % p.name)
        elif got != (want, want):
            log('⚠️ %s (%s): المقاس %dx%d والمطلوب %dx%d' % (p.name, d, got[0], got[1], want, want))


def main():
    cfg = json.loads((ROOT / 'config.json').read_text(encoding='utf-8'))
    app_id = cfg.get('appId') or 'com.dark.webapp'
    if not MANIFEST.is_file():
        fail('AndroidManifest.xml غير موجود — هذه الخطوة بعد npx cap add android')

    have = {}
    for t, label, _ in THEMES:
        legacy = complete('', t)
        part = [d for d, p in set_files('', t) if p.is_file()]
        if part and not legacy:
            log('⚠️ ثيم %s: أيقونة PNG ناقصة (موجود: %s من 5 كثافات) — يُتجاهل هذا الثيم' % (t, len(part)))
        if legacy:
            have[t] = {'adaptive': complete('_foreground', t), 'bgpng': complete('_background', t)}
            check_sizes('', t, 1)
            if have[t]['adaptive']:
                check_sizes('_foreground', t, 2)
                if have[t]['bgpng']:
                    check_sizes('_background', t, 2)
            else:
                log('ℹ️ ثيم %s: لا يوجد foreground للـadaptive — يُستخدم PNG الكلاسيكي فقط' % t)

    if not have:
        log('⏭️ لا توجد أيقونات PNG للثيمات (ic_launcher_<theme>.png) — أيقونة التطبيق الافتراضية باقية ولا تُضاف aliases')
        return

    # ---- المانيفست ----
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
    tree = ET.parse(str(MANIFEST), parser=parser)
    root = tree.getroot()
    for p, u in NS.items():
        ET.register_namespace(p, u)
    app = root.find('application')
    if app is None:
        fail('لا يوجد <application> في المانيفست')

    def is_main(e):
        n = e.get(A + 'name', '')
        return n in ('.MainActivity', app_id + '.MainActivity')

    main_act = next((a for a in app.findall('activity') if is_main(a)), None)
    if main_act is None:
        fail('MainActivity غير موجودة في المانيفست (المتوقع .MainActivity أو %s.MainActivity)' % app_id)

    # إزالة aliases ولّدناها سابقاً (تشغيل متكرر آمن)
    gen = tuple(app_id + '.Icon' + t.capitalize() for t, _, _ in THEMES)
    for al in list(app.findall('activity-alias')):
        if al.get(A + 'name') in gen:
            app.remove(al)

    def is_launcher(f):
        acts = [x.get(A + 'name') for x in f.findall('action')]
        cats = [x.get(A + 'name') for x in f.findall('category')]
        return 'android.intent.action.MAIN' in acts and 'android.intent.category.LAUNCHER' in cats

    removed = 0
    for f in list(main_act.findall('intent-filter')):
        if is_launcher(f):
            main_act.remove(f)
            removed += 1
    label = main_act.get(A + 'label') or app.get(A + 'label')

    # ---- موارد adaptive ----
    colors = []
    anydpi = RES / 'mipmap-anydpi-v26'
    for t, _, bg in THEMES:
        if t in have and have[t]['adaptive']:
            anydpi.mkdir(parents=True, exist_ok=True)
            back = '@mipmap/ic_launcher_%s_background' % t if have[t]['bgpng'] else '@color/ic_launcher_%s_background' % t
            if not have[t]['bgpng']:
                colors.append('    <color name="ic_launcher_%s_background">%s</color>' % (t, bg))
            (anydpi / ('ic_launcher_%s.xml' % t)).write_text(
                '<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="%s"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_%s_foreground"/>\n'
                '</adaptive-icon>\n' % (back, t), encoding='utf-8')
    if colors:
        vals = RES / 'values'
        vals.mkdir(parents=True, exist_ok=True)
        (vals / 'lorsia_launcher_colors.xml').write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' + '\n'.join(colors) + '\n</resources>\n', encoding='utf-8')

    # ---- aliases ----
    pos = list(app).index(main_act) + 1
    for t, title, _ in THEMES:
        icon = '@mipmap/ic_launcher_%s' % t if t in have else '@mipmap/ic_launcher'
        if t not in have:
            log('⚠️ ثيم %s (%s): بلا PNG — سيستخدم أيقونة التطبيق الافتراضية' % (t, title))
        al = ET.Element('activity-alias')
        al.set(A + 'name', app_id + '.Icon' + t.capitalize())
        al.set(A + 'targetActivity', main_act.get(A + 'name'))
        al.set(A + 'enabled', 'true' if t == DEFAULT_THEME else 'false')
        al.set(A + 'exported', 'true')
        al.set(A + 'icon', icon)
        al.set(A + 'roundIcon', icon)
        if label:
            al.set(A + 'label', label)
        f = ET.SubElement(al, 'intent-filter')
        ET.SubElement(f, 'action').set(A + 'name', 'android.intent.action.MAIN')
        ET.SubElement(f, 'category').set(A + 'name', 'android.intent.category.LAUNCHER')
        app.insert(pos, al)
        pos += 1
    ET.indent(tree, space='    ')
    tree.write(str(MANIFEST), encoding='utf-8', xml_declaration=True)
    log('✅ أيقونات المشغّل: %d ثيم بصور (%s) | أُزيل LAUNCHER من MainActivity (%d) | 4 aliases | المفعّل افتراضياً: %s' % (
        len(have), ', '.join(sorted(have)), removed, DEFAULT_THEME))


if __name__ == '__main__':
    main()
