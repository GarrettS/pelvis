import {toShuffled} from './shuffle.js';
import {newEl} from './el-create.js';
import {escapeHTML} from './escape-html.js';

const SETTLE_SPEED = 1.5;   // px per ms
const SETTLE_MIN_MS = 200;
const SETTLE_MAX_MS = 600;

const calculateSettleDuration = dy =>
  Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, Math.abs(dy) / SETTLE_SPEED));

const BONUS_HINT_THRESHOLD = 3;

const EDGE_PEEK = 10;   // px of the edge item kept visible past the clone during a drag

export class SortableListContainer {
  #el;
  getSteps;
  renderFormHTML;
  renderItemHTML;
  flipDuration;
  #activeForm = null;
  #activePointerId = null;
  #dragListeners = null;

  constructor(el, {
    definitions,
    getSteps = list => list.steps,
    renderFormHTML,
    renderItemHTML = escapeHTML,
    flipDuration = 200
  } = {}) {
    this.#el = el;
    this.getSteps = getSteps;
    this.renderFormHTML = renderFormHTML;
    this.renderItemHTML = renderItemHTML;
    this.flipDuration = flipDuration;

    el.addEventListener('submit', this.#onSubmit);
    el.addEventListener('pointerdown', this.#onPointerDown);
    el.addEventListener('touchstart', this.#onTouchStart, {passive: false});

    this.replaceForms(definitions);
  }

  get win() { return this.#el.ownerDocument.defaultView; }

  replaceForms(definitions) {
    const fragment = this.#el.ownerDocument.createDocumentFragment();
    Object.entries(definitions).forEach(([id, definition]) =>
      fragment.append(SortableListForm.getById(id, definition, this).form));
    this.#el.replaceChildren(fragment);
  }

  #onSubmit = e =>
    !e.preventDefault() && SortableListForm.getById(e.target.name)[e.submitter.name]();

  #onPointerDown = e => {
    if (!e.isPrimary || e.button !== 0 || e.ctrlKey || this.#activeForm) return;

    const dragSource = e.target.closest('.sortable-list > li');
    if (!dragSource) return;

    const ol = dragSource.parentNode;
    if (ol.ariaDisabled === 'true') return;

    this.#activeForm = SortableListForm.getById(ol.id);

    // Pressing on an LI is drag intent, never selection-initiation.
    // Selection started outside an LI can still extend through it.
    e.preventDefault();

    this.#activePointerId = e.pointerId;
    this.#activeForm.dragStart(dragSource, e.pageY);
    this.#el.ownerDocument.documentElement.classList.add('list-drag-active');
    this.#startTracking();
  };

  /*
   * The per-drag listeners bind to document (and window) under one
   * AbortController, keyed on pointerId. A button-held mouse and a touch are both
   * implicitly captured by the platform, so the pointer stream keeps reaching
   * document wherever it goes -- off the <li>, past the viewport edge, off-window.
   * The move and release listeners sit on document because it's the common
   * ancestor of every place a release can retarget to. #stopTracking aborts the
   * controller to drop the whole set at once.
   *
   * (No setPointerCapture: it wouldn't change where events land, and would add the
   * lostpointercapture-before-pointerup race -- crbug.com/524131116. Off-window
   * delivery without it: manual-tests/no-capture-offwindow.html.)
   */
  #startTracking() {
    const {signal} = this.#dragListeners = new AbortController();
    const doc = this.#el.ownerDocument;
    const win = doc.defaultView;
    doc.addEventListener('pointermove', this.#onPointerMove, {signal});

    // Capture phase, so a descendant stopPropagation can't ghost the drag.
    doc.addEventListener('pointerup', this.#onPointerUp, {capture: true, signal});
    doc.addEventListener('pointercancel', this.#onPointerCancel, {capture: true, signal});
    doc.addEventListener('keydown', this.#onKeyDown, {capture: true, signal});

    // Resize stales the frozen baseline; blur or a hidden tab can swallow the
    // pointerup. All abort.
    win.addEventListener('resize', this.#abortDrag, {signal});
    win.addEventListener('blur', this.#abortDrag, {signal});
    doc.addEventListener('visibilitychange',
      () => doc.hidden && this.#abortDrag(), {signal});
  }

  // iOS WebKit's text-selection initiation is driven by touchstart's
  // default behavior. preventDefault on touchstart (passive: false) cancels
  // it. pointerdown.preventDefault doesn't — it only suppresses emulated
  // mouse events at tap end.
  #onTouchStart = e => e.target.closest('.sortable-list > li') && e.preventDefault();

  #onPointerMove = e =>
    this.#activeForm && e.pointerId === this.#activePointerId
      && this.#activeForm.dragMove(e.pageY, e.clientY);

  // pointerup means the user let go — commit the drop.
  #onPointerUp = e => {
    if (e.pointerId !== this.#activePointerId) return;

    this.#activeForm.dragDrop();
    this.#stopTracking();
  };

  #stopTracking() {
    this.#dragListeners.abort();
    this.#el.ownerDocument.documentElement.classList.remove('list-drag-active');
    this.#activeForm = this.#activePointerId = this.#dragListeners = null;
  }
  
  // pointercancel is an involuntary abort (palm rejection, app switch, system modal), not
  // the user letting go. Revert.
  #onPointerCancel = e =>
    e.pointerId === this.#activePointerId && this.#abortDrag();

  #onKeyDown = e => e.key === 'Escape' && this.#abortDrag();

  #abortDrag = () => (this.#activeForm.dragCancel(), this.#stopTracking());
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
      'SortableListForm: no definition for "' + id + '"');
    return new SortableListForm(id, definition, container, SortableListForm.#KEY);
  }

  #formEl;
  #dropbarEl;
  #steps;
  #currentOrder;
  #container;
  #dragSession = null;
  #autoscroll = null;
  #wrongChecks = 0;

  constructor(id, definition, container, key) {
    if (key !== SortableListForm.#KEY) throw new Error(
      'SortableListForm: use SortableListForm.getById()');
    const steps = container.getSteps(definition);
    this.#steps = Object.freeze([...steps]);
    this.#currentOrder = toShuffled(steps);
    this.#container = container;
    this.#formEl = newEl('form', {
      className: 'card',
      attrs: {name: id},
      innerHTML: container.renderFormHTML(definition)
    });
    const ol = this.#formEl.querySelector('.sortable-list');
    ol.id = id;
    ol.append(...this.#buildItems());
    // One drop bar per list, built with the form and reused: a drag shows and positions
    // it, the drop hides it. It's generic, so unlike the clone it never rebuilds per drag.
    this.#dropbarEl = ol.parentElement.appendChild(newEl('div', {
      className: 'sortable-list-dropbar', attrs: {'aria-hidden': 'true'}}));
  }

  get form() { return this.#formEl; }

  #buildItems() {
    return this.#currentOrder.map(step =>
      newEl('li', {
        innerHTML: this.#container.renderItemHTML(step), attrs: {'data-step': step}}));
  }

  dragStart(dragSource, grabStartY) {
    const baseline = SortableListForm.#captureDragBaseline(dragSource, grabStartY);
    const session = SortableListForm.#commitDragDOM(baseline);
    this.#dragSession = session;
    // Park the bar at the source's resting slot -- the gap just after it -- so the first
    // reveal glides from the source's own edge, not from a stale spot a slot away.
    this.#dropbarEl.style.setProperty('--dropbar-position',
      session.currentSlot.dropbarTop + 'px');
    this.#autoscroll = this.#createAutoscroll(baseline);
  }

  static #captureDragBaseline(dragSource, grabStartY) {
    const listEl = dragSource.parentNode;
    const listParent = listEl.parentElement;
    const items = [...listEl.children];
    const sourceRect = dragSource.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const listParentRect = listParent.getBoundingClientRect();
    const doc = dragSource.ownerDocument;
    const win = doc.defaultView;
    const scrollport = SortableListForm.#captureScrollport(doc);

    // The clone is a same-size copy of dragSource, built later in #commitDragDOM,
    // so its geometry matches the source's. cloneTop reads relative to listParent
    // -- the clone's containing block -- so its CSS top lands it over the source.
    const cloneTop = sourceRect.top - listParentRect.top;

    return Object.freeze({
      listEl,
      listParent,
      dragSource,
      items,
      cloneTop,
      // Dragged item's page-Y edges at grab, for the autoscroll's clone-visibility check.
      sourceItemY: sourceRect.top + win.scrollY,
      sourceItemYBottom: sourceRect.bottom + win.scrollY,
      ordinalValue: items.indexOf(dragSource) + 1,
      scrollport,
      dragRange: Object.freeze({
        grabStartY,
        ...SortableListForm.#getDragRange(sourceRect, listRect, items)
      }),
      slots: SortableListForm.#measureSlots(
        items, dragSource, listRect.top, listRect.height)
    });
  }

  // The drag range clamps how far --drag-offset carries the clone from its
  // pickup spot. minDelta and maxDelta are travel distances, so the shared
  // listParentRect.top cancels in the subtraction -- viewport rects suffice.
  //
  // EDGE_PEEK lets the clone escape list edge only when the clone is tall
  // enough to cover the edge item. A shorter clone reaches the list edge, where
  // the taller edge item still shows past it -- so the bound that lets the clone
  // travel furthest toward the edge wins.
  static #getDragRange(sourceRect, listRect, items) {
    const cloneHeight         = sourceRect.height;
    const firstItemViewBottom = items[0].getBoundingClientRect().bottom;
    const lastItemViewTop     = items.at(-1).getBoundingClientRect().top;

    const clonePeekViewTop     = firstItemViewBottom - cloneHeight - EDGE_PEEK;
    const clonePeekViewBottom  = lastItemViewTop + EDGE_PEEK;
    const cloneFlushViewTop    = listRect.top;
    const cloneFlushViewBottom = listRect.bottom - cloneHeight;
    const minCloneViewTop = Math.min(clonePeekViewTop, cloneFlushViewTop);
    const maxCloneViewTop = Math.max(clonePeekViewBottom, cloneFlushViewBottom);
    return {
      minDelta: minCloneViewTop - sourceRect.top,
      maxDelta: maxCloneViewTop - sourceRect.top
    };
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

  // Measure each item into a drop slot, plus a trailing end-of-list null slot. Subtract
  // in-flight transform from the BCR top so a mid-FLIP pickup lands on the resting slot.
  // midpointY (page coords) hit-tests the pointer; dropbarTop (list frame) places the
  // bar.
  static #measureSlots(items, dragSource, listViewTop, listHeight) {
    const win = dragSource.ownerDocument.defaultView;
    const scroll = win.scrollY;
    const afterSource = dragSource.nextElementSibling;
    const isDropTarget = item => item !== dragSource && item !== afterSource;
    const slots = new Array(items.length + 1);
    items.forEach((li, index) => {
      const box = li.getBoundingClientRect();
      const transform = win.getComputedStyle(li).transform;
      const animOffsetTop = transform === 'none' ? 0 : new win.DOMMatrix(transform).f;
      const settledViewTop = box.top - animOffsetTop;
      slots[index] = {
        item: li,
        // midpointY is page frame for #slotInScrollport hit-test.
        midpointY: settledViewTop + box.height / 2 + scroll,
        dropbarTop: settledViewTop - listViewTop,
        ordinal: index + 1,
        isDropTarget: isDropTarget(li)
      };
    });

    slots[items.length] = {
      item: null,
      // Infinity catches any pointer past the last item, so #slotInScrollport always
      // returns a slot.
      midpointY: Infinity,
      dropbarTop: listHeight,
      ordinal: items.length + 1,
      isDropTarget: isDropTarget(null)
    };
    return slots;
  }

  static #commitDragDOM(baseline) {
    const { listParent, dragSource, ordinalValue, cloneTop } = baseline;

    listParent.querySelector('.sortable-list-clone')?.remove();
    const clone = listParent.appendChild(newEl('ol', {
      className: 'sortable-list-clone',
      attrs: {start: ordinalValue, 'aria-hidden': 'true', style: `top: ${cloneTop}px`},
      children: [dragSource.cloneNode(true)]
    }));
    // active-drag-source dims the picked-up LI; the :has(> li.active-drag-source) rule
    // uses it to suppress the now-stale grading until the drop resolves -- a no-op or
    // abort re-shows that grading, a reorder clears it.
    dragSource.classList.add('active-drag-source');

    return {
      // Reassigned in dragMove as the pointer crosses slot midpoints.
      currentSlot: baseline.slots[ordinalValue],
      clone,
      baseline
    };
  }

  dragMove(pageY, clientY) {
    this.#autoscroll.update(clientY, this.#applyDragPosition(pageY, clientY));
  }

  // Shared by dragMove (pointer events) and the autoscroll loop.
  #applyDragPosition(pageY, clientY) {
    const deltaY = this.#getConstrainedDeltaY(pageY);
    this.#dragSession.clone.style.setProperty('--drag-offset', deltaY + 'px');
    this.#updateInsertionPoint(clientY);
    return deltaY;
  }

  // Resolve the slot under the pointer; on a change, move the dropbar to the new
  // insertion point and renumber the clone.
  #updateInsertionPoint(clientY) {
    const foundSlot = this.#slotInScrollport(clientY);
    if (foundSlot === this.#dragSession.currentSlot) return;
    this.#dragSession.currentSlot = foundSlot;
    this.#updateDropbar();
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(pageY) {
    const { grabStartY, minDelta, maxDelta } = this.#dragSession.baseline.dragRange;
    return Math.max(minDelta, Math.min(maxDelta, pageY - grabStartY));
  }

  // The slot under the pointer, clamped to the visible band so a pointer outside the
  // scrollport resolves to the topmost/bottommost slot instead of one hidden.
  #slotInScrollport(clientY) {
    const { baseline } = this.#dragSession;
    const { top, bottom } = baseline.scrollport;
    const pageY = Math.max(top, Math.min(bottom, clientY)) + this.#container.win.scrollY;
    return baseline.slots.find(({ midpointY }) => pageY <= midpointY);
  }

  static #AUTOSCROLL = Object.freeze({
    pointerEdgeZone: 48,   // px band at each scrollport edge that drives autoscroll
    maxStep: 16            // px/frame scroll cap, at full ramp
  });

  // A held pointer fires no pointermove, so the page can't scroll itself. While the
  // pointer is in an edge band, autoscrollFrame scrolls and repositions the clone
  // until it is in view at its travel limit, or the page hits its scroll end.
  #createAutoscroll({scrollport, dragRange, sourceItemY, sourceItemYBottom}) {
    const win = this.#container.win;
    const {pointerEdgeZone, maxStep} = SortableListForm.#AUTOSCROLL;
    const scrollByOptions = {top: 0, behavior: 'instant'};
    let heldClientY;
    let lastDeltaY;
    let step;   // px/frame; derived from heldClientY, so it changes only in update
    let frameId;

    const cancelAutoscroll = () => frameId = win.cancelAnimationFrame(frameId);

    // pointerEdgeZone capped at half the scrollport, so a short scrollport
    // splits into two touching bands instead of overlapping ones.
    const bandHeight =
      Math.min(pointerEdgeZone, (scrollport.bottom - scrollport.top) / 2);
    const topBandBottom = scrollport.top + bandHeight;
    const bottomBandTop = scrollport.bottom - bandHeight;
    // The pointer's depth into a band as 0..1; past the scrollport edge stays 1.
    const ramp = depth => Math.min(depth / bandHeight, 1);

    // px/frame for the held pointer: zero outside the bands, ramping to
    // maxStep at the scrollport edge. Negative scrolls up.
    const edgeScrollStep = () => {
      if (heldClientY < topBandBottom)
        return -maxStep * ramp(topBandBottom - heldClientY);

      if (heldClientY > bottomBandTop)
        return maxStep * ramp(heldClientY - bottomBandTop);

      return 0;
    };

    const shouldScroll = () => {
      if (step === 0) return false;

      // Scroll while the clone's leading edge is past the scrollport edge, until the
      // drag cannot travel toward the list end. cloneClientY is that leading edge, in
      // viewport coords.
      const cloneClientY =
        (step > 0 ? sourceItemYBottom : sourceItemY) + lastDeltaY - win.scrollY;
      return step > 0
        ? cloneClientY > scrollport.bottom || lastDeltaY < dragRange.maxDelta
        : cloneClientY < scrollport.top || lastDeltaY > dragRange.minDelta;
    };

    const autoscrollFrame = () => {
      if (!shouldScroll()) return cancelAutoscroll();

      const scrolledFrom = win.scrollY;
      scrollByOptions.top = step;
      win.scrollBy(scrollByOptions);
      // Page out of room: the scroll moved nothing, so more frames can't either.
      if (win.scrollY === scrolledFrom) return cancelAutoscroll();

      lastDeltaY = this.#applyDragPosition(heldClientY + win.scrollY, heldClientY);
      frameId = win.requestAnimationFrame(autoscrollFrame);
    };

    return {
      // Record first -- the loop steers by these, and step derives from
      // heldClientY, so a move is the only thing that changes it. Then arm
      // when scrolling is due; only the loop stops itself.
      update: (clientY, deltaY) => {
        heldClientY = clientY;
        lastDeltaY = deltaY;
        step = edgeScrollStep();
        if (shouldScroll())
          frameId ??= win.requestAnimationFrame(autoscrollFrame);
      },
      cancel: cancelAutoscroll
    };
  }

  // dropbar-gliding turns on here, so moves glide. Pickup leaves it off, so the bar
  // starts on the grab without sliding.
  #updateDropbar() {
    const { currentSlot } = this.#dragSession;
    this.#dropbarEl.style.setProperty('--dropbar-opacity', +currentSlot.isDropTarget);
    this.#dropbarEl.classList.add('dropbar-gliding');
    this.#dropbarEl.style.setProperty('--dropbar-position', currentSlot.dropbarTop + 'px');
  }

  // The clone's number is the ordinal the item will land on. Moving down, the item vacates
  // a slot above the target, so the rest shift up one and it lands one before the slot's
  // ordinal; moving up, it lands at it.
  #updateCloneNumber() {
    const { clone, currentSlot, baseline: { ordinalValue } } = this.#dragSession;
    clone.start =
      ordinalValue < currentSlot.ordinal ? currentSlot.ordinal - 1 : currentSlot.ordinal;
  }

  dragDrop() {
    const { currentSlot, baseline, clone } = this.#dragSession;

    // A drop target reorders; the slots bracketing the source are no-ops, so settle home.
    // #settleClone removes active-drag-source, re-showing the grading (still correct,
    // since nothing moved).
    if (currentSlot.isDropTarget)
      this.#reorderList(baseline, currentSlot.item, clone);
    else
      this.#settleClone(clone, baseline.dragSource);
    this.#endSession();
  }

  #endSession() {
    this.#dropbarEl.classList.remove('dropbar-gliding');
    this.#dropbarEl.style.setProperty('--dropbar-opacity', '0');
    this.#autoscroll.cancel();
    this.#autoscroll = null;
    this.#dragSession = null;
  }

  #reorderList({ dragSource, listEl, items }, nextItem, clone) {
    // The reorder makes the correct/incorrect classes stale, and stale
    // classes must be removed, not hidden: hidden grading resurfaced on no-op
    // drops and back-navigation (two shipped bugs);
    // e2e/causal-chain-grading-lifecycle.mjs guards both. They come off ahead
    // of active-drag-source, whose removal re-enables grading colors.
    items.forEach(li => li.classList.remove('correct', 'incorrect'));
    dragSource.classList.remove('active-drag-source');

    this.#animateLayoutChange(listEl, () => {
      listEl.insertBefore(dragSource, nextItem);
      this.#currentOrder = Array.from(listEl.children, li => li.dataset.step);
    }, clone.firstElementChild);
    dragSource.classList.add('dropped');
    dragSource.addEventListener('animationend',
      () => dragSource.classList.remove('dropped'), {once: true});
    clone.remove();
  }

  // FLIP: record each LI's top, run the DOM change, then animate every LI
  // from its old top to its new one. The drag clone's LI overrides, so it eases
  // from the pointer instead of the LI's dim DOM slot.
  #animateLayoutChange(listEl, mutate, cloneLI) {
    // Phase 1: reads (before mutation)
    const startingTops = new Map();
    for (const li of listEl.children) {
      startingTops.set(li.dataset.step, li.getBoundingClientRect().top);
    }
    if (cloneLI)
      startingTops.set(cloneLI.dataset.step, cloneLI.getBoundingClientRect().top);

    // Phase 2: mutation
    mutate();

    // Phase 3: reads (after mutation)
    const settledItems = [...listEl.children];
    const deltas = Array.from(settledItems, li =>
      startingTops.get(li.dataset.step) - li.getBoundingClientRect().top);

    // Phase 4: writes (per-item animation)
    deltas.forEach((dy, i) => dy && settledItems[i].animate(
      [{transform: `translateY(${dy}px)`}, {transform: 'translateY(0)'}],
      {duration: this.#container.flipDuration, easing: 'ease-out'}));
  }

  // Glide the clone back to the drag source's slot, then remove it on
  // transitionend. Runs only for a no-op drop (released in place) or
  // Esc/cancel — a real reorder animates through #animateLayoutChange and
  // skips this.
  #settleClone(clone, dragSource) {
    dragSource.classList.remove('active-drag-source');

    const dy = dragSource.getBoundingClientRect().top - clone.getBoundingClientRect().top;

    // Already at the source's slot (a no-op drop on its own slot, or Escape over it):
    // nothing to animate, so remove it now.
    if (Math.abs(dy) < 0.5) {
      clone.remove();
      return;
    }

    const currentOffset = parseFloat(clone.style.getPropertyValue('--drag-offset')) || 0;

    // Animate the clone home with the Web Animations API: an explicit one-shot from the
    // dropped offset to the source's slot, removed on finish. No transition class and no
    // rAF to dodge style-batching -- it runs start-to-end on its own. fill: forwards
    // holds it at home until removal so it can't snap back for a frame.
    const settle = clone.animate(
      [{transform: `translateY(${currentOffset}px)`},
       {transform: `translateY(${currentOffset + dy}px)`}],
      {duration: calculateSettleDuration(dy), easing: 'ease-out', fill: 'forwards'});
    settle.addEventListener('finish', () => clone.remove(), {once: true});
  }

  // Abort path: Esc or pointercancel. runs only when the drag is cancelled —
  // settle the clone back to the drag source's slot and clear the session.
  dragCancel() {
    const session = this.#dragSession;
    this.#settleClone(session.clone, session.baseline.dragSource);
    this.#endSession();
  }

  checkResults() {
    const ol = this.#formEl.querySelector('.sortable-list');
    const items = [...ol.children];
    let allCorrect = true;
    items.forEach((li, i) => {
      const isCorrect = this.#currentOrder[i] === this.#steps[i];
      li.classList.toggle('correct', isCorrect);
      li.classList.toggle('incorrect', !isCorrect);
      allCorrect &&= isCorrect;
    });
    if (allCorrect) {
      this.#toggleBonusReveal(true);
      ol.ariaDisabled = this.#formEl.elements.checkResults.disabled = true;
      items.forEach(({style}, i) => style.setProperty('--i', i));
      ol.classList.add('all-correct');
    } else if (++this.#wrongChecks === BONUS_HINT_THRESHOLD) {
      this.#toggleBonusReveal(true);
    }
  }

  reshuffle() {
    this.#currentOrder = toShuffled(this.#steps);
    this.#wrongChecks = 0;
    const ol = this.#formEl.querySelector('.sortable-list');
    ol.classList.remove('all-correct');
    ol.ariaDisabled = false;
    this.#formEl.elements.checkResults.disabled = false;
    this.#toggleBonusReveal(false);
    this.#animateLayoutChange(ol, () => ol.replaceChildren(...this.#buildItems()));
  }

  #toggleBonusReveal(open) {
    this.#formEl.classList.toggle('revealed', open);
    this.#formEl.querySelector('details')?.toggleAttribute('open', open);
  }
}
