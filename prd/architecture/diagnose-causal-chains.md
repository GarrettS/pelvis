# Diagnose Causal Chains

The user reorders a chain's steps from a scrambled starting order into the correct sequence, then clicks Check Order to grade the result. Reshuffle restarts with a new shuffle.

Each chain renders as a numbered list inside its own form: title, "start → end" summary, the LIs in their current order, and the Check Order / Reshuffle buttons. Pressing on an LI picks it up — the original dims in place, a floating copy of the row tracks the pointer, a colored bar previews where the drop would land, and the copy's badge number updates live. Releasing drops the LI into the previewed position and the floating copy glides into place before vanishing.

## The Read/Write Split (Defeating Layout Thrashing)

The architectural challenge for any DOM drag-and-drop is layout thrashing. A 120 Hz `pointermove` loop that interleaves layout-querying reads (`getBoundingClientRect`) with layout-invalidating writes (style updates, DOM mutations) forces the browser to recompute layout repeatedly, dropping frames.

The architecture enforces a strict boundary between reads and writes by partitioning the drag into three phases:

**Capture** (`static #captureBaseline`) — pure reads. One BCR for the chainItem, one for the OL, one for each non-dragged sibling, plus `window.scrollY`. From those, derives the LI snapshot, the dragged item's rank, the initial drop target, the page-coord clamp boundaries (`minDelta` / `maxDelta`), and per-sibling page-coord midpoints (`siblingThresholds`). Returns a frozen object. Runs once at drag start; even N=200 finishes in 1–2 ms — well inside the ~100 ms perception window for an instant-feeling click, so the user can't perceive the work.

**Commit** (`static #commitDragDOM`) — pure writes. Removes any stale clone OL, inserts a fresh one, marks the dragged LI, assembles `#dragSession`. Runs once at drag start, immediately after capture.

**Move** (`dragMove`) — neither queries nor mutates layout in a way that forces a synchronous reflow. Reads the cached baseline plus `pageY` from the event, runs a clamp and an `Array.find`, then writes a CSS custom property and toggles classes. Zero BCRs per frame.

The split is structural: a stray BCR inside `#commitDragDOM` or `dragMove` would be obviously out of place. The class field comment names what lives in baseline; a reader inspecting any of the per-frame helpers can see immediately whether a value is cached or live.

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

Nested objects inside baseline (the `items` array, the `siblingThresholds` objects) are left raw. Deep-freezing them would walk and freeze N+1 objects every drag, churning the GC for state that exists for two seconds. The outer freeze enforces the contract; freezing the inner data would add no real protection at the cost of allocation overhead.

## Coordinate Translation: The Scroll Trap

All pointer tracking and boundary clamping use document-relative coordinates (`pageY`), not viewport-relative coordinates (`clientY`). The wire passes `e.pageY` at both `pointerdown` and `pointermove`; capture converts BCRs to document coords by adding `window.scrollY` once.

Two failure modes the conversion avoids:

**Stale thresholds.** `scrollIntoView` fires every frame and can scroll the page mid-drag for long chains. Cached *viewport* coordinates would invalidate the instant scroll fired. Cached *document* coordinates don't: LIs don't move in document space when the page scrolls.

**Compositor-thread tearing.** `PointerEvent.clientY` is captured at event creation. `window.scrollY` is a separate read at handler-invocation time. With async scrolling on the compositor thread, those two values can drift across the gap, producing a misaligned coordinate and visible clone jitter. `e.pageY` is computed by the browser engine inside the event with scroll state from the same instant — race-free by construction. The capture-time `+ scroll` for BCRs is fine because all the BCRs and the scroll read sit in one layout pass, internally consistent.

## Target Resolution Collections

The baseline holds two separate LI collections because they serve two different operations:

`items` — full ordered list, *including* chainItem. Used for rank arithmetic in `#updateCloneNumber`: `items.indexOf(dropTarget) + 1` returns the dropTarget's 1-based position in the rendered list, and `items.length + 1` is the rank past the end. The math relies on indices matching what the user sees; excluding chainItem would shift indices for items below it and require an offset correction.

`siblingThresholds` — chainItem-excluded, with precomputed page-coord midpoints. Used for hit-testing in `#findTargetSibling`. Filtering chainItem out at capture means the 120 Hz `Array.find` never wastes a comparison on the dragged item's own footprint.

Two collections, two purposes — duplication that earns its keep.

### The Commit No-Op Exit

`commitDrop` short-circuits when `dropTarget === initialDropTarget` — a click-without-drag, or a drag that returned to its origin:

```js
commitDrop() {
  const { dropTarget, baseline } = this.#dragSession;
  if (dropTarget === baseline.initialDropTarget) return;
  // …
}
```

Per DOM spec, `insertBefore(node, sameSpot)` still removes and re-inserts the node, and the subsequent `Array.from(realItems(...))` would rebuild `#order` to the same value it already held. Skipping both is free correctness and free performance.

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

### Sub-Pixel Transition Deadlock

When the drag ends, `#settleClone` animates the clone from its current visual position to the dragged LI's final layout position. Duration scales with distance (~1.5 px/ms, clamped 200–600 ms). A `transitionend` listener removes the clone.

```js
if (Math.abs(dy) < 0.5) {
  clone.remove();
  return;
}
```

If `dy` is near zero (click-without-drag, or sub-pixel residue from the rounded `cloneTop`), the transform value wouldn't change. With no change, no transition fires, and `transitionend` never fires — the clone strands in the DOM. The sub-pixel guard removes it synchronously in that case.

## iOS WebKit Text Selection

On iOS WebKit, the browser decides whether to initiate text selection at touch-down — before any `pointerdown` handler runs. `touch-action: none` prevents scroll and zoom but not selection initiation. The fix is one extra listener:

```js
container.addEventListener('touchstart',
  e => e.target.closest('.chain-list > li') && e.preventDefault(),
  {passive: false});
```

`preventDefault` on `touchstart` (with `passive: false` to make that legal) cancels the selection. The `pointerdown` path runs unaffected. A document-wide `html.active-chain-drag { user-select: none }` rule covers any text the pointer passes over during the drag.

## Native Form Dispatch (Shared Key)

Each chain renders as `<form name="${chainList.id}">` with two unmarked submit buttons inside (`name="check"`, `name="reshuffle"`). A single `submit` listener on the chains container dispatches both actions:

```js
const handleChainSubmit = e => {
  e.preventDefault();
  const id = e.target.name;
  const isShuffle = e.submitter.name === 'reshuffle';
  if (isShuffle) CausalChain.discard(id);
  (isShuffle ? renderChainList : markOrderResults)(CausalChain.getById(id));
};
```

The chain id is the Shared Key across all three layers (see `~/.web-xp/code-guidelines.md`):

| Layer            | Attribute   | Read via                              |
| ---------------- | ----------- | ------------------------------------- |
| Form (dispatch)  | `name`      | `e.target.name`                       |
| OL (rendering)   | `id`        | `document.getElementById(id)`         |
| Instance cache   | (map key)   | `CausalChain.#instances[id]`          |

No per-button data attributes, no `data-chain-id` carriers, no DOM walks to recover the id. The same string identifies the form for dispatch, the OL for rendering, and the instance in the cache.

The submitting button is routed through `e.submitter.name` — `"check"` or `"reshuffle"`. Native button semantics: no `onclick` handlers, no class-selector matches, no custom event detail.

Reshuffle evicts the cached instance via `CausalChain.discard(id)`; the next `getById(id)` rebuilds it with a fresh `toShuffled` order. Check runs `orderResults` (per-row comparison against `#steps`) and toggles `.correct` / `.incorrect` on each LI.
