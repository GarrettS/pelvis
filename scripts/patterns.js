import { showFetchError } from './fetch-feedback.js';
import { expandAbbr } from './abbr-expand.js';

let CHEAT_DATA, CAUSAL_MAP, SYMPTOM_PATTERNS, HALT_LEVELS, SQUAT_LEVELS;
let MAP_NODES, MAP_EDGES;

let symptomQuiz = { idx: 0, isQuizDone: false, score: { correct: 0, total: 0 } };
let haltQuiz = { idx: 0, isQuizDone: false };
let squatQuiz = { idx: 0, isQuizDone: false };

export async function initPatterns() {
  try {
    const urls = [
      'data/cheat-data.json', 'data/causal-map.json',
      'data/symptom-patterns.json', 'data/halt-levels.json',
      'data/squat-levels.json'
    ];
    const responses = await Promise.all(urls.map(u => fetch(u)));
    const badResp = responses.find(r => !r.ok);
    if (badResp) {
      showFetchError('#tab-patterns', 'pattern data');
      return;
    }
    const results = await Promise.all(responses.map(r => r.json()));
    CHEAT_DATA = results[0];
    CAUSAL_MAP = results[1];
    SYMPTOM_PATTERNS = results[2];
    HALT_LEVELS = results[3];
    SQUAT_LEVELS = results[4];
  } catch (fetchErr) {
    showFetchError('#tab-patterns', 'pattern data');
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

const CMAP_W = 500, CMAP_H = 340;
const CMAP_PAD = 20;
const LABEL_PAD = 4;
const OFF_DIST = 18;
const NODE_CHAR_W = 5.2;
const NODE_PAD = 12;
const NODE_MIN_W = 60;

function cmapPx(node) {
  return {
    cx: CMAP_PAD
      + node.x / 100 * (CMAP_W - 2 * CMAP_PAD),
    cy: CMAP_PAD
      + node.y / 100 * (CMAP_H - 2 * CMAP_PAD)
  };
}

function buildEdgeLines() {
  return MAP_EDGES.map((edge, i) => {
    const f = cmapPx(MAP_NODES[edge.from]);
    const t = cmapPx(MAP_NODES[edge.to]);
    return `<line class="map-edge"
      id="cmap-edge-${i}"
      x1="${f.cx}" y1="${f.cy}"
      x2="${t.cx}" y2="${t.cy}"
      marker-end="url(#arrow-map)"/>`;
  }).join('');
}

function buildEdgeLabels() {
  return MAP_EDGES.map((edge, i) => {
    const f = cmapPx(MAP_NODES[edge.from]);
    const t = cmapPx(MAP_NODES[edge.to]);
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
      id="cmap-elabel-${i}">
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
    const p = cmapPx(node);
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
      'cmap-elabel-' + i
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

  svg.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl) return;

    if (activeNode) {
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
    }

    activeNode = nodeEl;
    activeEdgeEls = [];
    activeNodeEls = [];
    const nodeId = nodeEl.id;

    nodeEl.classList.add('highlighted');
    MAP_EDGES.forEach((edge, i) => {
      if (edge.from !== nodeId
        && edge.to !== nodeId) return;

      const edgeEl = document.getElementById(
        'cmap-edge-' + i
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

function initHaltQuiz() {
  haltQuiz.idx = 0;
  haltQuiz.isQuizDone = false;
  renderHaltQuestion();
  const revealButton = document.getElementById('halt-reveal');
  const nextButton = document.getElementById('halt-next');
  revealButton.addEventListener('click', function() {
    if (haltQuiz.isQuizDone) return;
    haltQuiz.isQuizDone = true;
    this.disabled = true;
    const level = HALT_LEVELS[haltQuiz.idx];
    const parts = [
      ['Inability', level.inability],
      ['Muscles', level.muscles],
      ['Facilitate', level.facilitate]
    ];
    if (level.ability) {
      parts.unshift(['Ability', level.ability]);
    }
    if (level.also_reflects) {
      parts.push(['Also reflects', level.also_reflects]);
    }
    if (level.differentials) {
      parts.push(['Differentials', level.differentials]);
    }
    const feedbackHtml = parts.map(
      ([k, v]) => '<strong>' + k + ':</strong> ' + expandAbbr(v)
    ).join('<br>');
    document.getElementById('halt-question').innerHTML +=
      '<div class="feedback-box">' + feedbackHtml + '</div>';
  });
  nextButton.addEventListener('click', () => {
    haltQuiz.idx = (haltQuiz.idx + 1) % HALT_LEVELS.length;
    haltQuiz.isQuizDone = false;
    document.getElementById('halt-reveal').disabled = false;
    renderHaltQuestion();
  });
}

function renderHaltQuestion() {
  const level = HALT_LEVELS[haltQuiz.idx];
  const n = haltQuiz.idx + 1;
  const q = document.getElementById('halt-question');
  q.innerHTML = `<div class="quiz-badge-wrap">
    <span class="quiz-level-badge">
      HALT Level ${level.level}</span></div>
    <div class="quiz-progress">
      (${n} of ${HALT_LEVELS.length})</div>
    <p class="quiz-prompt">
      What does failure at HALT Level ${level.level}
      indicate, and what should you facilitate?</p>`;
  document.getElementById('halt-next').textContent =
    n < HALT_LEVELS.length ? 'Next Level' : 'Start Over';
}

function initSquatQuiz() {
  squatQuiz.idx = 0;
  squatQuiz.isQuizDone = false;
  renderSquatQuestion();
  document.getElementById('squat-reveal').addEventListener('click', function() {
    if (squatQuiz.isQuizDone) return;
    squatQuiz.isQuizDone = true;
    this.disabled = true;
    const level = SQUAT_LEVELS[squatQuiz.idx];
    const parts = [
      ['Ability', level.ability],
      ['Inability', level.inability]
    ];
    if (level.hyperactive) {
      parts.push(['Hyperactive', level.hyperactive]);
    }
    const feedbackHtml = parts.map(
      ([k, v]) => '<strong>' + k + ':</strong> ' + expandAbbr(v)
    ).join('<br>');
    document.getElementById('squat-question').innerHTML +=
      '<div class="feedback-box">' + feedbackHtml + '</div>';
  });
  document.getElementById('squat-next').addEventListener('click', () => {
    squatQuiz.idx = (squatQuiz.idx + 1) % SQUAT_LEVELS.length;
    squatQuiz.isQuizDone = false;
    document.getElementById('squat-reveal').disabled = false;
    renderSquatQuestion();
  });
}

function renderSquatQuestion() {
  const level = SQUAT_LEVELS[squatQuiz.idx];
  const n = squatQuiz.idx + 1;
  const q = document.getElementById('squat-question');
  q.innerHTML = `<div class="quiz-badge-wrap">
    <span class="quiz-level-badge">
      Squat Level ${level.level}</span></div>
    <div class="quiz-progress">
      (${n} of ${SQUAT_LEVELS.length})</div>
    <p class="quiz-prompt">
      What failure pattern and which muscles are
      hyperactive at Squat Level ${level.level}?</p>`;
  document.getElementById('squat-next').textContent =
    n < SQUAT_LEVELS.length ? 'Next Level' : 'Start Over';
}
