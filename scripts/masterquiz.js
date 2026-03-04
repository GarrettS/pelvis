import { getAllEquivalent } from './study-utils.js';
const MasterQuizModule = (() => {
  const DOMAINS = ['nomenclature', 'tests', 'treatment', 'anatomy', 'procedures', 'clinical'];
  const STORAGE_KEY = 'masterQuiz_progress';
  const USER_FC_KEY = 'userFlashcards';

  const ABBR_MAP = new Map([
    ['B Patho PEC', 'Bilateral Pathological PEC'],
    ['B PEC', 'Bilateral PEC'],
    ['L AIC', 'Left Anterior Interior Chain'],
    ['R AIC', 'Right Anterior Interior Chain'],
    ['IP ER', 'Ilio-Pubo External Rotation'],
    ['IP IR', 'Ilio-Pubo Internal Rotation'],
    ['IS ER', 'Ilio-Sacral External Rotation'],
    ['IS IR', 'Ilio-Sacral Internal Rotation'],
    ['IsP ER', 'Ischio-Pubo External Rotation'],
    ['IsP IR', 'Ischio-Pubo Internal Rotation'],
    ['SI ER', 'Sacro-Iliac External Rotation'],
    ['SI IR', 'Sacro-Iliac Internal Rotation'],
    ['AF ER', 'Acetabulo-Femoral External Rotation'],
    ['AF IR', 'Acetabulo-Femoral Internal Rotation'],
    ['FA ER', 'Femoro-Acetabular External Rotation'],
    ['FA IR', 'Femoro-Acetabular Internal Rotation'],
    ['PADT', 'Pelvic Ascension Drop Test'],
    ['PART', 'Passive Abduction Raise Test'],
    ['HALT', 'Hruska Abduction Lift Test'],
    ['ADT', 'Adduction Drop Test'],
    ['SRT', 'Standing Reach Test'],
    ['ZOA', 'Zone of Apposition'],
    ['AIC', 'Anterior Interior Chain'],
    ['PEC', 'Posterior Exterior Chain'],
    ['IsP', 'Ischio-Pubo'],
    ['TFL', 'Tensor Fasciae Latae'],
    ['IAP', 'Intra-Abdominal Pressure'],
    ['OI', 'Obturator Internus'],
    ['IO', 'Internal Oblique'],
    ['TA', 'Transversus Abdominis'],
    ['IP', 'Ilio-Pubo'],
    ['IS', 'Ilio-Sacral'],
    ['SI', 'Sacro-Iliac'],
    ['AF', 'Acetabulo-Femoral'],
    ['FA', 'Femoro-Acetabular'],
    ['ER', 'External Rotation'],
    ['IR', 'Internal Rotation']
  ]);
  const abbrKeys = [...ABBR_MAP.keys()].sort((a, b) => b.length - a.length);
  const abbrRe = new RegExp(
    abbrKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'g'
  );

  function expandAbbr(text) {
    return text.replace(abbrRe, match => {
      const expansion = ABBR_MAP.get(match);
      return expansion ? '<abbr title="' + expansion + '">' + match + '</abbr>' : match;
    });
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let QUESTIONS = [];
  let dom = {};
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
    } catch (_) { return {}; }
  }

  function saveProgress(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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
    const missed = [];
    const unseen = [];
    const inProgress = [];
    for (const q of eligible) {
      const p = progress[q.id];
      if (!p || p.totalAttempts === 0) {
        unseen.push(q);
      } else if (p.correctStreak >= 3) {
        continue;
      } else if (p.correctStreak === 0) {
        missed.push(q);
      } else {
        inProgress.push({ q, totalCorrect: p.totalCorrect });
      }
    }
    inProgress.sort((a, b) => a.totalCorrect - b.totalCorrect);
    const ordered = [
      ...shuffle(missed),
      ...shuffle(unseen),
      ...inProgress.map(x => x.q)
    ];
    return ordered.slice(0, count);
  }

  function showScreen(screenId) {
    dom.config.classList.toggle('hidden', screenId !== 'config');
    dom.quiz.classList.toggle('hidden', screenId !== 'quiz');
    dom.results.classList.toggle('hidden', screenId !== 'results');
  }

  function getSelectedDomains() {
    return DOMAINS.filter(d => {
      const cb = dom.tab.querySelector('#mq-domain-' + d);
      return cb && cb.checked;
    });
  }

  function getQuestionCount() {
    return dom.countSelect.value === 'all'
      ? 9999
      : parseInt(dom.countSelect.value, 10);
  }

  function renderStats() {
    const domains = getSelectedDomains();
    const filtered = QUESTIONS.filter(q => domains.includes(q.domain));
    const stats = getStats(filtered);
    if (stats.attempted === 0) {
      dom.statsDiv.textContent = '';
      return;
    }
    dom.statsDiv.textContent =
      stats.attempted + ' of ' + stats.total + ' questions attempted \u00b7 ' +
      stats.missed + ' missed \u00b7 ' +
      stats.mastered + ' mastered (excluded)';
  }

  function syncStartButton() {
    const domains = getSelectedDomains();
    dom.startBtn.disabled = domains.length === 0;
  }

  function handleStart() {
    const domains = getSelectedDomains();
    if (domains.length === 0) return;
    const count = getQuestionCount();
    const priority = dom.priorityCheck.checked;
    queue = buildQueue(domains, count, priority);
    if (queue.length === 0) {
      dom.statsDiv.textContent = 'No questions available for selected domains.';
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

    dom.progressFill.style.width = ((qIdx / queue.length) * 100) + '%';
    dom.progressText.textContent = 'Question ' + (qIdx + 1) + ' of ' + queue.length;
    dom.domainBadge.textContent = q.domain;
    dom.stem.textContent = q.stem;

    dom.options.innerHTML = '';
    for (const opt of q.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mq-option-btn';
      btn.dataset.key = opt.key;
      btn.textContent = opt.key + '. ' + opt.text;
      dom.options.appendChild(btn);
    }

    dom.submitBtn.disabled = true;
    dom.submitBtn.classList.remove('hidden');
    dom.nextBtn.classList.add('hidden');
    dom.explanation.classList.add('hidden');
    dom.explanation.innerHTML = '';
    dom.saveBtn.classList.add('hidden');
    dom.saveBtn.disabled = false;
    dom.saveBtn.textContent = 'Save as Flashcard';

    if (!equivPinned) {
      dom.equivWrap.classList.add('hidden');
      dom.equivWrap.innerHTML = '';
    } else {
      clearEquivHighlights();
    }
  }

  function handleOptionSelect(key) {
    if (submitted) return;
    selectedKey = key;
    const btns = dom.options.querySelectorAll('.mq-option-btn');
    for (const btn of btns) {
      btn.classList.toggle('selected', btn.dataset.key === key);
    }
    dom.submitBtn.disabled = false;
  }

  function handleSubmit() {
    if (submitted || !selectedKey) return;
    submitted = true;
    const q = queue[qIdx];
    const correct = selectedKey === q.answer;

    sessionAnswers.push({ question: q, chosen: selectedKey, correct });
    updateProgress(q.id, correct);

    const btns = dom.options.querySelectorAll('.mq-option-btn');
    for (const btn of btns) {
      btn.classList.add('locked');
      if (btn.dataset.key === q.answer) {
        btn.classList.add('correct');
      } else if (btn.dataset.key === selectedKey && !correct) {
        btn.classList.add('incorrect');
      }
    }

    dom.submitBtn.classList.add('hidden');
    dom.nextBtn.classList.remove('hidden');
    dom.nextBtn.textContent = qIdx + 1 < queue.length ? 'Next Question \u2192' : 'Finish Session';

    dom.explanation.innerHTML = '<div class="callout">' + expandAbbr(q.explanation) + '</div>';
    dom.explanation.classList.remove('hidden');

    const alreadySaved = isAlreadySaved(q.id);
    dom.saveBtn.classList.remove('hidden');
    if (alreadySaved) {
      dom.saveBtn.textContent = 'Already saved';
      dom.saveBtn.disabled = true;
    }

    renderEquivChain(q);
  }

  function handleNext() {
    qIdx++;
    renderQuestion();
  }

  function detectEquivalence(q) {
    const pat = /\b(IP|IS|IsP|SI|AF|FA)\s+(ER|IR)\b/g;
    const text = q.stem + ' ' + q.options.map(o => o.text).join(' ') + ' ' + q.explanation;
    const matches = [];
    let m;
    while ((m = pat.exec(text)) !== null) {
      matches.push({ region: m[1].toLowerCase(), dir: m[2].toLowerCase() });
    }
    return matches.length > 0 ? matches : null;
  }

  function renderEquivChain(q) {
    const matches = detectEquivalence(q);
    if (!matches) {
      if (!equivPinned) {
        dom.equivWrap.classList.add('hidden');
      }
      return;
    }

    const first = matches[0];
    const equiv = getAllEquivalent(first.region, first.dir);
    const labels = { ip: 'IP', is: 'IS', isp: 'IsP', si: 'SI', af: 'AF' };

    const matchedPositions = new Set();
    for (const mt of matches) {
      matchedPositions.add(mt.region + '_' + mt.dir);
    }

    let chainHTML = '<div class="mono-label">EQUIVALENCE CHAIN</div>';
    chainHTML += '<div class="equiv-line main">';
    let first2 = true;
    for (const [rid, d] of Object.entries(equiv)) {
      if (rid === 'fa') continue;
      const label = labels[rid] || rid.toUpperCase();
      const pos = rid + '_' + d.toLowerCase();
      const highlighted = matchedPositions.has(pos);
      if (!first2) chainHTML += ' = ';
      if (highlighted) {
        chainHTML += '<span class="mq-equiv-highlight">' + label + ' ' + d + '</span>';
      } else {
        chainHTML += label + ' ' + d;
      }
      first2 = false;
    }
    chainHTML += '</div>';

    chainHTML += '<div class="equiv-line">';
    chainHTML += '<span class="text-dim">Inverse: ';
    let first3 = true;
    for (const [rid, d] of Object.entries(equiv)) {
      if (rid === 'fa') continue;
      const label = labels[rid] || rid.toUpperCase();
      const inv = d === 'ER' ? 'IR' : 'ER';
      if (!first3) chainHTML += ' = ';
      chainHTML += label + ' ' + inv;
      first3 = false;
    }
    chainHTML += '</span></div>';

    chainHTML += '<label class="mq-pin-label"><input type="checkbox" id="mq-pin-equiv"' +
      (equivPinned ? ' checked' : '') + '> Keep Pinned</label>';

    dom.equivWrap.innerHTML = chainHTML;
    dom.equivWrap.classList.remove('hidden');

    const pinCb = dom.equivWrap.querySelector('#mq-pin-equiv');
    if (pinCb) {
      pinCb.addEventListener('change', () => {
        equivPinned = pinCb.checked;
      });
    }
  }

  function clearEquivHighlights() {
    const highlights = dom.equivWrap.querySelectorAll('.mq-equiv-highlight');
    for (const el of highlights) {
      el.className = '';
    }
  }

  function getUserCards() {
    try {
      const raw = localStorage.getItem(USER_FC_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
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
    if (saved) {
      dom.saveBtn.textContent = '\u2713 Saved';
    } else {
      dom.saveBtn.textContent = 'Already saved';
    }
    dom.saveBtn.disabled = true;
  }

  function renderResults() {
    showScreen('results');
    const total = sessionAnswers.length;
    const correctCount = sessionAnswers.filter(a => a.correct).length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    let scoreClass = 'mq-score-green';
    if (pct < 60) scoreClass = 'mq-score-red';
    else if (pct < 80) scoreClass = 'mq-score-yellow';

    dom.resultScore.className = 'mq-results-score ' + scoreClass;
    dom.resultScore.textContent = 'Session Complete: ' + correctCount + ' / ' + total + ' correct (' + pct + '%)';

    const incorrect = sessionAnswers.filter(a => !a.correct);
    const correct = sessionAnswers.filter(a => a.correct);

    renderResultsList(dom.incorrectList, incorrect, true);
    renderResultsList(dom.correctList, correct, false);

    dom.incorrectSection.classList.toggle('hidden', incorrect.length === 0);
    dom.correctSection.classList.toggle('hidden', correct.length === 0);

    if (incorrect.length > 0) {
      dom.incorrectDetails.open = true;
    }
    if (correct.length > 0) {
      dom.correctDetails.open = false;
    }

    dom.retakeMissedBtn.classList.toggle('hidden', incorrect.length === 0);
  }

  function renderResultsList(container, answers, showSave) {
    container.innerHTML = '';
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      const q = a.question;
      const stemPreview = q.stem.length > 80 ? q.stem.slice(0, 80) + '\u2026' : q.stem;
      const chosenOpt = q.options.find(o => o.key === a.chosen);
      const correctOpt = q.options.find(o => o.key === q.answer);

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
      detailHTML += '<div class="callout">' + expandAbbr(q.explanation) + '</div>';

      if (showSave) {
        const alreadySaved = isAlreadySaved(q.id);
        detailHTML += '<button type="button" class="btn mq-result-save" data-qid="' + q.id + '"' +
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
    const btn = dom.tab.querySelector('.mq-result-save[data-qid="' + qId + '"]');
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

  function init() {
    const tab = document.getElementById('tab-masterquiz');
    if (!tab) return;
    dom.tab = tab;
    dom.config = tab.querySelector('#mq-config');
    dom.quiz = tab.querySelector('#mq-quiz');
    dom.results = tab.querySelector('#mq-results');
    dom.countSelect = tab.querySelector('#mq-count');
    dom.priorityCheck = tab.querySelector('#mq-priority');
    dom.statsDiv = tab.querySelector('#mq-stats');
    dom.startBtn = tab.querySelector('#mq-start');
    dom.progressFill = tab.querySelector('#mq-progress-fill');
    dom.progressText = tab.querySelector('#mq-progress-text');
    dom.domainBadge = tab.querySelector('#mq-domain-badge');
    dom.stem = tab.querySelector('#mq-stem');
    dom.options = tab.querySelector('#mq-options');
    dom.submitBtn = tab.querySelector('#mq-submit');
    dom.nextBtn = tab.querySelector('#mq-next');
    dom.explanation = tab.querySelector('#mq-explanation');
    dom.equivWrap = tab.querySelector('#mq-equiv-wrap');
    dom.saveBtn = tab.querySelector('#mq-save-flashcard');
    dom.resultScore = tab.querySelector('#mq-result-score');
    dom.incorrectSection = tab.querySelector('#mq-incorrect-section');
    dom.correctSection = tab.querySelector('#mq-correct-section');
    dom.incorrectDetails = tab.querySelector('#mq-incorrect-details');
    dom.correctDetails = tab.querySelector('#mq-correct-details');
    dom.incorrectList = tab.querySelector('#mq-incorrect-list');
    dom.correctList = tab.querySelector('#mq-correct-list');
    dom.retakeMissedBtn = tab.querySelector('#mq-retake-missed');

    fetch('data/master-quiz.json')
      .then(r => r.json())
      .then(data => {
        QUESTIONS = data;
        renderStats();
        syncStartButton();
      });

    tab.addEventListener('click', (e) => {
      const optBtn = e.target.closest('.mq-option-btn');
      if (optBtn) {
        handleOptionSelect(optBtn.dataset.key);
        return;
      }
      if (e.target.closest('#mq-submit')) {
        handleSubmit();
        return;
      }
      if (e.target.closest('#mq-next')) {
        handleNext();
        return;
      }
      if (e.target.closest('#mq-save-flashcard')) {
        handleSaveFlashcard();
        return;
      }
      if (e.target.closest('#mq-start')) {
        handleStart();
        return;
      }
      if (e.target.closest('#mq-end-session')) {
        handleEndSession();
        return;
      }
      if (e.target.closest('#mq-retake-missed')) {
        handleRetakeMissed();
        return;
      }
      if (e.target.closest('#mq-new-session')) {
        handleNewSession();
        return;
      }
      if (e.target.closest('#mq-reset-progress')) {
        handleResetProgress();
        return;
      }
      if (e.target.closest('#mq-select-all')) {
        DOMAINS.forEach(d => {
          const cb = tab.querySelector('#mq-domain-' + d);
          if (cb) cb.checked = true;
        });
        syncStartButton();
        renderStats();
        return;
      }
      if (e.target.closest('#mq-deselect-all')) {
        DOMAINS.forEach(d => {
          const cb = tab.querySelector('#mq-domain-' + d);
          if (cb) cb.checked = false;
        });
        syncStartButton();
        renderStats();
        return;
      }
      const resultSave = e.target.closest('.mq-result-save');
      if (resultSave) {
        handleResultSave(resultSave.dataset.qid);
        return;
      }
    });

    tab.addEventListener('change', (e) => {
      if (e.target.closest('.mq-domain-toggle input')) {
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

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => MasterQuizModule.init());
