# -*- coding: utf-8 -*-
"""اختبار hooks/launcher_icons.py على مانيفست Capacitor الافتراضي وملفات PNG **اختبارية مؤقتة** (تُولَّد في مجلد مؤقت ولا تُشحن).
التشغيل:  python3 tests/launcher_icons.py"""
import os, struct, subprocess, sys, tempfile, zlib, json, shutil
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SCRIPT = HERE / 'hooks' / 'launcher_icons.py'
ANS = '{http://schemas.android.com/apk/res/android}'
STOCK = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:allowBackup="true" android:icon="@mipmap/ic_launcher" android:label="@string/app_name" android:roundIcon="@mipmap/ic_launcher_round" android:supportsRtl="true" android:theme="@style/AppTheme">
        <activity android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density" android:name=".MainActivity" android:label="@string/title_activity_main" android:theme="@style/AppTheme.NoActionBarLaunch" android:launchMode="singleTask" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
'''
DENS = [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]
R = []


def check(n, c, info=''):
    R.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ((' — ' + str(info)) if (info and not c) else ''))


def png(w, h):
    raw = b''.join(b'\x00' + b'\x00' * (w * 4) for _ in range(h))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')


def make(tmp, legacy=(), fg=(), bgpng=(), partial=(), badsize=()):
    base = Path(tmp)
    (base / 'android/app/src/main/res').mkdir(parents=True)
    (base / 'android/app/src/main/AndroidManifest.xml').write_text(STOCK, encoding='utf-8')
    (base / 'config.json').write_text(json.dumps({'appId': 'com.lorsia.app'}), encoding='utf-8')
    res = base / 'android/app/src/main/res'
    def put(name, theme, size_idx, dens=DENS, wrong=False):
        for d, a, b in dens:
            s = (a, b)[size_idx]
            if wrong: s += 1
            p = res / ('mipmap-' + d); p.mkdir(exist_ok=True); (p / name.format(theme)).write_bytes(png(s, s))
    for t in legacy: put('ic_launcher_{}.png', t, 0, wrong=t in badsize)
    for t in fg: put('ic_launcher_{}_foreground.png', t, 1)
    for t in bgpng: put('ic_launcher_{}_background.png', t, 1)
    for t in partial: put('ic_launcher_{}.png', t, 0, dens=DENS[:3])
    return base


def run(base):
    r = subprocess.run([sys.executable, '-I', str(SCRIPT)], cwd=str(base), capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def info(base):
    m = base / 'android/app/src/main/AndroidManifest.xml'
    root = ET.parse(str(m)).getroot(); app = root.find('application')
    main = [a for a in app.findall('activity') if a.get(ANS + 'name') == '.MainActivity'][0]
    al = app.findall('activity-alias')
    return root, app, main, al


T4 = ['modern', 'library', 'snow', 'night']
with tempfile.TemporaryDirectory() as tmp:
    # 1) بلا أيقونات: المانيفست لا يتغيّر إطلاقاً
    b = make(Path(tmp) / 'a'); before = (b / 'android/app/src/main/AndroidManifest.xml').read_bytes()
    rc, out = run(b)
    check('no PNGs: exit 0 and manifest byte-identical', rc == 0 and (b / 'android/app/src/main/AndroidManifest.xml').read_bytes() == before, out)
    # 2) أربعة ثيمات + adaptive لليل فقط
    b = make(Path(tmp) / 'b', legacy=T4, fg=['night']); rc, out = run(b); root, app, main, al = info(b)
    check('4 themes: exit 0', rc == 0, out)
    check('MainActivity has no LAUNCHER filter', not main.findall('intent-filter'))
    check('exactly 4 aliases, unique names', len({a.get(ANS + 'name') for a in al}) == 4 and len(al) == 4)
    check('alias names = <appId>.Icon<Theme>', {a.get(ANS + 'name') for a in al} == {'com.lorsia.app.Icon' + t.capitalize() for t in T4})
    en = [a.get(ANS + 'name') for a in al if a.get(ANS + 'enabled') == 'true']
    check('exactly one alias enabled by default (modern)', en == ['com.lorsia.app.IconModern'], en)
    check('every alias targets .MainActivity and is exported', all(a.get(ANS + 'targetActivity') == '.MainActivity' and a.get(ANS + 'exported') == 'true' for a in al))
    check('icon mapping per theme', all(a.get(ANS + 'icon') == '@mipmap/ic_launcher_' + a.get(ANS + 'name').split('.Icon')[1].lower() for a in al))
    check('provider and permission preserved', app.find('provider') is not None and root.find('uses-permission') is not None)
    check('package/appId untouched (no package attr added)', 'package' not in root.attrib)
    res = b / 'android/app/src/main/res'
    check('adaptive xml only for night', sorted(p.name for p in (res / 'mipmap-anydpi-v26').iterdir()) == ['ic_launcher_night.xml'])
    check('background color resource generated for night', 'ic_launcher_night_background' in (res / 'values/lorsia_launcher_colors.xml').read_text())
    # 3) idempotent
    m1 = (b / 'android/app/src/main/AndroidManifest.xml').read_text(); rc, out = run(b)
    check('idempotent (2nd run identical, still 4 aliases)', rc == 0 and (b / 'android/app/src/main/AndroidManifest.xml').read_text() == m1 and len(info(b)[3]) == 4, out)
    # 4) جزئي: ليل فقط
    b = make(Path(tmp) / 'c', legacy=['night']); rc, out = run(b); al = info(b)[3]
    ic = {a.get(ANS + 'name').split('.Icon')[1].lower(): a.get(ANS + 'icon') for a in al}
    check('partial: night has own icon, others fall back to stock', ic['night'] == '@mipmap/ic_launcher_night' and all(ic[t] == '@mipmap/ic_launcher' for t in ['modern', 'library', 'snow']), ic)
    check('partial: warns about missing themes', out.count('بلا PNG') == 3, out)
    # 5) مجموعة ناقصة تُتجاهل
    b = make(Path(tmp) / 'd', partial=['snow']); before = (b / 'android/app/src/main/AndroidManifest.xml').read_bytes(); rc, out = run(b)
    check('incomplete density set ignored (manifest untouched)', rc == 0 and (b / 'android/app/src/main/AndroidManifest.xml').read_bytes() == before and 'ناقصة' in out, out)
    # 6) مقاس خاطئ -> تحذير
    b = make(Path(tmp) / 'e', legacy=['snow'], badsize=['snow']); rc, out = run(b)
    check('wrong PNG size warns', rc == 0 and 'المقاس' in out, out)
    # 7) MainActivity مفقودة -> فشل واضح
    b = make(Path(tmp) / 'f', legacy=['snow']); mp = b / 'android/app/src/main/AndroidManifest.xml'; mp.write_text(STOCK.replace('.MainActivity', '.Other'), encoding='utf-8'); rc, out = run(b)
    check('missing MainActivity fails clearly', rc == 1 and '❌' in out, out)
    # 8) خلفية PNG اختيارية
    b = make(Path(tmp) / 'g', legacy=['library'], fg=['library'], bgpng=['library']); rc, out = run(b)
    x = (b / 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_library.xml').read_text()
    check('optional background PNG used in adaptive xml', '@mipmap/ic_launcher_library_background' in x and not (b / 'android/app/src/main/res/values/lorsia_launcher_colors.xml').exists(), x)

print('\n%d/%d passed' % (sum(R), len(R)))
sys.exit(0 if all(R) else 1)
