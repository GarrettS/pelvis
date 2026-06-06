# abbr-popover

[Source: `abbr-popover.js`](../../scripts/abbr-popover.js)

Finds `<abbr>` elements with a `title` attribute, replaces `title` with `data-title` (after capability gate), and shows a CSS-styled popover on hover or focus, replacing the browser's default tooltip. Built on the Popover API and CSS Anchor Positioning using Active Object Pattern.

## What the Platform Handles

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
- when to call `showPopover` / `hidePopover` event handlers (state management)
- one-time static-abbr swap and feature gate

## State

Module-scoped `activeAbbr`, initially null, is the reference for the current actuator for the popover (Active Object Pattern).

### Anchor Binding

CSS Anchor Positioning links the popover's position to another element by name. The anchor element declares `anchor-name: --some-id` (`style.anchorName` in JS); the popover declares `position-anchor: --some-id` (`style.positionAnchor`). The browser then resolves the popover's box relative to the anchor's box.

Each actuator receives a unique `anchor-name` set inline on first show — `--abbr-anchor-0`, `--abbr-anchor-1`, etc. The value is permanent; nothing ever removes it. The popover's `position-anchor` is set inline by `showForAbbr` to the active actuator's name.

Assignment is lazy (in `showForAbbr`) rather than eager (in the init walk) because the init walk only converts `abbr[title]` → `data-title` for abbrs present at script load.

The reason for this is dynamic content: abbrs inserted after document load would be missed by an eager pass. The lazy check is `!abbr.style.anchorName` covering both paths.

## Event Flow

- **Show**: Delegated `focusin` and `mouseover` handlers on `main` dispatch to `showForAbbr`, gated by `shouldShow`. Function `shouldShow` returns true when the target is an abbr **and** either it differs from the active actuator **or** the popover is not currently showing — the second clause re-opens the popover when the cursor re-enters the actuator for which the popover was hidden.

  ```js
  const shouldShow = target =>
      target.matches(ABBR_SELECTOR)
      && (target !== activeAbbr || !popover.matches(':popover-open'));
  ```
- **Hide on abbr exit**: `hidePopover` delegated on `main` for both `focusout` and `mouseout` — one definition, two bubbling events. Close unless `relatedTarget` is the popover. For mouseout, that exemption lets the cursor cross to the popover to select text. For Tab-out, `relatedTarget` is never the popover today (its only child is a text node, not focusable); this check will be needed if focusable content is ever added to the popover.
- **Hide on popover exit**: `mouseleave` on the popover itself — close unless `relatedTarget` is the active abbr. Bound directly because `mouseleave` doesn't bubble; delegation from `main` isn't an option.

## Title Attribute Handling

Browsers render `[title]` as a tooltip after some delay. When the capability gate passes, a one-shot init walk swaps `<abbr title="…">` to `data-title`, eliminating race conditions where the browser might show its tooltip before this script runs.

## Exit Fade Without Flash

The popover's `position-anchor` must resolve to a real, still-named element for the full duration of the exit fade. If the anchor binding were broken at the start of the fade — by removing a class that set `anchor-name`, say — `position-anchor` would resolve to nothing and `position-area` would have nothing to compute against. The popover would render wherever the cascade leaves it without that constraint (elsewhere on the viewport), until the transition concludes, flipping to `display: none`.

`anchor-name` is permanent on each actuator, set once and never cleared. The popover fades out anchored to its `abbr`, then `display` and `overlay` flip to `none` at the end of the transition via `allow-discrete`.

## State Mismatch

The Popover API and CSS Transitions define the state of the element differently.

### The Logical Engine (Popover API)

`hidePopover()` is synchronous and binary. It switches the API state (open/closed) instantaneously, and `:popover-open` reflects the new state the moment that call returns. JS reads the pseudo-class via `popover.matches(':popover-open')`; the platform updates it on every close path (programmatic, Escape, click-outside light-dismiss), so a JS mirror would risk drift.

### The Rendering Engine (CSS Transitions)

Visual updates are asynchronous. `transition-behavior: allow-discrete` on `display` and `overlay` delays those discrete property flips so `opacity` and `transform` transitions can run.

When `hidePopover()` is called, the popover's state is hidden, and `popover.matches(':popover-open')` is `false`, but visually it's still mid-transition. This "hidden-but-still-visible" state presents a challenging paradox: after `hidePopover()` or `showPopover()` is called, before the transition completes, the popover is either hidden-but-shown (`:popover-open` is `false`; CSS not fully hidden) or shown-but-not-fully-transitioned to its final shown state (`:popover-open` is `true`; CSS still entering). So what to do when `showPopover()` is called, while it's transitioning?

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

### No Bridge Element

CSS `position-area: block-start` places the popover pixel-flush with the abbr. If a subpixel gap appears in another browser, ~1px `::after` content can provide a bridge for the cursor.

```css
#abbr-popover::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  inset-block: -1px;
  z-index: -1;
}
```

## Graceful Degradation

JS gates the module on `typeof document.body.showPopover === 'function'`. Anchor positioning and `@starting-style` are layered via `@supports` — browsers without them get a centered, instantly-shown popover and no entry animation, but no broken layout.

Where anchor positioning isn't supported (Firefox at time of writing), the JS assignments `style.anchorName = …` and `style.positionAnchor = …` are silent no-ops. No JS feature gate is required: the assignments run, the styles don't take effect, and the `@supports` block handles the visual fallback.

Browsers without Popover API are gated, and get the default `<abbr title=...`.

```js
if (typeof document.body.showPopover !== 'function') return;
```
