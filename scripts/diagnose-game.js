import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {newEl} from './el-create.js';

const ROUND2_STEPS = [
  { key: 'repositioning',  label: 'Repositioning' },
  { key: 'postReposition', label: 'Post-Repositioning Program' },
  { key: 'facilitation',   label: 'Facilitation' }
];

let scenarios = [];
let gameState = {
  scenarioIdx: 0,
  round: 1,
  round2Step: 0,
  score: { correct: 0, total: 0 },
  isAnswered: false
};

const containerEl = document.getElementById('diagnose-game-content');
const gameBoard = document.getElementById('game-board');

gameBoard.addEventListener('click', handleClick);

function handleClick(e) {
  const answerBtn = e.target.closest('.answer-btn');
  if (answerBtn) {
    handleGameAnswer(gameBoard, answerBtn);
    return;
  }
  GAME_DISPATCH[e.target.id]?.();
}

function resetGame() {
  gameState = {
    scenarioIdx: 0, round: 1, round2Step: 0,
    score: { correct: 0, total: 0 },
    isAnswered: false, selectedOpts: new Set()
  };
  renderScenario(gameBoard);
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
  renderScenario(gameBoard);
}

function handleGameSubmit() {
  if (gameState.isAnswered) return;

  const s = scenarios[gameState.scenarioIdx];
  const q = s.round2[currentRound2Step().key];
  handleMultiSelectSubmit(gameBoard, q);
}

function renderScenario(gameBoard) {
  const s = scenarios[gameState.scenarioIdx];
  gameBoard.innerHTML = '';
  gameBoard.append(
    newEl('div', {
      className: 'scenario-header',
      textContent: scenarioHeaderText()
    }),
    newEl('div', {className: 'score-display', textContent: scoreText()})
  );

  if (gameState.round === 1) {
    renderRound1(gameBoard, s);
  } else {
    renderRound2(gameBoard, s);
  }
}

function renderRound1(gameBoard, s) {
  const card = document.createElement('div');
  card.className = 'card';

  const itemClass = { '+': 'positive', '−': 'negative' };
  let profileHTML = '<div class="card-label">'
    + 'Test Profile</div><div class="test-profile">';
  Object.entries(s.testProfile).forEach(
    ([test, val]) => {
      const cls = itemClass[val[0]] || '';
      profileHTML += '<div class="test-item">'
        + '<div class="test-item-name">'
        + expandAbbr(test) + '</div>'
        + '<div class="test-item-val ' + cls + '">'
        + expandAbbr(val) + '</div></div>';
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
  gameBoard.appendChild(card);
}

function renderRound2(gameBoard, s) {
  const step = currentRound2Step();
  const q = s.round2[step.key];
  if (!q) { renderGameComplete(); return; }

  gameState.selectedOpts = new Set();
  gameBoard.appendChild(newEl('div', {
    className: 'card',
    children: [
      newEl('div', {
        className: 'card-label',
        textContent: `Round 2 — Step ${gameState.round2Step + 1}/3: ${step.label}`
      }),
      newEl('p', {
        className: 'question-stem',
        innerHTML: expandAbbr(q.question)
      }),
      newEl('div', {
        className: 'answer-opts',
        children: q.options.map(opt => newEl('button', {
          className: 'answer-btn',
          textContent: opt
        }))
      }),
      isMultiSelect(q) ? newEl('button', {
        className: 'primary submit-gap',
        id: 'game-submit',
        textContent: 'Check Answer'
      }) : ''
    ]
  }));
  updateScoreDisplay(gameBoard);
}

function handleGameAnswer(gameBoard, btn) {
  if (gameState.isAnswered) return;
  if (btn.disabled) return;

  const s = scenarios[gameState.scenarioIdx];
  if (gameState.round === 1) {
    gradeAnswer(gameBoard, btn, s.correctPattern, s.explanation);
    return;
  }
  const q = s.round2[currentRound2Step().key];
  if (isMultiSelect(q)) {
    toggleSelection(btn, gameState.selectedOpts);
    return;
  }
  gradeAnswer(gameBoard, btn, q.correct, q.explanation);
}

function gradeAnswer(gameBoard, btn, correct, explanation) {
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
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  const verdict = isCorrect ? 'Correct.' : 'Incorrect.';
  fb.innerHTML = '<strong>' + verdict + '</strong> '
    + expandAbbr(explanation);
  card.appendChild(fb);

  updateScoreDisplay(gameBoard);
  appendNextButton(card);
}

function handleMultiSelectSubmit(gameBoard, question) {
  gameState.isAnswered = true;
  gameState.score.total++;
  const sel = gameState.selectedOpts;
  const correctSet = new Set(question.correct);
  const isCorrect = isMultiSelectionCorrect(correctSet, sel);
  if (isCorrect) gameState.score.correct++;

  const optWrap = gameBoard.querySelector('.answer-opts');
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

  updateScoreDisplay(gameBoard);
  appendNextButton(card);
}

function renderGameComplete() {
  gameBoard.innerHTML = `<div class="callout">
    <strong>Game complete.</strong>
    ${scoreText()}.
    <div class="btn-row">
      <button class="primary"
        id="game-restart">Restart</button>
    </div></div>`;
}

function appendNextButton(card) {
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  btnRow.innerHTML = '<button class="primary"'
    + ' id="game-next">Next →</button>';
  card.appendChild(btnRow);
}

function updateScoreDisplay(gameBoard) {
  const scoreEl = gameBoard.querySelector('.score-display');
  if (scoreEl) scoreEl.textContent = scoreText();
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

const isMultiSelect = q => Array.isArray(q.correct);

const isMultiSelectionCorrect = (correctSet, selected) =>
  selected.size === correctSet.size
  && selected.isSubsetOf(correctSet);

const scoreText = () =>
  `Score: ${gameState.score.correct} / ${gameState.score.total}`;

const scenarioHeaderText = () => `Scenario ${gameState.scenarioIdx + 1}`
  + ` of ${scenarios.length} — Round ${gameState.round}`;

const currentRound2Step = () => ROUND2_STEPS[gameState.round2Step];

const GAME_DISPATCH = {
  'game-restart': resetGame,
  'game-next': advanceGame,
  'game-submit': handleGameSubmit
};

await attemptLoad({
  loader: () => loadJson('./data/diagnose-game-scenarios.json'),
  container: containerEl,
  render: (data) => {
    scenarios = data;
    resetGame();
  }
});
