import {createResizeHandle} from './resize-handle.js';
import {showFetchError} from './fetch-feedback.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const STATE_DEFAULTS = {
  imageId: null,
  mechanic: null,
  flipped: false,
  structures: null,
  structureCount: 0,
  current: null,
  score: 0,
  attempts: 0,
  filter: 'all'
};

function defaultState() {
  return Object.assign({}, STATE_DEFAULTS, {
    queue: [],
    identified: new Set(),
    firstAttempt: new Set()
  });
}

const state = defaultState();

let isMobile = false;
let initialized = false;
let attemptedOnCurrent = false;
let reviewMode = false;

let anatomizeData = null;
let activeImageBtn = null;
let activeFilterBtn = null;

async function loadAnatomizeData(errorContainer) {
  if (anatomizeData) return true;
  try {
    const resp = await fetch('data/anatomize-data.json');
    if (!resp.ok) {
      showFetchError(errorContainer, 'anatomy images');
      return false;
    }
    anatomizeData = await resp.json();
    return true;
  } catch (fetchErr) {
    showFetchError(errorContainer, 'anatomy images');
    return false;
  }
}

const RE_IMG_ID = /^anat-img-(.+)$/;
const RE_LABEL_ID = /^anat-(.+)-label$/;
const RE_HITBOX_ID = /^anat-(.+)-hitbox$/;
const RE_BTN_ID = /^anat-(.+)-btn$/;

function priColorClass(priColor) {
  return priColor ? priColor.replace('--', '') : 'pri-neutral';
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
  const imageIds = anatomizeData ? Object.keys(anatomizeData.images) : [];
  if (imageIds.length === 0) return false;
  const hashParts = location.hash.replace(/^#/, '').split('/');
  const hashImageId = (hashParts[0] === 'anatomy' &&
      hashParts[1] === 'anatomize' && hashParts[2]) ?
      hashParts[2] : null;
  const startId = (hashImageId && getImageSet(hashImageId)) ?
      hashImageId : imageIds[0];
  loadImageSet(startId, true);
  return true;
}

function initScoreText() {
  const scoreText = document.createElement('span');
  scoreText.className = 'score-display';
  scoreText.id = 'anat-score-text';
  document.getElementById('anat-score').appendChild(scoreText);
}

function initListeners() {
  isMobile = window.matchMedia('(max-width: 600px)').matches;
  window.matchMedia('(max-width: 600px)').addEventListener(
      'change', (e) => {
        isMobile = e.matches;
        if (state.imageId) {
          resetSession();
        }
      });

  document.getElementById('anat-reset').addEventListener('click', resetSession);

  const nextBtn = document.getElementById('anat-next');
  nextBtn.addEventListener('click', () => {
    if (nextBtn.classList.contains('disabled')) return;
    if (nextBtn.dataset.action === 'reset') {
      resetSession();
      return;
    }
    nextBtn.classList.add('disabled');
    promptNext();
  });
  nextBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      nextBtn.click();
    }
  });

  const anatomizePanel = document.getElementById('anatomy-anatomize');
  if (anatomizePanel) {
    anatomizePanel.addEventListener('subtab-shown', () => {
      if (!initialized && startImageFromHash()) {
        initialized = true;
      } else if (initialized) {
        drawArrows();
      }
    });
  }
}

async function initAnatomize() {
  const loaded = await loadAnatomizeData('#anatomy-anatomize');
  if (!loaded) return;

  initScoreText();
  renderImageSelector();
  renderControls();
  initListeners();
  initResizeHandle();

  if (startImageFromHash()) {
    initialized = true;
  }
}

function resetAnatomize() {
  resetState();
  reviewMode = false;
  document.getElementById('anat-arena').textContent = '';
  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Next \u2192';
  delete nextBtn.dataset.action;
  nextBtn.classList.add('disabled');
  document.getElementById('anat-score-text').textContent = '';
  document.getElementById('anat-detail').textContent = '';
}

function resetState() {
  Object.assign(state, defaultState());
  attemptedOnCurrent = false;
}

function renderImageSelector() {
  document.getElementById('anat-image-selector').textContent = '';
  if (!anatomizeData) return;

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

function renderControls() {
  document.getElementById('anat-filter').textContent = '';
  const filters = [
    {key: 'all', label: 'All'},
    {key: 'muscles', label: 'Muscles'},
    {key: 'landmarks', label: 'Landmarks'}
  ];
  filters.forEach((f) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = f.label;
    btn.dataset.filter = f.key;
    if (f.key === state.filter) {
      btn.classList.add('active');
      activeFilterBtn = btn;
    }
    document.getElementById('anat-filter').appendChild(btn);
  });
  document.getElementById('anat-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn || btn.disabled) return;
    activeFilterBtn?.classList.remove('active');
    btn.classList.add('active');
    activeFilterBtn = btn;
    state.filter = btn.dataset.filter;
    resetSession();
  });
}

function updateFilterDisabled() {
  const imgSet = getImageSet(state.imageId);
  if (!imgSet) return;

  document.getElementById('anat-filter').querySelectorAll('button').forEach((btn) => {
    const filter = btn.dataset.filter;
    if (filter === 'all') {
      btn.disabled = false;
      return;
    }
    const count = Object.values(imgSet.structures)
        .filter((s) => matchesFilter(s, filter)).length;
    btn.disabled = count < 4;
  });
}

function matchesFilter(structure, filter) {
  if (filter === 'all') return true;
  if (filter === 'muscles') {
    return structure.type === 'muscle' || structure.type === 'ligament' ||
        structure.type === 'connective';
  }
  if (filter === 'landmarks') return structure.type === 'landmark';
  return true;
}

function getImageSet(imageId) {
  if (!anatomizeData) return null;
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
  state.mechanic = imgSet.mechanic;
  state.flipped = imgSet.flipped || false;
  document.getElementById('anat-arena').classList.toggle('anatomize-dark-bg',
      imgSet.theme === 'dark');

  if (!skipHash) {
    const hash = 'anatomy/anatomize/' + imageId;
    if (location.hash.replace(/^#/, '') !== hash) {
      location.hash = hash;
    }
  }

  activeImageBtn?.classList.remove('active');
  activeImageBtn = document.getElementById('anat-img-' + imageId);
  activeImageBtn?.classList.add('active');

  const vals = Object.values(imgSet.structures);
  const hasMuscles = vals.some(
      (s) => s.type === 'muscle' || s.type === 'ligament');
  const hasLandmarks = vals.some(
      (s) => s.type === 'landmark');
  const showFilter = hasMuscles && hasLandmarks;
  document.getElementById('anat-filter').hidden = !showFilter;
  document.getElementById('anat-reset').hidden = !showFilter;

  if (!showFilter) {
    state.filter = 'all';
  }
  updateFilterDisabled();
  resetSession();
}

function resetSession() {
  const imgSet = getImageSet(state.imageId);
  if (!imgSet) return;

  state.score = 0;
  state.identified = new Set();
  state.firstAttempt = new Set();
  state.attempts = 0;
  state.current = null;
  attemptedOnCurrent = false;
  reviewMode = false;
  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Next \u2192';
  delete nextBtn.dataset.action;

  state.structures = Object.create(null);
  state.structureCount = 0;
  for (const id in imgSet.structures) {
    if (matchesFilter(imgSet.structures[id], state.filter)) {
      state.structures[id] = imgSet.structures[id];
      state.structureCount++;
    }
  }
  state.queue = shuffle(Object.keys(state.structures));

  document.getElementById('anat-detail').textContent = '';
  nextBtn.classList.add('disabled');

  if (state.mechanic === 'blank_panels') {
    renderBlankPanels(imgSet);
  } else if (isMobile) {
    renderMobile(imgSet);
  } else if (state.mechanic === 'label_hunt') {
    renderLabelHunt(imgSet);
  }

  updateScore();
  promptNext();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createArenaWrap(imgSet) {
  document.getElementById('anat-arena').textContent = '';
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
      labelDiv.style.cssText = 'left:' + pb.x + '%;top:' + pb.y
          + '%;width:' + pb.w + '%;height:' + pb.h + '%'
          + (imgSet.flipped ? ';transform:scaleX(-1)' : '');
      const labelText = document.createElement('span');
      labelText.className = 'anatomize-label-text';
      labelText.textContent = s.label;
      labelDiv.appendChild(labelText);
      wrap.appendChild(labelDiv);
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
  document.getElementById('anat-arena').appendChild(wrap);

  wrap.addEventListener('click', (e) => {
    const label = e.target.closest('.anatomize-label');
    if (!label) return;
    const m = label.id.match(RE_LABEL_ID);
    if (m) structureClickHandler(m[1]);
  });

  hookImageLoad();
}

function drawArrows() {
  const wrap = document.getElementById('anat-arena').querySelector('.anatomize-arena-wrap');
  const svg = wrap?.querySelector('.anatomize-svg-overlay');
  if (!wrap || !svg) return;
  
  const wrapRect = wrap.getBoundingClientRect();
  if (wrapRect.width === 0 || wrapRect.height === 0) return;

  for (const id in state.structures) {
    const s = state.structures[id];
    if (!s.panelBox) continue;
    const group = document.getElementById('anat-' + id);
    const labelDiv = document.getElementById('anat-' + id + '-label');
    if (!group || !labelDiv) continue;
    if (group.querySelector('.anatomize-arrow-line')) continue;

    const labelRect = labelDiv.getBoundingClientRect();
    const box = {
      x: (labelRect.left - wrapRect.left) / wrapRect.width * 100,
      y: (labelRect.top - wrapRect.top) / wrapRect.height * 100,
      w: labelRect.width / wrapRect.width * 100,
      h: labelRect.height / wrapRect.height * 100
    };
    const ep = edgePoint(box, s.arrowTo);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', ep.x);
    line.setAttribute('y1', ep.y);
    line.setAttribute('x2', s.arrowTo.x);
    line.setAttribute('y2', s.arrowTo.y);
    line.classList.add('anatomize-arrow-line');
    group.appendChild(line);

    const arrowHead = createArrowHead(
        ep.x, ep.y, s.arrowTo.x, s.arrowTo.y);
    arrowHead.classList.add('anatomize-arrowhead');
    group.appendChild(arrowHead);
  }
}

function createArrowHead(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', `${x2},${y2}`);
    return poly;
  }
  const ux = dx / len;
  const uy = dy / len;
  const size = 1.3;
  const px = -uy;
  const py = ux;
  const tipX = x2;
  const tipY = y2;
  const baseX1 = x2 - ux * size + px * size * 0.4;
  const baseY1 = y2 - uy * size + py * size * 0.4;
  const baseX2 = x2 - ux * size - px * size * 0.4;
  const baseY2 = y2 - uy * size - py * size * 0.4;
  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points',
      `${tipX},${tipY} ${baseX1},${baseY1} ${baseX2},${baseY2}`);
  return poly;
}

function renderLabelHunt(imgSet) {
  const wrap = createArenaWrap(imgSet);

  for (const id in state.structures) {
    const s = state.structures[id];
    if (!s.hitbox) continue;
    const hitbox = document.createElement('div');
    hitbox.className = 'anatomize-hitbox';
    hitbox.id = 'anat-' + id + '-hitbox';
    hitbox.style.cssText = 'left:' + s.hitbox.x + '%;top:' + s.hitbox.y
        + '%;width:' + s.hitbox.w + '%;height:' + s.hitbox.h + '%';
    hitbox.setAttribute('role', 'button');
    hitbox.setAttribute('tabindex', '0');
    hitbox.setAttribute('aria-label', s.label);
    wrap.appendChild(hitbox);
  }

  wrap.addEventListener('click', (e) => {
    const hitbox = e.target.closest('.anatomize-hitbox');
    if (!hitbox) return;
    const m = hitbox.id.match(RE_HITBOX_ID);
    if (m) structureClickHandler(m[1]);
  });

  document.getElementById('anat-arena').appendChild(wrap);

  hookImageLoad();
}

function renderMobile(imgSet) {
  const wrap = createArenaWrap(imgSet);

  document.getElementById('anat-arena').appendChild(wrap);

  const list = document.createElement('div');
  list.className = 'anatomize-mobile-list';

  const shuffledIds = shuffle(Object.keys(state.structures));
  shuffledIds.forEach((id) => {
    const s = state.structures[id];
    const btn = document.createElement('button');
    btn.className = 'btn anatomize-mobile-btn';
    btn.id = 'anat-' + id + '-btn';
    if (state.mechanic === 'label_hunt') {
      btn.textContent = s.label;
    } else {
      btn.textContent = '\u00A0';
    }
    list.appendChild(btn);
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.anatomize-mobile-btn');
    if (!btn) return;
    const m = btn.id.match(RE_BTN_ID);
    if (m) structureClickHandler(m[1]);
  });

  document.getElementById('anat-arena').appendChild(list);
}

function promptNext() {
  if (state.queue.length === 0) {
    endSession();
    return;
  }
  state.current = state.queue.shift();
  attemptedOnCurrent = false;
  document.getElementById('anat-next').classList.add('disabled');

  const structure = state.structures[state.current];
  if (structure) {
    renderPromptPanel(structure);
  }
}

const createNameRow = (() => {
  const rowTpl = document.createElement('div');
  rowTpl.className = 'anatomize-detail-name-row';
  const bullet = document.createElement('span');
  bullet.className = 'anatomize-detail-bullet';
  rowTpl.appendChild(bullet);
  const nameTpl = document.createElement('span');
  nameTpl.className = 'anatomize-detail-name';
  rowTpl.appendChild(nameTpl);

  return function createNameRow(label) {
    const row = rowTpl.cloneNode(true);
    row.lastChild.textContent = label;
    return row;
  };
})();

const createRevealLayer = (() => {
  const layerTpl = document.createElement('div');
  layerTpl.className = 'anatomize-detail-layer';
  layerTpl.hidden = true;

  const btnTpl = document.createElement('button');
  btnTpl.className = 'btn anatomize-detail-btn';

  return function createRevealLayer(fields, buttonLabel, panel) {
    const wrapper = layerTpl.cloneNode(false);
    fields.forEach(([key, label, data]) => {
      if (data) wrapper.appendChild(createDetailRow(label, data));
    });
    const btn = btnTpl.cloneNode(false);
    btn.textContent = buttonLabel;
    btn.addEventListener('click', () => {
      wrapper.hidden = false;
      btn.hidden = true;
    });
    panel.appendChild(btn);
    panel.appendChild(wrapper);
  };
})();

function renderPromptPanel(structure) {
  document.getElementById('anat-detail').textContent = '';
  const panel = document.createElement('div');
  panel.className = 'anatomize-detail-panel';
  panel.classList.add(priColorClass(structure.priColor));
  panel.appendChild(createNameRow(structure.label));

  const hint = document.createElement('p');
  hint.className = 'anatomize-detail-hint';
  hint.textContent = 'Identify on image';
  panel.appendChild(hint);

  document.getElementById('anat-detail').appendChild(panel);
}

function structureClickHandler(structureId) {
  if (reviewMode) {
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
  state.attempts++;
  if (correct) {
    state.score++;
    state.identified.add(structureId);
    if (!attemptedOnCurrent) {
      state.firstAttempt.add(structureId);
    }
    renderVisualFeedback(structureId, true);
    updateScore();

    const structure = state.structures[structureId];
    if (structure) {
      renderDetailPanel(structure);
    }

    showNextButton();
  } else {
    state.score--;
    attemptedOnCurrent = true;
    renderVisualFeedback(structureId, false);
    updateScore();
  }
}

function showNextButton() {
  const nextBtn = document.getElementById('anat-next');
  nextBtn.classList.remove('disabled');
  if (state.queue.length === 0) {
    nextBtn.textContent = 'Finish';
  }
}

function renderVisualFeedback(structureId, correct) {
  if (state.mechanic === 'blank_panels') {
    renderBlankPanelsFeedback(structureId, correct);
  } else if (isMobile) {
    renderMobileFeedback(structureId, correct);
  } else if (state.mechanic === 'label_hunt') {
    renderLabelHuntFeedback(structureId, correct);
  }
}

function flashWrongFeedback(el, wrongClass) {
  el.classList.add(wrongClass);
  const xMark = document.createElement('span');
  xMark.className = 'anatomize-x';
  xMark.textContent = '\u2717';
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
    check.textContent = '\u2713';
    htmlLabel.appendChild(check);
  } else {
    flashWrongFeedback(htmlLabel, 'wrong');
  }
}

function renderLabelHuntFeedback(structureId, correct) {
  const hitbox = document.getElementById('anat-' + structureId + '-hitbox');
  if (!hitbox) return;

  const structure = state.structures[structureId];
  if (!structure) return;

  if (correct) {
    hitbox.classList.add(priColorClass(structure.priColor), 'correct');
    const check = document.createElement('span');
    check.className = 'anatomize-check';
    check.textContent = '\u2713';
    hitbox.appendChild(check);
  } else {
    flashWrongFeedback(hitbox, 'anatomize-hitbox-wrong');
  }
}

function renderMobileFeedback(structureId, correct) {
  const btn = document.getElementById('anat-' + structureId + '-btn');
  if (!btn) return;

  const structure = state.structures[structureId];
  if (!structure) return;

  if (correct) {
    btn.classList.add(priColorClass(structure.priColor), 'correct');
    btn.textContent = structure.label + ' \u2713';
  } else {
    flashWrongFeedback(btn, 'wrong');
  }
}

function renderDetailPanel(structure) {
  document.getElementById('anat-detail').textContent = '';

  const panel = document.createElement('div');
  panel.className = 'anatomize-detail-panel';
  panel.classList.add(priColorClass(structure.priColor));

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
        ? 'Bony landmark \u2014 no PRI color assignment.'
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
  return prox + ' \u2192 ' + dist;
}

const createDetailRow = (() => {
  const rowTpl = document.createElement('div');
  rowTpl.className = 'detail-row';
  const labelTpl = document.createElement('span');
  labelTpl.className = 'detail-label';
  rowTpl.appendChild(labelTpl);
  const valTpl = document.createElement('span');
  valTpl.className = 'detail-value';
  rowTpl.appendChild(valTpl);

  return function createDetailRow(label, value) {
    const row = rowTpl.cloneNode(true);
    row.firstChild.textContent = label;
    const text = (typeof value === 'object' && value !== null &&
        (value.proximal || value.distal)) ?
        formatAttachments(value) : value;
    // JSON data contains <abbr> tags — HTML in data, not ideal.
    const prop = (typeof text === 'string' && text.includes('<')) ?
        'innerHTML' : 'textContent';
    row.lastChild[prop] = text;
    return row;
  };
})();

function endSession() {
  state.current = null;
  reviewMode = true;

  const nextBtn = document.getElementById('anat-next');
  nextBtn.textContent = 'Reset';
  nextBtn.classList.remove('disabled');
  nextBtn.dataset.action = 'reset';

  if (isMobile) {
    document.getElementById('anat-arena').querySelector('.anatomize-mobile-list')
        ?.classList.add('review');
  }

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
  document.getElementById('anat-score-text').textContent = `Score: ${state.score} \u00b7 ` +
      `${state.identified.size} of ${state.structureCount}`;
}

function initResizeHandle() {
  const body = document.getElementById('anat-body');
  if (!body) return;

  const imageCol = body.querySelector('.anatomize-image-col');
  const infoCol = body.querySelector('.anatomize-info-col');
  if (!imageCol || !infoCol) return;

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
  const img = document.getElementById('anat-arena').querySelector('img');
  if (!img) return;
  if (img.complete && img.naturalWidth) {
    drawArrows();
  } else {
    img.addEventListener('load', drawArrows, {once: true});
  }
}

export {initAnatomize, resetAnatomize, loadImageSet};
