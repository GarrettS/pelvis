// Architecture: prd/architecture/diagnose-causal-chains.md

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
    const ol = chainItem.parentNode;
    if (ol.ariaDisabled === 'true') return;

    // Pressing on an LI is drag intent, never selection-initiation.
    // Selection started outside an LI can still extend through it.
    e.preventDefault();

    activeChainList = CausalChain.getById(ol.id);
    activePointerId = e.pointerId;
    chainItem.setPointerCapture(e.pointerId);
    activeChainList.startDrag(chainItem, e.pageY);
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
      && activeChainList.dragMove(e.pageY));

  container.addEventListener('pointerup', e =>
    activeChainList && e.pointerId === activePointerId
      && (activeChainList.commitDrop(), cleanup()));

  container.addEventListener('pointercancel', e =>
    activeChainList && e.pointerId === activePointerId && cleanup());

  document.addEventListener('keydown', e =>
    activeChainList && e.key === 'Escape' && cleanup());
}

const buildChainListForm = (chainList, { title, start, end, infoBonus }) =>
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
      ${infoBonus ? `<details class="chain-infobonus" name="${chainList.id}">
        <summary>${expandAbbr(infoBonus.summary)}</summary>
        <ul>${infoBonus.points.map(p => `<li>${expandAbbr(p)}</li>`).join('')}</ul>
      </details>` : ''}
    `
  });

const renderChainList = chainList => {
  const ol = document.getElementById(chainList.id);
  const form = document.forms[ol.id];
  const oldTops = new Map(
    [...realItems(ol)].map(li => [li.dataset.step, li.getBoundingClientRect().top])
  );
  ol.classList.remove('grading-stale');
  ol.ariaDisabled = false;
  clearBonusReveal(form);
  form.check.disabled = false;
  ol.replaceChildren(
    ...chainList.getCurrentOrder().map(step =>
      newEl('li', {innerHTML: expandAbbr(step), attrs: {'data-step': step}})));
  realItems(ol).forEach(li => {
    const oldTop = oldTops.get(li.dataset.step);
    if (oldTop !== undefined) {
      const delta = oldTop - li.getBoundingClientRect().top;
      if (delta) li.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: DUR_NORMAL, easing: 'ease-out' }
      );
    } else {
      li.animate([
        { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: DUR_NORMAL, easing: 'ease-out' });
    }
  });
};

// chainListEl may contain a transient .chain-clone-list OL during drag/settle;
// :scope > li excludes it.
const realItems = chainListEl =>
  chainListEl.querySelectorAll(':scope > li');

const bonusDetailsFor = form =>
  form.querySelector(`details[name="${form.name}"]`);

const clearBonusReveal = form => {
  form.classList.remove('revealed');
  bonusDetailsFor(form)?.removeAttribute('open');
};

const revealBonus = form => {
  form.classList.add('revealed');
  const details = bonusDetailsFor(form);
  if (details) details.open = true;
};

const playCorrectCascade = items => {
  items.forEach((item, i) => {
    item.animate([
      { transform: 'scale(1)', boxShadow: 'none' },
      {
        transform: 'scale(1.02)',
        boxShadow: '0 0 12px var(--correct-border), inset 0 0 8px var(--correct-border)',
        borderColor: 'transparent',
        offset: 0.3
      },
      { transform: 'scale(1)', boxShadow: 'none' }
    ], {
      duration: DUR_NORMAL,
      delay: i * DUR_FAST / 2,
      easing: 'ease-out'
    });
  });
};

const markOrderResults = chainList => {
  const ol = document.getElementById(chainList.id);
  const form = document.forms[ol.id];
  ol.classList.remove('grading-stale');
  const results = chainList.orderResults();
  const items = realItems(ol);

  items.forEach((chainItem, i) => {
    chainItem.classList.toggle('correct', results[i].isCorrect);
    chainItem.classList.toggle('incorrect', !results[i].isCorrect);
  });

  if (results.every(r => r.isCorrect)) {
    revealBonus(form);
    ol.ariaDisabled = true;
    form.check.disabled = true;
    playCorrectCascade(items);
  } else if (chainList.needsHint()) {
    revealBonus(form);
  }
};

const SETTLE_SPEED = 1.5;   // px per ms
const SETTLE_MIN_MS = 200;
const SETTLE_MAX_MS = 600;

const calculateSettleDuration = dy =>
  Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, Math.abs(dy) / SETTLE_SPEED));

const cssTokens = getComputedStyle(document.documentElement);
const DUR_SLOW = parseFloat(cssTokens.getPropertyValue('--dur-slow'));
const DUR_NORMAL = parseFloat(cssTokens.getPropertyValue('--dur-normal'));
const DUR_FAST = parseFloat(cssTokens.getPropertyValue('--dur-fast'));

const BONUS_HINT_THRESHOLD = 3;

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
  #currentOrder;
  #dragSession = null;
  #wrongChecks = 0;
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
    this.#currentOrder = toShuffled(steps);
  }

  get id() { return this.#id; }
  getCurrentOrder() { return this.#currentOrder.slice(); }

  needsHint() {
    return ++this.#wrongChecks === BONUS_HINT_THRESHOLD;
  }

  static #captureBaseline(chainItem, pageStartY) {
    const chainListEl = chainItem.parentNode;
    const chainItemRect = chainItem.getBoundingClientRect();
    const chainListRect = chainListEl.getBoundingClientRect();
    const itemsExcludingClones = [...realItems(chainListEl)];
    const currentItemIndex = itemsExcludingClones.indexOf(chainItem);
    const scroll = window.scrollY;

    // BCRs are viewport-relative; add scroll once at capture to land in
    // document coords. The wire passes PointerEvent.pageY at both
    // pointerdown and pointermove, so pointer coords arrive document-
    // relative and stay race-free with async (compositor-thread) scroll.
    const pageInitialItemTop = chainItemRect.top + scroll;
    const pageListTop = chainListRect.top + scroll;
    const pageListBottom = chainListRect.bottom + scroll;
    const itemHeight = chainItemRect.height;

    const siblingThresholds = [];
    for (const sibling of itemsExcludingClones) {
      if (sibling === chainItem) continue;
      // Use the sibling's final layout position (subtract any in-flight
      // transform) so hit-tests stay calibrated when the user picks up
      // mid-FLIP — animations finish in the background; thresholds are
      // already pointed at where the slots will end up.
      const box = sibling.getBoundingClientRect();
      const transform = getComputedStyle(sibling).transform;
      const animOffsetY = transform === 'none' ? 0 : new DOMMatrix(transform).m42;
      siblingThresholds.push({
        sibling,
        pageThresholdY: box.top - animOffsetY + box.height / 2 + scroll
      });
    }

    return Object.freeze({
      chainListEl,
      chainItem,
      pageStartY,
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
    // Drag start = user has signaled intent to change the order, so any
    // prior grading is stale. CSS suppresses .correct / .incorrect under
    // the OL-level class; Check Order or Reshuffle clears it. Re-enable
    // Check Order in case the prior grading disabled it (all-correct).
    chainListEl.classList.add('grading-stale');
    const form = document.forms[chainListEl.id];
    form.check.disabled = false;

    return {
      dropTarget: initialDropTarget,
      marker: null,
      clone,
      baseline
    };
  }

  startDrag(chainItem, pageStartY) {
    this.#wrongChecks = 0;
    this.#dragSession = CausalChain.#commitDragDOM(
      CausalChain.#captureBaseline(chainItem, pageStartY));
  }

  dragMove(pageY) {
    const deltaY = this.#getConstrainedDeltaY(pageY);
    const target = this.#findTargetSibling(pageY);
    this.#applyDragStyles(deltaY);
    if (target === this.#dragSession.dropTarget) return;

    this.#updateDropMarker(target);
    this.#dragSession.dropTarget = target;
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(pageY) {
    const { pageStartY, minDelta, maxDelta } = this.#dragSession.baseline;
    return Math.max(minDelta, Math.min(maxDelta, pageY - pageStartY));
  }

  #findTargetSibling(pageY) {
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
    const session = this.#dragSession;
    const { dropTarget, baseline, clone, marker } = session;
    if (dropTarget === baseline.initialDropTarget) {
      // No reorder — restore the prior grading display; endDrag will
      // settle the clone back to its origin.
      baseline.chainListEl.classList.remove('grading-stale');
      return;
    }
    const { chainItem, chainListEl } = baseline;
    marker?.classList.remove('drop-target-before', 'drop-target-after');
    const items = [...realItems(chainListEl)];
    const oldTops = new Map(items.map(li => [li, li.getBoundingClientRect().top]));
    // Dragged LI sits dim at its old DOM slot during drag; the user sees
    // the clone at the release position. FLIP from the clone's position
    // so the dragged item doesn't snap back to its origin on commit.
    oldTops.set(chainItem, clone.getBoundingClientRect().top);
    chainListEl.insertBefore(chainItem, dropTarget);
    this.#currentOrder = Array.from(realItems(chainListEl), li => li.dataset.step);
    chainItem.classList.remove('active-drag-item');
    items.forEach(li => {
      const delta = oldTops.get(li) - li.getBoundingClientRect().top;
      if (delta) li.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: DUR_NORMAL, easing: 'ease-out' }
      );
    });
    clone.remove();
    this.#dragSession = null;
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
    return this.#currentOrder.map((step, i) => ({
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
