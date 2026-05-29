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
      && activeChainList.dragMove(e.pageY, e.clientY));

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

// FLIP: record each row's top, run the DOM change, then animate every row
// from its old top to its new one. customOrigins overrides a row's recorded
// start — the drag clone's release point feeds in there so a dropped row
// eases from the pointer instead of its dim DOM slot. A row with no recorded
// start (a freshly rendered step) gets the entrance fade instead.
const animateLayoutChange = (container, mutate, customOrigins = new Map()) => {
  const oldTops = new Map(Array.from(realItems(container),
    li => [li.dataset.step, li.getBoundingClientRect().top]));
  customOrigins.forEach((top, step) => oldTops.set(step, top));

  mutate();

  realItems(container).forEach(li => {
    const oldTop = oldTops.get(li.dataset.step);
    if (oldTop === undefined) {
      li.animate(
        [{opacity: 0, transform: 'translateY(-6px)'},
         {opacity: 1, transform: 'translateY(0)'}],
        {duration: DUR_NORMAL, easing: 'ease-out'});
      return;
    }
    const delta = oldTop - li.getBoundingClientRect().top;
    if (delta) li.animate(
      [{transform: `translateY(${delta}px)`}, {transform: 'translateY(0)'}],
      {duration: DUR_NORMAL, easing: 'ease-out'});
  });
};

const renderChainList = chainList => {
  const ol = document.getElementById(chainList.id);
  const form = document.forms[ol.id];
  ol.classList.remove('grading-stale', 'all-correct');
  ol.ariaDisabled = false;
  clearBonusReveal(form);
  form.check.disabled = false;
  animateLayoutChange(ol, () => ol.replaceChildren(
    ...chainList.getCurrentOrder().map(step =>
      newEl('li', {innerHTML: expandAbbr(step), attrs: {'data-step': step}}))));
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
    ol.ariaDisabled = form.check.disabled = true;
    items.forEach(({style}, i) => style.setProperty('--i', i));
    ol.classList.add('all-correct');
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
const DUR_NORMAL = parseFloat(cssTokens.getPropertyValue('--dur-normal'));

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

  // One batched read of everything the baseline needs (the read phase).
  // Everything after is pure math off this snapshot — no more layout reads.
  static #measure(chainItem) {
    const chainListEl = chainItem.parentNode;
    const items = [...realItems(chainListEl)];
    return {
      chainListEl,
      items,
      itemRect: chainItem.getBoundingClientRect(),
      listRect: chainListEl.getBoundingClientRect(),
      scroll: window.scrollY,
      viewportHeight: window.innerHeight,
      // Visible content starts below the sticky nav, whose height the scroller
      // reserves as scroll-padding-top; the up-edge autoscroll trigger reads it.
      topInset: parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
      siblings: items
        .filter(li => li !== chainItem)
        .map(li => ({
          li,
          box: li.getBoundingClientRect(),
          transform: getComputedStyle(li).transform
        }))
    };
  }

  // Hit-test midpoints in document coords. Subtract each sibling's in-flight
  // transform so a mid-FLIP pickup still targets the settled slot, not the
  // animating position.
  static #siblingThresholds({ siblings, scroll }) {
    return siblings.map(({ li, box, transform }) => {
      const animOffsetY = transform === 'none' ? 0 : new DOMMatrix(transform).m42;
      const pageThresholdY = box.top - animOffsetY + box.height / 2 + scroll;
      return { sibling: li, pageThresholdY };
    });
  }

  static #captureBaseline(chainItem, pageStartY) {
    const m = CausalChain.#measure(chainItem);
    const { itemRect, listRect, scroll, items } = m;
    const index = items.indexOf(chainItem);

    // BCRs are viewport-relative; + scroll lands them in document coords so the
    // clamp range matches the document-space pointer delta (see the Scroll Trap).
    const pageItemTop = itemRect.top + scroll;
    const pageListTop = listRect.top + scroll;
    const pageListBottom = listRect.bottom + scroll;

    return Object.freeze({
      chainListEl: m.chainListEl,
      chainItem,
      pageStartY,
      items,
      cloneTop: Math.round(itemRect.top - listRect.top),
      displayRank: index + 1,
      initialDropTarget: items[index + 1],
      itemHeight: itemRect.height,
      topInset: m.topInset,
      // Clone is clamped inside the list, so it clips only when the list
      // extends past the visible region — under the sticky nav (topInset) or
      // below the fold — decided once; no per-frame scroll if it fits.
      autoscroll: listRect.top < m.topInset || listRect.bottom > m.viewportHeight,
      minDelta: pageListTop - pageItemTop,
      maxDelta: pageListBottom - itemRect.height - pageItemTop,
      siblingThresholds: CausalChain.#siblingThresholds(m)
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
    // Drag start = user signaled intent to change the order, so prior
    // grading is stale. CSS suppresses .correct / .incorrect under the
    // OL-level class; Check Order or Reshuffle clears it.
    chainListEl.classList.add('grading-stale');

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

  dragMove(pageY, clientY) {
    const deltaY = this.#getConstrainedDeltaY(pageY);
    this.#dragSession.clone.style.setProperty('--drag-offset', deltaY + 'px');
    this.#maybeAutoscroll(clientY);

    const target = this.#findTargetSibling(pageY);
    // Loose ==: a null target and the undefined initial seed both mean
    // "no target" (end of list), so a genuine no-move doesn't re-mark.
    if (target == this.#dragSession.dropTarget) return;

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

  // All the autoscroll runtime in one place. baseline.autoscroll (decided once)
  // gates it; then scroll when the pointer enters an itemHeight band at either
  // edge of the visible region — the top edge is the sticky-nav inset, not the
  // viewport top, and scroll-padding-top lands the clone clear of the nav.
  // clientY is read fresh each frame (viewport coords, never cached) so it
  // can't go stale as the page scrolls.
  #maybeAutoscroll(clientY) {
    const { autoscroll, topInset, itemHeight } = this.#dragSession.baseline;
    if (!autoscroll) return;
    if (clientY < topInset + itemHeight || clientY > window.innerHeight - itemHeight)
      this.#dragSession.clone.scrollIntoView({block: 'nearest'});
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

    // Loose ==: "no target" is null from #findTargetSibling but undefined from
    // initialDropTarget at end-of-list — treat both as the same no-target.
    if (dropTarget == baseline.initialDropTarget) {
      // No reorder — restore the prior grading display; endDrag will
      // settle the clone back to its origin.
      baseline.chainListEl.classList.remove('grading-stale');
      return;
    }

    const { chainItem, chainListEl } = baseline;
    marker?.classList.remove('drop-target-before', 'drop-target-after');

    // Un-dim before the FLIP so the row eases at full opacity. The clone's
    // release top seeds the dragged row's origin, so it settles from the
    // pointer instead of snapping back to its dim DOM slot.
    chainItem.classList.remove('active-drag-item');
    animateLayoutChange(chainListEl, () => {
      chainListEl.insertBefore(chainItem, dropTarget);
      this.#currentOrder = Array.from(realItems(chainListEl), li => li.dataset.step);
    }, new Map([[chainItem.dataset.step, clone.getBoundingClientRect().top]]));
    chainItem.classList.add('dropped');
    chainItem.addEventListener('animationend',
      () => chainItem.classList.remove('dropped'), {once: true});
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

  // Glide the clone back to the item's slot, then remove it on transitionend.
  // Runs only for a no-op drop (released in place) or Esc/cancel — a real
  // reorder animates through animateLayoutChange and skips this.
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
