// Browser verification for anatomize session restore when the persisted
// `current` structure was already identified — answered correctly, then
// saved before the user clicked Next (a reload at that moment, or a
// re-render of the session).
//
// The restore path must show the answered detail state with Next enabled,
// so the user can proceed. Re-prompting the current structure instead is a
// dead end: it is already marked correct, so clicking its label is a no-op
// (assessSelectedStructure bails on an already-identified structure) while
// Next stays disabled. Every other click then scores -1. That is the
// "Score: -4 · 2 of 12, Next disabled" stuck state this guards against.
//
// Requires a static server for the repo root. Default: http://localhost:8000
// Override with E2E_BASE. Run: npm run test:e2e
import {chromium} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';
const IMAGE_ID = 'pelvic_outlet';
const STORAGE_KEY = 'anatomize_progress';

const reachable = await fetch(`${BASE}/index.html`).then(r => r.ok, () => false);
if (!reachable) {
  console.error(`Server not reachable at ${BASE}. ` +
    `Start one in the repo root, e.g.: python3 -m http.server 8000`);
  process.exit(2);
}

const data = await fetch(`${BASE}/data/anatomize-data.json`).then(r => r.json());
const imgEntry = data.images[IMAGE_ID];
const structures = imgEntry.structures
  || data.sharedStructures[imgEntry.structuresRef];
const structureIds = Object.keys(structures);

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();

async function seededPage(snapshot) {
  const ctx = await browser.newContext({serviceWorkers: 'block'});
  const page = await ctx.newPage();
  await page.addInitScript(([key, value]) => {
    try {
      localStorage.setItem(key, value);
    } catch (storageSeedError) {
      // Seeding only. A storage-blocked context would surface as the
      // restore assertions failing below, which is the signal we want.
    }
  }, [STORAGE_KEY, JSON.stringify({[IMAGE_ID]: snapshot})]);
  await page.goto(`${BASE}/index.html#anatomy/anatomize/${IMAGE_ID}`);
  await page.waitForSelector('#anat-arena .anatomize-label', {timeout: 5000})
    .catch(() => {});
  return page;
}

// Answered the current structure correctly, persisted before advancing.
async function restoreAnsweredCurrentTest() {
  const identified = structureIds.slice(0, 2);
  const snapshot = {
    score: -4,
    identified,
    firstAttempt: identified.slice(),
    queue: structureIds.slice(2),
    current: structureIds[1],
    attemptedOnCurrent: false,
    reviewMode: false
  };
  const page = await seededPage(snapshot);

  const score = await page.locator('#anat-score-text').textContent();
  ok('restore answered-current: reproduces the reported score line',
     /Score: -4/.test(score ?? '') && /2 of 12/.test(score ?? ''),
     `score=${score}`);

  const nextDisabled = await page.locator('#anat-next')
    .evaluate(el => el.disabled);
  ok('restore answered-current: Next is enabled',
     nextDisabled === false, `disabled=${nextDisabled}`);

  const hints = await page.locator('#anat-detail .anatomize-detail-hint').count();
  ok('restore answered-current: shows answered detail, not a re-prompt',
     hints === 0, `hintCount=${hints}`);

  const solved = await page.locator('#anat-arena .anatomize-label.correct')
    .count();
  ok('restore answered-current: solved structures stay marked correct',
     solved === identified.length, `solved=${solved}`);

  // Next must actually advance to the next queued structure: a fresh prompt
  // (hint reappears) with Next disabled again. Guard the click so a stuck
  // (disabled) Next reports a clean failure instead of a click timeout.
  const canAdvance = await page.locator('#anat-next')
    .evaluate(el => !el.disabled);
  if (canAdvance) {
    await page.locator('#anat-next').click();
    await page.waitForSelector('#anat-detail .anatomize-detail-hint',
      {timeout: 5000}).catch(() => {});
  }
  const promptAfter = await page.locator('#anat-detail .anatomize-detail-hint')
    .count();
  const disabledAfter = await page.locator('#anat-next')
    .evaluate(el => el.disabled);
  ok('restore answered-current: Next advances to the next prompt',
     canAdvance && promptAfter === 1 && disabledAfter === true,
     `canAdvance=${canAdvance} prompt=${promptAfter} disabled=${disabledAfter}`);

  await page.context().close();
}

// current was never identified: the user was mid-question. Restore must
// re-prompt it with Next disabled. Guards against over-correcting the fix
// into skipping legitimately unanswered prompts.
async function restoreMidQuestionTest() {
  const identified = structureIds.slice(0, 2);
  const snapshot = {
    score: 2,
    identified,
    firstAttempt: identified.slice(),
    queue: structureIds.slice(3),
    current: structureIds[2],
    attemptedOnCurrent: false,
    reviewMode: false
  };
  const page = await seededPage(snapshot);

  const hints = await page.locator('#anat-detail .anatomize-detail-hint').count();
  const nextDisabled = await page.locator('#anat-next')
    .evaluate(el => el.disabled);
  ok('restore mid-question: re-prompts current with Next disabled',
     hints === 1 && nextDisabled === true,
     `hint=${hints} disabled=${nextDisabled}`);

  await page.context().close();
}

await restoreAnsweredCurrentTest();
await restoreMidQuestionTest();

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
