/* Headless-Chromium smoke test (needs a global `playwright` + a static server on :8765 serving the project root).
   usage: node tools/smoke-test.js [screenshots-dir]   — exits 1 on any failed check */
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const SHOTS = process.argv[2] || null, URL = 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = n => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });
  const hash = h => page.evaluate(h => { location.hash = h; }, h).then(() => page.waitForTimeout(450));
  await page.goto(URL); await page.waitForFunction(() => window.__lorsiaReady);
  // ---- seed data via the app's own DB layer
  const ids = await page.evaluate(async () => {
    const DB = window.LDB, b = await DB.createBook('رحلة إلى القمر'); await DB.createBook('Silver Archive');
    const c1 = await DB.createChapter(b.id, 'الفصل الأول'); const c2 = await DB.createChapter(b.id, 'الفصل الثاني');
    await DB.saveChapter(c1.id, { text: 'كان يا ما كان، في سماءٍ بعيدة — Lorsia ١٢٣ 456.\nسطر ثانٍ.' });
    await DB.saveRec('characters', { bookId: b.id, name: 'ليلى', role: 'بطلة', desc: 'وصف' });
    await DB.saveRec('ideas', { bookId: b.id, title: 'فكرة النجوم', text: 'نص' });
    const cat = await DB.saveRec('cats', { bookId: b.id, name: 'الأماكن' }); await DB.saveRec('items', { bookId: b.id, catId: cat.id, name: 'مدينة الفضة', desc: 'د' });
    await DB.patchBook(b.id, { lastChapterId: c1.id });
    return { b: b.id, c1: c1.id, c2: c2.id, cat: cat.id };
  });
  await page.reload(); await page.waitForFunction(() => window.__lorsiaReady);
  // ---- themes: select each via the UI; no reload, route kept
  await page.evaluate(() => { window.__noReload = 1; });
  await hash('#/themes');
  for (const t of ['night', 'library', 'snow', 'modern', 'night']) {
    await page.click(`[data-t="${t}"]`); await page.waitForTimeout(450);
    ok(await page.evaluate(t => document.documentElement.dataset.theme === t && location.hash === '#/themes' && window.__noReload === 1, t), `theme ${t}: applied, still on #/themes, no reload`);
  }
  ok(await page.evaluate(() => localStorage.getItem('lorsia-theme') === 'night'), 'theme mirrored in localStorage');
  await shot('themes-night');
  await page.reload(); await page.waitForFunction(() => window.__lorsiaReady);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'night', 'night restored after restart');
  ok(await page.evaluate(async () => (await window.LDB.getSetting('prefs')).theme) === 'night', 'night persisted in IndexedDB prefs');
  // ---- Dark visuals
  const cs = (sel, p) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, p]);
  ok(await cs('body', 'backgroundColor') === 'rgb(8, 9, 13)', 'Dark body = #08090D');
  await hash('#/'); await shot('library-night');
  ok(await cs('#sky', 'display') === 'block', 'sky visible on library'); ok(await cs('#sky', 'pointerEvents') === 'none', 'sky pointer-events none');
  ok(await page.evaluate(() => document.querySelectorAll('.cover .co').length === 8), 'cover corners: 4 per cover');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.cover .co')).display === 'block'), 'cover corners visible in Dark');
  await hash(`#/b/${ids.b}/home`); await shot('dash-night');
  ok(await cs('#sky', 'display') === 'block', 'sky visible on dashboard');
  await hash(`#/b/${ids.b}/chapters`); await shot('chapters-night');
  ok(await page.evaluate(() => document.querySelectorAll('.chap.cur .seal-mark').length === 1), 'exactly one active-chapter seal');
  ok(await cs('#sky', 'display') === 'none', 'sky hidden on chapters');
  // ---- editor: calm, no sky, text intact, save status
  await hash(`#/b/${ids.b}/c/${ids.c1}`); await shot('editor-night');
  ok(await cs('#sky', 'display') === 'none', 'NO sky in editor');
  ok(await page.evaluate(() => !document.querySelector('.editor').querySelector('canvas,.stars')), 'no particles inside editor');
  await page.fill('#ta', 'نص جديد مع Latin 123\nسطر'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelector('#st').classList.contains('dirty')), 'typing -> status unsaved (not falsely saved)');
  await page.waitForTimeout(3300); // autosave fires ~2.5s after the last input/caret move
  ok(await page.evaluate(async id => (await window.LDB.getBody(id)).text === 'نص جديد مع Latin 123\nسطر', ids.c1), 'autosave really wrote the text to IndexedDB');
  ok(await page.evaluate(() => document.querySelector('#st').classList.contains('saved') && !!document.querySelector('#st svg')), 'autosave shows compact saved icon');
  ok(await page.evaluate(() => document.getElementById('toast').className.indexOf('show') < 0), 'no toast on autosave success');
  // failure path
  await page.evaluate(() => { window.__orig = window.LDB.saveChapter; window.LDB.saveChapter = () => Promise.reject(new Error('quota')); });
  await page.fill('#ta', 'نص لن يُحفظ'); await page.waitForTimeout(3500);
  ok(await page.evaluate(() => { const s = document.querySelector('#st'); return s.classList.contains('error') && /تعذّر الحفظ/.test(s.textContent) && !s.querySelector('svg'); }), 'failure: status says saving failed, no saved icon');
  ok(await page.evaluate(() => !document.querySelector('#stRetry').hidden), 'failure: retry button shown');
  ok(await page.evaluate(() => document.querySelector('#ta').value === 'نص لن يُحفظ'), 'failure: text preserved in editor');
  await shot('editor-save-error');
  await page.evaluate(() => { window.LDB.saveChapter = window.__orig; }); await page.click('#stRetry'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.querySelector('#st').classList.contains('saved')), 'retry succeeds -> saved');
  ok(await page.evaluate(async id => (await window.LDB.getBody(id)).text === 'نص لن يُحفظ', ids.c1), 'retried text really in IndexedDB');
  // switching theme/font on settings and returning keeps text
  await hash('#/settings'); await page.click('.fopt[data-font="amiri"]'); await hash('#/themes'); await page.click('[data-t="library"]'); await page.waitForTimeout(300);
  await hash(`#/b/${ids.b}/c/${ids.c1}`);
  ok(await page.evaluate(() => document.querySelector('#ta').value === 'نص لن يُحفظ'), 'text intact after font+theme change');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('#ta')).fontFamily.includes('LorsiaAmiri')), 'editor uses selected global font');
  await page.evaluate(async () => { const p = await window.LDB.getSetting('prefs'); p.theme = 'night'; await window.LDB.setSetting('prefs', p); }); await page.reload(); await page.waitForFunction(() => window.__lorsiaReady);
  // ---- fonts
  await hash('#/settings'); await shot('settings-night');
  const n = await page.locator('.fopt').count(); ok(n === 5, `exactly 5 font choices (found ${n})`);
  ok(await page.locator('input[type=file]').count() === 0, 'no custom font upload control');
  for (const f of await page.evaluate(() => Array.from(document.querySelectorAll('.fopt')).map(e => e.dataset.font))) {
    await page.click(`.fopt[data-font="${f}"]`);
    ok(await page.evaluate(f => document.documentElement.dataset.font === f && getComputedStyle(document.body).fontFamily.toLowerCase().includes('lorsia'), f), `font ${f}: applied to body`);
    ok(await page.evaluate(() => ['button', '.btn', '#top h1'].every(s => { const e = document.querySelector(s); return !e || getComputedStyle(e).fontFamily === getComputedStyle(document.body).fontFamily; })), `font ${f}: buttons/headings inherit same family`);
  }
  await page.click('.fopt[data-font="dejavu"]'); await page.reload(); await page.waitForFunction(() => window.__lorsiaReady);
  ok(await page.evaluate(() => document.documentElement.dataset.font) === 'dejavu', 'font persisted after restart');
  // ---- deletes need confirmation (Cancel keeps data)
  const count = (s) => page.evaluate(async s => (await window.LDB.all(s)).length, s);
  await hash(`#/b/${ids.b}/chapters`); await page.click('.chap[data-id="' + ids.c2 + '"] [data-a=del]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => /الفصل الثاني/.test(document.querySelector('.modal-box').textContent)), 'chapter delete: dialog names the item');
  await shot('delete-dialog'); await page.click('.modal [data-no]'); await page.waitForTimeout(200); ok(await count('chapters') === 2, 'chapter delete cancelled -> kept');
  await hash('#/'); await page.click('[data-more]'); await page.waitForTimeout(250); await page.click('.modal .btn.danger'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => /نهائياً/.test(document.querySelector('.modal-box').textContent)), 'book delete: irreversible warning'); await page.click('.modal [data-no]'); ok(await count('books') === 2, 'book delete cancelled -> kept');
  // ---- backup preview
  await hash('#/backup');
  const good = await page.evaluate(async () => JSON.stringify(await window.LDB.exportAll()));
  await page.setInputFiles('#bkFile', { name: 'my-backup.json', mimeType: 'application/json', buffer: Buffer.from(good) }); await page.waitForTimeout(500);
  ok(await page.evaluate(() => { const t = document.querySelector('.modal-box').textContent; return /معاينة الاستيراد/.test(t) && /my-backup\.json/.test(t) && /الكتب/.test(t) && /الفصول/.test(t); }), 'import preview lists file name + counts');
  await shot('import-preview'); await page.click('.modal [data-m=""]'); await page.waitForTimeout(200);
  ok(await count('books') === 2, 'cancel preview -> nothing imported');
  await page.setInputFiles('#bkFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json') }); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelector('.modal-box') && document.querySelector('.modal-box').getAttribute('role') === 'alertdialog'), 'invalid file -> error dialog');
  await shot('import-error'); await page.click('.modal [data-no]');
  await page.setInputFiles('#bkFile', { name: 'my-backup.json', mimeType: 'application/json', buffer: Buffer.from(good) }); await page.waitForTimeout(400);
  await page.click('.modal [data-m="merge"]'); await page.waitForTimeout(800); ok(await count('books') === 4, 'merge after explicit confirm -> books added (2 -> 4)');
  // ---- motion
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok(await page.evaluate(() => document.documentElement.classList.contains('page-hidden')), 'page-hidden class set when hidden (sky animation paused)');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await hash('#/');
  ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#sky .stars')).animationDuration) < 0.01), 'reduced motion: sky animation disabled');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal overflow at 390px');
  ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
