// Browser verification for Case Studies grading.
//
// Each case renders one visit at a time inside a .case-study container.
// The visit question is a <form> with a <fieldset class="answer-opts">
// of <button type="submit" class="answer-btn"> options; the correct
// option carries [data-correct] at render.
//
// On submit, JS sets data-picked on e.submitter and flips
// fieldset.dataset.answered = fieldset.disabled = true. CSS in
// quiz-form.css paints rows via [data-answered] selectors.
//
// On a correct visit answer with a treatmentQuestion, a treatment
// subquestion (<form> with checkboxes) is appended. Submitting that
// form grades via the same data-attribute pattern.
//
// Multi-case isolation: grading one case must not touch another.
//
// Requires a static server. Default: http://localhost:8000
// Override with E2E_BASE. Run: npm run test:e2e
import {chromium} from 'playwright';

const BASE = process.env.E2E_BASE || 'http://localhost:8000';
const ROUTE = '#diagnose/case-studies';

const reachable = await fetch(`${BASE}/index.html`).then(r => r.ok, () => false);
if (!reachable) {
  console.error(`Server not reachable at ${BASE}. ` +
    `Start one in the repo root, e.g.: python3 -m http.server 8000`);
  process.exit(2);
}

// Pulled from data/diagnose-case-studies.json. The first visit of each
// case has a treatmentQuestion. Update if data changes.
const CASE_A = 'bpec-case';
const CASE_B = 'left-aic-case';
const CASE_A_VISIT1_CORRECT = 'Bilateral PEC';
const CASE_A_VISIT1_WRONG = 'Left AIC';
const CASE_A_TREATMENT_CORRECT = [
  'Standing Wall Supported Reach',
  '90-90 Hip Lift in Passive FA IR with Balloon',
  'Modified All Four Belly Lift'
];
const CASE_A_TREATMENT_WRONG = 'Right Sidelying Respiratory Left Adductor Pull Back';

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass, detail});

const browser = await chromium.launch();

async function newPage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html${ROUTE}`);
  await page.waitForSelector('#case-study-wrap .case-study', {timeout: 5000});
  return page;
}

async function preconditionTest() {
  const page = await newPage();
  const count = await page.locator('.case-study').count();
  ok('precondition: at least 2 cases render', count >= 2, `count=${count}`);
  await page.context().close();
}

async function visitStructureTest() {
  const page = await newPage();
  const formTag = await page.locator(`#${CASE_A} > form`).evaluate(n => n.tagName);
  const fieldsetTag = await page.locator(`#${CASE_A} form fieldset`).evaluate(n => n.tagName);
  const btnCount = await page.locator(`#${CASE_A} .answer-btn`).count();
  const correctCount = await page.locator(`#${CASE_A} .answer-btn[data-correct]`).count();
  const correctText = await page.locator(`#${CASE_A} .answer-btn[data-correct]`)
    .textContent();
  const preDataAnswered = await page.locator(`#${CASE_A} > form .answer-opts`)
    .evaluate(n => n.hasAttribute('data-answered'));

  ok('visit: form wraps the answers', formTag === 'FORM', `tag=${formTag}`);
  ok('visit: fieldset inside form', fieldsetTag === 'FIELDSET', `tag=${fieldsetTag}`);
  ok('visit: 3 answer buttons', btnCount === 3, `count=${btnCount}`);
  ok('visit: exactly one [data-correct] at render',
     correctCount === 1, `count=${correctCount}`);
  ok('visit: [data-correct] marks the right option',
     correctText === CASE_A_VISIT1_CORRECT,
     `text=${correctText} expected=${CASE_A_VISIT1_CORRECT}`);
  ok('visit: fieldset has no [data-answered] pre-grade',
     preDataAnswered === false);
  await page.context().close();
}

async function clickCorrectVisitTest() {
  const page = await newPage();
  await page.locator(`#${CASE_A} .answer-btn[data-correct]`).click();
  await page.waitForSelector(`#${CASE_A} .treatment-subquestion`, {timeout: 2000});
  await page.waitForTimeout(150);

  const pickedHas = await page.locator(`#${CASE_A} .answer-btn[data-correct]`)
    .evaluate(n => n.hasAttribute('data-picked'));
  const fieldsetDisabled = await page.locator(`#${CASE_A} > form .answer-opts`)
    .evaluate(n => n.disabled);
  const fieldsetAnswered = await page.locator(`#${CASE_A} > form .answer-opts`)
    .evaluate(n => n.hasAttribute('data-answered'));
  const feedbackText = await page.locator(`#${CASE_A} .feedback-box`).first()
    .textContent();
  const treatmentRendered = await page.locator(`#${CASE_A} .treatment-subquestion`)
    .count();

  ok('click correct: submitter gets [data-picked]', pickedHas === true);
  ok('click correct: fieldset disabled', fieldsetDisabled === true);
  ok('click correct: fieldset gets [data-answered]', fieldsetAnswered === true);
  ok('click correct: feedback says Correct',
     /Correct\./.test(feedbackText ?? ''), `text=${feedbackText}`);
  ok('click correct: treatment subquestion renders',
     treatmentRendered === 1, `count=${treatmentRendered}`);
  await page.context().close();
}

async function clickWrongVisitTest() {
  const page = await newPage();
  await page.locator(`#${CASE_A} .answer-btn`,
    {hasText: CASE_A_VISIT1_WRONG}).click();
  await page.waitForSelector(`#${CASE_A} .case-next`, {timeout: 2000});
  await page.waitForTimeout(150);

  const feedbackText = await page.locator(`#${CASE_A} .feedback-box`).first()
    .textContent();
  const treatmentRendered = await page.locator(`#${CASE_A} .treatment-subquestion`)
    .count();
  const nextRendered = await page.locator(`#${CASE_A} .case-next`).count();

  ok('click wrong: feedback says Incorrect',
     /Incorrect\./.test(feedbackText ?? ''), `text=${feedbackText}`);
  ok('click wrong: treatment does NOT render', treatmentRendered === 0);
  ok('click wrong: case-next button renders', nextRendered === 1);
  await page.context().close();
}

async function enterSubmitsVisitTest() {
  const page = await newPage();
  await page.locator(`#${CASE_A} .answer-btn[data-correct]`).focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector(`#${CASE_A} .treatment-subquestion`, {timeout: 2000});

  const answered = await page.locator(`#${CASE_A} > form .answer-opts`)
    .evaluate(n => n.hasAttribute('data-answered'));
  ok('enter on visit btn: form submits and grades', answered === true);
  await page.context().close();
}

async function advanceToTreatment(page) {
  await page.locator(`#${CASE_A} .answer-btn[data-correct]`).click();
  await page.waitForSelector(`#${CASE_A} .treatment-subquestion`, {timeout: 2000});
}

async function treatmentStructureTest() {
  const page = await newPage();
  await advanceToTreatment(page);

  const formCount = await page.locator(`#${CASE_A} .treatment-subquestion > form`)
    .count();
  const fieldsetTag = await page.locator(`#${CASE_A} .treatment-subquestion fieldset`)
    .evaluate(n => n.tagName);
  const cbCount = await page.locator(
    `#${CASE_A} .treatment-subquestion input[type=checkbox]`).count();
  const labelCount = await page.locator(
    `#${CASE_A} .treatment-subquestion label.option-row`).count();
  const correctCount = await page.locator(
    `#${CASE_A} .treatment-subquestion input[data-correct]`).count();
  const submitCount = await page.locator(
    `#${CASE_A} .treatment-subquestion button[type=submit]`).count();

  ok('treatment: form wraps the fieldset', formCount === 1);
  ok('treatment: fieldset element', fieldsetTag === 'FIELDSET',
     `tag=${fieldsetTag}`);
  ok('treatment: 6 checkboxes inside 6 .option-row labels',
     cbCount === 6 && labelCount === 6,
     `cbs=${cbCount} labels=${labelCount}`);
  ok('treatment: 3 inputs carry [data-correct] at render',
     correctCount === 3, `count=${correctCount}`);
  ok('treatment: exactly one submit button', submitCount === 1);

  for (const value of CASE_A_TREATMENT_CORRECT) {
    const has = await page.locator(
      `#${CASE_A} .treatment-subquestion input[value="${value}"]`)
      .evaluate(n => n.hasAttribute('data-correct'));
    ok(`treatment: [data-correct] on "${value}"`, has === true);
  }
  await page.context().close();
}

async function checkTreatment(page, values) {
  for (const value of values) {
    await page.locator(
      `#${CASE_A} .treatment-subquestion input[value="${value}"]`)
      .locator('xpath=ancestor::label').click();
  }
}

async function treatmentCorrectTest() {
  const page = await newPage();
  await advanceToTreatment(page);
  await checkTreatment(page, CASE_A_TREATMENT_CORRECT);
  await page.locator(`#${CASE_A} .treatment-subquestion button[type=submit]`).click();
  await page.waitForSelector(`#${CASE_A} .treatment-subquestion .case-next`,
    {timeout: 2000});
  await page.waitForTimeout(150);

  const answered = await page.locator(`#${CASE_A} .treatment-subquestion fieldset`)
    .evaluate(n => n.hasAttribute('data-answered'));
  const disabled = await page.locator(`#${CASE_A} .treatment-subquestion fieldset`)
    .evaluate(n => n.disabled);
  const submitHidden = await page.locator(
    `#${CASE_A} .treatment-subquestion button[type=submit]`)
    .evaluate(n => n.hidden);
  const wrongPicks = await page.locator(
    `#${CASE_A} .treatment-subquestion input:checked:not([data-correct])`).count();
  const feedback = await page.locator(`#${CASE_A} .treatment-subquestion .feedback-box`)
    .textContent();

  ok('treatment correct: fieldset gets [data-answered]', answered === true);
  ok('treatment correct: fieldset disabled', disabled === true);
  ok('treatment correct: submit button hidden', submitHidden === true);
  ok('treatment correct: no wrong picks', wrongPicks === 0,
     `count=${wrongPicks}`);
  ok('treatment correct: feedback says Correct',
     /Correct\./.test(feedback ?? ''), `text=${feedback}`);
  await page.context().close();
}

async function treatmentWrongTest() {
  const page = await newPage();
  await advanceToTreatment(page);
  // 2 correct + 1 wrong = partial answer
  await checkTreatment(page, [
    CASE_A_TREATMENT_CORRECT[0],
    CASE_A_TREATMENT_CORRECT[1],
    CASE_A_TREATMENT_WRONG
  ]);
  await page.locator(`#${CASE_A} .treatment-subquestion button[type=submit]`).click();
  await page.waitForSelector(`#${CASE_A} .treatment-subquestion .case-next`,
    {timeout: 2000});

  const wrongPickCount = await page.locator(
    `#${CASE_A} .treatment-subquestion input:checked:not([data-correct])`).count();
  const feedback = await page.locator(`#${CASE_A} .treatment-subquestion .feedback-box`)
    .textContent();

  ok('treatment wrong: exactly 1 checked-not-correct input',
     wrongPickCount === 1, `count=${wrongPickCount}`);
  ok('treatment wrong: feedback says Incorrect',
     /Incorrect\./.test(feedback ?? ''), `text=${feedback}`);
  await page.context().close();
}

async function multiCaseIsolationTest() {
  const page = await newPage();
  await page.locator(`#${CASE_A} .answer-btn[data-correct]`).click();
  await page.waitForSelector(`#${CASE_A} .treatment-subquestion`, {timeout: 2000});

  const otherAnswered = await page.locator(`#${CASE_B} > form .answer-opts`)
    .evaluate(n => n.hasAttribute('data-answered'));
  const otherDisabled = await page.locator(`#${CASE_B} > form .answer-opts`)
    .evaluate(n => n.disabled);
  const otherFeedback = await page.locator(`#${CASE_B} .feedback-box`).count();
  const otherTreatment = await page.locator(`#${CASE_B} .treatment-subquestion`)
    .count();

  ok('isolation: other case has no [data-answered]', otherAnswered === false);
  ok('isolation: other case fieldset still enabled', otherDisabled === false);
  ok('isolation: other case has no feedback', otherFeedback === 0);
  ok('isolation: other case has no treatment rendered', otherTreatment === 0);
  await page.context().close();
}

await preconditionTest();
await visitStructureTest();
await clickCorrectVisitTest();
await clickWrongVisitTest();
await enterSubmitsVisitTest();
await treatmentStructureTest();
await treatmentCorrectTest();
await treatmentWrongTest();
await multiCaseIsolationTest();

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
