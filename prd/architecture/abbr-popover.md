# abbr-popover

Finds `<abbr>` elements with a `title` attribute, replaces `title` with `data-title`, and shows a stylized popover on hover or focus instead of the browser's default tooltip. Built on the Popover API and CSS Anchor Positioning.

## What the platform handles

| Concern                         | Handled by                                              |
| ------------------------------- | ------------------------------------------------------- |
| Show / hide visibility          | Popover API (`showPopover` / `hidePopover`)             |
| Position next to abbr           | CSS Anchor Positioning (`anchor-name` / `position-anchor`) |
| Auto-flip when out of room      | `position-try-fallbacks: flip-block`                    |
| Entry / exit fade               | CSS `transition` + `@starting-style` + `allow-discrete` |
| Close on Escape / click-outside | Popover API light-dismiss                               |
| Top-layer hold during exit      | `transition-behavior: allow-discrete`                   |
| Fade reversal on mid-fade re-show | CSS Transitions interruption rules                    |

What's left for JS:

- which abbr is currently anchored (one reference)
- assigning each actuator a unique `anchor-name` lazily on first show
- pointing the popover's `position-anchor` at the active actuator
- when to call `showPopover` / `hidePopover` (event handlers, three lines each)
- one-time static-abbr swap and feature gate

## State

`activeAbbr` (closure-scoped `let`) is the single source of truth for which actuator the popover is currently anchored to.

### Anchor binding

CSS Anchor Positioning links the popover's position to another element by name. The anchor element declares `anchor-name: --some-id` (`style.anchorName` in JS); the popover declares `position-anchor: --some-id` (`style.positionAnchor`). The browser then resolves the popover's box relative to the anchor's box.

Each actuator receives a unique `anchor-name` set inline on first show — `--abbr-anchor-0`, `--abbr-anchor-1`, etc. The value is permanent; nothing ever removes it. The popover's `position-anchor` is set inline by `showForAbbr` to the active actuator's name.

Assignment is lazy (in `showForAbbr`) rather than eager (in the init walk) because the init walk only converts `abbr[title]` → `data-title` for abbrs present at script load. Dynamic abbrs from `expandAbbr` come in later and would be missed by an eager pass. The lazy check is one cheap conditional per show and covers both sources without coupling.

## Event flow

- **Show**: `focusin` and `mouseover` are two events delegated on `main` — both bubble from the actuator, both gated by `shouldShow`, both dispatched to `showForAbbr`. `shouldShow` returns true when the target is an abbr **and** either it differs from the active actuator **or** the popover is not currently showing — the second clause lets a fresh hover re-open the popover for the same actuator after it has been hidden.

  ```js
  const shouldShow = target =>
      target.matches(ABBR_SELECTOR)
      && (target !== activeAbbr || !popover.matches(':popover-open'));
  ```
- **Hide on abbr exit**: `hidePopover` delegated on `main` for both `focusout` and `mouseout` — one definition, two bubbling events. Close unless `relatedTarget` is the popover. For mouseout, that exemption lets the cursor cross to the popover to select text. For Tab-out, `relatedTarget` is never the popover today (its only child is a text node, not focusable); the same check will do real work if focusable content is ever added to the popover.
- **Hide on popover exit**: `mouseleave` on the popover itself — close unless `relatedTarget` is the active abbr. Bound directly because `mouseleave` doesn't bubble; delegation from `main` isn't an option.

## Title attribute handling

The browser renders `[title]` as a tooltip after its own delay. To make the custom popover the sole renderer of the expansion text, `expandAbbr` emits `<abbr tabindex="0" data-title="…">` — no `title` ever. A one-shot init walk converts the few static `<abbr title="…">` in `index.html` (decoder controls) to `data-title`. After init, no abbr in the document carries `title`.

## Exit fade without flash

The popover's `position-anchor` must resolve to a real, still-named element for the full duration of the exit fade. If the anchor binding were broken at the start of the fade — by removing a class that set `anchor-name`, say — `position-anchor` would resolve to nothing and `position-area` would have nothing to compute against. The popover would render wherever the cascade leaves it without that constraint (elsewhere on the viewport), until the transition concludes, flipping to `display: none`.

The design avoids the problem at its root: `anchor-name` is permanent on each actuator, set once and never cleared. Hide cannot invalidate it. The popover fades out anchored to its real element, then `display` and `overlay` flip to `none` at the end of the transition via `allow-discrete`.

## State Mismatch

The Popover API and CSS Transitions operate on different clocks.

### The Logical Engine (Popover API)

`hidePopover()` is synchronous and binary: it switches the API state (open/closed) instantaneously. `:popover-open` reflects the new state the moment the call returns. JS reads the pseudo-class directly via `popover.matches(':popover-open')`; the platform updates it on every close path (programmatic, Escape, click-outside light-dismiss), so a JS mirror would risk drift.

### The Rendering Engine (CSS Transitions)

Visual updates are asynchronous. `transition-behavior: allow-discrete` on `display` and `overlay` delays those discrete property flips so `opacity` and `transform` transitions can run.

When `hidePopover()` is called, the popover's state is `hidden` but visually it's still mid-transition. This "hidden but still visible" state presents a challenge: what do we do when `showPopover()` is called before the transition completes?

### The Pro UI Solution

If the request is for the same actuator that's currently hiding, show it from where it's at in the transition — reverse the fade. Otherwise — a different actuator — hide the current popover immediately and show the new popover fresh, with a full entry transition from 0.

### Reconciling State: Logical vs Rendering

The approach uses state management of the platform itself, encapsulating the state challenge into two predicates that gate the work inside `showForAbbr`:

```js
// isOpen follows the Popover API state — false through the entire
// exit fade. isReplacingMidFade catches a new actuator arriving
// in that logically-closed, visually-still-fading window.
const isOpen = popover.matches(':popover-open');
const isReplacingMidFade = !isOpen && abbr !== activeAbbr;
```

Upstream, `shouldShow` filters out same-actuator-while-open before `showForAbbr` is ever called. The four cases that reach it:

| Actuator  | Popover state | Behavior                                                          |
| --------- | ------------- | ----------------------------------------------------------------- |
| same      | mid-fade      | `showPopover` reverses the in-flight opacity to 1.                |
| same      | fully closed  | `showPopover` plays the `@starting-style` entry animation.        |
| different | mid-fade      | `.finish()`, then `showPopover` opens at the new actuator from 0. |
| different | fully closed  | `showPopover` opens at the new actuator from 0.                   |

The full implementation:

```js
const showForAbbr = abbr => {
  // isOpen follows the Popover API state — false through the entire
  // exit fade. isReplacingMidFade catches a new actuator arriving
  // in that logically-closed, visually-still-fading window.
  const isOpen = popover.matches(':popover-open');
  const isReplacingMidFade = !isOpen && abbr !== activeAbbr;

  if (isReplacingMidFade) {
    popover.getAnimations().forEach(a => a.finish());
  }
  if (!abbr.style.anchorName) {
    abbr.style.anchorName = `--abbr-anchor-${anchorCount++}`;
  }
  activeAbbr = abbr;
  popover.style.positionAnchor = abbr.style.anchorName;
  popover.textContent = abbr.dataset.title;
  if (!isOpen) popover.showPopover();
};
```

## Selectable expansion text

Tooltips that hide the moment the cursor leaves the actuator can't be read past their first frame, let alone selected. As soon as the cursor crosses from the abbr toward the popover, `mouseout` fires on the abbr with `relatedTarget` set to the popover — a naive handler closes the popover before the cursor arrives.

Each hide listener checks the destination:

```js
main.addEventListener('mouseout', ({target, relatedTarget}) =>
    target === activeAbbr
    && relatedTarget !== popover
    && popover.hidePopover());

popover.addEventListener('mouseleave', ({relatedTarget}) =>
    relatedTarget !== activeAbbr && popover.hidePopover());
```

The cursor can reach the popover, dwell on it, and select the expansion text. Only departing both the abbr and the popover closes it.

No bridge element is needed: `position-area: block-start` places the popover flush against the abbr — no gap to land in mid-transit. A subpixel gap in another browser would break this. We don't implement a workaround currently; if such a gap appears, the standard fix is an anchor-sized `::after` bridge spanning it.

## Graceful degradation

JS gates the module on `typeof document.body.showPopover === 'function'`. Anchor positioning and `@starting-style` are layered via `@supports` — browsers without them get a centered, instantly-shown popover and no entry animation, but no broken layout.

Where anchor positioning isn't supported (Firefox at time of writing), the JS assignments `style.anchorName = …` and `style.positionAnchor = …` are silent no-ops. No JS feature gate is required: the assignments run, the styles don't take effect, and the `@supports` block handles the visual fallback.

The `[title]`-to-`data-title` migration runs unconditionally; browsers without Popover API show no tooltip at all.
