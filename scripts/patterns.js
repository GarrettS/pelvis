import { showFetchError } from './fetch-feedback.js';
import { expandAbbr } from './abbr-expand.js';

let CHEAT_DATA, CAUSAL_MAP, SYMPTOM_PATTERNS, HALT_LEVELS, SQUAT_LEVELS;
let MAP_NODES, MAP_EDGES;

let symptomQuiz = { idx: 0, isQuizDone: false, score: { correct: 0, total: 0 } };
let haltQuiz = { idx: 0, isQuizDone: false };
let squatQuiz = { idx: 0, isQuizDone: false };

export async function init() {
  try {
    const urls = [
      'data/cheat-data.json', 'data/causal-map.json',
      'data/symptom-patterns.json', 'data/halt-levels.json',
      'data/squat-levels.json'
    ];
    const responses = await Promise.all(urls.map(u => fetch(u)));
    const badResp = responses.find(r => !r.ok);
    if (badResp) {
      showFetchError('#patterns-content', 'pattern data');
      return;
    }
    const results = await Promise.all(responses.map(r => r.json()));
    CHEAT_DATA = results[0];
    CAUSAL_MAP = results[1];
    SYMPTOM_PATTERNS = results[2];
    HALT_LEVELS = results[3];
    SQUAT_LEVELS = results[4];
  } catch (fetchErr) {
    showFetchError('#patterns-content', 'pattern data');
    return;
  }
  MAP_NODES = CAUSAL_MAP.nodes;
  MAP_EDGES = CAUSAL_MAP.edges;

  buildCheatSheet();
  buildConceptMap();
  initSymptomQuiz();
  initHaltQuiz();
  initSquatQuiz();
}

function buildCheatSheet() {
  const grid = document.getElementById('cheat-sheet-grid');
  grid.innerHTML = '';
  const colTemplate = document.createElement('div');
  colTemplate.classList.add('cheat-col');
  CHEAT_DATA.forEach(col => {
    const div = colTemplate.cloneNode(false);
    const isPatho = col.name.includes('Patho');
    div.innerHTML = '<div class="cheat-col-header">'
      + expandAbbr(col.name) + '</div>'
      + col.rows.map((row) => {
        const keyCls = row.key
          ? (isPatho ? ' key-warn' : ' key')
          : '';
        return '<div class="cheat-row'
          + keyCls + '">'
          + '<span>' + expandAbbr(row.l)
          + '</span>'
          + '<span>' + expandAbbr(row.v)
          + '</span></div>';
      }).join('');
    grid.appendChild(div);
  });
}

const CONCEPT_MAP_W = 500, CONCEPT_MAP_H = 340;
const CONCEPT_MAP_PAD = 20;
const LABEL_PAD = 4;
const OFF_DIST = 18;
const NODE_CHAR_W = 5.2;
const NODE_PAD = 12;
const NODE_MIN_W = 60;

function pxToViewBox(node) {
  return {
    cx: CONCEPT_MAP_PAD
      + node.x / 100 * (CONCEPT_MAP_W - 2 * CONCEPT_MAP_PAD),
    cy: CONCEPT_MAP_PAD
      + node.y / 100 * (CONCEPT_MAP_H - 2 * CONCEPT_MAP_PAD)
  };
}

function buildEdgeLines() {
  return MAP_EDGES.map((edge, i) => {
    const f = pxToViewBox(MAP_NODES[edge.from]);
    const t = pxToViewBox(MAP_NODES[edge.to]);
    return `<line class="map-edge"
      id="concept-map-edge-${i}"
      x1="${f.cx}" y1="${f.cy}"
      x2="${t.cx}" y2="${t.cy}"
      marker-end="url(#arrow-map)"/>`;
  }).join('');
}

function buildEdgeLabels() {
  return MAP_EDGES.map((edge, i) => {
    const f = pxToViewBox(MAP_NODES[edge.from]);
    const t = pxToViewBox(MAP_NODES[edge.to]);
    const mx = (f.cx + t.cx) / 2;
    const my = (f.cy + t.cy) / 2;
    let ox, oy;
    if (typeof edge.labelDx === 'number') {
      ox = mx + edge.labelDx;
      oy = my + edge.labelDy;
    } else {
      const dx = t.cx - f.cx;
      const dy = t.cy - f.cy;
      const len = Math.sqrt(
        dx * dx + dy * dy
      ) || 1;
      ox = mx + (-dy / len) * OFF_DIST;
      oy = my + (dx / len) * OFF_DIST;
    }
    return `<g class="map-edge-label-group"
      id="concept-map-label-${i}">
      <line class="map-edge-leader"
        x1="${mx}" y1="${my}"
        x2="${ox}" y2="${oy}"/>
      <rect class="map-edge-label-bg"/>
      <text class="map-edge-label"
        x="${ox}" y="${oy + 3}"
        text-anchor="middle">${edge.label}</text>
    </g>`;
  }).join('');
}

function buildNodes() {
  return Object.keys(MAP_NODES).map((id) => {
    const node = MAP_NODES[id];
    const p = pxToViewBox(node);
    const lines = node.label.split('\n');
    const maxLen = Math.max(
      ...lines.map((l) => l.length)
    );
    const rw = Math.max(
      NODE_MIN_W, maxLen * NODE_CHAR_W + NODE_PAD
    );
    const rh = lines.length > 2 ? 38 : 28;
    const rx = p.cx - rw / 2;
    const ry = p.cy - rh / 2;
    const cls = 'map-node'
      + (node.central ? ' central' : '');
    const textSVG = lines.map((l, li) =>
      `<text x="${p.cx}"
        y="${ry + 11 + li * 11}"
        text-anchor="middle">${l}</text>`
    ).join('');
    return `<g class="${cls}" id="${id}">
      <rect x="${rx}" y="${ry}"
        width="${rw}" height="${rh}"/>
      ${textSVG}</g>`;
  }).join('');
}

function sizeEdgeLabelBoxes() {
  MAP_EDGES.forEach((edge, i) => {
    const g = document.getElementById(
      'concept-map-label-' + i
    );
    const text = g.querySelector('text');
    const rect = g.querySelector('rect');
    const tw = text.getComputedTextLength()
      + LABEL_PAD * 2;
    const bbox = text.getBBox();
    rect.setAttribute('x', bbox.x - LABEL_PAD);
    rect.setAttribute('y', bbox.y - 1);
    rect.setAttribute('width', tw);
    rect.setAttribute('height', 12);
  });
}

function initNodeHighlight(svg) {
  let activeNode = null;
  let activeEdgeEls = [];
  let activeNodeEls = [];

  function clearHighlight() {
    if (!activeNode) return;

    activeNode.classList.remove('highlighted');
    activeEdgeEls.forEach((el) => {
      el.classList.remove('highlighted');
      el.setAttribute(
        'marker-end', 'url(#arrow-map)'
      );
    });
    activeNodeEls.forEach((el) => {
      el.classList.remove('highlighted');
    });
    activeNode = null;
    activeEdgeEls = [];
    activeNodeEls = [];
  }

  function highlightNode(nodeEl) {
    activeNode = nodeEl;
    const nodeId = nodeEl.id;
    nodeEl.classList.add('highlighted');

    MAP_EDGES.forEach((edge, i) => {
      if (edge.from !== nodeId
        && edge.to !== nodeId) return;

      const edgeEl = document.getElementById(
        'concept-map-edge-' + i
      );
      if (edgeEl) {
        edgeEl.classList.add('highlighted');
        edgeEl.setAttribute(
          'marker-end', 'url(#arrow-map-hl)'
        );
        activeEdgeEls.push(edgeEl);
      }
      const otherId = edge.from === nodeId
        ? edge.to : edge.from;
      const otherEl = document.getElementById(
        otherId
      );
      if (otherEl) {
        otherEl.classList.add('highlighted');
        activeNodeEls.push(otherEl);
      }
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
  const svg = document.getElementById(
    'concept-map-svg'
  );
  const defs = svg.querySelector('defs');
  defs.insertAdjacentHTML(
    'afterend',
    buildEdgeLines() + buildNodes()
      + buildEdgeLabels()
  );
  sizeEdgeLabelBoxes();
  initNodeHighlight(svg);
}

function gradeSymptomAnswer(btn, answersEl) {
  symptomQuiz.isQuizDone = true;
  const current = SYMPTOM_PATTERNS[symptomQuiz.idx];
  const chosen = btn.dataset.ans;
  const isCorrect = chosen === current.pattern;
  symptomQuiz.score.total++;
  if (isCorrect) symptomQuiz.score.correct++;
  document.getElementById('symptom-score')
    .textContent = 'Score: '
      + symptomQuiz.score.correct
      + ' / ' + symptomQuiz.score.total;

  const sel = '[data-ans="'
    + current.pattern + '"]';
  const correctBtn = answersEl.querySelector(sel);
  correctBtn.classList.add('correct');
  symptomQuiz.markedBtns = [correctBtn];
  if (!isCorrect) {
    btn.classList.add('incorrect');
    symptomQuiz.markedBtns.push(btn);
  }
  answersEl.classList.add('answered');

  const feedback = document.getElementById(
    'symptom-feedback'
  );
  feedback.classList.toggle('error', !isCorrect);
  const verdict = isCorrect
    ? 'Correct.' : 'Incorrect.';
  feedback.innerHTML = '<strong>' + verdict
    + '</strong> ' + current.explanation;
  feedback.classList.remove('hidden');
  document.getElementById('symptom-next')
    .classList.remove('hidden');
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
  document.getElementById('symptom-feedback').classList.add('hidden');
  document.getElementById('symptom-next').classList.add('hidden');
  const answersEl = document.getElementById('symptom-answers');
  symptomQuiz.markedBtns.forEach(b => { b.classList.remove('correct', 'incorrect'); });
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
