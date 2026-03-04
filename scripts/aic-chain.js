const SVG_NS = 'http://www.w3.org/2000/svg';

let aicChain = [];
let aicDetail = {};
let activeId = null;
let containerEl = null;
let panelEl = null;
let overlayEl = null;
let leaderEl = null;
let imgEl = null;
let detailEl = null;

async function init() {
  containerEl = document.querySelector('.aic-chain-container');
  if (!containerEl) return;

  const resp = await fetch('data/aic-chain.json');
  const data = await resp.json();
  aicChain = data.chain;
  aicDetail = data.detail;

  panelEl = containerEl.querySelector('.aic-chain-panel');
  overlayEl = containerEl.querySelector('.aic-chain-overlay');
  imgEl = containerEl.querySelector('.aic-chain-img');
  leaderEl = containerEl.parentElement.querySelector('.aic-leader-svg');
  detailEl = containerEl.parentElement.querySelector('.aic-chain-detail');
  if (!detailEl) {
    detailEl = document.createElement('div');
    detailEl.className = 'aic-chain-detail';
    containerEl.parentElement.appendChild(detailEl);
  }

  buildPanel();
  setupOverlay();
  attachListeners();

  window.addEventListener('resize', handleResize);
}

function buildPanel() {
  const frag = document.createDocumentFragment();

  aicChain.forEach(function(muscle, i) {
    const row = document.createElement('div');
    row.className = 'aic-chain-row ' + muscle.priColor;
    row.dataset.muscleId = muscle.id;
    row.textContent = muscle.label;
    frag.appendChild(row);

    if (i < aicChain.length - 1 && muscle.connection) {
      const conn = document.createElement('div');
      conn.className = 'aic-chain-connection';
      conn.textContent = '\u2193 ' + muscle.connection;
      frag.appendChild(conn);
    }

    if (i === aicChain.length - 1) {
      const terminal = document.createElement('div');
      terminal.className = 'aic-chain-connection aic-chain-terminal';
      terminal.textContent = '(long head \u2014 terminal)';
      frag.appendChild(terminal);
    }
  });

  panelEl.appendChild(frag);
}

function setupOverlay() {
  overlayEl.setAttribute('viewBox', '0 0 100 100');
  overlayEl.setAttribute('preserveAspectRatio', 'none');

  const views = ['anterior', 'posterior'];
  aicChain.forEach(function(muscle) {
    views.forEach(function(view) {
      const coords = muscle.anchor[view];
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(coords[0]));
      circle.setAttribute('cy', String(coords[1]));
      circle.setAttribute('r', '3');
      circle.setAttribute('class', muscle.priColor);
      circle.setAttribute('fill', 'var(--pri-fg)');
      circle.setAttribute('fill-opacity', '0.4');
      circle.setAttribute('stroke', 'var(--pri-fg)');
      circle.setAttribute('stroke-width', '0.5');
      circle.setAttribute('data-muscle-id', muscle.id);
      circle.setAttribute('data-view', view);
      circle.style.cursor = 'pointer';
      circle.style.pointerEvents = 'all';
      overlayEl.appendChild(circle);
    });
  });
}

function attachListeners() {
  panelEl.addEventListener('click', function(e) {
    const row = e.target.closest('.aic-chain-row');
    if (!row) return;
    e.stopPropagation();
    activateMuscle(row.dataset.muscleId);
  });

  overlayEl.addEventListener('click', function(e) {
    const circle = e.target.closest('circle[data-muscle-id]');
    if (!circle) return;
    e.stopPropagation();
    activateMuscle(circle.dataset.muscleId);
  });

  containerEl.parentElement.addEventListener('click', function(e) {
    if (e.target.closest('.aic-chain-row')) return;
    if (e.target.closest('circle[data-muscle-id]')) return;
    deactivateAll();
  });
}

function activateMuscle(id) {
  if (activeId === id) {
    deactivateAll();
    return;
  }

  deactivateAll();
  activeId = id;

  const entry = aicChain.find(function(m) { return m.id === id; });
  if (!entry) return;

  const row = panelEl.querySelector(
      '.aic-chain-row[data-muscle-id="' + id + '"]');
  if (row) {
    row.classList.add('active');
    row.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }

  showPulseCircle(entry);
  drawLeaderLine(row, entry);
  showDetail(entry);
}

function deactivateAll() {
  activeId = null;

  const rows = panelEl.querySelectorAll('.aic-chain-row');
  rows.forEach(function(r) { r.classList.remove('active'); });

  clearSvg(leaderEl);
  removePulseCircle();
  if (detailEl) detailEl.textContent = '';
}

function showDetail(entry) {
  if (!detailEl) return;
  detailEl.textContent = '';
  const info = aicDetail[entry.id];
  if (!info) return;

  const panel = document.createElement('div');
  panel.className = 'detail-panel ' + entry.priColor;

  const heading = document.createElement('h3');
  heading.textContent = entry.label;
  panel.appendChild(heading);

  const fields = [
    {label: 'Role', value: info.role},
    {label: 'L AIC Pattern', value: info.pattern},
    {label: 'Correction', value: info.correction}
  ];
  fields.forEach(function(f) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'detail-label';
    labelEl.textContent = f.label;
    row.appendChild(labelEl);
    const valEl = document.createElement('span');
    valEl.style.fontSize = 'var(--text-sm)';
    valEl.textContent = f.value;
    row.appendChild(valEl);
    panel.appendChild(row);
  });

  detailEl.appendChild(panel);
}

function showPulseCircle(entry) {
  removePulseCircle();

  ['anterior', 'posterior'].forEach(function(view) {
    const coords = entry.anchor[view];
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(coords[0]));
    circle.setAttribute('cy', String(coords[1]));
    circle.setAttribute('r', '2');
    circle.setAttribute('class', 'aic-anchor-pulse ' + entry.priColor);
    circle.style.pointerEvents = 'none';
    overlayEl.appendChild(circle);
  });
}

function removePulseCircle() {
  const pulses = overlayEl.querySelectorAll('.aic-anchor-pulse');
  pulses.forEach(function(el) { el.remove(); });
}

function resolveColor(entry) {
  const temp = document.createElement('div');
  temp.className = entry.priColor;
  temp.style.display = 'none';
  document.body.appendChild(temp);
  const color = getComputedStyle(temp).getPropertyValue('--pri-fg').trim();
  document.body.removeChild(temp);
  return color;
}

function drawLeaderLine(rowEl, entry) {
  clearSvg(leaderEl);
  if (!rowEl || !entry) return;

  const color = resolveColor(entry);

  const tabSection = containerEl.parentElement;
  const sectionRect = tabSection.getBoundingClientRect();

  const leaderW = sectionRect.width;
  const leaderH = sectionRect.height;
  leaderEl.setAttribute('viewBox',
      '0 0 ' + leaderW + ' ' + leaderH);
  leaderEl.style.width = leaderW + 'px';
  leaderEl.style.height = leaderH + 'px';

  const rowRect = rowEl.getBoundingClientRect();
  const startX = rowRect.right - sectionRect.left;
  const startY = rowRect.top + rowRect.height / 2 - sectionRect.top;

  const imgRect = imgEl.getBoundingClientRect();

  const markerId = 'aic-arrowhead-' + entry.id;
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'strokeWidth');

  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', '0 0, 8 3, 0 6');
  polygon.setAttribute('fill', color);
  marker.appendChild(polygon);
  defs.appendChild(marker);
  leaderEl.appendChild(defs);

  const paths = [];
  ['anterior', 'posterior'].forEach(function(view) {
    const coords = entry.anchor[view];
    const endX = imgRect.left + (coords[0] / 100) * imgRect.width -
        sectionRect.left;
    const endY = imgRect.top + (coords[1] / 100) * imgRect.height -
        sectionRect.top;

    const midX = startX + (endX - startX) * 0.5;

    const pathD = 'M ' + startX + ' ' + startY +
        ' Q ' + midX + ' ' + startY + ' ' + endX + ' ' + endY;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#' + markerId + ')');
    path.classList.add('aic-leader-path');

    const totalLength = approximateQuadLength(
        startX, startY, midX, startY, endX, endY);
    path.style.strokeDasharray = String(totalLength);
    path.style.strokeDashoffset = String(totalLength);

    leaderEl.appendChild(path);
    paths.push(path);
  });

  requestAnimationFrame(function() {
    paths.forEach(function(p) {
      p.style.transition = 'stroke-dashoffset 200ms ease-out';
      p.style.strokeDashoffset = '0';
    });
  });
}

function approximateQuadLength(x0, y0, cx, cy, x1, y1) {
  let length = 0;
  let prevX = x0;
  let prevY = y0;
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const invT = 1 - t;
    const px = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
    const py = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;
    const dx = px - prevX;
    const dy = py - prevY;
    length += Math.sqrt(dx * dx + dy * dy);
    prevX = px;
    prevY = py;
  }
  return length;
}

function clearSvg(svg) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

function handleResize() {
  if (!activeId) return;
  const entry = aicChain.find(function(m) { return m.id === activeId; });
  const row = panelEl.querySelector(
      '.aic-chain-row[data-muscle-id="' + activeId + '"]');
  if (entry && row) {
    drawLeaderLine(row, entry);
  }
}

export {init};

document.addEventListener('DOMContentLoaded', init);
