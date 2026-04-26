import {getGameScenarios} from './study-data-cache.js';
import {expandAbbr} from './abbr-expand.js';

const ROUND2_STEPS = [
  { key: 'repositioning',  label: 'Repositioning' },
  { key: 'postReposition', label: 'Post-Repositioning Program' },
  { key: 'facilitation',   label: 'Facilitation' }
];

const currentRound2Step = () => ROUND2_STEPS[gameState.round2Step];

let scenarios = [];
let gameState = {
  scenarioIdx: 0,
  round: 1,
  round2Step: 0,
  score: { correct: 0, total: 0 },
  isAnswered: false
};

export async function setupGame() {
  scenarios = await getGameScenarios();

  const wrap = document.getElementById('game-wrap');

  function resetGame() {
    gameState = {
      scenarioIdx: 0, round: 1, round2Step: 0,
      score: { correct: 0, total: 0 },
      isAnswered: false, selectedOpts: new Set()
    };
    renderScenario(wrap);
  }

  function advanceGame() {
    gameState.isAnswered = false;
    const hasMoreSteps = gameState.round2Step < 2;
    const hasMoreScenarios = gameState.scenarioIdx
      < scenarios.length - 1;
    if (gameState.round === 1) {
      gameState.round = 2;
      gameState.round2Step = 0;
    } else if (hasMoreSteps) {
      gameState.round2Step++;
    } else if (hasMoreScenarios) {
      gameState.scenarioIdx++;
      gameState.round = 1;
      gameState.round2Step = 0;
    } else {
      renderGameComplete();
      return;
    }
    renderScenario(wrap);
  }

  function handleGameSubmit() {
    if (gameState.isAnswered) return;

    const s = scenarios[gameState.scenarioIdx];
    const q = s.round2[currentRound2Step().key];
    handleMultiSelectSubmit(wrap, q);
  }

  const GAME_DISPATCH = {
    'game-restart': resetGame,
    'game-next': advanceGame,
    'game-submit': handleGameSubmit
  };

  wrap.addEventListener('click', (e) => {
    const answerBtn = e.target.closest('.answer-btn');
    if (answerBtn) {
      handleGameAnswer(wrap, answerBtn);
      return;
    }
    GAME_DISPATCH[e.target.id]?.();
  });

  resetGame();
}

function renderScenario(wrap) {
  const s = scenarios[gameState.scenarioIdx];
  wrap.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'scenario-header';
  header.textContent = `Scenario ${gameState.scenarioIdx + 1} of ${scenarios.length} — Round ${gameState.round}`;

  const scoreEl = document.createElement('div');
  scoreEl.className = 'score-display';
  scoreEl.textContent = scoreText();

  wrap.appendChild(header);
  wrap.appendChild(scoreEl);

  if (gameState.round === 1) {
    renderRound1(wrap, s);
  } else {
    renderRound2(wrap, s);
  }
}

function renderRound1(wrap, s) {
  const card = document.createElement('div');
  card.className = 'card';

  let profileHTML = '<div class="card-label">'
    + 'Test Profile</div><div class="test-profile">';
  Object.entries(s.testProfile).forEach(
    ([test, val]) => {
      const isPos = String(val).startsWith('+');
      const isNeg = String(val).startsWith('−')
        || String(val).startsWith('-');
      const cls = isPos ? 'positive'
        : isNeg ? 'negative' : '';
      profileHTML += '<div class="test-item">'
        + '<div class="test-item-name">'
        + expandAbbr(test) + '</div>'
        + '<div class="test-item-val ' + cls + '">'
        + expandAbbr(String(val)) + '</div></div>';
    }
  );
  profileHTML += '</div>';
  card.innerHTML = profileHTML;

  const patterns = [
    'Left AIC', 'Bilateral PEC',
    'Bilateral Patho PEC'
  ];
  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  patterns.forEach((p) => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = p;
    optWrap.appendChild(btn);
  });
  card.appendChild(optWrap);
  wrap.appendChild(card);
}

const scoreText = () =>
  `Score: ${gameState.score.correct} / ${gameState.score.total}`;

function updateScoreDisplay(wrap) {
  const scoreEl = wrap.querySelector('.score-display');
  if (scoreEl) scoreEl.textContent = scoreText();
}

function isMultiSelect(q) {
  return Array.isArray(q.correct);
}

function isMultiSelectionCorrect(q, selected) {
  const correctSet = new Set(q.correct);
  return selected.size === correctSet.size
    && [...selected].every((o) => correctSet.has(o));
}

function toggleSelection(btn, selected) {
  const chosen = btn.textContent;
  if (selected.has(chosen)) {
    selected.delete(chosen);
    btn.classList.remove('selectedOpt');
  } else {
    selected.add(chosen);
    btn.classList.add('selectedOpt');
  }
}

function handleGameAnswer(wrap, btn) {
  if (gameState.isAnswered) return;
  if (btn.disabled) return;

  const s = scenarios[gameState.scenarioIdx];
  if (gameState.round === 1) {
    gradeAnswer(wrap, btn, s.correctPattern, s.explanation);
    return;
  }
  const q = s.round2[currentRound2Step().key];
  if (isMultiSelect(q)) {
    toggleSelection(btn, gameState.selectedOpts);
    return;
  }
  gradeAnswer(wrap, btn, q.correct, q.explanation);
}

function gradeAnswer(wrap, btn, correct, explanation) {
  gameState.isAnswered = true;
  gameState.score.total++;
  const chosen = btn.textContent;
  const isCorrect = chosen === correct;
  if (isCorrect) gameState.score.correct++;

  const optWrap = btn.closest('.answer-opts');
  for (const b of optWrap.children) {
    if (b.textContent === correct) b.classList.add('correct');
    else if (b === btn && !isCorrect) b.classList.add('incorrect');
    b.disabled = true;
  }

  const card = btn.closest('.card');
  const fb = document.createElement('div');
  fb.className = 'feedback-box'
    + (isCorrect ? '' : ' error');
  const verdict = isCorrect ? 'Correct.' : 'Incorrect.';
  fb.innerHTML = '<strong>' + verdict + '</strong> '
    + expandAbbr(explanation);
  card.appendChild(fb);

  updateScoreDisplay(wrap);
  appendNextButton(card);
}

function renderRound2(wrap, s) {
  const step = currentRound2Step();
  const q = s.round2[step.key];
  if (!q) { renderGameComplete(); return; }

  const card = document.createElement('div');
  card.className = 'card';

  const stepLabel = document.createElement('div');
  stepLabel.className = 'card-label';
  stepLabel.textContent = `Round 2 — Step ${gameState.round2Step + 1}/3: ${step.label}`;
  card.appendChild(stepLabel);

  const qText = document.createElement('p');
  qText.className = 'question-stem';
  qText.innerHTML = expandAbbr(q.question);
  card.appendChild(qText);

  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  gameState.selectedOpts = new Set();
  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  q.options.forEach((opt) => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });
  card.appendChild(optWrap);

  if (isMultiSelect(q)) {
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn primary submit-gap';
    submitBtn.id = 'game-submit';
    submitBtn.textContent = 'Check Answer';
    card.appendChild(submitBtn);
  }

  wrap.appendChild(card);
  updateScoreDisplay(wrap);
}

function appendNextButton(card) {
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  btnRow.innerHTML = '<button class="btn primary"'
    + ' id="game-next">Next →</button>';
  card.appendChild(btnRow);
}

function handleMultiSelectSubmit(wrap, question) {
  gameState.isAnswered = true;
  gameState.score.total++;
  const sel = gameState.selectedOpts;
  const isCorrect = isMultiSelectionCorrect(question, sel);
  if (isCorrect) gameState.score.correct++;

  const correctSet = new Set(question.correct);
  const optWrap = wrap.querySelector('.answer-opts');
  for (const b of optWrap.children) {
    if (correctSet.has(b.textContent)) {
      b.classList.add('correct');
    } else if (sel.has(b.textContent)) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const card = optWrap.closest('.card');
  const fb = document.createElement('div');
  fb.className = 'feedback-box'
    + (isCorrect ? '' : ' error');
  const verdict = isCorrect ? 'Correct.' : 'Incorrect.';
  fb.innerHTML = '<strong>' + verdict + '</strong> '
    + expandAbbr(question.explanation);
  card.appendChild(fb);

  updateScoreDisplay(wrap);
  appendNextButton(card);
}

function renderGameComplete() {
  const wrap = document.getElementById('game-wrap');
  wrap.innerHTML = `<div class="callout">
    <strong>Game complete.</strong>
    Final score: ${gameState.score.correct}
    / ${gameState.score.total}.
    <div class="btn-row">
      <button class="btn primary"
        id="game-restart">Restart</button>
    </div></div>`;
}
