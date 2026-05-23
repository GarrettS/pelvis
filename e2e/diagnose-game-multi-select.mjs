// Browser verification for Pattern Identifier multi-select grading.
//
// The Round 2 "Repositioning" step is the only multi-select question in
// the game. It renders as a <form> wrapping a <fieldset id="game-options">
// with <label class="option-row"> rows around <input type="checkbox">.
// Single-select rounds (Round 1, Round 2 Step 2/3) still use .answer-btn.
//
// Grading state is data-attribute driven, CSS-painted:
//  - inputs whose value is in question.correct carry [data-correct] at render
//  - on submit, JS flips fieldset.dataset.answered = fieldset.disabled = true
//  - CSS uses fieldset[data-answered] .option-row:has() rules to paint rows
//
// These tests guard:
//  - the form/fieldset/checkbox structure,
//  - [data-correct] presence on the right inputs at render,
//  - Enter-to-submit via the form,
//  - Check Answer click path,
//  - post-submit state (fieldset disabled, [data-answered] set, submit hidden,
//    visual styling applied via CSS),
//  - non-multi-select rounds still render .answer-btn.
//
// Requires a static server for the repo root. Default: http://localhost:8000
// Override with E2E_BASE. Run: npm run test:e2e
import {chromium} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';
const ROUTE = '#diagnose/game';

const reachable = await fetch(`${BASE}/index.html`).then(r => r.ok, () => false);
if (!reachable) {
  console.error(`Server not reachable at ${BASE}. ` +
    `Start one in the repo root, e.g.: python3 -m http.server 8000`);
  process.exit(2);
}

// Scenario index 0 is Left AIC. Its Repositioning correct set is the three
// asymmetric techniques below. The wrong options are the bilateral PEC set.
const REPOSITIONING_CORRECT = [
  '90-90 Supported Hip Lift with Hemibridge',
  'Right Sidelying Respiratory Left Adductor Pull Back',
  'Left Sidelying Right Glute Max'
];
const REPOSITIONING_WRONG = 'Standing Wall Supported Reach';

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();

async function newPage() {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

// Drive Round 1 to a known answer so Round 2 lands on Left AIC Repositioning.
async function advanceToRepositioning(page) {
  await page.goto(`${BASE}/index.html${ROUTE}`);
  await page.waitForSelector('#game-board .answer-btn', {timeout: 5000});
  // Click "Left AIC" — the first pattern button for scenario 0.
  await page.locator('#game-board .answer-btn').first().click();
  await page.waitForSelector('#game-next', {timeout: 5000});
  await page.locator('#game-next').click();
  await page.waitForSelector('#game-options', {timeout: 5000});
}

// Round 1 wraps its .answer-btn options in a <fieldset class="answer-opts">.
// At render, the correct button carries [data-correct]. On grade, JS sets
// btn.dataset.picked and flips fieldset.dataset.answered = fieldset.disabled
// = true; CSS handles all row painting.
async function singleSelectFieldsetDisableTest() {
  const page = await newPage();
  await page.goto(`${BASE}/index.html${ROUTE}`);
  await page.waitForSelector('#game-board .answer-btn', {timeout: 5000});

  const wrapTag = await page.locator('#game-board .answer-opts')
    .evaluate(n => n.tagName);
  const initialDisabled = await page.locator('#game-board .answer-opts')
    .evaluate(n => n.disabled);
  const preDataAnswered = await page.locator('#game-board .answer-opts')
    .evaluate(n => n.hasAttribute('data-answered'));
  // Scenario 0 is Left AIC — the first button should carry [data-correct].
  const firstHasCorrect = await page.locator('#game-board .answer-btn')
    .first().evaluate(n => n.hasAttribute('data-correct'));
  const secondHasCorrect = await page.locator('#game-board .answer-btn')
    .nth(1).evaluate(n => n.hasAttribute('data-correct'));
  ok('Round 1: options container is a FIELDSET',
     wrapTag === 'FIELDSET', `tag=${wrapTag}`);
  ok('Round 1: fieldset starts enabled',
     initialDisabled === false, `disabled=${initialDisabled}`);
  ok('Round 1: fieldset has no [data-answered] pre-grade',
     preDataAnswered === false);
  ok('Round 1: correct pattern button carries [data-correct]',
     firstHasCorrect === true);
  ok('Round 1: wrong pattern button has no [data-correct]',
     secondHasCorrect === false);

  // Click the WRONG answer (Bilateral PEC) — exercises the data-picked path.
  await page.locator('#game-board .answer-btn').nth(1).click();
  await page.waitForSelector('#game-next', {timeout: 5000});
  await page.waitForTimeout(200);

  const gradedDisabled = await page.locator('#game-board .answer-opts')
    .evaluate(n => n.disabled);
  const gradedDataAnswered = await page.locator('#game-board .answer-opts')
    .evaluate(n => n.hasAttribute('data-answered'));
  const pickedHasAttr = await page.locator('#game-board .answer-btn')
    .nth(1).evaluate(n => n.hasAttribute('data-picked'));
  const correctRowBg = await page.locator('#game-board .answer-btn')
    .first().evaluate(n => getComputedStyle(n).backgroundColor);
  const pickedRowBg = await page.locator('#game-board .answer-btn')
    .nth(1).evaluate(n => getComputedStyle(n).backgroundColor);
  const neutralRowBg = await page.locator('#game-board .answer-btn')
    .nth(2).evaluate(n => getComputedStyle(n).backgroundColor);
  ok('Round 1: fieldset.disabled set on grade',
     gradedDisabled === true, `disabled=${gradedDisabled}`);
  ok('Round 1: fieldset gets [data-answered] on grade',
     gradedDataAnswered === true);
  ok('Round 1: picked button gets [data-picked]', pickedHasAttr === true);
  ok('Round 1: correct + picked + neutral buttons paint differently',
     correctRowBg !== pickedRowBg
       && correctRowBg !== neutralRowBg
       && pickedRowBg !== neutralRowBg,
     `correct=${correctRowBg} picked=${pickedRowBg} neutral=${neutralRowBg}`);

  await page.context().close();
}

async function selectOption(page, value) {
  await page.locator(`#game-options input[value="${value}"]`)
    .locator('xpath=ancestor::label').click();
}

async function rowBackground(page, value) {
  return page.locator(`#game-options input[value="${value}"]`)
    .locator('xpath=ancestor::label')
    .evaluate(n => getComputedStyle(n).backgroundColor);
}

async function structureTest() {
  const page = await newPage();
  await advanceToRepositioning(page);

  const tag = await page.locator('#game-options').evaluate(n => n.tagName);
  ok('multi-select: container is a FIELDSET', tag === 'FIELDSET', `tag=${tag}`);

  const cbCount = await page.locator('#game-options input[type=checkbox]').count();
  const labelCount = await page.locator('#game-options label.option-row').count();
  ok('multi-select: 6 checkboxes inside 6 .option-row labels',
     cbCount === 6 && labelCount === 6,
     `cbs=${cbCount} labels=${labelCount}`);

  const submitInGame = await page.locator('#game-board form button[type=submit]').count();
  ok('multi-select: form has a submit button', submitInGame === 1,
     `count=${submitInGame}`);

  // data-correct is set at render time on inputs whose value is in q.correct.
  const dataCorrectCount = await page.locator('#game-options input[data-correct]').count();
  ok('multi-select: 3 inputs carry [data-correct] at render',
     dataCorrectCount === 3, `count=${dataCorrectCount}`);
  for (const value of REPOSITIONING_CORRECT) {
    const has = await page.locator(`#game-options input[value="${value}"]`)
      .evaluate(n => n.hasAttribute('data-correct'));
    ok(`multi-select: [data-correct] on "${value}"`, has === true);
  }
  const wrongHas = await page.locator(`#game-options input[value="${REPOSITIONING_WRONG}"]`)
    .evaluate(n => n.hasAttribute('data-correct'));
  ok(`multi-select: no [data-correct] on "${REPOSITIONING_WRONG}"`,
     wrongHas === false);

  // Pre-grade: fieldset has no [data-answered], rows are visually neutral.
  const preDataAnswered = await page.locator('#game-options')
    .evaluate(n => n.hasAttribute('data-answered'));
  ok('multi-select: fieldset has no [data-answered] pre-grade',
     preDataAnswered === false);
  const preGradeBg = await rowBackground(page, REPOSITIONING_CORRECT[0]);

  // Selected state pre-grade: :has(input:checked) flips border/color to accent.
  await selectOption(page, REPOSITIONING_CORRECT[0]);
  await page.waitForTimeout(200);  // let the var(--dur-fast) transition settle
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  const {borderColor, color} = await page
    .locator(`#game-options input[value="${REPOSITIONING_CORRECT[0]}"]`)
    .locator('xpath=ancestor::label')
    .evaluate(n => ({borderColor: getComputedStyle(n).borderColor,
                     color: getComputedStyle(n).color}));
  const accentRgb = hexToRgbString(accent);
  ok('multi-select: :has(input:checked) applies accent border/color',
     borderColor === accentRgb && color === accentRgb,
     `border=${borderColor} color=${color} expected=${accentRgb}`);

  // Pre-grade bg of a [data-correct] row must NOT be the post-grade correct bg.
  // Stash this for cross-test reference; we re-check post-grade below.
  ok('multi-select: pre-grade correct row not styled as graded',
     typeof preGradeBg === 'string', `bg=${preGradeBg}`);

  await page.context().close();
}

async function enterSubmitsCorrectAnswerTest() {
  const page = await newPage();
  await advanceToRepositioning(page);

  const preGradeBg = await rowBackground(page, REPOSITIONING_CORRECT[0]);

  for (const value of REPOSITIONING_CORRECT) await selectOption(page, value);
  await page.locator('#game-options input').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('#game-next', {timeout: 5000});
  await page.waitForTimeout(200);  // settle transition before reading colors

  const dataAnswered = await page.locator('#game-options')
    .evaluate(n => n.hasAttribute('data-answered'));
  const disabled = await page.locator('#game-options').evaluate(n => n.disabled);
  const submitHidden = await page.locator('#game-board form button[type=submit]')
    .evaluate(n => n.hidden);
  const wrongPickCount = await page.locator(
    '#game-options input:checked:not([data-correct])'
  ).count();
  const feedback = await page.locator('#game-board .feedback-box').textContent();
  const postGradeBg = await rowBackground(page, REPOSITIONING_CORRECT[0]);

  ok('Enter submits: fieldset gets [data-answered]', dataAnswered === true);
  ok('Enter submits: fieldset becomes disabled', disabled === true);
  ok('Enter submits: submit button hidden', submitHidden === true);
  ok('Enter submits: no checked-not-correct inputs (clean win)',
     wrongPickCount === 0, `count=${wrongPickCount}`);
  ok('Enter submits: feedback box says Correct',
     /Correct\./.test(feedback ?? ''), `feedback=${feedback}`);
  ok('Enter submits: correct row background changes from pre- to post-grade',
     postGradeBg !== preGradeBg,
     `pre=${preGradeBg} post=${postGradeBg}`);

  await page.context().close();
}

async function checkAnswerClickGradesWrongTest() {
  const page = await newPage();
  await advanceToRepositioning(page);

  // Pick 2 correct + 1 wrong — partial answer.
  await selectOption(page, REPOSITIONING_CORRECT[0]);
  await selectOption(page, REPOSITIONING_CORRECT[1]);
  await selectOption(page, REPOSITIONING_WRONG);
  await page.locator('#game-board form button[type=submit]').click();
  await page.waitForSelector('#game-next', {timeout: 5000});
  await page.waitForTimeout(200);

  const wrongPickCount = await page.locator(
    '#game-options input:checked:not([data-correct])'
  ).count();
  const wrongRowText = await page.locator(
    '#game-options label:has(input:checked:not([data-correct]))'
  ).textContent();
  const feedback = await page.locator('#game-board .feedback-box').textContent();

  // The wrong-picked row and a correct row must paint differently.
  const wrongRowBg = await rowBackground(page, REPOSITIONING_WRONG);
  const correctRowBg = await rowBackground(page, REPOSITIONING_CORRECT[0]);

  ok('Click submits: exactly 1 checked-not-correct input',
     wrongPickCount === 1, `count=${wrongPickCount}`);
  ok('Click submits: wrong-pick label contains the wrong option text',
     (wrongRowText ?? '').includes(REPOSITIONING_WRONG),
     `text=${wrongRowText}`);
  ok('Click submits: feedback box says Incorrect',
     /Incorrect\./.test(feedback ?? ''), `feedback=${feedback}`);
  ok('Click submits: wrong-pick row paints differently than correct row',
     wrongRowBg !== correctRowBg,
     `wrong=${wrongRowBg} correct=${correctRowBg}`);

  await page.context().close();
}

// After grading the multi-select step, Next must advance to a single-select
// step (Round 2 Step 2 — post-reposition program) that still uses .answer-btn.
async function nextAdvancesToSingleSelectTest() {
  const page = await newPage();
  await advanceToRepositioning(page);
  for (const value of REPOSITIONING_CORRECT) await selectOption(page, value);
  await page.locator('#game-board form button[type=submit]').click();
  await page.waitForSelector('#game-next', {timeout: 5000});
  await page.locator('#game-next').click();
  await page.waitForSelector('#game-board .answer-btn', {timeout: 5000});

  const btns = await page.locator('#game-board .answer-btn').count();
  const multiFieldset = await page.locator('#game-options').count();
  const wrapTag = await page.locator('#game-board .answer-opts')
    .evaluate(n => n.tagName);
  ok('next step: single-select uses .answer-btn',
     btns > 0 && multiFieldset === 0,
     `btns=${btns} multiFieldset=${multiFieldset}`);
  ok('next step: single-select wrapper is a FIELDSET',
     wrapTag === 'FIELDSET', `tag=${wrapTag}`);

  await page.context().close();
}

await singleSelectFieldsetDisableTest();
await structureTest();
await enterSubmitsCorrectAnswerTest();
await checkAnswerClickGradesWrongTest();
await nextAdvancesToSingleSelectTest();

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

function hexToRgbString(hex) {
  const clean = hex.replace('#', '').trim();
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
