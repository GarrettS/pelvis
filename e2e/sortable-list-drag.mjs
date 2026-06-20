// Browser verification for the sortable-list drag-to-reorder behavior on the
// Diagnose -> Causal Chains view. A committed drop mutates the DOM order of the
// `.sortable-list > li`s; the order is read off their data-step values.
//
// Covers: dragging a middle row to the top (it leads, the rest keep their
// relative order), dragging a row to the end (it trails), and a press-release
// in place (no movement, order unchanged).
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

ok('no page errors', errs.length === 0, errs.join('; '));

await browser.close();

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
