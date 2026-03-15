import { getAllEquivalent } from './equivalence.js';
import { showFetchError } from './fetch-feedback.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DOMAINS = ['nomenclature', 'tests', 'treatment', 'anatomy', 'procedures', 'clinical'];
const STORAGE_KEY = 'masterQuiz_progress';
const USER_FC_KEY = 'userFlashcards';

let QUESTIONS = [];
let queue = [];
let qIdx = 0;
let sessionAnswers = [];
let selectedKey = null;
let submitted = false;
let equivPinned = false;

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (storageErr) { return {}; }
}

function saveProgress(progress) {
  // TODO: show user-visible feedback on storage failure
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (storageErr) { /* silent: quiz continues without persisted progress */ }
}

function updateProgress(qId, correct) {
  const progress = loadProgress();
  const entry = progress[qId] || { correctStreak: 0, totalCorrect: 0, totalAttempts: 0, lastSeen: '' };
  if (correct) {
    entry.correctStreak++;
    entry.totalCorrect++;
  } else {
    entry.correctStreak = 0;
  }
  entry.totalAttempts++;
  entry.lastSeen = new Date().toISOString().slice(0, 10);
  progress[qId] = entry;
  saveProgress(progress);
}

function getStats(questions) {
  const progress = loadProgress();
  let attempted = 0;
  let missed = 0;
  let mastered = 0;
  for (const q of questions) {
    const p = progress[q.id];
    if (!p) continue;
    if (p.totalAttempts > 0) attempted++;
    if (p.correctStreak === 0 && p.totalAttempts > 0) missed++;
    if (p.correctStreak >= 3) mastered++;
  }
  return { attempted, missed, mastered, total: questions.length };
}

function buildQueue(domains, count, priorityMode) {
  const eligible = QUESTIONS.filter(q => domains.includes(q.domain));
  if (!priorityMode) {
    const shuffled = shuffle(eligible);
    return shuffled.slice(0, count);
  }
  const progress = loadProgress();
  const missedQs = [];
  const unseen = [];
  const inProgress = [];
  for (const q of eligible) {
    const p = progress[q.id];
    if (!p || p.totalAttempts === 0) {
      unseen.push(q);
    } else if (p.correctStreak >= 3) {
      continue;
    } else if (p.correctStreak === 0) {
      missedQs.push(q);
    } else {
      inProgress.push({ q, totalCorrect: p.totalCorrect });
    }
  }
  inProgress.sort((a, b) => a.totalCorrect - b.totalCorrect);
  const ordered = [
    ...shuffle(missedQs),
    ...shuffle(unseen),
    ...inProgress.map(x => x.q)
  ];
  return ordered.slice(0, count);
}

function showScreen(screenId) {
  document.getElementById('mq-config').classList.toggle('hidden', screenId !== 'config');
  document.getElementById('mq-quiz').classList.toggle('hidden', screenId !== 'quiz');
  document.getElementById('mq-results').classList.toggle('hidden', screenId !== 'results');
}

function getSelectedDomains() {
  return DOMAINS.filter(d => {
    const cb = document.getElementById('mq-domain-' + d);
    return cb && cb.checked;
  });
}

function getQuestionCount() {
  const val = document.getElementById('mq-count').value;
  return val === 'all' ? 9999 : parseInt(val, 10);
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
    stats.attempted + ' of ' + stats.total + ' questions attempted \u00b7 ' +
    stats.missed + ' missed \u00b7 ' +
    stats.mastered + ' mastered (excluded)';
}

function syncStartButton() {
  const domains = getSelectedDomains();
  document.getElementById('mq-start').disabled = domains.length === 0;
}

function handleStart() {
  const domains = getSelectedDomains();
  if (domains.length === 0) return;

  const count = getQuestionCount();
  const priority = document.getElementById('mq-priority').checked;
  queue = buildQueue(domains, count, priority);
  if (queue.length === 0) {
    document.getElementById('mq-stats').textContent = 'No questions available for selected domains.';
    return;
  }
  qIdx = 0;
  sessionAnswers = [];
  equivPinned = false;
  showScreen('quiz');
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

  document.getElementById('mq-progress-fill').style.width = ((qIdx / queue.length) * 100) + '%';
  document.getElementById('mq-progress-text').textContent = 'Question ' + (qIdx + 1) + ' of ' + queue.length;
  document.getElementById('mq-domain-badge').textContent = q.domain;
  document.getElementById('mq-stem').textContent = q.stem;

  const optionsEl = document.getElementById('mq-options');
  optionsEl.innerHTML = '';
  for (const opt of q.options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = opt.key;
    btn.textContent = opt.key + '. ' + opt.text;
    optionsEl.appendChild(btn);
  }

  const submitBtn = document.getElementById('mq-submit');
  submitBtn.disabled = true;
  submitBtn.classList.remove('hidden');
  document.getElementById('mq-next').classList.add('hidden');
  const explanationEl = document.getElementById('mq-explanation');
  explanationEl.classList.add('hidden');
  explanationEl.innerHTML = '';
  const saveBtn = document.getElementById('mq-save-flashcard');
  saveBtn.classList.add('hidden');
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save as Flashcard';

  if (!equivPinned) {
    const equivWrap = document.getElementById('mq-equiv-wrap');
    equivWrap.classList.add('hidden');
    equivWrap.innerHTML = '';
  } else {
    clearEquivHighlights();
  }
}

function handleOptionSelect(key) {
  if (submitted) return;

  selectedKey = key;
  const btns = document.getElementById('mq-options').querySelectorAll('button');
  for (const btn of btns) {
    btn.classList.toggle('selected', btn.dataset.key === key);
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

  const btns = document.getElementById('mq-options').querySelectorAll('button');
  for (const btn of btns) {
    btn.classList.add('locked');
    if (btn.dataset.key === q.answer) {
      btn.classList.add('correct');
    } else if (btn.dataset.key === selectedKey && !correct) {
      btn.classList.add('incorrect');
    }
  }

  document.getElementById('mq-submit').classList.add('hidden');
  const nextBtn = document.getElementById('mq-next');
  nextBtn.classList.remove('hidden');
  nextBtn.textContent = qIdx + 1 < queue.length ? 'Next Question \u2192' : 'Finish Session';

  const explanationEl = document.getElementById('mq-explanation');
  explanationEl.innerHTML = '<div class="callout">' + q.explanation + '</div>';
  explanationEl.classList.remove('hidden');

  const alreadySaved = isAlreadySaved(q.id);
  const saveBtn = document.getElementById('mq-save-flashcard');
  saveBtn.classList.remove('hidden');
  if (alreadySaved) {
    saveBtn.textContent = 'Already saved';
    saveBtn.disabled = true;
  }

  renderEquivChain(q);
}

function handleNext() {
  qIdx++;
  renderQuestion();
}

const RE_POSITION = /\b(IP|IS|IsP|SI|AF|FA)\s+(ER|IR)\b/g;

function detectEquivalence(q) {
  const text = q.stem + ' ' + q.options.map(o => o.text).join(' ') + ' ' + q.explanation;
  const matches = [...text.matchAll(RE_POSITION)]
      .map((m) => ({ region: m[1], dir: m[2] }));
  return matches.length > 0 ? matches : null;
}

function buildChainLine(equiv, formatEntry) {
  const parts = [];
  for (const [rid, d] of Object.entries(equiv)) {
    if (rid === 'FA') continue;
    parts.push(formatEntry(rid, d));
  }
  return parts.join(' = ');
}

function renderEquivChain(q) {
  const matches = detectEquivalence(q);
  const equivWrap = document.getElementById('mq-equiv-wrap');
  if (!matches) {
    if (!equivPinned) {
      equivWrap.classList.add('hidden');
    }
    return;
  }

  const first = matches[0];
  const equiv = getAllEquivalent(first.region, first.dir);

  const matchedPositions = new Set();
  for (const mt of matches) {
    matchedPositions.add(mt.region + '_' + mt.dir);
  }

  const mainLine = buildChainLine(equiv, (rid, d) => {
    return matchedPositions.has(rid + '_' + d)
        ? '<span class="mq-equiv-highlight">' + rid + ' ' + d + '</span>'
        : rid + ' ' + d;
  });

  const inverseLine = buildChainLine(equiv, (rid, d) =>
    rid + ' ' + (d === 'ER' ? 'IR' : 'ER')
  );

  equivWrap.innerHTML =
    '<div class="mono-label">EQUIVALENCE CHAIN</div>' +
    '<div class="equiv-line main">' + mainLine + '</div>' +
    '<div class="equiv-line"><span class="text-dim">Inverse: ' + inverseLine + '</span></div>' +
    '<label class="mq-pin-label"><input type="checkbox" id="mq-pin-equiv"' +
    (equivPinned ? ' checked' : '') + '> Keep Pinned</label>';
  equivWrap.classList.remove('hidden');

  const pinCb = document.getElementById('mq-pin-equiv');
  if (pinCb) {
    pinCb.addEventListener('change', () => {
      equivPinned = pinCb.checked;
    });
  }
}

function clearEquivHighlights() {
  const highlights = document.getElementById('mq-equiv-wrap').querySelectorAll('.mq-equiv-highlight');
  for (const el of highlights) {
    el.className = '';
  }
}

function getUserCards() {
  try {
    const raw = localStorage.getItem(USER_FC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (storageErr) { return []; }
}

function isAlreadySaved(qId) {
  const cards = getUserCards();
  return cards.some(c => c.id === 'user-mq-' + qId);
}

function saveAsFlashcard(q) {
  if (isAlreadySaved(q.id)) return false;

  const front = q.stem.length > 200 ? q.stem.slice(0, 200) + '\u2026' : q.stem;
  const correctOpt = q.options.find(o => o.key === q.answer);
  const back = q.answer + '. ' + (correctOpt ? correctOpt.text : '');
  const backDetail = q.explanation.length > 380 ? q.explanation.slice(0, 380) + '\u2026' : q.explanation;

  const card = {
    id: 'user-mq-' + q.id,
    category: 'user_created',
    examWeight: 'high',
    front: front,
    frontHint: 'From Master Quiz \u2014 ' + q.domain,
    back: back,
    backDetail: backDetail
  };
  const existing = getUserCards();
  existing.push(card);
  localStorage.setItem(USER_FC_KEY, JSON.stringify(existing));
  return true;
}

function handleSaveFlashcard() {
  if (!submitted) return;

  const q = queue[qIdx];
  const saved = saveAsFlashcard(q);
  const saveBtn = document.getElementById('mq-save-flashcard');
  saveBtn.textContent = saved ? '\u2713 Saved' : 'Already saved';
  saveBtn.disabled = true;
}

function renderResults() {
  showScreen('results');
  const total = sessionAnswers.length;
  const correctCount = sessionAnswers.filter(a => a.correct).length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  let scoreClass = 'mq-score-green';
  if (pct < 60) scoreClass = 'mq-score-red';
  else if (pct < 80) scoreClass = 'mq-score-yellow';

  const resultScore = document.getElementById('mq-result-score');
  resultScore.className = 'mq-results-score ' + scoreClass;
  resultScore.textContent = 'Session Complete: ' + correctCount + ' / ' + total + ' correct (' + pct + '%)';

  const incorrect = sessionAnswers.filter(a => !a.correct);
  const correct = sessionAnswers.filter(a => a.correct);

  renderResultsList(document.getElementById('mq-incorrect-list'), incorrect, true);
  renderResultsList(document.getElementById('mq-correct-list'), correct, false);

  document.getElementById('mq-incorrect-section').classList.toggle('hidden', incorrect.length === 0);
  document.getElementById('mq-correct-section').classList.toggle('hidden', correct.length === 0);

  if (incorrect.length > 0) {
    document.getElementById('mq-incorrect-details').open = true;
  }
  if (correct.length > 0) {
    document.getElementById('mq-correct-details').open = false;
  }

  document.getElementById('mq-retake-missed').classList.toggle('hidden', incorrect.length === 0);
}

function renderResultsList(container, answers, showSave) {
  container.innerHTML = '';
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    const q = a.question;
    const stemPreview = q.stem.length > 80 ? q.stem.slice(0, 80) + '\u2026' : q.stem;

    const row = document.createElement('div');
    row.className = 'mq-result-row';

    const summary = document.createElement('button');
    summary.type = 'button';
    summary.className = 'mq-result-summary';
    let summaryText = stemPreview;
    if (!a.correct) {
      summaryText += ' \u2014 You: ' + a.chosen + ', Correct: ' + q.answer;
    }
    summary.textContent = summaryText;

    const detail = document.createElement('div');
    detail.className = 'mq-result-detail hidden';

    let detailHTML = '<p class="mq-result-stem">' + q.stem + '</p>';
    detailHTML += '<div class="mq-result-comparison">';
    for (const opt of q.options) {
      let cls = 'mq-result-opt';
      if (opt.key === q.answer) cls += ' correct';
      if (opt.key === a.chosen && !a.correct) cls += ' incorrect';
      detailHTML += '<div class="' + cls + '">' + opt.key + '. ' + opt.text + '</div>';
    }
    detailHTML += '</div>';
    detailHTML += '<div class="callout">' + q.explanation + '</div>';

    if (showSave) {
      const alreadySaved = isAlreadySaved(q.id);
      detailHTML += '<button type="button" class="btn mq-result-save" id="mq-result-save-' + q.id + '"' +
        (alreadySaved ? ' disabled' : '') + '>' +
        (alreadySaved ? 'Already saved' : 'Save as Flashcard') + '</button>';
    }

    detail.innerHTML = detailHTML;

    summary.addEventListener('click', () => {
      detail.classList.toggle('hidden');
    });

    row.appendChild(summary);
    row.appendChild(detail);
    container.appendChild(row);
  }
}

function handleResultSave(qId) {
  const q = QUESTIONS.find(qu => qu.id === qId);
  if (!q) return;

  const saved = saveAsFlashcard(q);
  const btn = document.getElementById('mq-result-save-' + qId);
  if (btn) {
    btn.textContent = saved ? '\u2713 Saved' : 'Already saved';
    btn.disabled = true;
  }
}

function handleRetakeMissed() {
  const missed = sessionAnswers.filter(a => !a.correct).map(a => a.question);
  queue = shuffle(missed);
  qIdx = 0;
  sessionAnswers = [];
  equivPinned = false;
  showScreen('quiz');
  renderQuestion();
}

function handleNewSession() {
  showScreen('config');
  renderStats();
  syncStartButton();
}

function handleResetProgress() {
  if (!confirm('Reset all Master Quiz progress? This cannot be undone.')) return;

  localStorage.removeItem(STORAGE_KEY);
  renderStats();
}

function handleEndSession() {
  if (sessionAnswers.length === 0) {
    showScreen('config');
    renderStats();
    return;
  }
  renderResults();
}

function selectAllDomains() {
  DOMAINS.forEach(d => {
    const cb = document.getElementById('mq-domain-' + d);
    if (cb) cb.checked = true;
  });
  syncStartButton();
  renderStats();
}

function deselectAllDomains() {
  DOMAINS.forEach(d => {
    const cb = document.getElementById('mq-domain-' + d);
    if (cb) cb.checked = false;
  });
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
  'mq-select-all': selectAllDomains,
  'mq-deselect-all': deselectAllDomains
};


function initListeners(tab) {
  tab.addEventListener('click', (e) => {
    const optBtn = e.target.closest('.mq-options button');
    if (optBtn) {
      handleOptionSelect(optBtn.dataset.key);
      return;
    }
    const resultSave = e.target.closest('.mq-result-save');
    if (resultSave) {
      handleResultSave(resultSave.id.replace('mq-result-save-', ''));
      return;
    }
    const target = e.target.closest('[id]');
    if (target && CLICK_DISPATCH[target.id]) {
      CLICK_DISPATCH[target.id]();
    }
  });

  tab.addEventListener('change', (e) => {
    if (e.target.closest('.mq-domain-filters input')) {
      syncStartButton();
      renderStats();
    }
  });

  tab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      e.preventDefault();
    }
  });
}

export async function initMasterQuiz() {
  const tab = document.getElementById('tab-masterquiz');
  if (!tab) return;

  try {
    const resp = await fetch('data/master-quiz.json');
    if (!resp.ok) {
      showFetchError(tab, 'master quiz questions');
      return;
    }
    QUESTIONS = await resp.json();
  } catch (fetchErr) {
    showFetchError(tab, 'master quiz questions');
    return;
  }

  renderStats();
  syncStartButton();
  initListeners(tab);
}
