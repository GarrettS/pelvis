import { showFetchError } from './fetch-feedback.js';

let CHEAT_DATA, CAUSAL_MAP, SYMPTOM_PATTERNS, HALT_LEVELS, SQUAT_LEVELS;
let MAP_NODES, MAP_EDGES;

let symptomIdx = 0;
let symptomScore = { correct: 0, total: 0 };
let isSymptomAnswered = false;
let haltIdx = 0;
let haltAnswered = false;
let haltScore = { correct: 0, total: 0 };
let squatIdx = 0;
let squatAnswered = false;
let squatScore = { correct: 0, total: 0 };

export async function initPatterns() {
  try {
    const urls = [
      'data/cheat-data.json', 'data/causal-map.json',
      'data/symptom-patterns.json', 'data/halt-levels.json',
      'data/squat-levels.json'
    ];
    const responses = await Promise.all(urls.map(function(u) { return fetch(u); }));
    const badResp = responses.find(function(r) { return !r.ok; });
    if (badResp) {
      showFetchError('#tab-patterns', 'pattern data');
      return;
    }
    const results = await Promise.all(responses.map(function(r) { return r.json(); }));
    CHEAT_DATA = results[0];
    CAUSAL_MAP = results[1];
    SYMPTOM_PATTERNS = results[2];
    HALT_LEVELS = results[3];
    SQUAT_LEVELS = results[4];
  } catch (_) {
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
  CHEAT_DATA.forEach(function(col) {
    const div = document.createElement('div');
    div.className = 'cheat-col';
    let html = '<div class="cheat-col-header">' + col.name + '</div>';
    col.rows.forEach(function(row) {
      const cls = row.key ? (col.name.includes('Patho') ? 'cheat-row key-warn' : 'cheat-row key') : 'cheat-row';
      html += '<div class="' + cls + '"><span>' + row.l + '</span><span>' + row.v + '</span></div>';
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
  MAP_EDGES.forEach(function(edge, i) {
    const fromNode = MAP_NODES.find(function(n) { return n.id === edge.from; });
    const toNode = MAP_NODES.find(function(n) { return n.id === edge.to; });
    if (!fromNode || !toNode) return;
    const f = px(fromNode), t = px(toNode);
    const mx = (f.cx + t.cx) / 2, my = (f.cy + t.cy) / 2;
    edgeSVG += '<line class="map-edge" data-edge="' + i + '" x1="' + f.cx + '" y1="' + f.cy + '" x2="' + t.cx + '" y2="' + t.cy + '" marker-end="url(#arrow-map)"/>';
    edgeSVG += '<text class="map-edge-label" x="' + mx + '" y="' + (my - 4) + '" text-anchor="middle">' + edge.label + '</text>';
  });

  let nodeSVG = '';
  MAP_NODES.forEach(function(node) {
    const p = px(node);
    const lines = node.label.split('\n');
    const rw = 75, rh = lines.length > 2 ? 38 : 28;
    const rx = p.cx - rw / 2, ry = p.cy - rh / 2;
    const fillColor = node.central ? 'var(--accent-bg)' : 'var(--surface)';
    const strokeColor = node.central ? 'var(--accent)' : 'var(--border)';
    nodeSVG += '<g class="map-node' + (node.central ? ' central' : '') + '" data-id="' + node.id + '" transform="translate(0,0)">'
      + '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" rx="4" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="1.5"/>';
    lines.forEach(function(l, li) {
      nodeSVG += '<text x="' + p.cx + '" y="' + (ry + 11 + li * 11) + '" text-anchor="middle" font-family="monospace" font-size="8.5" fill="var(--text)">' + l + '</text>';
    });
    nodeSVG += '</g>';
  });

  svg.innerHTML = '<defs>'
    + '<marker id="arrow-map" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--border)"/></marker>'
    + '<marker id="arrow-map-hl" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--accent)"/></marker>'
    + '</defs>'
    + edgeSVG + nodeSVG;

  svg.addEventListener('click', function(e) {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl) return;
    const nodeId = nodeEl.dataset.id;
    const connectedEdges = MAP_EDGES
      .map(function(edge, i) { return { from: edge.from, to: edge.to, i: i }; })
      .filter(function(edge) { return edge.from === nodeId || edge.to === nodeId; })
      .map(function(edge) { return edge.i; });

    svg.querySelectorAll('.map-node').forEach(function(n) { n.classList.remove('highlighted'); });
    svg.querySelectorAll('.map-edge').forEach(function(edge) {
      edge.classList.remove('highlighted');
      edge.setAttribute('marker-end', 'url(#arrow-map)');
      edge.style.stroke = '';
    });

    nodeEl.classList.add('highlighted');
    connectedEdges.forEach(function(i) {
      const edgeEl = svg.querySelector('.map-edge[data-edge="' + i + '"]');
      if (edgeEl) {
        edgeEl.classList.add('highlighted');
        edgeEl.setAttribute('marker-end', 'url(#arrow-map-hl)');
        edgeEl.style.stroke = 'var(--accent)';
      }
      const edgeData = MAP_EDGES[i];
      const otherId = edgeData.from === nodeId ? edgeData.to : edgeData.from;
      const otherEl = svg.querySelector('.map-node[data-id="' + otherId + '"]');
      if (otherEl) otherEl.classList.add('highlighted');
    });
  });
}

function initSymptomQuiz() {
  symptomIdx = 0;
  renderSymptomQuestion();

  document.getElementById('symptom-next').addEventListener('click', function() {
    symptomIdx = (symptomIdx + 1) % SYMPTOM_PATTERNS.length;
    isSymptomAnswered = false;
    renderSymptomQuestion();
  });

  document.getElementById('symptom-answers').addEventListener('click', function(e) {
    const btn = e.target.closest('.answer-btn');
    if (!btn || isSymptomAnswered) return;
    isSymptomAnswered = true;
    const current = SYMPTOM_PATTERNS[symptomIdx];
    const chosen = btn.dataset.ans;
    const strictCorrect = chosen === current.pattern;
    symptomScore.total++;
    if (strictCorrect) symptomScore.correct++;
    document.getElementById('symptom-score').textContent = 'Score: ' + symptomScore.correct + ' / ' + symptomScore.total;

    const btns = document.querySelectorAll('#symptom-answers .answer-btn');
    btns.forEach(function(b) {
      if (b.dataset.ans === current.pattern) b.classList.add('correct');
      else if (b === btn && !strictCorrect) b.classList.add('incorrect');
      b.disabled = true;
    });

    const feedback = document.getElementById('symptom-feedback');
    feedback.className = 'feedback-box' + (strictCorrect ? '' : ' error');
    feedback.innerHTML = '<strong>' + (strictCorrect ? 'Correct.' : 'Incorrect.') + '</strong> ' + current.explanation;
    feedback.classList.remove('hidden');
    document.getElementById('symptom-next').classList.remove('hidden');
  });
}

function renderSymptomQuestion() {
  const current = SYMPTOM_PATTERNS[symptomIdx];
  document.getElementById('symptom-condition').textContent = current.condition;
  document.getElementById('symptom-feedback').classList.add('hidden');
  document.getElementById('symptom-next').classList.add('hidden');
  document.querySelectorAll('#symptom-answers .answer-btn').forEach(function(b) {
    b.classList.remove('correct', 'incorrect');
    b.disabled = false;
  });
}

function initHaltQuiz() {
  haltIdx = 0;
  haltAnswered = false;
  renderHaltQuestion();
  document.getElementById('halt-reveal').addEventListener('click', function() {
    if (haltAnswered) return;
    haltAnswered = true;
    const level = HALT_LEVELS[haltIdx];
    const q = document.getElementById('halt-question');
    q.innerHTML += '<div class="feedback-box" style="margin-top:.75rem;">'
      + '<strong>Answer:</strong> ' + level.failure + '<br>'
      + '<strong>Facilitate:</strong> ' + level.facilitate
      + '</div>';
  });
  document.getElementById('halt-next').addEventListener('click', function() {
    haltIdx = (haltIdx + 1) % HALT_LEVELS.length;
    haltAnswered = false;
    renderHaltQuestion();
  });
}

function renderHaltQuestion() {
  const level = HALT_LEVELS[haltIdx];
  const q = document.getElementById('halt-question');
  q.innerHTML = '<div style="margin-bottom:.5rem;"><span class="quiz-level-badge">HALT Level ' + level.level + '</span></div>'
    + '<div style="font-size:var(--text-sm);color:var(--text-dim);">(' + (haltIdx + 1) + ' of ' + HALT_LEVELS.length + ')</div>'
    + '<p style="margin-top:.5rem;font-size:var(--text-sm);">What does failure at HALT Level ' + level.level + ' indicate, and what should you facilitate?</p>';
}

function initSquatQuiz() {
  squatIdx = 0;
  squatAnswered = false;
  renderSquatQuestion();
  document.getElementById('squat-reveal').addEventListener('click', function() {
    if (squatAnswered) return;
    squatAnswered = true;
    const level = SQUAT_LEVELS[squatIdx];
    const q = document.getElementById('squat-question');
    q.innerHTML += '<div class="feedback-box" style="margin-top:.75rem;">'
      + '<strong>Failure:</strong> ' + level.failure + '<br>'
      + '<strong>Hyperactive muscles:</strong> ' + level.hyperactive
      + '</div>';
  });
  document.getElementById('squat-next').addEventListener('click', function() {
    squatIdx = (squatIdx + 1) % SQUAT_LEVELS.length;
    squatAnswered = false;
    renderSquatQuestion();
  });
}

function renderSquatQuestion() {
  const level = SQUAT_LEVELS[squatIdx];
  const q = document.getElementById('squat-question');
  q.innerHTML = '<div style="margin-bottom:.5rem;"><span class="quiz-level-badge">Squat Level ' + level.level + '</span></div>'
    + '<div style="font-size:var(--text-sm);color:var(--text-dim);">(' + (squatIdx + 1) + ' of ' + SQUAT_LEVELS.length + ')</div>'
    + '<p style="margin-top:.5rem;font-size:var(--text-sm);">What failure pattern and which muscles are hyperactive at Squat Level ' + level.level + '?</p>';
}
