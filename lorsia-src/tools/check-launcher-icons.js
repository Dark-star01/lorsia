#!/usr/bin/env node
/* Verifies the launcher PNG set against Android requirements. Zero dependencies.
   usage: node tools/check-launcher-icons.js <path to android/app/src/main/res> */
const fs = require('fs'), path = require('path');
const res = process.argv[2];
if (!res) { console.error('usage: node tools/check-launcher-icons.js <android/app/src/main/res>'); process.exit(2); }
const THEMES = ['modern', 'library', 'snow', 'night'];
const DENS = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 288 + 36], xxxhdpi: [192, 432] };
DENS.xxhdpi = [144, 324];
function png(file) {
  const b = fs.readFileSync(file);
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: b[25] === 6 || b[25] === 4 };
}
let bad = 0, ok = 0;
for (const t of THEMES) for (const d of Object.keys(DENS)) {
  const [leg, ad] = DENS[d], dir = path.join(res, 'mipmap-' + d);
  const need = [[`ic_launcher_${t}.png`, leg], [`ic_launcher_${t}_round.png`, leg], [`ic_launcher_${t}_foreground.png`, ad, true]];
  for (const [name, px, needAlpha] of need) {
    const f = path.join(dir, name);
    if (!fs.existsSync(f)) { console.log('MISSING ', path.relative(res, f), `(${px}x${px})`); bad++; continue; }
    const i = png(f);
    if (!i) { console.log('NOT PNG ', path.relative(res, f)); bad++; }
    else if (i.w !== px || i.h !== px) { console.log('WRONG SIZE', path.relative(res, f), `${i.w}x${i.h} expected ${px}x${px}`); bad++; }
    else if (needAlpha && !i.alpha) { console.log('NO ALPHA ', path.relative(res, f), '(adaptive foreground must be transparent PNG)'); bad++; }
    else ok++;
  }
}
console.log(`${ok} ok, ${bad} problem(s)`); process.exit(bad ? 1 : 0);
