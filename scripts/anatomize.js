import {createResizeHandle} from './resize-handle.js';
import {expandAbbr} from './abbr-expand.js';
import {shuffle} from './shuffle.js';
import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {newEl, newSvg} from './el-create.js';
import * as progress from './anatomize-progress.js';

const sessions = Object.create(null);
let activeSession = null;

let anatomizeData = null;
let activeImageBtn = null;
let drawFrameId = null;

const percentBox = b => `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`;

const RE_IMG_ID = /^anat-img-(.+)$/;
const RE_LABEL_ID = /^anat-(.+)-label$/;

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
    const color = priColorClass(s.priColor);

    this.#line = newSvg('line', {className: 'anatomize-arrow-line'});
    this.#head = newSvg('polygon', {className: 'anatomize-arrowhead'});
    this.#group = newSvg('g', {
      id: `anat-${this.id}`,
      className: color,
      children: [
        newSvg('circle', {
          className: 'anatomize-target-circle',
          r: 1.8,
          cx: s.arrowTo.x,
          cy: s.arrowTo.y
        }),
        this.#line,
        this.#head
      ]
    });

    this.#labelDiv = newEl('div', {
      id: `anat-${this.id}-label`,
      className: `anatomize-label ${color}`,
      style: percentBox(s.panelBox),
      children: [newEl('span', {
        className: 'anatomize-label-text',
        textContent: s.label
      })]
    });

    document.getElementById('anat-arena-svg').append(this.#group);
    document.getElementById('anat-arena-wrap').append(this.#labelDiv);
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
    this.#labelDiv.append(newEl('span', {
      className: 'anatomize-check',
      textContent: '✓'
    }));
  }

  flashWrong() {
    this.#labelDiv.classList.add('wrong');
    const xMark = newEl('span', {
      className: 'anatomize-x',
      textContent: '✗'
    });
    this.#labelDiv.append(xMark);
    setTimeout(() => {
      xMark.remove();
      this.#labelDiv.classList.remove('wrong');
    }, 1000);
  }
}

await attemptLoad({
  loader: () => loadJson('./data/anatomize-data.json'),
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
  document.getElementById('anat-score').append(newEl('span', {
    id: 'anat-score-text',
    className: 'score-display'
  }));
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
  const selector = document.getElementById('anat-image-selector');
  selector.textContent = '';

  Object.entries(anatomizeData.images).forEach(([id, imgSet]) => {
    selector.append(newEl('button', {
      id: 'anat-img-' + id,
      className: 'btn',
      textContent: imgSet.label
    }));
  });

  selector.addEventListener('click', (e) => {
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

  activeImageBtn?.removeAttribute('aria-current');
  activeImageBtn = document.getElementById('anat-img-' + imageId);
  activeImageBtn?.setAttribute('aria-current', 'true');

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
  return newEl('div', {
    id: 'anat-arena-wrap',
    className: 'anatomize-arena-wrap',
    children: [newEl('img', {
      src: imgSet.imageSrc,
      alt: imgSet.label,
      decoding: 'async',
      fetchPriority: 'high',
      loading: 'eager',
      draggable: false
    })]
  });
}

function createSideLabels(svg, imgSet) {
  if (!imgSet.sideLabels) return;

  const sl = imgSet.sideLabels;
  [
    {text: sl.left, x: 8, anchor: 'start'},
    {text: sl.right, x: 92, anchor: 'end'}
  ].forEach((cfg) => {
    const shadow = newSvg('text', {
      x: cfg.x,
      y: 5,
      'text-anchor': cfg.anchor,
      'font-size': 3,
      className: 'anatomize-side-label-shadow',
      children: [cfg.text]
    });
    svg.append(shadow);

    const label = shadow.cloneNode(true);
    label.classList.replace('anatomize-side-label-shadow', 'anatomize-side-label');
    svg.append(label);
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
  arenaEl.append(wrap);

  const svg = newSvg('svg', {
    id: 'anat-arena-svg',
    viewBox: '0 0 100 100',
    preserveAspectRatio: 'none',
    className: 'anatomize-svg-overlay'
  });
  wrap.append(svg);

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
  return newEl('div', {
    className: 'anatomize-detail-name-row',
    children: [
      newEl('span', {className: 'anatomize-detail-bullet'}),
      newEl('span', {className: 'anatomize-detail-name', textContent: label})
    ]
  });
}

function createDetailRow(label, value) {
  const text = (value?.proximal || value?.distal)
      ? formatAttachments(value) : value;
  const valueEl = newEl('span', {className: 'detail-value'});
  valueEl.innerHTML = expandAbbr(text);
  return newEl('div', {
    className: 'detail-row',
    children: [
      newEl('span', {className: 'detail-label', textContent: label}),
      valueEl
    ]
  });
}

function createRevealLayer(fields, buttonLabel, panel) {
  const layer = newEl('div', {className: 'anatomize-detail-layer'});
  fields.forEach(([, label, data]) =>
      data && layer.append(createDetailRow(label, data)));
  panel.append(newEl('details', {
    children: [
      newEl('summary', {
        className: 'btn anatomize-detail-btn',
        textContent: buttonLabel
      }),
      layer
    ]
  }));
}

function renderPromptPanel(structure) {
  const detail = document.getElementById('anat-detail');
  detail.textContent = '';
  detail.append(newEl('div', {
    className: 'anatomize-detail-panel ' + priColorClass(structure.priColor),
    children: [
      createNameRow(structure.label),
      newEl('p', {
        className: 'anatomize-detail-hint',
        textContent: 'Identify on image'
      })
    ]
  }));
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
  const detail = document.getElementById('anat-detail');
  detail.textContent = '';

  const layer1 = newEl('div', {
    className: 'anatomize-detail-layer',
    children: [createNameRow(structure.label)]
  });

  const priDetail = structure.priDetail;
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
      if (l1[key]) layer1.append(createDetailRow(label, l1[key]));
    });
  }

  const panel = newEl('div', {
    className: 'anatomize-detail-panel ' + priColorClass(structure.priColor),
    children: [layer1]
  });

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

  detail.append(panel);
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

  document.getElementById('anat-detail').append(newEl('div', {
    className: 'anatomize-end-summary',
    textContent: `Complete. Score: ${activeSession.score}. Accuracy: ${accuracy}%.`
  }));
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
