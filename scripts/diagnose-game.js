import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {newEl} from './el-create.js';
import {testProfileEl} from './test-profile.js';
import {answerFieldsetEl, checkboxFieldsetEl} from './quiz-form.js';

const ROUND2_STEPS = [
  { key: 'repositioning',  label: 'Repositioning' },
  { key: 'postReposition', label: 'Post-Repositioning Program' },
  { key: 'facilitation',   label: 'Facilitation' }
];

const PATTERNS = ['Left AIC', 'Bilateral PEC', 'Bilateral Patho PEC'];
const OPTIONS_ID = 'game-options';

let scenarios = [];
let gameState = {
  scenarioIdx: 0,
  round: 1,
  round2Step: 0,
  score: { correct: 0, total: 0 }
};

const containerEl = document.getElementById('diagnose-game-content');
const gameBoard = document.getElementById('game-board');

const handleSubmit = e => {
  e.preventDefault();
  const grade = e.submitter.matches('.answer-btn') ? gradeSingleSelect : gradeMultiSelect;
  grade(e.target, e.submitter, currentExplanation());
};

gameBoard.addEventListener('click', ({target}) => GAME_DISPATCH[target.id]?.());
gameBoard.addEventListener('submit', handleSubmit);

function resetGame() {
  gameState = {
    scenarioIdx: 0, round: 1, round2Step: 0,
    score: { correct: 0, total: 0 }
  };
  renderScenario();
}

function advanceGame() {
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
  renderScenario();
}

const renderScenario = () => gameBoard.replaceChildren(
  newEl('div', {className: 'scenario-header', textContent: scenarioHeaderText()}),
  newEl('div', {className: 'score-display', textContent: scoreText()}),
  (gameState.round === 1 ? renderRound1 : renderRound2)(scenarios[gameState.scenarioIdx])
);

const renderRound1 = s => newEl('div', {
  className: 'card',
  children: [
    newEl('div', {className: 'card-label', textContent: 'Test Profile'}),
    testProfileEl(s.testProfile),
    singleSelectFormEl(PATTERNS, s.correctPattern)
  ]
});

const renderRound2 = s => {
  const step = currentRound2Step();
  const q = s.round2[step.key];
  return newEl('div', {
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
      isMultiSelect(q) ? multiSelectFormEl(q) : singleSelectFormEl(q.options, q.correct)
    ]
  });
};

const singleSelectFormEl = (options, correct) => newEl('form', {
  children: [answerFieldsetEl(options, correct)]
});

const multiSelectFormEl = q => newEl('form', {
  children: [
    checkboxFieldsetEl(q.options, new Set(q.correct), {id: OPTIONS_ID}),
    newEl('button', {
      type: 'submit',
      className: 'primary submit-gap',
      textContent: 'Check Answer'
    })
  ]
});

function gradeSingleSelect(form, submitter, explanation) {
  submitter.dataset.picked = '';
  const isCorrect = submitter.hasAttribute('data-correct');
  finalizeGrade(form.querySelector('fieldset'), isCorrect, explanation);
}

function gradeMultiSelect(form, submitter, explanation) {
  const fieldset = form.querySelector('fieldset');
  const isCorrect = !fieldset.querySelector(
    'input[data-correct]:not(:checked), input:checked:not([data-correct])'
  );
  submitter.hidden = true;
  finalizeGrade(fieldset, isCorrect, explanation);
}

function finalizeGrade(fieldset, isCorrect, explanation) {
  gameState.score.total++;
  if (isCorrect) gameState.score.correct++;
  fieldset.dataset.answered = fieldset.disabled = true;
  fieldset.closest('.card').append(feedbackBox(isCorrect, explanation), nextButtonRow());
  updateScoreDisplay();
}

const renderGameComplete = () => gameBoard.replaceChildren(newEl('div', {
  className: 'callout',
  children: [
    newEl('strong', {textContent: 'Game complete.'}),
    ` ${scoreText()}.`,
    newEl('div', {
      className: 'btn-row',
      children: [newEl('button', {
        type: 'button',
        className: 'primary',
        id: 'game-restart',
        textContent: 'Restart'
      })]
    })
  ]
}));

const feedbackBox = (isCorrect, explanation) => newEl('div', {
  className: 'feedback-box' + (isCorrect ? '' : ' error'),
  innerHTML: '<strong>' + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> ' + expandAbbr(explanation)
});

const nextButtonRow = () => newEl('div', {
  className: 'btn-row',
  children: [newEl('button', {
    type: 'button',
    className: 'primary',
    id: 'game-next',
    textContent: 'Next →'
  })]
});

const updateScoreDisplay = () =>
  gameBoard.querySelector('.score-display').textContent = scoreText();

const isMultiSelect = q => Array.isArray(q.correct);

const scoreText = () =>
  `Score: ${gameState.score.correct} / ${gameState.score.total}`;

const scenarioHeaderText = () => `Scenario ${gameState.scenarioIdx + 1}`
  + ` of ${scenarios.length} — Round ${gameState.round}`;

const currentRound2Step = () => ROUND2_STEPS[gameState.round2Step];

const currentExplanation = () => {
  const s = scenarios[gameState.scenarioIdx];
  return gameState.round === 1
    ? s.explanation
    : s.round2[currentRound2Step().key].explanation;
};

const GAME_DISPATCH = {
  'game-restart': resetGame,
  'game-next': advanceGame
};

await attemptLoad({
  loader: () => loadJson('./data/diagnose-game-scenarios.json'),
  container: containerEl,
  render: (data) => {
    scenarios = data;
    resetGame();
  }
});
