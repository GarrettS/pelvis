// L AIC Chain tab: chain panel, anchor overlay, leader lines, detail panel.
// Architecture: prd/architecture/aic-chain.txt

import {createResizeHandle} from './resize-handle.js';
import {expandAbbr} from './abbr-expand.js';
import {loadJson} from './load.js';
import {appendErrorCallout, attemptLoad} from './error-ui.js';
import {newEl, newSvg} from './el-create.js';

const VIEWS = ['anterior', 'posterior'];
const ARROWHEAD_ID = 'aic-arrowhead';
const LEADER_DRAW_MS =
    parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--dur-normal'));

let containerEl = null;
let panelEl = null;
let panelScrollEl = null;
let overlayEl = null;
let leaderEl = null;
let imgEl = null;
let detailEl = null;
let detailScrollEl = null;
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
  #anchorsByView = new Map();
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
      this.#anchorsByView.set(view, this.#buildAnchor(view));
      this.#leaderPathsByView.set(view, this.#buildLeaderPath());
    });

    overlayEl.append(...this.#anchorsByView.values());
    leaderEl.append(...this.#leaderPathsByView.values());

    this.#mounted = true;
  }

  activate() {
    this.#rowEl.classList.add('activeMuscle');
    this.#rowEl.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    this.#anchorsByView.forEach((anchor) => {
      anchor.classList.add('activeMuscle');
    });
  }

  deactivate() {
    this.#rowEl.classList.remove('activeMuscle');
    this.#anchorsByView.forEach((anchor) => {
      anchor.classList.remove('activeMuscle');
    });
    this.#leaderPathsByView.forEach((path) => path.removeAttribute('d'));
  }

  drawLeader({start, imageRect, sectionRect, animate}) {
    for (const view of VIEWS) {
      const end = anchorPointInSection(this.anchor(view), imageRect, sectionRect);
      drawLeaderPath(this.#leaderPathsByView.get(view), start, end, animate);
    }
  }

  #buildAnchor(view) {
    const {x: cx, y: cy} = this.anchor(view);
    return newSvg('g', {
      class: this.priColor(),
      children: [
        newSvg('circle', {cx, cy, class: 'aic-anchor-casing'}),
        newSvg('circle', {cx, cy, class: 'aic-anchor-dot'})
      ]
    });
  }

  #buildLeaderPath() {
    return newSvg('path', {
      class: `aic-leader-path ${this.priColor()}`,
      'marker-end': `url(#${ARROWHEAD_ID})`
    });
  }
}

const makeMuscleRow = (id, chainEntry) => newEl('div', {
  id,
  className: `aic-chain-row ${chainEntry.priColor}`,
  textContent: chainEntry.label
});

const makeChainNoteRow = (text, isTerminus) => newEl('div', {
  className: 'aic-chain-connection' + (isTerminus ? ' aic-chain-terminal' : ''),
  innerHTML: expandAbbr(text)
});

containerEl = document.querySelector('.aic-chain-container');
if (resolveDomRefs()) {
  await attemptLoad({
    loader: () => loadJson('./data/aic-chain.json'),
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
  panelScrollEl = panelEl?.querySelector('.aic-chain-scroll');
  overlayEl = containerEl.querySelector('.aic-chain-overlay');
  imgEl = containerEl.querySelector('.aic-chain-img');
  detailEl = containerEl.querySelector('.aic-chain-detail');
  detailScrollEl = detailEl?.querySelector('.aic-chain-scroll');
  imageColEl = containerEl.querySelector('.aic-chain-image-col');
  tabSectionEl = containerEl.parentElement;
  leaderEl = tabSectionEl.querySelector('.aic-leader-svg');

  const missingRef = [
    [panelEl, 'panel'],
    [panelScrollEl, 'panel scroll'],
    [overlayEl, 'overlay'],
    [imgEl, 'image'],
    [detailEl, 'detail'],
    [detailScrollEl, 'detail scroll'],
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
  panelScrollEl.addEventListener('scroll', drawLeaderLine, {passive: true});
}

function ensureLeaderDefs() {
  if (leaderDefsMounted) return;

  leaderEl.insertAdjacentHTML('afterbegin', `
    <defs>
      <marker id="${ARROWHEAD_ID}" markerWidth="8" markerHeight="6"
              refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
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
  panelScrollEl.append(fragment);
}

function setActiveMuscle(muscle) {
  if (activeMuscle === muscle) return;

  if (activeMuscle) activeMuscle.deactivate();
  activeMuscle = muscle;
  muscle.mount();
  muscle.activate();
  drawLeaderLine({animate: true});
  showDetail(muscle);
}

function showDetail(muscle) {
  if (!muscle.hasDetail()) return;

  detailScrollEl.replaceChildren(newEl('div', {
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

function drawLeaderLine({animate} = {}) {
  if (drawFrameId || !activeMuscle) return;

  drawFrameId = requestAnimationFrame(() => {
    const muscle = activeMuscle;
    const sectionRect = tabSectionEl.getBoundingClientRect();
    const rowRect = muscle.rowEl().getBoundingClientRect();
    const panelRect = panelScrollEl.getBoundingClientRect();
    const originY = clamp(rowRect.top + rowRect.height / 2,
        panelRect.top, panelRect.bottom);
    const start = {
      x: rowRect.right - sectionRect.left,
      y: originY - sectionRect.top
    };

    sizeLeaderSvg(sectionRect);
    muscle.drawLeader({
      start,
      imageRect: imgEl.getBoundingClientRect(),
      sectionRect,
      animate
    });

    drawFrameId = null;
  });
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const sizeLeaderSvg = ({width: w, height: h}) =>
    leaderEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

const anchorPointInSection = ({x, y}, img, section) => ({
  x: img.left + (x / 100) * img.width - section.left,
  y: img.top + (y / 100) * img.height - section.top
});

// Code Claude wrote that I don't understand.
function leaderPathD({x: startX, y: startY}, {x: endX, y: endY}) {
  const controlX = startX + (endX - startX) * 0.5;
  // Trim by the arrowhead length (polygon 8 × stroke-width 2) so the
  // forward-projected tip (refX="0") lands exactly on the anchor.
  const dx = endX - controlX;
  const dy = endY - startY;
  const k = 16 / (Math.hypot(dx, dy) || 1);
  return `M ${startX} ${startY} Q ${controlX} ${startY} `
      + `${endX - dx * k} ${endY - dy * k}`;
}

function drawLeaderPath(path, start, end, animate) {
  path.setAttribute('d', leaderPathD(start, end));
  const length = path.getTotalLength();
  path.style.strokeDasharray = length;

  if (!animate) return;

  path.animate(
      [{strokeDashoffset: length}, {strokeDashoffset: 0}],
      {duration: LEADER_DRAW_MS, easing: 'ease-out'});
}
