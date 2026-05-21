// Browser verification for navigation-tabs activation across all three
// tab shapes, plus the per-subtab nomenclature failure paths.
//
//  - tab-level (no subtab row): flashcards — non-subtabbed branch
//  - subtabbed: nomenclature (failure paths), patterns (delegation
//    generality beyond nomenclature)
//
// Proves the single-route-key lazyInit collapse is behavior-preserving:
// the module loads at exactly one level, breadcrumb shows only for
// subtabbed routes, switching and re-click-no-op hold.
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

async function sameHashImportRetryTest() {
  const page = await newPage();
  let blockModule = true;
  await page.route('**/scripts/patterns-level-quiz.js', r =>
    blockModule ? r.abort() : r.continue());
  await page.goto(`${BASE}/index.html#patterns/level-quiz`);
  await page.waitForSelector('#patterns-level-quiz-content .callout-retry',
    {timeout: 5000}).catch(() => {});

  const failedMessage = await page.locator(
    '#patterns-level-quiz-content .callout.error').textContent();
  ok('same-hash import retry: initial import error shown',
     failedMessage?.includes("Couldn't load ./patterns-level-quiz.js"),
     `message=${failedMessage}`);

  blockModule = false;
  await page.locator('#patterns-level-quiz-subtab').click();
  await page.waitForSelector('#halt-quiz-wrap #halt-question',
    {timeout: 5000}).catch(() => {});

  const errors = await page.locator(
    '#patterns-level-quiz-content .callout.error').count();
  const rendered = await page.locator('#halt-quiz-wrap #halt-question')
    .textContent();
  ok('same-hash import retry: active subtab re-click retries module',
     errors === 0 && Boolean(rendered?.trim()),
     `errs=${errors} rendered=${rendered}`);
  await page.context().close();
}

// Tab-level route: the non-subtabbed branch of activateTab. nav tab is
// current, content visible, breadcrumb hidden, and the lazy module
// rendered into its container.
async function tabLevelTest(label, route, navId, contentId, renderedSel) {
  const page = await newPage();
  await page.goto(`${BASE}/index.html${route}`);
  await page.waitForSelector(renderedSel, {timeout: 5000}).catch(() => {});

  const current = await page.locator(`#${navId}`).getAttribute('aria-current');
  const contentHidden = await page.locator(`#${contentId}`)
    .evaluate(el => el.hidden);
  const crumbHidden = await page.locator('#breadcrumb')
    .evaluate(el => el.classList.contains('hidden'));
  const rendered = await page.locator(renderedSel).count();

  ok(`${label}: nav current=page`, current === 'page', `current=${current}`);
  ok(`${label}: content visible`, contentHidden === false);
  ok(`${label}: breadcrumb hidden (tab-level)`, crumbHidden === true);
  ok(`${label}: lazy module rendered`, rendered > 0, `rendered=${rendered}`);
  await page.context().close();
}

// Flashcards filter: bindSelectGroup wiring on the category filter row
// changes the active button and shrinks the review deck to matching
// cards. Regression guard alongside decoderActivationTest.
async function flashcardsFilterTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#flashcards`);
  await page.waitForSelector('#fc-card-wrap > .fc-card', {timeout: 5000})
    .catch(() => {});

  const initialProgress = await page.locator('#fc-progress').textContent();
  ok('flashcards: initial deck loaded',
     /69 of 69/.test(initialProgress ?? ''),
     `progress=${initialProgress}`);

  await page.locator("#fc-cat-filters button[data-val='test_procedure']")
    .click();
  await page.waitForTimeout(300);
  const afterProgress = await page.locator('#fc-progress').textContent();
  const filterCurrent = await page
    .locator("#fc-cat-filters button[data-val='test_procedure']")
    .getAttribute('aria-current');
  ok('flashcards: Tests filter shrinks deck',
     /12 of 12/.test(afterProgress ?? ''),
     `progress=${afterProgress}`);
  ok('flashcards: clicked filter becomes aria-current',
     filterCurrent === 'true', `aria-current=${filterCurrent}`);
  await page.context().close();
}

// Decoder subtab: bindSelectGroup wiring renders initial equivalence
// chain + muscle list on load and updates them when a region button is
// clicked. Regression guard for the select-group signature change that
// broke the decoder when the cached and disk versions disagreed.
async function decoderActivationTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#anatomy/decoder`);
  await page.waitForSelector('#decoder-equiv .equiv-chain-label',
    {timeout: 5000}).catch(() => {});

  const initialEquiv = await page.locator('#decoder-equiv').innerHTML();
  const initialMuscles = await page.locator('#decoder-muscles').innerHTML();
  ok('decoder: initial equiv chain renders',
     initialEquiv.includes('Left IP ER'),
     `equiv=${initialEquiv.slice(0, 80)}`);
  ok('decoder: initial muscle list renders',
     initialMuscles.length > 0,
     `muscles len=${initialMuscles.length}`);

  await page.locator("#decoder-region-btns button[data-val='IsP']").click();
  await page.waitForTimeout(200);
  const afterEquiv = await page.locator('#decoder-equiv').innerHTML();
  const ispCurrent = await page
    .locator("#decoder-region-btns button[data-val='IsP']")
    .getAttribute('aria-current');
  ok('decoder: region click updates equiv chain',
     afterEquiv.includes('Left IsP ER'),
     `equiv=${afterEquiv.slice(0, 80)}`);
  ok('decoder: clicked region button becomes aria-current',
     ispCurrent === 'true', `aria-current=${ispCurrent}`);
  await page.context().close();
}

// Second subtabbed family (patterns): the activateSubtab delegation
// path is not nomenclature-specific. Render, breadcrumb shown, switch,
// re-click active is a no-op.
async function patternsSubtabTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#patterns/cheat-sheet`);
  await page.waitForSelector('#cheat-sheet-grid > *', {timeout: 5000})
    .catch(() => {});

  const navCurrent = await page.locator('#nav-patterns')
    .getAttribute('aria-current');
  const rowHidden = await page.locator('#patterns-subtabs')
    .evaluate(el => el.hidden);
  const subCurrent = await page.locator('#patterns-cheat-sheet-subtab')
    .getAttribute('aria-current');
  const crumbHidden = await page.locator('#breadcrumb')
    .evaluate(el => el.classList.contains('hidden'));
  const grid = await page.locator('#cheat-sheet-grid > *').count();
  ok('patterns: cheat-sheet renders, nav+subtab current, row+breadcrumb shown',
     navCurrent === 'page' && rowHidden === false && subCurrent === 'true'
       && crumbHidden === false && grid > 0,
     `nav=${navCurrent} row=${!rowHidden} sub=${subCurrent} ` +
       `crumb=${!crumbHidden} grid=${grid}`);

  await page.locator('#patterns-concept-map-subtab').click();
  await page.waitForSelector('#patterns-concept-map-content:not([hidden])',
    {timeout: 5000}).catch(() => {});
  const cheatHidden = await page.locator('#patterns-cheat-sheet-content')
    .evaluate(el => el.hidden);
  const cmCurrent = await page.locator('#patterns-concept-map-subtab')
    .getAttribute('aria-current');
  ok('patterns: switch to concept-map (cheat-sheet hidden, subtab current)',
     cheatHidden === true && cmCurrent === 'true',
     `cheatHidden=${cheatHidden} cm=${cmCurrent}`);

  await page.locator('#patterns-concept-map-subtab').click();
  await page.waitForTimeout(400);
  const errs = await page.locator('#patterns-concept-map-content .callout.error')
    .count();
  const cmStill = await page.locator('#patterns-concept-map-subtab')
    .getAttribute('aria-current');
  ok('patterns: re-click active subtab is a no-op',
     errs === 0 && cmStill === 'true', `errs=${errs} cm=${cmStill}`);
  await page.context().close();
}

// Subtab switching after the split, and re-clicking the active subtab
// is a no-op (lazyInit bails on initialized -> no duplicate render).
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
await tabLevelTest('flashcards', '#flashcards', 'nav-flashcards',
  'flashcards-content', '#fc-card-wrap > *');
await flashcardsFilterTest();
await patternsSubtabTest();
await decoderActivationTest();
await sameHashImportRetryTest();

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
