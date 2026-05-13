// L AIC Chain tab: chain panel, anchor overlay, leader lines, detail panel.
// Architecture: prd/architecture/aic-chain.txt

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
let leaderDefsMounted = false;
let drawFrameId = null;

function createSvg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

class AicMuscle {
  static #instances = Object.create(null);
  static #chainData = {};
  static #detailData = {};
  static #fieldLabels = {};
  static #KEY = Symbol();
  static #toXY = ([x, y]) => ({x, y});

  static acceptData(data) {
    ({
      chain: AicMuscle.#chainData,
      detail: AicMuscle.#detailData,
      fieldLabels: AicMuscle.#fieldLabels
    } = data);
  }

  static getInstance(id) {
    return AicMuscle.#instances[id] ??= new AicMuscle(
        id,
        AicMuscle.#chainData[id],
        AicMuscle.#detailData[id],
        AicMuscle.#KEY);
  }

  static forEachEntry(callback) {
    Object.entries(AicMuscle.#chainData).forEach(([id, entry]) => {
      callback(id, entry);
    });
  }

  static fieldLabelEntries() {
    return Object.entries(AicMuscle.#fieldLabels);
  }

  #id;
  #chainEntry;
  #detailEntry;
  #rowEl = null;
  #circlesByView = new Map();
  #leaderPathsByView = new Map();
  #mounted = false;

  constructor(id, chainEntry, detailEntry, key) {
    if (key !== AicMuscle.#KEY) {
      throw new Error('Use AicMuscle.getInstance(id) instead of new');
    }
    if (!chainEntry) {
      throw new Error(`AicMuscle.getInstance('${id}') called for unknown muscle`);
    }
    this.#id = id;
    this.#chainEntry = chainEntry;
    this.#detailEntry = detailEntry;
  }

  label() { return this.#chainEntry.label; }
  priColor() { return this.#chainEntry.priColor; }
  rowEl() { return this.#rowEl; }
  anchor(view) { return AicMuscle.#toXY(this.#chainEntry.anchor[view]); }
  hasDetail() { return Boolean(this.#detailEntry); }
  field(key) { return this.#detailEntry?.[key]; }

  mount() {
    if (this.#mounted) return;

    this.#rowEl = document.getElementById(this.#id);
    VIEWS.forEach((view) => {
      const circle = this.#buildCircle(view);
      overlayEl.appendChild(circle);
      this.#circlesByView.set(view, circle);

      const path = this.#buildLeaderPath();
      leaderEl.appendChild(path);
      this.#leaderPathsByView.set(view, path);
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
    this.#leaderPathsByView.forEach((path) => path.removeAttribute('d'));
  }

  drawLeader(rowRect, imageRect, sectionRect) {
    const start = {
      x: rowRect.right - sectionRect.left,
      y: rowRect.top + rowRect.height / 2 - sectionRect.top
    };
    for (let i = 0; i < VIEWS.length; i++) {
      const view = VIEWS[i];
      const end = anchorPointInSection(this.anchor(view), imageRect, sectionRect);
      applyLeaderPathState(
          this.#leaderPathsByView.get(view),
          buildLeaderPathState({start, end}));
    }
    this.#kickAnimation();
  }

  #kickAnimation() {
    requestAnimationFrame(() => {
      for (const path of this.#leaderPathsByView.values()) {
        path.style.strokeDashoffset = '0';
      }
    });
  }

  #buildCircle(view) {
    const {x: cx, y: cy} = this.anchor(view);
    return createSvg('circle', {cx, cy, class: this.priColor()});
  }

  #buildLeaderPath() {
    return createSvg('path', {
      class: `aic-leader-path ${this.priColor()}`,
      'marker-end': `url(#${ARROWHEAD_ID})`
    });
  }
}

containerEl = document.querySelector('.aic-chain-container');
if (resolveDomRefs()) {
  await loadAndRender({
    load: () => loadJson('./data/aic-chain.json'),
    container: containerEl,
    render: (data) => {
      AicMuscle.acceptData(data);
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

function setupUi() {
  ensureLeaderDefs();

  panelEl.addEventListener('click', (event) => {
    const rowEl = event.target.closest('.aic-chain-row');
    if (!rowEl) return;

    setActiveMuscle(AicMuscle.getInstance(rowEl.id));
  });

  createResizeHandle({
    container: containerEl,
    insertBefore: imageColEl,
    resizeTarget: panelEl,
    cssProperty: '--panel-w',
    minWidth: 100,
    maxRatio: 0.4,
    onResize: drawLeaderLine
  });

  new ResizeObserver(drawLeaderLine).observe(tabSectionEl);
}

function ensureLeaderDefs() {
  if (leaderDefsMounted) return;

  leaderEl.insertAdjacentHTML('afterbegin', `
    <defs>
      <marker id="${ARROWHEAD_ID}" markerWidth="8" markerHeight="6"
              refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <polygon points="0 0, 8 3, 0 6" fill="context-stroke"/>
      </marker>
    </defs>
  `);
  leaderDefsMounted = true;
}

function buildPanel() {
  const fragment = document.createDocumentFragment();
  AicMuscle.forEachEntry((id, chainEntry) => {
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
  muscle.mount();
  muscle.activate();
  drawLeaderLine();
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
  AicMuscle.fieldLabelEntries().forEach(([key, label]) => {
    const row = makeDetailFieldRow(label, '');
    panel.appendChild(row);
    valueElsByKey.set(key, row.lastElementChild);
  });

  detailEl.textContent = '';
  detailEl.appendChild(panel);

  detailView = {panel, heading, valueElsByKey};
  return detailView;
}

function drawLeaderLine() {
  if (drawFrameId || !activeMuscle) return;

  drawFrameId = requestAnimationFrame(() => {
    const muscle = activeMuscle;
    const sectionRect = tabSectionEl.getBoundingClientRect();
    const rowRect = muscle.rowEl().getBoundingClientRect();
    const imageRect = imgEl.getBoundingClientRect();

    sizeLeaderSvg(sectionRect);
    muscle.drawLeader(rowRect, imageRect, sectionRect);

    drawFrameId = null;
  });
}

function sizeLeaderSvg(sectionRect) {
  leaderEl.setAttribute('viewBox',
      '0 0 ' + sectionRect.width + ' ' + sectionRect.height);
  leaderEl.style.cssText =
      'width: ' + sectionRect.width + 'px;'
      + ' height: ' + sectionRect.height + 'px;';
}

function anchorPointInSection(anchor, imageRect, sectionRect) {
  return {
    x: imageRect.left + (anchor.x / 100) * imageRect.width - sectionRect.left,
    y: imageRect.top + (anchor.y / 100) * imageRect.height - sectionRect.top
  };
}

function buildLeaderPathState({start, end}) {
  const control = {x: start.x + (end.x - start.x) * 0.5, y: start.y};
  const pathD = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  const totalLength = approximateQuadLength(start, control, end);
  return {pathD, totalLength};
}

function applyLeaderPathState(path, {pathD, totalLength}) {
  path.setAttribute('d', pathD);
  path.style.cssText =
      'stroke-dasharray: ' + totalLength + ';'
      + ' stroke-dashoffset: ' + totalLength + ';';
}

function approximateQuadLength(start, control, end) {
  let length = 0;
  let prevX = start.x;
  let prevY = start.y;
  const steps = 20;

  for (let stepIndex = 1; stepIndex <= steps; stepIndex++) {
    const progress = stepIndex / steps;
    const inverseProgress = 1 - progress;
    const px = inverseProgress * inverseProgress * start.x
        + 2 * inverseProgress * progress * control.x
        + progress * progress * end.x;
    const py = inverseProgress * inverseProgress * start.y
        + 2 * inverseProgress * progress * control.y
        + progress * progress * end.y;
    const dx = px - prevX;
    const dy = py - prevY;
    length += Math.sqrt(dx * dx + dy * dy);
    prevX = px;
    prevY = py;
  }

  return length;
}
