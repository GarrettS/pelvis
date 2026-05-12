import { getAllEquivalent, REGION_LABELS } from './equivalence.js';
import { shuffle } from './shuffle.js';
import { loadJson } from './load-json.js';

// Answers load lazily on first Submit (see ensureExplanationsLoading),
// not at module top. Eager-load would cost the same on the network —
// the JSON ships with the app. The lazy trigger preserves the
// architectural separation: questions render and accept input before
// the client knows the answer key.

const REGIONS = Object.keys(REGION_LABELS).filter((r) => r !== 'FA');
const SIDES = ['L', 'R'];
const DIRS = ['ER', 'IR'];

const ALL_COMBOS = SIDES.flatMap((side) =>
  REGIONS.flatMap((region) =>
    DIRS.map((dir) => ({ side, region, dir }))));

let questions = [];
let qIdx = 0;
let isAnswered = false;
let isCorrect = false;
let selected = new Set();
let explanations = null;
let explanationsResult = null;
let explanationsPromise = null;
let sessionAnswers = [];

const containerEl = document.getElementById('equivalence-content');

function buildDistractors(side, region, dir) {
  const otherSide = side === 'L' ? 'R' : 'L';
  const wrongDir = dir === 'ER' ? 'IR' : 'ER';
  const outletRegion = ['IP', 'IS']
    .includes(region) ? 'IsP' : 'IP';
  const wrongEquivDir = ['IP', 'IS', 'AF']
    .includes(outletRegion) ? dir : wrongDir;
  return [
    otherSide + ' ' + region + ' ' + dir,
    side + ' ' + region + ' ' + wrongDir,
    side + ' ' + outletRegion + ' ' + wrongEquivDir,
    otherSide + ' '
      + (REGIONS.find((r) => r !== region) || 'SI')
      + ' ' + dir
  ];
}

function buildQuestion(side, region, dir) {
  const equiv = getAllEquivalent(region, dir);
  const allEquiv = Object.entries(equiv)
    .filter(([rid]) => rid !== region)
    .map(([rid, d]) => side + ' ' + rid + ' ' + d);
  const correctPick = shuffle(allEquiv).slice(0, 2);
  const distractors = buildDistractors(side, region, dir);
  const distPick = distractors
    .filter((d) => !correctPick.includes(d))
    .slice(0, 2);
  return {
    given: side + ' ' + region + ' ' + dir,
    side: side,
    region: region,
    dir: dir,
    options: shuffle(correctPick.concat(distPick))
  };
}

function generateQuestions() {
  return shuffle(ALL_COMBOS.map(
    ({ side, region, dir }) => buildQuestion(side, region, dir)
  ));
}

function getSessionSize() {
  const el = document.getElementById('equiv-count');
  return el.valueAsNumber || +el.defaultValue;
}

function resetSession() {
  questions = generateQuestions();
  qIdx = 0;
  sessionAnswers = [];
  isAnswered = false;
  showQuizScreen();
  renderQuestion();
}

function showQuizScreen() {
  containerEl.classList.remove('showing-results');
  containerEl.classList.add('in-session');
}

function showResultsScreen() {
  containerEl.classList.add('showing-results');
}

function updateResultsIfShown() {
  if (!containerEl.classList.contains('showing-results')) return;

  renderResults();
}

async function loadExplanations() {
  const result = await loadJson('./data/equivalence-explanations.json');
  explanationsResult = result;
  explanations = result.ok ? result.data : null;
  updateResultsIfShown();
  return result;
}

function ensureExplanationsLoading() {
  if (explanationsPromise) return;

  explanationsPromise = loadExplanations();
}

function correctAnswersFor(question) {
  const dirData = dirDataFor(question);
  if (!dirData) return null;

  const fullCorrect = new Set(
    dirData.equivalents.map((token) => question.side + ' ' + token)
  );
  return new Set(question.options.filter((opt) => fullCorrect.has(opt)));
}

function totalEquivalentsFor(question) {
  return dirDataFor(question)?.equivalents.length ?? null;
}

function dirDataFor(question) {
  if (!explanations?.regions) return null;
  const dirData = explanations.regions[question.region]?.[question.dir];
  if (!Array.isArray(dirData?.equivalents)) return null;

  return dirData;
}

function gradeSelectionAgainst(correctAnswers, selectedList) {
  const sel = new Set(selectedList);
  return sel.size === correctAnswers.size
    && [...sel].every((s) => correctAnswers.has(s));
}

function handleOptionToggle(opt) {
  if (opt.disabled) return;

  const val = opt.dataset.opt;
  if (selected.has(val)) {
    selected.delete(val);
    opt.classList.remove('selected');
    opt.setAttribute('aria-pressed', 'false');
  } else {
    selected.add(val);
    opt.classList.add('selected');
    opt.setAttribute('aria-pressed', 'true');
  }
}

function renderQuestion() {
  const q = questions[qIdx];
  selected = new Set();
  isAnswered = false;

  const size = getSessionSize();
  document.getElementById('equiv-progress-fill').style.width =
    ((qIdx / size) * 100) + '%';
  document.getElementById('equiv-progress-text').textContent =
    'Question ' + (qIdx + 1) + ' of ' + size;
  document.getElementById('equiv-current-given').textContent = q.given;
  document.getElementById('equiv-options').innerHTML = q.options.map((opt) =>
    `<button type="button" class="equiv-opt"
      data-opt="${opt}"
      aria-pressed="false">${opt}</button>`
  ).join('');
  document.getElementById('equiv-feedback').hidden = true;
}

async function handleSubmit() {
  if (isAnswered) return;

  isAnswered = true;
  const submitQIdx = qIdx;

  lockOptionsForGrading();
  renderPendingFeedback();
  ensureExplanationsLoading();

  await explanationsPromise;
  if (!isAnswered || qIdx !== submitQIdx) return;

  applyGradingState(questions[submitQIdx]);
}

function lockOptionsForGrading() {
  const optEls = document.getElementById('equiv-quiz-wrap')
    .querySelectorAll('.equiv-opt');
  for (const optEl of optEls) {
    optEl.classList.remove('selected');
    optEl.disabled = true;
  }
}

function renderPendingFeedback() {
  const feedback = document.getElementById('equiv-feedback');
  feedback.hidden = false;
  feedback.className = 'feedback-box';
  feedback.innerHTML = renderSlotLoading();
}

function applyGradingState(q) {
  if (explanationsResult && !explanationsResult.ok) {
    renderUngradedFeedback(buildFetchFailureHTML({ withRetry: true }));
    return;
  }

  const correctAnswers = correctAnswersFor(q);
  if (!correctAnswers) {
    renderUngradedFeedback(buildMissingEntryHTML());
    return;
  }

  isCorrect = gradeSelectionAgainst(correctAnswers, [...selected]);
  paintOptionCorrectness(q, correctAnswers);
  renderGradedFeedback(q, correctAnswers);
}

function paintOptionCorrectness(q, correctAnswers) {
  const optEls = document.getElementById('equiv-quiz-wrap')
    .querySelectorAll('.equiv-opt');
  for (const optEl of optEls) {
    const val = optEl.dataset.opt;
    const isCorr = correctAnswers.has(val);
    const isSel = selected.has(val);
    if (isCorr && isSel) {
      optEl.classList.add('correct-reveal');
    } else if (isCorr && !isSel) {
      optEl.classList.add('missed');
    } else if (!isCorr && isSel) {
      optEl.classList.add('wrong-reveal');
    }
  }
}

function nextButtonLabel() {
  return qIdx + 1 < getSessionSize()
    ? 'Next Question →' : 'Finish Session';
}

function renderGradedFeedback(q, correctAnswers) {
  const chainHTML = buildEquivChainHTML(q, correctAnswers);
  const explanationHTML = buildExplanationHTML(q, correctAnswers);
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box' + (isCorrect ? '' : ' error');
  feedback.innerHTML = `<strong>${isCorrect ? 'Correct.' : 'Incorrect.'}</strong>
    ${chainHTML}
    <div class="equiv-expl-slot">${explanationHTML}</div>
    <button class="btn primary feedback-next">
      ${nextButtonLabel()}</button>`;
}

function renderUngradedFeedback(slotHTML) {
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box error';
  feedback.innerHTML = `
    <div class="equiv-expl-slot">${slotHTML}</div>
    <button class="btn primary feedback-next">
      ${nextButtonLabel()}</button>`;
}

function renderSlotLoading() {
  return '<div class="equiv-expl-loading">Loading answers…</div>';
}

function buildFetchFailureHTML({ withRetry }) {
  const offlineMsg = navigator.onLine
    ? "Couldn't load answers."
    : 'You appear to be offline. Reconnect and click Retry.';
  const retryButton = withRetry
    ? '<button type="button" class="btn equiv-expl-retry">Retry</button>'
    : '';
  return `<div class="equiv-expl-failure callout error">
    ${offlineMsg}
    ${retryButton}
  </div>`;
}

function buildMissingEntryHTML() {
  return `<div class="equiv-expl-failure callout error">
    Answer data missing for this question.
  </div>`;
}

async function retryExplanations() {
  if (!isAnswered) return;
  const slot = document.querySelector('.equiv-expl-slot');
  const retryBtn = slot?.querySelector('.equiv-expl-retry');
  if (!retryBtn || retryBtn.disabled) return;

  const retryQIdx = qIdx;
  retryBtn.disabled = true;
  retryBtn.textContent = 'Retrying…';

  explanationsPromise = loadExplanations();
  await explanationsPromise;
  if (!isAnswered || qIdx !== retryQIdx) return;

  applyGradingState(questions[retryQIdx]);
}

const keyPattern = /(?<side>[LR]) (?<region>IP|IS|IsP|SI|AF) (?<dir>ER|IR)/;
const parsePosition = pos => keyPattern.exec(pos).groups;

function findLink(fromId, toId) {
  if (!Array.isArray(explanations?.links)) return null;
  return explanations.links.find(
    (lk) => (lk.from === fromId && lk.to === toId)
      || (lk.from === toId && lk.to === fromId)
  ) || null;
}

function buildExplanationHTML(q, correctAnswers) {
  if (!explanations?.regions) return buildMissingEntryHTML();

  const given = parsePosition(q.given);
  const region = explanations.regions[given.region];
  if (!region) return buildMissingEntryHTML();

  const dirInfo = region[given.dir];
  if (!dirInfo) return buildMissingEntryHTML();

  const label = given.side + ' ' + region.name + ' ' + given.dir
    + ' — ' + region.anatomicalName;

  const linkBlocks = [];
  for (const answer of correctAnswers) {
    const ans = parsePosition(answer);
    const link = findLink(given.region, ans.region);

    if (!link) {
      linkBlocks.push(`<div class="equiv-expl-link">
        <div class="equiv-expl-label">Why ${given.region} ${given.dir} = ${ans.region} ${ans.dir}</div>
        ${buildMissingEntryHTML()}
      </div>`);
      continue;
    }

    linkBlocks.push(`<div class="equiv-expl-link">
        <div class="equiv-expl-label">Why ${given.region} ${given.dir} = ${ans.region} ${ans.dir}</div>
        <p>${link.priReasoning}</p>
        <div class="equiv-expl-note">Note — ${link.biomechanics}</div>
        <div class="equiv-expl-coupling">${link.couplingType}</div>
      </div>`);
  }

  return `<div class="equiv-explanation">
    <div class="equiv-expl-region">
      <div class="equiv-expl-label">${label}</div>
      <p>${dirInfo.pri}</p>
      <div class="equiv-expl-note">Note — ${dirInfo.biomechanics}</div>
      <div class="equiv-expl-ref">${region.manualRef}</div>
    </div>
    ${linkBlocks.join('')}
    <div class="equiv-expl-note">Note — ${explanations.couplingDisclaimer}</div>
  </div>`;
}

function buildEquivChainHTML(q, correctAnswers) {
  const shown = [q.given, ...correctAnswers];
  const lines = shown.map((pos, i) =>
    '<div class="equiv-line'
      + (i === 0 ? ' main' : '') + '">'
      + (i ? '= ' : '') + pos + '</div>'
  );
  const totalEquiv = totalEquivalentsFor(q);
  const noteText = totalEquiv === null
    ? ''
    : '<div class="equiv-chain-note">'
      + 'Full equivalence chain has '
      + totalEquiv
      + ' positions — see Equivalence'
      + ' Chains for complete walkthrough.'
      + '</div>';
  return '<div class="equiv-chain">'
    + '<div class="equiv-chain-label">'
      + 'TESTED EQUIVALENTS:</div>'
    + lines.join('')
    + noteText
    + '</div>';
}

function regradeFromExplanations(answer) {
  const correctAnswers = correctAnswersFor(answer.question);
  if (!correctAnswers) return null;

  return gradeSelectionAgainst(correctAnswers, answer.selected);
}

function renderResults() {
  showResultsScreen();
  sessionAnswers.forEach((a) => {
    if (a.correct === null) a.correct = regradeFromExplanations(a);
  });
  const gradedAnswers = sessionAnswers.filter((a) => a.correct !== null);
  const total = gradedAnswers.length;
  const correctCount = gradedAnswers.filter((a) => a.correct).length;
  const pct = total > 0
    ? Math.round((correctCount / total) * 100)
    : 0;

  let scoreClass = 'mq-score-green';
  if (pct < 60) scoreClass = 'mq-score-red';
  else if (pct < 80) scoreClass = 'mq-score-yellow';

  const resultScore = document.getElementById('equiv-result-score');
  resultScore.className = 'mq-results-score ' + scoreClass;
  resultScore.textContent = 'Session Complete: '
    + correctCount + ' / ' + total
    + ' correct (' + pct + '%)';

  const missedAnswers = gradedAnswers.filter((a) => !a.correct);
  const correctAnswers = gradedAnswers.filter((a) => a.correct);

  renderResultsList(
    document.getElementById('equiv-incorrect-list'), missedAnswers
  );
  renderResultsList(
    document.getElementById('equiv-correct-list'), correctAnswers
  );

  const resultsEl = document.getElementById('equiv-results');
  resultsEl.classList.toggle('has-incorrect', missedAnswers.length > 0);
  resultsEl.classList.toggle('has-correct', correctAnswers.length > 0);

  document.getElementById('equiv-incorrect-details').open = true;
  document.getElementById('equiv-correct-details').open = false;
}

function classifyOption(opt, correctAnswers, selectedList) {
  const isCorr = correctAnswers.has(opt);
  const isSel = selectedList.includes(opt);
  if (isCorr && isSel) return ' correct';
  if (isCorr) return ' missed';
  if (isSel) return ' incorrect';
  return '';
}

function buildResultSummary(answer, correctAnswers) {
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'mq-result-summary';
  let text = answer.question.given;
  if (!answer.correct) {
    const sel = answer.selected.length
      ? answer.selected.join(', ') : 'none';
    const corr = correctAnswers
      ? [...correctAnswers].join(', ')
      : '(unavailable)';
    text += ' — You: ' + sel + ', Correct: ' + corr;
  }
  summary.textContent = text;
  return summary;
}

function buildResultDetail(answer, correctAnswers) {
  const q = answer.question;
  const detail = document.createElement('div');
  detail.className = 'mq-result-detail hidden';
  const knownCorrect = correctAnswers || new Set();
  const optHTML = q.options.map((opt) =>
    '<div class="mq-result-opt'
      + classifyOption(opt, knownCorrect, answer.selected)
      + '">' + opt + '</div>'
  ).join('');
  detail.innerHTML =
    '<div class="equiv-given">' + q.given + '</div>'
    + '<div class="mq-result-comparison">' + optHTML + '</div>'
    + buildEquivChainHTML(q, knownCorrect)
    + '<div class="equiv-expl-slot">'
    + renderResultExplanationHTML(q, knownCorrect)
    + '</div>';
  return detail;
}

function renderResultExplanationHTML(q, correctAnswers) {
  if (!explanationsResult) return renderSlotLoading();
  if (!explanationsResult.ok) {
    return buildFetchFailureHTML({ withRetry: false });
  }
  return buildExplanationHTML(q, correctAnswers);
}

function renderResultsList(container, answers) {
  container.innerHTML = '';
  const rowTemplate = document.createElement('div');
  rowTemplate.className = 'mq-result-row';
  answers.forEach((a) => {
    const correctAnswers = correctAnswersFor(a.question);
    const row = rowTemplate.cloneNode(false);
    const summary = buildResultSummary(a, correctAnswers);
    const detail = buildResultDetail(a, correctAnswers);
    summary.addEventListener('click', () => {
      detail.classList.toggle('hidden');
    });
    row.appendChild(summary);
    row.appendChild(detail);
    container.appendChild(row);
  });
}

function retakeMissed() {
  const missed = sessionAnswers
    .filter((a) => a.correct === false)
    .map((a) => a.question);
  questions = shuffle(missed);
  qIdx = 0;
  sessionAnswers = [];
  isAnswered = false;
  showQuizScreen();
  renderQuestion();
}

function recordCurrentAnswer() {
  const q = questions[qIdx];
  const correctAnswers = correctAnswersFor(q);
  const gradedNow = explanationsResult?.ok && correctAnswers
    ? isCorrect
    : null;
  sessionAnswers.push({
    question: q,
    selected: [...selected],
    correct: gradedNow
  });
}

const CLICK_DISPATCH = {
  'equiv-submit': handleSubmit,
  'equiv-restart': resetSession,
  'equiv-new-session': resetSession,
  'equiv-end-session': renderResults,
  'equiv-retake-missed': retakeMissed
};

document.getElementById('equiv-count')
  .addEventListener('change', renderQuestion);

containerEl.addEventListener('click', (e) => {
  const opt = e.target.closest('.equiv-opt');
  if (opt) {
    handleOptionToggle(opt);
    return;
  }
  if (e.target.closest('.equiv-expl-retry')) {
    retryExplanations();
    return;
  }
  if (e.target.closest('.feedback-next')) {
    recordCurrentAnswer();
    qIdx++;
    if (qIdx >= getSessionSize()) {
      renderResults();
    } else {
      renderQuestion();
    }
    return;
  }
  const target = e.target.closest('[id]');
  CLICK_DISPATCH[target?.id]?.();
});

resetSession();
