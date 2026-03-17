import { getAllEquivalent, REGION_LABELS } from './equivalence.js';
import { shuffle } from './shuffle.js';

const REGIONS = Object.keys(REGION_LABELS)
  .filter((r) => r !== 'FA');
const SIDES = ['L', 'R'];
const DIRS = ['ER', 'IR'];

let questions = [];
let qIdx = 0;
let score = { correct: 0, total: 0 };
let isAnswered = false;
let isCorrect = false;
let selected = new Set();
let explanations = null;
let sessionAnswers = [];

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
  const correctPick = shuffle(allEquiv).slice(0, 3);
  const distractors = buildDistractors(side, region, dir);
  const distPick = distractors
    .filter((d) => !correctPick.includes(d))
    .slice(0, 2);
  return {
    given: side + ' ' + region + ' ' + dir,
    correctAnswers: new Set(correctPick.slice(0, 2)),
    options: shuffle(correctPick.slice(0, 2).concat(distPick)),
    equiv: equiv
  };
}

function generateQuestions() {
  const qs = [];
  SIDES.forEach((side) => {
    REGIONS.forEach((region) => {
      DIRS.forEach((dir) => {
        qs.push(buildQuestion(side, region, dir));
      });
    });
  });
  return shuffle(qs);
}

function getSessionSize() {
  const el = document.getElementById('equiv-count');
  return el.valueAsNumber || +el.defaultValue;
}

function resetSession() {
  questions = generateQuestions();
  qIdx = 0;
  score = { correct: 0, total: 0 };
  sessionAnswers = [];
  isAnswered = false;
  showQuizScreen();
  renderQuestion();
}

function showQuizScreen() {
  document.getElementById('tab-equivalence')
    .classList.remove('showing-results');
}

function showResultsScreen() {
  document.getElementById('tab-equivalence')
    .classList.add('showing-results');
}

const CLICK_DISPATCH = {
  'equiv-submit': handleSubmit,
  'equiv-restart': resetSession,
  'equiv-new-session': resetSession,
  'equiv-retake-missed': retakeMissed
};

async function loadExplanations() {
  try {
    const resp = await fetch(
      'data/equivalence-explanations.json'
    );
    if (!resp.ok) return;

    explanations = await resp.json();
  } catch (_) {
    // User sees chain + verdict, no explanation block
  }
}

export function initEquivalence() {
  loadExplanations();
  const section = document.getElementById(
    'tab-equivalence'
  );
  const wrap = document.getElementById(
    'equiv-quiz-wrap'
  );

  document.getElementById('equiv-count')
    .addEventListener('change', renderQuestion);

  section.addEventListener('click', (e) => {
    const opt = e.target.closest('.equiv-opt');
    if (opt) {
      handleOptionToggle(opt);
      return;
    }
    if (e.target.closest('.feedback-next')) {
      sessionAnswers.push({
        question: questions[qIdx],
        selected: [...selected],
        correct: isCorrect
      });
      score.total++;
      score.correct += +isCorrect;
      qIdx++;
      if (qIdx >= getSessionSize()) {
        renderResults();
      } else {
        renderQuestion();
      }
      return;
    }
    const target = e.target.closest('[id]');
    if (target && CLICK_DISPATCH[target.id]) {
      CLICK_DISPATCH[target.id]();
    }
  });

  section.addEventListener('keydown', (e) => {
    const opt = e.target.closest('.equiv-opt');
    if (!opt) return;

    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
  });

  resetSession();
}

function handleOptionToggle(opt) {
  if (isAnswered) return;

  const val = opt.dataset.opt;
  if (selected.has(val)) {
    selected.delete(val);
    opt.classList.remove('selected');
    opt.setAttribute('aria-checked', 'false');
  } else {
    selected.add(val);
    opt.classList.add('selected');
    opt.setAttribute('aria-checked', 'true');
  }
}

function renderQuestion() {
  document.getElementById('equiv-score')
    .textContent = 'Score: '
      + score.correct + ' / ' + score.total;

  const q = questions[qIdx];
  selected = new Set();
  isAnswered = false;

  const optItems = q.options.map((opt) =>
    `<div class="equiv-opt" data-opt="${opt}"
      role="checkbox" aria-checked="false"
      tabindex="0">${opt}</div>`
  ).join('');
  document.getElementById('equiv-quiz-wrap')
    .innerHTML = `<div class="card">
      <div class="card-label">Question
        ${qIdx + 1} of ${getSessionSize()}</div>
      <div class="equiv-given">${q.given}</div>
      <p class="equiv-instruction">Select all
        equivalent positions:</p>
      <div class="equiv-opts" id="equiv-options">
        ${optItems}</div>
      <div class="btn-row">
        <button class="btn primary"
          id="equiv-submit">Submit</button></div>
      <div id="equiv-feedback" class="hidden">
      </div>
    </div>`;
}

function handleSubmit() {
  if (isAnswered) return;

  isAnswered = true;
  const q = questions[qIdx];
  isCorrect = selected.size === q.correctAnswers.size
    && [...selected].every(
      (s) => q.correctAnswers.has(s)
    );

  const optEls = document.getElementById(
    'equiv-quiz-wrap'
  ).querySelectorAll('.equiv-opt');
  for (const optEl of optEls) {
    const val = optEl.dataset.opt;
    const isCorr = q.correctAnswers.has(val);
    const isSel = selected.has(val);
    if (isCorr && isSel) {
      optEl.classList.add('correct-reveal');
    } else if (isCorr && !isSel) {
      optEl.classList.add('missed');
    } else if (!isCorr && isSel) {
      optEl.classList.add('wrong-reveal');
    }
    optEl.classList.remove('selected');
  }

  const chainHTML = buildEquivChainHTML(q);
  const explHTML = buildExplanationHTML(q);
  const nextLabel = qIdx + 1 < getSessionSize()
    ? 'Next Question \u2192' : 'Finish Session';
  const feedback = document.getElementById(
    'equiv-feedback'
  );
  feedback.className = 'feedback-box'
    + (isCorrect ? '' : ' error');
  feedback.innerHTML = `<strong>${isCorrect ? 'Correct.' : 'Incorrect.'}</strong>
    ${chainHTML}${explHTML}
    <button class="btn primary feedback-next">
      ${nextLabel}</button>`;
}

function parsePosition(pos) {
  const parts = pos.split(' ');
  return {
    side: parts[0],
    region: parts[1].toLowerCase(),
    dir: parts[2].toLowerCase()
  };
}

function findLink(fromId, toId) {
  if (!explanations) return null;

  return explanations.links.find(
    (lk) => (lk.from === fromId && lk.to === toId)
      || (lk.from === toId && lk.to === fromId)
  ) || null;
}

function buildExplanationHTML(q) {
  if (!explanations) return '';

  const given = parsePosition(q.given);
  const region = explanations.regions[given.region];
  if (!region) return '';

  const dirInfo = region[given.dir];
  if (!dirInfo) return '';

  const side = q.given.split(' ')[0];
  const DIR = given.dir.toUpperCase();
  const REG = given.region.toUpperCase();
  const label = side + ' ' + region.name + ' ' + DIR
    + ' \u2014 ' + region.anatomicalName;

  const linkBlocks = [...q.correctAnswers].map(
    (answer) => {
      const ans = parsePosition(answer);
      const link = findLink(
        given.region, ans.region
      );
      if (!link) return '';

      const ANS_REG = ans.region.toUpperCase();
      const ANS_DIR = ans.dir.toUpperCase();
      return `<div class="equiv-expl-link">
        <div class="equiv-expl-label">Why ${REG} ${DIR} = ${ANS_REG} ${ANS_DIR}</div>
        <p>${link.priReasoning}</p>
        <div class="equiv-expl-note">Note \u2014 ${link.biomechanics}</div>
        <div class="equiv-expl-coupling">${link.couplingType}</div>
      </div>`;
    }
  ).join('');

  return `<div class="equiv-explanation">
    <div class="equiv-expl-region">
      <div class="equiv-expl-label">${label}</div>
      <p>${dirInfo.pri}</p>
      <div class="equiv-expl-note">Note \u2014 ${dirInfo.biomechanics}</div>
      <div class="equiv-expl-ref">${region.manualRef}</div>
    </div>
    ${linkBlocks}
    <div class="equiv-expl-note">Note \u2014 ${explanations.couplingDisclaimer}</div>
  </div>`;
}

function buildEquivChainHTML(q) {
  const shown = [q.given, ...q.correctAnswers];
  const lines = shown.map((pos, i) =>
    '<div class="equiv-line'
      + (i === 0 ? ' main' : '') + '">'
      + (i ? '= ' : '') + pos + '</div>'
  );
  const totalEquiv = Object.keys(q.equiv).length - 1;
  return '<div class="equiv-chain">'
    + '<div class="equiv-chain-label">'
      + 'TESTED EQUIVALENTS:</div>'
    + lines.join('')
    + '<div class="equiv-chain-note">'
      + 'Full equivalence chain has '
      + totalEquiv
      + ' positions \u2014 see Equivalence'
      + ' Chains for complete walkthrough.'
      + '</div>'
    + '</div>';
}

function renderResults() {
  showResultsScreen();
  const total = sessionAnswers.length;
  const correctCount = sessionAnswers
    .filter((a) => a.correct).length;
  const pct = total > 0
    ? Math.round((correctCount / total) * 100)
    : 0;

  let scoreClass = 'mq-score-green';
  if (pct < 60) scoreClass = 'mq-score-red';
  else if (pct < 80) scoreClass = 'mq-score-yellow';

  const resultScore = document.getElementById(
    'equiv-result-score'
  );
  resultScore.className = 'mq-results-score '
    + scoreClass;
  resultScore.textContent = 'Session Complete: '
    + correctCount + ' / ' + total
    + ' correct (' + pct + '%)';

  const incorrect = sessionAnswers
    .filter((a) => !a.correct);
  const correct = sessionAnswers
    .filter((a) => a.correct);

  renderResultsList(
    document.getElementById('equiv-incorrect-list'),
    incorrect
  );
  renderResultsList(
    document.getElementById('equiv-correct-list'),
    correct
  );

  document.getElementById('equiv-incorrect-section')
    .classList.toggle('hidden', incorrect.length === 0);
  document.getElementById('equiv-correct-section')
    .classList.toggle('hidden', correct.length === 0);

  if (incorrect.length > 0) {
    document.getElementById(
      'equiv-incorrect-details'
    ).open = true;
  }
  if (correct.length > 0) {
    document.getElementById(
      'equiv-correct-details'
    ).open = false;
  }

  document.getElementById('equiv-retake-missed')
    .classList.toggle(
      'hidden', incorrect.length === 0
    );
}

function renderResultsList(container, answers) {
  container.innerHTML = '';
  answers.forEach((a) => {
    const q = a.question;
    const row = document.createElement('div');
    row.className = 'mq-result-row';

    const summary = document.createElement('button');
    summary.type = 'button';
    summary.className = 'mq-result-summary';
    let summaryText = q.given;
    if (!a.correct) {
      const selText = a.selected.length
        ? a.selected.join(', ') : 'none';
      const corrText = [...q.correctAnswers].join(', ');
      summaryText += ' \u2014 You: ' + selText
        + ', Correct: ' + corrText;
    }
    summary.textContent = summaryText;

    const detail = document.createElement('div');
    detail.className = 'mq-result-detail hidden';

    const optHTML = q.options.map((opt) => {
      let cls = 'mq-result-opt';
      if (q.correctAnswers.has(opt)
        && a.selected.includes(opt)) {
        cls += ' correct';
      } else if (q.correctAnswers.has(opt)) {
        cls += ' missed';
      } else if (a.selected.includes(opt)) {
        cls += ' incorrect';
      }
      return '<div class="' + cls + '">'
        + opt + '</div>';
    }).join('');

    detail.innerHTML =
      '<div class="equiv-given">' + q.given + '</div>'
      + '<div class="mq-result-comparison">'
        + optHTML + '</div>'
      + buildEquivChainHTML(q)
      + buildExplanationHTML(q);

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
    .filter((a) => !a.correct)
    .map((a) => a.question);
  questions = shuffle(missed);
  qIdx = 0;
  score = { correct: 0, total: 0 };
  sessionAnswers = [];
  isAnswered = false;
  showQuizScreen();
  renderQuestion();
}
