import { loadAndRender, loadJson } from './load.js';

const CONCEPT_MAP_W = 500, CONCEPT_MAP_H = 340;
const CONCEPT_MAP_PAD = 20;
const LABEL_PAD = 4;
const EDGE_LABEL_OFFSET_DIST = 18;
const NODE_TEXT_CHAR_WIDTH = 5.2;
const NODE_BOX_PAD = 12;
const NODE_MIN_WIDTH = 60;
const EDGE_START_GAP = 1.5;
const EDGE_END_GAP = 4.5;

let CONCEPT_MAP = null;

const containerEl = document.getElementById('concept-map-wrap');

const pxToViewBox = (node) => ({
  cx: CONCEPT_MAP_PAD + node.x / 100 * (CONCEPT_MAP_W - 2 * CONCEPT_MAP_PAD),
  cy: CONCEPT_MAP_PAD + node.y / 100 * (CONCEPT_MAP_H - 2 * CONCEPT_MAP_PAD)
});

const nodeId = (nodeKey) => 'concept-map-' + nodeKey;
const parseNodeKey = (nodeDomId) => nodeDomId.replace(/^concept-map-/, '');
const edgeKey = (fromKey, toKey) => fromKey + '--to--' + toKey;
const edgeLineId = (fromKey, toKey) => 'concept-map-edge-' + edgeKey(fromKey, toKey);
const edgeLabelId = (fromKey, toKey) => 'concept-map-edge-label-' + edgeKey(fromKey, toKey);

function forEachConceptMapEdge(visitEdge) {
  Object.entries(CONCEPT_MAP).forEach(([fromKey, node]) => {
    Object.entries(node.to || {}).forEach(([toKey, edge]) => {
      visitEdge(fromKey, toKey, edge);
    });
  });
}

function edgeGeometry(fromKey, toKey) {
  const sourceBounds = rectBounds(
    document.getElementById(nodeId(fromKey)).querySelector('rect')
  );
  const targetBounds = rectBounds(
    document.getElementById(nodeId(toKey)).querySelector('rect')
  );
  const rawStart = rectBoundaryPoint(sourceBounds, rectCenter(targetBounds));
  const rawEnd = rectBoundaryPoint(targetBounds, rectCenter(sourceBounds));
  const dx = rawEnd.x - rawStart.x;
  const dy = rawEnd.y - rawStart.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const start = {
    x: rawStart.x + ux * EDGE_START_GAP,
    y: rawStart.y + uy * EDGE_START_GAP
  };
  const end = {
    x: rawEnd.x - ux * EDGE_END_GAP,
    y: rawEnd.y - uy * EDGE_END_GAP
  };
  return { start, end };
}

function buildEdgeLines() {
  const lines = [];
  forEachConceptMapEdge((fromKey, toKey) => {
    const { start, end } = edgeGeometry(fromKey, toKey);
    lines.push(`<line class="map-edge"
      id="${edgeLineId(fromKey, toKey)}"
      x1="${start.x}" y1="${start.y}"
      x2="${end.x}" y2="${end.y}"
      marker-end="url(#arrow-map)"/>`);
  });
  return lines.join('');
}

function buildEdgeLabels() {
  const labels = [];
  forEachConceptMapEdge((fromKey, toKey, edge) => {
    const f = pxToViewBox(CONCEPT_MAP[fromKey]);
    const t = pxToViewBox(CONCEPT_MAP[toKey]);
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
      ox = mx + (-dy / len) * EDGE_LABEL_OFFSET_DIST;
      oy = my + (dx / len) * EDGE_LABEL_OFFSET_DIST;
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
  return Object.entries(CONCEPT_MAP).map(([key, node]) => {
    const p = pxToViewBox(node);
    const lines = node.name.split('\n');
    const maxLen = Math.max(...lines.map((l) => l.length));
    const rw = Math.max(NODE_MIN_WIDTH, maxLen * NODE_TEXT_CHAR_WIDTH + NODE_BOX_PAD);
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

const rectBounds = (rectEl) => ({
  left: rectEl.x.baseVal.value,
  top: rectEl.y.baseVal.value,
  width: rectEl.width.baseVal.value,
  height: rectEl.height.baseVal.value
});

const rectCenter = (bounds) => ({
  x: bounds.left + bounds.width / 2,
  y: bounds.top + bounds.height / 2
});

function rectBoundaryPoint(bounds, towardPoint) {
  const center = rectCenter(bounds);
  const dx = towardPoint.x - center.x;
  const dy = towardPoint.y - center.y;
  if (!dx && !dy) return center;

  const tx = dx > 0
    ? (bounds.left + bounds.width - center.x) / dx
    : dx < 0
      ? (bounds.left - center.x) / dx
      : Infinity;
  const ty = dy > 0
    ? (bounds.top + bounds.height - center.y) / dy
    : dy < 0
      ? (bounds.top - center.y) / dy
      : Infinity;
  const t = Math.min(tx, ty);
  return {
    x: center.x + dx * t,
    y: center.y + dy * t
  };
}

function buildEdgesByNode(graph) {
  const edgesByNode = {};
  Object.keys(graph).forEach((key) => edgesByNode[key] = []);
  Object.entries(graph).forEach(([fromKey, node]) =>
    Object.keys(node.to || {}).forEach((toKey) => {
      const edge = { fromKey, toKey };
      edgesByNode[fromKey].push(edge);
      edgesByNode[toKey].push(edge);
    })
  );
  return edgesByNode;
}

function initNodeHighlight(svg) {
  let activeNode = null;
  const edgesByNode = buildEdgesByNode(CONCEPT_MAP);

  function toggleHighlight(nodeKey, isHighlighted) {
    const classMethod = isHighlighted ? 'add' : 'remove';
    const markerEnd = isHighlighted ? 'url(#arrow-map-hl)' : 'url(#arrow-map)';

    edgesByNode[nodeKey].forEach(({ fromKey, toKey }) => {
      const edgeEl = document.getElementById(edgeLineId(fromKey, toKey));
      const otherKey = fromKey === nodeKey ? toKey : fromKey;
      const otherNodeEl = document.getElementById(nodeId(otherKey));
      edgeEl.classList[classMethod]('highlighted');
      edgeEl.setAttribute('marker-end', markerEnd);
      otherNodeEl.classList[classMethod]('highlighted');
    });
  }

  function clearHighlight() {
    if (!activeNode) return;
    const nodeKey = parseNodeKey(activeNode.id);
    activeNode.classList.remove('highlighted');
    toggleHighlight(nodeKey, false);
    activeNode = null;
  }

  function highlightNode(nodeEl) {
    activeNode = nodeEl;
    const nodeKey = parseNodeKey(nodeEl.id);
    nodeEl.classList.add('highlighted');
    toggleHighlight(nodeKey, true);
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
  // Nodes must exist before edge geometry is measured, but edges must still
  // render beneath nodes and labels, so keep these as two ordered inserts.
  defs.insertAdjacentHTML('afterend', buildNodes() + buildEdgeLabels());
  defs.insertAdjacentHTML('afterend', buildEdgeLines());
  sizeEdgeLabelBoxes();
  initNodeHighlight(svg);
}

await loadAndRender({
  load: () => loadJson('./data/concept-map.json'),
  container: containerEl,
  render: (data) => {
    CONCEPT_MAP = data;
    buildConceptMap();
  }
});
