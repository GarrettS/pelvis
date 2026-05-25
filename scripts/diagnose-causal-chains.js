import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {toShuffled} from './shuffle.js';
import {newEl} from './el-create.js';

let causalChains = {};

const containerEl = document.getElementById('diagnose-causal-chains-content');
const chainsWrap = document.getElementById('chains-wrap');

const handleChainClick = e => {
  const btn = e.target.closest('.chain-reshuffle, .chain-check');
  const chainListEl = btn?.closest('.card')?.querySelector('.chain-list');
  if (!chainListEl) return;

  const isShuffle = btn.matches('.chain-reshuffle');
  if (isShuffle) CausalChain.discard(chainListEl.id);
  (isShuffle ? renderChainList : markOrderResults)(
    CausalChain.getById(chainListEl.id), chainListEl
  );
};

chainsWrap.addEventListener('click', handleChainClick);
wireChainDrag(chainsWrap);

function renderAll(container) {
  container.replaceChildren();
  CausalChain.discardAll();

  Object.entries(causalChains).forEach(([id, definition]) => {
    const chainList = CausalChain.getById(id, definition);
    const { card, chainListEl } = buildChainCard(chainList, definition);
    container.appendChild(card);
    renderChainList(chainList, chainListEl);
  });
}

function wireChainDrag(container) {
  let activeChainList = null;
  let activeChainListEl = null;
  let activePointerId = null;

  const cleanup = () => {
    activeChainList.endDrag();
    document.documentElement.classList.remove('active-chain-drag');
    activeChainListEl.classList.remove('dragging-chain');
    activeChainList = null;
    activeChainListEl = null;
    activePointerId = null;
  };

  container.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;

    const chainItem = e.target.closest('.chain-list > li');
    if (!chainItem) return;

    const chainListEl = chainItem.closest('.chain-list');
    activeChainList = CausalChain.getById(chainListEl.id);
    activeChainListEl = chainListEl;
    activePointerId = e.pointerId;
    chainItem.setPointerCapture(e.pointerId);
    activeChainList.startDrag(chainItem, e.clientY);
    document.documentElement.classList.add('active-chain-drag');
    chainListEl.classList.add('dragging-chain');
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
      && activeChainList.dragMove(e.clientY, activeChainListEl));

  container.addEventListener('pointerup', e =>
    activeChainList && e.pointerId === activePointerId
      && (activeChainList.commitDrop(activeChainListEl), cleanup()));

  container.addEventListener('pointercancel', e =>
    activeChainList && e.pointerId === activePointerId && cleanup());

  document.addEventListener('keydown', e =>
    activeChainList && e.key === 'Escape' && cleanup());
}

const buildChainCard = (chainList, { title, start, end }) => {
  const card = newEl('div', {
    className: 'card',
    innerHTML: `
      <h3 class="chain-title">${expandAbbr(title)}</h3>
      <div class="chain-subtitle">${expandAbbr(start)} → ${expandAbbr(end)}</div>
      <ol class="chain-list" id="${chainList.id}"></ol>
      <div class="btn-row">
        <button class="primary chain-check">Check Order</button>
        <button class="chain-reshuffle">Reshuffle</button>
      </div>
    `
  });
  return { card, chainListEl: card.querySelector('.chain-list') };
};

const renderChainList = (chainList, chainListEl) =>
  chainListEl.replaceChildren(...chainList.currentOrder().map(step =>
    newEl('li', {innerHTML: expandAbbr(step), attrs: {'data-step': step}})));

// chainListEl may contain a transient .chain-clone-list OL during drag/settle;
// :scope > li excludes it.
const realItems = chainListEl =>
  chainListEl.querySelectorAll(':scope > li');

const markOrderResults = (chainList, chainListEl) => {
  const results = chainList.orderResults();
  realItems(chainListEl).forEach((chainItem, i) => {
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
    // Reshuffle calls getById(chainListEl) without a definition;
    // recover it from the cached data.
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
  // baseline (frozen): { chainListEl, chainItem, startY, initialItemTop,
  //                     cloneTop, items, displayRank, initialDropTarget }

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

    return Object.freeze({
      chainListEl,
      chainItem,
      startY,
      initialItemTop: chainItemRect.top,
      cloneTop: Math.round(chainItemRect.top - chainListRect.top),
      items: Object.freeze(itemsExcludingClones),
      displayRank: currentItemIndex + 1,
      initialDropTarget: itemsExcludingClones[currentItemIndex + 1] ?? null
    });
  }

  #commitDragDOM(baseline) {
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

    this.#dragSession = {
      dropTarget: initialDropTarget,
      marker: null,
      clone,
      baseline
    };
  }

  startDrag(chainItem, startY) {
    this.#commitDragDOM(CausalChain.#captureBaseline(chainItem, startY));
  }

  dragMove(y, chainListEl) {
    const deltaY = this.#getConstrainedDeltaY(y, chainListEl);
    const target = this.#findTargetSibling(y, chainListEl);
    this.#applyDragStyles(deltaY);
    if (target === this.#dragSession.dropTarget) return;

    this.#updateDropMarker(target, chainListEl);
    this.#dragSession.dropTarget = target;
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(y, chainListEl) {
    const { chainItem, startY, initialItemTop } = this.#dragSession.baseline;
    const listBox = chainListEl.getBoundingClientRect();
    const itemHeight = chainItem.getBoundingClientRect().height;
    const minDelta = listBox.top - initialItemTop;
    const maxDelta = listBox.bottom - itemHeight - initialItemTop;
    return Math.max(minDelta, Math.min(maxDelta, y - startY));
  }

  #findTargetSibling(y, chainListEl) {
    const { clone, baseline } = this.#dragSession;
    for (const sibling of chainListEl.children) {
      if (sibling === baseline.chainItem || sibling === clone) continue;
      const box = sibling.getBoundingClientRect();
      if (y <= box.top + box.height / 2) return sibling;
    }
    return null;
  }

  #applyDragStyles(deltaY) {
    const { clone } = this.#dragSession;
    clone.style.setProperty('--drag-offset', deltaY + 'px');
    clone.scrollIntoView({block: 'nearest'});
  }

  #updateDropMarker(target, chainListEl) {
    const session = this.#dragSession;
    const { chainItem } = session.baseline;
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

  commitDrop(chainListEl) {
    const { chainItem } = this.#dragSession.baseline;
    chainListEl.insertBefore(chainItem, this.#dragSession.dropTarget);
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
