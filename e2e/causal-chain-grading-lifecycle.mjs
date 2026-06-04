// Browser verification for the causal-chain grading lifecycle. Grading
// (correct/incorrect colors) hides while a drag is in progress, then resolves
// by outcome: a same-slot drop or an abort (Escape, pointercancel) re-shows the
// unchanged grading; a reorder clears it. Hiding is CSS-only, via
// .sortable-list:has(> li.active-drag-item) — there is no grading-stale class.
//
// Regression guard for two shipped bugs: a no-op drop after a reorder used to
// un-hide stale grading, and the same showed up as grading re-appearing after
// navigating away and back.
//
// Requires a static server for the repo root. Default http://localhost:8000;
// override with E2E_BASE. Run: npm run test:e2e
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
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(`${BASE}/index.html#diagnose/causal-chains`);
const OL = '#diagnose-causal-chains-content .sortable-list';
await page.waitForSelector(`${OL} > li`, {timeout: 8000});

const list = page.locator(OL).first();
const items = () => list.locator(':scope > li');
const check = page.locator(
  '#diagnose-causal-chains-content button[name=checkResults]').first();
const reshuffle = page.locator(
  '#diagnose-causal-chains-content button[name=reshuffle]').first();

// A fully correct random starting order disables dragging. Reshuffle until the
// graded list remains draggable so the lifecycle checks cannot flake.
async function recheck() {
  for (let attempt = 0; attempt < 10; attempt++) {
    await check.click();
    await page.waitForTimeout(120);
    if (await list.getAttribute('aria-disabled') !== 'true') return;
    await reshuffle.click();
    await page.waitForTimeout(250);
  }
  throw new Error('Could not produce an incorrect, draggable chain');
}

// Scope to direct-child li — the same set the CSS targets — so the drag clone
// (a .sortable-list-clone carrying cloned grading classes) is not counted. The
// bg sample is a non-dragged graded li, representative of the :has() hiding.
const state = () => page.evaluate(OL => {
  const ol = document.querySelector(OL);
  const items = [...ol.querySelectorAll(':scope > li')];
  const graded = items.filter(li =>
    li.classList.contains('correct') || li.classList.contains('incorrect'));
  const sample = items[1] ?? items[0];
  return {
    order: items.map(item => item.dataset.step),
    graded: graded.length,
    bg: sample ? getComputedStyle(sample).backgroundColor : null,
    activeDrag: items.some(item => item.classList.contains('active-drag-item')),
  };
}, OL);

// Playwright mouse input goes through Chromium's pointer-capture path. Synthetic
// dispatched PointerEvents start the drag but do not reliably drive a reorder.
async function beginDrag(moveToIdx) {
  await list.scrollIntoViewIfNeeded();
  const start = await items().first().boundingBox();
  if (!start) throw new Error('Could not measure the first chain item');

  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();

  if (moveToIdx != null) {
    const target = await items().nth(moveToIdx).boundingBox();
    if (!target) throw new Error(`Could not measure chain item ${moveToIdx}`);
    await page.mouse.move(x, target.y + target.height * 0.8, {steps: 12});
  }
}

async function drag(moveToIdx, end) {
  await beginDrag(moveToIdx);
  if (end === 'drop') {
    await page.mouse.up();
  } else if (end === 'escape') {
    await page.keyboard.press('Escape');
    await page.mouse.up();
  } else if (end === 'cancel') {
    await list.locator(':scope > li.active-drag-item').evaluate(li =>
      li.dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      })));
    await page.mouse.up();
  }
}

await recheck();
let s = await state();
ok('check: grading shown', s.graded > 0, JSON.stringify(s));
const gradedBg = s.bg;

await beginDrag(null);
s = await state();
ok('drag start: grading hidden, active-drag-item set',
   s.activeDrag && s.graded > 0 && s.bg !== gradedBg, JSON.stringify(s));
await page.mouse.up();
await page.waitForTimeout(150);

await recheck();
const noOpBefore = await state();
await drag(null, 'drop');
await page.waitForTimeout(150);
s = await state();
ok('no-op drop: grading re-shown',
   s.graded > 0 && s.bg === noOpBefore.bg && !s.activeDrag
     && s.order.join() === noOpBefore.order.join(),
   JSON.stringify(s));

await recheck();
const reorderBefore = await state();
await drag(3, 'drop');
await page.waitForTimeout(400);
s = await state();
ok('reorder: grading cleared',
   s.graded === 0 && !s.activeDrag
     && s.order.join() !== reorderBefore.order.join(),
   JSON.stringify(s));

const clearedAfterReorder = s;
await drag(null, 'drop');
await page.waitForTimeout(150);
s = await state();
ok('no-op after reorder: grading stays cleared',
   s.graded === 0 && !s.activeDrag
     && s.order.join() === clearedAfterReorder.order.join(),
   JSON.stringify(s));

await recheck();
const escapeBefore = await state();
await drag(3, 'escape');
await page.waitForTimeout(150);
s = await state();
ok('escape abort: grading re-shown',
   s.graded > 0 && s.bg === escapeBefore.bg && !s.activeDrag
     && s.order.join() === escapeBefore.order.join(),
   JSON.stringify(s));

await recheck();
const cancelBefore = await state();
await drag(3, 'cancel');
await page.waitForTimeout(150);
s = await state();
ok('pointercancel abort: grading re-shown',
   s.graded > 0 && s.bg === cancelBefore.bg && !s.activeDrag
     && s.order.join() === cancelBefore.order.join(),
   JSON.stringify(s));

await recheck();
await drag(3, 'drop');
await page.waitForTimeout(400);
await page.locator('#diagnose-decision-tree-subtab').click();
await page.waitForTimeout(250);
await page.locator('#diagnose-causal-chains-subtab').click();
await page.waitForTimeout(250);
s = await state();
ok('reorder then navigate back: still cleared', s.graded === 0, JSON.stringify(s));

ok('no page errors', errs.length === 0, errs.join('; '));

await browser.close();

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
