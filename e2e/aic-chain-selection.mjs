// Browser verification for the L AIC Chain tab: muscle selection renders
// anchor circles, leader lines, and the detail panel; and the init-once
// invariant holds across a tab switch (selection, leader lines, and the
// mounted overlay persist with no re-mount or panel rebuild on show).
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

async function newPage() {
  const ctx = await browser.newContext({serviceWorkers: 'block'});
  return ctx.newPage();
}

const SECTION = '#anatomy-aic-content';
const ROW = `${SECTION} .aic-chain-row`;
const ACTIVE_ROW = `${ROW}.activeMuscle`;
const ANCHOR = `${SECTION} .aic-chain-overlay g`;
const LEADER = `${SECTION} .aic-leader-svg path`;
const DETAIL_PANEL = `${SECTION} .aic-chain-detail .detail-panel`;
const DETAIL_ROW = `${SECTION} .detail-row`;

// Count leader paths carrying a non-degenerate `d`: a single-segment path
// (just "M x y" with no curve) means the geometry collapsed, which is what
// a draw against a zero-size box produces. A real leader has the Q command.
const drawnLeaders = (page) => page.locator(LEADER).evaluateAll(paths =>
  paths.filter(p => (p.getAttribute('d') || '').includes('Q')).length);

async function aicSelectionTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#anatomy/aic`);
  await page.waitForSelector(ROW, {timeout: 5000}).catch(() => {});

  const rows = await page.locator(ROW).count();
  const loadErrs = await page.locator(`${SECTION} .callout.error`).count();
  ok('aic: muscle rows render', rows > 0, `rows=${rows}`);
  ok('aic: no error callout on load', loadErrs === 0, `errs=${loadErrs}`);

  await page.locator('#aic-diaphragm').click();
  await page.waitForSelector(DETAIL_PANEL, {timeout: 5000}).catch(() => {});
  await page.waitForTimeout(400);

  const activeId = await page.locator(ACTIVE_ROW).getAttribute('id');
  const anchorsShown = await page.locator(`${ANCHOR}.activeMuscle`).count();
  const leadersDrawn = await drawnLeaders(page);
  const detailRows = await page.locator(DETAIL_ROW).count();
  const detailTitle = await page.locator(`${DETAIL_PANEL} h3`).textContent();

  ok('aic: clicked muscle becomes active', activeId === 'aic-diaphragm',
     `active=${activeId}`);
  ok('aic: both anchor circles shown', anchorsShown === 2,
     `shown=${anchorsShown}`);
  ok('aic: both leader lines drawn', leadersDrawn === 2,
     `drawn=${leadersDrawn}`);
  ok('aic: detail panel renders all three fields', detailRows === 3,
     `rows=${detailRows}`);
  ok('aic: detail panel titled for the muscle',
     Boolean(detailTitle?.trim()), `title=${detailTitle}`);

  // Init-once: switch away to another subtab, then back. Selection, leader
  // lines, and the detail panel must persist, with no re-mount (anchor and
  // leader counts unchanged) and no panel rebuild (row count unchanged).
  const rowsBefore = rows;
  const anchorsBefore = await page.locator(ANCHOR).count();
  const leadersBefore = await page.locator(LEADER).count();

  await page.locator('#anatomy-decoder-subtab').click();
  await page.waitForSelector('#anatomy-aic-content[hidden]', {timeout: 5000})
    .catch(() => {});
  await page.locator('#anatomy-aic-subtab').click();
  await page.waitForSelector('#anatomy-aic-content:not([hidden])',
    {timeout: 5000}).catch(() => {});
  await page.waitForTimeout(400);

  const activeAfter = await page.locator(ACTIVE_ROW).getAttribute('id');
  const titleAfter = await page.locator(`${DETAIL_PANEL} h3`).textContent();
  const leadersDrawnAfter = await drawnLeaders(page);
  const rowsAfter = await page.locator(ROW).count();
  const anchorsAfter = await page.locator(ANCHOR).count();
  const leadersAfter = await page.locator(LEADER).count();

  ok('aic: selection persists across tab switch',
     activeAfter === 'aic-diaphragm', `active=${activeAfter}`);
  ok('aic: detail panel persists across tab switch',
     titleAfter === detailTitle, `title=${titleAfter}`);
  ok('aic: leader lines redrawn on show', leadersDrawnAfter === 2,
     `drawn=${leadersDrawnAfter}`);
  ok('aic: no panel rebuild (row count stable)', rowsAfter === rowsBefore,
     `before=${rowsBefore} after=${rowsAfter}`);
  ok('aic: no re-mount (anchor count stable)', anchorsAfter === anchorsBefore,
     `before=${anchorsBefore} after=${anchorsAfter}`);
  ok('aic: no re-mount (leader count stable)', leadersAfter === leadersBefore,
     `before=${leadersBefore} after=${leadersAfter}`);

  await page.context().close();
}

await aicSelectionTest();

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
