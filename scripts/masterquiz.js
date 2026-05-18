import { getAllEquivalent } from './equivalence.js';
import { expandAbbr } from './abbr-expand.js';
import { shuffle } from './shuffle.js';
import { loadJson } from './load.js';
import { replaceErrorCallout, clearErrors, attemptLoad } from './error-ui.js';
import { saveUserFlashcard, hasSavedFlashcard } from './flashcard-storage.js';
import { getAllProgress, setQuestionBankCount,
  updateEntry as updateProgress, getStats,
  clearAll as clearProgress, MASTERY_STREAK
} from './master-quiz-progress.js';
import { newEl } from './el-create.js';

const containerEl = document.getElementById('masterquiz-content');
const quizForm = document.getElementById('mq-quiz-form');
const submitBtn = quizForm.elements.namedItem('mq-submit');

const DOMAINS = [
  'nomenclature', 'tests', 'treatment',
  'anatomy', 'procedures', 'clinical'
];
const RE_POSITION = /\b(?<region>IP|IS|IsP|SI|AF|FA)\s+(?<dir>ER|IR)\b/g;
const STEM_PREVIEW_MAX = 80;
const FLASHCARD_FRONT_MAX = 200;
const FLASHCARD_DETAIL_MAX = 380;
const PROGRESS_TOAST_MS = 5000;

let QUESTIONS = [];
let queue = [];
let qIdx = 0;
let sessionAnswers = [];
let submitted = false;
let equivPinned = false;
let activeScreenClass = 'screen-config';

const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;

function buildQueue(domains, count, priorityMode) {
  const eligible = QUESTIONS.filter(q => domains.includes(q.domain));
  if (!priorityMode) return shuffle(eligible).slice(0, count);

  const progress = getAllProgress();
  const missedQs = [];
  const unseen = [];
  const inProgress = [];
  for (const q of eligible) {
    const p = progress[q.id];
    if (!p || p.totalAttempts === 0) {
      unseen.push(q);
    } else if (p.correctStreak >= MASTERY_STREAK) {
      continue;
    } else if (p.correctStreak === 0) {
      missedQs.push(q);
    } else {
      inProgress.push({ q, totalCorrect: p.totalCorrect });
    }
  }
  shuffle(inProgress);
  inProgress.sort((a, b) => a.totalCorrect - b.totalCorrect);
  return [
    ...shuffle(missedQs),
    ...shuffle(unseen),
    ...inProgress.map(x => x.q)
  ].slice(0, count);
}

function showScreen(cls) {
  containerEl.classList.replace(activeScreenClass, cls);
  activeScreenClass = cls;
}

const hideProgressToast = () =>
  (document.getElementById('mq-progress-toast').hidden = true);

let progressToastTimer = 0;

function showProgressToast(message) {
  const toast = document.getElementById('mq-progress-toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(progressToastTimer);
  progressToastTimer = setTimeout(hideProgressToast, PROGRESS_TOAST_MS);
}

const getSelectedDomains = () =>
  DOMAINS.filter(d => document.getElementById('mq-domain-' + d)?.checked);

const getQuestionCount = () =>
  document.getElementById('mq-count').valueAsNumber;

function renderStats() {
  const domains = getSelectedDomains();
  const selectedQuestions =
    QUESTIONS.filter(question => domains.includes(question.domain));
  const stats = getStats(selectedQuestions);
  const statsEl = document.getElementById('mq-stats');
  if (stats.attempted === 0) {
    statsEl.textContent = '';
    return;
  }
  statsEl.textContent =
    `${stats.attempted} of ${stats.selectedQuestionCount} ` +
    `questions attempted · ${stats.missed} missed · ` +
    `${stats.mastered} mastered (excluded)`;
}

const syncStartButton = () =>
  document.getElementById('mq-start').disabled =
      getSelectedDomains().length === 0;

function handleStart() {
  const domains = getSelectedDomains();
  if (domains.length === 0) return;

  queue = buildQueue(domains, getQuestionCount(),
      document.getElementById('mq-priority').checked);
  if (queue.length === 0) {
    document.getElementById('mq-stats').textContent =
      'No questions available for selected domains.';
    return;
  }
  qIdx = 0;
  sessionAnswers = [];
  equivPinned = false;
  showScreen('screen-quiz');
  renderQuestion();
}

function updateQuizUI(q, index, total) {
  document.getElementById('mq-progress-fill').style.width =
      `${(index / total) * 100}%`;
  document.getElementById('mq-progress-text').textContent =
      `Question ${index + 1} of ${total}`;
  document.getElementById('mq-domain-badge').textContent = q.domain;
  document.getElementById('mq-stem').innerHTML = expandAbbr(q.stem);
  document.getElementById('mq-options')
      .replaceChildren(...q.options.map(makeOptionRadio));
}

function renderQuestion() {
  if (qIdx >= queue.length) {
    renderResults();
    return;
  }
  const q = queue[qIdx];
  submitted = false;
  document.getElementById('mq-quiz').classList.remove(
      'answered-correct', 'answered-incorrect');

  updateQuizUI(q, qIdx, queue.length);

  submitBtn.disabled = true;
  document.getElementById('mq-explanation').replaceChildren();

  const saveBtn = document.getElementById('mq-save-flashcard');
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save as Flashcard';

  if (!equivPinned) {
    const equivWrap = document.getElementById('mq-equiv-wrap');
    equivWrap.classList.add('hidden');
    equivWrap.replaceChildren();
  } else {
    clearEquivHighlights();
  }
}

const makeOptionRadio = opt => newEl('label', {className: 'mq-option', children: [
  newEl('input', {type: 'radio', name: 'answer', value: opt.key}),
  newEl('span', {innerHTML: `${opt.key}. ${expandAbbr(opt.text)}`})
]});

function handleSubmit() {
  const chosen = quizForm.elements.answer.value;
  if (submitted || !chosen) return;

  submitted = true;
  const q = queue[qIdx];
  const correct = chosen === q.answer;

  sessionAnswers.push({ question: q, chosen, correct });
  const progressResult = updateProgress(q.id, correct);
  if (!progressResult.ok) showProgressToast(progressResult.message);

  for (const radio of quizForm.elements.answer) {
    radio.disabled = true;
    if (radio.value === q.answer) {
      radio.parentElement.classList.add('correct');
    } else if (radio.value === chosen && !correct) {
      radio.parentElement.classList.add('incorrect');
    }
  }

  document.getElementById('mq-quiz').classList.add(
      correct ? 'answered-correct' : 'answered-incorrect');

  document.getElementById('mq-next').textContent =
      qIdx + 1 < queue.length ? 'Next Question →' : 'Finish Session';

  document.getElementById('mq-explanation').replaceChildren(newEl('div', {
    className: 'callout',
    innerHTML: expandAbbr(q.explanation)
  }));

  if (isAlreadySaved(q.id)) {
    const saveBtn = document.getElementById('mq-save-flashcard');
    saveBtn.textContent = 'Already saved';
    saveBtn.disabled = true;
  }

  renderEquivChain(q);
}

function handleNext() {
  qIdx++;
  renderQuestion();
}

function detectEquivalence(q) {
  const text = `${q.stem} ${q.options.map(o => o.text).join(' ')} ${q.explanation}`;
  const matches = Array.from(
      text.matchAll(RE_POSITION),
      ({ groups }) => `${groups.region}_${groups.dir}`);
  return matches.length ? matches : null;
}

function makeChainLines(equiv, matched) {
  const main = [];
  const inverse = [];
  for (const [rid, d] of Object.entries(equiv)) {
    if (rid === 'FA') continue;
    if (main.length) { main.push(' = '); inverse.push(' = '); }
    main.push(matched.has(`${rid}_${d}`)
        ? newEl('span', {className: 'mq-equiv-highlight', textContent: `${rid} ${d}`})
        : `${rid} ${d}`);
    inverse.push(`${rid} ${d === 'ER' ? 'IR' : 'ER'}`);
  }
  return { main, inverse };
}

function renderEquivChain(q) {
  const positions = detectEquivalence(q);
  const equivWrap = document.getElementById('mq-equiv-wrap');
  if (!positions) {
    if (!equivPinned) equivWrap.classList.add('hidden');
    return;
  }

  const [region, dir] = positions[0].split('_');
  const equiv = getAllEquivalent(region, dir);
  const matched = new Set(positions);

  const {main, inverse} = makeChainLines(equiv, matched);

  equivWrap.replaceChildren(
      newEl('div', {className: 'mono-label', textContent: 'EQUIVALENCE CHAIN'}),
      newEl('div', {className: 'equiv-line main', children: main}),
      newEl('div', {className: 'equiv-line', children: [
        newEl('span', {className: 'text-dim',
          children: ['Inverse: ', ...inverse]})
      ]}),
      newEl('label', {className: 'mq-pin-label', children: [
        newEl('input', {type: 'checkbox', id: 'mq-pin-equiv', checked: equivPinned}),
        ' Keep Pinned'
      ]})
  );
  equivWrap.classList.remove('hidden');
}

function clearEquivHighlights() {
  const wrap = document.getElementById('mq-equiv-wrap');
  for (const el of wrap.querySelectorAll('.mq-equiv-highlight')) {
    el.classList.remove('mq-equiv-highlight');
  }
}

const isAlreadySaved = qId => hasSavedFlashcard('user-mq-' + qId);

function buildFlashcard(q) {
  const correctOpt = q.options.find(o => o.key === q.answer);
  return {
    id: 'user-mq-' + q.id,
    category: 'user_created',
    examWeight: 'high',
    front: truncate(q.stem, FLASHCARD_FRONT_MAX),
    frontHint: 'From Master Quiz — ' + q.domain,
    back: `${q.answer}. ${correctOpt ? correctOpt.text : ''}`,
    backDetail: truncate(q.explanation, FLASHCARD_DETAIL_MAX)
  };
}

function handleSaveFlashcard() {
  if (!submitted) return;

  const q = queue[qIdx];
  const saveBtn = document.getElementById('mq-save-flashcard');
  const explanationEl = document.getElementById('mq-explanation');
  const result = saveUserFlashcard(buildFlashcard(q));
  if (!result.ok) {
    replaceErrorCallout(explanationEl, result.message);
    saveBtn.disabled = true;
    return;
  }

  clearErrors(explanationEl);
  saveBtn.textContent = result.duplicate ? 'Already saved' : '✓ Saved';
  saveBtn.disabled = true;
}

function renderResultGroup(type, data) {
  renderResultsList(document.getElementById(`mq-${type}-list`), data);
  document.getElementById('mq-results')
      .classList.toggle(`has-${type}`, data.length > 0);
}

function renderResults() {
  showScreen('screen-results');
  const correct = sessionAnswers.filter(a => a.correct);
  const incorrect = sessionAnswers.filter(a => !a.correct);
  const total = sessionAnswers.length;
  const pct = total > 0 ? Math.round((correct.length / total) * 100) : 0;

  const scoreClass = 'mq-score-' + (pct < 60 ? 'fail' : pct < 80 ? 'warn' : 'pass');

  const resultScore = document.getElementById('mq-result-score');
  resultScore.className = 'mq-results-score ' + scoreClass;
  resultScore.textContent =
      `Session Complete: ${correct.length} / ${total} correct (${pct}%)`;

  renderResultGroup('correct', correct);
  renderResultGroup('incorrect', incorrect);

  document.getElementById('mq-incorrect-details').open = incorrect.length > 0;
}

function resultOptClass(opt, q, answer) {
  let cls = 'mq-result-opt';
  if (opt.key === q.answer) cls += ' correct';
  if (opt.key === answer.chosen && !answer.correct) cls += ' incorrect';
  return cls;
}

function makeSaveButton(qId) {
  const alreadySaved = isAlreadySaved(qId);
  return newEl('button', {
    type: 'button',
    className: 'mq-result-save',
    value: qId,
    disabled: alreadySaved,
    textContent: alreadySaved ? 'Already saved' : 'Save as Flashcard'
  });
}

function makeResultRow(answer) {
  const q = answer.question;
  let summaryText = truncate(q.stem, STEM_PREVIEW_MAX);
  if (!answer.correct) {
    summaryText += ` — You: ${answer.chosen}, Correct: ${q.answer}`;
  }

  return newEl('details', {className: 'mq-result-row', children: [
    newEl('summary', {className: 'mq-result-summary', textContent: summaryText}),
    newEl('div', {className: 'mq-result-detail', children: [
      newEl('p', {className: 'mq-result-stem', innerHTML: expandAbbr(q.stem)}),
      newEl('div', {
        className: 'mq-result-comparison',
        children: q.options.map(opt => newEl('div', {
          className: resultOptClass(opt, q, answer),
          innerHTML: `${opt.key}. ${expandAbbr(opt.text)}`
        }))
      }),
      newEl('div', {className: 'callout', innerHTML: expandAbbr(q.explanation)}),
      makeSaveButton(q.id)
    ]})
  ]});
}

const renderResultsList = (container, answers) =>
  container.replaceChildren(...answers.map(makeResultRow));

function handleResultSave(btn) {
  const q = QUESTIONS.find(qu => qu.id === btn.value);
  if (!q) return;

  const result = saveUserFlashcard(buildFlashcard(q));
  if (!result.ok) {
    replaceErrorCallout(btn.parentNode, result.message);
    btn.disabled = true;
    return;
  }

  clearErrors(btn.parentNode);
  btn.textContent = result.duplicate ? 'Already saved' : '✓ Saved';
  btn.disabled = true;
}

function handleRetakeMissed() {
  queue = shuffle(sessionAnswers.filter(a => !a.correct).map(a => a.question));
  qIdx = 0;
  sessionAnswers = [];
  equivPinned = false;
  showScreen('screen-quiz');
  renderQuestion();
}

function handleNewSession() {
  showScreen('screen-config');
  renderStats();
  syncStartButton();
}

function handleResetProgress() {
  if (!confirm('Reset all Master Quiz progress? This cannot be undone.')) return;

  const resetResult = clearProgress();
  if (!resetResult.ok) {
    document.getElementById('mq-stats').textContent = resetResult.message;
    return;
  }
  renderStats();
}

function handleEndSession() {
  if (sessionAnswers.length === 0) {
    showScreen('screen-config');
    renderStats();
    return;
  }
  renderResults();
}

function setAllDomains(checked) {
  for (const d of DOMAINS) {
    const cb = document.getElementById('mq-domain-' + d);
    if (cb) cb.checked = checked;
  }
  syncStartButton();
  renderStats();
}

const CLICK_DISPATCH = {
  'mq-next': handleNext,
  'mq-save-flashcard': handleSaveFlashcard,
  'mq-start': handleStart,
  'mq-end-session': handleEndSession,
  'mq-retake-missed': handleRetakeMissed,
  'mq-new-session': handleNewSession,
  'mq-reset-progress': handleResetProgress,
  'mq-select-all': () => setAllDomains(true),
  'mq-deselect-all': () => setAllDomains(false)
};

function initListeners() {
  const domainFilters = containerEl.querySelector('.mq-domain-filters');
  const equivWrap = document.getElementById('mq-equiv-wrap');

  containerEl.addEventListener('click', (e) => {
    const save = e.target.closest('.mq-result-save');
    if (save) {
      handleResultSave(save);
      return;
    }
    const target = e.target.closest('[id]');
    if (target && CLICK_DISPATCH[target.id]) CLICK_DISPATCH[target.id]();
  });

  quizForm.addEventListener('change', () => submitBtn.disabled = false);
  quizForm.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });
  domainFilters.addEventListener('change', () => { syncStartButton(); renderStats(); });
  equivWrap.addEventListener('change', (e) => equivPinned = e.target.checked);
}

await attemptLoad({
  loader: () => loadJson('./data/master-quiz.json'),
  container: containerEl,
  render: (data) => {
    QUESTIONS = data;
    const saveResult = setQuestionBankCount(QUESTIONS.length);
    if (!saveResult.ok) showProgressToast(saveResult.message);
    renderStats();
    syncStartButton();
    initListeners();
  }
});
