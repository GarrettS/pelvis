import {toShuffled} from './shuffle.js';
import {newEl} from './el-create.js';
import {escapeHTML} from './escape-html.js';

const handleSubmit = e =>
  SortableListForm.getById(e.target.name)[e.submitter.name]?.(e.preventDefault());

function wireDrag(container) {
  let activeForm = null;
  let activePointerId = null;

  const cleanup = () => {
    activeForm.endDrag();
    document.documentElement.classList.remove('list-drag-active');
    activeForm = activePointerId = null;
  };

  container.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || activeForm) return;

    const dragItem = e.target.closest('.sortable-list > li');
    if (!dragItem) return;
    const ol = dragItem.parentNode;
    if (ol.ariaDisabled === 'true') return;

    // Pressing on an LI is drag intent, never selection-initiation.
    // Selection started outside an LI can still extend through it.
    e.preventDefault();

    activeForm = SortableListForm.getById(ol.id);
    activePointerId = e.pointerId;
    dragItem.setPointerCapture(e.pointerId);
    activeForm.startDrag(dragItem, e.pageY);
    document.documentElement.classList.add('list-drag-active');
  });

  // iOS WebKit's text-selection initiation is driven by touchstart's
  // default behavior. preventDefault on touchstart (passive: false) cancels
  // it. pointerdown.preventDefault doesn't — it only suppresses emulated
  // mouse events at tap end.
  container.addEventListener('touchstart',
    e => e.target.closest('.sortable-list > li') && e.preventDefault(),
    {passive: false});

  container.addEventListener('pointermove', e =>
    activeForm && e.pointerId === activePointerId
      && activeForm.dragMove(e.pageY, e.clientY));

  container.addEventListener('pointerup', e =>
    activeForm && e.pointerId === activePointerId
      && (activeForm.commitDrop(), cleanup()));

  container.addEventListener('pointercancel', e =>
    activeForm && e.pointerId === activePointerId && cleanup());

  document.addEventListener('keydown', e =>
    activeForm && e.key === 'Escape' && cleanup());
}

export function bindContainer(container) {
  container.addEventListener('submit', handleSubmit);
  wireDrag(container);
}

const SETTLE_SPEED = 1.5;   // px per ms
const SETTLE_MIN_MS = 200;
const SETTLE_MAX_MS = 600;

const calculateSettleDuration = dy =>
  Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, Math.abs(dy) / SETTLE_SPEED));

const DUR_NORMAL = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--dur-normal'));

const BONUS_HINT_THRESHOLD = 3;

export class SortableListForm {
  static #instances = Object.create(null);
  static #KEY = Symbol();

  static getById(id, definition) {
    return SortableListForm.#instances[id] ??= SortableListForm.#create(id, definition);
  }

  static #create(id, definition) {
    if (!definition) throw new Error(
      'SortableListForm: no definition for "' + id + '"'
    );
    return new SortableListForm(id, definition, SortableListForm.#KEY);
  }

  #id;
  #form;
  #steps;
  #currentOrder;
  #renderItemHTML;
  #dragSession = null;
  #wrongChecks = 0;

  constructor(id, definition, key) {
    if (key !== SortableListForm.#KEY) throw new Error(
      'SortableListForm: use SortableListForm.getById()'
    );
    const { renderItemHTML = escapeHTML, renderFormHTML, ...data } = definition;
    this.#id = id;
    this.#steps = Object.freeze([...data.steps]);
    this.#currentOrder = toShuffled(data.steps);
    this.#renderItemHTML = renderItemHTML;
    this.#form = newEl('form', {
      className: 'card',
      attrs: {name: id},
      innerHTML: renderFormHTML(data)
    });
    const ol = this.#form.querySelector('.sortable-list');
    ol.id = id;
    ol.append(...this.#buildItems());
  }

  get id() { return this.#id; }
  get form() { return this.#form; }

  reshuffle() {
    this.#currentOrder = toShuffled(this.#steps);
    this.#wrongChecks = 0;
    const ol = this.#form.querySelector('.sortable-list');
    ol.classList.remove('grading-stale', 'all-correct');
    ol.ariaDisabled = false;
    this.#form.checkResults.disabled = false;
    this.#clearBonusReveal();
    SortableListForm.#animateLayoutChange(ol,
      () => ol.replaceChildren(...this.#buildItems()));
  }

  checkResults() {
    const ol = this.#form.querySelector('.sortable-list');
    ol.classList.remove('grading-stale');
    const items = SortableListForm.#realItems(ol);
    const results = this.#currentOrder.map((step, i) => ({
      step, isCorrect: step === this.#steps[i]
    }));
    items.forEach((li, i) => {
      li.classList.toggle('correct', results[i].isCorrect);
      li.classList.toggle('incorrect', !results[i].isCorrect);
    });
    if (results.every(r => r.isCorrect)) {
      this.#revealBonus();
      ol.ariaDisabled = this.#form.checkResults.disabled = true;
      items.forEach(({style}, i) => style.setProperty('--i', i));
      ol.classList.add('all-correct');
    } else if (++this.#wrongChecks === BONUS_HINT_THRESHOLD) {
      this.#revealBonus();
    }
  }

  #buildItems() {
    return this.#currentOrder.map(step =>
      newEl('li', {innerHTML: this.#renderItemHTML(step), attrs: {'data-step': step}}));
  }

  #revealBonus() {
    this.#form.classList.add('revealed');
    const details = this.#form.querySelector('details');
    if (details) details.open = true;
  }

  #clearBonusReveal() {
    this.#form.classList.remove('revealed');
    const details = this.#form.querySelector('details');
    if (details) details.open = false;
  }

  startDrag(dragItem, pageStartY) {
    this.#wrongChecks = 0;
    this.#dragSession = SortableListForm.#commitDragDOM(
      SortableListForm.#captureDragBaseline(dragItem, pageStartY));
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

  commitDrop() {
    const session = this.#dragSession;
    const { dropTarget, baseline, clone, marker } = session;
    const { dragItem, listEl } = baseline;
    marker?.classList.remove('drop-target-before', 'drop-target-after');

    // Loose ==: "no target" is null from #findTargetSibling but undefined from
    // initialDropTarget at end-of-list — treat both as the same no-target.
    if (dropTarget == baseline.initialDropTarget) {
      // No reorder — restore the prior grading and settle the clone back to
      // the item's unchanged slot.
      listEl.classList.remove('grading-stale');
      this.#settleClone(clone, dragItem);
      this.#dragSession = null;
      return;
    }

    // Un-dim before the FLIP so the row eases at full opacity. The clone's
    // release top seeds the dragged row's origin, so it settles from the
    // pointer instead of snapping back to its dim DOM slot.
    dragItem.classList.remove('active-drag-item');
    SortableListForm.#animateLayoutChange(listEl, () => {
      listEl.insertBefore(dragItem, dropTarget);
      this.#currentOrder = Array.from(
        SortableListForm.#realItems(listEl), li => li.dataset.step);
    }, new Map([[dragItem.dataset.step, clone.getBoundingClientRect().top]]));
    dragItem.classList.add('dropped');
    dragItem.addEventListener('animationend',
      () => dragItem.classList.remove('dropped'), {once: true});
    clone.remove();
    this.#dragSession = null;
  }

  // Abort path: Esc or pointercancel. commitDrop fully resolves a real drop
  // and nulls the session, so this runs only when the drag is cancelled —
  // settle the clone back to the item's slot and clear the session.
  endDrag() {
    const session = this.#dragSession;
    if (!session) return;
    session.marker?.classList.remove('drop-target-before', 'drop-target-after');
    this.#settleClone(session.clone, session.baseline.dragItem);
    this.#dragSession = null;
  }

  // One batched read of every layout fact the drag baseline needs: refs,
  // BCRs, scroll, viewport, scroll-padding inset. No derivations.
  static #readDragInputs(dragItem) {
    const listEl = dragItem.parentNode;
    return {
      listEl,
      items: [...SortableListForm.#realItems(listEl)],
      itemRect: dragItem.getBoundingClientRect(),
      listRect: listEl.getBoundingClientRect(),
      scroll: window.scrollY,
      viewportHeight: window.innerHeight,
      // Visible content starts below the document's scroll-padding-top
      // inset; the up-edge autoscroll trigger reads it.
      topInset: parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    };
  }

  // Hit-test midpoints in document coords. Reads each sibling's BCR and its
  // in-flight transform, subtracting the transform so a mid-FLIP pickup still
  // targets the settled slot, not the animating position.
  static #readSiblingDropMidpoints(items, dragItem, scroll) {
    const midpoints = [];
    for (const li of items) {
      if (li === dragItem) continue;
      const box = li.getBoundingClientRect();
      const transform = getComputedStyle(li).transform;
      const animOffsetY = transform === 'none'
        ? 0 : new DOMMatrix(transform).m42;
      midpoints.push({
        sibling: li,
        pageMidpointY: box.top - animOffsetY + box.height / 2 + scroll
      });
    }
    return midpoints;
  }

  static #captureDragBaseline(dragItem, pageStartY) {
    const dragInputs = SortableListForm.#readDragInputs(dragItem);
    const {
      listEl, items, itemRect, listRect, scroll, viewportHeight, topInset
    } = dragInputs;
    const index = items.indexOf(dragItem);

    // BCRs are viewport-relative; + scroll lands them in document coords so
    // the clamp range matches the document-space pointer delta.
    const pageItemTop = itemRect.top + scroll;
    const pageListTop = listRect.top + scroll;
    const pageListBottom = listRect.bottom + scroll;

    return Object.freeze({
      listEl,
      dragItem,
      pageStartY,
      items,
      cloneTop: Math.round(itemRect.top - listRect.top),
      displayRank: index + 1,
      initialDropTarget: items[index + 1],
      itemHeight: itemRect.height,
      topInset,
      // Clone is clamped inside the list, so it clips only when the list
      // extends past the visible region — above topInset or below the
      // fold — decided once; no per-frame scroll if it fits.
      autoscroll: listRect.top < topInset || listRect.bottom > viewportHeight,
      minDelta: pageListTop - pageItemTop,
      maxDelta: pageListBottom - itemRect.height - pageItemTop,
      siblingDropMidpoints:
        SortableListForm.#readSiblingDropMidpoints(items, dragItem, scroll)
    });
  }

  static #commitDragDOM(baseline) {
    const {
      listEl, dragItem, displayRank, cloneTop, initialDropTarget
    } = baseline;

    listEl.querySelector('.sortable-list-clone')?.remove();
    const clone = listEl.insertBefore(newEl('ol', {
      className: 'sortable-list-clone',
      attrs: {start: displayRank, style: `top: ${cloneTop}px`},
      children: [dragItem.cloneNode(true)]
    }), dragItem);
    dragItem.classList.add('active-drag-item');
    // Drag start = user signaled intent to change the order, so prior
    // grading is stale. CSS suppresses .correct / .incorrect under the
    // OL-level class; checkResults() or reshuffle() clears it.
    listEl.classList.add('grading-stale');

    return {
      dropTarget: initialDropTarget,
      marker: null,
      clone,
      baseline
    };
  }

  #getConstrainedDeltaY(pageY) {
    const { pageStartY, minDelta, maxDelta } = this.#dragSession.baseline;
    return Math.max(minDelta, Math.min(maxDelta, pageY - pageStartY));
  }

  #findTargetSibling(pageY) {
    return this.#dragSession.baseline.siblingDropMidpoints
      .find(({ pageMidpointY }) => pageY <= pageMidpointY)?.sibling ?? null;
  }

  // All the autoscroll runtime in one place. baseline.autoscroll (decided
  // once) gates it; then scroll when the pointer enters an itemHeight band
  // at either edge of the visible region. The top edge is `topInset` from
  // document scroll-padding-top, not the viewport top. clientY is read
  // fresh each frame (viewport coords, never cached) so it can't go stale
  // as the page scrolls.
  #maybeAutoscroll(clientY) {
    const { autoscroll, topInset, itemHeight } = this.#dragSession.baseline;
    if (!autoscroll) return;
    if (clientY < topInset + itemHeight || clientY > window.innerHeight - itemHeight)
      this.#dragSession.clone.scrollIntoView({block: 'nearest'});
  }

  #updateDropMarker(target) {
    const session = this.#dragSession;
    const { dragItem, listEl } = session.baseline;
    session.marker?.classList.remove('drop-target-before', 'drop-target-after');
    const wouldNotMove = target === dragItem.nextElementSibling
      || (target === null && dragItem === listEl.lastElementChild);
    session.marker = wouldNotMove
      ? null
      : (target ?? listEl.lastElementChild);
    session.marker?.classList.add(
      target ? 'drop-target-before' : 'drop-target-after'
    );
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

  // Glide the clone back to the item's slot, then remove it on
  // transitionend. Runs only for a no-op drop (released in place) or
  // Esc/cancel — a real reorder animates through #animateLayoutChange and
  // skips this.
  #settleClone(clone, item) {
    item.classList.remove('active-drag-item');

    const dy = item.getBoundingClientRect().top
      - clone.getBoundingClientRect().top;

    // Sub-pixel dy: changing --drag-offset by < .5px wouldn't move the
    // transform enough for a transition to fire, so transitionend wouldn't
    // fire and the clone would stay in the DOM. Happens when the clone is
    // already at the item's slot at release: a no-op drop on the item's own
    // slot, or Escape with the clone over the slot. Remove synchronously.
    if (Math.abs(dy) < 0.5) {
      clone.remove();
      return;
    }

    const currentOffset = parseFloat(
      clone.style.getPropertyValue('--drag-offset')
    ) || 0;

    clone.style.transitionDuration = calculateSettleDuration(dy) + 'ms';
    clone.classList.add('settling');
    clone.addEventListener('transitionend', () => clone.remove(), {once: true});

    // Defer the offset change so .settling takes effect first. If the
    // classList.add and the property write land in the same style update,
    // the browser collapses them — no transitionable before-state, the
    // clone snaps home.
    requestAnimationFrame(() =>
      clone.style.setProperty('--drag-offset', (currentOffset + dy) + 'px'));
  }

  // listEl may contain a transient .sortable-list-clone OL during
  // drag/settle; :scope > li excludes it.
  static #realItems(listEl) {
    return listEl.querySelectorAll(':scope > li');
  }

  // FLIP: record each row's top, run the DOM change, then animate every
  // row from its old top to its new one. customOrigins overrides a row's
  // recorded start — the drag clone's release point feeds in there so a
  // dropped row eases from the pointer instead of its dim DOM slot.
  // Invariant: every post-mutation row's data-step is in oldTops —
  // reshuffle keeps the step set; a drop persists the nodes and
  // customOrigins covers the dragged row's release point.
  static #animateLayoutChange(container, mutate, customOrigins = new Map()) {
    const oldTops = new Map(Array.from(SortableListForm.#realItems(container),
      li => [li.dataset.step, li.getBoundingClientRect().top]));
    customOrigins.forEach((top, step) => oldTops.set(step, top));

    mutate();

    SortableListForm.#realItems(container).forEach(li => {
      const delta = oldTops.get(li.dataset.step) - li.getBoundingClientRect().top;
      if (delta) li.animate(
        [{transform: `translateY(${delta}px)`}, {transform: 'translateY(0)'}],
        {duration: DUR_NORMAL, easing: 'ease-out'});
    });
  }
}
