// Measures the forced-reflow cost that the read/write split in
// SortableListForm.#animateLayoutChange avoids. Self-contained: builds its
// own list and runs both patterns in-page, so it needs no app server
// (unlike the other e2e tests). Reads Chromium's RecalcStyleCount and
// LayoutCount through the CDP Performance domain.
//
// Proves the claim the architecture doc rests on: interleaving a
// getBoundingClientRect() read with an li.animate() write per item forces
// one synchronous reflow (style recalc + layout) per item, while batching
// all reads and then all writes forces one total. animate() is a
// layout-invalidating write even though transform is compositor-friendly
// to render.
//
// Run: node e2e/flip-read-write-split.mjs   (or npm run test:e2e)
import {chromium} from 'playwright';

const N = 2000;
const TRIALS = 3;

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();
const page = await browser.newPage();
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');

async function counters() {
  const {metrics} = await client.send('Performance.getMetrics');
  const get = n => metrics.find(m => m.name === n)?.value ?? 0;
  return {recalc: get('RecalcStyleCount'), layout: get('LayoutCount')};
}

async function trial(mode) {
  await page.evaluate(n => {
    document.body.innerHTML = '<ul id="list" style="margin:0;padding:0;list-style:none">'
      + Array.from({length: n}, (_, i) => '<li style="height:20px">row ' + i + '</li>').join('')
      + '</ul>';
  }, N);
  await page.evaluate(() => document.querySelector('#list').getBoundingClientRect()); // settle

  const before = await counters();
  const ms = await page.evaluate(mode => {
    const items = document.querySelectorAll('#list > li');
    const kf = [{transform: 'translateY(5px)'}, {transform: 'translateY(0)'}];
    const opt = {duration: 200, easing: 'ease-out'};
    const t0 = performance.now();
    if (mode === 'interleaved') {
      items.forEach(li => {
        void li.getBoundingClientRect().top;  // read
        li.animate(kf, opt);                  // write — interleaved
      });
    } else {
      const tops = Array.from(items, li => li.getBoundingClientRect().top); // read all
      items.forEach((li, i) => { void tops[i]; li.animate(kf, opt); });     // write all
    }
    return performance.now() - t0;
  }, mode);
  const after = await counters();
  return {recalc: after.recalc - before.recalc, layout: after.layout - before.layout, ms};
}

const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measure(mode) {
  const runs = [];
  for (let i = 0; i < TRIALS; i++) runs.push(await trial(mode));
  return {
    recalc: median(runs.map(r => r.recalc)),
    layout: median(runs.map(r => r.layout)),
    ms: median(runs.map(r => r.ms))
  };
}

const interleaved = await measure('interleaved');
const batched = await measure('batched');

await browser.close();

const fmt = m => `recalc +${m.recalc} layout +${m.layout} ${m.ms.toFixed(0)}ms`;
ok(`interleaved forces ~one reflow per item (N=${N})`,
   interleaved.recalc >= N * 0.9 && interleaved.layout >= N * 0.9, fmt(interleaved));
ok('batched forces a single reflow total',
   batched.recalc <= 10 && batched.layout <= 10, fmt(batched));

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(allPass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(allPass ? 0 : 1);
