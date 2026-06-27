// Browser verification for the sortable-list drag-to-reorder behavior on the
// Diagnose -> Causal Chains view. A committed drop mutates the DOM order of the
// `.sortable-list > li`s; the order is read off their data-step values.
//
// Covers: dragging a middle row to the top (it leads, the rest keep their
// relative order), dragging a row to the end (it trails), a press-release in
// place (no movement, order unchanged), and the drop bar (a .sortable-list
// ::before) tracking the gap before the target -- at the list bottom on
// end-of-list and gliding out from the grabbed item on reveal rather than
// sliding from the list top -- and that a cancelled drag settles the clone
// home and removes it.
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

// The committed order is the sequence of data-step values on the direct-child
// li. The drag clone is a .sortable-list-clone, so :scope > li excludes it.
const order = () => page.evaluate(OL =>
  [...document.querySelector(OL).querySelectorAll(':scope > li')]
    .map(li => li.dataset.step), OL);

// Playwright mouse input goes through Chromium's pointer-capture path, which the
// document-bound pointermove/pointerup handlers track; synthetic dispatched
// PointerEvents start the drag but do not reliably drive a reorder. Press on the
// grabbed row's center, then move in steps so dragMove fires and the drop target
// updates before release. targetY is an absolute viewport y to land the pointer.
async function dragRowTo(grabIdx, targetY) {
  await list.scrollIntoViewIfNeeded();
  const grab = await items().nth(grabIdx).boundingBox();
  if (!grab) throw new Error(`Could not measure chain item ${grabIdx}`);
  const x = grab.x + grab.width / 2;
  await page.mouse.move(x, grab.y + grab.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, targetY, {steps: 14});
  await page.mouse.up();
  await page.waitForTimeout(400);   // let the FLIP settle and currentOrder commit
}

// Need at least a few rows for "middle" and "relative order" to mean anything.
const initial = await order();
ok('setup: list has several rows', initial.length >= 4,
   `count=${initial.length} order=${initial.join()}`);

// Drag a middle row to the TOP. Land the pointer above the first row's midpoint
// so the drop targets the first row (insert-before), seating the dragged step
// first. The other steps keep their relative order.
const midIdx = Math.floor(initial.length / 2);
const midStep = initial[midIdx];
const firstBox = await items().first().boundingBox();
await dragRowTo(midIdx, firstBox.y + 2);

const afterTop = await order();
const restAfterTop = afterTop.filter(step => step !== midStep);
const restBeforeTop = initial.filter(step => step !== midStep);
ok('drag middle row to top: dragged step leads',
   afterTop[0] === midStep, `step=${midStep} order=${afterTop.join()}`);
ok('drag middle row to top: other steps keep relative order',
   restAfterTop.join() === restBeforeTop.join(),
   `after=${restAfterTop.join()} before=${restBeforeTop.join()}`);

// Drag a row to the END. Land the pointer below the last row's midpoint so the
// drop targets past the last row (append), seating the dragged step last.
const beforeEnd = await order();
const endStep = beforeEnd[0];
const lastBox = await items().last().boundingBox();
await dragRowTo(0, lastBox.y + lastBox.height - 2);

const afterEnd = await order();
ok('drag row to end: dragged step trails',
   afterEnd.at(-1) === endStep, `step=${endStep} order=${afterEnd.join()}`);

// No-op: press and release a row in place. Order must be unchanged.
const beforeNoOp = await order();
const noOpBox = await items().nth(1).boundingBox();
const noOpX = noOpBox.x + noOpBox.width / 2;
const noOpY = noOpBox.y + noOpBox.height / 2;
await page.mouse.move(noOpX, noOpY);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(200);
const afterNoOp = await order();
ok('press-release in place: order unchanged',
   afterNoOp.join() === beforeNoOp.join(),
   `after=${afterNoOp.join()} before=${beforeNoOp.join()}`);

// The drop bar is a .sortable-list::before, slid to the gap by --marker-position.
// Hold a drag (no release) and read the ::before's resolved position: its bottom
// edge should sit on the target's top (the gap), and on the list's bottom at
// end-of-list. It reads fully opaque on a real target (the source's home slot
// fades it out via the marker-at-home class).
const readBar = targetIdx => page.evaluate(({sel, targetIdx}) => {
  const ol = document.querySelector(sel);
  const its = [...ol.querySelectorAll(':scope > li')];
  const bf = getComputedStyle(ol, '::before');
  const olR = ol.getBoundingClientRect();
  const tR = targetIdx == null ? null : its[targetIdx].getBoundingClientRect();
  const m = bf.transform;                       // matrix(a,b,c,d,e,f); f = translateY
  const translateY = m === 'none' ? 0 : parseFloat(m.split(',')[5]);
  const barBottom = olR.top + parseFloat(bf.top) + translateY + parseFloat(bf.height);
  return {
    markerOpacity: bf.opacity,
    barBottom, gapTop: tR ? tR.top : null, listBottom: olR.bottom,
  };
}, {sel: OL, targetIdx});

// The bar glides to its target (transition on transform), so wait for the
// transform to stop changing before measuring its settled position.
const settleBar = async () => {
  let prev = '';
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate(sel =>
      getComputedStyle(document.querySelector(sel), '::before').transform, OL);
    if (t === prev) return;
    prev = t;
    await page.waitForTimeout(25);
  }
};

const barGrab = await items().nth(0).boundingBox();
const barX = barGrab.x + barGrab.width / 2;
await page.mouse.move(barX, barGrab.y + barGrab.height / 2);
await page.mouse.down();

const beforeTargetBox = await items().nth(3).boundingBox();
await page.mouse.move(barX, beforeTargetBox.y + 2, {steps: 10});
await settleBar();
const beforeBar = await readBar(3);
ok('drop bar sits in the gap before the target',
   Math.abs(beforeBar.barBottom - beforeBar.gapTop) < 1 && beforeBar.markerOpacity === '1',
   `barBottom=${beforeBar.barBottom} gapTop=${beforeBar.gapTop} opacity=${beforeBar.markerOpacity}`);

const endTargetBox = await items().last().boundingBox();
await page.mouse.move(barX, endTargetBox.y + endTargetBox.height - 2, {steps: 10});
await settleBar();
const endBar = await readBar(null);
ok('drop bar sits at the list bottom at end-of-list',
   Math.abs(endBar.barBottom - endBar.listBottom) < 1 && endBar.markerOpacity === '1',
   `barBottom=${endBar.barBottom} listBottom=${endBar.listBottom} opacity=${endBar.markerOpacity}`);

// Return to the source's own slot so the release below is a no-op (order unchanged).
await page.mouse.move(barX, barGrab.y + barGrab.height / 2, {steps: 10});

await page.mouse.up();
await page.waitForTimeout(200);

// On reveal the bar must glide out from the grabbed item's parked position, not slide
// in from the list top (the fixed bug: a stale --marker-position read as 0). Grab a
// middle item, cross up one slot to the first real target, and read the bar's transform
// immediately -- it should still be on the grab side (above the target), then settle on it.
const barTranslateY = () => page.evaluate(sel => {
  const m = getComputedStyle(document.querySelector(sel), '::before').transform;
  return m === 'none' ? 0 : parseFloat(m.split(',')[5]);   // matrix(...): f is translateY
}, OL);
const liTopInList = idx => page.evaluate(({sel, idx}) => {
  const ol = document.querySelector(sel);
  return ol.querySelectorAll(':scope > li')[idx].getBoundingClientRect().top
    - ol.getBoundingClientRect().top;
}, {sel: OL, idx});

const revealIdx = 3;
const revealGrab = await items().nth(revealIdx).boundingBox();
const revealX = revealGrab.x + revealGrab.width / 2;
await page.mouse.move(revealX, revealGrab.y + revealGrab.height / 2);
await page.mouse.down();
const grabTop = await liTopInList(revealIdx);
const revealTargetBox = await items().nth(revealIdx - 1).boundingBox();
await page.mouse.move(revealX, revealTargetBox.y + 2, {steps: 6});
const revealY = await barTranslateY();          // read immediately, mid-glide from the grab
const revealTargetTop = await liTopInList(revealIdx - 1);
await settleBar();
const revealSettledY = await barTranslateY();
ok('drop bar glides out from the grabbed item on reveal, not the list top',
   revealY > revealTargetTop && Math.abs(revealSettledY - revealTargetTop) < 1,
   `revealY=${revealY} grab=${grabTop} target=${revealTargetTop} settled=${revealSettledY}`);
await page.mouse.up();
await page.waitForTimeout(200);

// Regression: coming back down into the source from above must not slide the bar to the
// gap BELOW the source. The source is a marker target, so its own midpoint splits the home
// band -- over the source's top half the bar parks at the gap ABOVE it (cloneTop), never
// below. (Pre-fix the source was skipped, so the whole band resolved to the lower gap.)
const homeIdx = 3;
const homeGrab = await items().nth(homeIdx).boundingBox();
const homeX = homeGrab.x + homeGrab.width / 2;
await page.mouse.move(homeX, homeGrab.y + homeGrab.height / 2);
await page.mouse.down();
const upBox = await items().nth(homeIdx - 2).boundingBox();
await page.mouse.move(homeX, upBox.y + 2, {steps: 8});
await settleBar();
await page.mouse.move(homeX, homeGrab.y + homeGrab.height * 0.25, {steps: 8});
await settleBar();
const homeBarY = await barTranslateY();
const aboveSourceGap = await liTopInList(homeIdx);
const belowSourceGap = await liTopInList(homeIdx + 1);
ok('coming down into the source parks the bar above it, not below',
   Math.abs(homeBarY - aboveSourceGap) < 1 && homeBarY < belowSourceGap - 1,
   `barY=${homeBarY} above=${aboveSourceGap} below=${belowSourceGap}`);
await page.mouse.up();
await page.waitForTimeout(200);

// Cancelling mid-drag (Escape) settles the clone home and removes it -- the WAAPI
// settle path (dy > 0.5; the no-op press-release above hits the sub-pixel shortcut).
// Offset the clone, Escape, and after the settle finishes there should be no clone
// left in the DOM and the order unchanged.
const beforeCancel = await order();
const cancelGrab = await items().nth(2).boundingBox();
const cancelX = cancelGrab.x + cancelGrab.width / 2;
await page.mouse.move(cancelX, cancelGrab.y + cancelGrab.height / 2);
await page.mouse.down();
await page.mouse.move(cancelX, cancelGrab.y + cancelGrab.height / 2 + 30, {steps: 6});
await page.keyboard.press('Escape');
await page.waitForTimeout(700);   // let the settle animation finish and remove the clone
await page.mouse.up();
const cloneCount = await page.evaluate(() =>
  document.querySelectorAll('.sortable-list-clone').length);
const afterCancel = await order();
ok('cancel settles the clone home and removes it',
   cloneCount === 0 && afterCancel.join() === beforeCancel.join(),
   `clones=${cloneCount} orderUnchanged=${afterCancel.join() === beforeCancel.join()}`);

ok('no page errors', errs.length === 0, errs.join('; '));

await browser.close();

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
