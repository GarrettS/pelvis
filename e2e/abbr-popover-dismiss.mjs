// Browser verification for the abbr popover's keyboard access and dismiss.
//
// Focusing a static abbr opens the popover (showForAbbr) and sets
// aria-describedby to the popover id. Escape light-dismisses the auto
// popover, and focusout clears aria-describedby. The sequence completes
// with no uncaught error.
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

// Focus opens the popover and sets aria-describedby. Escape closes it; a
// following Tab fires focusout, which runs dismissPopover. The sequence
// drives the open, describe, and close paths with no uncaught error.
async function keyboardDismissTest() {
  const page = await newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err));

  // The decoder region buttons carry static abbrs that are visible once the
  // route is active; a hidden abbr cannot take focus.
  await page.goto(`${BASE}/index.html#anatomy/decoder`);
  await page.waitForSelector('#decoder-region-btns abbr[data-title]',
    {state: 'visible', timeout: 5000}).catch(() => {});

  const abbr = page.locator('#decoder-region-btns abbr[data-title]').first();
  const popover = page.locator('#abbr-popover');

  await abbr.focus();
  await page.waitForTimeout(100);
  ok('abbr-popover: focus opens the popover',
     await popover.evaluate(el => el.matches(':popover-open')));
  ok('abbr-popover: aria-describedby set while open',
     await abbr.getAttribute('aria-describedby') === 'abbr-popover',
     `describedby=${await abbr.getAttribute('aria-describedby')}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok('abbr-popover: Escape closes the popover',
     await popover.evaluate(el => !el.matches(':popover-open')));

  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);

  const popoverErrors = pageErrors.filter(e =>
    /popover|InvalidState/i.test(`${e.name} ${e.message}`));
  ok('abbr-popover: no uncaught error through focus/Escape/Tab',
     popoverErrors.length === 0,
     `errors=${popoverErrors.map(e => e.message).join('; ')}`);
  ok('abbr-popover: aria-describedby cleared after close',
     await abbr.getAttribute('aria-describedby') == null,
     `describedby=${await abbr.getAttribute('aria-describedby')}`);

  await page.context().close();
}

await keyboardDismissTest();

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
