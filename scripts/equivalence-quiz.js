import { getAllEquivalent, REGION_LABELS } from './equivalence.js';
import { shuffle } from './shuffle.js';
import { loadJson } from './load-json.js';

// The data layer is a single closure that exposes only getCorrectAnswer.
// Cache (bundlePromise) and all per-question lookups stay inside. UI code
// outside the closure receives one correctAnswer per call — the closure
// never returns the whole bundle. The closure fires the network fetch on
// first call and caches the resolved bundle; on fetch failure the cache
// clears so the next call retries.

const REGIONS = Object.keys(REGION_LABELS).filter((r) => r !== 'FA');
const SIDES = ['L', 'R'];
const DIRS = ['ER', 'IR'];

const ALL_COMBOS = SIDES.flatMap((side) =>
  REGIONS.flatMap((region) =>
    DIRS.map((dir) => ({ side, region, dir }))));

const getCorrectAnswer = (() => {
  let bundlePromise = null;

  async function fetchBundle() {
    const result = await loadJson('./data/equivalence-explanations.json');
    return result;
  }

  function entryFor(bundle, question) {
    const entry = bundle?.regions?.[question.region]?.[question.dir];
    if (!Array.isArray(entry?.equivalents)) return null;
    return entry;
  }

  function findLink(bundle, fromId, toId) {
    if (!Array.isArray(bundle?.links)) return null;
    return bundle.links.find((lk) =>
      (lk.from === fromId && lk.to === toId)
      || (lk.from === toId && lk.to === fromId)
    ) || null;
  }

  function buildAnswerLinks(bundle, question, correctAnswers) {
    return [...correctAnswers].map((answer) => {
      const parts = answer.split(' ');
      const ansRegion = parts[1];
      const ansDir = parts[2];
      const title = 'Why ' + question.region + ' ' + question.dir
        + ' = ' + ansRegion + ' ' + ansDir;
      const link = findLink(bundle, question.region, ansRegion);
      if (!link) return { title, missing: true };
      return {
        title,
        priReasoning: link.priReasoning,
        biomechanics: link.biomechanics,
        couplingType: link.couplingType
      };
    });
  }

  function buildCorrectAnswer(bundle, question) {
    const entry = entryFor(bundle, question);
    if (!entry) return { ok: false, reason: 'missing-entry' };

    const fullCorrect = new Set(
      entry.equivalents.map((token) => question.side + ' ' + token)
    );
    const correctAnswers = new Set(
      question.options.filter((opt) => fullCorrect.has(opt))
    );

    const regionMeta = bundle.regions[question.region];
    return {
      ok: true,
      side: question.side,
      region: question.region,
      dir: question.dir,
      correctAnswers,
      totalEquivalents: entry.equivalents.length,
      regionInfo: {
        name: regionMeta.name,
        anatomicalName: regionMeta.anatomicalName,
        manualRef: regionMeta.manualRef
      },
      dirInfo: {
        pri: entry.pri,
        biomechanics: entry.biomechanics
      },
      answerLinks: buildAnswerLinks(bundle, question, correctAnswers),
      couplingDisclaimer: bundle.couplingDisclaimer
    };
  }

  return async function (question) {
    if (!bundlePromise) bundlePromise = fetchBundle();
    const result = await bundlePromise;
    if (!result.ok) {
      bundlePromise = null;
      return { ok: false, reason: 'fetch-failed' };
    }
    return buildCorrectAnswer(result.data, question);
  };
})();

let questions = [];
let qIdx = 0;
let isAnswered = false;
let gradeResult = null;
let selected = new Set();
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
  gradeResult = null;
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
  gradeResult = null;

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

  const correctAnswer = await getCorrectAnswer(questions[submitQIdx]);
  if (!isAnswered || qIdx !== submitQIdx) return;

  applyGradingState(questions[submitQIdx], correctAnswer);
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

function applyGradingState(q, correctAnswer) {
  if (!correctAnswer.ok) {
    gradeResult = null;
    const slotHTML = correctAnswer.reason === 'fetch-failed'
      ? buildFetchFailureHTML({ withRetry: true })
      : MISSING_ENTRY_HTML;
    renderUngradedFeedback(slotHTML);
    return;
  }

  gradeResult = gradeSelectionAgainst(correctAnswer.correctAnswers, [...selected]);
  paintOptionCorrectness(correctAnswer.correctAnswers);
  renderGradedFeedback(q, correctAnswer);
}

function paintOptionCorrectness(correctAnswers) {
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

function renderGradedFeedback(q, correctAnswer) {
  const chainHTML = buildEquivChainHTML(q, correctAnswer);
  const explanationHTML = buildExplanationHTML(correctAnswer);
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box' + (gradeResult ? '' : ' error');
  feedback.innerHTML = `<strong>${gradeResult ? 'Correct.' : 'Incorrect.'}</strong>
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

const MISSING_ENTRY_HTML = `<div class="equiv-expl-failure callout error">
    Answer data missing for this question.
  </div>`;

async function retryExplanations() {
  if (!isAnswered) return;
  const slot = document.querySelector('.equiv-expl-slot');
  const retryBtn = slot?.querySelector('.equiv-expl-retry');
  if (!retryBtn || retryBtn.disabled) return;

  const retryQIdx = qIdx;
  retryBtn.disabled = true;
  retryBtn.textContent = 'Retrying…';

  const correctAnswer = await getCorrectAnswer(questions[retryQIdx]);
  if (!isAnswered || qIdx !== retryQIdx) return;

  applyGradingState(questions[retryQIdx], correctAnswer);
}

function buildExplanationHTML(correctAnswer) {
  const { side, dir, regionInfo, dirInfo, answerLinks, couplingDisclaimer } = correctAnswer;
  const label = side + ' ' + regionInfo.name + ' ' + dir
    + ' — ' + regionInfo.anatomicalName;

  const linkBlocks = answerLinks.map((link) => {
    if (link.missing) {
      return `<div class="equiv-expl-link">
        <div class="equiv-expl-label">${link.title}</div>
        ${MISSING_ENTRY_HTML}
      </div>`;
    }
    return `<div class="equiv-expl-link">
        <div class="equiv-expl-label">${link.title}</div>
        <p>${link.priReasoning}</p>
        <div class="equiv-expl-note">Note — ${link.biomechanics}</div>
        <div class="equiv-expl-coupling">${link.couplingType}</div>
      </div>`;
  }).join('');

  return `<div class="equiv-explanation">
    <div class="equiv-expl-region">
      <div class="equiv-expl-label">${label}</div>
      <p>${dirInfo.pri}</p>
      <div class="equiv-expl-note">Note — ${dirInfo.biomechanics}</div>
      <div class="equiv-expl-ref">${regionInfo.manualRef}</div>
    </div>
    ${linkBlocks}
    <div class="equiv-expl-note">Note — ${couplingDisclaimer}</div>
  </div>`;
}

function buildEquivChainHTML(q, correctAnswer) {
  const shown = [q.given, ...correctAnswer.correctAnswers];
  const lines = shown.map((pos, i) =>
    '<div class="equiv-line'
      + (i === 0 ? ' main' : '') + '">'
      + (i ? '= ' : '') + pos + '</div>'
  );
  return '<div class="equiv-chain">'
    + '<div class="equiv-chain-label">'
      + 'TESTED EQUIVALENTS:</div>'
    + lines.join('')
    + '<div class="equiv-chain-note">'
      + 'Full equivalence chain has '
      + correctAnswer.totalEquivalents
      + ' positions — see Equivalence'
      + ' Chains for complete walkthrough.'
      + '</div>'
    + '</div>';
}

async function regradeIfNeeded(answer) {
  if (answer.correct !== null) return;

  const ca = await getCorrectAnswer(answer.question);
  if (ca.ok) {
    answer.correct = gradeSelectionAgainst(ca.correctAnswers, answer.selected);
  }
}

async function renderResults() {
  showResultsScreen();
  await Promise.all(sessionAnswers.map(regradeIfNeeded));

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

  await renderResultsList(
    document.getElementById('equiv-incorrect-list'), missedAnswers
  );
  await renderResultsList(
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

function buildResultSummary(answer, correctAnswer) {
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'mq-result-summary';
  let text = answer.question.given;
  if (!answer.correct) {
    const sel = answer.selected.length
      ? answer.selected.join(', ') : 'none';
    const corr = correctAnswer?.ok
      ? [...correctAnswer.correctAnswers].join(', ')
      : '(unavailable)';
    text += ' — You: ' + sel + ', Correct: ' + corr;
  }
  summary.textContent = text;
  return summary;
}

function buildResultDetail(answer, correctAnswer) {
  const q = answer.question;
  const detail = document.createElement('div');
  detail.className = 'mq-result-detail hidden';
  const knownCorrect = correctAnswer?.ok
    ? correctAnswer.correctAnswers : new Set();
  const optHTML = q.options.map((opt) =>
    '<div class="mq-result-opt'
      + classifyOption(opt, knownCorrect, answer.selected)
      + '">' + opt + '</div>'
  ).join('');
  detail.innerHTML =
    '<div class="equiv-given">' + q.given + '</div>'
    + '<div class="mq-result-comparison">' + optHTML + '</div>'
    + (correctAnswer?.ok ? buildEquivChainHTML(q, correctAnswer) : '')
    + '<div class="equiv-expl-slot">'
    + renderResultExplanationHTML(correctAnswer)
    + '</div>';
  return detail;
}

function renderResultExplanationHTML(correctAnswer) {
  if (!correctAnswer) return renderSlotLoading();
  if (!correctAnswer.ok) {
    return correctAnswer.reason === 'fetch-failed'
      ? buildFetchFailureHTML({ withRetry: false })
      : MISSING_ENTRY_HTML;
  }
  return buildExplanationHTML(correctAnswer);
}

async function renderResultsList(container, answers) {
  container.innerHTML = '';
  const correctAnswers = await Promise.all(
    answers.map((a) => getCorrectAnswer(a.question))
  );
  const rowTemplate = document.createElement('div');
  rowTemplate.className = 'mq-result-row';
  answers.forEach((a, i) => {
    const ca = correctAnswers[i];
    const row = rowTemplate.cloneNode(false);
    const summary = buildResultSummary(a, ca);
    const detail = buildResultDetail(a, ca);
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
  gradeResult = null;
  showQuizScreen();
  renderQuestion();
}

function recordCurrentAnswer() {
  sessionAnswers.push({
    question: questions[qIdx],
    selected: [...selected],
    correct: gradeResult
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
