import {showFetchError} from "./load-errors.js";
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
export async function init() {
  const container = document.getElementById('diagnose-content');
  if (!container) return;

  try {
    DATA = await getStudyData();
  } catch (cause) {
    showFetchError(container, 'study-data.json', cause);
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

const CaseStudyFactory = (() => {
  const instances = {};
  const KEY = Symbol();

  class CaseStudy {
    #id;
    #visits;
    #visitIdx = 0;
    #isAnswered = false;
    #selectedTreatments = new Set();

    constructor(id, definition, key) {
      if (key !== KEY) throw new Error(
        'CaseStudy: use CaseStudyFactory.getInstance()'
      );
      this.#id = id;
      this.#visits = Object.freeze([...definition.visits]);
    }

    get id() { return this.#id; }
    currentVisit() { return this.#visits[this.#visitIdx]; }
    isComplete() { return this.#visitIdx >= this.#visits.length; }
    hasMoreVisits() { return this.#visitIdx + 1 < this.#visits.length; }
    isAnswered() { return this.#isAnswered; }
    visitNumber() { return this.#visitIdx + 1; }
    selectedTreatments() { return new Set(this.#selectedTreatments); }

    advanceVisit() {
      this.#visitIdx++;
      this.#isAnswered = false;
      this.#selectedTreatments.clear();
    }

    markAnswered() {
      this.#isAnswered = true;
    }

    toggleTreatment(option) {
      if (this.#selectedTreatments.has(option)) {
        this.#selectedTreatments.delete(option);
        return false;
      }
      this.#selectedTreatments.add(option);
      return true;
    }

    isAnswerCorrect(text) {
      return text === this.currentVisit().correct;
    }

    isTreatmentCorrect() {
      const correctSet = new Set(this.currentVisit().correctTreatment || []);
      return this.#selectedTreatments.size === correctSet.size
        && [...this.#selectedTreatments].every(o => correctSet.has(o));
    }
  }

  return {
    getInstance(elOrId, definition) {
      const id = elOrId.id || elOrId;
      if (!instances[id]) {
        const def = definition ?? DATA.caseStudies[id];
        if (!def) throw new Error(
          'CaseStudyFactory: no definition for "' + id + '"'
        );
        instances[id] = new CaseStudy(id, def, KEY);
      }
      return instances[id];
    },
    discard(id) {
      delete instances[id];
    },
    discardAll() {
      for (const k in instances) delete instances[k];
    }
  };
})();

function buildCaseStudies() {
  const wrap = document.getElementById('case-study-wrap');
  wrap.innerHTML = '';
  CaseStudyFactory.discardAll();

  Object.entries(DATA.caseStudies).forEach(([id, definition]) => {
    const caseStudy = CaseStudyFactory.getInstance(id, definition);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3 class="case-title">${definition.title}</h3>`;
    const caseEl = document.createElement('div');
    caseEl.className = 'case-study';
    caseEl.id = id;
    card.appendChild(caseEl);
    wrap.appendChild(card);
    renderCaseVisit(caseStudy, caseEl);
  });

  wrap.addEventListener('click', e => {
    const answerBtn = e.target.closest('.answer-btn');
    if (answerBtn) {
      handleAnswerClick(answerBtn);
      return;
    }
    const caseEl = e.target.closest('.case-study');
    if (!caseEl) return;

    if (e.target.closest('.case-restart')) {
      CaseStudyFactory.discard(caseEl.id);
      renderCaseVisit(CaseStudyFactory.getInstance(caseEl), caseEl);
    } else if (e.target.closest('.case-next')) {
      const caseStudy = CaseStudyFactory.getInstance(caseEl);
      caseStudy.advanceVisit();
      renderCaseVisit(caseStudy, caseEl);
    } else if (e.target.closest('.case-submit')) {
      showTreatmentResult(CaseStudyFactory.getInstance(caseEl), caseEl);
    }
  });
}

function handleAnswerClick(btn) {
  const caseEl = btn.closest('.case-study');
  if (!caseEl) return;

  const caseStudy = CaseStudyFactory.getInstance(caseEl);
  if (caseStudy.isAnswered()) {
    handleTreatmentToggle(caseStudy, btn);
    return;
  }
  if (btn.disabled) return;

  caseStudy.markAnswered();
  const visit = caseStudy.currentVisit();

  const optWrap = btn.closest('.answer-opts');
  for (const b of optWrap.children) {
    if (b.textContent === visit.correct) {
      b.classList.add('correct');
    } else if (b === btn) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const isCorrect = caseStudy.isAnswerCorrect(btn.textContent);
  const fb = document.createElement('div');
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  fb.innerHTML = '<strong>'
    + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> ' + expandAbbr(visit.explanation);
  caseEl.appendChild(fb);

  if (visit.treatmentQuestion && isCorrect) {
    renderTreatmentQuestion(caseStudy, caseEl);
  } else {
    appendNextButton(caseStudy, caseEl);
  }
}

function handleTreatmentToggle(caseStudy, btn) {
  if (!btn.closest('.treatment-opts')) return;
  if (btn.disabled) return;

  const isNowSelected = caseStudy.toggleTreatment(btn.textContent);
  btn.classList.toggle('selectedOpt', isNowSelected);
}

function renderCaseVisit(caseStudy, caseEl) {
  if (caseStudy.isComplete()) {
    caseEl.innerHTML =
      `<div class="callout">
        <strong>Case complete.</strong>
        <div class="btn-row">
          <button class="btn case-restart">Restart Case</button>
        </div></div>`;
    return;
  }

  const visit = caseStudy.currentVisit();
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
  (visit.options || []).forEach(opt => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });

  caseEl.innerHTML =
    `<div class="visit-badge">Visit ${visit.visit}</div>`
    + testHTML
    + '<p class="question-stem">' + expandAbbr(visit.question) + '</p>';
  caseEl.appendChild(optWrap);
}

function renderTreatmentQuestion(caseStudy, caseEl) {
  const visit = caseStudy.currentVisit();

  const treatmentDiv = document.createElement('div');
  treatmentDiv.className = 'treatment-subquestion';
  treatmentDiv.innerHTML =
    '<p class="question-stem">' + expandAbbr(visit.treatmentQuestion) + '</p>';

  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts treatment-opts';
  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  (visit.treatmentOptions || []).forEach(opt => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });
  treatmentDiv.appendChild(optWrap);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn primary submit-gap case-submit';
  submitBtn.textContent = 'Check';
  treatmentDiv.appendChild(submitBtn);

  caseEl.appendChild(treatmentDiv);
}

function showTreatmentResult(caseStudy, caseEl) {
  const submitBtn = caseEl.querySelector('.case-submit');
  if (!submitBtn || submitBtn.disabled) return;
  submitBtn.disabled = true;

  const visit = caseStudy.currentVisit();
  const isCorrect = caseStudy.isTreatmentCorrect();
  const correctSet = new Set(visit.correctTreatment || []);
  const selected = caseStudy.selectedTreatments();

  const optWrap = caseEl.querySelector('.treatment-opts');
  for (const b of optWrap.children) {
    if (correctSet.has(b.textContent)) {
      b.classList.add('correct');
    } else if (selected.has(b.textContent)) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const fb = document.createElement('div');
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  fb.innerHTML = '<strong>'
    + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> '
    + expandAbbr(visit.treatmentExplanation || '');
  const treatmentDiv = caseEl.querySelector('.treatment-subquestion');
  treatmentDiv.appendChild(fb);
  appendNextButton(caseStudy, treatmentDiv);
}

function appendNextButton(caseStudy, parent) {
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const btn = document.createElement('button');
  btn.className = 'btn primary case-next';
  btn.textContent = caseStudy.hasMoreVisits()
    ? 'Next Visit (Visit ' + (caseStudy.visitNumber() + 1) + ') \u2192'
    : 'Case Complete';
  btnRow.appendChild(btn);
  parent.appendChild(btnRow);
}

const CausalChainFactory = (() => {
  const instances = {};
  const KEY = Symbol();

  class CausalChain {
    #id;
    #steps;
    #order;
    #activeDragItem = null;

    constructor(id, definition, key) {
      if (key !== KEY) throw new Error(
        'CausalChain: use CausalChainFactory.getInstance()'
      );
      this.#id = id;
      this.#steps = Object.freeze([...definition.steps]);
      this.#order = shuffle([...definition.steps]);
    }

    get id() { return this.#id; }
    currentOrder() { return this.#order.slice(); }
    correctOrder() { return this.#steps; }

    startDrag(chainItem) {
      this.#activeDragItem = chainItem;
      chainItem.classList.add('dragging');
    }

    endDrag() {
      this.#activeDragItem?.classList.remove('dragging');
      this.#activeDragItem = null;
    }

    reorderToward(y, chainList) {
      if (!this.#activeDragItem) return;

      let insertBefore = null;
      for (const sibling of chainList.children) {
        if (sibling === this.#activeDragItem) continue;
        const box = sibling.getBoundingClientRect();
        if (y <= box.top + box.height / 2) {
          insertBefore = sibling;
          break;
        }
      }
      chainList.insertBefore(this.#activeDragItem, insertBefore);
      this.#order = Array.from(
        chainList.children, item => item.dataset.step
      );
    }

    checkOrder() {
      return this.#order.map((step, i) => ({
        step,
        isCorrect: step === this.#steps[i]
      }));
    }
  }

  return {
    getInstance(elOrId, definition) {
      const id = elOrId.id || elOrId;
      if (!instances[id]) {
        const def = definition ?? DATA.causalChains[id];
        if (!def) throw new Error(
          'CausalChainFactory: no definition for "' + id + '"'
        );
        instances[id] = new CausalChain(id, def, KEY);
      }
      return instances[id];
    },
    discard(id) {
      delete instances[id];
    },
    discardAll() {
      for (const k in instances) delete instances[k];
    }
  };
})();

function buildCausalChains() {
  const wrap = document.getElementById('chains-wrap');
  wrap.innerHTML = '';
  CausalChainFactory.discardAll();

  Object.entries(DATA.causalChains).forEach(([id, definition]) => {
    const chain = CausalChainFactory.getInstance(id, definition);
    wrap.appendChild(buildChainCard(id, definition));
    renderChainList(chain);
  });

  wrap.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;

    const chainList = card.querySelector('.chain-list');
    if (!chainList) return;

    if (e.target.closest('.chain-reset')) {
      CausalChainFactory.discard(chainList.id);
      renderChainList(CausalChainFactory.getInstance(chainList));
      card.querySelector('.chain-feedback').innerHTML = '';
    } else if (e.target.closest('.chain-check')) {
      showCheckResult(CausalChainFactory.getInstance(chainList), chainList);
    }
  });

  wrap.addEventListener('dragstart', e => {
    const chainItem = e.target.closest('.chain-list > li');
    if (!chainItem) return;

    CausalChainFactory
      .getInstance(chainItem.closest('.chain-list'))
      .startDrag(chainItem);
  });

  wrap.addEventListener('dragend', e => {
    const chainItem = e.target.closest('.chain-list > li');
    if (!chainItem) return;

    CausalChainFactory
      .getInstance(chainItem.closest('.chain-list'))
      .endDrag();
  });

  wrap.addEventListener('dragover', e => {
    e.preventDefault();
    const chainList = e.target.closest('.chain-list');
    if (!chainList) return;

    CausalChainFactory
      .getInstance(chainList)
      .reorderToward(e.clientY, chainList);
  });
}

function buildChainCard(id, definition) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML =
    '<h3 class="chain-title">'
      + expandAbbr(definition.title) + '</h3>'
    + '<div class="chain-subtitle">'
      + expandAbbr(definition.start) + ' \u2192 '
      + expandAbbr(definition.end) + '</div>'
    + '<ol class="chain-list" id="'
      + id + '"></ol>'
    + '<div class="btn-row">'
      + '<button class="btn primary chain-check">'
      + 'Check Order</button>'
      + '<button class="btn chain-reset">'
      + 'Reset</button></div>'
    + '<div class="feedback-gap chain-feedback"></div>';
  return div;
}

function renderChainList(chain) {
  const chainList = document.getElementById(chain.id);
  chainList.innerHTML = '';
  const itemTemplate = document.createElement('li');
  itemTemplate.setAttribute('draggable', 'true');
  chain.currentOrder().forEach(step => {
    const chainItem = itemTemplate.cloneNode(false);
    chainItem.dataset.step = step;
    chainItem.innerHTML = expandAbbr(step);
    chainList.appendChild(chainItem);
  });
}

function showCheckResult(chain, chainList) {
  const results = chain.checkOrder();
  let allCorrect = true;
  for (let i = 0; i < chainList.children.length; i++) {
    const chainItem = chainList.children[i];
    const isCorrect = results[i].isCorrect;
    chainItem.classList.toggle('correct', isCorrect);
    chainItem.classList.toggle('incorrect', !isCorrect);
    if (!isCorrect) allCorrect = false;
  }
  const card = chainList.closest('.card');
  const feedbackEl = card.querySelector('.chain-feedback');
  feedbackEl.innerHTML = allCorrect
    ? '<div class="feedback-box">'
      + 'Correct order.</div>'
    : '<div class="feedback-box error">'
      + 'Not quite. Correct order:'
      + ' <ol class="chain-correct-list">'
      + chain.correctOrder().map(
        s => '<li>' + expandAbbr(s) + '</li>'
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
  return content.replace(
    /Myokinematic Restoration(?: & Postural Respiration)?/g,
    '$& (out of scope for this course)'
  );
}

function getSubviewFromHash(url) {
  return url.substring(1).split('/')[2];
}

function resolveSubviewLink(viewTabs) {
  const hashView = getSubviewFromHash(location.hash);
  if (hashView) {
    const link = viewTabs.querySelector('[href="#diagnose/exercises/' + hashView + '"]');
    if (link) return link;
  }
  return viewTabs.querySelector('.subview-tab.activeTab')
    || viewTabs.querySelector('.subview-tab');
}

function buildMuscleMap() {
  const viewTabs = document.getElementById('muscle-view-tabs');
  let activeViewTab = viewTabs.querySelector('.subview-tab.activeTab');
  let currentMView;

  function applySubview() {
    const link = resolveSubviewLink(viewTabs);
    if (!link) return;

    const view = getSubviewFromHash(link.hash);
    if (link !== activeViewTab) {
      activeViewTab?.classList.remove('activeTab');
      link.classList.add('activeTab');
      activeViewTab = link;
    }
    if (view !== currentMView) {
      currentMView = view;
      renderMuscleView(currentMView);
    }
  }

  applySubview();
  window.addEventListener('hashchange', applySubview);

  const search = document.getElementById('muscle-search');
  search.addEventListener('input', () =>
    renderMuscleView(currentMView, search.value.toLowerCase())
  );
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
}

function renderMuscleView(view, query = '') {
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
  if (!wrap.children.length) {
    wrap.innerHTML =
      '<div class="empty-message">No entries match.</div>';
  }
}
