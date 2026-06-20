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
   * ancestor of every place a release can retarget to. #cleanup aborts the
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
    doc.addEventListener('pointerup', this.#endDrag, {capture: true, signal});
    doc.addEventListener('pointercancel', this.#onPointerCancel, {capture: true, signal});
    doc.addEventListener('keydown', this.#onKeyDown, {capture: true, signal});

    // Resize stales the frozen baseline; blur or a hidden tab can swallow the
    // pointerup. All abort.
    win.addEventListener('resize', this.#cleanup, {signal});
    win.addEventListener('blur', this.#cleanup, {signal});
    doc.addEventListener('visibilitychange',
      () => doc.hidden && this.#cleanup(), {signal});
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
  #endDrag = e => {
    if (e.pointerId !== this.#activePointerId) return;
    this.#activeForm.dragDrop();
    this.#cleanup();
  };

  // pointercancel is an involuntary abort (palm rejection, app switch, system modal), not
  // the user letting go. Revert.
  #onPointerCancel = e =>
    e.pointerId === this.#activePointerId && this.#cleanup();

  #onKeyDown = e =>
    e.key === 'Escape' && this.#cleanup();

  #cleanup = () => {
    if (!this.#activeForm) return;
    this.#activeForm.dragCancel();
    this.#dragListeners.abort();
    this.#el.ownerDocument.documentElement.classList.remove('list-drag-active');
    this.#activeForm = this.#activePointerId = this.#dragListeners = null;
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
    const steps = container.getSteps(definition);
    this.#steps = Object.freeze([...steps]);
    this.#currentOrder = toShuffled(steps);
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
      newEl('li', {
        innerHTML: this.#container.renderItemHTML(step), attrs: {'data-step': step}}));
  }

  dragStart(dragSource, grabStartPageY) {
    this.#wrongChecks = 0;
    this.#dragSession = SortableListForm.#commitDragDOM(
      SortableListForm.#captureDragBaseline(dragSource, grabStartPageY));
  }

  static #captureDragBaseline(dragSource, grabStartPageY) {
    const listEl = dragSource.parentNode;
    const listParent = listEl.parentElement;
    const items = [...listEl.children];
    const sourceRect = dragSource.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const listParentRect = listParent.getBoundingClientRect();
    const doc = dragSource.ownerDocument;
    const scrollY = doc.defaultView.scrollY;
    const scrollport = SortableListForm.#captureScrollport(doc);
    const { top, bottom } = scrollport;

    // The clone is a same-size copy of dragSource, built later in #commitDragDOM.
    // Its geometry matches the source's.
    const cloneTop        = sourceRect.top - listParentRect.top;
    const cloneHeight     = sourceRect.height;
    const firstItemRect   = items[0].getBoundingClientRect();
    const lastItemRect    = items.at(-1).getBoundingClientRect();
    const firstItemBottom = firstItemRect.bottom - listParentRect.top;
    const lastItemTop     = lastItemRect.top - listParentRect.top;

    // The clone overlaps the edge item but leaves EDGE_PEEK of it showing, so the
    // first/last drop target never hides fully under it. Both edges read relative to
    // listParent -- the clone's own frame -- so a contained first-item margin or
    // parent padding can't offset the list frame from it and eat the peek:
    //   minCloneTop -- dragged up, clone bottom EDGE_PEEK above the first item's bottom
    //   maxCloneTop -- dragged down, clone top EDGE_PEEK below the last item's top
    const minCloneTop = firstItemBottom - cloneHeight - EDGE_PEEK;
    const maxCloneTop = lastItemTop + EDGE_PEEK;

    return Object.freeze({
      listEl,
      listParent,
      dragSource,
      items,
      cloneTop,
      ordinalValue: items.indexOf(dragSource) + 1,
      cloneHeight,
      scrollport,
      // Items can't be dragged outside the list, so scrolling is only possible
      // when the list overflows the scrollport.
      isOutsideScrollport: listRect.top < top || listRect.bottom > bottom,
      dragRange: Object.freeze({
        grabStartPageY,
        minDelta: minCloneTop - cloneTop,
        maxDelta: maxCloneTop - cloneTop
      }),
      siblingDropMidpoints:
        SortableListForm.#readSiblingDropMidpoints(items, dragSource, scrollY)
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
  static #readSiblingDropMidpoints(items, dragSource, scroll) {
    const win = dragSource.ownerDocument.defaultView;
    const midpoints = [];
    for (const li of items) {
      if (li === dragSource) continue;
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
      listParent, dragSource, ordinalValue, cloneTop
    } = baseline;

    listParent.querySelector('.sortable-list-clone')?.remove();
    const clone = listParent.appendChild(newEl('ol', {
      className: 'sortable-list-clone',
      attrs: {start: ordinalValue, 'aria-hidden': 'true', style: `top: ${cloneTop}px`},
      children: [dragSource.cloneNode(true)]
    }));
    // active-drag-source dims the picked-up LI and, via CSS
    // :has(> li.active-drag-source), suppresses the now-stale grading until the
    // drop resolves: no-op/abort re-show it, a reorder clears it.
    dragSource.classList.add('active-drag-source');

    return {
      insertBeforeNode: dragSource.nextElementSibling,
      markerEl: null,
      clone,
      win: clone.ownerDocument.defaultView,
      lastClientY: null,
      autoscrollRAF: null,
      baseline
    };
  }

  dragMove(pageY, clientY) {
    const session = this.#dragSession;
    session.lastClientY = clientY; // held value the autoscroll loop re-feeds
    const deltaY = this.#getConstrainedDeltaY(pageY);
    session.clone.style.setProperty('--drag-offset', deltaY + 'px');
    this.#autoscroll(clientY);

    const siblingAtPageY = this.#findTargetSibling(
      this.#getVisibleTargetPageY(pageY, clientY));
    // Unchanged target — no re-mark.
    if (siblingAtPageY === session.insertBeforeNode) return;

    this.#updateDropMarker(siblingAtPageY);
    session.insertBeforeNode = siblingAtPageY;
    this.#updateCloneNumber();
  }

  #getConstrainedDeltaY(pageY) {
    const { grabStartPageY, minDelta, maxDelta } = this.#dragSession.baseline.dragRange;
    return Math.max(minDelta, Math.min(maxDelta, pageY - grabStartPageY));
  }

  #findTargetSibling(pageY) {
    return this.#dragSession.baseline.siblingDropMidpoints
      .find(({ midpointPageY }) => pageY <= midpointPageY)?.sibling ?? null;
  }

  #getVisibleTargetPageY(pageY, clientY) {
    const { baseline, win } = this.#dragSession;
    const { top, bottom } = baseline.scrollport;
    return clientY < top ? win.scrollY + top
            : clientY > bottom ? win.scrollY + bottom : pageY;
  }

  // scrollIntoView only nudges when the clone pokes past the scrollport, so on
  // a held pointer (no pointermove) it stalls and long lists can't reach the
  // end. While the pointer dwells at an edge, re-clock dragMove off rAF: pageY
  // advances from the fresh scroll alone, so the clone keeps climbing the list.
  #autoscroll(clientY) {
    const { clone, baseline, win } = this.#dragSession;
    if (!baseline.isOutsideScrollport) return;

    const { cloneHeight, scrollport: { top, bottom } } = baseline;
    const isAtEdge = clientY < top + cloneHeight || clientY > bottom - cloneHeight;
    if (!isAtEdge) return this.#cancelAutoscroll();

    // behavior:'instant' keeps the scroll synchronous so the change check below
    // is valid — we supply the smoothness via the per-frame rAF nudges.
    const scrolledFrom = win.scrollY;
    clone.scrollIntoView({block: 'nearest', behavior: 'instant'});

    // Keep re-clocking only while the page is still moving; when scrollIntoView
    // can't scroll further (list bottomed/topped out), stop the loop.
    win.scrollY === scrolledFrom ? this.#cancelAutoscroll() : this.#scheduleAutoscroll();
  }

  #scheduleAutoscroll() {
    const session = this.#dragSession;
    if (session.autoscrollRAF) return;            // one loop at a time
    session.autoscrollRAF = session.win.requestAnimationFrame(() => {
      session.autoscrollRAF = null;
      this.dragMove(session.lastClientY + session.win.scrollY, session.lastClientY);
    });
  }

  #cancelAutoscroll() {
    const session = this.#dragSession;
    session.autoscrollRAF = session.win.cancelAnimationFrame(session.autoscrollRAF);
  }

  #updateDropMarker(dragOverTarget) {
    const session = this.#dragSession;
    const { dragSource, listEl } = session.baseline;
    session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
    const wouldNotMove = dragOverTarget === dragSource.nextElementSibling;
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
    const { dragSource } = baseline;

    markerEl?.classList.remove('drop-target-before', 'drop-target-after');

    // No reorder when the target is already the next sibling — or both null at
    // end-of-list (insertBefore(_, null) appends). Settle home; #settleClone
    // removes active-drag-source, re-showing the still-valid grading.
    if (insertBeforeNode === dragSource.nextElementSibling)
      this.#settleClone(clone, dragSource);
    else
      this.#reorderList(baseline, insertBeforeNode, clone);
    this.#endSession();
  }

  // Cancel the autoscroll rAF before clearing the session, or a pending tick
  // fires against a null #dragSession. dragDrop nulls before #cleanup runs,
  // so this must live here, not in the container's #cleanup.
  #endSession() {
    this.#cancelAutoscroll();
    this.#dragSession = null;
  }

  #reorderList({ dragSource, listEl, items }, insertBeforeNode, clone) {
    // Order changed, so the prior grading is invalid — clear it before
    // un-dimming, else it flashes as active-drag-source is removed.
    items.forEach(li => li.classList.remove('correct', 'incorrect'));
    // Un-dim before the FLIP so the dropped LI eases at full opacity. The
    // clone's release top seeds the dragged LI's origin, so it settles from
    // the pointer instead of snapping back to its dim DOM slot.
    dragSource.classList.remove('active-drag-source');
    this.#animateLayoutChange(listEl, () => {
      listEl.insertBefore(dragSource, insertBeforeNode);
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

    // Sub-pixel dy: changing --drag-offset by < .5px wouldn't move the
    // transform enough for a transition to fire, so transitionend wouldn't
    // fire and the clone would stay in the DOM. Happens when the clone is
    // already at the drag source's slot at release: a no-op drop on its own
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
  // settle the clone back to the drag source's slot and clear the session.
  dragCancel() {
    const session = this.#dragSession;
    if (!session) return;
    session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
    this.#settleClone(session.clone, session.baseline.dragSource);
    this.#endSession();
  }

  checkResults() {
    const ol = this.#form.querySelector('.sortable-list');
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
    this.#animateLayoutChange(ol, () => ol.replaceChildren(...this.#buildItems()));
  }

  #toggleBonusReveal(open) {
    this.#form.classList.toggle('revealed', open);
    this.#form.querySelector('details')?.toggleAttribute('open', open);
  }
}
