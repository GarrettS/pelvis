import {showFetchError} from './fetch-feedback.js';
import {getStudyData} from './study-data-cache.js';
import {shuffle} from './shuffle.js';
import {expandAbbr} from './abbr-expand.js';

let DATA = {};
let gameState = {
  scenarioIdx: 0,
  round: 1,
  round2Step: 0,
  score: { correct: 0, total: 0 },
  isAnswered: false
};
let caseState = {
  visitIdx: [], isAnswered: [],
  selectedTreatments: []
};

export async function initDiagnose() {
  DATA = await getStudyData();
  if (!DATA) {
    showFetchError('#tab-diagnose', 'study data');
    return;
  }
  initGame();
  buildCaseStudies();
  buildCausalChains();
  buildDecisionTree();
  buildMuscleMap();
}

function initGame() {
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
      < DATA.game.scenarios.length - 1;
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

    const s = DATA.game.scenarios[gameState.scenarioIdx];
    const q = s.round2[
      ['repositioning', 'postReposition',
        'facilitation'][gameState.round2Step]
    ];
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
  const s = DATA.game.scenarios[gameState.scenarioIdx];
  wrap.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'scenario-header';
  header.textContent = `Scenario ${gameState.scenarioIdx + 1} of ${DATA.game.scenarios.length} — Round ${gameState.round}`;

  const scoreEl = document.createElement('div');
  scoreEl.className = 'score-display';
  scoreEl.textContent = `Score: ${gameState.score.correct} / ${gameState.score.total}`;

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
      const isNeg = String(val).startsWith('\u2212')
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

function handleGameAnswer(wrap, btn) {
  if (gameState.isAnswered) return;
  if (btn.disabled) return;

  const s = DATA.game.scenarios[gameState.scenarioIdx];
  if (gameState.round === 1) {
    gradeAnswer(wrap, btn, s.correctPattern, s.explanation);
    return;
  }
  const step = ['repositioning', 'postReposition',
    'facilitation'][gameState.round2Step];
  const q = s.round2[step];
  if (Array.isArray(q.correct)) {
    const chosen = btn.textContent;
    if (gameState.selectedOpts.has(chosen)) {
      gameState.selectedOpts.delete(chosen);
      btn.classList.remove('selectedOpt');
    } else {
      gameState.selectedOpts.add(chosen);
      btn.classList.add('selectedOpt');
    }
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

  const scoreEl = wrap.querySelector('.score-display');
  if (scoreEl) {
    scoreEl.textContent = 'Score: '
      + gameState.score.correct + ' / '
      + gameState.score.total;
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  btnRow.innerHTML = '<button class="btn primary"'
    + ' id="game-next">Next \u2192</button>';
  card.appendChild(btnRow);
}


function renderRound2(wrap, s) {
  const r2 = s.round2;
  const steps = ['repositioning', 'postReposition', 'facilitation'];
  const stepLabels = ['Repositioning', 'Post-Repositioning Program', 'Facilitation'];
  const step = steps[gameState.round2Step];
  const q = r2[step];
  if (!q) { renderGameComplete(); return; }

  const card = document.createElement('div');
  card.className = 'card';

  const stepLabel = document.createElement('div');
  stepLabel.className = 'card-label';
  stepLabel.textContent = `Round 2 — Step ${gameState.round2Step + 1}/3: ${stepLabels[gameState.round2Step]}`;
  card.appendChild(stepLabel);

  const qText = document.createElement('p');
  qText.className = 'question-stem';
  qText.innerHTML = expandAbbr(q.question);
  card.appendChild(qText);

  const isMultiSelect = Array.isArray(q.correct);
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

  if (isMultiSelect) {
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn primary submit-gap';
    submitBtn.id = 'game-submit';
    submitBtn.textContent = 'Check Answer';
    card.appendChild(submitBtn);
  }

  wrap.appendChild(card);
  // Update score display
  const scoreEl = wrap.querySelector('.score-display');
  if (scoreEl) scoreEl.textContent = `Score: ${gameState.score.correct} / ${gameState.score.total}`;
}

function handleMultiSelectSubmit(wrap, question) {
  gameState.isAnswered = true;
  gameState.score.total++;
  const correctSet = new Set(question.correct);
  const sel = gameState.selectedOpts;
  const isCorrect = sel.size === correctSet.size
    && [...sel].every((o) => correctSet.has(o));
  if (isCorrect) gameState.score.correct++;

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

  const scoreEl = wrap.querySelector('.score-display');
  if (scoreEl) {
    scoreEl.textContent = 'Score: '
      + gameState.score.correct + ' / '
      + gameState.score.total;
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  btnRow.innerHTML = '<button class="btn primary"'
    + ' id="game-next">Next \u2192</button>';
  card.appendChild(btnRow);
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

function buildCaseStudies() {
  const wrap = document.getElementById('case-study-wrap');
  wrap.innerHTML = '';

  DATA.caseStudies.forEach((cs, ci) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3 class="case-title">${cs.title}</h3>`;
    const inner = document.createElement('div');
    inner.id = 'case-study-' + ci;
    div.appendChild(inner);
    wrap.appendChild(div);
    caseState.visitIdx[ci] = 0;
    caseState.isAnswered[ci] = false;
    caseState.selectedTreatments[ci] = new Set();
    renderCaseVisit(ci);
  });

  wrap.addEventListener('click', (e) => {
    const answerBtn = e.target.closest('.answer-btn');
    if (answerBtn) {
      handleCaseAnswer(answerBtn);
      return;
    }
    const id = e.target.id;
    if (id.startsWith('case-study-restart-')) {
      const ci = +id.split('-').pop();
      caseState.visitIdx[ci] = 0;
      caseState.isAnswered[ci] = false;
      renderCaseVisit(ci);
    } else if (id.startsWith('case-study-next-')) {
      const ci = +id.split('-').pop();
      caseState.visitIdx[ci]++;
      caseState.isAnswered[ci] = false;
      renderCaseVisit(ci);
    } else if (id.startsWith('case-study-submit-')) {
      const ci = +id.split('-').pop();
      gradeTreatment(ci);
    }
  });
}

function getCaseIndex(el) {
  const container = el.closest('[id^="case-study-"]');
  return +container.id.split('-').pop();
}

function renderCaseVisit(ci) {
  const cs = DATA.caseStudies[ci];
  const vi = caseState.visitIdx[ci];
  const container = document.getElementById(
    'case-study-' + ci
  );

  if (vi >= cs.visits.length) {
    container.innerHTML =
      `<div class="callout">
        <strong>Case complete.</strong>
        <div class="btn-row">
          <button class="btn"
            id="case-study-restart-${ci}">
            Restart Case</button>
        </div></div>`;
    return;
  }

  const visit = cs.visits[vi];
  const testHTML = visit.testResults
    ? '<div class="test-profile">'
      + Object.entries(visit.testResults).map(
        ([k, v]) => {
          const isPos = String(v).startsWith('+');
          const isNeg = String(v).startsWith('\u2212')
            || String(v).startsWith('-');
          const cls = isPos ? 'positive'
            : isNeg ? 'negative' : '';
          return '<div class="test-item">'
            + '<div class="test-item-name">'
            + expandAbbr(k) + '</div>'
            + '<div class="test-item-val '
            + cls + '">' + expandAbbr(String(v)) + '</div></div>';
        }
      ).join('') + '</div>'
    : '';

  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  (visit.options || []).forEach((opt) => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });

  container.innerHTML =
    `<div class="visit-badge">Visit ${visit.visit}</div>`
    + testHTML
    + '<p class="question-stem">' + expandAbbr(visit.question) + '</p>';
  container.appendChild(optWrap);
}

function handleCaseAnswer(btn) {
  const ci = getCaseIndex(btn);
  if (caseState.isAnswered[ci]) {
    handleTreatmentToggle(ci, btn);
    return;
  }
  if (btn.disabled) return;

  caseState.isAnswered[ci] = true;
  const cs = DATA.caseStudies[ci];
  const vi = caseState.visitIdx[ci];
  const visit = cs.visits[vi];

  const optWrap = btn.closest('.answer-opts');
  for (const b of optWrap.children) {
    if (b.textContent === visit.correct) {
      b.classList.add('correct');
    } else if (b === btn) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const isCorrect = btn.textContent === visit.correct;
  const container = document.getElementById(
    'case-study-' + ci
  );
  const fb = document.createElement('div');
  fb.className = 'feedback-box'
    + (isCorrect ? '' : ' error');
  fb.innerHTML = '<strong>'
    + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> ' + expandAbbr(visit.explanation);
  container.appendChild(fb);

  if (visit.treatmentQuestion && isCorrect) {
    renderTreatmentQuestion(ci, visit);
  } else {
    appendNextButton(ci, container);
  }
}

function renderTreatmentQuestion(ci, visit) {
  const container = document.getElementById(
    'case-study-' + ci
  );
  caseState.selectedTreatments[ci] = new Set();

  const treatmentDiv = document.createElement('div');
  treatmentDiv.className = 'treatment-subquestion';
  treatmentDiv.innerHTML =
    '<p class="question-stem">' + expandAbbr(visit.treatmentQuestion) + '</p>';

  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts treatment-opts';
  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  (visit.treatmentOptions || []).forEach((opt) => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });
  treatmentDiv.appendChild(optWrap);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn primary submit-gap';
  submitBtn.id = 'case-study-submit-' + ci;
  submitBtn.textContent = 'Check';
  treatmentDiv.appendChild(submitBtn);

  container.appendChild(treatmentDiv);
}

function handleTreatmentToggle(ci, btn) {
  if (!btn.closest('.treatment-opts')) return;
  if (btn.disabled) return;

  const sel = caseState.selectedTreatments[ci];
  const val = btn.textContent;
  if (sel.has(val)) {
    sel.delete(val);
    btn.classList.remove('selectedOpt');
  } else {
    sel.add(val);
    btn.classList.add('selectedOpt');
  }
}

function gradeTreatment(ci) {
  const cs = DATA.caseStudies[ci];
  const vi = caseState.visitIdx[ci];
  const visit = cs.visits[vi];
  const correctSet = new Set(
    visit.correctTreatment || []
  );
  const sel = caseState.selectedTreatments[ci];
  const isCorrect = sel.size === correctSet.size
    && [...sel].every((o) => correctSet.has(o));

  const container = document.getElementById(
    'case-study-' + ci
  );
  const optWrap = container.querySelector(
    '.treatment-opts'
  );
  for (const b of optWrap.children) {
    if (correctSet.has(b.textContent)) {
      b.classList.add('correct');
    } else if (sel.has(b.textContent)) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const fb = document.createElement('div');
  fb.className = 'feedback-box'
    + (isCorrect ? '' : ' error');
  fb.innerHTML = '<strong>'
    + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> '
    + expandAbbr(visit.treatmentExplanation || '');
  const treatmentDiv = container.querySelector(
    '.treatment-subquestion'
  );
  treatmentDiv.appendChild(fb);
  appendNextButton(ci, treatmentDiv);
}

function appendNextButton(ci, parent) {
  const cs = DATA.caseStudies[ci];
  const vi = caseState.visitIdx[ci];
  const hasMore = vi + 1 < cs.visits.length;
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.id = 'case-study-next-' + ci;
  btn.textContent = hasMore
    ? 'Next Visit (Visit ' + (vi + 2) + ') \u2192'
    : 'Case Complete';
  btnRow.appendChild(btn);
  parent.appendChild(btnRow);
}

function buildCausalChains() {
  const wrap = document.getElementById('chains-wrap');
  wrap.innerHTML = '';
  const chainState = [];

  DATA.causalChains.forEach((chain, ci) => {
    const steps = [...chain.steps];
    chainState[ci] = { steps, order: shuffle(steps) };
    wrap.appendChild(buildChainCard(chain, ci));
    renderChainList(ci, chainState[ci]);
    initChainDrag(ci, chainState[ci]);
  });

  wrap.addEventListener('click', (e) => {
    const id = e.target.id;
    if (id.startsWith('chain-check-')) {
      const ci = +id.split('-').pop();
      checkChainOrder(ci, chainState[ci]);
    } else if (id.startsWith('chain-reset-')) {
      const ci = +id.split('-').pop();
      chainState[ci].order = shuffle(
        chainState[ci].steps
      );
      renderChainList(ci, chainState[ci]);
      document.getElementById(
        'chain-feedback-' + ci
      ).innerHTML = '';
    }
  });
}

function buildChainCard(chain, ci) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML =
    '<h3 class="chain-title">'
      + expandAbbr(chain.title) + '</h3>'
    + '<div class="chain-subtitle">'
      + expandAbbr(chain.start) + ' \u2192 '
      + expandAbbr(chain.end) + '</div>'
    + '<ul class="chain-list" id="chain-'
      + ci + '"></ul>'
    + '<div class="btn-row">'
      + '<button class="btn primary"'
      + ' id="chain-check-' + ci
      + '">Check Order</button>'
      + '<button class="btn"'
      + ' id="chain-reset-' + ci
      + '">Reset</button></div>'
    + '<div class="feedback-gap"'
      + ' id="chain-feedback-' + ci
      + '"></div>';
  return div;
}

function renderChainList(ci, state) {
  const ul = document.getElementById('chain-' + ci);
  ul.innerHTML = '';
  const liTemplate = document.createElement('li');
  liTemplate.className = 'chain-item';
  liTemplate.setAttribute('draggable', 'true');
  state.order.forEach((step, i) => {
    const li = liTemplate.cloneNode(false);
    li.dataset.step = step;
    li.innerHTML =
      '<span class="chain-step-num">'
      + (i + 1) + '.</span>'
      + '<span>' + expandAbbr(step) + '</span>';
    ul.appendChild(li);
  });
}

function initChainDrag(ci, state) {
  const ul = document.getElementById('chain-' + ci);
  let activeDragItem = null;

  ul.addEventListener('dragstart', (e) => {
    activeDragItem = e.target;
    activeDragItem.classList.add('dragging');
  });
  ul.addEventListener('dragend', () => {
    activeDragItem?.classList.remove('dragging');
    activeDragItem = null;
  });
  ul.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!activeDragItem) return;

    let insertBeforeItem = null;
    for (const sibling of ul.children) {
      if (sibling === activeDragItem) continue;
      const box = sibling.getBoundingClientRect();
      if (e.clientY <= box.top + box.height / 2) {
        insertBeforeItem = sibling;
        break;
      }
    }
    if (insertBeforeItem) {
      ul.insertBefore(
        activeDragItem, insertBeforeItem
      );
    } else {
      ul.appendChild(activeDragItem);
    }
    state.order = Array.from(
      ul.children, (li) => li.dataset.step
    );
  });
}

function checkChainOrder(ci, state) {
  const ul = document.getElementById('chain-' + ci);
  let allCorrect = true;
  for (let i = 0; i < ul.children.length; i++) {
    const li = ul.children[i];
    const isCorrect = li.dataset.step
      === state.steps[i];
    li.classList.toggle('correct', isCorrect);
    li.classList.toggle('incorrect', !isCorrect);
    if (!isCorrect) allCorrect = false;
  }
  const feedbackEl = document.getElementById(
    'chain-feedback-' + ci
  );
  feedbackEl.innerHTML = allCorrect
    ? '<div class="feedback-box">'
      + 'Correct order.</div>'
    : '<div class="feedback-box error">'
      + 'Not quite. Correct order:'
      + ' <ol class="chain-correct-list">'
      + state.steps.map(
        (s) => '<li>' + expandAbbr(s) + '</li>'
      ).join('') + '</ol></div>';
}

function buildDecisionTree() {
  const wrap = document.getElementById('tree-wrap');
  wrap.innerHTML = '';
  renderTreeNode(DATA.decisionTree, wrap);

  wrap.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-answer-toggle');
    if (!toggle) return;

    toggleTreeBranch(toggle);
  });
}

function toggleTreeBranch(toggle) {
  const children = toggle.nextElementSibling;
  const isOpen = children.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
  toggle.textContent = (isOpen ? '\u25BC ' : '\u25B6 ')
    + toggle.dataset.answer;
}

function renderTreeNode(node, parent) {
  if (!node) return;

  if (node.terminal) {
    const el = document.createElement('div');
    el.className = 'tree-terminal';
    el.innerHTML = expandAbbr(annotateOutOfScope(node.content || ''));
    parent.appendChild(el);
    return;
  }
  const qEl = document.createElement('div');
  qEl.className = 'tree-question';
  qEl.innerHTML = expandAbbr(node.question || node.id);
  parent.appendChild(qEl);

  if (!node.branches) return;

  node.branches.forEach((branch) => {
    const branchWrap = document.createElement('div');
    branchWrap.className = 'tree-branch';
    const toggle = document.createElement('button');
    toggle.className = 'tree-answer-toggle';
    toggle.dataset.answer = branch.answer;
    toggle.textContent = '\u25B6 ' + branch.answer;
    const children = document.createElement('div');
    children.className = 'tree-children';
    branchWrap.appendChild(toggle);
    renderTreeNode(branch.next, children);
    branchWrap.appendChild(children);
    parent.appendChild(branchWrap);
  });
}

function annotateOutOfScope(content) {
  if (!content.includes('Myokinematic Restoration')) {
    return content;
  }

  const OOS = ' (out of scope for this course)';
  return content
    .replace(
      'Myokinematic Restoration'
        + ' & Postural Respiration',
      'Myokinematic Restoration'
        + ' & Postural Respiration' + OOS
    )
    .replace(
      'Myokinematic Restoration.',
      'Myokinematic Restoration' + OOS + '.'
    )
    .replace(
      'Myokinematic Restoration\u2014',
      'Myokinematic Restoration' + OOS + ' \u2014'
    )
    .replace(
      'Myokinematic Restoration \u2014',
      'Myokinematic Restoration' + OOS + ' \u2014'
    );
}

function buildMuscleMap() {
  let currentMView = 'byMuscle';
  let activeTab = document.querySelector('#muscle-view-tabs .subview-tab.active');

  document.getElementById('muscle-view-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.subview-tab');
    if (!tab) return;

    activeTab?.classList.remove('active');
    tab.classList.add('active');
    activeTab = tab;
    currentMView = tab.dataset.mview;
    renderMuscleView(currentMView, '');
  });

  const search = document.getElementById('muscle-search');
  search.addEventListener('input', () =>
    renderMuscleView(currentMView, search.value.toLowerCase())
  );
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
  renderMuscleView('byMuscle', '');
}

function renderMuscleView(view, query) {
  const wrap = document.getElementById('muscle-map-wrap');
  const entries = DATA.muscleExerciseMap[view] || [];
  wrap.innerHTML = '';
  entries.forEach(entry => {
    const nameKey = entry.muscle || entry.finding || '';
    if (query && !JSON.stringify(entry).toLowerCase().includes(query)) return;
    const div = document.createElement('div');
    div.className = 'muscle-entry';
    const exercises = (entry.exercises || []).map(e => `<span class="exercise-tag">${e}</span>`).join('');
    const meta = entry.action || entry.meaning || '';
    const patternLine = entry.pattern
      ? '<div class="muscle-meta">Pattern: '
        + expandAbbr(entry.pattern) + '</div>'
      : '';
    const hierarchyLine = entry.hierarchyStep
      ? '<div class="muscle-meta">Hierarchy: '
        + expandAbbr(entry.hierarchyStep) + '</div>'
      : '';
    const musclesLine = entry.muscles
      ? '<div class="muscle-meta">Muscles: '
        + expandAbbr(entry.muscles) + '</div>'
      : '';
    div.innerHTML =
      '<div class="muscle-name">'
        + expandAbbr(nameKey) + '</div>'
      + '<div class="muscle-meta">'
        + expandAbbr(meta) + '</div>'
      + patternLine + hierarchyLine + musclesLine
      + '<div class="exercise-tags">'
        + exercises + '</div>';
    wrap.appendChild(div);
  });
  if (!wrap.children.length) wrap.innerHTML = '<div class="empty-message">No entries match.</div>';
}
