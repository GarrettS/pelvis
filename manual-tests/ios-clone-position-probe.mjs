// Probe: where does the drag clone actually land, Chromium vs WebKit (iOS engine)?
// Reported bug: on iOS the clone is positioned from the window top edge instead
// of over the grabbed row. Measures, mid-drag, the clone's box vs its source row
// and which element each engine treats as the clone's offsetParent (containing
// block). Run with the repo served at http://localhost:8000.
import {chromium, webkit} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';
const OL = '#diagnose-causal-chains-content .sortable-list';

async function probe(engine, name) {
  const browser = await engine.launch();
  // iPhone-ish viewport so layout matches the reported context.
  const page = await browser.newPage({viewport: {width: 390, height: 700}});
  await page.goto(`${BASE}/index.html#diagnose/causal-chains`);
  await page.waitForSelector(`${OL} > li`, {timeout: 8000});

  const list = page.locator(OL).first();
  const items = list.locator(':scope > li');
  const grabIdx = 1;
  await list.scrollIntoViewIfNeeded();
  const grab = await items.nth(grabIdx).boundingBox();
  const x = grab.x + grab.width / 2;

  await page.mouse.move(x, grab.y + grab.height / 2);
  await page.mouse.down();
  // Move down ~40px so the clone is offset from its pickup spot.
  await page.mouse.move(x, grab.y + grab.height / 2 + 40, {steps: 8});

  const m = await page.evaluate(({OL, grabIdx}) => {
    const ol = document.querySelector(OL);
    const parent = ol.parentElement;            // .sortable-list-parent
    const clone = parent.querySelector('.sortable-list-clone');
    const sourceRow = ol.querySelectorAll(':scope > li')[grabIdx];
    const r = el => { const b = el.getBoundingClientRect(); return {top: b.top, left: b.left}; };
    const op = clone.offsetParent;
    return {
      parentPosition: getComputedStyle(parent).position,
      parentWidth: getComputedStyle(parent).width,
      cloneStyleTop: clone.style.top,
      cloneOffsetParent: op ? (op.className || op.tagName) : 'null',
      cloneTop: r(clone).top,
      sourceTop: r(sourceRow).top,
      parentTop: r(parent).top,
      // Clone should sit ~40px below the source row mid-drag, i.e. cloneTop ≈ sourceTop+40.
      cloneVsSource: r(clone).top - r(sourceRow).top
    };
  }, {OL, grabIdx});

  await page.mouse.up();
  await browser.close();
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(m, null, 2));
  return m;
}

const c = await probe(chromium, 'Chromium');
const w = await probe(webkit, 'WebKit (iOS engine)');

console.log('\n=== VERDICT ===');
console.log(`Chromium clone-vs-source: ${c.cloneVsSource.toFixed(1)}px  (offsetParent=${c.cloneOffsetParent})`);
console.log(`WebKit   clone-vs-source: ${w.cloneVsSource.toFixed(1)}px  (offsetParent=${w.cloneOffsetParent})`);
