import { showFetchError } from "./load-errors.js";
import { expandAbbr } from './abbr-expand.js';

let CHEAT_DATA, CAUSAL_MAP, SYMPTOM_PATTERNS, HALT_LEVELS, SQUAT_LEVELS;

let symptomQuiz = { idx: 0, isQuizDone: false, score: { correct: 0, total: 0 } };
let haltQuiz = { idx: 0, isQuizDone: false };
let squatQuiz = { idx: 0, isQuizDone: false };

function basename(path) {
  return path.split('/').pop() || path;
}

async function loadPatternFile(path) {
  const filename = basename(path);
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw resp;
    return await resp.json();
  } catch (error) {
    error.filename = filename;
    throw error;
  }
}

export async function init() {
  const container = document.getElementById("patterns-content");
  if (!container) return;

  try {
    const files = [
      "data/cheat-data.json", "data/causal-map.json",
      "data/symptom-patterns.json", "data/halt-levels.json",
      "data/squat-levels.json"
    ];
    const results = await Promise.all(files.map(loadPatternFile));
    CHEAT_DATA = results[0];
    CAUSAL_MAP = results[1];
    SYMPTOM_PATTERNS = results[2];
    HALT_LEVELS = results[3];
    SQUAT_LEVELS = results[4];
  } catch (error) {
    showFetchError(container, error.filename, error);
    return;
  }

  buildCheatSheet();
  buildConceptMap();
  initSymptomQuiz();
  initHaltQuiz();
  initSquatQuiz();
}

function buildCheatSheet() {
  const grid = document.getElementById('cheat-sheet-grid');
  grid.innerHTML = '';
  const keyLabels = new Set();
  const colTemplate = document.createElement('div');
  colTemplate.classList.add('cheat-col');
  CHEAT_DATA.forEach(col => {
    const div = colTemplate.cloneNode(false);
    div.innerHTML = '<div class="cheat-col-header">'
      + expandAbbr(col.name) + '</div>'
      + col.rows.map((row) => {
        const keyCls = row.key ? ' key' : '';
        if (row.key) keyLabels.add(row.l);
        return '<div class="cheat-row'
          + keyCls + '">'
          + '<span>' + expandAbbr(row.l)
          + '</span>'
          + '<span>' + expandAbbr(row.v)
          + '</span></div>';
      }).join('');
    grid.appendChild(div);
  });
  const legendLabels = document.getElementById('cheat-legend-labels');
  if (legendLabels && keyLabels.size) {
    legendLabels.textContent = Array.from(keyLabels).join(', ');
  }
}

const CONCEPT_MAP_W = 500, CONCEPT_MAP_H = 340;
const CONCEPT_MAP_PAD = 20;
const LABEL_PAD = 4;
const OFF_DIST = 18;
const NODE_CHAR_W = 5.2;
const NODE_PAD = 12;
const NODE_MIN_W = 60;

const pxToViewBox = node => ({
    cx: CONCEPT_MAP_PAD + node.x / 100 * (CONCEPT_MAP_W - 2 * CONCEPT_MAP_PAD),
    cy: CONCEPT_MAP_PAD + node.y / 100 * (CONCEPT_MAP_H - 2 * CONCEPT_MAP_PAD)
  });

const nodeId = nodeKey => 'concept-map-' + nodeKey;

const parseNodeKey = nodeDomId => nodeDomId.replace(/^concept-map-/, '');

const edgeKey = (fromKey, toKey) => fromKey + "--to--" + toKey;

const edgeLineId = (fromKey, toKey) =>  "concept-map-edge-" + edgeKey(fromKey, toKey);

const edgeLabelId = (fromKey, toKey) => 'concept-map-edge-label-' + edgeKey(fromKey, toKey);

function forEachConceptMapEdge(visitEdge) {
  Object.entries(CAUSAL_MAP).forEach(([fromKey, node]) => {
    Object.entries(node.to || {}).forEach(([toKey, edge]) => {
      visitEdge(fromKey, toKey, edge);
    });
  });
}

function buildEdgeLines() {
  const lines = [];
  forEachConceptMapEdge((fromKey, toKey) => {
    const f = pxToViewBox(CAUSAL_MAP[fromKey]);
    const t = pxToViewBox(CAUSAL_MAP[toKey]);
    lines.push(`<line class="map-edge"
      id="${edgeLineId(fromKey, toKey)}"
      x1="${f.cx}" y1="${f.cy}"
      x2="${t.cx}" y2="${t.cy}"
      marker-end="url(#arrow-map)"/>`);
  });
  return lines.join('');
}

function buildEdgeLabels() {
  const labels = [];
  forEachConceptMapEdge((fromKey, toKey, edge) => {
    const f = pxToViewBox(CAUSAL_MAP[fromKey]);
    const t = pxToViewBox(CAUSAL_MAP[toKey]);
    const mx = (f.cx + t.cx) / 2;
    const my = (f.cy + t.cy) / 2;
    let ox, oy;
    if (typeof edge.dx === 'number') {
      ox = mx + edge.dx;
      oy = my + edge.dy;
    } else {
      const dx = t.cx - f.cx;
      const dy = t.cy - f.cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      ox = mx + (-dy / len) * OFF_DIST;
      oy = my + (dx / len) * OFF_DIST;
    }
    labels.push(`<g class="map-edge-label-group"
      id="${edgeLabelId(fromKey, toKey)}">
      <line class="map-edge-leader"
        x1="${mx}" y1="${my}"
        x2="${ox}" y2="${oy}"/>
      <rect class="map-edge-label-bg"/>
      <text class="map-edge-label"
        x="${ox}" y="${oy + 3}"
        text-anchor="middle">${edge.effect}</text>
    </g>`);
  });
  return labels.join('');
}

function buildNodes() {
  return Object.entries(CAUSAL_MAP).map(([key, node]) => {
    const p = pxToViewBox(node);
    const lines = node.name.split('\n');
    const maxLen = Math.max(...lines.map((l) => l.length));
    const rw = Math.max(NODE_MIN_W, maxLen * NODE_CHAR_W + NODE_PAD);
    const rh = lines.length > 2 ? 38 : 28;
    const rx = p.cx - rw / 2;
    const ry = p.cy - rh / 2;
    const cls = 'map-node' + (node.central ? ' central' : '');
    const textSVG = lines.map((l, li) =>
      `<text x="${p.cx}"
        y="${ry + 11 + li * 11}"
        text-anchor="middle">${l}</text>`
    ).join('');
    return `<g class="${cls}" id="${nodeId(key)}">
      <rect x="${rx}" y="${ry}"
        width="${rw}" height="${rh}"/>
      ${textSVG}</g>`;
  }).join('');
}

function sizeEdgeLabelBoxes() {
  forEachConceptMapEdge((fromKey, toKey) => {
    const g = document.getElementById(edgeLabelId(fromKey, toKey));
    const text = g.querySelector('text');
    const rect = g.querySelector('rect');
    const tw = text.getComputedTextLength() + LABEL_PAD * 2;
    const bbox = text.getBBox();
    rect.setAttribute('x', bbox.x - LABEL_PAD);
    rect.setAttribute('y', bbox.y - 1);
    rect.setAttribute('width', tw);
    rect.setAttribute('height', 12);
  });
}

function buildEdgesByNode(graph) {
  const index = {};
  Object.keys(graph).forEach(key => index[key] = []);
  Object.entries(graph).forEach(([fromKey, node]) => {
    Object.keys(node.to || {}).forEach((toKey) => {
      const edge = { fromKey, toKey };
      index[fromKey].push(edge);
      index[toKey].push(edge);
    });
  });
  return index;
}

function initNodeHighlight(svg) {
  let activeNode = null;
  let activeEdgeEls = [];
  let activeNodeEls = [];
  let edgesByNode = null;
  const getEdgesByNode = () =>
    edgesByNode ??= buildEdgesByNode(CAUSAL_MAP);

  function clearHighlight() {
    if (!activeNode) return;

    activeNode.classList.remove('highlighted');
    activeEdgeEls.forEach((el) => {
      el.classList.remove('highlighted');
      el.setAttribute('marker-end', 'url(#arrow-map)');
    });
    activeNodeEls.forEach((el) => {
      el.classList.remove('highlighted');
    });
    activeNode = null;
    activeEdgeEls = [];
    activeNodeEls = [];
  }

  function highlightNodeEdge(edgeEl, otherEl) {
    edgeEl.classList.add('highlighted');
    edgeEl.setAttribute('marker-end', 'url(#arrow-map-hl)');
    activeEdgeEls.push(edgeEl);
    if (!otherEl) return;

    otherEl.classList.add('highlighted');
    activeNodeEls.push(otherEl);
  }

  function highlightNode(nodeEl) {
    activeNode = nodeEl;
    const nodeKey = parseNodeKey(nodeEl.id);
    nodeEl.classList.add('highlighted');
    getEdgesByNode()[nodeKey].forEach(({ fromKey, toKey }) => {
      const edgeEl = document.getElementById(edgeLineId(fromKey, toKey));
      const otherKey = fromKey === nodeKey ? toKey : fromKey;
      const otherEl = document.getElementById(nodeId(otherKey));
      highlightNodeEdge(edgeEl, otherEl);
    });
  }

  svg.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl) return;

    clearHighlight();
    highlightNode(nodeEl);
  });
}

function buildConceptMap() {
  const svg = document.getElementById('concept-map-svg');
  const defs = svg.querySelector('defs');
  defs.insertAdjacentHTML(
    'afterend',
    buildEdgeLines() + buildNodes() + buildEdgeLabels()
  );
  sizeEdgeLabelBoxes();
  initNodeHighlight(svg);
}

function gradeSymptomAnswer(btn, answersEl) {
  const current = SYMPTOM_PATTERNS[symptomQuiz.idx];
  const chosenKey = btn.value;
  const correctKey = current.patternKey;
  const isCorrect = chosenKey === correctKey;

  symptomQuiz.isQuizDone = true;
  symptomQuiz.score.total++;
  showScoreUpdate(isCorrect);
  markCorrectSymptomAnswer(answersEl, correctKey);
  if (!isCorrect) {
    btn.classList.add('incorrect');
    symptomQuiz.markedBtns.push(btn);
  }
  answersEl.classList.add('answered');
  showSymptomFeedback(current.explanation, isCorrect);
  showSymptomNext();
}

function markCorrectSymptomAnswer(answersEl, correctKey) {
  const correctBtn = answersEl.querySelector(
    '[value="' + correctKey + '"]'
  );
  correctBtn.classList.add('correct');
  symptomQuiz.markedBtns = [correctBtn];
}

function showScoreUpdate(isCorrect) {
  symptomQuiz.score.correct += +isCorrect;
  document.getElementById('symptom-score')
    .textContent = 'Score: '
      + symptomQuiz.score.correct
      + ' / ' + symptomQuiz.score.total;
}

function showSymptomFeedback(explanation, isCorrect) {
  const feedback = document.getElementById(
    'symptom-feedback'
  );
  const verdict = isCorrect ? 'Correct.' : 'Incorrect.';
  feedback.classList.toggle('error', !isCorrect);
  feedback.innerHTML = '<strong>' + verdict
    + '</strong> ' + explanation;
  feedback.classList.remove('hidden');
}

function showSymptomNext() {
  document.getElementById('symptom-next').classList.remove('hidden');
}

function initSymptomQuiz() {
  const answersEl = document.getElementById('symptom-answers');
  symptomQuiz.idx = 0;
  symptomQuiz.markedBtns = [];
  renderSymptomQuestion();

  document.getElementById('symptom-next').addEventListener('click', () => {
    symptomQuiz.idx = (symptomQuiz.idx + 1) % SYMPTOM_PATTERNS.length;
    symptomQuiz.isQuizDone = false;
    renderSymptomQuestion();
  });

  answersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.answer-btn');
    if (!btn || symptomQuiz.isQuizDone) return;

    gradeSymptomAnswer(btn, answersEl);
  });
}

function renderSymptomQuestion() {
  const current = SYMPTOM_PATTERNS[symptomQuiz.idx];
  document.getElementById('symptom-condition').textContent = current.condition;
  const feedback = document.getElementById(
    'symptom-feedback'
  );
  feedback.classList.add('hidden');
  feedback.classList.remove('error');
  document.getElementById('symptom-next').classList.add('hidden');
  const answersEl = document.getElementById('symptom-answers');
  symptomQuiz.markedBtns.forEach(b => b.classList.remove('correct', 'incorrect'));
  symptomQuiz.markedBtns = [];
  answersEl.classList.remove('answered');
}

function formatKeyValue([k, v]) {
  return '<strong>' + k + ':</strong> '
    + expandAbbr(v);
}

function haltParts(level) {
  const parts = [
    ['Inability', level.inability],
    ['Muscles', level.muscles],
    ['Facilitate', level.facilitate]
  ];
  if (level.ability) {
    parts.unshift(['Ability', level.ability]);
  }
  if (level.also_reflects) {
    parts.push(
      ['Also reflects', level.also_reflects]
    );
  }
  if (level.differentials) {
    parts.push(
      ['Differentials', level.differentials]
    );
  }
  return parts;
}

function squatParts(level) {
  const parts = [
    ['Ability', level.ability],
    ['Inability', level.inability]
  ];
  if (level.hyperactive) {
    parts.push(
      ['Hyperactive', level.hyperactive]
    );
  }
  return parts;
}

function initLevelQuiz(opts) {
  const { state, levels, prefix,
    prompt, buildParts } = opts;
  state.idx = 0;
  state.isQuizDone = false;

  function render() {
    const level = levels[state.idx];
    const n = state.idx + 1;
    const questionEl = document.getElementById(
      prefix + '-question'
    );
    questionEl.innerHTML =
      `<div class="quiz-badge-wrap">
        <span class="quiz-level-badge">
          ${prefix.toUpperCase()} Level
          ${level.level}</span></div>
      <div class="quiz-progress">
        (${n} of ${levels.length})</div>
      <p class="quiz-prompt">
        ${prompt(level)}</p>`;
    document.getElementById(prefix + '-next')
      .textContent = n < levels.length
        ? 'Next Level' : 'Start Over';
  }

  function revealAnswer() {
    if (state.isQuizDone) return;

    state.isQuizDone = true;
    document.getElementById(prefix + '-reveal').disabled = true;
    const feedbackHtml = buildParts(levels[state.idx])
      .map(formatKeyValue).join('<br>');
    document.getElementById(prefix + '-question').innerHTML +=
      '<div class="feedback-box">' + feedbackHtml + '</div>';
  }

  function advanceQuiz() {
    state.idx = (state.idx + 1) % levels.length;
    state.isQuizDone = false;
    document.getElementById(prefix + '-reveal').disabled = false;
    render();
  }

  render();
  document.getElementById(prefix + '-reveal')
    .addEventListener('click', revealAnswer);
  document.getElementById(prefix + '-next')
    .addEventListener('click', advanceQuiz);
}

function initHaltQuiz() {
  initLevelQuiz({
    state: haltQuiz,
    levels: HALT_LEVELS,
    prefix: 'halt',
    prompt: (level) =>
      'What does failure at HALT Level '
        + level.level
        + ' indicate, and what should you'
        + ' facilitate?',
    buildParts: haltParts
  });
}

function initSquatQuiz() {
  initLevelQuiz({
    state: squatQuiz,
    levels: SQUAT_LEVELS,
    prefix: 'squat',
    prompt: (level) =>
      'What failure pattern and which muscles'
        + ' are hyperactive at Squat Level '
        + level.level + '?',
    buildParts: squatParts
  });
}
