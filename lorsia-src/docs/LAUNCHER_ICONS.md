# أيقونات المشغّل لكل ثيم (أندرويد) / Per-theme launcher icons

## الحالة (صريحة)
- **جاهز ومُختبَر في المتصفح:** كود الواجهة `js/launcher-icon.js`: يربط معرّف الثيم المحفوظ بالأيقونة ويستدعي
  `LorsiaLauncherIcon.setIcon({theme})` عند الإقلاع/تغيير الثيم، **مؤجَّلاً لحظة خروج التطبيق للخلفية** كي لا يتأثر المحرر أو التنقل.
  بدون البلاجن (متصفح عادي) لا يحدث شيء.
- **مُجهَّز وغير مبني:** الجانب الأصلي في `android-native/` (بلاجن Java + `activity-alias` + XML للأيقونات التكيّفية).
- **العائق:** الأرشيف المرفوع **لا يحوي مشروع Android/Capacitor** (لا `android/` ولا `capacitor.config` ولا `package.json`)،
  فلم أستطع رؤية الـpackage/applicationId أو بناء APK أو التجربة على جهاز. لذلك لا أدّعي أن التبديل يعمل فعلياً.
  ما لم يُتحقَّق منه: ظهور الأيقونة الجديدة في المشغّل. المشغّلات تؤخّر التحديث وقد يختفي الاختصار لحظات؛ لا وعد بتحديث فوري.
- لم تُنشأ أي صورة؛ لا فنّ نهائي ولا بدائل.

## التركيب في مشروع Capacitor
1. انسخ `android-native/LorsiaLauncherIconPlugin.java` إلى `android/app/src/main/java/<حزمتك>/` وعدّل سطر `package`.
2. في `MainActivity.onCreate` قبل `super.onCreate(...)`: `registerPlugin(LorsiaLauncherIconPlugin.class);`
3. في `AndroidManifest.xml`: ألصق الـ`activity-alias` الأربعة (من `android-native/AndroidManifest-aliases.xml`) داخل `<application>`
   و**احذف** فلتر `MAIN/LAUNCHER` من `MainActivity` نفسها (وإلا يظهر اختصاران). يبقى alias واحد فقط مفعّلاً (Modern).
4. انسخ `android-native/res/*` إلى `android/app/src/main/res/`، وضع ملفات PNG (الجدول أدناه).
5. لا تغيّر `applicationId`. لا تلمس بيانات التطبيق (IndexedDB داخل WebView لا تتأثر بتبديل الـalias).
6. تحقّق من الملفات: `node tools/check-launcher-icons.js android/app/src/main/res`

## ربط الثيم → الأيقونة

| معرّف الثيم | الاسم | alias | اسم الأيقونة (بدون امتداد) |
|---|---|---|---|
| `modern` | Light / Day | `.LauncherModern` (مفعّل افتراضياً) | `ic_launcher_modern` |
| `library` | Library | `.LauncherLibrary` | `ic_launcher_library` |
| `snow` | Snow | `.LauncherSnow` | `ic_launcher_snow` |
| `night` | Dark / Night | `.LauncherNight` | `ic_launcher_night` |

## قائمة الملفات المطلوبة (لكل ثيم من الأربعة = 15 ملف PNG إلزامي)
المسار: `android/app/src/main/res/mipmap-<كثافة>/`

| الملف | الاستخدام | mdpi | hdpi | xhdpi | xxhdpi | xxxhdpi | الشفافية |
|---|---|---|---|---|---|---|---|
| `ic_launcher_<theme>.png` | أيقونة قديمة (API < 26) | 48 | 72 | 96 | 144 | 192 | تُفضَّل أيقونة كاملة بزوايا مستديرة |
| `ic_launcher_<theme>_round.png` | `roundIcon` | 48 | 72 | 96 | 144 | 192 | دائرية |
| `ic_launcher_<theme>_foreground.png` | طبقة أمامية تكيّفية (API 26+) | 108 | 162 | 216 | 324 | 432 | **PNG شفاف**، بلا قناع جاهز |

كل الأبعاد مربعة بالبكسل. للطبقة الأمامية: اجعل العناصر المهمة داخل دائرة قطرها 66/108 من العرض في المنتصف (القناع يقصّ الباقي).
- **الخلفية التكيّفية:** لون في `res/values/ic_launcher_colors.xml` (جاهز، ألوان افتراضية قابلة للتغيير)، أو PNG معتم
  `ic_launcher_<theme>_background.png` بنفس أبعاد الطبقة الأمامية ثم غيّر `<background>` في `mipmap-anydpi-v26/ic_launcher_<theme>.xml`.
- **اختياري (Android 13 themed icons):** `ic_launcher_<theme>_monochrome.png` بأبعاد الطبقة الأمامية + سطر `<monochrome>` في XML.
- **متجر Play:** أيقونة 512×512 واحدة (خارج الـAPK، وليست لكل ثيم).
- XML الجاهزة: `res/mipmap-anydpi-v26/ic_launcher_<theme>.xml` و`_round.xml` (ثمانية ملفات، ليست فنّاً).

## الأمان
- يُفعَّل الـalias الجديد أولاً ثم يُعطَّل الباقي (لا لحظة بلا اختصار)، بعلم `DONT_KILL_APP`.
- لا اختصارات مكررة ما دام فلتر LAUNCHER محذوفاً من `MainActivity` وأن alias واحداً مفعّل.
