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
    !e.preventDefault() && SortableListForm.getById(e.target.name)[e.submitter.name]();

  #onPointerdown = e => {
    if (!e.isPrimary || e.button !== 0 || e.ctrlKey || this.#activeForm) return;

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
    this.#activeForm.dragStart(dragItem, e.pageY);
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
      && (this.#activeForm.dragDrop(), this.#cleanup());

  #onPointercancel = e =>
    this.#activeForm && e.pointerId === this.#activePointerId && this.#cleanup();

  #onKeydown = e =>
    this.#activeForm && e.key === 'Escape' && this.#cleanup();

  // Orientation or window resize relays out the page, staling the frozen
  // baseline (BCRs, clamps, midpoints). Abort like Escape; #settleClone
  // reads live positions, so the clone still glides to the item's slot.
  #onResize = () => this.#activeForm && this.#cleanup();

  #cleanup = () => {
    this.#activeForm.dragCancel();
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

  #buildItems() {
    return this.#currentOrder.map(step =>
      newEl('li', {innerHTML: this.#container.renderItemHTML(step), attrs: {'data-step': step}}));
  }

  dragStart(dragItem, pageStartY) {
    this.#wrongChecks = 0;
    this.#dragSession = SortableListForm.#commitDragDOM(
      SortableListForm.#captureDragBaseline(dragItem, pageStartY));
  }

  static #captureDragBaseline(dragItem, pageStartY) {
    const listEl = dragItem.parentNode;
    const items = [...SortableListForm.#realItems(listEl)];
    const itemRect = dragItem.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const doc = dragItem.ownerDocument;
    const scroll = doc.defaultView.scrollY;
    const scrollport = SortableListForm.#captureScrollport(doc);
    const { top, bottom } = scrollport;

    // BCRs are viewport-relative; + scroll lands them in document coords so the
    // drag range matches the document-space pointer delta.
    const pageItemTop = itemRect.top + scroll;
    const pageListTop = listRect.top + scroll;
    const pageListBottom = listRect.bottom + scroll;

    return Object.freeze({
      listEl,
      dragItem,
      items,
      cloneTop: Math.round(itemRect.top - listRect.top),
      ordinalValue: items.indexOf(dragItem) + 1,
      itemHeight: itemRect.height,
      scrollport,
      // Items can't be dragged outside the list, so scrolling is only possible
      // when the list overflows the scrollport.
      isOutsideScrollport: listRect.top < top || listRect.bottom > bottom,
      dragRange: Object.freeze({
        pageStartY,
        minDelta: pageListTop - pageItemTop,
        maxDelta: pageListBottom - itemRect.height - pageItemTop
      }),
      siblingDropMidpoints:
        SortableListForm.#readSiblingDropMidpoints(items, dragItem, scroll)
    });
  }

  // Read once at drag start so the per-frame autoscroll check never re-measures
  // layout.
  static #captureScrollport(doc) {
    const win = doc.defaultView;
    const rootStyle = win.getComputedStyle(doc.documentElement);
    return Object.freeze({
      top: parseFloat(rootStyle.scrollPaddingTop) || 0,
      bottom: win.innerHeight - (parseFloat(rootStyle.scrollPaddingBottom) || 0)
    });
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
        midpointPageY: box.top - animOffsetY + box.height / 2 + scroll
      });
    }
    return midpoints;
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
    // active-drag-item dims the picked-up LI and, via CSS
    // :has(> li.active-drag-item), suppresses the now-stale grading until the
    // drop resolves: no-op/abort re-show it, a reorder clears it.
    dragItem.classList.add('active-drag-item');

    return {
      insertBeforeNode: dragItem.nextElementSibling,
      markerEl: null,
      clone,
      baseline
    };
  }

  dragMove(pageY, clientY) {
    const session = this.#dragSession;
    const deltaY = this.#getConstrainedDeltaY(pageY);
    session.clone.style.setProperty('--drag-offset', deltaY + 'px');
    this.#autoscroll(clientY);

    const siblingAtPageY = this.#findTargetSibling(pageY);
    // Unchanged target — no re-mark.
    if (siblingAtPageY === session.insertBeforeNode) return;

    this.#updateDropMarker(siblingAtPageY);
    session.insertBeforeNode = siblingAtPageY;
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(pageY) {
    const { pageStartY, minDelta, maxDelta } = this.#dragSession.baseline.dragRange;
    return Math.max(minDelta, Math.min(maxDelta, pageY - pageStartY));
  }

  #findTargetSibling(pageY) {
    return this.#dragSession.baseline.siblingDropMidpoints
      .find(({ midpointPageY }) => pageY <= midpointPageY)?.sibling ?? null;
  }

  #autoscroll(clientY) {
    const { clone, baseline } = this.#dragSession;
    if (!baseline.isOutsideScrollport) return;
    const { itemHeight, scrollport: { top, bottom } } = baseline;
    if (clientY < top + itemHeight || clientY > bottom - itemHeight)
      clone.scrollIntoView({block: 'nearest'});
  }

  #updateDropMarker(dragOverTarget) {
    const session = this.#dragSession;
    const { dragItem, listEl } = session.baseline;
    session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
    const wouldNotMove = dragOverTarget === dragItem.nextElementSibling;
    session.markerEl = wouldNotMove ? null : (dragOverTarget ?? listEl.lastElementChild);
    session.markerEl?.classList.add(
      dragOverTarget ? 'drop-target-before' : 'drop-target-after'
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

  dragDrop() {
    const session = this.#dragSession;
    const { insertBeforeNode, baseline, clone, markerEl } = session;
    const { dragItem } = baseline;
    markerEl?.classList.remove('drop-target-before', 'drop-target-after');

    // No reorder when the target is already the next sibling — or both null at
    // end-of-list (insertBefore(_, null) appends). Settle home; #settleClone
    // removes active-drag-item, re-showing the still-valid grading.
    if (insertBeforeNode === dragItem.nextElementSibling)
      this.#settleClone(clone, dragItem);
    else
      this.#reorderList(baseline, insertBeforeNode, clone);

    this.#dragSession = null;
  }

  #reorderList({ dragItem, listEl, items }, insertBeforeNode, clone) {
    // Order changed, so the prior grading is invalid — clear it before
    // un-dimming, else it flashes as active-drag-item is removed.
    items.forEach(li => li.classList.remove('correct', 'incorrect'));
    // Un-dim before the FLIP so the dropped LI eases at full opacity. The
    // clone's release top seeds the dragged LI's origin, so it settles from
    // the pointer instead of snapping back to its dim DOM slot.
    dragItem.classList.remove('active-drag-item');
    this.#animateLayoutChange(listEl, () => {
      listEl.insertBefore(dragItem, insertBeforeNode);
      this.#currentOrder = Array.from(
        SortableListForm.#realItems(listEl), li => li.dataset.step);
    }, clone.firstElementChild);
    dragItem.classList.add('dropped');
    dragItem.addEventListener('animationend',
      () => dragItem.classList.remove('dropped'), {once: true});
    clone.remove();
  }

  // FLIP: record each LI's top, run the DOM change, then animate every LI
  // from its old top to its new one. The drag clone's LI overrides, so it eases
  // from the pointer instead of the LI's dim DOM slot.
  #animateLayoutChange(container, mutate, cloneLI) {
    // Phase 1: reads (before mutation)
    const startingTops = new Map();
    for (const li of SortableListForm.#realItems(container)) {
      startingTops.set(li.dataset.step, li.getBoundingClientRect().top);
    }
    if (cloneLI)
      startingTops.set(cloneLI.dataset.step, cloneLI.getBoundingClientRect().top);

    // Phase 2: mutation
    mutate();

    // Phase 3: reads (after mutation)
    const settledItems = SortableListForm.#realItems(container);
    const deltas = Array.from(settledItems, li =>
      startingTops.get(li.dataset.step) - li.getBoundingClientRect().top);

    // Phase 4: writes (per-item animation)
    deltas.forEach((dy, i) => dy && settledItems[i].animate(
      [{transform: `translateY(${dy}px)`}, {transform: 'translateY(0)'}],
      {duration: this.#container.flipDuration, easing: 'ease-out'}));
  }

  // Glide the clone back to the item's slot, then remove it on
  // transitionend. Runs only for a no-op drop (released in place) or
  // Esc/cancel — a real reorder animates through #animateLayoutChange and
  // skips this.
  #settleClone(clone, item) {
    item.classList.remove('active-drag-item');

    const dy = item.getBoundingClientRect().top - clone.getBoundingClientRect().top;

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

  // Abort path: Esc or pointercancel. runs only when the drag is cancelled —
  // settle the clone back to the item's slot and clear the session.
  dragCancel() {
    const session = this.#dragSession;
    if (!session) return;
    session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
    this.#settleClone(session.clone, session.baseline.dragItem);
    this.#dragSession = null;
  }

  checkResults() {
    const ol = this.#form.querySelector('.sortable-list');
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

  reshuffle() {
    this.#currentOrder = toShuffled(this.#steps);
    this.#wrongChecks = 0;
    const ol = this.#form.querySelector('.sortable-list');
    ol.classList.remove('all-correct');
    ol.ariaDisabled = false;
    this.#form.elements.checkResults.disabled = false;
    this.#toggleBonusReveal(false);
    this.#animateLayoutChange(ol,
      () => ol.replaceChildren(...this.#buildItems()));
  }

  #toggleBonusReveal(open) {
    this.#form.classList.toggle('revealed', open);
    this.#form.querySelector('details')?.toggleAttribute('open', open);
  }

  // listEl may contain a transient .sortable-list-clone OL during
  // drag/settle; :scope > li excludes it.
  static #realItems(listEl) {
    return listEl.querySelectorAll(':scope > li');
  }
}
