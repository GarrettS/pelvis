import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {toShuffled} from './shuffle.js';
import {newEl} from './el-create.js';

let causalChains = {};

const containerEl = document.getElementById('diagnose-causal-chains-content');
const chainsWrap = document.getElementById('chains-wrap');

chainsWrap.addEventListener('click', handleChainClick);
wireChainDrag(chainsWrap);

function renderAll(container) {
  container.replaceChildren();
  CausalChain.discardAll();

  Object.entries(causalChains).forEach(([id, definition]) => {
    const chain = CausalChain.getInstance(id, definition);
    const { card, chainListEl } = buildChainCard(chain, chainCardText(definition));
    container.appendChild(card);
    renderChainList(chain, chainListEl);
  });
}

function handleChainClick(e) {
  const card = e.target.closest('.card');
  if (!card) return;

  const chainList = card.querySelector('.chain-list');
  if (!chainList) return;

  if (e.target.closest('.chain-reshuffle')) {
    CausalChain.discard(chainList.id);
    renderChainList(CausalChain.getInstance(chainList), chainList);
  } else if (e.target.closest('.chain-check')) {
    markOrderResults(CausalChain.getInstance(chainList), chainList);
  }
}

function wireChainDrag(container) {
  let activeChain = null;
  let activeChainList = null;
  let activePointerId = null;

  const cleanup = () => {
    activeChain.endDrag();
    document.documentElement.classList.remove('active-chain-drag');
    activeChainList.classList.remove('dragging-chain');
    activeChain = null;
    activeChainList = null;
    activePointerId = null;
  };

  container.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0) return;

    const chainItem = e.target.closest('.chain-list > li');
    if (!chainItem) return;

    const chainList = chainItem.closest('.chain-list');
    activeChain = CausalChain.getInstance(chainList);
    activeChainList = chainList;
    activePointerId = e.pointerId;
    chainItem.setPointerCapture(e.pointerId);
    activeChain.startDrag(chainItem, e.clientY);
    document.documentElement.classList.add('active-chain-drag');
    chainList.classList.add('dragging-chain');
  });

  container.addEventListener('pointermove', (e) => {
    if (!activeChain || e.pointerId !== activePointerId) return;
    activeChain.dragMove(e.clientY, activeChainList);
  });

  container.addEventListener('pointerup', (e) => {
    if (!activeChain || e.pointerId !== activePointerId) return;
    activeChain.commitDrop(activeChainList);
    cleanup();
  });

  container.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId || !activeChain) return;
    cleanup();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeChain) cleanup();
  });
}

function buildChainCard(chain, { title, start, end }) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML =
    '<h3 class="chain-title">'
      + expandAbbr(title) + '</h3>'
    + '<div class="chain-subtitle">'
      + expandAbbr(start) + ' → '
      + expandAbbr(end) + '</div>'
    + '<ol class="chain-list" id="' + chain.id + '"></ol>'
    + '<div class="btn-row">'
      + '<button class="primary chain-check">Check Order</button>'
      + '<button class="chain-reshuffle">Reshuffle</button></div>';
  return {
    card,
    chainListEl: card.querySelector('.chain-list')
  };
}

function renderChainList(chain, chainListEl) {
  chainListEl.replaceChildren();
  const itemTemplate = document.createElement('li');
  chain.currentOrder().forEach((step) => {
    const chainItem = itemTemplate.cloneNode(false);
    chainItem.dataset.step = step;
    chainItem.innerHTML = expandAbbr(step);
    chainListEl.appendChild(chainItem);
  });
}

// chainList may contain a transient .chain-clone-list OL during drag/settle;
// :scope > li excludes it.
const realItems = chainList =>
  chainList.querySelectorAll(':scope > li');

function markOrderResults(chain, chainList) {
  const results = chain.orderResults();
  realItems(chainList).forEach((chainItem, i) => {
    chainItem.classList.toggle('correct', results[i].isCorrect);
    chainItem.classList.toggle('incorrect', !results[i].isCorrect);
  });
}

const chainCardText = ({ title, start, end }) => ({ title, start, end });

class CausalChain {
  static #instances = Object.create(null);
  static #KEY = Symbol();

  static getInstance(elOrId, definition) {
    const id = elOrId.id || elOrId;
    return CausalChain.#instances[id] ??= CausalChain.#create(id, definition);
  }

  static #create(id, definition) {
    // Reshuffle calls getInstance(chainList) without a definition;
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
  #activeDragItem = null;
  #startY = 0;
  #initialItemTop = 0;
  #dropTarget = null;
  #dropTargetMarker = null;
  #clone = null;
  #items;        // Cached real LIs at drag start (stable through drag).
  #itemNumber;   // 1-based position of the dragged item in #items.

  constructor(id, { steps }, key) {
    if (key !== CausalChain.#KEY) throw new Error(
      'CausalChain: use CausalChain.getInstance()'
    );
    this.#id = id;
    this.#steps = Object.freeze([...steps]);
    this.#order = toShuffled([...steps]);
  }

  get id() { return this.#id; }
  currentOrder() { return this.#order.slice(); }

  startDrag(chainItem, startY) {
    this.#activeDragItem = chainItem;
    this.#startY = startY;
    this.#initialItemTop = chainItem.getBoundingClientRect().top;
    // Item's current next-sibling — insertBefore against it is a no-op.
    this.#dropTarget = chainItem.nextElementSibling;

    const chainList = chainItem.parentNode;
    this.#items = [...realItems(chainList)];
    this.#itemNumber = this.#items.indexOf(chainItem) + 1;

    chainList.querySelector('.chain-clone-list')?.remove();
    this.#clone = chainList.insertBefore(newEl('ol', {
      className: 'chain-clone-list',
      attrs: {start: this.#itemNumber},
      children: [chainItem.cloneNode(true)]
    }), chainItem);
    chainItem.classList.add('active-drag-item');
  }

  dragMove(y, chainList) {
    const deltaY = this.#getConstrainedDeltaY(y, chainList);
    const target = this.#findTargetSibling(y, chainList);
    this.#applyDragStyles(deltaY);
    if (target === this.#dropTarget) return;

    this.#updateDropMarker(target, chainList);
    this.#dropTarget = target;
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(y, chainList) {
    const listBox = chainList.getBoundingClientRect();
    const itemHeight = this.#activeDragItem.getBoundingClientRect().height;
    const minDelta = listBox.top - this.#initialItemTop;
    const maxDelta = listBox.bottom - itemHeight - this.#initialItemTop;
    return Math.max(minDelta, Math.min(maxDelta, y - this.#startY));
  }

  #findTargetSibling(y, chainList) {
    for (const sibling of chainList.children) {
      if (sibling === this.#activeDragItem || sibling === this.#clone) continue;
      const box = sibling.getBoundingClientRect();
      if (y <= box.top + box.height / 2) return sibling;
    }
    return null;
  }

  #applyDragStyles(deltaY) {
    this.#clone.style.setProperty('--drag-offset', deltaY + 'px');
    this.#clone.scrollIntoView({block: 'nearest', behavior: 'instant'});
  }

  #updateDropMarker(target, chainList) {
    this.#dropTargetMarker?.classList.remove(
      'drop-target-before', 'drop-target-after'
    );
    const item = this.#activeDragItem;
    const wouldNotMove = target === item.nextElementSibling
      || (target === null && item === chainList.lastElementChild);
    this.#dropTargetMarker = wouldNotMove
      ? null
      : (target ?? chainList.lastElementChild);
    this.#dropTargetMarker?.classList.add(
      target ? 'drop-target-before' : 'drop-target-after'
    );
  }

  commitDrop(chainList) {
    chainList.insertBefore(this.#activeDragItem, this.#dropTarget);
    this.#order = Array.from(
      realItems(chainList), (li) => li.dataset.step
    );
  }

  // Marker shows the prospective drop position. Moving down lands one
  // slot before the target (target shifts down); moving up lands at it.
  #updateCloneNumber() {
    const targetNumber = this.#dropTarget
      ? this.#items.indexOf(this.#dropTarget) + 1
      : this.#items.length + 1;
    this.#clone.start = this.#itemNumber < targetNumber
      ? targetNumber - 1 : targetNumber;
  }

  endDrag() {
    const item = this.#activeDragItem;
    if (!item) return;

    this.#dropTargetMarker?.classList.remove(
      'drop-target-before', 'drop-target-after'
    );
    if (this.#clone) this.#settleClone(item);

    this.#activeDragItem = null;
    this.#dropTarget = null;
    this.#dropTargetMarker = null;
  }

  // Animate the clone from its drag position to the item's resting
  // position (new slot on drop, original slot on Esc/cancel) with
  // distance-proportional duration. On transition end, remove the clone.
  #settleClone(item) {
    const clone = this.#clone;
    this.#clone = null;

    item.classList.remove('active-drag-item');

    const dy = item.getBoundingClientRect().top
      - clone.getBoundingClientRect().top;

    // Click-without-drag: clone is already aligned with item. No transform
    // change means no transition fires, which means transitionend never
    // fires — listener would stall and the clone would stay in the DOM.
    if (dy === 0) {
      clone.remove();
      return;
    }

    const currentOffset = parseFloat(
      clone.style.getPropertyValue('--drag-offset')
    ) || 0;

    clone.style.transitionDuration = this.#calculateSettleDuration(dy) + 'ms';
    clone.classList.add('settling');

    requestAnimationFrame(() => {
      clone.style.setProperty('--drag-offset', (currentOffset + dy) + 'px');
    });

    clone.addEventListener('transitionend', () => clone.remove(), {once: true});
  }

  #calculateSettleDuration(dy) {
    const SETTLE_SPEED = 1.5;  // px per ms
    const MIN_MS = 200;
    const MAX_MS = 600;
    return Math.max(MIN_MS, Math.min(MAX_MS, Math.abs(dy) / SETTLE_SPEED));
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
