import {createResizeHandle} from './resize-handle.js';
import {expandAbbr} from './abbr-expand.js';
import {shuffle} from './shuffle.js';
import {loadAndRender, loadJson} from './load.js';
import * as progress from './anatomize-progress.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const sessions = Object.create(null);
let activeSession = null;

let anatomizeData = null;
let activeImageBtn = null;
let drawFrameId = null;

const percentBox = b => `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`;

const RE_IMG_ID = /^anat-img-(.+)$/;
const RE_LABEL_ID = /^anat-(.+)-label$/;

const el = (tag, className, text = '') => Object.assign(
    document.createElement(tag), {className, textContent: text});

const containerEl = document.getElementById('anatomy-anatomize-content');
const arenaEl = document.getElementById('anat-arena');

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

class BlankPanelSite {
  static #instances = Object.create(null);
  static #KEY = Symbol();

  #structure;
  #group;
  #labelDiv;
  #line;
  #head;

  static getInstance = (id, structure) => BlankPanelSite.#instances[id] ??=
      new BlankPanelSite(id, structure, BlankPanelSite.#KEY);

  static all() {
    return Object.values(BlankPanelSite.#instances);
  }

  static clear() {
    BlankPanelSite.#instances = Object.create(null);
  }

  constructor(id, structure, key) {
    if (key !== BlankPanelSite.#KEY) {
      throw new Error('Use BlankPanelSite.getInstance(id, structure) instead of new');
    }
    if (!structure) {
      throw new Error(`BlankPanelSite.getInstance('${id}') called for unknown structure`);
    }
    this.id = id;
    this.#structure = structure;
    this.#build();
  }

  #build() {
    const s = this.#structure;
    const svg = document.getElementById('anat-arena-svg');
    const wrap = document.getElementById('anat-arena-wrap');
    const colorClass = priColorClass(s.priColor);

    this.#group = document.createElementNS(SVG_NS, 'g');
    this.#group.id = 'anat-' + this.id;
    this.#group.classList.add(colorClass);

    const marker = document.createElementNS(SVG_NS, 'circle');
    marker.setAttribute('r', '1.8');
    marker.classList.add('anatomize-target-circle');
    marker.setAttribute('cx', s.arrowTo.x);
    marker.setAttribute('cy', s.arrowTo.y);
    this.#group.appendChild(marker);

    this.#labelDiv = document.createElement('div');
    this.#labelDiv.className = 'anatomize-label ' + colorClass;
    this.#labelDiv.id = 'anat-' + this.id + '-label';
    this.#labelDiv.style.cssText = percentBox(s.panelBox);

    const labelText = document.createElement('span');
    labelText.className = 'anatomize-label-text';
    labelText.textContent = s.label;
    this.#labelDiv.appendChild(labelText);
    wrap.appendChild(this.#labelDiv);

    this.#line = document.createElementNS(SVG_NS, 'line');
    this.#line.classList.add('anatomize-arrow-line');
    this.#group.appendChild(this.#line);

    this.#head = document.createElementNS(SVG_NS, 'polygon');
    this.#head.classList.add('anatomize-arrowhead');
    this.#group.appendChild(this.#head);

    svg.appendChild(this.#group);
  }

  static measure(site) {
    return site.#labelDiv.getBoundingClientRect();
  }

  draw(wrapRect, labelRect) {
    const arrowTo = this.#structure.arrowTo;
    const box = {
      x: (labelRect.left - wrapRect.left) / wrapRect.width * 100,
      y: (labelRect.top - wrapRect.top) / wrapRect.height * 100,
      w: labelRect.width / wrapRect.width * 100,
      h: labelRect.height / wrapRect.height * 100
    };
    const ep = edgePoint(box, arrowTo);

    this.#line.setAttribute('x1', ep.x);
    this.#line.setAttribute('y1', ep.y);
    this.#line.setAttribute('x2', arrowTo.x);
    this.#line.setAttribute('y2', arrowTo.y);

    this.#head.setAttribute('points',
        arrowHeadPoints(ep.x, ep.y, arrowTo.x, arrowTo.y));
  }

  markCorrect() {
    this.#group.classList.add('correct');
    this.#labelDiv.classList.add('correct');
    const check = document.createElement('span');
    check.className = 'anatomize-check';
    check.textContent = '✓';
    this.#labelDiv.appendChild(check);
  }

  flashWrong() {
    this.#labelDiv.classList.add('wrong');
    const xMark = document.createElement('span');
    xMark.className = 'anatomize-x';
    xMark.textContent = '✗';
    this.#labelDiv.appendChild(xMark);
    setTimeout(() => {
      xMark.remove();
      this.#labelDiv.classList.remove('wrong');
    }, 1000);
  }
}

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

function snapshotSession(session) {
  return {
    score: session.score,
    identified: [...session.identified],
    firstAttempt: [...session.firstAttempt],
    queue: session.queue.slice(),
    current: session.current,
    attemptedOnCurrent: session.attemptedOnCurrent,
    reviewMode: session.reviewMode
  };
}

function persistActive() {
  if (!activeSession) return;

  progress.saveImage(activeSession.imageId, snapshotSession(activeSession));
}

function createSession(imgSet, imageId) {
  const structureIds = Object.keys(imgSet.structures);
  const persisted = progress.loadImage(imageId);
  if (persisted) {
    return {
      imageId,
      structures: imgSet.structures,
      structureCount: structureIds.length,
      score: persisted.score,
      identified: new Set(persisted.identified),
      firstAttempt: new Set(persisted.firstAttempt),
      queue: persisted.queue,
      current: persisted.current,
      attemptedOnCurrent: persisted.attemptedOnCurrent,
      reviewMode: persisted.reviewMode
    };
  }
  return {
    imageId,
    structures: imgSet.structures,
    structureCount: structureIds.length,
    score: 0,
    identified: new Set(),
    firstAttempt: new Set(),
    queue: shuffle(structureIds),
    current: null,
    attemptedOnCurrent: false,
    reviewMode: false
  };
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

  activeSession = sessions[imageId] ??= createSession(imgSet, imageId);
  renderActiveSession(imgSet);
}

function renderActiveSession(imgSet) {
  const session = activeSession;
  const nextBtn = document.getElementById('anat-next');

  document.getElementById('anat-detail').textContent = '';
  renderBlankPanels(imgSet);

  for (const structureId of session.identified) {
    BlankPanelSite.getInstance(structureId, session.structures[structureId])
        .markCorrect();
  }

  updateScore();

  if (session.reviewMode) {
    nextBtn.textContent = 'Reset';
    nextBtn.disabled = false;
    nextBtn.dataset.action = 'reset';
    renderEndSummary();
    return;
  }

  nextBtn.textContent = 'Next →';
  delete nextBtn.dataset.action;
  nextBtn.disabled = true;

  if (session.current && session.structures[session.current]) {
    renderPromptPanel(session.structures[session.current]);
    return;
  }

  promptNext();
}

function resetSession() {
  if (!activeSession) return;
  const session = activeSession;

  session.score = 0;
  session.identified = new Set();
  session.firstAttempt = new Set();
  session.queue = shuffle(Object.keys(session.structures));
  session.current = null;
  session.attemptedOnCurrent = false;
  session.reviewMode = false;

  progress.removeImage(session.imageId);

  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Next →';
  delete nextBtn.dataset.action;
  document.getElementById('anat-detail').textContent = '';
  nextBtn.disabled = true;

  renderBlankPanels(getImageSet(session.imageId));
  updateScore();
  promptNext();
}

function createArenaWrap(imgSet) {
  arenaEl.textContent = '';
  const wrap = document.createElement('div');
  wrap.className = 'anatomize-arena-wrap';
  wrap.id = 'anat-arena-wrap';
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
    svg.appendChild(shadow);

    const label = shadow.cloneNode(true);
    label.classList.replace('anatomize-side-label-shadow', 'anatomize-side-label');
    svg.appendChild(label);
  });
}

function createStructureOverlays() {
  BlankPanelSite.clear();
  for (const id in activeSession.structures) {
    BlankPanelSite.getInstance(id, activeSession.structures[id]);
  }
}

function renderBlankPanels(imgSet) {
  const wrap = createArenaWrap(imgSet);
  arenaEl.appendChild(wrap);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'anat-arena-svg';
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('anatomize-svg-overlay');
  wrap.appendChild(svg);

  createSideLabels(svg, imgSet);
  createStructureOverlays();

  wrap.addEventListener('click', labelClickHandler);

  hookImageLoad();
}

function drawArrows() {
  if (drawFrameId) return;

  drawFrameId = requestAnimationFrame(() => {
    const wrap = document.getElementById('anat-arena-wrap');
    const wrapRect = wrap?.getBoundingClientRect();
    if (!wrapRect || !wrapRect.width || !wrapRect.height) return drawFrameId = null;

    const sites = BlankPanelSite.all();

    const rects = sites.map(BlankPanelSite.measure);
    for (let i = 0; i < sites.length; i++) {
      sites[i].draw(wrapRect, rects[i]);
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
  if (activeSession.queue.length === 0) {
    endSession();
    return;
  }
  activeSession.current = activeSession.queue.shift();
  activeSession.attemptedOnCurrent = false;
  document.getElementById('anat-next').disabled = true;

  const structure = activeSession.structures[activeSession.current];
  if (structure) {
    renderPromptPanel(structure);
  }
  persistActive();
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
  if (activeSession.reviewMode) {
    const structure = activeSession.structures[structureId];
    if (structure) {
      renderDetailPanel(structure);
    }
    return;
  }
  if (!activeSession.current) return;
  if (activeSession.identified.has(structureId)) return;

  const correct = structureId === activeSession.current;
  scoreAttempt(structureId, correct);
}

function scoreAttempt(structureId, correct) {
  if (correct) {
    activeSession.score++;
    activeSession.identified.add(structureId);
    if (!activeSession.attemptedOnCurrent) {
      activeSession.firstAttempt.add(structureId);
    }
    renderBlankPanelsFeedback(structureId, true);
    updateScore();

    const structure = activeSession.structures[structureId];
    if (structure) {
      renderDetailPanel(structure);
    }

    showNextButton();
  } else {
    activeSession.score--;
    activeSession.attemptedOnCurrent = true;
    renderBlankPanelsFeedback(structureId, false);
    updateScore();
  }
  persistActive();
}

function showNextButton() {
  const nextBtn = document.getElementById('anat-next');
  nextBtn.disabled = false;
  if (activeSession.queue.length === 0) {
    nextBtn.textContent = 'Finish';
  }
}

function renderBlankPanelsFeedback(structureId, correct) {
  const site = BlankPanelSite.getInstance(structureId);
  if (correct) {
    site.markCorrect();
  } else {
    site.flashWrong();
  }
}

function renderDetailPanel(structure) {
  document.getElementById('anat-detail').textContent = '';

  const panel = document.createElement('div');
  panel.className = 'anatomize-detail-panel '
    + priColorClass(structure.priColor);

  const priDetail = structure.priDetail;

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
  activeSession.current = null;
  activeSession.reviewMode = true;

  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Reset';
  nextBtn.disabled = false;
  nextBtn.dataset.action = 'reset';

  renderEndSummary();
  persistActive();
}

function renderEndSummary() {
  const total = activeSession.structureCount;
  const accuracy = total > 0 ?
      Math.round((activeSession.firstAttempt.size / total) * 100) : 0;

  const summary = document.createElement('div');
  summary.className = 'anatomize-end-summary';
  summary.textContent =
      `Complete. Score: ${activeSession.score}. Accuracy: ${accuracy}%.`;
  document.getElementById('anat-detail').appendChild(summary);
}

function updateScore() {
  document.getElementById('anat-score-text')
    .textContent = 'Score: ' + activeSession.score
      + ' · ' + activeSession.identified.size
      + ' of ' + activeSession.structureCount;
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
