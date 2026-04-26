import {getCausalChains} from './study-data-cache.js';
import {expandAbbr} from './abbr-expand.js';
import {shuffle} from './shuffle.js';

let causalChains = {};

const CausalChainFactory = (() => {
  const instances = {};
  const KEY = Symbol();

  class CausalChain {
    #id;
    #steps;
    #order;
    #activeDragItem = null;
    #startY = 0;
    #initialItemTop = 0;
    #dropTarget;
    #dropTargetMarker = null;

    constructor(id, { steps }, key) {
      if (key !== KEY) throw new Error(
        'CausalChain: use CausalChainFactory.getInstance()'
      );
      this.#id = id;
      this.#steps = Object.freeze([...steps]);
      this.#order = shuffle([...steps]);
    }

    get id() { return this.#id; }
    currentOrder() { return this.#order.slice(); }
    correctOrder() { return this.#steps; }

    startDrag(chainItem, startY) {
      this.#activeDragItem = chainItem;
      this.#startY = startY;
      this.#initialItemTop = chainItem.getBoundingClientRect().top;
      this.#dropTarget = undefined;
      chainItem.classList.add('active-drag-item');
    }

    dragMove(y, chainList) {
      if (!this.#activeDragItem) return;

      const item = this.#activeDragItem;
      const listBox = chainList.getBoundingClientRect();
      const itemHeight = item.getBoundingClientRect().height;
      const minDelta = listBox.top - this.#initialItemTop;
      const maxDelta = listBox.bottom - itemHeight - this.#initialItemTop;
      const deltaY = Math.max(
        minDelta, Math.min(maxDelta, y - this.#startY)
      );
      item.style.setProperty('--drag-offset', deltaY + 'px');

      let target = null;
      for (const sibling of chainList.children) {
        if (sibling === item) continue;
        const box = sibling.getBoundingClientRect();
        if (y <= box.top + box.height / 2) {
          target = sibling;
          break;
        }
      }

      const wouldNoOp = target === item.nextElementSibling
        || (target === null && item === chainList.lastElementChild);
      const finalTarget = wouldNoOp ? undefined : target;
      if (finalTarget === this.#dropTarget) return;

      this.#dropTargetMarker?.classList.remove(
        'drop-target-before', 'drop-target-after'
      );
      this.#dropTargetMarker = null;

      if (finalTarget === null) {
        this.#dropTargetMarker = chainList.lastElementChild;
        this.#dropTargetMarker.classList.add('drop-target-after');
      } else if (finalTarget) {
        this.#dropTargetMarker = finalTarget;
        this.#dropTargetMarker.classList.add('drop-target-before');
      }
      this.#dropTarget = finalTarget;
    }

    commitDrop(chainList) {
      const item = this.#activeDragItem;
      if (!item || this.#dropTarget === undefined) return null;

      chainList.insertBefore(item, this.#dropTarget);
      this.#order = Array.from(
        chainList.children, (li) => li.dataset.step
      );
      return item;
    }

    endDrag() {
      const item = this.#activeDragItem;
      if (!item) return;

      this.#dropTargetMarker?.classList.remove(
        'drop-target-before', 'drop-target-after'
      );
      item.classList.remove('active-drag-item');
      item.style.removeProperty('--drag-offset');
      this.#activeDragItem = null;
      this.#dropTarget = undefined;
      this.#dropTargetMarker = null;
      this.#startY = 0;
      this.#initialItemTop = 0;
    }

    isOrderCorrect() {
      return this.#order.every((step, i) => step === this.#steps[i]);
    }

    orderResults() {
      return this.#order.map((step, i) => ({
        step,
        isCorrect: step === this.#steps[i]
      }));
    }
  }

  return {
    getInstance(elOrId, definition) {
      const id = elOrId.id || elOrId;
      if (!instances[id]) {
        // Fallback for the discard-and-recreate reset path: the
        // delegated click handler has the element but not the
        // definition, so look it up from the cached slice.
        definition ??= causalChains[id];
        if (!definition) throw new Error(
          'CausalChainFactory: no definition for "' + id + '"'
        );
        instances[id] = new CausalChain(id, definition, KEY);
      }
      return instances[id];
    },
    discard(id) {
      delete instances[id];
    },
    discardAll() {
      for (const k in instances) delete instances[k];
    }
  };
})();

const chainCardText = ({ title, start, end }) => ({ title, start, end });

export async function setupCausalChains() {
  causalChains = await getCausalChains();

  const wrap = document.getElementById('chains-wrap');
  wrap.addEventListener('click', handleChainClick);
  wireChainDrag(wrap);
  renderCausalChains();
}

function renderCausalChains() {
  const wrap = document.getElementById('chains-wrap');
  wrap.innerHTML = '';
  CausalChainFactory.discardAll();

  Object.entries(causalChains).forEach(([id, definition]) => {
    const chain = CausalChainFactory.getInstance(id, definition);
    const { card, chainListEl } = buildChainCard(chain, chainCardText(definition));
    wrap.appendChild(card);
    renderChainList(chain, chainListEl);
  });
}

function handleChainClick(e) {
  const card = e.target.closest('.card');
  if (!card) return;

  const chainList = card.querySelector('.chain-list');
  if (!chainList) return;

  if (e.target.closest('.chain-reset')) {
    CausalChainFactory.discard(chainList.id);
    renderChainList(CausalChainFactory.getInstance(chainList), chainList);
    card.querySelector('.chain-feedback').innerHTML = '';
  } else if (e.target.closest('.chain-check')) {
    showCheckResult(CausalChainFactory.getInstance(chainList), chainList);
  }
}

function wireChainDrag(wrap) {
  let activeChain = null;
  let activeChainList = null;
  let activePointerId = null;

  function cleanup() {
    activeChain.endDrag();
    document.documentElement.classList.remove('active-chain-drag');
    activeChainList.classList.remove('dragging-chain');
    activeChain = null;
    activeChainList = null;
    activePointerId = null;
  }

  function handlePointerDown(e) {
    if (!e.isPrimary || e.button !== 0) return;

    const chainItem = e.target.closest('.chain-list > li');
    if (!chainItem) return;

    const chainList = chainItem.closest('.chain-list');
    for (const el of chainList.querySelectorAll('.just-dropped')) {
      el.classList.remove('just-dropped');
    }

    activeChain = CausalChainFactory.getInstance(chainList);
    activeChainList = chainList;
    activePointerId = e.pointerId;
    chainItem.setPointerCapture(e.pointerId);
    activeChain.startDrag(chainItem, e.clientY);
    document.documentElement.classList.add('active-chain-drag');
    chainList.classList.add('dragging-chain');
  }

  function handlePointerMove(e) {
    if (!activeChain || e.pointerId !== activePointerId) return;

    activeChain.dragMove(e.clientY, activeChainList);
  }

  function handlePointerUp(e) {
    if (!activeChain || e.pointerId !== activePointerId) return;

    const moved = activeChain.commitDrop(activeChainList);
    if (moved) {
      moved.addEventListener('animationend', () => {
        moved.classList.remove('just-dropped');
      }, { once: true });
      moved.classList.add('just-dropped');
    }
    cleanup();
  }

  function handlePointerCancel(e) {
    if (e.pointerId !== activePointerId) return;
    if (!activeChain) return;

    cleanup();
  }

  function handleEscKey(e) {
    if (e.key !== 'Escape') return;
    if (!activeChain) return;

    cleanup();
  }

  wrap.addEventListener('pointerdown', handlePointerDown);
  wrap.addEventListener('pointermove', handlePointerMove);
  wrap.addEventListener('pointerup', handlePointerUp);
  wrap.addEventListener('pointercancel', handlePointerCancel);
  document.addEventListener('keydown', handleEscKey);
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
      + '<button class="btn primary chain-check">Check Order</button>'
      + '<button class="btn chain-reset">Reset</button></div>'
    + '<div class="feedback-gap chain-feedback"></div>';
  return {
    card,
    chainListEl: card.querySelector('.chain-list')
  };
}

function renderChainList(chain, chainListEl) {
  chainListEl.innerHTML = '';
  const itemTemplate = document.createElement('li');
  chain.currentOrder().forEach((step) => {
    const chainItem = itemTemplate.cloneNode(false);
    chainItem.dataset.step = step;
    chainItem.innerHTML = expandAbbr(step);
    chainListEl.appendChild(chainItem);
  });
}

function showCheckResult(chain, chainList) {
  const results = chain.orderResults();
  [...chainList.children].forEach((chainItem, i) => {
    chainItem.classList.toggle('correct', results[i].isCorrect);
    chainItem.classList.toggle('incorrect', !results[i].isCorrect);
  });
  const card = chainList.closest('.card');
  const feedbackEl = card.querySelector('.chain-feedback');
  feedbackEl.innerHTML = chain.isOrderCorrect()
    ? '<div class="feedback-box">Correct order.</div>'
    : '<div class="feedback-box error">'
      + 'Not quite. Correct order:'
      + ' <ol class="chain-correct-list"><li>'
      + chain.correctOrder().map((s) => expandAbbr(s))
        .join('</li><li>') + '</li></ol></div>';
}
