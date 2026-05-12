import {createResizeHandle} from './resize-handle.js';
import {expandAbbr} from './abbr-expand.js';
import {shuffle} from './shuffle.js';
import {loadAndRender, loadJson} from './load.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  imageId: null,
  structures: null,
  structureCount: 0,
  current: null,
  score: 0,
  attemptedOnCurrent: false,
  reviewMode: false,
  queue: [],
  identified: new Set(),
  firstAttempt: new Set()
};

let anatomizeData = null;
let activeImageBtn = null;
let arrowWrap = null;
let drawFrameId = null;
const arrowSites = new Map();

const percentBox = b => `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`;

const RE_IMG_ID = /^anat-img-(.+)$/;
const RE_LABEL_ID = /^anat-(.+)-label$/;

const el = (tag, className, text = '') => Object.assign(
    document.createElement(tag), {className, textContent: text});

const containerEl = document.getElementById('anatomy-anatomize-content');
const arenaEl = document.getElementById('anat-arena');

await loadAndRender({
  load: () => loadJson('./data/anatomize-data.json'),
  container: containerEl,
  render: (data) => {
    anatomizeData = data;
    initScoreText();
    renderImageSelector();
    initListeners();
    initResizeHandle();
    startImageFromHash();
    new ResizeObserver(drawArrows).observe(arenaEl);
  }
});

function priColorClass(priColor) {
  return priColor || 'pri-neutral';
}

function resolveStructures(imgEntry, shared) {
  if (imgEntry.structures) return imgEntry.structures;
  if (imgEntry.structuresRef && shared[imgEntry.structuresRef]) {
    return shared[imgEntry.structuresRef];
  }
  return null;
}

/**
 * Returns the point on the edge of `box` closest to `target`.
 * All values in the 0-100 SVG coordinate space.
 */
function edgePoint(box, target) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (dx === 0 && dy === 0) return {x: cx, y: cy};
  const hw = box.w / 2;
  const hh = box.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return {x: cx + dx * s, y: cy + dy * s};
}

function startImageFromHash() {
  const imageIds = Object.keys(anatomizeData.images);
  if (imageIds.length === 0) return;
  const hashParts = location.hash.replace(/^#/, '').split('/');
  const hashImageId = (hashParts[0] === 'anatomy' &&
      hashParts[1] === 'anatomize' && hashParts[2]) ?
      hashParts[2] : null;
  const startId = (hashImageId && getImageSet(hashImageId)) ?
      hashImageId : imageIds[0];
  loadImageSet(startId, true);
}

function initScoreText() {
  const scoreText = document.createElement('span');
  scoreText.className = 'score-display';
  scoreText.id = 'anat-score-text';
  document.getElementById('anat-score').appendChild(scoreText);
}

function initListeners() {
  document.getElementById('anat-reset').addEventListener('click', resetSession);

  const nextBtn = document.getElementById('anat-next');
  nextBtn.addEventListener('click', () => {
    if (nextBtn.dataset.action === 'reset') {
      resetSession();
      return;
    }
    nextBtn.disabled = true;
    promptNext();
  });
}

function renderImageSelector() {
  document.getElementById('anat-image-selector').textContent = '';

  Object.entries(anatomizeData.images).forEach(([id, imgSet]) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'anat-img-' + id;
    btn.textContent = imgSet.label;
    document.getElementById('anat-image-selector').appendChild(btn);
  });

  document.getElementById('anat-image-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const m = btn.id.match(RE_IMG_ID);
    if (m) loadImageSet(m[1]);
  });
}

function getImageSet(imageId) {
  const entry = anatomizeData.images[imageId];
  if (!entry) return null;
  return Object.assign({}, entry, {
    structures: resolveStructures(entry, anatomizeData.sharedStructures)
  });
}

function loadImageSet(imageId, skipHash) {
  const imgSet = getImageSet(imageId);
  if (!imgSet) return;

  state.imageId = imageId;
  arenaEl.classList.toggle('anatomize-dark-bg', imgSet.theme === 'dark');

  if (!skipHash) {
    const hash = 'anatomy/anatomize/' + imageId;
    if (location.hash.replace(/^#/, '') !== hash) {
      location.hash = hash;
    }
  }

  activeImageBtn?.classList.remove('active');
  activeImageBtn = document.getElementById('anat-img-' + imageId);
  activeImageBtn?.classList.add('active');

  resetSession();
}

function resetSession() {
  const imgSet = getImageSet(state.imageId);
  if (!imgSet) return;

  state.score = 0;
  state.identified = new Set();
  state.firstAttempt = new Set();
  state.current = null;
  state.attemptedOnCurrent = false;
  state.reviewMode = false;
  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Next →';
  delete nextBtn.dataset.action;

  state.structures = imgSet.structures;
  state.structureCount = Object.keys(imgSet.structures).length;
  state.queue = shuffle(Object.keys(state.structures));

  document.getElementById('anat-detail').textContent = '';
  nextBtn.disabled = true;

  renderBlankPanels(imgSet);

  updateScore();
  promptNext();
}


function createArenaWrap(imgSet) {
  arenaEl.textContent = '';
  const wrap = document.createElement('div');
  wrap.className = 'anatomize-arena-wrap';
  if (imgSet.flipped) {
    wrap.classList.add('anatomize-flipped');
  }
  const img = document.createElement('img');
  img.src = imgSet.imageSrc;
  img.alt = imgSet.label;
  img.draggable = false;
  wrap.appendChild(img);
  return wrap;
}

function createSideLabels(svg, imgSet) {
  if (!imgSet.sideLabels) return;

  const sl = imgSet.sideLabels;
  [
    {text: sl.left, x: 8, anchor: 'start'},
    {text: sl.right, x: 92, anchor: 'end'}
  ].forEach((cfg) => {
    const shadow = document.createElementNS(SVG_NS, 'text');
    shadow.setAttribute('x', cfg.x);
    shadow.setAttribute('y', 5);
    shadow.setAttribute('text-anchor', cfg.anchor);
    shadow.setAttribute('font-size', 3);
    shadow.classList.add('anatomize-side-label-shadow');
    shadow.textContent = cfg.text;
    if (imgSet.flipped) {
      shadow.setAttribute('transform',
          'translate(' + cfg.x + ',5) scale(-1,1) translate(' + -cfg.x + ',-5)');
    }
    svg.appendChild(shadow);

    const label = shadow.cloneNode(true);
    label.classList.replace('anatomize-side-label-shadow', 'anatomize-side-label');
    svg.appendChild(label);
  });
}

function createStructureOverlays(svg, wrap, imgSet) {
  arrowWrap = wrap;
  arrowSites.clear();

  const markerTpl = document.createElementNS(SVG_NS, 'circle');
  markerTpl.setAttribute('r', '1.8');
  markerTpl.classList.add('anatomize-target-circle');

  for (const id in state.structures) {
    const s = state.structures[id];
    const group = document.createElementNS(SVG_NS, 'g');
    group.id = 'anat-' + id;
    group.classList.add(priColorClass(s.priColor));

    const marker = markerTpl.cloneNode(false);
    marker.setAttribute('cx', s.arrowTo.x);
    marker.setAttribute('cy', s.arrowTo.y);
    group.appendChild(marker);

    if (s.panelBox) {
      const pb = s.panelBox;
      const labelDiv = document.createElement('div');
      labelDiv.className = 'anatomize-label';
      labelDiv.classList.add(priColorClass(s.priColor));
      labelDiv.id = 'anat-' + id + '-label';
      // CSS min-width: fit-content ensures readability on small images.
      labelDiv.style.cssText = percentBox(pb)
          + (imgSet.flipped ? ';transform:scaleX(-1)' : '');
      const labelText = document.createElement('span');
      labelText.className = 'anatomize-label-text';
      labelText.textContent = s.label;
      labelDiv.appendChild(labelText);
      wrap.appendChild(labelDiv);

      const line = document.createElementNS(SVG_NS, 'line');
      line.classList.add('anatomize-arrow-line');
      group.appendChild(line);

      const head = document.createElementNS(SVG_NS, 'polygon');
      head.classList.add('anatomize-arrowhead');
      group.appendChild(head);

      arrowSites.set(id, {line, head, labelDiv, arrowTo: s.arrowTo});
    }

    svg.appendChild(group);
  }
}

function renderBlankPanels(imgSet) {
  const wrap = createArenaWrap(imgSet);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('anatomize-svg-overlay');

  createSideLabels(svg, imgSet);
  createStructureOverlays(svg, wrap, imgSet);

  wrap.appendChild(svg);
  arenaEl.appendChild(wrap);

  wrap.addEventListener('click', labelClickHandler);

  hookImageLoad();
}

function drawArrows() {
  if (drawFrameId) return;

  drawFrameId = requestAnimationFrame(() => {
    if (!arrowWrap) {
      drawFrameId = null;
      return;
    }

    const wrapRect = arrowWrap.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) {
      drawFrameId = null;
      return;
    }

    const measurements = [];
    for (const site of arrowSites.values()) {
      measurements.push({
        site,
        labelRect: site.labelDiv.getBoundingClientRect()
      });
    }

    for (const {site, labelRect} of measurements) {
      const {line, head, arrowTo} = site;
      const box = {
        x: (labelRect.left - wrapRect.left) / wrapRect.width * 100,
        y: (labelRect.top - wrapRect.top) / wrapRect.height * 100,
        w: labelRect.width / wrapRect.width * 100,
        h: labelRect.height / wrapRect.height * 100
      };
      const ep = edgePoint(box, arrowTo);

      line.setAttribute('x1', ep.x);
      line.setAttribute('y1', ep.y);
      line.setAttribute('x2', arrowTo.x);
      line.setAttribute('y2', arrowTo.y);

      head.setAttribute('points',
          arrowHeadPoints(ep.x, ep.y, arrowTo.x, arrowTo.y));
    }

    drawFrameId = null;
  });
}

function arrowHeadPoints(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return `${x2},${y2}`;
  const ux = dx / len;
  const uy = dy / len;
  const size = 1.3;
  const halfWidth = size * 0.4;
  const px = -uy;
  const py = ux;
  const baseX1 = x2 - ux * size + px * halfWidth;
  const baseY1 = y2 - uy * size + py * halfWidth;
  const baseX2 = x2 - ux * size - px * halfWidth;
  const baseY2 = y2 - uy * size - py * halfWidth;
  return `${x2},${y2} ${baseX1},${baseY1} ${baseX2},${baseY2}`;
}

function promptNext() {
  if (state.queue.length === 0) {
    endSession();
    return;
  }
  state.current = state.queue.shift();
  state.attemptedOnCurrent = false;
  document.getElementById('anat-next').disabled = true;

  const structure = state.structures[state.current];
  if (structure) {
    renderPromptPanel(structure);
  }
}

function createNameRow(label) {
  const row = el('div', 'anatomize-detail-name-row');
  row.append(
      el('span', 'anatomize-detail-bullet'),
      el('span', 'anatomize-detail-name', label));
  return row;
}

function createDetailRow(label, value) {
  const text = (value?.proximal || value?.distal)
      ? formatAttachments(value) : value;
  const valueEl = el('span', 'detail-value');
  valueEl.innerHTML = expandAbbr(text);
  const row = el('div', 'detail-row');
  row.append(el('span', 'detail-label', label), valueEl);
  return row;
}

function createRevealLayer(fields, buttonLabel, panel) {
  const details = document.createElement('details');
  const layer = el('div', 'anatomize-detail-layer');
  fields.forEach(([, label, data]) =>
      data && layer.append(createDetailRow(label, data)));
  details.append(
      el('summary', 'btn anatomize-detail-btn', buttonLabel),
      layer);
  panel.append(details);
}

function renderPromptPanel(structure) {
  document.getElementById('anat-detail').textContent = '';
  const panel = document.createElement('div');
  panel.className = 'anatomize-detail-panel '
    + priColorClass(structure.priColor);
  panel.appendChild(createNameRow(structure.label));

  const hint = document.createElement('p');
  hint.className = 'anatomize-detail-hint';
  hint.textContent = 'Identify on image';
  panel.appendChild(hint);

  document.getElementById('anat-detail').appendChild(panel);
}

function labelClickHandler(e) {
  const label = e.target.closest('.anatomize-label');
  if (!label) return;

  const structureId = label.id.match(RE_LABEL_ID);
  if (structureId) assessSelectedStructure(structureId[1]);
}

function assessSelectedStructure(structureId) {
  if (state.reviewMode) {
    const structure = state.structures[structureId];
    if (structure) {
      renderDetailPanel(structure);
    }
    return;
  }
  if (!state.current) return;
  if (state.identified.has(structureId)) return;

  const correct = structureId === state.current;
  scoreAttempt(structureId, correct);
}

function scoreAttempt(structureId, correct) {
  if (correct) {
    state.score++;
    state.identified.add(structureId);
    if (!state.attemptedOnCurrent) {
      state.firstAttempt.add(structureId);
    }
    renderBlankPanelsFeedback(structureId, true);
    updateScore();

    const structure = state.structures[structureId];
    if (structure) {
      renderDetailPanel(structure);
    }

    showNextButton();
  } else {
    state.score--;
    state.attemptedOnCurrent = true;
    renderBlankPanelsFeedback(structureId, false);
    updateScore();
  }
}

function showNextButton() {
  const nextBtn = document.getElementById('anat-next');
  nextBtn.disabled = false;
  if (state.queue.length === 0) {
    nextBtn.textContent = 'Finish';
  }
}

function flashWrongFeedback(el, wrongClass) {
  el.classList.add(wrongClass);
  const xMark = document.createElement('span');
  xMark.className = 'anatomize-x';
  xMark.textContent = '✗';
  el.appendChild(xMark);
  setTimeout(() => {
    xMark.remove();
    el.classList.remove(wrongClass);
  }, 1000);
}

function renderBlankPanelsFeedback(structureId, correct) {
  const group = document.getElementById('anat-' + structureId);
  if (!group) return;

  const htmlLabel = document.getElementById('anat-' + structureId + '-label');
  if (!htmlLabel) return;

  if (correct) {
    group.classList.add('correct');
    htmlLabel.classList.add('correct');
    const check = document.createElement('span');
    check.className = 'anatomize-check';
    check.textContent = '✓';
    htmlLabel.appendChild(check);
  } else {
    flashWrongFeedback(htmlLabel, 'wrong');
  }
}

function renderDetailPanel(structure) {
  document.getElementById('anat-detail').textContent = '';

  const panel = document.createElement('div');
  panel.className = 'anatomize-detail-panel '
    + priColorClass(structure.priColor);

  const priDetail = structure.priDetail;
  const hasLayers = priDetail && (priDetail.layer2 || priDetail.layer3);

  const layer1 = document.createElement('div');
  layer1.className = 'anatomize-detail-layer';
  layer1.appendChild(createNameRow(structure.label));

  if (priDetail && priDetail.layer1) {
    const l1 = priDetail.layer1;
    [
      ['standard', 'Standard'],
      ['attachments', 'Attachments'],
      ['actions', 'Actions'],
      ['movements', 'Movements'],
      ['pri', 'PRI'],
      ['chain', 'Chain']
    ].forEach(([key, label]) => {
      if (l1[key]) layer1.appendChild(createDetailRow(label, l1[key]));
    });
  }

  if (!hasLayers && priDetail && priDetail.layer1 &&
      !priDetail.layer1.pri) {
    const note = document.createElement('p');
    note.className = 'anatomize-detail-hint';
    note.textContent = structure.type === 'landmark'
        ? 'Bony landmark — no PRI color assignment.'
        : 'Not a primary PRI muscle.';
    layer1.appendChild(note);
  }

  panel.appendChild(layer1);

  if (priDetail && priDetail.layer2) {
    createRevealLayer([
      ['laic', 'Pattern Role', priDetail.layer2.laic],
      ['pathology', 'Pathology', priDetail.layer2.pathology]
    ], 'Show Pattern Role', panel);
  }

  if (priDetail && priDetail.layer3) {
    createRevealLayer([
      ['treatment', 'Treatment', priDetail.layer3.treatment]
    ], 'Show Treatment', panel);
  }

  document.getElementById('anat-detail').appendChild(panel);
}

function formatAttachments(obj) {
  const prox = (obj.proximal || []).join(', ');
  const dist = (obj.distal || []).join(', ');
  return prox + ' → ' + dist;
}

function endSession() {
  state.current = null;
  state.reviewMode = true;

  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Reset';
  nextBtn.disabled = false;
  nextBtn.dataset.action = 'reset';

  const total = state.structureCount;
  const accuracy = total > 0 ?
      Math.round((state.firstAttempt.size / total) * 100) : 0;

  const summary = document.createElement('div');
  summary.className = 'anatomize-end-summary';
  summary.textContent =
      `Complete. Score: ${state.score}. Accuracy: ${accuracy}%.`;
  document.getElementById('anat-detail').appendChild(summary);
}

function updateScore() {
  document.getElementById('anat-score-text')
    .textContent = 'Score: ' + state.score
      + ' · ' + state.identified.size
      + ' of ' + state.structureCount;
}

function initResizeHandle() {
  const body = document.getElementById('anat-body');
  const imageCol = body.querySelector('.anatomize-image-col');
  const infoCol = body.querySelector('.anatomize-info-col');

  createResizeHandle({
    container: body,
    insertBefore: imageCol,
    resizeTarget: infoCol,
    cssProperty: '--info-w',
    minWidth: 200,
    maxRatio: 0.6,
    canDrag: () => window.matchMedia(
        '(min-width: 1024px) and (orientation: landscape)').matches
  });
}

function hookImageLoad() {
  const img = arenaEl.querySelector('img');
  if (!img) return;
  if (img.complete && img.naturalWidth) {
    drawArrows();
  } else {
    img.addEventListener('load', drawArrows, {once: true});
  }
}
