// Browser verification for pointer-proximity autoscroll on the Diagnose -> Causal Chains
// sortable list. With the list overflowing a short viewport, a held pointer parked in the
// bottom edge band scrolls the page toward the list end; the clone clamps at the list
// bottom and the page stops within one step once the clone offset stalls.
//
// Requires a static server for the repo root. Default http://localhost:8000; override with
// E2E_BASE. Run: npm run test:e2e
import {chromium} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';
const AUTOSCROLL_MAX_STEP = 16;
const AUTOSCROLL_ROUNDING_TOLERANCE = 1;
const AUTOSCROLL_STABLE_SAMPLES = 4;
const AUTOSCROLL_POST_STABLE_SAMPLES = 6;

const reachable = await fetch(`${BASE}/index.html`).then(r => r.ok, () => false);
if (!reachable) {
  console.error(`Server not reachable at ${BASE}. ` +
    `Start one in the repo root, e.g.: python3 -m http.server 8000`);
  process.exit(2);
}

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 320}});
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(`${BASE}/index.html#diagnose/causal-chains`);

const OL = '#diagnose-causal-chains-content .sortable-list';
await page.waitForSelector(`${OL} > li`, {timeout: 8000});

const list = page.locator(OL).first();
const items = () => list.locator(':scope > li');

const readAutoscrollSample = () => page.evaluate(sel => {
  const clone = document.querySelector('.sortable-list-clone');
  const listRect = document.querySelector(sel).getBoundingClientRect();
  const cloneRect = clone?.getBoundingClientRect();
  const parsedDragOffset = clone
    ? parseFloat(clone.style.getPropertyValue('--drag-offset'))
    : 0;
  return {
    hasClone: Boolean(clone),
    scrollY: window.scrollY,
    dragOffset: Number.isFinite(parsedDragOffset) ? parsedDragOffset : 0,
    cloneBottom: cloneRect?.bottom ?? null,
    listBottom: listRect.bottom
  };
}, OL);

// Scroll the list's first item just below the sticky nav so it is grabbable, with the
// list end still past the fold -- the drag then has room to autoscroll toward it.
await page.evaluate(sel => {
  const first = document.querySelector(sel + ' > li');
  window.scrollTo(0, Math.round(first.getBoundingClientRect().top + window.scrollY - 100));
}, OL);
await page.waitForTimeout(100);

const overflows = await page.evaluate(sel => {
  const r = document.querySelector(sel).getBoundingClientRect();
  return r.bottom > window.innerHeight || r.top < 0;
}, OL);

if (!overflows) {
  ok('autoscroll: list overflows the scrollport (precondition)', false,
     'list fits the 320px viewport -- cannot exercise autoscroll');
} else {
  const startY = await page.evaluate(() => window.scrollY);
  const asGrab = await items().first().boundingBox();
  const asX = asGrab.x + asGrab.width / 2;
  await page.mouse.move(asX, asGrab.y + asGrab.height / 2);
  await page.mouse.down();
  // Hold just inside the scrollport's bottom edge; send no further moves. The
  // pointer stays in the edge band while the page scrolls under it.
  await page.mouse.move(asX, 320 - 3, {steps: 8});

  let previousSample = await readAutoscrollSample();
  let lastScrollY = previousSample.scrollY;
  let stableOffsetSamples = 0;
  let offsetStableScrollY = null;
  let maxScrollYAfterOffsetStable = null;
  let postStableSamples = 0;

  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(50);
    const sample = await readAutoscrollSample();
    const offsetDelta = Math.abs(sample.dragOffset - previousSample.dragOffset);
    const isDragOffsetStable = offsetDelta <= AUTOSCROLL_ROUNDING_TOLERANCE;

    if (isDragOffsetStable) {
      stableOffsetSamples++;
    } else {
      stableOffsetSamples = 0;
      offsetStableScrollY = null;
      maxScrollYAfterOffsetStable = null;
      postStableSamples = 0;
    }

    if (stableOffsetSamples === AUTOSCROLL_STABLE_SAMPLES) {
      offsetStableScrollY = sample.scrollY;
      maxScrollYAfterOffsetStable = sample.scrollY;
    }

    if (offsetStableScrollY !== null) {
      maxScrollYAfterOffsetStable = Math.max(
        maxScrollYAfterOffsetStable,
        sample.scrollY);
      postStableSamples++;
    }

    lastScrollY = sample.scrollY;
    previousSample = sample;
    if (postStableSamples >= AUTOSCROLL_POST_STABLE_SAMPLES) break;
  }
  // Regression: once the clone is clamped, a held-pointer jitter (a real finger fires
  // continuous pointermoves) must not restart the loop and drift the page.
  const scrollBeforeJitter = await page.evaluate(() => window.scrollY);
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(asX, 320 - 3 + (i % 2));
    await page.waitForTimeout(16);
  }
  const scrollAfterJitter = await page.evaluate(() => window.scrollY);
  await page.mouse.up();
  await page.waitForTimeout(300);

  ok('autoscroll: a held pointer at the edge scrolls the page toward the list end',
     lastScrollY - startY >= AUTOSCROLL_MAX_STEP - AUTOSCROLL_ROUNDING_TOLERANCE,
     `from=${startY} to=${lastScrollY}`);
  ok('autoscroll: clone offset reaches a stable limit',
     offsetStableScrollY !== null,
     `stableAt=${offsetStableScrollY} offset=${previousSample.dragOffset}`);
  ok('autoscroll: clone reaches the list bottom limit',
     previousSample.hasClone
       && previousSample.cloneBottom !== null
       && previousSample.cloneBottom
           >= previousSample.listBottom - AUTOSCROLL_ROUNDING_TOLERANCE,
     `cloneBottom=${previousSample.cloneBottom} listBottom=${
       previousSample.listBottom}`);

  const scrollAfterOffsetStable = offsetStableScrollY === null
    ? Number.POSITIVE_INFINITY
    : maxScrollYAfterOffsetStable - offsetStableScrollY;
  ok('autoscroll: page scroll stops within one step after clone offset stabilizes',
     scrollAfterOffsetStable <= AUTOSCROLL_MAX_STEP + AUTOSCROLL_ROUNDING_TOLERANCE,
     `afterStable=${scrollAfterOffsetStable} limit=${
       AUTOSCROLL_MAX_STEP + AUTOSCROLL_ROUNDING_TOLERANCE}`);

  ok('autoscroll: held-pointer jitter does not drift the page once clamped',
     Math.abs(scrollAfterJitter - scrollBeforeJitter) <= AUTOSCROLL_ROUNDING_TOLERANCE,
     `before=${scrollBeforeJitter} after=${scrollAfterJitter}`);
}

ok('no page errors', errs.length === 0, errs.join('; '));

await browser.close();

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
