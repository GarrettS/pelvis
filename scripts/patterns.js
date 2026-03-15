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
  CHEAT_DATA.forEach(col => {
    const div = document.createElement('div');
    div.classList.add('cheat-col');
    let html = '<div class="cheat-col-header">' + expandAbbr(col.name) + '</div>';
    col.rows.forEach(row => {
      const cls = row.key ? (col.name.includes('Patho') ? 'cheat-row key-warn' : 'cheat-row key') : 'cheat-row';
      html += '<div class="' + cls + '"><span>' + expandAbbr(row.l) + '</span><span>' + expandAbbr(row.v) + '</span></div>';
    });
    div.innerHTML = html;
    grid.appendChild(div);
  });
}

function buildConceptMap() {
  const svg = document.getElementById('concept-map-svg');
  const W = 500, H = 340;
  const PADDING = 20;

  function px(node) {
    return {
      cx: PADDING + node.x / 100 * (W - 2 * PADDING),
      cy: PADDING + node.y / 100 * (H - 2 * PADDING)
    };
  }

  let edgeSVG = '';
  MAP_EDGES.forEach((edge, i) => {
    const fromNode = MAP_NODES[edge.from];
    const toNode = MAP_NODES[edge.to];
    if (!fromNode || !toNode) return;
    const f = px(fromNode), t = px(toNode);
    const mx = (f.cx + t.cx) / 2, my = (f.cy + t.cy) / 2;
    edgeSVG += '<line class="map-edge" id="cmap-edge-' + i + '" x1="' + f.cx + '" y1="' + f.cy + '" x2="' + t.cx + '" y2="' + t.cy + '" marker-end="url(#arrow-map)"/>';
    edgeSVG += '<text class="map-edge-label" x="' + mx + '" y="' + (my - 4) + '" text-anchor="middle">' + edge.label + '</text>';
  });

  let nodeSVG = '';
  Object.keys(MAP_NODES).forEach(id => {
    const node = MAP_NODES[id];
    const p = px(node);
    const lines = node.label.split('\n');
    const rw = 75, rh = lines.length > 2 ? 38 : 28;
    const rx = p.cx - rw / 2, ry = p.cy - rh / 2;
    const fillColor = node.central ? 'var(--accent-bg)' : 'var(--surface)';
    const strokeColor = node.central ? 'var(--accent)' : 'var(--border)';
    nodeSVG += '<g class="map-node' + (node.central ? ' central' : '') + '" id="' + id + '" transform="translate(0,0)">'
      + '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" rx="4" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="1.5"/>';
    lines.forEach((l, li) => {
      nodeSVG += '<text x="' + p.cx + '" y="' + (ry + 11 + li * 11) + '" text-anchor="middle" font-family="monospace" font-size="8.5" fill="var(--text)">' + l + '</text>';
    });
    nodeSVG += '</g>';
  });

  svg.innerHTML = '<defs>'
    + '<marker id="arrow-map" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--border)"/></marker>'
    + '<marker id="arrow-map-hl" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--accent)"/></marker>'
    + '</defs>'
    + edgeSVG + nodeSVG;

  svg.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl) return;
    const nodeId = nodeEl.id;
    const connectedEdges = MAP_EDGES
      .map((edge, i) => ({ from: edge.from, to: edge.to, i }))
      .filter(edge => edge.from === nodeId || edge.to === nodeId)
      .map(edge => edge.i);

    svg.querySelectorAll('.map-node').forEach(n => { n.classList.remove('highlighted'); });
    svg.querySelectorAll('.map-edge').forEach(edge => {
      edge.classList.remove('highlighted');
      edge.setAttribute('marker-end', 'url(#arrow-map)');
      edge.style.stroke = '';
    });

    nodeEl.classList.add('highlighted');
    connectedEdges.forEach(i => {
      const edgeEl = document.getElementById('cmap-edge-' + i);
      if (edgeEl) {
        edgeEl.classList.add('highlighted');
        edgeEl.setAttribute('marker-end', 'url(#arrow-map-hl)');
        edgeEl.style.stroke = 'var(--accent)';
      }
      const edgeData = MAP_EDGES[i];
      const otherId = edgeData.from === nodeId ? edgeData.to : edgeData.from;
      const otherEl = document.getElementById(otherId);
      if (otherEl) otherEl.classList.add('highlighted');
    });
  });
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
    symptomQuiz.isQuizDone = true;
    const current = SYMPTOM_PATTERNS[symptomQuiz.idx];
    const chosen = btn.dataset.ans;
    const isCorrect = chosen === current.pattern;
    symptomQuiz.score.total++;
    if (isCorrect) symptomQuiz.score.correct++;
    document.getElementById('symptom-score').textContent = 'Score: ' + symptomQuiz.score.correct + ' / ' + symptomQuiz.score.total;

    const correctBtn = answersEl.querySelector('.answer-btn[data-ans="' + current.pattern + '"]');
    correctBtn.classList.add('correct');
    symptomQuiz.markedBtns = [correctBtn];
    if (!isCorrect) {
      btn.classList.add('incorrect');
      symptomQuiz.markedBtns.push(btn);
    }
    answersEl.classList.add('answered');

    const feedback = document.getElementById('symptom-feedback');
    feedback.classList.toggle('error', !isCorrect);
    feedback.innerHTML = '<strong>' + (isCorrect ? 'Correct.' : 'Incorrect.') + '</strong> ' + current.explanation;
    feedback.classList.remove('hidden');
    document.getElementById('symptom-next').classList.remove('hidden');
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
    const body = parts.map(
      ([k, v]) => '<strong>' + k + ':</strong> ' + expandAbbr(v)
    ).join('<br>');
    document.getElementById('halt-question').innerHTML +=
      '<div class="feedback-box">' + body + '</div>';
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
    const body = parts.map(
      ([k, v]) => '<strong>' + k + ':</strong> ' + expandAbbr(v)
    ).join('<br>');
    document.getElementById('squat-question').innerHTML +=
      '<div class="feedback-box">' + body + '</div>';
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
