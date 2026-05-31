# Diagnose Causal Chains

The user reorders a chain's steps from a scrambled order into the correct sequence, then Check Order grades it. Reshuffle restarts the game with a new random order.

Each chain renders as a numbered list inside its own form: title, a "start → end" summary, the steps in their current order, and the Check Order / Reshuffle buttons. Pressing a step picks it up — the original dims in place, a floating copy of the row tracks the pointer, a colored bar previews where the drop would land, and the copy's badge updates live. On release, a reorder animates the whole list into its new arrangement while the dropped row cools from the lifted look down to a resting row; a release back into the same slot — or an Escape/cancel — glides the floating copy home instead. Check Order colors each row correct or incorrect, and an all-correct chain plays a staggered pulse from top to bottom.

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

— and CausalChain instances get the same `id`, and use it to build their `form` and `ol` upon instantiation —

```html
<form name="diaphragm-to-adt">
  <ol id="diaphragm-to-adt"></ol>
</form>
```

— so submit and drag handlers can recover the chain instance with `getById` from the form's `name` or the OL's `id`.

The factory returns the instance. Its form getter exposes the `form` *element*, detached at this point.

On module data load, `renderAll` iterates the definitions, instantiates the chains, and attaches their `form`s in one `chainsWrap.replaceChildren(...forms)`. This kicks off every row's entrance animation in sync, and `animationend` clears them all (see [Page-Load Entrance](#page-load-entrance)):

```js
function renderAll(chainDefinitions) {
  const forms = Object.entries(chainDefinitions).map(([id, def]) =>
    CausalChain.getById(id, def).form);
  chainsWrap.classList.add('entering');
  chainsWrap.addEventListener('animationend', clearChainEntering);
  chainsWrap.replaceChildren(...forms);
}
```

Delegated handlers find the chain instance by reading the id off the DOM:

```js
CausalChain.getById(e.target.name);

const ol = chainItem.parentNode;
activeChainList = CausalChain.getById(ol.id);
```

That shared key obviates `data-chain-id`, selector walks, array searches, and translation maps.

### Action Dispatch Keys

The one-liner consumes two keys: `form.name` finds the chain instance via the Shared Key; `e.submitter.name` finds the method by matching its instance-method name.

```js
const handleChainSubmit = e =>
  CausalChain.getById(e.target.name)[e.submitter.name]?.(e.preventDefault());
```

Both `checkResults` and `reshuffle` are instance methods named after their buttons. The button name also names the form control (used by `this.#form.checkResults.disabled`).

### Row Identity Contract

Each sortable `<li>` carries its step text in `data-step`; the chain stores the correct sequence in `#steps` (set at construction, before the shuffle). Full contract: [Row Identity](#row-identity-step-text-as-the-key).

## The CausalChain Decorator

Each `CausalChain` instance manages the state and DOM subtree for one keyed chain. The constructor uses the JSON definition to initialize the baseline correct order (`#steps`), the mutable display order (`#currentOrder`), and the drag session tracking.

### Factory-Gated Construction

The `CausalChain.getById` factory encapsulates instantiation and caching. A private `#KEY` symbol gates the constructor, forcing all external access through the factory. This guarantees that consumers interact agnostically with fully built subtrees, enabling zero-wiring delegation:

```js
const handleChainSubmit = e =>
  CausalChain.getById(e.target.name)[e.submitter.name]?.(e.preventDefault());
```

The initial factory call runs the constructor and executes private `#buildForm` to populate the detached elements. Subsequent calls bypass construction and return the cached instance by `id`.

### Reshuffle Without Re-render

Each instance persists for the page lifetime. `reshuffle()` re-randomizes `#currentOrder`, clears grading state, and replaces the OL's children with rebuilt LIs inside `#animateLayoutChange`. The form and OL nodes persist — reshuffle does not go through `renderAll`, so `chainsWrap.entering` isn't re-added and `chain-enter` doesn't replay.

Rebuilding from `#buildItems()` (rather than resetting and reordering existing LIs) resets the list to its initial state, reordered. Reset+reorder would save the allocation but force `#buildItems` and the reset step to stay in sync — a brittleness cost not worth saving allocations on a handful of rows.

### Symmetrical Action Dispatch

Dispatch is button↔method symmetry. Class methods share exact names with their submit button `name` attributes (`reshuffle`, `checkResults`). The global listener routes submit actions directly via `[e.submitter.name]()`, eliminating per-button event wiring.

### The Public Interface

External method access is grouped by consumer:

|**Consumer**|**Calls / Reads**|**Architectural Purpose**|
|---|---|---|
|`renderAll`|`form`|Mounts the prebuilt form.|
|`handleChainSubmit`|`reshuffle()`, `checkResults()`|Runs the submitted form action.|
|`wireChainDrag`|`startDrag()`, `dragMove()`, `commitDrop()`, `endDrag()`|Drives the drag pipeline via delegated pointer events.|
### DOM Architecture

Each `CausalChain` instance builds its HTML subtree within `#buildForm`. The structure maps HTML elements directly to the instance runtime state and action dispatch loop.

|**Component Element**|**Attributes**|**Architectural Purpose**|
|---|---|---|
|**Component Root** `<form>`|`name="[id]"`|Binds the subtree to a specific chain identity. The global submit handler uses `e.target.name` to look up the cached instance immediately.|
|**Sortable List** `<ol>`|None|Semantic `<ol>` (screen readers announce position). Serves as the DOM container for pointer tracking and FLIP layout calculations.|
|**Sequence Steps** `<li>`|`data-step="[step-id]"`|Identifies the step. The attribute acts as the lookup key for FLIP animations and grading.|
|**Submit Buttons** `<button>`|`name="reshuffle"`, `name="checkResults"`|Trigger form submission natively. The `name` attributes route actions directly to the matching class methods.|
|**Bonus Disclosure** `<details>`|None|Native disclosure widget handles open/close.|

## Single-Pointer Dragging

The `pointerdown` listener blocks multitouch to prevent secondary touches from interfering:

```js
container.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0 || activeChainList) return;
  // ...
  activeChainList = CausalChain.getById(ol.id);
  activePointerId = e.pointerId;
  chainItem.setPointerCapture(e.pointerId);
});
```

The activation assignments set the session tracking state:

- `activeChainList` instance reference, blocking concurrent drag instances across the ChainList instances. Initially null. 
```js
container.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0 || activeChainList) return;
  ...
```

- `activePointerId` initially null, locks the session to the initiating pointer.
And subsequent `pointermove`, `pointerup`, and `pointercancel` events *must* pass the pointer identity verification check before executing state or DOM mutations. 

```js
if (activeChainList && e.pointerId === activePointerId)
```

- `setPointerCapture()`: Binds the event stream to the target element so the browser routes events even if the pointer leaves the viewport.

The `pointerup`, `pointercancel`, and `Escape` keydown handlers call cleanup. 

```js
const cleanup = () => {
  activeChainList.endDrag();
  document.documentElement.classList.remove('active-chain-drag');
  activeChainList = null;
  activePointerId = null;
};
```
This routine clears the `html.active-chain-drag` class and sets both `activeChainList` and `activePointerId` to `null`, and the browser implicitly releases pointer capture.

## The Read/Write Split (Defeating Layout Thrashing)

The architectural challenge for any DOM drag-and-drop is layout thrashing. A 120 Hz `pointermove` loop that interleaves layout-querying reads (`getBoundingClientRect`) with layout-invalidating writes (style updates, DOM mutations) forces the browser to recompute layout repeatedly, dropping frames.

The drag is partitioned into three phases with a strict read/write boundary:

**Capture** (`#captureDragBaseline`) — pure reads, then pure math. The reads are split into two named helpers so each function does one honest thing:

- `#readDragInputs(chainItem)` — one batched read of every layout fact the drag baseline needs: the chain's OL ref, the full items list, the chainItem and OL rects, `window.scrollY`, viewport height, and the scroll-padding-top inset. No derivations.
- `#readSiblingDropMidpoints(items, chainItem, scroll)` — single pass over the items, skipping the chainItem itself, reading each sibling's BCR and in-flight transform and computing its page-coord drop midpoint. The read and the compute live together because the output *is* the midpoints.

`#captureDragBaseline` composes both, then derives the rest off the snapshot: the clamp boundaries (`minDelta`/`maxDelta`), the dragged item's rank, the initial drop target, the autoscroll-needed flag. Returns a frozen object. Runs once at drag start; even N=200 finishes in 1–2 ms — inside the ~100 ms window for an instant-feeling press.

**Commit** (`#commitDragDOM`) — pure writes. Removes any stale clone OL, inserts a fresh one, marks the dragged LI, assembles `#dragSession`. Runs once, immediately after capture.

**Move** (`dragMove`) — reads the cached baseline plus `pageY`/`clientY` from the event, runs a clamp and an `Array.find`, writes `--drag-offset`, toggles marker classes, and calls `#maybeAutoscroll` (see [Autoscroll](#autoscroll-and-the-scroll-padding-contract)). No `getBoundingClientRect` per frame; the drop target and offset come entirely from the frozen baseline.

The split is structural: a stray BCR inside `#commitDragDOM` or `dragMove` would be obviously out of place. All layout reads live in `#readDragInputs` and `#readSiblingDropMidpoints`; the derivation in `#captureDragBaseline` touches no DOM.

## animateLayoutChange: One Safe, Interruptible Reflow

Two runtime actions rearrange the list: Reshuffle, and a reordering drop. (Initial render is not one of them — see [Page-Load Entrance](#page-load-entrance); the form is built whole at instance creation, no FLIP needed.) Doing the FLIP ad hoc at each site invites both thrashing and breakage — a second Reshuffle landing mid-animation, or a rapid re-drag, would measure against positions an unfinished animation has already moved. One private static helper owns the move:

```js
static #animateLayoutChange(container, mutate, customOrigins = new Map()) {
  const oldTops = new Map(Array.from(CausalChain.#realItems(container),
    li => [li.dataset.step, li.getBoundingClientRect().top]));
  customOrigins.forEach((top, step) => oldTops.set(step, top));
  mutate();                                  // the only structural mutation — after all reads
  CausalChain.#realItems(container).forEach(li => { /* animate old top → new top */ });
}
```

First it reads every row's current top, then runs the caller's `mutate()` — the only structural DOM mutation — then animates each row from where it was to where it landed (those animation writes come after the new-top reads).

It is interruptible because it re-reads *live* positions on entry. A spam-click or rapid re-drag recalibrates against reality instead of fighting a stale snapshot; mid-flight animations finish in the background, and the next call measures where things actually are.

### Row Identity: Step Text as the Key

The chain id is the feature-level Shared Key; rows have their own smaller identity contract. A row is identified by its step text.

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

That choice is what lets Reshuffle rebuild the LIs with `replaceChildren` and still animate. The new LIs are not the old DOM nodes, but they carry the same `data-step` values. `#animateLayoutChange` records old positions by `li.dataset.step`, runs the mutation, then looks up each new row's old top by the same key.

The cost is a data constraint: step strings must be unique within a chain. A duplicate step would collide in `oldTops`, make the FLIP identity ambiguous, and also corrupt the order model because drop commit rebuilds `#currentOrder` from `li.dataset.step`. The app does not add synthetic row ids because the step text is already the user's visible unit of ordering; adding another id would create a second truth to keep aligned for little gain.

Reshuffle rebuilds the rows wholesale rather than reusing nodes — a real cost (layout, allocation, GC), accepted because rows carry no durable per-node state: no per-LI listeners (drag and submit are delegated on the container), no focusable controls, no expensive subtree. Fresh rows make reshuffle a clean reset boundary that drops stale `.correct`/`.incorrect`/`.dropped` and inline `--i` with no per-node cleanup. Reusing nodes would only earn its keep if a row gained local state, a focused control, or a direct listener.

`customOrigins` lets a caller override a row's recorded start — the drop feeds the clone's release point, so the dragged row eases from the pointer rather than from its dim DOM slot.

**Invariant:** every post-mutation row's `data-step` is already in `oldTops`. Reshuffle keeps the step set; a drop persists the nodes; `customOrigins` covers the dragged row's release point. The helper trusts this and doesn't guard for a missing entry; callers don't introduce new rows mid-flight.

The FLIP stays in the Web Animations API rather than CSS because its start frame is a *measured* per-element delta, which is inherently computed in JS. (The completion pulse, which needs no per-element measurement, went the other way — see [Completion Cascade](#completion-cascade).)

## Page-Load Entrance

Initial render is construction, not a measured layout change — there's no prior committed layout to FLIP from. Each first `CausalChain.getById(id, def)` call creates the chain instance and builds its form whole (`#buildForm` populates the OL with rows from `#currentOrder`). `renderAll` collects every chain's `form` getter into an array and attaches the whole set in one `chainsWrap.replaceChildren(...forms)`, which makes all the rows render in the same frame. A subtle CSS animation (`chain-enter`: opacity 0 → 1, `translateY(-6px → 0)`) gives them a quiet entrance:

```css
:where(#chains-wrap.entering) .chain-list > li {
  animation: chain-enter var(--dur-normal) ease-out;
}
```

The gating class lives on the wrapper, not on each OL or each row. Before the attach, `renderAll` adds `.entering` to `chainsWrap` and registers one `animationend` listener; the synchronized attach fires every row's `chain-enter` together, the listener catches the first bubbled `animationend` whose `animationName === 'chain-enter'`, removes `.entering`, and self-unregisters. One class, one listener, one cleanup — for the whole feature.

**`:where()` is defense in depth.** The wrapper class is normally cleared synchronously, but if a user reshuffles or drops within the entrance window (~`--dur-normal`), the underlying `animationend` either gets cancelled or arrives interleaved with state-change animations. Without lowering specificity, the wrapper rule `#chains-wrap.entering .chain-list > li` (specificity 1,2,1) would outrank `.chain-list > li.dropped` (0,2,1) and `.chain-list.all-correct > li` (0,2,1), and a lingering `.entering` would suppress those animations — for `.dropped`, also stranding the class on the row because its `animationend`-driven cleanup never fires. `:where(#chains-wrap.entering)` drops the entrance rule to specificity (0,1,1), below both, so a lingering `.entering` becomes harmless.

The entrance is deliberately small (the page-load liveliness is *barely noticeable*). A bigger entrance widens the window where the user could `pointerdown` on a row mid-animation, and the drag pipeline assumes settled positions; staying subtle makes that race practically impossible.

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

Pointer tracking and boundary clamping use document-relative coordinates (`pageY`); the autoscroll edge test deliberately uses viewport-relative `clientY`. The split is principled — a value cached at capture and reused across frames must survive the page scrolling under it, so it lives in document space; the edge test is recomputed fresh every frame against the live viewport, so viewport space is what it wants. The wire passes both `e.pageY` and `e.clientY` at `pointermove`; capture converts BCRs to document coords by adding `window.scrollY` once.

Two failure modes the `pageY` convention avoids:

**Stale thresholds.** `scrollIntoView` can scroll the page mid-drag for an overflowing chain. Cached *viewport* coordinates would invalidate the instant scroll fired. Cached *document* coordinates don't: LIs don't move in document space when the page scrolls.

**Compositor-thread tearing.** `PointerEvent.clientY` is captured at event creation. `window.scrollY` is a separate read at handler-invocation time. With async scrolling on the compositor thread, those two values can drift across the gap, producing a misaligned coordinate and visible clone jitter. `e.pageY` is computed by the browser engine inside the event with scroll state from the same instant — race-free by construction. The capture-time `+ scroll` for BCRs is fine because all the BCRs and the scroll read sit in one layout pass, internally consistent.

## State Isolation: The Shallow Freeze

Transient drag state lives in `#dragSession`, split by lifecycle volatility:

```js
#dragSession = {
  // Volatile — updated during dragMove:
  dropTarget,
  marker,
  clone,
  // Immutable — captured once at drag start:
  baseline
};
```

`baseline` is frozen via `Object.freeze()`. The contract is "no accidental write to baseline fields" — a future `session.baseline.pageStartY = 0` throws at runtime instead of silently corrupting the cache and producing a bug a release later.

Nested objects inside baseline (the `items` array, the `siblingDropMidpoints` records) are left raw. Deep-freezing them would walk and freeze N+1 objects every drag, churning the GC for state that exists for two seconds. The outer freeze enforces the contract; freezing the inner data would add no real protection at the cost of allocation overhead.

## Target Resolution Collections

The baseline holds two separate LI collections because they serve two different operations:

`items` — full ordered list, *including* chainItem. Used for rank arithmetic in `#updateCloneNumber`: `items.indexOf(dropTarget) + 1` returns the dropTarget's 1-based position in the rendered list, and `items.length + 1` is the rank past the end. The math relies on indices matching what the user sees; excluding chainItem would shift indices for items below it and require an offset correction.

`siblingDropMidpoints` — chainItem-excluded, each record carrying its `sibling` LI and the precomputed `pageMidpointY` (document-coord midpoint, with in-flight transform subtracted). Used for hit-testing in `#findTargetSibling`. Filtering chainItem out at capture means the 120 Hz `Array.find` never wastes a comparison on the dragged item's own footprint.

Two collections, two purposes — duplication that earns its keep.

## The Settle Lifecycle

A drop's whole resolution lives in `commitDrop`; `endDrag` handles only cancellation. There are three outcomes:

- **Reorder.** `commitDrop` runs `#animateLayoutChange` (the displaced rows FLIP into place; the dragged row eases from the clone's release point), tags the dragged row `.dropped` to cool it down, then removes the clone immediately. `#settleClone` is *not* part of a reorder.
- **No-op** — released back into its own slot. Detected with `dropTarget == baseline.initialDropTarget`. The comparison is loose on purpose: "no target" is `null` from the hit-test but `undefined` from an end-of-list `initialDropTarget`, and both mean the same absence. Prior grading is restored, and `#settleClone` glides the clone home.
- **Abort** — Escape or `pointercancel`. `commitDrop` never runs; `endDrag` settles the clone back to the item's slot and clears the session.

The cool-down is a `from`-only keyframe: the dropped row briefly wears the clone's lifted look, then CSS eases it down to the resting row.

```css
@keyframes chain-drop-cool {
  from {
    background: var(--accent-bg);
    border-left-color: var(--accent);
    box-shadow: var(--box-shadow-lg);
  }
}
```

A `from`-only block declares the start and animates to the element's own resting style — so the keyframe never restates the resting values, and a running animation outranks the `grading-stale` cascade for free. The dropped row also carries a `z-index` so it cools *above* the displaced sibling sliding past it (after `insertBefore`, an upward move leaves that sibling later in DOM order, so without the lift it would paint on top).

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

The clone wrapper is `position: absolute`. Without an explicit `top`, its static position is its hypothetical in-flow position — which moves when `commitDrop` rearranges siblings. A drag-up commit places the dragged LI before the clone in DOM order, shifting the clone's static anchor down by roughly one row, and the clone visibly teleports before the settle starts.

Capture pins `top` explicitly via inline style:

```js
cloneTop: Math.round(chainItemRect.top - chainListRect.top)
```

The transform offset drives the live motion; `top` stays fixed. Rounding `cloneTop` once at capture keeps text rendering stable across the settle — the *fixed* component of the effective y is always an integer pixel, so anti-aliasing doesn't shift as the transform animates back to zero.

`offsetTop` isn't an option here: the CSSOM View spec defines it loosely and browsers diverge on edge cases. BCR-diff is the well-defined cross-browser path.

### CSS Transform Handoff

```css
.chain-clone-list {
  transform: translateY(var(--drag-offset, 0px));
}
.chain-clone-list.settling {
  transition: transform var(--dur-slow) ease-out;
}
```

Drag motion writes `--drag-offset`, not `transform`. CSS owns the property name and the transition declaration; JS only writes a number per frame, then adds `.settling` to enable the transition at settle time. The static `top` and the dynamic offset stay in separate authoring channels — JS never recomposes a `transform` string per frame, and JS never coordinates which property the transition targets.

## The Marker and Badge Invariants

### Marker Suppression (`wouldNotMove`)

The drop marker — the colored bar previewing where the dragged row would land — is a `::before` pseudo-element on the receiving LI, painted via `drop-target-before` / `drop-target-after` class toggles. No marker element to create or position.

If the pointer hovers over a position that resolves to the dragged item's current slot, releasing is a no-op. The marker is suppressed:

```js
const wouldNotMove = target === chainItem.nextElementSibling
  || (target === null && chainItem === chainListEl.lastElementChild);
```

Dropping in either position wouldn't move anything. Suppressing the bar signals that to the user.

### Clone Number Rebinding (`-1` offset)

The floating clone's `start` attribute updates on every drop-target change so the badge matches the prospective rank:

```js
clone.start = displayRank < targetNumber
  ? targetNumber - 1 : targetNumber;
```

When the dragged LI is moving *down*, `dropTarget` is the LI it would land *before*. Inserting before that target shifts the target up by one slot to make room, so the dragged LI's new position is `targetNumber - 1`. When moving *up* (over a target with a smaller index), no other LI shifts — the dragged LI takes the target's slot directly.

Without the conditional, the badge would flicker by one as the pointer crossed each row boundary.

## Grading Display Lifecycle

`checkResults()` applies `.correct` / `.incorrect` classes per LI. The classes *stay on the elements*, but their visibility is gated by state on the OL.

When a drag starts, `#commitDragDOM` adds `.grading-stale` to the OL. A CSS rule with higher specificity than `.correct` / `.incorrect` overrides the colored backgrounds and borders back to the neutral row style while `.grading-stale` is present. The existing `transition: border-color` on `.chain-list > li` fades the borders smoothly as the cascade flips — so the moment the user picks up an item, the grading visually clears with a brief transition rather than a hard pop.

What removes `.grading-stale`:

- **No-op drop** — `commitDrop` removes the class and the prior grading reappears unchanged.
- **Reordering drop** — `.grading-stale` *stays*, because the grading is genuinely stale.
- **`checkResults`** — re-grades, then removes the class.
- **`reshuffle`** — re-renders LIs (without color classes), removes the class.

All-correct disables the Check button, sets `aria-disabled` on the OL (which blocks subsequent `pointerdown`), and plays a [completion cascade](#completion-cascade) through the LIs. Reshuffle alone can re-arm Check — drag-start can't, because the OL lock makes `pointerdown` bail.

The info-bonus `<details>` reveals on the same grading path: on all-correct, or once a chain has been checked wrong `BONUS_HINT_THRESHOLD` times *since the last drag or reshuffle* (`startDrag` and `reshuffle` both reset `#wrongChecks`), `#revealBonus` opens it — a hint appears when the user is stuck or has finished, not before.

## Completion Cascade

When `checkResults` grades all-correct, the rows play a brief staggered pulse, top-to-bottom, to mark the win.

The natural pure-CSS expression of "stagger by position" would index each row in the stylesheet. Two CSS-native indices were considered and rejected: `sibling-index()` (too thinly supported), and `counter(list-item)` (it resolves to a *string*, but `calc()` for an `animation-delay` needs a `<length>`/`<time>`). The fallback would be a Web Animations call that computes each row's delay in JS — exactly the kind of step-by-step timing math that bloats the script and pulls presentation into it.

The compromise keeps the timing declarative in CSS and pays one unavoidable JS line to hand the index across:

```js
items.forEach(({style}, i) => style.setProperty('--i', i));
```

```css
.chain-list.all-correct > li {
  animation: chain-correct-pulse var(--dur-normal) ease-out;
  animation-delay: calc(var(--i) * var(--dur-fast) / 2);
}
```

The loop is presentation logic in the script — a cross-concern cost — but it's the smallest bridge that lets the layout engine own the stagger, and it avoids hand-rolled WAAPI timing.

## iOS WebKit Text Selection

On iOS WebKit, the browser decides whether to initiate text selection at touch-down — before any `pointerdown` handler runs. `touch-action: none` prevents scroll and zoom but not selection initiation. The fix is one extra listener:

```js
container.addEventListener('touchstart',
  e => e.target.closest('.chain-list > li') && e.preventDefault(),
  {passive: false});
```

`preventDefault` on `touchstart` (with `passive: false` to make that legal) cancels the selection. The `pointerdown` path runs unaffected. A document-wide `html.active-chain-drag { user-select: none }` rule covers any text the pointer passes over during the drag.

## State Classes

Much of the behavior is encoded as classes rather than methods. The toggles and what they govern:

| Class                           | On           | Set / cleared                                        | Governs                                                                  |
| ------------------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `html.active-chain-drag`        | document     | `pointerdown` / `cleanup`                            | drag-wide `cursor` / `user-select` lock                                  |
| `entering`                      | wrapper      | `renderAll` / wrapper `animationend`                 | gates the page-load row entrance (via `:where()` for specificity safety) |
| `revealed`                      | form         | `#revealBonus` / `#clearBonusReveal`                 | shows the info-bonus `<details>`                                         |
| `grading-stale`                 | OL           | drag start / no-op drop, `checkResults`, `reshuffle` | neutralizes `.correct`/`.incorrect` while dragging                       |
| `all-correct`                   | OL           | `checkResults` / `reshuffle`                         | the completion cascade                                                   |
| `active-drag-item`              | dragged LI   | `#commitDragDOM` / drop or settle                    | dims the original; slow-dim on lift, instant on drop                     |
| `drop-target-before` / `-after` | receiving LI | `#updateDropMarker`                                  | the `::before` drop-position bar                                         |
| `dropped`                       | reordered LI | `commitDrop` / `animationend`                        | the cool-down keyframe                                                   |
| `settling`                      | clone OL     | `#settleClone`                                       | enables the clone's settle transition                                    |
