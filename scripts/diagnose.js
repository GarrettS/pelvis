import {showFetchError} from './fetch-feedback.js';
import {getStudyData} from './study-data-cache.js';

let DATA = {};
let gameState = {
  scenarioIdx: 0,
  round: 1,
  round2Step: 0,
  score: { correct: 0, total: 0 },
  isAnswered: false
};
let caseState = { active: 0, visitIdx: [0, 0] };

export async function initDiagnose() {
  DATA = await getStudyData();
  if (!DATA) {
    showFetchError('#tab-diagnose', 'study data');
    return;
  }
  buildGame();
  buildCaseStudies();
  buildCausalChains();
  buildDecisionTree();
  buildMuscleMap();
}

function buildGame() {
  const wrap = document.getElementById('game-wrap');
  gameState = { scenarioIdx: 0, round: 1, round2Step: 0, score: { correct: 0, total: 0 }, isAnswered: false };
  renderScenario(wrap);
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

  // Test profile
  let profileHTML = '<div class="card-label">Test Profile</div><div class="test-profile">';
  Object.entries(s.testProfile).forEach(([test, val]) => {
    const isPos = String(val).startsWith('+');
    const isNeg = String(val).startsWith('−') || String(val).startsWith('-');
    profileHTML += `<div class="test-item">
      <div class="test-item-name">${test}</div>
      <div class="test-item-val ${isPos ? 'positive' : isNeg ? 'negative' : ''}">${val}</div>
    </div>`;
  });
  profileHTML += '</div>';
  card.innerHTML = profileHTML;

  // Answer options
  const patterns = ['Left AIC', 'Bilateral PEC', 'Bilateral Patho PEC'];
  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  patterns.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = p;
    btn.addEventListener('click', () => {
      if (gameState.isAnswered) return;
      handleRound1Answer({wrap, card, optWrap, scenario: s, btn, chosen: p});
    });
    optWrap.appendChild(btn);
  });
  card.appendChild(optWrap);
  wrap.appendChild(card);
}

function handleRound1Answer({wrap, card, optWrap, scenario, btn, chosen}) {
  gameState.isAnswered = true;
  gameState.score.total++;
  const isCorrect = chosen === scenario.correctPattern;
  if (isCorrect) gameState.score.correct++;
  optWrap.querySelectorAll('.answer-btn').forEach(b => {
    if (b.textContent === scenario.correctPattern) b.classList.add('correct');
    else if (b === btn && !isCorrect) b.classList.add('incorrect');
    b.disabled = true;
  });
  const fb = document.createElement('div');
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  fb.innerHTML = `<strong>${isCorrect ? 'Correct.' : 'Incorrect.'}</strong> ${scenario.explanation}`;
  card.appendChild(fb);
  wrap.querySelector('.score-display').textContent = `Score: ${gameState.score.correct} / ${gameState.score.total}`;
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn primary';
  nextBtn.textContent = 'Continue to Round 2 →';
  nextBtn.addEventListener('click', () => {
    gameState.round = 2;
    gameState.round2Step = 0;
    gameState.isAnswered = false;
    renderScenario(wrap);
  });
  btnRow.appendChild(nextBtn);
  card.appendChild(btnRow);
}

function renderRound2(wrap, s) {
  const r2 = s.round2;
  const steps = ['repositioning', 'postReposition', 'facilitation'];
  const stepLabels = ['Repositioning', 'Post-Repositioning Program', 'Facilitation'];
  const step = steps[gameState.round2Step];
  const q = r2[step];
  if (!q) { advanceScenario(wrap); return; }

  const card = document.createElement('div');
  card.className = 'card';

  const stepLabel = document.createElement('div');
  stepLabel.className = 'card-label';
  stepLabel.textContent = `Round 2 — Step ${gameState.round2Step + 1}/3: ${stepLabels[gameState.round2Step]}`;
  card.appendChild(stepLabel);

  const qText = document.createElement('p');
  qText.className = 'question-stem';
  qText.textContent = q.question;
  card.appendChild(qText);

  const isMultiSelect = Array.isArray(q.correct);
  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  const selectedOpts = new Set();

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt;
    if (isMultiSelect) {
      btn.addEventListener('click', () => {
        if (gameState.isAnswered) return;
        if (selectedOpts.has(opt)) {
          selectedOpts.delete(opt);
          btn.classList.remove('selectedOpt');
        } else {
          selectedOpts.add(opt);
          btn.classList.add('selectedOpt');
        }
      });
    } else {
      btn.addEventListener('click', () => {
        if (gameState.isAnswered) return;
        gameState.isAnswered = true;
        gameState.score.total++;
        const isCorrect = opt === q.correct;
        if (isCorrect) gameState.score.correct++;
        optWrap.querySelectorAll('.answer-btn').forEach(b => {
          if (b.textContent === q.correct) b.classList.add('correct');
          else if (b === btn && !isCorrect) b.classList.add('incorrect');
          b.disabled = true;
        });
        showR2Feedback(card, wrap, isCorrect, q.explanation);
      });
    }
    optWrap.appendChild(btn);
  });
  card.appendChild(optWrap);

  if (isMultiSelect) {
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn primary';
    submitBtn.textContent = 'Check Answer';
    submitBtn.classList.add('submit-gap');
    submitBtn.addEventListener('click', () => {
      if (gameState.isAnswered) return;
      handleMultiSelectSubmit({card, wrap, optWrap, question: q, selectedOpts});
    });
    card.appendChild(submitBtn);
  }

  wrap.appendChild(card);
  // Update score display
  const scoreEl = wrap.querySelector('.score-display');
  if (scoreEl) scoreEl.textContent = `Score: ${gameState.score.correct} / ${gameState.score.total}`;
}

function handleMultiSelectSubmit({card, wrap, optWrap, question, selectedOpts}) {
  gameState.isAnswered = true;
  gameState.score.total++;
  const correctSet = new Set(question.correct);
  const isCorrect = selectedOpts.size === correctSet.size &&
    [...selectedOpts].every(o => correctSet.has(o));
  if (isCorrect) gameState.score.correct++;
  optWrap.querySelectorAll('.answer-btn').forEach(b => {
    if (correctSet.has(b.textContent)) b.classList.add('correct');
    else if (selectedOpts.has(b.textContent)) b.classList.add('incorrect');
    b.disabled = true;
  });
  showR2Feedback(card, wrap, isCorrect, question.explanation);
}

function showR2Feedback(card, wrap, isCorrect, explanation) {
  const fb = document.createElement('div');
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  fb.innerHTML = `<strong>${isCorrect ? 'Correct.' : 'Incorrect.'}</strong> ${explanation}`;
  card.appendChild(fb);
  if (wrap.querySelector('.score-display')) {
    wrap.querySelector('.score-display').textContent = `Score: ${gameState.score.correct} / ${gameState.score.total}`;
  }
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn primary';
  const hasMoreSteps = gameState.round2Step < 2;
  const hasMoreScenarios = gameState.scenarioIdx < DATA.game.scenarios.length - 1;
  nextBtn.textContent = hasMoreSteps ? 'Next Step →' : (hasMoreScenarios ? 'Next Scenario →' : 'Finish');
  nextBtn.addEventListener('click', () => {
    gameState.isAnswered = false;
    if (hasMoreSteps) {
      gameState.round2Step++;
      renderScenario(wrap);
    } else if (hasMoreScenarios) {
      gameState.scenarioIdx++;
      gameState.round = 1;
      gameState.round2Step = 0;
      renderScenario(wrap);
    } else {
      advanceScenario(wrap);
    }
  });
  btnRow.appendChild(nextBtn);
  card.appendChild(btnRow);
}

function advanceScenario(wrap) {
  wrap.innerHTML = `<div class="callout">
    <strong>Game complete.</strong> Final score: ${gameState.score.correct} / ${gameState.score.total}.
    <div class="btn-row"><button class="btn primary" id="game-restart">Restart</button></div>
  </div>`;
  document.getElementById('game-restart').addEventListener('click', () => buildGame());
}

function buildCaseStudies() {
  const wrap = document.getElementById('case-study-wrap');
  wrap.innerHTML = '';
  DATA.caseStudies.forEach((cs, ci) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3 class="case-title">${cs.title}</h3>`;
    const inner = document.createElement('div');
    inner.id = `cs-${ci}`;
    div.appendChild(inner);
    wrap.appendChild(div);
    renderCaseVisit(ci, 0, inner);
  });
}

function renderCaseVisit(ci, vi, container) {
  const cs = DATA.caseStudies[ci];
  if (vi >= cs.visits.length) {
    container.innerHTML = `<div class="callout"><strong>Case complete.</strong><div class="btn-row"><button class="btn" id="cs-restart-${ci}">Restart Case</button></div></div>`;
    document.getElementById(`cs-restart-${ci}`).addEventListener('click', () => renderCaseVisit(ci, 0, container));
    return;
  }
  const visit = cs.visits[vi];
  let html = `<div class="visit-badge">Visit ${visit.visit}</div>`;
  // Test results
  if (visit.testResults) {
    html += `<div class="test-profile">`;
    Object.entries(visit.testResults).forEach(([k, v]) => {
      const isPos = String(v).startsWith('+');
      const isNeg = String(v).startsWith('−') || String(v).startsWith('-');
      html += `<div class="test-item"><div class="test-item-name">${k}</div><div class="test-item-val ${isPos ? 'positive' : isNeg ? 'negative' : ''}">${v}</div></div>`;
    });
    html += `</div>`;
  }
  html += `<p class="question-stem">${visit.question}</p>`;
  container.innerHTML = html;

  const opts = visit.options || [];
  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  let answered = false;

  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const isCorrect = opt === visit.correct;
      optWrap.querySelectorAll('.answer-btn').forEach(b => {
        if (b.textContent === visit.correct) b.classList.add('correct');
        else if (b === btn && !isCorrect) b.classList.add('incorrect');
        b.disabled = true;
      });
      const fb = document.createElement('div');
      fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
      fb.innerHTML = `<strong>${isCorrect ? 'Correct.' : 'Incorrect.'}</strong> ${visit.explanation}`;
      container.appendChild(fb);

      if (visit.treatmentQuestion && isCorrect) {
        renderTreatmentSubQuestion({visit, container, caseIdx: ci, visitIdx: vi});
      } else {
        addNextVisitBtn(container, ci, vi, container);
      }
    });
    optWrap.appendChild(btn);
  });
  container.appendChild(optWrap);
}

function renderTreatmentSubQuestion({visit, container, caseIdx, visitIdx}) {
  const tq = document.createElement('div');
  tq.classList.add('treatment-subquestion');
  tq.innerHTML = `<p class="question-stem">${visit.treatmentQuestion}</p>`;
  const topts = visit.treatmentOptions || [];
  const tOptWrap = document.createElement('div');
  tOptWrap.className = 'answer-opts';
  const selectedT = new Set();
  let tAnswered = false;
  topts.forEach(topt => {
    const tb = document.createElement('button');
    tb.className = 'answer-btn';
    tb.textContent = topt;
    tb.addEventListener('click', () => {
      if (tAnswered) return;
      if (selectedT.has(topt)) { selectedT.delete(topt); tb.classList.remove('selectedOpt'); }
      else { selectedT.add(topt); tb.classList.add('selectedOpt'); }
    });
    tOptWrap.appendChild(tb);
  });
  tq.appendChild(tOptWrap);
  const tSubmit = document.createElement('button');
  tSubmit.className = 'btn primary';
  tSubmit.textContent = 'Check';
  tSubmit.classList.add('submit-gap');
  tSubmit.addEventListener('click', () => {
    if (tAnswered) return;
    tAnswered = true;
    const correctSet = new Set(visit.correctTreatment || []);
    const isT = selectedT.size === correctSet.size && [...selectedT].every(o => correctSet.has(o));
    tOptWrap.querySelectorAll('.answer-btn').forEach(b => {
      if (correctSet.has(b.textContent)) b.classList.add('correct');
      else if (selectedT.has(b.textContent)) b.classList.add('incorrect');
      b.disabled = true;
    });
    const tfb = document.createElement('div');
    tfb.className = 'feedback-box' + (isT ? '' : ' error');
    tfb.innerHTML = `<strong>${isT ? 'Correct.' : 'Incorrect.'}</strong> ${visit.treatmentExplanation || ''}`;
    tq.appendChild(tfb);
    addNextVisitBtn(tq, caseIdx, visitIdx, container);
  });
  tq.appendChild(tSubmit);
  container.appendChild(tq);
}

function addNextVisitBtn(parent, ci, vi, container) {
  const cs = DATA.caseStudies[ci];
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const nv = document.createElement('button');
  nv.className = 'btn primary';
  nv.textContent = vi + 1 < cs.visits.length ? `Next Visit (Visit ${vi + 2}) →` : 'Case Complete';
  nv.addEventListener('click', () => renderCaseVisit(ci, vi + 1, container));
  btnRow.appendChild(nv);
  parent.appendChild(btnRow);
}

function buildCausalChains() {
  const wrap = document.getElementById('chains-wrap');
  wrap.innerHTML = '';
  DATA.causalChains.forEach((chain, ci) => {
    wrap.appendChild(buildChainCard(chain, ci));
  });
}

function buildChainCard(chain, ci) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `<h3 class="chain-title">${chain.title}</h3>
    <div class="chain-subtitle">${chain.start} → ${chain.end}</div>`;

  const steps = [...chain.steps];
  let order = [...steps].sort(() => Math.random() - 0.5);
  const ul = document.createElement('ul');
  ul.className = 'chain-list';
  ul.id = `chain-${ci}`;

  function buildList() {
    ul.innerHTML = '';
    order.forEach((step, i) => {
      const li = document.createElement('li');
      li.className = 'chain-item';
      li.setAttribute('draggable', 'true');
      li.dataset.step = step;
      li.innerHTML =
        `<span class="chain-step-num">${i + 1}.</span>`
        + `<span>${step}</span>`;
      ul.appendChild(li);
    });
  }

  let activeDragItem = null;

  ul.addEventListener('dragstart', (e) => {
    activeDragItem = e.target.closest('.chain-item');
    activeDragItem?.classList.add('dragging');
  });
  ul.addEventListener('dragend', () => {
    activeDragItem?.classList.remove('dragging');
    activeDragItem = null;
  });
  ul.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!activeDragItem) return;

    const siblings = [...ul.children];
    const after = siblings.find((s) => {
      if (s === activeDragItem) return false;

      const box = s.getBoundingClientRect();
      return e.clientY <= box.top + box.height / 2;
    });
    if (after) ul.insertBefore(activeDragItem, after);
    else ul.appendChild(activeDragItem);
    order = [...ul.children]
      .map((li) => li.dataset.step);
  });

  buildList();
  div.appendChild(ul);

  const feedbackEl = document.createElement('div');
  feedbackEl.classList.add('feedback-gap');

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const checkBtn = document.createElement('button');
  checkBtn.className = 'btn primary';
  checkBtn.textContent = 'Check Order';
  checkBtn.addEventListener('click', () => {
    checkChainOrder(ul, steps, feedbackEl);
    btnRow.appendChild(feedbackEl);
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => {
    order = [...steps].sort(() => Math.random() - 0.5);
    buildList();
    feedbackEl.innerHTML = '';
  });

  btnRow.appendChild(checkBtn);
  btnRow.appendChild(resetBtn);
  div.appendChild(btnRow);
  div.appendChild(feedbackEl);
  return div;
}

function checkChainOrder(ul, steps, feedbackEl) {
  let allCorrect = true;
  ul.querySelectorAll('.chain-item').forEach((li, i) => {
    const isCorrect = li.dataset.step === steps[i];
    li.classList.toggle('correct', isCorrect);
    li.classList.toggle('incorrect', !isCorrect);
    if (!isCorrect) allCorrect = false;
  });
  feedbackEl.innerHTML = allCorrect
    ? `<div class="feedback-box">Correct order.</div>`
    : `<div class="feedback-box error">Not quite. Correct order: <ol class="chain-correct-list">${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;
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
    el.textContent = annotateOutOfScope(node.content || '');
    parent.appendChild(el);
    return;
  }
  const qEl = document.createElement('div');
  qEl.className = 'tree-question';
  qEl.textContent = node.question || node.id;
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
    div.innerHTML = `
      <div class="muscle-name">${nameKey}</div>
      <div class="muscle-meta">${entry.action || entry.meaning || ''}</div>
      ${entry.pattern ? `<div class="muscle-meta">Pattern: ${entry.pattern}</div>` : ''}
      ${entry.hierarchyStep ? `<div class="muscle-meta">Hierarchy: ${entry.hierarchyStep}</div>` : ''}
      ${entry.muscles ? `<div class="muscle-meta">Muscles: ${entry.muscles}</div>` : ''}
      <div class="exercise-tags">${exercises}</div>
    `;
    wrap.appendChild(div);
  });
  if (!wrap.children.length) wrap.innerHTML = '<div class="empty-message">No entries match.</div>';
}
