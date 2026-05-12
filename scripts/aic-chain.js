import {createResizeHandle} from './resize-handle.js';
import {expandAbbr} from './abbr-expand.js';
import {appendErrorCallout, loadAndRender, loadJson} from './load.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEWS = ['anterior', 'posterior'];
const ARROWHEAD_ID = 'aic-arrowhead';

let containerEl = null;
let panelEl = null;
let overlayEl = null;
let leaderEl = null;
let imgEl = null;
let detailEl = null;
let imageColEl = null;
let tabSectionEl = null;

let activeMuscle = null;

let detailFieldRowTemplate = null;
let detailView = null;
let leaderView = null;

class AicMuscle {
  #id;
  #chainEntry;
  #detailEntry;
  #rowEl = null;
  #circlesByView = new Map();
  #mounted = false;

  constructor(id, chainEntry, detailEntry) {
    this.#id = id;
    this.#chainEntry = chainEntry;
    this.#detailEntry = detailEntry;
  }

  label() { return this.#chainEntry.label; }
  priColor() { return this.#chainEntry.priColor; }
  rowEl() { return this.#rowEl; }
  anchor(view) { return this.#chainEntry.anchor[view]; }
  hasDetail() { return Boolean(this.#detailEntry); }
  field(key) { return this.#detailEntry?.[key]; }

  mount(overlayEl) {
    if (this.#mounted) return;

    this.#rowEl = document.getElementById(this.#id);
    VIEWS.forEach((view) => {
      const circle = this.#buildCircle(view);
      overlayEl.appendChild(circle);
      this.#circlesByView.set(view, circle);
    });
    this.#mounted = true;
  }

  activate() {
    this.#rowEl.classList.add('activeMuscle');
    this.#rowEl.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    this.#circlesByView.forEach((circle) => {
      circle.classList.add('activeMuscle');
    });
  }

  deactivate() {
    this.#rowEl.classList.remove('activeMuscle');
    this.#circlesByView.forEach((circle) => {
      circle.classList.remove('activeMuscle');
    });
  }

  #buildCircle(view) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    const [cx, cy] = this.#chainEntry.anchor[view];
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.classList.add(this.#chainEntry.priColor);
    return circle;
  }
}

class AicMuscleFactory {
  static #instances = Object.create(null);
  static #chainData = {};
  static #detailData = {};
  static #fieldLabels = {};

  static acceptData(data) {
    AicMuscleFactory.#chainData = data.chain;
    AicMuscleFactory.#detailData = data.detail;
    AicMuscleFactory.#fieldLabels = data.fieldLabels;
    AicMuscleFactory.#instances = Object.create(null);
  }

  static getInstance(id) {
    return AicMuscleFactory.#instances[id] ??= new AicMuscle(
        id,
        AicMuscleFactory.#chainData[id],
        AicMuscleFactory.#detailData[id]);
  }

  static forEachEntry(callback) {
    Object.entries(AicMuscleFactory.#chainData).forEach(([id, entry]) => {
      callback(id, entry);
    });
  }

  static fieldLabelEntries() {
    return Object.entries(AicMuscleFactory.#fieldLabels);
  }
}

containerEl = document.querySelector('.aic-chain-container');
if (resolveDomRefs()) {
  await loadAndRender({
    load: () => loadJson('./data/aic-chain.json'),
    container: containerEl,
    render: (data) => {
      AicMuscleFactory.acceptData(data);
      resetView();
      buildPanel();
      setupUi();
    }
  });
}

function resolveDomRefs() {
  panelEl = containerEl.querySelector('.aic-chain-panel');
  overlayEl = containerEl.querySelector('.aic-chain-overlay');
  imgEl = containerEl.querySelector('.aic-chain-img');
  detailEl = containerEl.querySelector('.aic-chain-detail');
  imageColEl = containerEl.querySelector('.aic-chain-image-col');
  tabSectionEl = containerEl.parentElement;
  leaderEl = tabSectionEl.querySelector('.aic-leader-svg');

  const missingRef = [
    [panelEl, 'panel'],
    [overlayEl, 'overlay'],
    [imgEl, 'image'],
    [detailEl, 'detail'],
    [imageColEl, 'image column'],
    [leaderEl, 'leader svg']
  ].find(([element]) => !element);

  if (!missingRef) return true;

  appendErrorCallout(
      containerEl,
      'Couldn\'t initialize aic-chain: missing required '
      + missingRef[1] + ' element.'
  );
  return false;
}

function resetView() {
  if (activeMuscle) {
    activeMuscle.deactivate();
    activeMuscle = null;
  }
  panelEl.textContent = '';
  overlayEl.textContent = '';
  leaderEl.textContent = '';
  detailEl.textContent = '';
  detailView = null;
  leaderView = null;
}

function setupUi() {
  panelEl.addEventListener('click', (event) => {
    const rowEl = event.target.closest('.aic-chain-row');
    if (!rowEl) return;

    setActiveMuscle(AicMuscleFactory.getInstance(rowEl.id));
  });

  createResizeHandle({
    container: containerEl,
    insertBefore: imageColEl,
    resizeTarget: panelEl,
    cssProperty: '--panel-w',
    minWidth: 100,
    maxRatio: 0.4,
    onResize: handleResize
  });

  new ResizeObserver(handleResize).observe(tabSectionEl);
}

function buildPanel() {
  const fragment = document.createDocumentFragment();
  AicMuscleFactory.forEachEntry((id, chainEntry) => {
    fragment.appendChild(makeMuscleRow(id, chainEntry));
    if (chainEntry.connection) {
      fragment.appendChild(makeChainNoteRow(chainEntry.connection, false));
    }
    if (chainEntry.terminus) {
      fragment.appendChild(makeChainNoteRow(chainEntry.terminus, true));
    }
  });
  panelEl.appendChild(fragment);
}

function makeMuscleRow(id, chainEntry) {
  const row = document.createElement('div');
  row.classList.add('aic-chain-row', chainEntry.priColor);
  row.id = id;
  row.textContent = chainEntry.label;
  return row;
}

function makeChainNoteRow(text, isTerminus) {
  const row = document.createElement('div');
  row.classList.add('aic-chain-connection');
  if (isTerminus) row.classList.add('aic-chain-terminal');
  row.textContent = text;
  return row;
}

function setActiveMuscle(muscle) {
  if (activeMuscle === muscle) return;

  if (activeMuscle) activeMuscle.deactivate();
  activeMuscle = muscle;
  muscle.mount(overlayEl);
  muscle.activate();
  drawLeaderLine(muscle);
  showDetail(muscle);
}

function showDetail(muscle) {
  if (!muscle.hasDetail()) return;

  const view = getOrCreateDetailView();
  view.panel.className = 'detail-panel ' + muscle.priColor();
  view.heading.textContent = muscle.label();
  view.valueElsByKey.forEach((valueEl, key) => {
    valueEl.innerHTML = expandAbbr(muscle.field(key));
  });
}

function makeDetailFieldRow(label, value) {
  const row = getDetailFieldRowTemplate().cloneNode(true);
  const labelEl = row.firstElementChild;
  const valueEl = row.lastElementChild;
  labelEl.textContent = label;
  valueEl.innerHTML = expandAbbr(value);
  return row;
}

function getDetailFieldRowTemplate() {
  if (detailFieldRowTemplate) return detailFieldRowTemplate;

  const row = document.createElement('div');
  row.className = 'detail-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'detail-label';
  row.appendChild(labelEl);
  row.appendChild(document.createElement('span'));
  detailFieldRowTemplate = row;
  return detailFieldRowTemplate;
}

function getOrCreateDetailView() {
  if (detailView) return detailView;

  const panel = document.createElement('div');
  panel.className = 'detail-panel';

  const heading = document.createElement('h3');
  panel.appendChild(heading);

  const valueElsByKey = new Map();
  AicMuscleFactory.fieldLabelEntries().forEach(([key, label]) => {
    const row = makeDetailFieldRow(label, '');
    panel.appendChild(row);
    valueElsByKey.set(key, row.lastElementChild);
  });

  detailEl.textContent = '';
  detailEl.appendChild(panel);

  detailView = {panel, heading, valueElsByKey};
  return detailView;
}

function resolveColor(priColor) {
  return getComputedStyle(document.documentElement)
      .getPropertyValue('--' + priColor)
      .trim();
}

function drawLeaderLine(muscle) {
  const sectionRect = tabSectionEl.getBoundingClientRect();
  sizeLeaderSvg(sectionRect);

  const color = resolveColor(muscle.priColor());
  const currentLeaderView = getOrCreateLeaderView();
  currentLeaderView.polygon.setAttribute('fill', color);

  const rowRect = muscle.rowEl().getBoundingClientRect();
  const start = [
    rowRect.right - sectionRect.left,
    rowRect.top + rowRect.height / 2 - sectionRect.top
  ];
  const imageRect = imgEl.getBoundingClientRect();

  const pathStates = VIEWS.map((view) => buildLeaderPathState({
    start,
    end: anchorPointInSection(muscle.anchor(view), imageRect, sectionRect),
    color
  }));
  currentLeaderView.paths.forEach((path, index) => {
    applyLeaderPathState(path, pathStates[index]);
  });

  kickAnimation(currentLeaderView.paths);
}

function sizeLeaderSvg(sectionRect) {
  leaderEl.setAttribute('viewBox',
      '0 0 ' + sectionRect.width + ' ' + sectionRect.height);
  leaderEl.style.cssText =
      'width: ' + sectionRect.width + 'px;'
      + ' height: ' + sectionRect.height + 'px;';
}

function anchorPointInSection(anchor, imageRect, sectionRect) {
  return [
    imageRect.left + (anchor[0] / 100) * imageRect.width - sectionRect.left,
    imageRect.top + (anchor[1] / 100) * imageRect.height - sectionRect.top
  ];
}

function buildLeaderPathState({start, end, color}) {
  const control = [start[0] + (end[0] - start[0]) * 0.5, start[1]];
  const pathD = 'M ' + start[0] + ' ' + start[1]
      + ' Q ' + control[0] + ' ' + control[1]
      + ' ' + end[0] + ' ' + end[1];
  const totalLength = approximateQuadLength(start, control, end);
  return {pathD, color, totalLength};
}

function applyLeaderPathState(path, {pathD, color, totalLength}) {
  path.setAttribute('d', pathD);
  path.setAttribute('stroke', color);
  path.style.cssText =
      'stroke-dasharray: ' + totalLength + ';'
      + ' stroke-dashoffset: ' + totalLength + ';';
}

function getOrCreateLeaderView() {
  if (leaderView) return leaderView;

  leaderEl.textContent = '';
  leaderEl.appendChild(makeArrowDefs());

  const polygon = leaderEl.querySelector('polygon');
  const paths = VIEWS.map(() =>
      leaderEl.appendChild(makeLeaderPathEl()));

  leaderView = {polygon, paths};
  return leaderView;
}

function makeArrowDefs() {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', ARROWHEAD_ID);
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'strokeWidth');

  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', '0 0, 8 3, 0 6');
  marker.appendChild(polygon);
  defs.appendChild(marker);
  return defs;
}

function makeLeaderPathEl() {
  const path = document.createElementNS(SVG_NS, 'path');
  path.classList.add('aic-leader-path');
  path.setAttribute('marker-end', 'url(#' + ARROWHEAD_ID + ')');
  return path;
}

function kickAnimation(paths) {
  requestAnimationFrame(() => {
    paths.forEach((path) => {
      path.style.strokeDashoffset = '0';
    });
  });
}

function approximateQuadLength(start, control, end) {
  const [x0, y0] = start;
  const [cx, cy] = control;
  const [x1, y1] = end;
  let length = 0;
  let prevX = x0;
  let prevY = y0;
  const steps = 20;

  for (let stepIndex = 1; stepIndex <= steps; stepIndex++) {
    const progress = stepIndex / steps;
    const inverseProgress = 1 - progress;
    const px = inverseProgress * inverseProgress * x0
        + 2 * inverseProgress * progress * cx
        + progress * progress * x1;
    const py = inverseProgress * inverseProgress * y0
        + 2 * inverseProgress * progress * cy
        + progress * progress * y1;
    const dx = px - prevX;
    const dy = py - prevY;
    length += Math.sqrt(dx * dx + dy * dy);
    prevX = px;
    prevY = py;
  }

  return length;
}

function handleResize() {
  if (!activeMuscle) return;

  drawLeaderLine(activeMuscle);
}
