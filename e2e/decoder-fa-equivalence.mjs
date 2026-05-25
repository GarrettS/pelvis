// Browser verification for FA region in the Pelvis Decoder.
//
// FA (Femoral-Acetabular) and AF (Acetabular-Femoral) describe the same
// hip-joint state from different reference frames — see Pelvis Restoration
// Manual p.4 and p.11. So:
//
//  - FA ER's chain must equal AF ER's chain (AIC chain).
//  - FA IR's chain must equal AF IR's chain (PEC chain).
//  - FA ER and FA IR must produce different chains. Guards against the
//    `default: return true` regression where switch(regionId) had no FA
//    case and both directions yielded an identical chain.
//  - The FA-only explanatory note appears for FA selections and disappears
//    when a non-FA region is selected.
//
// Requires a static server for the repo root. Default: http://localhost:8000
// Override with E2E_BASE. Run: npm run test:e2e
import {chromium} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';

const reachable = await fetch(`${BASE}/index.html`).then(r => r.ok, () => false);
if (!reachable) {
  console.error(`Server not reachable at ${BASE}. ` +
    `Start one in the repo root, e.g.: python3 -m http.server 8000`);
  process.exit(2);
}

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();
const ctx = await browser.newContext({serviceWorkers: 'block'});
const page = await ctx.newPage();

await page.goto(`${BASE}/index.html#anatomy/decoder`);
await page.waitForSelector('#decoder-region-btns button[data-val=FA]',
  {timeout: 5000}).catch(() => {});

async function snapshot(region, dir) {
  await page.click(`#decoder-region-btns button[data-val=${region}]`);
  await page.click(`#decoder-dir-btns button[data-val=${dir}]`);
  const lines = await page.locator('.equiv-line').allTextContents();
  const noteCount = await page.locator('.equiv-chain-note').count();
  const note = noteCount
      ? await page.locator('.equiv-chain-note').textContent()
      : null;
  return {lines, note};
}

const afEr = await snapshot('AF', 'ER');
const afIr = await snapshot('AF', 'IR');
const faEr = await snapshot('FA', 'ER');
const faIr = await snapshot('FA', 'IR');

const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

ok('FA ER chain matches AF ER chain',
   eq(faEr.lines, afEr.lines),
   `FA=${JSON.stringify(faEr.lines)} AF=${JSON.stringify(afEr.lines)}`);

ok('FA IR chain matches AF IR chain',
   eq(faIr.lines, afIr.lines),
   `FA=${JSON.stringify(faIr.lines)} AF=${JSON.stringify(afIr.lines)}`);

ok('FA ER and FA IR chains differ',
   !eq(faEr.lines, faIr.lines),
   `ER=${JSON.stringify(faEr.lines)} IR=${JSON.stringify(faIr.lines)}`);

ok('FA selection shows manual-ref note',
   faEr.note !== null && faEr.note.includes('Manual p.4, 11'),
   `note=${faEr.note}`);

ok('AF selection does not show FA note',
   afEr.note === null && afIr.note === null,
   `AF ER note=${afEr.note} AF IR note=${afIr.note}`);

await ctx.close();
await browser.close();

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  const tag = r.pass ? 'PASS' : 'FAIL';
  const detail = r.detail ? `  (${r.detail})` : '';
  console.log(`${tag}  ${r.name}${detail}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
