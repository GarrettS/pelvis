import {toShuffled} from './shuffle.js';
import {newEl} from './el-create.js';
import {escapeHTML} from './escape-html.js';

const SETTLE_SPEED = 1.5;   // px per ms
const SETTLE_MIN_MS = 200;
const SETTLE_MAX_MS = 600;

const calculateSettleDuration = dy =>
  Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, Math.abs(dy) / SETTLE_SPEED));

const BONUS_HINT_THRESHOLD = 3;

export class SortableListContainer {
  #el;
  renderFormHTML;
  renderItemHTML;
  flipDuration;
  #activeForm = null;
  #activePointerId = null;

  constructor(el, {renderFormHTML, renderItemHTML = escapeHTML, flipDuration = 200} = {}) {
    this.#el = el;
    this.renderFormHTML = renderFormHTML;
    this.renderItemHTML = renderItemHTML;
    this.flipDuration = flipDuration;

    el.addEventListener('submit', this.#onSubmit);
    el.addEventListener('pointerdown', this.#onPointerdown);
    el.addEventListener('touchstart', this.#onTouchstart, {passive: false});
    el.addEventListener('pointermove', this.#onPointermove);
    el.addEventListener('pointerup', this.#onPointerup);
    el.addEventListener('pointercancel', this.#onPointercancel);
    el.ownerDocument.addEventListener('keydown', this.#onKeydown);
    el.ownerDocument.defaultView.addEventListener('resize', this.#onResize);
  }

  replaceForms(definitions) {
    const fragment = this.#el.ownerDocument.createDocumentFragment();
    Object.entries(definitions).forEach(([id, definition]) =>
      fragment.append(SortableListForm.getById(id, definition, this).form));
    this.#el.replaceChildren(fragment);
  }

  #onSubmit = e =>
    SortableListForm.getById(e.target.name)[e.submitter.name]?.(e.preventDefault());

  #onPointerdown = e => {
    if (!e.isPrimary || e.button !== 0 || this.#activeForm) return;

    const dragItem = e.target.closest('.sortable-list > li');
    if (!dragItem) return;
    const ol = dragItem.parentNode;
    if (ol.ariaDisabled === 'true') return;

    // Pressing on an LI is drag intent, never selection-initiation.
    // Selection started outside an LI can still extend through it.
    e.preventDefault();

    this.#activeForm = SortableListForm.getById(ol.id);
    this.#activePointerId = e.pointerId;
    dragItem.setPointerCapture(e.pointerId);
    this.#activeForm.startDrag(dragItem, e.pageY);
    this.#el.ownerDocument.documentElement.classList.add('list-drag-active');
  };

  // iOS WebKit's text-selection initiation is driven by touchstart's
  // default behavior. preventDefault on touchstart (passive: false) cancels
  // it. pointerdown.preventDefault doesn't — it only suppresses emulated
  // mouse events at tap end.
  #onTouchstart = e =>
    e.target.closest('.sortable-list > li') && e.preventDefault();

  #onPointermove = e =>
    this.#activeForm && e.pointerId === this.#activePointerId
      && this.#activeForm.dragMove(e.pageY, e.clientY);

  #onPointerup = e =>
    this.#activeForm && e.pointerId === this.#activePointerId
      && (this.#activeForm.commitDrop(), this.#cleanup());

  #onPointercancel = e =>
    this.#activeForm && e.pointerId === this.#activePointerId && this.#cleanup();

  #onKeydown = e =>
    this.#activeForm && e.key === 'Escape' && this.#cleanup();

  // Orientation or window resize relays out the page, staling the frozen
  // baseline (BCRs, clamps, midpoints). Abort like Escape; #settleClone
  // reads live positions, so the clone still glides to the item's slot.
  #onResize = () => this.#activeForm && this.#cleanup();

  #cleanup = () => {
    this.#activeForm.endDrag();
    this.#el.ownerDocument.documentElement.classList.remove('list-drag-active');
    this.#activeForm = this.#activePointerId = null;
  };
}

export class SortableListForm {
  static #instances = Object.create(null);
  static #KEY = Symbol();

  static getById(id, definition, container) {
    return SortableListForm.#instances[id] ??=
      SortableListForm.#create(id, definition, container);
  }

  static #create(id, definition, container) {
    if (!definition) throw new Error(
      'SortableListForm: no definition for "' + id + '"'
    );
    return new SortableListForm(id, definition, container, SortableListForm.#KEY);
  }

  #form;
  #steps;
  #currentOrder;
  #container;
  #dragSession = null;
  #wrongChecks = 0;

  constructor(id, definition, container, key) {
    if (key !== SortableListForm.#KEY) throw new Error(
      'SortableListForm: use SortableListForm.getById()'
    );
    this.#steps = Object.freeze([...definition.steps]);
    this.#currentOrder = toShuffled(definition.steps);
    this.#container = container;
    this.#form = newEl('form', {
      className: 'card',
      attrs: {name: id},
      innerHTML: container.renderFormHTML(definition)
    });
    const ol = this.#form.querySelector('.sortable-list');
    ol.id = id;
    ol.append(...this.#buildItems());
  }

  get form() { return this.#form; }

  reshuffle() {
    this.#currentOrder = toShuffled(this.#steps);
    this.#wrongChecks = 0;
    const ol = this.#form.querySelector('.sortable-list');
    ol.classList.remove('grading-stale', 'all-correct');
    ol.ariaDisabled = false;
    this.#form.elements.checkResults.disabled = false;
    this.#toggleBonusReveal(false);
    this.#animateLayoutChange(ol,
      () => ol.replaceChildren(...this.#buildItems()));
  }

  checkResults() {
    const ol = this.#form.querySelector('.sortable-list');
    ol.classList.remove('grading-stale');
    const items = SortableListForm.#realItems(ol);
    let allCorrect = true;
    items.forEach((li, i) => {
      const isCorrect = this.#currentOrder[i] === this.#steps[i];
      li.classList.toggle('correct', isCorrect);
      li.classList.toggle('incorrect', !isCorrect);
      allCorrect &&= isCorrect;
    });
    if (allCorrect) {
      this.#toggleBonusReveal(true);
      ol.ariaDisabled = this.#form.elements.checkResults.disabled = true;
      items.forEach(({style}, i) => style.setProperty('--i', i));
      ol.classList.add('all-correct');
    } else if (++this.#wrongChecks === BONUS_HINT_THRESHOLD) {
      this.#toggleBonusReveal(true);
    }
  }

  #buildItems() {
    return this.#currentOrder.map(step =>
      newEl('li', {innerHTML: this.#container.renderItemHTML(step), attrs: {'data-step': step}}));
  }

  #toggleBonusReveal(open) {
    this.#form.classList.toggle('revealed', open);
    this.#form.querySelector('details')?.toggleAttribute('open', open);
  }

  startDrag(dragItem, pageStartY) {
    this.#wrongChecks = 0;
    this.#dragSession = SortableListForm.#commitDragDOM(
      SortableListForm.#captureDragBaseline(dragItem, pageStartY));
  }

  dragMove(pageY, clientY) {
    const session = this.#dragSession;
    const deltaY = this.#getConstrainedDeltaY(pageY);
    session.clone.style.setProperty('--drag-offset', deltaY + 'px');
    if (session.baseline.autoscroll) this.#maybeAutoscroll(clientY);

    const target = this.#findTargetSibling(pageY);
    // Unchanged target — no re-mark.
    if (target === session.insertBeforeNode) return;

    this.#updateDropMarker(target);
    session.insertBeforeNode = target;
    this.#updateCloneNumber();
  }

  commitDrop() {
    const session = this.#dragSession;
    const { insertBeforeNode, baseline, clone, marker } = session;
    const { dragItem, listEl } = baseline;
    marker?.classList.remove('drop-target-before', 'drop-target-after');

    // Null on either side is end-of-list, where insertBefore(dragItem, null) appends.
    if (insertBeforeNode === dragItem.nextElementSibling) {
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
    this.#animateLayoutChange(listEl, () => {
      listEl.insertBefore(dragItem, insertBeforeNode);
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
  // BCRs, scroll, viewport, scroll-padding insets. No derivations.
  static #readDragInputs(dragItem) {
    const doc = dragItem.ownerDocument;
    const win = doc.defaultView;
    const listEl = dragItem.parentNode;
    const rootStyle = win.getComputedStyle(doc.documentElement);
    return {
      listEl,
      items: [...SortableListForm.#realItems(listEl)],
      itemRect: dragItem.getBoundingClientRect(),
      listRect: listEl.getBoundingClientRect(),
      scroll: win.scrollY,
      innerHeight: win.innerHeight,
      // The scrollport is inset from each viewport edge by its
      // scroll-padding — a sticky nav publishes scroll-padding-top, a footer
      // would publish scroll-padding-bottom. The autoscroll triggers read
      // both so they fire at the edges scrollIntoView itself lands on.
      topInset: parseFloat(rootStyle.scrollPaddingTop) || 0,
      bottomInset: parseFloat(rootStyle.scrollPaddingBottom) || 0
    };
  }

  // Hit-test midpoints in document coords. Reads each sibling's BCR and its
  // in-flight transform, subtracting the transform so a mid-FLIP pickup still
  // targets the settled slot, not the animating position.
  static #readSiblingDropMidpoints(items, dragItem, scroll) {
    const win = dragItem.ownerDocument.defaultView;
    const midpoints = [];
    for (const li of items) {
      if (li === dragItem) continue;
      const box = li.getBoundingClientRect();
      const transform = win.getComputedStyle(li).transform;
      const animOffsetY = transform === 'none'
        ? 0 : new win.DOMMatrix(transform).m42;
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
      listEl, items, itemRect, listRect, scroll, topInset, bottomInset, innerHeight
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
      ordinalValue: index + 1,
      itemHeight: itemRect.height,
      topInset,
      bottomInset,
      innerHeight,
      // Clone is clamped inside the list, so it clips only when the list
      // extends past the scrollport — above topInset or below
      // innerHeight - bottomInset — decided once; no per-frame scroll if it fits.
      autoscroll: listRect.top < topInset
        || listRect.bottom > innerHeight - bottomInset,
      minDelta: pageListTop - pageItemTop,
      maxDelta: pageListBottom - itemRect.height - pageItemTop,
      siblingDropMidpoints:
        SortableListForm.#readSiblingDropMidpoints(items, dragItem, scroll)
    });
  }

  static #commitDragDOM(baseline) {
    const {
      listEl, dragItem, ordinalValue, cloneTop
    } = baseline;

    listEl.querySelector('.sortable-list-clone')?.remove();
    const clone = listEl.insertBefore(newEl('ol', {
      className: 'sortable-list-clone',
      attrs: {start: ordinalValue, style: `top: ${cloneTop}px`},
      children: [dragItem.cloneNode(true)]
    }), dragItem);
    dragItem.classList.add('active-drag-item');
    // Drag start = user signaled intent to change the order, so prior
    // grading is stale. CSS suppresses .correct / .incorrect under the
    // OL-level class; checkResults() or reshuffle() clears it.
    listEl.classList.add('grading-stale');

    return {
      insertBeforeNode: dragItem.nextElementSibling,
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

  // Scroll when the pointer enters an itemHeight band at either edge of the
  // scrollport — edges inset from the viewport by scroll-padding
  // (`topInset`, `bottomInset`), not the raw top and bottom. The caller
  // gates on baseline.autoscroll, so this runs only for overflowing lists.
  // The insets and innerHeight are captured once; a resize cancels the drag
  // (#onResize), so they can't go stale, and clientY arrives fresh per frame.
  #maybeAutoscroll(clientY) {
    const { topInset, bottomInset, itemHeight, innerHeight } =
      this.#dragSession.baseline;
    if (clientY < topInset + itemHeight
        || clientY > innerHeight - bottomInset - itemHeight)
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
    const { clone, insertBeforeNode, baseline } = this.#dragSession;
    const { items, ordinalValue } = baseline;
    const insertBeforeOrdinal = insertBeforeNode
      ? items.indexOf(insertBeforeNode) + 1
      : items.length + 1;
    clone.start = ordinalValue < insertBeforeOrdinal
      ? insertBeforeOrdinal - 1 : insertBeforeOrdinal;
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
    clone.ownerDocument.defaultView.requestAnimationFrame(() =>
      clone.style.setProperty('--drag-offset', (currentOffset + dy) + 'px'));
  }

  // listEl may contain a transient .sortable-list-clone OL during
  // drag/settle; :scope > li excludes it.
  static #realItems(listEl) {
    return listEl.querySelectorAll(':scope > li');
  }

  // FLIP read pass: each row's post-mutation top minus its recorded old
  // top. Kept out of the animate() loop — a getBoundingClientRect() after
  // an li.animate() write forces a synchronous reflow, one per row.
  static #readDeltas(items, oldTops) {
    return Array.from(items, li =>
      oldTops.get(li.dataset.step) - li.getBoundingClientRect().top);
  }

  // FLIP: record each row's top, run the DOM change, then animate every
  // row from its old top to its new one. customOrigins overrides a row's
  // recorded start — the drag clone's release point feeds in there so a
  // dropped row eases from the pointer instead of its dim DOM slot.
  // Invariant: every post-mutation row's data-step is in oldTops —
  // reshuffle keeps the step set; a drop persists the nodes and
  // customOrigins covers the dragged row's release point.
  #animateLayoutChange(container, mutate, customOrigins = new Map()) {
    const oldTops = new Map(Array.from(SortableListForm.#realItems(container),
      li => [li.dataset.step, li.getBoundingClientRect().top]));
    customOrigins.forEach((top, step) => oldTops.set(step, top));

    mutate();

    const items = SortableListForm.#realItems(container);
    const deltas = SortableListForm.#readDeltas(items, oldTops);
    deltas.forEach((delta, i) => {
      if (delta) items[i].animate(
        [{transform: `translateY(${delta}px)`}, {transform: 'translateY(0)'}],
        {duration: this.#container.flipDuration, easing: 'ease-out'});
    });
  }
}
