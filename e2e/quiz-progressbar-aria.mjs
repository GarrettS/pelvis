// Browser verification for the quiz progress bars' assistive-technology
// semantics.
//
// Each quiz renders its progress indicator as a styled div track and fill,
// not a native <progress> element, whose fill is stylable only through
// vendor pseudo-elements (::-webkit-progress-value, ::-moz-progress-bar)
// with inconsistent results across engines. To keep the semantics a native
// <progress> exposes, the track carries role="progressbar" with
// aria-valuemin/valuemax/valuenow, and aria-valuetext mirrors the visible
// "Question X of Y" label so assistive technology announces the label
// instead of a bare percentage. The visible label sets aria-hidden so it is
// not announced twice.
//
// These assertions guard updateQuizUI (masterquiz.js) and renderQuestion
// (equivalence-quiz.js). They fail if either stops writing the ARIA values
// or aria-valuetext drifts from the visible label.
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

function readProgressBar(page, trackId, textId) {
  return page.evaluate(([track, text]) => {
    const bar = document.getElementById(track);
    const label = document.getElementById(text);
    return {
      role: bar.getAttribute('role'),
      valuemin: bar.getAttribute('aria-valuemin'),
      valuemax: bar.getAttribute('aria-valuemax'),
      valuenow: bar.getAttribute('aria-valuenow'),
      valuetext: bar.getAttribute('aria-valuetext'),
      name: bar.getAttribute('aria-label'),
      labelHidden: label.getAttribute('aria-hidden'),
      labelText: label.textContent
    };
  }, [trackId, textId]);
}

function assertQuestionOne(label, bar) {
  const total = Number(bar.valuemax);
  ok(`${label}: track is a named progressbar`,
     bar.role === 'progressbar' && bar.name === 'Quiz progress',
     `role=${bar.role} name=${bar.name}`);
  ok(`${label}: question 1 sets valuemin 0, valuenow 0, valuemax > 0`,
     bar.valuemin === '0' && bar.valuenow === '0' && total > 0,
     `min=${bar.valuemin} now=${bar.valuenow} max=${bar.valuemax}`);
  ok(`${label}: valuetext mirrors the visible label`,
     bar.valuetext === `Question 1 of ${total}`
       && bar.valuetext === bar.labelText,
     `valuetext=${bar.valuetext} labelText=${bar.labelText}`);
  ok(`${label}: visible label is hidden from AT (no double read)`,
     bar.labelHidden === 'true', `aria-hidden=${bar.labelHidden}`);
  return total;
}

// Master quiz: config screen, Start, then the progressbar reflects question
// 1. Answering and advancing increments aria-valuenow while valuemax holds.
async function masterQuizTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#masterquiz`);
  await page.waitForSelector('#mq-start:not([disabled])', {timeout: 5000});
  await page.locator('#mq-start').click();
  await page.waitForSelector('#mq-progress-track[aria-valuenow]',
    {timeout: 5000});

  const first = await readProgressBar(page, 'mq-progress-track',
    'mq-progress-text');
  const total = assertQuestionOne('master quiz', first);

  await page.locator('#mq-options input[name="answer"]').first().check();
  await page.locator('#mq-submit').click();
  await page.locator('#mq-next').click();
  await page.waitForSelector('#mq-progress-track[aria-valuenow="1"]',
    {timeout: 5000}).catch(() => {});

  const second = await readProgressBar(page, 'mq-progress-track',
    'mq-progress-text');
  ok('master quiz: advancing increments valuenow, valuemax holds',
     second.valuenow === '1' && second.valuemax === first.valuemax,
     `now=${second.valuenow} max=${second.valuemax}`);
  ok('master quiz: valuetext tracks the advance',
     second.valuetext === `Question 2 of ${total}`
       && second.valuetext === second.labelText,
     `valuetext=${second.valuetext} labelText=${second.labelText}`);
  await page.context().close();
}

// Equivalence quiz auto-starts on activation (resetSession at module load),
// so the progressbar reflects question 1 without a config step.
async function equivalenceQuizTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html#equivalence`);
  await page.waitForSelector('#equiv-progress-track[aria-valuenow]',
    {timeout: 5000});

  const bar = await readProgressBar(page, 'equiv-progress-track',
    'equiv-progress-text');
  assertQuestionOne('equivalence quiz', bar);
  await page.context().close();
}

await masterQuizTest();
await equivalenceQuizTest();

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
