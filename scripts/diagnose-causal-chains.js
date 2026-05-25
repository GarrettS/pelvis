import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {toShuffled} from './shuffle.js';
import {newEl} from './el-create.js';

let causalChains = {};

const containerEl = document.getElementById('diagnose-causal-chains-content');
const chainsWrap = document.getElementById('chains-wrap');

const handleChainSubmit = e => {
  e.preventDefault();
  const id = e.target.name;
  const isShuffle = e.submitter.name === 'reshuffle';
  if (isShuffle) CausalChain.discard(id);
  (isShuffle ? renderChainList : markOrderResults)(CausalChain.getById(id));
};

chainsWrap.addEventListener('submit', handleChainSubmit);
wireChainDrag(chainsWrap);

function renderAll(container) {
  container.replaceChildren();
  CausalChain.discardAll();

  Object.entries(causalChains).forEach(([id, definition]) => {
    const chainList = CausalChain.getById(id, definition);
    container.appendChild(buildChainListForm(chainList, definition));
    renderChainList(chainList);
  });
}

function wireChainDrag(container) {
  let activeChainList = null;
  let activePointerId = null;

  const cleanup = () => {
    activeChainList.endDrag();
    document.documentElement.classList.remove('active-chain-drag');
    activeChainList = null;
    activePointerId = null;
  };

  container.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;

    const chainItem = e.target.closest('.chain-list > li');
    if (!chainItem) return;

    activeChainList = CausalChain.getById(chainItem.parentNode.id);
    activePointerId = e.pointerId;
    chainItem.setPointerCapture(e.pointerId);
    activeChainList.startDrag(chainItem, e.clientY);
    document.documentElement.classList.add('active-chain-drag');
  });

  // iOS WebKit's text-selection initiation is driven by touchstart's
  // default behavior. preventDefault on touchstart (passive: false) cancels
  // it. pointerdown.preventDefault doesn't — it only suppresses emulated
  // mouse events at tap end.
  container.addEventListener('touchstart',
    e => e.target.closest('.chain-list > li') && e.preventDefault(),
    {passive: false});

  container.addEventListener('pointermove', e =>
    activeChainList && e.pointerId === activePointerId
      && activeChainList.dragMove(e.clientY));

  container.addEventListener('pointerup', e =>
    activeChainList && e.pointerId === activePointerId
      && (activeChainList.commitDrop(), cleanup()));

  container.addEventListener('pointercancel', e =>
    activeChainList && e.pointerId === activePointerId && cleanup());

  document.addEventListener('keydown', e =>
    activeChainList && e.key === 'Escape' && cleanup());
}

const buildChainListForm = (chainList, { title, start, end }) =>
  newEl('form', {
    className: 'card',
    attrs: {name: chainList.id},
    innerHTML: `
      <h3 class="chain-title">${expandAbbr(title)}</h3>
      <div class="chain-subtitle">${expandAbbr(start)} → ${expandAbbr(end)}</div>
      <ol class="chain-list" id="${chainList.id}"></ol>
      <div class="btn-row">
        <button name="check" class="primary">Check Order</button>
        <button name="reshuffle">Reshuffle</button>
      </div>
    `
  });

const renderChainList = chainList =>
  document.getElementById(chainList.id).replaceChildren(
    ...chainList.currentOrder().map(step =>
      newEl('li', {innerHTML: expandAbbr(step), attrs: {'data-step': step}})));

// chainListEl may contain a transient .chain-clone-list OL during drag/settle;
// :scope > li excludes it.
const realItems = chainListEl =>
  chainListEl.querySelectorAll(':scope > li');

const markOrderResults = chainList => {
  const results = chainList.orderResults();
  realItems(document.getElementById(chainList.id)).forEach((chainItem, i) => {
    chainItem.classList.toggle('correct', results[i].isCorrect);
    chainItem.classList.toggle('incorrect', !results[i].isCorrect);
  });
};

const SETTLE_SPEED = 1.5;   // px per ms
const SETTLE_MIN_MS = 200;
const SETTLE_MAX_MS = 600;

const calculateSettleDuration = dy =>
  Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, Math.abs(dy) / SETTLE_SPEED));

class CausalChain {
  static #instances = Object.create(null);
  static #KEY = Symbol();

  static getById(id, definition) {
    return CausalChain.#instances[id] ??= CausalChain.#create(id, definition);
  }

  static #create(id, definition) {
    definition ??= causalChains[id];
    if (!definition) throw new Error(
      'CausalChain: no definition for "' + id + '"'
    );
    return new CausalChain(id, definition, CausalChain.#KEY);
  }

  static discard(id) {
    delete CausalChain.#instances[id];
  }

  static discardAll() {
    CausalChain.#instances = Object.create(null);
  }

  #id;
  #steps;
  #order;
  #dragSession = null;
  // session: { dropTarget, marker, clone, baseline }
  // baseline (frozen): { chainListEl, chainItem, pageStartY, cloneTop,
  //                     items, displayRank, initialDropTarget,
  //                     minDelta, maxDelta, siblingThresholds }

  constructor(id, { steps }, key) {
    if (key !== CausalChain.#KEY) throw new Error(
      'CausalChain: use CausalChain.getById()'
    );
    this.#id = id;
    this.#steps = Object.freeze([...steps]);
    this.#order = toShuffled(steps);
  }

  get id() { return this.#id; }
  currentOrder() { return this.#order.slice(); }

  static #captureBaseline(chainItem, startY) {
    const chainListEl = chainItem.parentNode;
    const chainItemRect = chainItem.getBoundingClientRect();
    const chainListRect = chainListEl.getBoundingClientRect();
    const itemsExcludingClones = [...realItems(chainListEl)];
    const currentItemIndex = itemsExcludingClones.indexOf(chainItem);
    const scroll = window.scrollY;

    // Page-relative coords stay stable across scroll (LIs don't move
    // in document coordinates); per-frame work then reads only
    // window.scrollY, never BCRs.
    const pageInitialItemTop = chainItemRect.top + scroll;
    const pageListTop = chainListRect.top + scroll;
    const pageListBottom = chainListRect.bottom + scroll;
    const itemHeight = chainItemRect.height;

    const siblingThresholds = [];
    for (const sibling of itemsExcludingClones) {
      if (sibling === chainItem) continue;
      const box = sibling.getBoundingClientRect();
      siblingThresholds.push({
        sibling,
        pageThresholdY: box.top + box.height / 2 + scroll
      });
    }

    return Object.freeze({
      chainListEl,
      chainItem,
      pageStartY: startY + scroll,
      cloneTop: Math.round(chainItemRect.top - chainListRect.top),
      items: itemsExcludingClones,
      displayRank: currentItemIndex + 1,
      initialDropTarget: itemsExcludingClones[currentItemIndex + 1] ?? null,
      minDelta: pageListTop - pageInitialItemTop,
      maxDelta: pageListBottom - itemHeight - pageInitialItemTop,
      siblingThresholds
    });
  }

  static #commitDragDOM(baseline) {
    const {
      chainListEl, chainItem, displayRank, cloneTop, initialDropTarget
    } = baseline;

    chainListEl.querySelector('.chain-clone-list')?.remove();
    const clone = chainListEl.insertBefore(newEl('ol', {
      className: 'chain-clone-list',
      attrs: {start: displayRank, style: `top: ${cloneTop}px`},
      children: [chainItem.cloneNode(true)]
    }), chainItem);
    chainItem.classList.add('active-drag-item');

    return {
      dropTarget: initialDropTarget,
      marker: null,
      clone,
      baseline
    };
  }

  startDrag(chainItem, startY) {
    this.#dragSession = CausalChain.#commitDragDOM(
      CausalChain.#captureBaseline(chainItem, startY));
  }

  dragMove(y) {
    const deltaY = this.#getConstrainedDeltaY(y);
    const target = this.#findTargetSibling(y);
    this.#applyDragStyles(deltaY);
    if (target === this.#dragSession.dropTarget) return;

    this.#updateDropMarker(target);
    this.#dragSession.dropTarget = target;
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(y) {
    const { pageStartY, minDelta, maxDelta } = this.#dragSession.baseline;
    return Math.max(minDelta, Math.min(maxDelta, y + window.scrollY - pageStartY));
  }

  #findTargetSibling(y) {
    const pageY = y + window.scrollY;
    return this.#dragSession.baseline.siblingThresholds
      .find(t => pageY <= t.pageThresholdY)?.sibling ?? null;
  }

  #applyDragStyles(deltaY) {
    const { clone } = this.#dragSession;
    clone.style.setProperty('--drag-offset', deltaY + 'px');
    clone.scrollIntoView({block: 'nearest'});
  }

  #updateDropMarker(target) {
    const session = this.#dragSession;
    const { chainItem, chainListEl } = session.baseline;
    session.marker?.classList.remove('drop-target-before', 'drop-target-after');
    const wouldNotMove = target === chainItem.nextElementSibling
      || (target === null && chainItem === chainListEl.lastElementChild);
    session.marker = wouldNotMove
      ? null
      : (target ?? chainListEl.lastElementChild);
    session.marker?.classList.add(
      target ? 'drop-target-before' : 'drop-target-after'
    );
  }

  commitDrop() {
    const { dropTarget, baseline } = this.#dragSession;
    if (dropTarget === baseline.initialDropTarget) return;
    const { chainItem, chainListEl } = baseline;
    chainListEl.insertBefore(chainItem, dropTarget);
    this.#order = Array.from(realItems(chainListEl), li => li.dataset.step);
  }

  // Marker shows the prospective drop position. Moving down lands one
  // slot before the target (target shifts down); moving up lands at it.
  #updateCloneNumber() {
    const { clone, dropTarget, baseline } = this.#dragSession;
    const { items, displayRank } = baseline;
    const targetNumber = dropTarget
      ? items.indexOf(dropTarget) + 1
      : items.length + 1;
    clone.start = displayRank < targetNumber
      ? targetNumber - 1 : targetNumber;
  }

  endDrag() {
    const session = this.#dragSession;
    if (!session) return;
    session.marker?.classList.remove('drop-target-before', 'drop-target-after');
    this.#settleClone(session.clone, session.baseline.chainItem);
    this.#dragSession = null;
  }

  // Animate the clone from its drag position to the item's resting
  // position (new slot on drop, original slot on Esc/cancel) with
  // distance-proportional duration. On transition end, remove the clone.
  #settleClone(clone, item) {
    item.classList.remove('active-drag-item');

    const dy = item.getBoundingClientRect().top
      - clone.getBoundingClientRect().top;

    // No transform change means no transition fires, so transitionend
    // never fires — clone would stay in the DOM.
    if (Math.abs(dy) < 0.5) {
      clone.remove();
      return;
    }

    const currentOffset = parseFloat(
      clone.style.getPropertyValue('--drag-offset')
    ) || 0;

    clone.style.transitionDuration = calculateSettleDuration(dy) + 'ms';
    clone.classList.add('settling');

    requestAnimationFrame(() =>
      clone.style.setProperty('--drag-offset', (currentOffset + dy) + 'px'));

    clone.addEventListener('transitionend', () => clone.remove(), {once: true});
  }

  orderResults() {
    return this.#order.map((step, i) => ({
      step,
      isCorrect: step === this.#steps[i]
    }));
  }
}

await attemptLoad({
  loader: () => loadJson('./data/diagnose-causal-chains.json'),
  container: containerEl,
  render: (data) => {
    causalChains = data;
    renderAll(chainsWrap);
  }
});
