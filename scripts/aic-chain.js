// L AIC Chain tab: chain panel, anchor overlay, leader lines, detail panel.
// Architecture: prd/architecture/aic-chain.txt

import {createResizeHandle} from './resize-handle.js';
import {expandAbbr} from './abbr-expand.js';
import {loadJson} from './load.js';
import {appendErrorCallout, loadAndRender} from './error-ui.js';
import {newEl, newSvg} from './el-create.js';

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

let leaderDefsMounted = false;
let drawFrameId = null;

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
      this.#circlesByView.set(view, this.#buildCircle(view));
      this.#leaderPathsByView.set(view, this.#buildLeaderPath());
    });

    overlayEl.append(...this.#circlesByView.values());
    leaderEl.append(...this.#leaderPathsByView.values());

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
    return newSvg('circle', {cx, cy, className: this.priColor()});
  }

  #buildLeaderPath() {
    return newSvg('path', {
      className: `aic-leader-path ${this.priColor()}`,
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
    fragment.append(makeMuscleRow(id, chainEntry));
    if (chainEntry.connection) {
      fragment.append(makeChainNoteRow(chainEntry.connection, false));
    }
    if (chainEntry.terminus) {
      fragment.append(makeChainNoteRow(chainEntry.terminus, true));
    }
  });
  panelEl.append(fragment);
}

function makeMuscleRow(id, chainEntry) {
  return newEl('div', {
    id,
    className: `aic-chain-row ${chainEntry.priColor}`,
    textContent: chainEntry.label
  });
}

function makeChainNoteRow(text, isTerminus) {
  return newEl('div', {
    className: isTerminus
        ? 'aic-chain-connection aic-chain-terminal'
        : 'aic-chain-connection',
    textContent: text
  });
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

  detailEl.replaceChildren(newEl('div', {
    className: `detail-panel ${muscle.priColor()}`,
    children: [
      newEl('h3', {textContent: muscle.label()}),
      ...AicMuscle.fieldLabelEntries().map(([key, label]) => newEl('div', {
        className: 'detail-row',
        children: [
          newEl('span', {className: 'detail-label', textContent: label}),
          newEl('span', {innerHTML: expandAbbr(muscle.field(key))})
        ]
      }))
    ]
  }));
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

const sizeLeaderSvg = ({width: w, height: h}) =>
    leaderEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

const anchorPointInSection = ({x, y}, img, section) => ({
  x: img.left + (x / 100) * img.width - section.left,
  y: img.top + (y / 100) * img.height - section.top
});

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
