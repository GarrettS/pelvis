// Browser verification for the per-subtab nomenclature modules.
// Covers the blocked-JSON failure path (error callout survives the
// module-import resolve), success render, retry recovery, subtab
// switching, and the re-click-active no-op.
//
// Requires a static server for the repo root. Default: http://localhost:8000
// Override with E2E_BASE. Run: npm run test:e2e
import {chromium} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';

const reachable = await fetch(`${BASE}/index.html`).then(r => r.ok, () => false);
if (!reachable) {
  console.error(`Server not reachable at ${BASE}. Start one in the repo root, e.g.: python3 -m http.server 8000`);
  process.exit(2);
}

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();

async function newPage() {
  // Block the service worker so request interception actually reaches
  // the network and cached JSON cannot mask a simulated failure.
  const ctx = await browser.newContext({serviceWorkers: 'block'});
  return ctx.newPage();
}

async function errorPathTest(label, route, dataGlob, containerId) {
  const page = await newPage();
  await page.route(dataGlob, r => r.abort());
  await page.goto(`${BASE}/index.html${route}`);

  const sel = `#${containerId} .callout.error`;
  let appeared = false;
  try {
    await page.waitForSelector(sel, {timeout: 5000});
    appeared = true;
  } catch { /* handled below */ }
  ok(`${label}: error callout appears`, appeared);

  // Regression check for the clearErrors fix: the module import resolves
  // OK even though attemptLoad rendered an error, so the old success-path
  // clearErrors would wipe this. It must still be present after a tick.
  await page.waitForTimeout(800);
  const stillThere = await page.locator(sel).count();
  ok(`${label}: error callout survives module-import resolve`, stillThere === 1,
     `count=${stillThere}`);

  const retry = await page.locator(`#${containerId} .callout-retry`).count();
  ok(`${label}: Retry button present`, retry === 1, `count=${retry}`);

  await page.context().close();
}

async function successTest(label, route, containerId, rowSel) {
  const page = await newPage();
  await page.goto(`${BASE}/index.html${route}`);
  await page.waitForSelector(`#${containerId} ${rowSel}`, {timeout: 5000})
    .catch(() => {});
  const rows = await page.locator(`#${containerId} ${rowSel}`).count();
  ok(`${label}: rows render`, rows > 0, `rows=${rows}`);
  const errs = await page.locator(`#${containerId} .callout.error`).count();
  ok(`${label}: no stray error callout`, errs === 0, `errs=${errs}`);
  await page.context().close();
}

async function retryRecoveryTest(label, route, dataGlob, containerId, rowSel) {
  const page = await newPage();
  let blocked = true;
  await page.route(dataGlob, r => blocked ? r.abort() : r.continue());
  await page.goto(`${BASE}/index.html${route}`);
  await page.waitForSelector(`#${containerId} .callout-retry`, {timeout: 5000})
    .catch(() => {});
  blocked = false;
  await page.locator(`#${containerId} .callout-retry`).click();
  await page.waitForSelector(`#${containerId} ${rowSel}`, {timeout: 5000})
    .catch(() => {});
  const rows = await page.locator(`#${containerId} ${rowSel}`).count();
  const errs = await page.locator(`#${containerId} .callout.error`).count();
  ok(`${label}: retry recovers (rows render, error cleared)`,
     rows > 0 && errs === 0, `rows=${rows} errs=${errs}`);
  await page.context().close();
}

// Subtab switching still works after the split, and re-clicking the
// active subtab is a no-op (lazyInit bails on initialized -> no
// duplicate render, no error).
async function switchAndReclickTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#nomenclature/joints`);
  await page.waitForSelector('#joints-tbody tr', {timeout: 5000}).catch(() => {});
  const jointsRows = await page.locator('#joints-tbody tr').count();
  ok('switch: joints renders', jointsRows > 0, `rows=${jointsRows}`);

  await page.locator('#nomenclature-translation-subtab').click();
  await page.waitForSelector('#translation-tbody tr', {timeout: 5000}).catch(() => {});
  const transRows = await page.locator('#translation-tbody tr').count();
  const jointsHidden = await page.locator('#nomenclature-joints-content')
    .evaluate(el => el.hidden);
  ok('switch: translation renders, joints hidden',
     transRows > 0 && jointsHidden, `trans=${transRows} jointsHidden=${jointsHidden}`);

  await page.locator('#nomenclature-joints-subtab').click();
  await page.waitForSelector('#nomenclature-joints-content:not([hidden])',
    {timeout: 5000}).catch(() => {});
  const jointsRows2 = await page.locator('#joints-tbody tr').count();
  ok('switch back: joints visible, not re-rendered (init-once)',
     jointsRows2 === jointsRows, `before=${jointsRows} after=${jointsRows2}`);

  // Re-click the already-active joints subtab: same hash, no hashchange.
  await page.locator('#nomenclature-joints-subtab').click();
  await page.waitForTimeout(500);
  const jointsRows3 = await page.locator('#joints-tbody tr').count();
  const errs = await page.locator('#nomenclature-joints-content .callout.error')
    .count();
  ok('re-click active subtab is a no-op',
     jointsRows3 === jointsRows && errs === 0,
     `rows=${jointsRows3} errs=${errs}`);
  await page.context().close();
}

await errorPathTest('joints-fail', '#nomenclature/joints',
  '**/data/pelvic-joints.json', 'nomenclature-joints-content');
await errorPathTest('translation-fail', '#nomenclature/translation',
  '**/data/nomenclature-translations.json', 'nomenclature-translation-content');
await successTest('joints-ok', '#nomenclature/joints',
  'nomenclature-joints-content', '#joints-tbody tr');
await successTest('translation-ok', '#nomenclature/translation',
  'nomenclature-translation-content', '#translation-tbody tr');
await retryRecoveryTest('joints-retry', '#nomenclature/joints',
  '**/data/pelvic-joints.json', 'nomenclature-joints-content',
  '#joints-tbody tr');
await switchAndReclickTest();

await browser.close();

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
