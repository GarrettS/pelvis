# Diagnose Causal Chains

The user reorders a chain's steps from a scrambled order into the correct sequence, then Check Order grades it. Reshuffle restarts the game with a new random order.

Each chain renders as a numbered list inside its own form: title, a "start → end" summary, the steps in their current order, and the Check Order / Reshuffle buttons. Pressing a step picks it up — the original dims in place, a floating copy of the item tracks the pointer, a colored bar previews where the drop would land, and the copy's badge updates live. On release, a reorder animates the whole list into its new arrangement while the dropped item cools from the lifted look down to a resting item; a release back into the same slot — or an Escape/cancel — glides the floating copy home instead. Check Order colors each item correct or incorrect, and an all-correct chain plays a staggered pulse from top to bottom.

## Goals and Constraints

The choreography above sets the bar the rest of this document clears:

- A 120 Hz `pointermove` drag with no dropped frames — no layout thrashing.
- Interruptible: spamming Reshuffle, or dragging-and-dropping in quick succession, can't corrupt the order or strand a half-finished animation.
- Correct while the page is scrolled and a sticky nav covers the top of the viewport.
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

— so submit and drag handlers can recover the chain instance with `getById` from the form's `name` or the OL's `id`. The id lives in exactly three places: the factory's `#instances` registry key, `form.name`, and `ol.id`. Instances don't carry an `id` field — handlers read the id off a DOM event and resolve it via `getById`, which is a one-hop lookup against the registry.

The factory returns the instance. Its form getter exposes the `form` *element*, detached at this point.

`initSortableLists` does two one-shot jobs:

- **Builds the form instances.** Each [chain definition](#sortablelistform) runs through `getById(id, definition, container)` once, which constructs the form, stamps the id onto its DOM, and caches it. From then on, every other `getById` call — submit handlers, pointer handlers — passes only an id and pulls the cached instance back out.
- **Wires the delegated listener set on the wrapper.** Constructing `SortableListContainer` attaches one listener per pointer/touch event (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, plus `touchstart` with `passive: false` for iOS WebKit selection prevention), one `submit` listener for action dispatch, and one document-level `keydown` for Escape. The handlers route each event to the right form by reading the id off the event target — no per-form wiring.

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

Delegated handlers inside the container find the form instance by reading the id off the DOM:

```js
SortableListForm.getById(e.target.name);

const ol = dragItem.parentNode;
activeForm = SortableListForm.getById(ol.id);
```

That shared key obviates `data-chain-id`, selector walks, array searches, and translation maps.

### Action Dispatch Keys

The one-liner consumes two keys: `form.name` finds the SortableListForm instance via the Shared Key; `e.submitter.name` finds the method by matching its instance-method name.

```js
#onSubmit = e =>
  SortableListForm.getById(e.target.name)[e.submitter.name]?.(e.preventDefault());
```

Both `checkResults` and `reshuffle` are instance methods named after their buttons.

### Item Identity Contract

Each sortable `<li>` carries its step text in `data-step`; the chain stores the correct sequence in `#steps` (set at construction, before the shuffle). Full contract: [Item Identity](#item-identity-step-text-as-the-key).

## SortableListForm

`SortableListForm` manages the state and DOM subtree for one keyed sortable list inside a form.

Construction is via `getById(id, definition, container)`. `definition` is the per-chain data object that came from the JSON file's value side. Only one field is read by the class itself:

| Field | Type | Purpose |
|---|---|---|
| `steps` | `string[]` (required) | Correct order. Frozen onto `#steps`; a shuffled copy seeds `#currentOrder`. Each value also lands on a list item as `data-step` — the [Item Identity](#item-identity-step-text-as-the-key) key. |

Every other field on `definition` passes through unchanged as the argument to the container's `renderFormHTML`. The consumer decides the rest of the shape; the class never reads it. The chain feature's full definition shape, for reference:

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

`title`, `start`, `end`, and `infoBonus` exist only because `renderChainForm` in `diagnose-causal-chains.js` reads them. From `SortableListForm`'s perspective the contract is opaque: it hands the whole object to `renderFormHTML` and stores the HTML the renderer returns.

The third argument is the owning `SortableListContainer` instance. The form holds that reference as `#container` and reads container-owned values through it: `renderFormHTML`, `renderItemHTML`, and `flipDuration`. The two classes live in the same module and reference each other by name; the back-ref makes that coupling explicit instead of threading individual properties through the form's constructor. Container options:

| Option | Type | Default | Purpose |
|---|---|---|---|
| `renderFormHTML` | `(definition) => string` (required) | — | Form's innerHTML; receives the definition |
| `renderItemHTML` | `(step) => string` | `escapeHTML` | Each item's innerHTML; default escapes step text |
| `flipDuration` | `number` (ms) | `200` | FLIP layout-change duration; the consumer (`diagnose-causal-chains.js`) reads `--dur-normal` from the app's design tokens and passes the resolved number, so `sortable-list-form.js` doesn't reference any app-specific name |

The constructor reads `definition.steps` to initialize the correct order (`#steps`) and the mutable display order (`#currentOrder`), then builds the detached `<form>` inline.

### Factory-Gated Construction

The `SortableListForm.getById` factory encapsulates instantiation and caching. A private `#KEY` symbol gates the constructor, forcing all external access through the factory. This guarantees that consumers interact agnostically with fully built subtrees, enabling zero-wiring delegation:

```js
#onSubmit = e =>
  SortableListForm.getById(e.target.name)[e.submitter.name]?.(e.preventDefault());
```

The initial factory call runs the constructor, which builds the detached `<form>` and its OL inline using the supplied `renderFormHTML`. Subsequent calls bypass construction and return the cached instance by `id`.

### Reshuffle

Each instance persists for the page lifetime. `reshuffle()` re-randomizes `#currentOrder`, clears grading state, and replaces the OL's children with rebuilt LIs inside `#animateLayoutChange`. The form and OL nodes persist — reshuffle does not go through `initSortableLists`, so `chainsWrap.entering` isn't re-added and `list-enter` doesn't replay.

Rebuilding from `#buildItems()` (rather than resetting and reordering existing LIs) resets the list to its initial state, reordered. Reset+reorder would save the allocation but force `#buildItems` and the reset step to stay in sync — a brittleness cost not worth saving allocations on a handful of items.

### Symmetrical Action Dispatch

Dispatch is button↔method symmetry. Class methods share exact names with their submit button `name` attributes (`reshuffle`, `checkResults`). One delegated submit listener on the container dispatches via `[e.submitter.name]()`, eliminating per-button event wiring. The instance manages the grade button's `disabled` state — `true` on all-correct, `false` on reshuffle — so `renderFormHTML` must emit `<button name="checkResults">` for the toggle to land.

### The Public Interface

External method access is grouped by consumer:

|**Consumer**|**Calls / Reads**|**Architectural Purpose**|
|---|---|---|
|`SortableListContainer.replaceForms`|`form`|Mounts the prebuilt form.|
|Container submit handler|`reshuffle()`, `checkResults()`|Routes form submission to the named instance method.|
|Container pointer handlers|`startDrag()`, `dragMove()`, `commitDrop()`, `endDrag()`|Drives the drag pipeline via delegated pointer events.|

### DOM Architecture

Each instance builds its HTML subtree at construction, stamping the constructor's `id` argument onto `form.name` and `ol.id` for [Shared Key](#the-shared-key) lookups. The id is not stored on the instance — `form.name` and `ol.id` are its DOM-side storage; the registry key is its lookup-side storage.

|**Component Element**|**Attributes**|**Architectural Purpose**|
|---|---|---|
|**Component Root** `<form>`|`name="[id]"`|Binds the subtree to a specific chain identity. The global submit handler uses `e.target.name` to look up the cached instance immediately.|
|**Sortable List** `<ol>`|None|Semantic `<ol>` (screen readers announce position). Serves as the DOM container for pointer tracking and FLIP layout calculations.|
|**Sequence Steps** `<li>`|`data-step="[step-id]"`|Identifies the step. The attribute acts as the lookup key for FLIP animations and grading.|
|**Submit Buttons** `<button>`|`name="reshuffle"`, `name="checkResults"`|Trigger form submission natively. The `name` attributes route actions directly to the matching class methods.|
|**Bonus Disclosure** `<details>`|None|Native disclosure widget handles open/close.|

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

`setPointerCapture(e.pointerId)` routes the event stream to the dragged LI even when the pointer leaves the viewport — without it, the browser would re-target events to whatever is under the pointer.

The release path (`pointerup`, `pointercancel`, `Escape` keydown, and a viewport `resize`) all funnel through `#cleanup`:

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

The challenge for any DOM drag-and-drop is layout thrashing. A 120 Hz `pointermove` loop that interleaves layout-querying reads (`getBoundingClientRect`) with layout-invalidating writes (style updates, DOM mutations) forces the browser to recompute layout repeatedly, dropping frames.

We partition dragging into three phases with a strict read/write boundary:

**Capture Phase** (`#captureDragBaseline`) — the read half of the split: pre-drag measurement and calculation, returning a frozen baseline. The three capture helpers are private static; `static` because the work doesn't touch instance state, `#` because the calculation is internal to the class. The reads are split into two named helpers so each function does one thing:

- `#readDragInputs(dragItem)` — batched read of the layout facts the baseline needs: the chain's OL ref, the items list, the dragItem and OL rects, `window.scrollY`, the viewport height, and the scroll-padding-top inset. No derivations.
- `#readSiblingDropMidpoints(items, dragItem, scroll)` — single pass over the items (skipping the dragItem), reading each sibling's BCR and in-flight transform, computing its page-coord drop midpoint. Read and compute live together because the output *is* the midpoints. The transform read is what makes a mid-FLIP drag-start safe: a sibling caught animating into place renders at its BCR top, but the user is mentally aiming at its settled position. `new DOMMatrix(getComputedStyle(li).transform).m42` extracts the Y-translation cell (row 4 column 2 of the 4×4 transform matrix); subtracting it from `box.top` cancels the in-flight FLIP offset, so the midpoint reflects where the sibling will be once the animation finishes. Without that subtraction, picking up an item during a Reshuffle would resolve drop targets against animating positions and land the wrong way.

`#captureDragBaseline` composes both reads, then derives the rest off the snapshot — clamp boundaries (`minDelta`/`maxDelta`), the dragged item's ordinal, the initial drop target, the `autoscroll` flag — and freezes the result. Even N=200 finishes in 1–2 ms, inside the ~100 ms window for an instant-feeling press.

**Commit Phase** (`#commitDragDOM`) — pure writes. Removes any stale clone OL, inserts a fresh one, marks the dragged LI, assembles `#dragSession`. Runs once, immediately after capture.

**Move Phase** (`dragMove`) — reads the cached baseline plus `pageY`/`clientY` from the event, runs a clamp and an `Array.find` over the frozen midpoints, writes `--drag-offset`, toggles marker classes, and calls `#maybeAutoscroll` (see [Autoscroll](#autoscroll-and-the-scroll-padding-contract)). No `getBoundingClientRect` per frame; the drop target and offset come entirely from the frozen baseline.

The split is structural, not runtime-checked. A stray BCR inside `#commitDragDOM` or `dragMove` would be obviously out of place because the file's organization makes "reads happen at capture time only" visible at a glance.

## animateLayoutChange: One Safe, Interruptible Reflow

Two runtime actions rearrange the list: Reshuffle, and a reordering drop. Doing the FLIP ad hoc at each site invites both thrashing and breakage — a second Reshuffle landing mid-animation, or a rapid re-drag, would measure against positions an unfinished animation has already moved. One private helper owns the move:

```js
#animateLayoutChange(container, mutate, customOrigins = new Map()) {
  const oldTops = new Map(Array.from(SortableListForm.#realItems(container),
    li => [li.dataset.step, li.getBoundingClientRect().top]));
  customOrigins.forEach((top, step) => oldTops.set(step, top));
  mutate();                                  // the only structural mutation — after all reads
  SortableListForm.#realItems(container).forEach(li => { /* animate old top → new top */ });
}
```

First it reads every item's current top, then runs the caller's `mutate()` — the only structural DOM mutation — then animates each item from where it was to where it landed (those animation writes come after the new-top reads).

It is interruptible because it re-reads *live* positions on entry. A spam-click or rapid re-drag recalibrates against reality instead of fighting a stale snapshot; mid-flight animations finish in the background, and the next call measures where things actually are.

### Item Identity: Step Text as the Key

List items have their own smaller identity, `data-step` the step text, which comes from a JSON key.

```
definition.steps[] / #currentOrder[]
          │
          ▼
      <li data-step>
          │
          ├── #animateLayoutChange oldTops key
          ├── drop commit rebuilds #currentOrder
          └── checkResults compares against #steps
```

That choice is what lets Reshuffle rebuild the LIs with `replaceChildren` and still animate. The new LIs are not the old DOM nodes, but they carry the same `data-step` values. `#animateLayoutChange` records old positions by `li.dataset.step`, runs the mutation, then looks up each new item's old top by the same key.

The cost is a data constraint: step strings must be unique within a chain. A duplicate step would collide in `oldTops`, make the FLIP identity ambiguous, and also corrupt the order model because drop commit rebuilds `#currentOrder` from `li.dataset.step`. The app does not add synthetic item ids because the step text is already the user's visible unit of ordering; adding another id would create a second truth to keep aligned for little gain.

`customOrigins` lets a caller override an item's recorded start — the drop feeds the clone's release point, so the dragged item eases from the pointer rather than from its dim DOM slot.

**Invariant:** every post-mutation item's `data-step` is already in `oldTops`. Reshuffle keeps the step set; a drop persists the nodes; `customOrigins` covers the dragged item's release point. The helper trusts this and doesn't guard for a missing entry; callers don't introduce new items mid-flight.

The FLIP stays in the Web Animations API rather than CSS because its start frame is a *measured* per-element delta, which is inherently computed in JS. (The completion pulse, which needs no per-element measurement, went the other way — see [Completion Cascade](#completion-cascade).)

## Page-Load Entrance

There's no prior committed layout to [FLIP](#animatelayoutchange-one-safe-interruptible-reflow) from at first render, so the entrance is a CSS animation, not a measured transform: a quiet opacity-and-translate on each list item (`list-enter`: opacity 0 → 1, `translateY(-6px → 0)`), gated by an `.entering` class on the wrapper.

```css
:where(#chains-wrap.entering) .sortable-list > li {
  animation: list-enter var(--dur-normal) ease-out;
}
```

The gating class lives on the wrapper, not on each OL or each item. Before the attach, `initSortableLists` adds `.entering` to `chainsWrap` and registers one `animationend` listener; because `replaceForms` attaches every form in one `replaceChildren`, every item's `list-enter` fires in the same frame, the listener catches the first bubbled `animationend` whose `animationName === 'list-enter'`, removes `.entering`, and self-unregisters. One class, one listener, one cleanup — for the whole feature.

**`:where()` is defense in depth.** The wrapper class is normally cleared synchronously, but if a user reshuffles or drops within the entrance window (~`--dur-normal`), the underlying `animationend` either gets cancelled or arrives interleaved with state-change animations. Without lowering specificity, the wrapper rule `#chains-wrap.entering .sortable-list > li` (specificity 1,2,1) would outrank `.sortable-list > li.dropped` (0,2,1) and `.sortable-list.all-correct > li` (0,2,1), and a lingering `.entering` would suppress those animations — for `.dropped`, also stranding the class on the item because its `animationend`-driven cleanup never fires. `:where(#chains-wrap.entering)` drops the entrance rule to specificity (0,1,1), below both, so a lingering `.entering` becomes harmless.

The entrance is deliberately small (the page-load liveliness is *barely noticeable*). A bigger entrance widens the window where the user could `pointerdown` on an item mid-animation, and the drag pipeline assumes settled positions; staying subtle makes that race practically impossible.

## Autoscroll and the Scroll-Padding Contract

A chain taller than the viewport must scroll while the user drags toward an edge, via `clone.scrollIntoView`. But `scrollIntoView` forces a synchronous relayout on every call — running it each frame thrashes. So it is gated twice:

- **At capture**, `baseline.autoscroll` decides whether the list can clip at all (does it extend past the visible region?). A list that fits never scrolls.
- **Per frame**, `#maybeAutoscroll` fires only when the pointer (`clientY`) enters an `itemHeight`-wide band at the top or bottom of the *visible* region.

The visible region's top is not the viewport top — a sticky nav covers it. That inset is the scroller's `scroll-padding-top`, which `navigation-tabs` publishes on every route change:

```js
function updateScrollInset() {
  document.documentElement.style.scrollPaddingTop =
    document.querySelector('nav').getBoundingClientRect().bottom + 'px';
}
```

```
   navigation-tabs.js              :root                  diagnose-causal-chains.js
   updateScrollInset() ──sets──▶ scroll-padding-top ──reads──▶ #maybeAutoscroll
   (owns the nav)                (the contract)               (knows only its scroller)
```

The widget reads its scroller's `scroll-padding-top`, never the nav, so it stays decoupled from the layout — and the same value makes the scroll engine land `scrollIntoView` *below* the nav instead of behind it, for free. The nav publishes per route because the subtab-row makes it taller on subtabbed routes; a measure taken once on a row-less route would be too short.

(Rejected: calling `scrollIntoView` unconditionally every frame — correct, but layout-forcing on frames where nothing needs to scroll.)

## Coordinate Translation: The Scroll Trap

When the user drags an item toward an edge of the documentElement's scrollport we call `scrollIntoView`, but only past two gated tests. `scrollIntoView` forces a relayout per call, so running it each frame would thrash.

**Test 1 — `autoscroll`, captured once at drag start** (`#captureDragBaseline`):

```js
autoscroll: listRect.top < topInset || listRect.bottom > innerHeight - bottomInset
```

Does the list extend past the visible region — above the inset or below the fold? Frozen into the baseline.

**Test 2 — per frame, but `dragMove` calls `#maybeAutoscroll` only when `autoscroll` is true:**

```js
if (clientY < topInset + itemHeight || clientY > innerHeight - bottomInset - itemHeight)
  this.#dragSession.clone.scrollIntoView({block: 'nearest'});
```

Is the pointer within an item-height of the top edge (`topInset`) or bottom edge (`innerHeight - bottomInset`)?

The gates skip per-frame calculations and the relayout for lists that fit within the scrollport, keeping the hot path fast and lean, while still covering the uncommon but plausible case — a list that overflows the scrollport, the item dragged toward the overflowing edge, as on a small or mobile window.

That same mid-drag scroll is why the rest of the drag works in `pageY`. The item's clamp to its list and its drop-target midpoints are fixed at pickup; autoscroll then scrolls the window past them, but their positions in the document — their `pageY` — don't change with it. The two failure modes it avoids:

**Stale thresholds.** `scrollIntoView` can scroll the page mid-drag for an overflowing chain. Cached *viewport* positions would invalidate the instant scroll fired. Cached *document* positions don't: LIs don't move in the document when the page scrolls.

**Compositor-thread tearing.** `PointerEvent.clientY` is captured at event creation. `window.scrollY` is a separate read at handler-invocation time. With async scrolling on the compositor thread, those two values can drift across the gap, producing a misaligned coordinate and visible clone jitter. `e.pageY` is computed by the browser engine inside the event with scroll state from the same instant — race-free by construction. The capture-time `+ scroll` for BCRs is fine because all the BCRs and the scroll read sit in one layout pass, internally consistent.

## State Isolation: The Shallow Freeze

Transient drag state lives in `#dragSession`, split by lifecycle volatility:

```js
#dragSession = {
  // Volatile — updated during dragMove:
  insertBeforeNode,
  marker,
  clone,
  // Immutable — captured once at drag start:
  baseline
};
```

`insertBeforeNode` is the live insert-before reference — the LI the dragged item would land before, or `null` to append at the end. It's held as the node, not an index: `insertBefore` takes the node directly, with no lookup, and an index would have to be read against `listEl.children`, which includes the clone `<ol>` and would be skewed by it.

`baseline` is the immutable half — everything the drag measures and derives once at pickup, frozen via `Object.freeze()` so a stray `session.baseline.pageStartY = 0` throws at runtime instead of silently corrupting the cache and producing a bug a release later.

**What the frozen baseline holds:**

| Field                      | What it is                                                         | Covered in                                             |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `listEl`                   | the chain's `.sortable-list` OL                                    | *animateLayoutChange* — FLIP container, drop insertion |
| `dragItem`                 | the picked-up LI                                                   | dimmed in place, re-inserted at the drop               |
| `items`                    | every LI at capture, clone-excluded                                | *Target Resolution Collections*                        |
| `pageStartY`               | pointer Y at pickup (document coords)                              | the per-frame delta's origin — *The Scroll Trap*       |
| `cloneTop`                 | the clone's pinned `top`                                           | *Pinning the Clone Origin*                             |
| `ordinalValue`             | dragged item's 1-based position, written to the clone `<ol start>` | *Clone Number Rebinding*                               |
| `itemHeight`               | the dragged item's height                                          | autoscroll band depth & `maxDelta` — *Autoscroll*      |
| `topInset` / `bottomInset` | the scrollport's scroll-padding insets                             | *Autoscroll*                                           |
| `innerHeight`              | viewport height                                                    | *Autoscroll*                                           |
| `autoscroll`               | whether the list overflows the scrollport                          | *Autoscroll*                                           |
| `minDelta` / `maxDelta`    | how far the item may travel up / down (document coords)            | the clamp — *The Scroll Trap*                          |
| `siblingDropMidpoints`     | every other item's document-coord drop midpoint                    | *Target Resolution Collections*                        |

Nested objects inside baseline (the `items` array, the `siblingDropMidpoints` records) are left raw. Deep-freezing them would walk and freeze N+1 objects every drag, churning the GC for state that exists for two seconds. The outer freeze enforces the contract; freezing the inner data would add no real protection at the cost of allocation overhead.

## Target Resolution Collections

The baseline holds two separate LI collections because they serve two different operations:

`items` — the full ordered list, *including* dragItem. `#updateCloneNumber` reads the prospective ordinal from it: `items.indexOf(insertBeforeNode) + 1` when `insertBeforeNode` is an item, `items.length + 1` when it's `null` (a drop past the last item). It keeps dragItem because the drag leaves it on screen, dimmed in place — so its slot still counts and the ordinals match what the user sees.

`items` is captured once, not read live: once `#commitDragDOM` inserts the clone, a live child read would count it. The clone is an `<ol start="N">` — its single `<li>` renders the [badge number](#clone-number-rebinding--1-offset) — dropped straight into `listEl`, so an `<ol>` sits inside an `<ol>`. That's non-conforming, but content models are a parser rule, not a DOM-API one: `insertBefore` adds the node without complaint, and the layout engine renders whatever tree it's handed. And an `<ol>` isn't an `<li>`, so `:scope > li` and the ordinal counter pass it over for free, keeping `#realItems` clone-free.

`siblingDropMidpoints` — dragItem-excluded, each record carrying its `sibling` LI and the precomputed `pageMidpointY` (document-coord midpoint, with in-flight transform subtracted). Used for hit-testing in `#findTargetSibling`. Filtering dragItem out at capture means the 120 Hz `Array.find` never wastes a comparison on the dragged item's own footprint.

Two collections, two purposes — duplication that earns its keep.

## The Settle Lifecycle

A drop's whole resolution lives in `commitDrop`; `endDrag` handles only cancellation. There are three outcomes:

- **Reorder.** `commitDrop` runs `#animateLayoutChange` (the displaced items FLIP into place; the dragged item eases from the clone's release point), tags the dragged item `.dropped` to cool it down, then removes the clone immediately. `#settleClone` is *not* part of a reorder.
- **No-op** — released back into its own slot. Detected with `insertBeforeNode == dragItem.nextElementSibling`: the item would land before the LI it already sits before, so nothing moves. At end-of-list both sides are `null` — no hit-test target, no next sibling — the same no-op. Prior grading is restored, and `#settleClone` glides the clone home.
- **Abort** — Escape or `pointercancel`. `commitDrop` never runs; `endDrag` settles the clone back to the item's slot and clears the session.

The cool-down is a `from`-only keyframe: the dropped item briefly wears the clone's lifted look, then CSS eases it down to the resting item.

```css
@keyframes item-drop-cool {
  from {
    background: var(--accent-bg);
    border-left-color: var(--accent);
    box-shadow: var(--box-shadow-lg);
  }
}
```

A `from`-only block declares the start and animates to the element's own resting style — so the keyframe never restates the resting values, and a running animation outranks the `grading-stale` cascade for free. The dropped item also carries a `z-index` so it cools *above* the displaced sibling sliding past it (after `insertBefore`, an upward move leaves that sibling later in DOM order, so without the lift it would paint on top).

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

## Visual Stabilizers

### Pinning the Clone Origin

The clone wrapper is `position: absolute`. Without an explicit `top`, its static position is its hypothetical in-flow position — which moves when `commitDrop` rearranges siblings. A drag-up commit places the dragged LI before the clone in DOM order, shifting the clone's static anchor down by roughly one item, and the clone visibly teleports before the settle starts.

Capture pins `top` explicitly via inline style:

```js
cloneTop: Math.round(itemRect.top - listRect.top)
```

The transform offset drives the live motion; `top` stays fixed. Rounding `cloneTop` once at capture keeps text rendering stable across the settle — the *fixed* component of the effective y is always an integer pixel, so anti-aliasing doesn't shift as the transform animates back to zero.

`offsetTop` isn't an option here: the CSSOM View spec defines it loosely and browsers diverge on edge cases. BCR-diff is the well-defined cross-browser path.

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

## The Marker and Badge Invariants

### Marker Suppression (`wouldNotMove`)

The drop marker — the colored bar previewing where the dragged item would land — is a `::before` pseudo-element on the receiving LI, painted via `drop-target-before` / `drop-target-after` class toggles. No marker element to create or position.

If the pointer hovers over a position that resolves to the dragged item's current slot, releasing is a no-op. The marker is suppressed:

```js
const wouldNotMove = target === dragItem.nextElementSibling
  || (target === null && dragItem === listEl.lastElementChild);
```

Dropping in either position wouldn't move anything. Suppressing the bar signals that to the user.

### Clone Number Rebinding (`-1` offset)

The floating clone's `start` attribute updates on every drop-target change so the badge matches the prospective ordinal:

```js
clone.start = ordinalValue < insertBeforeOrdinal ? insertBeforeOrdinal - 1 : insertBeforeOrdinal;
```

`insertBeforeOrdinal` is `insertBeforeNode`'s 1-based position. Moving *down*, the dragged LI sits *above* it, so vacating that slot pulls it up one and the LI lands at `insertBeforeOrdinal - 1`. Moving *up*, the dragged LI sits *below* it, leaving that position untouched, so the LI lands at `insertBeforeOrdinal` — the node and the LIs it passes shift *down* to open the slot.

Without the conditional, the badge would flicker by one as the pointer crossed each item boundary.

## Grading Display Lifecycle

`checkResults()` applies `.correct` / `.incorrect` classes per LI. The classes *stay on the elements*, but their visibility is gated by state on the OL.

When a drag starts, `#commitDragDOM` adds `.grading-stale` to the OL. A CSS rule with higher specificity than `.correct` / `.incorrect` overrides the colored backgrounds and borders back to the neutral item style while `.grading-stale` is present. The existing `transition: border-color` on `.sortable-list > li` fades the borders smoothly as the cascade flips — so the moment the user picks up an item, the grading visually clears with a brief transition rather than a hard pop.

What removes `.grading-stale`:

- **No-op drop** — `commitDrop` removes the class and the prior grading reappears unchanged.
- **Reordering drop** — `.grading-stale` *stays*, because the grading is genuinely stale.
- **`checkResults`** — re-grades, then removes the class.
- **`reshuffle`** — re-renders LIs (without color classes), removes the class.

All-correct disables the Check button, sets `aria-disabled` on the OL (which blocks subsequent `pointerdown`), and plays a [completion cascade](#completion-cascade) through the LIs. Reshuffle alone can re-arm Check — drag-start can't, because the OL lock makes `pointerdown` bail.

The info-bonus `<details>` reveals on the same grading path: on all-correct, or once a chain has been checked wrong `BONUS_HINT_THRESHOLD` times *since the last drag or reshuffle* (`startDrag` and `reshuffle` both reset `#wrongChecks`), `#toggleBonusReveal(true)` opens it — a hint appears when the user is stuck or has finished, not before.

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

## iOS WebKit Text Selection

On iOS WebKit, the browser decides whether to initiate text selection at touch-down — before any `pointerdown` handler runs. `touch-action: none` prevents scroll and zoom but not selection initiation. The fix is one extra listener, `#onTouchstart`, registered with `{passive: false}` so its `preventDefault` is allowed to take effect:

```js
#onTouchstart = e =>
  e.target.closest('.sortable-list > li') && e.preventDefault();
```

`preventDefault` on `touchstart` cancels the selection. The `pointerdown` path runs unaffected. A document-wide `html.list-drag-active { user-select: none }` rule covers any text the pointer passes over during the drag.

## State Classes

Much of the behavior is encoded as classes rather than methods. The toggles and what they govern:

| Class                           | On           | Set / cleared                                        | Governs                                                                  |
| ------------------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `html.list-drag-active`        | document     | `pointerdown` / `cleanup`                            | drag-wide `cursor` / `user-select` lock                                  |
| `entering`                      | wrapper      | `initSortableLists` / wrapper `animationend`                 | gates the page-load item entrance (via `:where()` for specificity safety) |
| `revealed`                      | form         | `#toggleBonusReveal`                                 | shows the info-bonus `<details>`                                         |
| `grading-stale`                 | OL           | drag start / no-op drop, `checkResults`, `reshuffle` | neutralizes `.correct`/`.incorrect` while dragging                       |
| `all-correct`                   | OL           | `checkResults` / `reshuffle`                         | the completion cascade                                                   |
| `active-drag-item`              | dragged LI   | `#commitDragDOM` / drop or settle                    | dims the original; slow-dim on lift, instant on drop                     |
| `drop-target-before` / `-after` | receiving LI | `#updateDropMarker`                                  | the `::before` drop-position bar                                         |
| `dropped`                       | reordered LI | `commitDrop` / `animationend`                        | the cool-down keyframe                                                   |
| `settling`                      | clone OL     | `#settleClone`                                       | enables the clone's settle transition                                    |
