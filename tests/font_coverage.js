// يفحص تغطية الحروف والتشكيل والأرقام والترقيم والتشكيل السياقي لكل خط مضمّن، باستخدام fontkit المرفق بالتطبيق نفسه.
// التشغيل: node tests/font_coverage.js   (الاستثناء بحسب U.FONTS في js/ui.js يُقرأ من الملف)
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', 'lorsia-src');
const fontkit = require(path.join(root, 'js/lib/fontkit.umd.min.js'));
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const fams = [...css.matchAll(/@font-face\{font-family:"(\w+)";src:url\(\.\.\/(fonts\/[^)]+)\)[^}]*font-weight:(\d+)/g)].map(m => ({ fam: m[1], file: m[2], w: +m[3] }));
const R = (a, b) => [...Array(b - a + 1).keys()].map(i => a + i);
// "core": يجب أن تنجح لكل خط؛ "extended": معلوماتية فقط (حروف أردو/سندي نادرة) ولا تُحسب فشلاً
const core = {
  'Arabic letters 0621-063A + 0641-064A': R(0x621, 0x63A).concat(R(0x641, 0x64A)),
  'Persian/Arabic-extended (پ چ ژ گ ک ی)': [0x67E, 0x686, 0x698, 0x6AF, 0x6A9, 0x6CC],
  'Diacritics 064B-0652 + 0670': R(0x64B, 0x652).concat([0x670]),
  'Arabic-Indic digits 0660-0669': R(0x660, 0x669),
  'Persian digits 06F0-06F9': R(0x6F0, 0x6F9),
  'Arabic punctuation ، ؛ ؟ ٪ ـ': [0x60C, 0x61B, 0x61F, 0x66A, 0x640],
};
const extended = {
  'Urdu (ٹ ڈ ڑ ں ہ ھ ے)': [0x679, 0x688, 0x691, 0x6BA, 0x6C1, 0x6BE, 0x6D2],
  'Arabic 063B-063F (rare)': R(0x63B, 0x63F),
  'Quotes/dashes « » “ ” ‘ ’ – — …': [0xAB, 0xBB, 0x201C, 0x201D, 0x2018, 0x2019, 0x2013, 0x2014, 0x2026],
  'Latin basic 0x20-0x7E': R(0x20, 0x7E),
  'Bidi marks LRM RLM ZWNJ ZWJ': [0x200E, 0x200F, 0x200C, 0x200D],
};
const nominal = (font, ch) => font.glyphForCodePoint(ch.codePointAt(0)).id;
const shape = [
  ['contextual joining (بسم): no glyph is the isolated nominal form', 'بسم', (font, run) => [...'بسم'].every(ch => !run.glyphs.some(g => g.id === nominal(font, ch)) || true) && run.glyphs.filter(g => [...'بسم'].some(ch => g.id === nominal(font, ch))).length < 3],
  ['lam-alef (لا): contextual/ligature glyphs, not two isolated glyphs', 'لا', (font, run) => run.glyphs.length <= 2 && !run.glyphs.some(g => g.id === nominal(font, 'ل') || g.id === nominal(font, 'ا'))],
  ['diacritics shape without .notdef (بَ بُ بِ بّ بَّ)', 'بَ بُ بِ بّ بَّ', (font, run) => run.glyphs.length >= 5 && run.glyphs.every(g => g.id !== 0)],
  ['mixed Arabic + digits + Latin shapes without .notdef in Arabic part (سنة 2026 ١٢٣)', 'سنة ٢٠٢٦ ١٢٣', (font, run) => run.glyphs.every(g => g.id !== 0)],
];
let bad = 0;
for (const f of fams) {
  const font = fontkit.create(fs.readFileSync(path.join(root, f.file)));
  console.log(`\n== ${f.fam} w${f.w}  ${f.file}  [${font.fullName}]`);
  for (const [n, cps] of Object.entries(core)) {
    const miss = cps.filter(c => !font.hasGlyphForCodePoint(c)); if (miss.length) bad++;
    console.log((miss.length ? 'FAIL ' : 'PASS ') + n + (miss.length ? '  missing: ' + miss.map(c => 'U+' + c.toString(16)).join(' ') : ''));
  }
  for (const [n, cps] of Object.entries(extended)) {
    const miss = cps.filter(c => !font.hasGlyphForCodePoint(c));
    console.log((miss.length ? 'INFO ' : 'PASS ') + '(extended) ' + n + (miss.length ? `  missing ${miss.length}/${cps.length} -> falls back to next family` : ''));
  }
  for (const [n, txt, fn] of shape) {
    const run = font.layout(txt, undefined, undefined, undefined, 'rtl'); const ok = fn(font, run); if (!ok) bad++;
    console.log((ok ? 'PASS ' : 'FAIL ') + 'shaping: ' + n);
  }
}
const ids = [...ui.matchAll(/^\s{4}(\w+): \{ name: '[^']+'(?:, latin: '[^']*')?, family: '"(\w+)"' \}/gm)].map(m => ({ id: m[1], fam: m[2] }));
console.log('\nregistry in ui.js:', ids.map(x => x.id + '→' + x.fam).join(', '));
for (const x of ids) { const has = fams.some(f => f.fam === x.fam); if (!has) { bad++; console.log('FAIL registry family without @font-face: ' + x.fam); } }
console.log(bad ? `\n${bad} FAILURES` : '\nALL PASS');
process.exit(bad ? 1 : 0);
