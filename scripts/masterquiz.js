import { getAllEquivalent } from './equivalence.js';
import { expandAbbr } from './abbr-expand.js';
import { shuffle } from './shuffle.js';
import { loadJson } from './load.js';
import { appendErrorCallout, loadAndRender } from './error-ui.js';
import { tryLoad as tryLoadProgress, updateEntry as updateProgress,
  getStats, clearAll as clearProgress, MASTERY_STREAK
} from './master-quiz-progress.js';
import { newEl } from './el-create.js';

const containerEl = document.getElementById('masterquiz-content');

const DOMAINS = [
  'nomenclature', 'tests', 'treatment',
  'anatomy', 'procedures', 'clinical'
];
const USER_FC_KEY = 'userFlashcards';
const RE_POSITION = /\b(IP|IS|IsP|SI|AF|FA)\s+(ER|IR)\b/g;
const STEM_PREVIEW_MAX = 80;
const FLASHCARD_FRONT_MAX = 200;
const FLASHCARD_DETAIL_MAX = 380;

let QUESTIONS = [];
let queue = [];
let qIdx = 0;
let sessionAnswers = [];
let selectedKey = null;
let submitted = false;
let equivPinned = false;
let activeScreenClass = 'screen-config';

const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;

function buildQueue(domains, count, priorityMode) {
  const eligible = QUESTIONS.filter(q => domains.includes(q.domain));
  if (!priorityMode) return shuffle(eligible).slice(0, count);

  const progress = tryLoadProgress();
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

function getSelectedDomains() {
  return DOMAINS.filter(d => {
    const cb = document.getElementById('mq-domain-' + d);
    return cb && cb.checked;
  });
}

function getQuestionCount() {
  const el = document.getElementById('mq-count');
  return el.valueAsNumber || +el.defaultValue;
}

function renderStats() {
  const domains = getSelectedDomains();
  const filtered = QUESTIONS.filter(q => domains.includes(q.domain));
  const stats = getStats(filtered);
  const statsEl = document.getElementById('mq-stats');
  if (stats.attempted === 0) {
    statsEl.textContent = '';
    return;
  }
  statsEl.textContent =
    `${stats.attempted} of ${stats.total} questions attempted · ` +
    `${stats.missed} missed · ` +
    `${stats.mastered} mastered (excluded)`;
}

function syncStartButton() {
  document.getElementById('mq-start').disabled =
    getSelectedDomains().length === 0;
}

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

function renderQuestion() {
  if (qIdx >= queue.length) {
    renderResults();
    return;
  }
  const q = queue[qIdx];
  selectedKey = null;
  submitted = false;
  document.getElementById('mq-quiz').classList.remove(
      'answered-correct', 'answered-incorrect');

  document.getElementById('mq-progress-fill').style.width =
      `${(qIdx / queue.length) * 100}%`;
  document.getElementById('mq-progress-text').textContent =
      `Question ${qIdx + 1} of ${queue.length}`;
  document.getElementById('mq-domain-badge').textContent = q.domain;
  document.getElementById('mq-stem').innerHTML = expandAbbr(q.stem);

  document.getElementById('mq-options')
      .replaceChildren(...q.options.map(makeOptionButton));

  const submitBtn = document.getElementById('mq-submit');
  submitBtn.disabled = true;
  submitBtn.classList.remove('hidden');
  document.getElementById('mq-next').classList.add('hidden');

  const explanationEl = document.getElementById('mq-explanation');
  explanationEl.classList.add('hidden');
  explanationEl.replaceChildren();

  const saveBtn = document.getElementById('mq-save-flashcard');
  saveBtn.classList.add('hidden');
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

function makeOptionButton(opt) {
  return newEl('button', {
    type: 'button',
    value: opt.key,
    innerHTML: `${opt.key}. ${expandAbbr(opt.text)}`
  });
}

function handleOptionSelect(key) {
  if (submitted) return;

  selectedKey = key;
  for (const btn of document.getElementById('mq-options').querySelectorAll('button')) {
    btn.classList.toggle('selected', btn.value === key);
  }
  document.getElementById('mq-submit').disabled = false;
}

function handleSubmit() {
  if (submitted || !selectedKey) return;

  submitted = true;
  const q = queue[qIdx];
  const correct = selectedKey === q.answer;

  sessionAnswers.push({ question: q, chosen: selectedKey, correct });
  updateProgress(q.id, correct);

  for (const btn of document.getElementById('mq-options').querySelectorAll('button')) {
    btn.classList.add('locked');
    if (btn.value === q.answer) {
      btn.classList.add('correct');
    } else if (btn.value === selectedKey && !correct) {
      btn.classList.add('incorrect');
    }
  }

  document.getElementById('mq-quiz').classList.add(
      correct ? 'answered-correct' : 'answered-incorrect');

  document.getElementById('mq-submit').classList.add('hidden');
  const nextBtn = document.getElementById('mq-next');
  nextBtn.classList.remove('hidden');
  nextBtn.textContent = qIdx + 1 < queue.length
      ? 'Next Question →' : 'Finish Session';

  const explanationEl = document.getElementById('mq-explanation');
  explanationEl.replaceChildren(newEl('div', {
    className: 'callout',
    innerHTML: expandAbbr(q.explanation)
  }));
  explanationEl.classList.remove('hidden');

  const saveBtn = document.getElementById('mq-save-flashcard');
  saveBtn.classList.remove('hidden');
  if (isAlreadySaved(q.id)) {
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
  const matches = [...text.matchAll(RE_POSITION)]
      .map(m => ({ region: m[1], dir: m[2] }));
  return matches.length > 0 ? matches : null;
}

function makeChainNodes(equiv, formatEntry) {
  const nodes = [];
  for (const [rid, d] of Object.entries(equiv)) {
    if (rid === 'FA') continue;
    if (nodes.length) nodes.push(' = ');
    nodes.push(formatEntry(rid, d));
  }
  return nodes;
}

function renderEquivChain(q) {
  const matches = detectEquivalence(q);
  const equivWrap = document.getElementById('mq-equiv-wrap');
  if (!matches) {
    if (!equivPinned) equivWrap.classList.add('hidden');
    return;
  }

  const first = matches[0];
  const equiv = getAllEquivalent(first.region, first.dir);
  const matchedPositions = new Set(
      matches.map(m => `${m.region}_${m.dir}`));

  const mainLine = makeChainNodes(equiv, (rid, d) =>
      matchedPositions.has(`${rid}_${d}`)
          ? newEl('span', {className: 'mq-equiv-highlight', textContent: `${rid} ${d}`})
          : `${rid} ${d}`);

  const inverseLine = makeChainNodes(equiv, (rid, d) =>
      `${rid} ${d === 'ER' ? 'IR' : 'ER'}`);

  equivWrap.replaceChildren(
      newEl('div', {className: 'mono-label', textContent: 'EQUIVALENCE CHAIN'}),
      newEl('div', {className: 'equiv-line main', children: mainLine}),
      newEl('div', {className: 'equiv-line', children: [
        newEl('span', {className: 'text-dim',
          children: ['Inverse: ', ...inverseLine]})
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

function tryGetUserCards() {
  try {
    const rawCards = localStorage.getItem(USER_FC_KEY);
    return rawCards ? JSON.parse(rawCards) : [];
  } catch (anyError) {
    // Background saved-status check — not user-initiated.
    // Save handlers read again and show an error if saved-card data is corrupt.
    return [];
  }
}

const isAlreadySaved = qId =>
    tryGetUserCards().some(c => c.id === 'user-mq-' + qId);

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

function showSaveFailure(container, message) {
  container.querySelector('.callout.error')?.remove();
  appendErrorCallout(container, message);
}

function saveUserFlashcard(card) {
  let rawCards;
  try {
    rawCards = localStorage.getItem(USER_FC_KEY);
  } catch (storageReadError) {
    return {
      ok: false,
      message: "Couldn't save flashcard: browser storage is unavailable: "
          + storageReadError.message
    };
  }

  let savedCards;
  try {
    savedCards = rawCards ? JSON.parse(rawCards) : [];
  } catch (parseError) {
    return {
      ok: false,
      message: "Couldn't save flashcard: saved card data is corrupt: "
          + parseError.message
    };
  }

  if (savedCards.some(c => c.id === card.id)) {
    return { ok: true, duplicate: true };
  }

  let serializedCards;
  try {
    serializedCards = JSON.stringify([...savedCards, card]);
  } catch (stringifyError) {
    return {
      ok: false,
      message: "Couldn't save flashcard: saved card data couldn't be prepared: "
          + stringifyError.message
    };
  }

  try {
    localStorage.setItem(USER_FC_KEY, serializedCards);
  } catch (storageWriteError) {
    return {
      ok: false,
      message: "Couldn't save flashcard: browser storage is unavailable: "
          + storageWriteError.message
    };
  }

  return { ok: true, duplicate: false };
}

function handleSaveFlashcard() {
  if (!submitted) return;

  const q = queue[qIdx];
  const saveBtn = document.getElementById('mq-save-flashcard');
  const explanationEl = document.getElementById('mq-explanation');
  const result = saveUserFlashcard(buildFlashcard(q));
  if (!result.ok) {
    showSaveFailure(explanationEl, result.message);
    saveBtn.disabled = true;
    return;
  }

  explanationEl?.querySelector('.callout.error')?.remove();
  saveBtn.textContent = result.duplicate ? 'Already saved' : '✓ Saved';
  saveBtn.disabled = true;
}

function renderResults() {
  showScreen('screen-results');
  const total = sessionAnswers.length;
  const correctCount = sessionAnswers.filter(a => a.correct).length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  let scoreClass = 'mq-score-correct';
  if (pct < 60) scoreClass = 'mq-score-red';
  else if (pct < 80) scoreClass = 'mq-score-yellow';

  const resultScore = document.getElementById('mq-result-score');
  resultScore.className = 'mq-results-score ' + scoreClass;
  resultScore.textContent =
      `Session Complete: ${correctCount} / ${total} correct (${pct}%)`;

  const incorrect = sessionAnswers.filter(a => !a.correct);
  const correct = sessionAnswers.filter(a => a.correct);

  renderResultsList(document.getElementById('mq-incorrect-list'), incorrect, true);
  renderResultsList(document.getElementById('mq-correct-list'), correct, false);

  const resultsEl = document.getElementById('mq-results');
  resultsEl.classList.toggle('has-incorrect', incorrect.length > 0);
  resultsEl.classList.toggle('has-correct', correct.length > 0);

  if (incorrect.length > 0) {
    document.getElementById('mq-incorrect-details').open = true;
  }
  if (correct.length > 0) {
    document.getElementById('mq-correct-details').open = false;
  }
}

function resultOptClass(opt, q, answer) {
  let cls = 'mq-result-opt';
  if (opt.key === q.answer) cls += ' correct';
  if (opt.key === answer.chosen && !answer.correct) cls += ' incorrect';
  return cls;
}

function makeResultRow(answer, showSave) {
  const q = answer.question;
  let summaryText = truncate(q.stem, STEM_PREVIEW_MAX);
  if (!answer.correct) {
    summaryText += ` — You: ${answer.chosen}, Correct: ${q.answer}`;
  }

  const detailChildren = [
    newEl('p', {className: 'mq-result-stem', innerHTML: expandAbbr(q.stem)}),
    newEl('div', {
      className: 'mq-result-comparison',
      children: q.options.map(opt => newEl('div', {
        className: resultOptClass(opt, q, answer),
        innerHTML: `${opt.key}. ${expandAbbr(opt.text)}`
      }))
    }),
    newEl('div', {className: 'callout', innerHTML: expandAbbr(q.explanation)})
  ];

  if (showSave) {
    const alreadySaved = isAlreadySaved(q.id);
    detailChildren.push(newEl('button', {
      type: 'button',
      className: 'btn mq-result-save',
      value: q.id,
      disabled: alreadySaved,
      textContent: alreadySaved ? 'Already saved' : 'Save as Flashcard'
    }));
  }

  return newEl('div', {className: 'mq-result-row', children: [
    newEl('button', {
      type: 'button',
      className: 'mq-result-summary',
      textContent: summaryText
    }),
    newEl('div', {className: 'mq-result-detail hidden', children: detailChildren})
  ]});
}

function renderResultsList(container, answers, showSave) {
  container.replaceChildren(...answers.map(a => makeResultRow(a, showSave)));
}

function handleResultSave(btn) {
  const q = QUESTIONS.find(qu => qu.id === btn.value);
  if (!q) return;

  const result = saveUserFlashcard(buildFlashcard(q));
  if (!result.ok) {
    showSaveFailure(btn.parentNode, result.message);
    btn.disabled = true;
    return;
  }

  btn.parentNode?.querySelector('.callout.error')?.remove();
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

  try {
    clearProgress();
  } catch (anyError) {
    document.getElementById('mq-stats').textContent =
        "Couldn't reset progress: browser storage is unavailable.";
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
  'mq-submit': handleSubmit,
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
  containerEl.addEventListener('click', (e) => {
    const action = e.target.closest(
        '.mq-options button, .mq-result-summary, .mq-result-save');
    if (action) {
      if (action.matches('.mq-options button')) {
        handleOptionSelect(action.value);
      } else if (action.matches('.mq-result-summary')) {
        action.nextElementSibling.classList.toggle('hidden');
      } else {
        handleResultSave(action);
      }
      return;
    }
    const target = e.target.closest('[id]');
    if (target && CLICK_DISPATCH[target.id]) {
      CLICK_DISPATCH[target.id]();
    }
  });

  containerEl.addEventListener('change', (e) => {
    const pinCheckbox = e.target.closest('#mq-pin-equiv');
    if (pinCheckbox) {
      equivPinned = pinCheckbox.checked;
      return;
    }
    if (e.target.closest('.mq-domain-filters input')) {
      syncStartButton();
      renderStats();
    }
  });

  containerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && /^(?:INPUT|SELECT)/.test(e.target.tagName)) {
      e.preventDefault();
    }
  });
}

await loadAndRender({
  load: () => loadJson('./data/master-quiz.json'),
  container: containerEl,
  render: (data) => {
    QUESTIONS = data;
    renderStats();
    syncStartButton();
    initListeners();
  }
});
