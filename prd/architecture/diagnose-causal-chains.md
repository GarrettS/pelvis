# Diagnose Causal Chains

The user reorders a chain's steps from a scrambled order into the correct sequence, then Check Order grades it. Reshuffle restarts the game with a new random order.

Each chain renders as a numbered list inside its own form: title, a "start → end" summary, the steps in their current order, and the Check Order / Reshuffle buttons. Pressing a step picks it up — the original dims in place, a floating copy of the item tracks the pointer, a colored bar previews where the drop would land, and the copy's badge updates live. On release, a reorder animates the whole list into its new arrangement while the dropped item cools from the lifted look down to a resting item; a release back into the same slot — or an Escape/cancel — glides the floating copy home instead. Check Order colors each item correct or incorrect, and an all-correct chain plays a staggered pulse from top to bottom.

## Goals and Constraints

- `pointermove` drag with no layout thrashing.
- Unbreakable: spamming Reshuffle, or dragging-and-dropping in quick succession, can't corrupt the order or strand a half-finished animation.
- Accurate drop targeting while the page scrolls, and autoscroll that triggers below a sticky nav, not at the viewport top.
- Pointer and touch, including messy multi-touch input.
- Grading that survives a re-drag without showing colors for an order the user has since changed.

## The Shared Key

The Shared Key is the architectural backbone of this module. It lets delegated event handlers find the owning chain instance from the DOM — no separate registries, no selector walks.

The chain id starts as the JSON key:

```json
{
  "diaphragm-to-adt": { "title": "...", "steps": [ ... ] }
}
```

— each first `getById(id, …)` call stamps that `id` onto the constructed `form`'s `name` and the `ol`'s `id` —

```html
<form name="diaphragm-to-adt">
  <ol id="diaphragm-to-adt"></ol>
</form>
```

— so submit and drag handlers can recover the chain instance with `getById` from the form's `name` or the OL's `id`. The id is the factory's `#instances` registry key, `form.name`, and `ol.id`.

The factory returns the instance. Its form getter exposes the `form` *element*, detached at this point.

`initSortableLists` does two one-shot jobs:

- **Builds the form instances.** Each [chain definition](#sortablelistform) runs through `getById(id, definition, container)` once, which constructs the form, stamps the id onto its DOM, and caches it. From then on, every other `getById` call — submit handlers, pointer handlers — passes only an id and pulls the cached instance back out.
- **Wires the delegated listener set on the wrapper.** Constructing `SortableListContainer` attaches one listener per pointer/touch event (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, plus `touchstart` with `passive: false` for iOS WebKit selection prevention), one `submit` listener for action dispatch, and one document-level `keydown` for Escape.

The cache write is idempotent (`??=` skips already-keyed entries), but the listener wiring is not: a second `initSortableLists` invocation would re-attach the whole set and double-fire every event. The `init` name signals that constraint — call once at boot.

```js
function initSortableLists(chainDefinitions) {
  chainsWrap.classList.add('entering');
  chainsWrap.addEventListener('animationend', clearChainEntering);
  new SortableListContainer(chainsWrap, {
    renderFormHTML: renderChainForm,
    renderItemHTML: expandAbbr,
    flipDuration: parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--dur-normal'))
  }).replaceForms(chainDefinitions);
}
```

That shared key obviates `data-chain-id`, selector walks, array searches, and translation maps.

### Submit Dispatch
Submit dispatch uses two keys: `e.target.name`: `SortableListForm.getById(e.target.name)` finds the instance, and `e.submitter.name`, its activated button's `name`, is the method called on it.

```js
#onSubmit = e =>
  !e.preventDefault() && SortableListForm.getById(e.target.name)[e.submitter.name]();
```

So `<button name="checkResults">` calls `form.checkResults()` and `<button name="reshuffle">` calls `form.reshuffle()` — the button `name` *is* the method name. Nothing whitelists the call; the only constraint is `renderFormHTML`, which emits just those two buttons, so those are the only names that reach the lookup.

### Item Identity Contract

Each sortable `<li>` carries its step text in `data-step`; the chain stores the correct sequence in `#steps` (set at construction, before the shuffle). Full contract: [Item Identity](#item-identity-step-text-as-the-key).

## SortableListContainer

`SortableListContainer` constructs each [`SortableListForm`](#sortablelistform) and appends its `<form>` to the element passed to its constructor:

```js
constructor(el, {renderFormHTML, renderItemHTML = escapeHTML, flipDuration = 200} = {}) 
```

SortableListContainer also handles the lists' events with delegated listeners on that same element, resolving the owning form by the [Shared Key](#the-shared-key).

## SortableListForm
Class `SortableListForm` manages the state and DOM subtree for one keyed sortable list inside a form.

### Factory-Gated Construction

The `SortableListForm.getById` symbol-gated factory encapsulates instantiation and caching.

```js
static getById(id, definition, container) {
  return SortableListForm.#instances[id] ??=
    SortableListForm.#create(id, definition, container);
}
```

This method runs the constructor, which builds the detached `<form>` and its OL inline using the supplied `renderFormHTML`. Subsequent calls bypass construction and return the cached instance by `id`. The factory is called by `SortableListContainer`, which accepts a list of definitions for the instances.

#### `definition`

The `definition` argument is the per-chain data object from the JSON file's value side.

```json
{
  "diaphragm-to-adt": {
    "title": "...",
    "start": "...",
    "end": "...",
    "steps": ["...", "..."],
    "infoBonus": { "summary": "...", "points": ["...", "..."] }
  }
}
```

The `SortableListForm` constructor reads `definition.steps` (as `#steps`), stores a shuffled copy as `#currentOrder`, then builds the detached `<form>`. Each step is added to a corresponding LI as `data-step`, the [Item Identity](#item-identity-step-text-as-the-key) key.

The `title`, `start`, `end`, and `infoBonus` exist because `renderChainForm` in `diagnose-causal-chains.js` reads them. From `SortableListForm`'s perspective the contract is opaque: it hands the whole object to `renderFormHTML` and stores the HTML the renderer returns.

`SortableListForm` constructor's third argument is the owning `SortableListContainer` instance. The `SortableListForm` instance holds it as `#container` and reads container-owned values through it: `renderFormHTML`, `renderItemHTML`, and `flipDuration`. The two classes are tightly coupled — same module, referencing each other by name. Container options:

| Option | Type | Default | Purpose |
|---|---|---|---|
| `renderFormHTML` | `(definition) => string` (required) | — | Form's innerHTML; receives the definition |
| `renderItemHTML` | `(step) => string` | `escapeHTML` | Each item's innerHTML; default escapes step text |
| `flipDuration` | `number` (ms) | `200` | FLIP layout-change duration; the consumer (`diagnose-causal-chains.js`) reads `--dur-normal` from the app's design tokens and passes the resolved number, so `sortable-list-form.js` doesn't reference any app-specific name |

### The Button-Name Contract
Function [`renderFormHTML`](#sortablelistform) must emit submit buttons whose `name` values match the public `SortableListForm` methods (see [submit dispatch](#submit-dispatch)).

### The Public Interface
External method access is grouped by consumer:

| **Consumer** | **Calls / Reads** | **Architectural Purpose**                                                          |
|---|---|---|
| `SortableListContainer.replaceForms` | `.form` getter | Sets the built `<form>` elements as the wrapper's children with `replaceChildren`. |
| Container submit handler | `reshuffle()`, `checkResults()` | Activated submit button's `name` mapped to same-named method.                      |
| Container pointer handlers | dragStart()`, `dragMove()`, `commitDrop()`, `dragEnd()` | Calls the active form's drag methods from the delegated pointer events.            |

### DOM Architecture

Each instance builds its HTML subtree at construction, stamping the constructor's `id` argument onto `form.name` and `ol.id` for [Shared Key](#the-shared-key) lookups. The id is not stored on the instance — `form.name` and `ol.id` are its DOM-side storage; the registry key is its lookup-side storage.

|**Component Element**|**Attributes**| **Architectural Purpose**                                                                                                                  |
|---|---|---|
|**Component Root** `<form>`|`name="[id]"`| Binds the subtree to a specific chain identity. The global submit handler uses `e.target.name` to look up the cached instance immediately. |
|**Sortable List** `<ol>`|None| Semantic `<ol>` (screen readers announce position). Serves as the DOM container for pointer tracking and FLIP layout calculations.         |
|**Sequence Steps** `<li>`|`data-step="[step-id]"`| Identifies the step. The attribute acts as the lookup key for FLIP animations and grading.                                                 |
|**Submit Buttons** `<button>`|`name="reshuffle"`, `name="checkResults"`| Trigger form submission natively. Form's onsubmit dispatches to private method of same name.                                               |
|**Bonus Disclosure** `<details>`|None| Native disclosure widget handles open/close.                                                                                               |

## Single-Pointer Dragging

The container's `#onPointerdown` rejects secondary touches before any state changes — multitouch input could otherwise start a second drag mid-first-drag and corrupt the session:
```js
#onPointerdown = e => {
  if (!e.isPrimary || e.button !== 0 || this.#activeForm) return;
  // ...
  this.#activeForm = SortableListForm.getById(ol.id);
  this.#activePointerId = e.pointerId;
  dragItem.setPointerCapture(e.pointerId);
  // ...
};
```

Two instance fields lock the session to a single pointer for its entire lifetime:

- `#activeForm` — the form being dragged. Non-null means a drag is in flight; further `pointerdown`s bail at the guard above.
- `#activePointerId` — locks the session to the initiating pointer. Every subsequent `pointermove`, `pointerup`, and `pointercancel` re-verifies before doing anything:

```js
this.#activeForm && e.pointerId === this.#activePointerId && /* act */
```

`setPointerCapture(e.pointerId)` keeps the event stream targeted at the dragged LI even when the pointer leaves the viewport — without it, the browser would re-target events to whatever is under the pointer.

The release path (`pointerup`, `pointercancel`, `Escape` keydown, and a window `resize`) all funnel through `#cleanup`:

```js
#cleanup = () => {
  this.#activeForm.endDrag();
  this.#el.ownerDocument.documentElement.classList.remove('list-drag-active');
  this.#activeForm = this.#activePointerId = null;
};
```

The class drop lets text-selection resume —

```css
html.list-drag-active,
html.list-drag-active * {
  cursor: grabbing;
  user-select: none;
}
```

— and the browser implicitly releases pointer capture when the captured element loses its capture-eligible state (drag ended, capture released by GC of the session).

## The Read/Write Split: Dragging Without Layout Thrashing
Any DOM drag-and-drop must address layout thrashing. Interleaving layout reads (`getBoundingClientRect`) with layout-invalidating writes (style updates, DOM mutations) forces the browser layout engine to recompute layout repeatedly, a CPU intensive operation that hogs memory and can noticeably impact dragging experience.

Splitting the dragging into *phases* with a strict *read/write* boundary reduces layout recalculation to once per drag, not repeating at 120hz, per `pointermove` callback. Each *phase* is represented by one or more functions:

**Capture Phase** (`#captureDragBaseline`) — reads pre-calculates measurements pre-drag and returns a frozen baseline. The capture helpers are private and static, because the calculation is internal to the class but doesn't touch instance state.

- `#captureScrollport(dragItem)` — autoscroll needs this to keep element within the scrollport, inset from the viewport by scroll-padding (a sticky nav covers the top).

- `#readSiblingDropMidpoints(items, dragItem, scroll)` — single pass over the items (skipping the dragItem), reading each sibling's BCR and in-flight transform, computing its page-coord drop midpoint. Read and compute live together because the output *is* the midpoints. The transform read is what makes a mid-FLIP drag-start safe: a sibling caught animating into place renders at its BCR top, but the user is mentally aiming at its settled position. `new DOMMatrix(getComputedStyle(li).transform).m42` extracts the Y-translation cell (row 4 column 2 of the 4×4 transform matrix); subtracting it from `box.top` cancels the in-flight FLIP offset, so the midpoint reflects where the sibling will be once the animation finishes. Without that subtraction, picking up an item during a Reshuffle would resolve drop targets against animating positions and land the wrong way.

`#captureDragBaseline` composes both reads, then derives the rest off the snapshot — clamp boundaries (`minDelta`/`maxDelta`), the dragged item's ordinal, the initial drop target, the `isOutsideScrollport` flag — and freezes the result. Even N=200 finishes in 1–2 ms, inside the ~100 ms window for an instant-feeling press.

**Commit Phase** (`#commitDragDOM`) — pure writes. Removes any stale clone OL, inserts a fresh one, marks the dragged LI, assembles `#dragSession`. Runs once, immediately after capture.

**Move Phase** (`dragMove`) — reads the cached baseline plus `pageY`/`clientY` from the event, runs a clamp and an `Array.find` over the frozen midpoints, writes `--drag-offset`, toggles marker classes, and calls `#autoscroll` (see [Autoscroll](#autoscroll-and-the-scroll-padding-contract)).

The phase split is bounded by separate functions. Each phase is its own function, so a stray `getBoundingClientRect` inside `#commitDragDOM` or `dragMove` reads as out of place at a glance. `#autoscroll` is the one deliberate exception: it forces layout (`scrollIntoView`) mid-move, but only when both hold — (1) capture already flagged the list as possibly needing to scroll (`baseline.isOutsideScrollport`), and (2) the pointer reaches a trigger band at the scrollport edge.
## The Drag Session

Before dragging, we determine drag measurements so `dragMove` reads precomputed values instead of re-measuring layout each frame.

static #captureDragBaseline(dragItem, pageStartY) captures the object below; the table explains each field.

```js
{
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
}
```

**What the baseline holds:**

| Field                                                | What it is                                                   | Covered in                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `listEl`                                             | the chain's `.sortable-list` OL                              | [animateLayoutChange](#the-reorder-animation) — FLIP container, drop insertion |
| `dragItem`                                           | the picked-up LI                                             | dimmed in place, re-inserted at the drop                     |
| `items`                                              | every LI at capture, clone-excluded                          | [Target Resolution Collections](#target-resolution-collections) |
| `cloneTop`                                           | the clone's pinned `top`                                     | [Pinning the Clone Origin](#pinning-the-clone-origin)        |
| `ordinalValue`                                       | dragged item's 1-based position, written to the clone `<ol start>` | [Clone Number Rebinding](#clone-number-rebinding--1-offset)  |
| `itemHeight`                                         | the dragged item's height                                    | autoscroll band depth & `maxDelta` — [Autoscroll](#autoscroll-and-the-scroll-padding-contract) |
| `scrollport` ( `top`, `bottom` )                     | the scrollport's visible top / bottom edges (viewport coords) | [Autoscroll](#autoscroll-and-the-scroll-padding-contract)    |
| `isOutsideScrollport`                                | whether the list overflows the scrollport                    | [Autoscroll](#autoscroll-and-the-scroll-padding-contract)    |
| `dragRange` ( `pageStartY`, `minDelta`, `maxDelta` ) | drag origin and how far it may travel up / down (document coords) | the clamp — [Why the Drag Works in pageY](#why-the-drag-works-in-pagey) |
| `siblingDropMidpoints`                               | every other item's document-coord drop midpoint              | [Target Resolution Collections](#target-resolution-collections) |

The `#dragSession` property, initialized at `dragStart`, holds state read during `dragMove`, cleared on `commitDrop` or `dragEnd`. None of this is publicly exposed; all of it private; internally managed.

```js
#dragSession = {
  // Volatile — updated during dragMove:
  insertBeforeNode, // where the item would drop (an LI, or null = append)
  marker,           // the LI showing the drop indicator
  clone,            // the floating <ol> that follows the pointer
  // Immutable — captured once at dragStart:
  baseline          // the snapshot dragMove reads each frame
};
```

**The volatile Element fields, updated each `dragMove`:**

| Field              | What it is                                                   | Covered in                                                   |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `insertBeforeNode` | the LI the dragged item would land before (`null` = append at end) | the move loop                                                |
| `marker`           | the LI currently showing the drop indicator; kept so each move clears the previous mark | [The Marker and Badge Invariants](#the-marker-and-badge-invariants) |
| `clone`            | the floating `<ol>` copy that tracks the pointer             | [Pinning the Clone Origin](#pinning-the-clone-origin)        |

`insertBeforeNode` is the live insert-before reference — the LI the dragged item would land before, or `null` to append at the end. It's held as the node, not an index: `insertBefore` takes the node directly, with no lookup, and an index would have to be read against `listEl.children`, which includes the clone `<ol>` and would be skewed by it.

## Target Resolution Collections

The baseline holds two separate LI collections because they serve two different operations:

`items` — the full ordered list, *including* dragItem. `#updateCloneNumber` reads the prospective ordinal from it: `items.indexOf(insertBeforeNode) + 1` when `insertBeforeNode` is an item, `items.length + 1` when it's `null` (a drop past the last item). It keeps dragItem because the drag leaves it on screen, dimmed in place — so its slot still counts and the ordinals match what the user sees.

`items` is captured once, not read live: once `#commitDragDOM` inserts the clone, a live child read would count it. The clone is an `<ol start="N">` — its single `<li>` renders the [badge number](#clone-number-rebinding--1-offset) — dropped straight into `listEl`, so an `<ol>` sits inside an `<ol>`. That's non-conforming, but content models are a parser rule, not a DOM-API one: `insertBefore` adds the node without complaint, and the layout engine renders whatever tree it's handed. And an `<ol>` isn't an `<li>`, so `:scope > li` and the ordinal counter pass it over for free, keeping `#realItems` clone-free.

`siblingDropMidpoints` — dragItem-excluded, each record carrying its `sibling` LI and the precomputed `pageMidpointY` (document-coord midpoint, with in-flight transform subtracted). Used for hit-testing in `#findTargetSibling`. Filtering dragItem out at capture means the 120 Hz `Array.find` never wastes a comparison on the dragged item's own footprint.

Two collections, two purposes — duplication that earns its keep.

## Autoscroll and the Scroll-Padding Contract

The user must be able to drag the item to any slot he wants. For any chain taller than the viewable area (*scrollport*), that slot might be clipped. For any such chain, when the drag nears an edge, the page can be scrolled via `clone.scrollIntoView({block: 'nearest'})` to keep the dragged clone visible.

But `scrollIntoView` forces the browser to perform an unscheduled synchronous layout reflow, and calling it on **pointermove** costs CPU, impacting performance. To mitigate this, this path is double-gated:

**At drag start** — `baseline.isOutsideScrollport`: does the list overflow the scrollport at all?

```js
static #captureDragBaseline (dragItem, pageStartY) {
// ...
return {
  // Items can't be dragged outside the list, so scrolling is only possible
  // when the list overflows the scrollport — computed once, not per frame.
  isOutsideScrollport: listRect.top < top || listRect.bottom > bottom,
...
```

**Per frame** — `#autoscroll`: is the pointer within an item-height of an edge?

```js
#autoscroll(clientY) {
  const { clone, baseline } = this.#dragSession;
  if (!baseline.isOutsideScrollport) return;
  const { itemHeight, scrollport: { top, bottom } } = baseline;
  if (clientY < top + itemHeight || clientY > bottom - itemHeight)
    clone.scrollIntoView({block: 'nearest'});
}
```

### The `isOutsideScrollport` Boolean

In gate 1, we determine if the list is partially obscured, then it doesn't fit. If either its top or bottom is obscured, scrolling the container in that direction, either up or down, can obscure the other half of it. Consider the following user interaction:

1. User initiates drag with the bottom list item obscured.
2. `isOutsideScrollport` is captured as true.
3. User drags the item to the bottom of the list
4. clone.scrollIntoView({block: 'nearest'}) can then scroll downward.
5. Downward autoscroll moves the list upward, obscuring its top.
6. User continues dragging, moving the pointer towards the first item, now obscured.
7. `#autoscroll` is called again
8. clone.scrollIntoView({block: 'nearest'}) can then scroll upward.

### Caching innerHeight and Cancel-on-Resize

Accessing `getComputedStyle(doc.documentElement)` and in some cases `window.innerHeight` forces the browser to calculate layout impacting performance, particularly on `pointermove`. To mitigate that performance hit, we pre-calculate and save the `scrollport` area in `dragStart`. 

```js
// Read once at drag start so the per-frame autoscroll check never re-measure
// layout.
static #captureScrollport(doc) {
  const win = doc.defaultView;
  const rootStyle = win.getComputedStyle(doc.documentElement);
  return Object.freeze({
    top: parseFloat(rootStyle.scrollPaddingTop) || 0,
    bottom: win.innerHeight - (parseFloat(rootStyle.scrollPaddingBottom) || 0)
  });
}
```

#### Resize Invalidation

This raises the question: what if the user resizes the window during drag? Given that it's potentially possible with multi-touch or orientation change, we cancel dragging by running a cleanup routine if there is any `#activeForm`.

```js
  // Orientation or window resize relays out the page, staling the frozen
  // baseline (BCRs, clamps, midpoints). Abort like Escape; #settleClone
  // reads live positions, so the clone still glides to the item's slot.
  #onResize = () => this.#activeForm && this.#cleanup();
```

### Setting the Scrollport

The visible region's top is not the viewport top — a sticky nav covers it. That inset is the scroller's `scroll-padding-top`, which `navigation-tabs` publishes on every route change:

```js
function updateScrollInset() {
  document.documentElement.style.scrollPaddingTop =
    document.querySelector('nav').getBoundingClientRect().bottom + 'px';
}
```

```
navigation-tabs.js                  :root                       SortableListForm
updateScrollInset() ──sets──▶  scroll-padding-top  ──reads──▶  #captureScrollport
(owns the nav)                   (the contract)                (knows its ownerDocument)
```

The widget reads its scroller's `scroll-padding-top`, never the nav, so it stays decoupled from the layout — and the same value makes the scroll engine land `scrollIntoView` *below* the nav instead of behind it, for free. The nav publishes per route because the subtab row makes it taller on subtabbed routes; a measure taken once on a route without subtabs would be too short.

The gates skip per-frame calculations and the relayout for lists that fit within the scrollport, keeping the hot path fast and lean, while still covering the uncommon but plausible case — a list that overflows the scrollport, the item dragged toward the overflowing edge, as on a small or mobile window.

### Why the Drag Works in pageY

Because autoscroll scrolls the page in the middle of a drag, every position must be stored in document coordinates (`event.pageY`), not viewport coordinates (`event.clientY`) — otherwise the scroll would invalidate them. The item's clamp to its list and its drop-target midpoints are fixed at pickup; `autoscroll` then scrolls the window past them, but their positions in the document — their `pageY` — don't change with it. This avoids a few problems:

1. **Stale thresholds.** `scrollIntoView` can scroll the page mid-drag for an overflowing chain. Cached *viewport* positions would invalidate the instant scroll fired. Cached *document* positions don't: LIs don't move in the document when the page scrolls.

2. **Compositor-thread tearing.** `PointerEvent.clientY` is captured at event creation. `window.scrollY` is a separate read at handler-invocation time. With async scrolling on the compositor thread, those two values can drift across the gap, producing a misaligned coordinate and visible clone jitter. `e.pageY` is computed by the browser engine inside the event with scroll state from the same instant — race-free by construction. The capture-time `+ scroll` for BCRs is fine because all the BCRs and the scroll read sit in one layout pass, internally consistent.

## Ending the Drag

### Cancellation

Cancellation, either by Escape key or window resize, is handled by `dragEnd`.

```js
// Abort path: Esc or pointercancel. runs only when the drag is cancelled —
// settle the clone back to the item's slot and clear the session.
dragEnd() {
  const session = this.#dragSession;
  if (!session) return;
  session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
  this.#settleClone(session.clone, session.baseline.dragItem);
  this.#dragSession = null;
}
```

### Dropping

Drop resolution in `commitDrop`  ends one of three ways:

- **Reorder.** `commitDrop` runs `#animateLayoutChange`  displaced items FLIP into place; the dragged item eases from the clone's release point), tags the dragged item `.dropped` to cool it down, then removes the clone immediately. `#settleClone` is *not* part of a reorder.
- **No-op** — released back into its own slot. Detected with `insertBeforeNode == dragItem.nextElementSibling`: the item would land before the LI it already sits before, so nothing moves. At end-of-list both sides are `null` — no hit-test target, no next sibling — the same no-op. `#settleClone` removes `.active-drag-item`, re-showing unchanged grading, and glides the clone home.
- **Abort** — Escape, `pointercancel`, or resize. `commitDrop` never runs; `dragEnd` settles the clone back to the item's slot, removes `.active-drag-item`, and re-shows unchanged grading.

A cool-down is applied after the drop, using is a `from`-only keyframe: the dropped item briefly wears the clone's lifted look, then CSS eases it down to the resting item.

```css
@keyframes item-drop-cool {
  from {
    background: var(--accent-bg);
    border-left-color: var(--accent);
    box-shadow: var(--box-shadow-lg);
  }
}
```

A `from`-only block declares the start and animates to the element's own resting style, so the keyframe never restates the resting values. The dropped item also carries a `z-index` so it cools *above* the displaced sibling sliding past it (after `insertBefore`, an upward move leaves that sibling later in DOM order, so without the lift it would paint on top).

**Sub-pixel deadlock.** `#settleClone` (the no-op and abort paths) transitions the clone from its release position to the item's slot; a `transitionend` listener removes it. Duration scales with distance (~1.5 px/ms, clamped 200–600 ms).

```js
if (Math.abs(dy) < 0.5) {
  clone.remove();
  return;
}
```

If `dy` is near zero (a no-op drop on the item's own slot, or Escape with the clone directly over the slot), changing `--drag-offset` wouldn't move the transform enough for a transition to fire, so `transitionend` would never arrive and the clone would strand in the DOM. The guard removes it synchronously in that case.

**Deferring the offset write.** Once the listener is attached, the offset change is scheduled in the next `requestAnimationFrame`:

```js
clone.classList.add('settling');
clone.addEventListener('transitionend', () => clone.remove(), {once: true});
requestAnimationFrame(() => clone.style.setProperty('--drag-offset', ...));
```

The class add enables the transition; the property write triggers it. If both land in the same style update, the browser collapses them — no transitionable before-state, and the clone snaps home instead of gliding. The rAF separates them.

Finally, set the `#activeForm` to null and perform a few other cleanup activities.

```js
#cleanup = () => {
  this.#activeForm.dragEnd();
  this.#el.ownerDocument.documentElement.classList.remove('list-drag-active');
  this.#activeForm = this.#activePointerId = null;
};
```

### CSS Transform Handoff

```css
.sortable-list-clone {
  transform: translateY(var(--drag-offset, 0px));
}
.sortable-list-clone.settling {
  transition: transform var(--dur-slow) ease-out;
}
```

Drag motion writes `--drag-offset`, not `transform`. CSS owns the property name and the transition declaration; JS only writes a number per frame, then adds `.settling` to enable the transition at settle time. The static `top` and the dynamic offset stay in separate authoring channels — JS never recomposes a `transform` string per frame, and JS never coordinates which property the transition targets.

## The Drop Marker

### Marker Suppression (`wouldNotMove`), Showing, and Removal

The drop marker — the colored bar previewing where the dragged item would land — is a `::before` pseudo-element on the receiving LI, painted via `drop-target-before` / `drop-target-after` class toggles.

If the pointer hovers over a position that resolves to the dragged item's current slot, releasing is a no-op. The marker is suppressed. That's identifiable by two characteristics:

1. The dragOverTarget is `dragItem`'s `nextElementSibling` — no change: `insertBefore(dragItem, dragItem.nextElementSibling)`
2. `dragOverTarget` is `null` *and* the `dragItem` is the `lastElementChild` (so its `nextElementSibling` is `null`).

Case 2 is case 1 with both sides null, so:

```js
const wouldNotMove = dragOverTarget === dragItem.nextElementSibling;
```

— covers both scenarios. 

Otherwise, the element can move, so we determine from that:

1. which sibling LI, if any, to apply either `'drop-target-before'` or `'drop-target-after'` class —

    ```js
    #updateDropMarker(dragOverTarget) {
      const session = this.#dragSession;
      const { dragItem, listEl } = session.baseline;
      session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
      const wouldNotMove = dragOverTarget === dragItem.nextElementSibling;
      session.markerEl = wouldNotMove ? null : (dragOverTarget ?? listEl.lastElementChild);
      session.markerEl?.classList.add(dragOverTarget ? 'drop-target-before' : 'drop-target-after');
    }
    ```

    — which applies the following CSS —

    ```css
    .sortable-list > li:is(.drop-target-before, .drop-target-after)::before {
      content: '';
      position: absolute;
      left: -.5rem;
      right: 0;
      height: var(--marker-bar-thickness);
      background: var(--accent);
      border-radius: 9999px;
      pointer-events: none;
    }
    ```

    — and —

2. Store `session.markerEl` so the **next** pointermove event can remove the marker classes from the marker element it marked *last* time, so it can clear that bar before drawing the new one.

    ```js
    session.markerEl?.classList.remove('drop-target-before', 'drop-target-after');
    ```


### Positioning the Drag Clone

The clone wrapper is `position: absolute`. Without an explicit `top`, its static position is its hypothetical in-flow position — which moves when `commitDrop` rearranges siblings. A drag-up commit places the dragged LI before the clone in DOM order, shifting the clone's static anchor down by roughly one item, and the clone visibly teleports before the settle starts.

Capture pins `top` explicitly via inline style:

```js
cloneTop: Math.round(itemRect.top - listRect.top)
```

The transform offset drives the live motion; `top` stays fixed. Rounding `cloneTop` once at capture keeps text rendering stable across the settle — the *fixed* component of the effective y is always an integer pixel, so anti-aliasing doesn't shift as the transform animates back to zero.

### Clone Number Rebinding (`-1` offset)

The floating clone's `start` attribute updates on every drop-target change so the badge matches the prospective ordinal:

```js
clone.start = ordinalValue < insertBeforeOrdinal ? insertBeforeOrdinal - 1 : insertBeforeOrdinal;
```

`insertBeforeOrdinal` is `insertBeforeNode`'s 1-based position. Moving *down*, the dragged LI sits *above* it, so vacating that slot pulls it up one and the LI lands at `insertBeforeOrdinal - 1`. Moving *up*, the dragged LI sits *below* it, leaving that position untouched, so the LI lands at `insertBeforeOrdinal` — the node and the LIs it passes shift *down* to open the slot.

Without the conditional, the badge would flicker by one as the pointer crossed each item boundary.

## The Reorder Animation

### Reshuffle
`SortableListForm` instances persist for the page lifetime. `reshuffle()` re-randomizes `#currentOrder`, clears grading state, and replaces the OL's children with rebuilt LIs inside `#animateLayoutChange`. The form and OL nodes persist — reshuffle does not go through `initSortableLists`, so `chainsWrap.entering` isn't re-added and `list-enter` doesn't replay.

Rebuilding from `#buildItems()` (rather than resetting and reordering existing LIs) resets the list to its initial state, reordered. Reset+reorder would save the allocation but force `#buildItems` and the reset step to stay in sync — a brittleness cost not worth saving allocations on a handful of items.

Dropping to a new position and reshuffle both trigger list reorder. Animating this reordering provides user feedback for a much smoother-feeling user-experience.

This reordering animation is done in phases to prevent thrashing:
1. record each LI's current top
2. mutate (replaceChildren on reorder)
3. record each LI's ending top position - this forces post-mutation layout reflow and recalc
4. animate from the starting positions to the ending positions calculated in step 3.
```js
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
```
Per-item animation is by each LIs pre-determined `dy`. When `dy === 0`, `&&` short-circuits and `animate()` isn't called. This works because these keyframes animate transform only. 
### Calculating `startingTops`
The `startingTops` Map stores item keys and the current positions:
  - **key** — li.dataset.step, the step text (the Item Identity (#item-identity-step-text-as-the-key) key)
  - **value** — li.getBoundingClientRect().top, that item's top edge in viewport pixels, captured _before_ mutate()

Printed out, it would look something like:—
```js
  Map {
    "Diaphragm descends"        => 412.5,
    "ZOA established"           => 444.5,
    "Abdominals engage"         => 476.5,
    "Pelvic floor counter-rotates" => 508.5
  }
```
### Running Mutate
Reshuffle's `mutate` is `replaceChildren(...#buildItems())` — fresh LIs in the new order ([why it rebuilds](#reshuffle)). A drop's is an `insertBefore` — the same nodes, moved. Either way the FLIP matches old top to new by `data-step` ([Item Identity](#item-identity-step-text-as-the-key)).

### Read, Then Write
`li.animate()` is a write that dirties the render tree, and a `getBoundingClientRect()` right after can't return an accurate rect until the browser reconciles it — so it stops and reflows, then and there. A single read-then-write loop makes every read pay for the previous write: they fight, once per item. Two passes let all the reads share one reflow and the writes pile up behind it  (see [The Read/Write Split](#the-readwrite-split-dragging-without-layout-thrashing)).

Chromium's own counters, interleaved against batched at N=2000 ([`e2e/flip-read-write-split.mjs`](../../e2e/flip-read-write-split.mjs)):

|             | RecalcStyleCount | LayoutCount | time    |
| ----------- | ---------------- | ----------- | ------- |
| interleaved | +2000            | +2000       | 2405 ms |
| batched     | +2               | +1          | 25 ms   |

One forced style-and-layout reflow per item against one for the whole list — O(N²) versus O(N), because each interleaved read re-lays-out all N. A chain has a handful of steps, so the split saves microseconds, not frames. But the discipline holds — reads before writes — and these numbers are why the rule holds. To watch it live, [`flip-read-write-split.html`](../../e2e/flip-read-write-split.html) runs the same comparison by wall-clock in any browser — open it locally or paste it into a CSS/JS playground.

**Interrupting an In-Flight Reorder**
Measuring live on every call prevents a later action from measuring against positions a previous slide has already moved. Reshuffle and a reordering drop avoid it differently:

**Reshuffle** discards the old nodes and any animations still running on them. `startingTops` was read just before the mutation, so it holds each outgoing node's current *visual* top — `getBoundingClientRect()` includes the in-flight transform — and a reshuffle landing mid-slide restarts from there.

**Reordering drop** does not replace elements. It can't because it needs to add the `.dropped` class to the dropped LI for its cool-down effect. To address this, it removes the LIs' correct/incorrect`className` (clears grading), removes `active-drag-item` from the dragged LI, re-inserts the dragged LI, and adds the `.dropped` class to the dropped LI for its cool-down effect.

### Item Identity: Step Text as the Key
List items have their own smaller identity, `data-step` per-chain unique step text that comes from a JSON key.

```text
definition.steps[] / #currentOrder[]
          │
          ▼
      <li data-step>
          │
          ├── #animateLayoutChange startingTops key
          ├── drop commit rebuilds #currentOrder
          └── checkResults compares against #steps
```

That lets Reshuffle rebuild the LIs with `replaceChildren` and still animate. The new LIs are new elements that carry the same `data-step`. Function `#animateLayoutChange` records old positions by `li.dataset.step`, runs the mutation, then looks up each new item's old top by the same key.

The FLIP stays in the Web Animations API rather than CSS because its start frame is a *measured* per-element delta, which is inherently computed in JS. (The completion pulse, which needs no per-element measurement, went the other way — see [Completion Cascade](#completion-cascade).)

## Grading Display Lifecycle
Function `checkResults()` applies `.correct` / `.incorrect` classes per LI. Those classes
exist only while they describe the current order.

When a drag starts, `#commitDragDOM` adds `.active-drag-item` to the picked-up
LI. This lets us temporarily hide any grading on dragStart.
### Hiding Grading on Drag Start
```css
.sortable-list:has(> li.active-drag-item) > li:is(.correct, .incorrect) {
  border-left-color: var(--border);
  background: var(--panel-bg-sunken);
}
```

When the user drops the LI (its clone), `li.active-drag-item` is removed. If the user dropped the clone on the originating LI, `#settleClone` removes active-drag-item and glides the clone home. But if the user dropped it on a new drop target, we need to clean all the LIs and apply `dropped` to the LI that was dropped. Each drag exit then resolves grading from whether the order changed:

- **No-op drop or abort** — `#settleClone` removes `.active-drag-item`. The
  unchanged grading classes become visible again.
- **Reordering drop** — `commitDrop` removes every `.correct` / `.incorrect`
  class before removing `.active-drag-item`, so invalid grading cannot flash or
  reappear later.
- **`checkResults`** — applies fresh grading for the current order.
- **`reshuffle`** — replaces the LIs with ungraded items.

All-correct disables the Check button, sets `aria-disabled` on the OL (which blocks subsequent `pointerdown`), and plays a [completion cascade](#completion-cascade) through the LIs. Reshuffle alone can re-arm Check — drag-start can't, because the OL lock makes `pointerdown` bail.

The info-bonus `<details>` reveals on the same grading path: on all-correct, or once a chain has been checked wrong `BONUS_HINT_THRESHOLD` times *since the last drag or reshuffle* (`dragStart` and `reshuffle` both reset `#wrongChecks`), `#toggleBonusReveal(true)` opens it — a hint appears when the user is stuck or has finished, not before.

## Completion Cascade
When `checkResults` grades all-correct, the items play a brief staggered pulse, top-to-bottom, to mark the win.

The natural pure-CSS expression of "stagger by position" would index each item in the stylesheet. Two CSS-native indices were considered and rejected: `sibling-index()` (too thinly supported), and `counter(list-item)` (it resolves to a *string*, but `calc()` for an `animation-delay` needs a `<length>`/`<time>`). The fallback would be a Web Animations call that computes each item's delay in JS — exactly the kind of step-by-step timing math that bloats the script and pulls presentation into it.

The compromise keeps the timing declarative in CSS and pays one unavoidable JS line to hand the index across:

```js
items.forEach(({style}, i) => style.setProperty('--i', i));
```

```css
.sortable-list.all-correct > li {
  animation: all-correct-pulse var(--dur-normal) ease-out;
  animation-delay: calc(var(--i) * var(--dur-fast) / 2);
}
```

The loop is presentation logic in the script — a cross-concern cost — but it's the smallest bridge that lets the layout engine own the stagger, and it avoids hand-rolled WAAPI timing.
## Preventing Text Selection
We add a class to the root to prevent selection of any text the pointer passes over during the drag.
```css
html.list-drag-active,
html.list-drag-active * {
  cursor: grabbing;
  user-select: none;
}
```

But to allow text selection under normal circumstances, `list-drag-active` is added only in the `pointerdown` handler:—
```js
this.#el.ownerDocument.documentElement.classList.add('list-drag-active');
```
— and remove it in `pointerup`, in `#cleanup`—
```js
this.#el.ownerDocument.documentElement.classList.remove('list-drag-active');
```
— disabling text-selection while a drag is in progress; reenabling it when done. 

This works in browsers other than WebKit on iOS. There, text selection is initiated before any javascript can intercept touch and pointer events, and once that text selection has been initiated, it is too late to prevent it by `user-select`. WebKit's native gesture recognizer exists below the JavaScript event loop, and intercepts and processes touches before the JavaScript layer so that slow scripts won't cause scroll jank.
### iOS and {passive: false}
The fix to "can't prevent text selection during drag" in WebKit is not to disable text-selection at all times, but to add one extra listener. A `touchstart` handler registered with `{passive: false}` tells the browser to wait for that listener's callback function to return its `defaultPrevented` flag, and that flag *also* prevents selection:
```js
el.addEventListener('touchstart', this.#onTouchstart, {passive: false});
// iOS WebKit's text-selection initiation is driven by touchstart's
// default behavior. preventDefault on touchstart (passive: false) cancels
// it. pointerdown.preventDefault doesn't — it only suppresses emulated
// mouse events at tap end.
#onTouchstart = e =>
  e.target.closest('.sortable-list > li') && e.preventDefault();
```
Registering the listener with `{passive: false}` tells the browser's Compositor Thread to defer native touch handling until the Main Thread finishes running that specific listener and returns its `defaultPrevented` flag.

## Page-Load Entrance

There's no prior committed layout to [FLIP](#the-reorder-animation) from at first render, so the entrance is a CSS animation, not a measured transform: a quiet opacity-and-translate on each list item (`list-enter`: opacity 0 → 1, `translateY(-6px → 0)`), gated by an `.entering` class on the wrapper.

```css
:where(#chains-wrap.entering) .sortable-list > li {
  animation: list-enter var(--dur-normal) ease-out;
}
```

The gating class lives on the wrapper, not on each OL or each item. Before the attach, `initSortableLists` adds `.entering` to `chainsWrap` and registers one `animationend` listener; because `replaceForms` attaches every form in one `replaceChildren`, every item's `list-enter` fires in the same frame, the listener catches the first bubbled `animationend` whose `animationName === 'list-enter'`, removes `.entering`, and self-unregisters. One class, one listener, one cleanup — for the whole feature.

**`:where()` is defense in depth.** The wrapper class is normally cleared synchronously, but if a user reshuffles or drops within the entrance window (~`--dur-normal`), the underlying `animationend` either gets cancelled or arrives interleaved with state-change animations. Without lowering specificity, the wrapper rule `#chains-wrap.entering .sortable-list > li` (specificity 1,2,1) would outrank `.sortable-list > li.dropped` (0,2,1) and `.sortable-list.all-correct > li` (0,2,1), and a lingering `.entering` would suppress those animations — for `.dropped`, also stranding the class on the item because its `animationend`-driven cleanup never fires. `:where(#chains-wrap.entering)` drops the entrance rule to specificity (0,1,1), below both, so a lingering `.entering` becomes harmless.

The entrance is deliberately small (the page-load liveliness is *barely noticeable*). A bigger entrance widens the window where the user could `pointerdown` on an item mid-animation, and the drag pipeline assumes settled positions; staying subtle makes that race practically impossible.

## State Classes
Much of the behavior is encoded as classes rather than methods. The toggles and what they govern:

| Class                           | On           | Set / cleared                                | Governs                                                                   |
| ------------------------------- | ------------ | -------------------------------------------- | ------------------------------------------------------------------------- |
| `html.list-drag-active`         | document     | `pointerdown` / `cleanup`                    | drag-wide `cursor` / `user-select` lock                                   |
| `entering`                      | wrapper      | `initSortableLists` / wrapper `animationend` | gates the page-load item entrance (via `:where()` for specificity safety) |
| `revealed`                      | form         | `#toggleBonusReveal`                         | shows the info-bonus `<details>`                                          |
| `all-correct`                   | OL           | `checkResults` / `reshuffle`                 | the completion cascade                                                    |
| `active-drag-item`              | dragged LI   | `#commitDragDOM` / drop or settle            | dims the original and temporarily neutralizes visible grading             |
| `drop-target-before` / `-after` | receiving LI | `#updateDropMarker`                          | the `::before` drop-position bar                                          |
| `dropped`                       | reordered LI | `commitDrop` / `animationend`                | the cool-down keyframe                                                    |
| `settling`                      | clone OL     | `#settleClone`                               | enables the clone's settle transition                                     |
