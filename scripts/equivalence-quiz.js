// Equivalence quiz UI/consumer. Data layer is scripts/equivalence-answers.js
// (exports getCorrectAnswer). State machine and per-state UX:
// prd/architecture/equivalence-quiz.md

import { getAllEquivalent, REGION_LABELS } from './equivalence.js';
import { toShuffled } from './shuffle.js';
import { newEl } from './el-create.js';
import { getCorrectAnswer } from './equivalence-answers.js';

const REGIONS = Object.keys(REGION_LABELS).filter((r) => r !== 'FA');
const SIDES = ['L', 'R'];
const DIRS = ['ER', 'IR'];

const ALL_COMBOS = SIDES.flatMap((side) =>
  REGIONS.flatMap(region => DIRS.map(dir => ({ side, region, dir }))));

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

function buildQuestion(combo) {
  const {side, region, dir} = combo;
  const equiv = getAllEquivalent(region, dir);
  const allEquiv = [];
  for (const [rid, d] of Object.entries(equiv))
    if (rid !== region) allEquiv.push(`${side} ${rid} ${d}`);
  const correctPick = toShuffled(allEquiv).slice(0, 2);
  const distractors = buildDistractors(side, region, dir);
  const distPick = distractors
    .filter((d) => !correctPick.includes(d))
    .slice(0, 2);
  return {
    ...combo,
    given: side + ' ' + region + ' ' + dir,
    options: toShuffled([...correctPick, ...distPick])
  };
}

const generateQuestions = () => toShuffled(ALL_COMBOS.map(buildQuestion));

const getSessionSize = () => document.getElementById('equiv-count').valueAsNumber;

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

function buildOptionButton(opt) {
  return newEl('button', {
    type: 'button',
    className: 'equiv-opt',
    textContent: opt,
    attrs: { 'data-opt': opt, 'aria-pressed': 'false' }
  });
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
  const optsEl = document.getElementById('equiv-options');
  optsEl.disabled = false;
  optsEl.replaceChildren(...q.options.map(buildOptionButton));
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
  document.getElementById('equiv-options').disabled = true;
}

function renderPendingFeedback() {
  const feedback = document.getElementById('equiv-feedback');
  feedback.hidden = false;
  feedback.className = 'feedback-box';
  feedback.replaceChildren(newEl('div', {
    className: 'equiv-expl-loading',
    textContent: 'Loading answers…'
  }));
}

function applyGradingState(q, correctAnswer) {
  if (!correctAnswer.ok) {
    gradeResult = null;
    const slotNode = correctAnswer.reason === 'fetch-failed'
      ? buildFetchFailureNode({ withRetry: true })
      : buildMissingEntryNode();
    renderUngradedFeedback(slotNode);
    return;
  }

  gradeResult = gradeSelectionAgainst(correctAnswer.correctAnswers, [...selected]);
  paintOptionCorrectness(correctAnswer.correctAnswers);
  renderGradedFeedback(q, correctAnswer);
}

function paintOptionCorrectness(correctAnswers) {
  const optsEl = document.getElementById('equiv-options');
  for (const opt of correctAnswers) {
    optsEl.querySelector(`[data-opt="${CSS.escape(opt)}"]`)
      ?.setAttribute('data-correct', '');
  }
}

const nextButtonLabel = () =>
  qIdx + 1 < getSessionSize() ? 'Next Question →' : 'Finish Session';

function renderGradedFeedback(q, correctAnswer) {
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box' + (gradeResult ? '' : ' error');
  feedback.replaceChildren(
    newEl('strong', { textContent: gradeResult ? 'Correct.' : 'Incorrect.' }),
    buildEquivChainNode(q, correctAnswer),
    newEl('div', {
      className: 'equiv-expl-slot',
      children: [buildExplanationNode(correctAnswer)]
    }),
    newEl('button', {
      className: 'primary feedback-next',
      textContent: nextButtonLabel()
    })
  );
}

function renderUngradedFeedback(slotNode) {
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box error';
  feedback.replaceChildren(
    newEl('div', { className: 'equiv-expl-slot', children: [slotNode] }),
    newEl('button', {
      className: 'primary feedback-next',
      textContent: nextButtonLabel()
    })
  );
}

function buildFetchFailureNode({ withRetry }) {
  const offlineMsg = navigator.onLine
    ? "Couldn't load answers."
    : 'You appear to be offline. Reconnect and click Retry.';
  const children = [offlineMsg];
  if (withRetry) children.push(newEl('button', {
    type: 'button',
    className: 'equiv-expl-retry',
    textContent: 'Retry'
  }));
  return newEl('div', {
    className: 'equiv-expl-failure callout error',
    children
  });
}

const buildMissingEntryNode = () => newEl('div', {
  className: 'equiv-expl-failure callout error',
  textContent: 'Answer data missing for this question.'
});

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

const noteEl = text => newEl('div', {
  className: 'equiv-expl-note',
  textContent: 'Note — ' + text
});

function buildExplanationLinkNode(link) {
  const labelEl = newEl('div', {
    className: 'equiv-expl-label',
    textContent: link.title
  });
  if (link.missing) {
    return newEl('div', {
      className: 'equiv-expl-link',
      children: [labelEl, buildMissingEntryNode()]
    });
  }
  return newEl('div', {
    className: 'equiv-expl-link',
    children: [
      labelEl,
      newEl('p', { textContent: link.priReasoning }),
      noteEl(link.biomechanics),
      newEl('div', { className: 'equiv-expl-coupling', textContent: link.couplingType })
    ]
  });
}

function buildExplanationNode(correctAnswer) {
  const { side, dir, regionInfo, dirInfo, answerLinks, couplingDisclaimer }
    = correctAnswer;
  const label = side + ' ' + regionInfo.name + ' ' + dir
    + ' — ' + regionInfo.anatomicalName;

  return newEl('div', {
    className: 'equiv-explanation',
    children: [
      newEl('div', {
        className: 'equiv-expl-region',
        children: [
          newEl('div', { className: 'equiv-expl-label', textContent: label }),
          newEl('p', { textContent: dirInfo.pri }),
          noteEl(dirInfo.biomechanics),
          newEl('div', { className: 'equiv-expl-ref', textContent: regionInfo.manualRef })
        ]
      }),
      ...answerLinks.map(buildExplanationLinkNode),
      noteEl(couplingDisclaimer)
    ]
  });
}

function buildEquivChainNode(q, correctAnswer) {
  const shown = [q.given, ...correctAnswer.correctAnswers];
  return newEl('div', {
    className: 'equiv-chain',
    children: [
      newEl('div', {
        className: 'equiv-chain-label',
        textContent: 'TESTED EQUIVALENTS:'
      }),
      ...shown.map((pos, i) => newEl('div', {
        className: 'equiv-line' + (i === 0 ? ' main' : ''),
        textContent: (i ? '= ' : '') + pos
      })),
      newEl('div', {
        className: 'equiv-chain-note',
        textContent: 'Full equivalence chain has '
          + correctAnswer.totalEquivalents
          + ' positions — see Equivalence Chains for complete walkthrough.'
      })
    ]
  });
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

  const scoreClass = 'mq-score-' + (pct < 60 ? 'fail' : pct < 80 ? 'warn' : 'pass');

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
  if (isCorr) return isSel ? ' correct' : ' missed';
  return isSel ? ' incorrect' : '';
}

function buildResultSummary(answer, correctAnswer) {
  let text = answer.question.given;
  if (!answer.correct) {
    const sel = answer.selected.length
      ? answer.selected.join(', ') : 'none';
    const corr = correctAnswer?.ok
      ? [...correctAnswer.correctAnswers].join(', ')
      : '(unavailable)';
    text += ' — You: ' + sel + ', Correct: ' + corr;
  }
  return newEl('summary', { className: 'mq-result-summary', textContent: text });
}

function buildResultDetail(answer, correctAnswer) {
  const q = answer.question;
  const knownCorrect = correctAnswer?.ok
    ? correctAnswer.correctAnswers : new Set();
  const optNodes = q.options.map(opt => newEl('div', {
    className: 'mq-result-opt' + classifyOption(opt, knownCorrect, answer.selected),
    textContent: opt
  }));
  const children = [
    newEl('div', { className: 'equiv-given', textContent: q.given }),
    newEl('div', { className: 'mq-result-comparison', children: optNodes })
  ];
  if (correctAnswer?.ok) children.push(buildEquivChainNode(q, correctAnswer));
  children.push(newEl('div', {
    className: 'equiv-expl-slot',
    children: [renderResultExplanationNode(correctAnswer)]
  }));
  return newEl('div', { className: 'mq-result-detail', children });
}

function renderResultExplanationNode(correctAnswer) {
  if (!correctAnswer.ok) {
    return correctAnswer.reason === 'fetch-failed'
      ? buildFetchFailureNode({ withRetry: false })
      : buildMissingEntryNode();
  }
  return buildExplanationNode(correctAnswer);
}

async function renderResultsList(container, answers) {
  const correctAnswers = await Promise.all(
    answers.map((a) => getCorrectAnswer(a.question))
  );
  container.replaceChildren(...answers.map((a, i) => newEl('details', {
    className: 'mq-result-row',
    children: [
      buildResultSummary(a, correctAnswers[i]),
      buildResultDetail(a, correctAnswers[i])
    ]
  })));
}

function retakeMissed() {
  const missed = sessionAnswers
    .filter((a) => a.correct === false)
    .map((a) => a.question);
  questions = toShuffled(missed);
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

function handleFeedbackNext() {
  recordCurrentAnswer();
  qIdx++;
  if (qIdx >= getSessionSize()) renderResults();
  else renderQuestion();
}

containerEl.addEventListener('click', (e) => {
  const action = e.target.closest(
    '.equiv-opt, .equiv-expl-retry, .feedback-next, [id^="equiv-"]');
  if (!action) return;

  if (action.classList.contains('equiv-opt')) return handleOptionToggle(action);
  if (action.classList.contains('equiv-expl-retry')) return retryExplanations();
  if (action.classList.contains('feedback-next')) return handleFeedbackNext();
  CLICK_DISPATCH[action.id]?.();
});

resetSession();
