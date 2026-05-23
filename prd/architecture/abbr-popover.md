# abbr-popover

Expands PRI abbreviations (`L AIC`, `IsP IR/ER`, `B PEC`) to their full terms on hover or focus. Built on the Popover API and CSS Anchor Positioning. The native `[title]` tooltip is never shown.

## What the platform handles

| Concern                         | Handled by                                              |
| ------------------------------- | ------------------------------------------------------- |
| Show / hide visibility          | Popover API (`showPopover` / `hidePopover`)             |
| Position next to abbr           | CSS Anchor Positioning (`position-anchor`)              |
| Auto-flip when out of room      | `position-try-fallbacks: flip-block`                    |
| Entry / exit fade               | CSS `transition` + `@starting-style` + `allow-discrete` |
| Close on Escape / click-outside | Popover API light-dismiss                               |
| Top-layer hold during exit      | `transition-behavior: allow-discrete`                   |

What's left for JS:

- which abbr is currently anchored (one reference)
- when to call `showPopover` / `hidePopover` (event handlers, three lines each)
- one-time static-abbr swap and feature gate

The full module is ~50 lines.

## State

`activeAbbr` (closure-scoped `let`) is the single source of truth. A `.abbr-anchored` class follows the reference; CSS reads the class to apply `anchor-name: --abbr-active`. The popover's open state follows the class. All three mutate in one place — `showForAbbr`.

Active Object pattern: nothing scans the DOM to find "which one is active" because the reference is already in scope. No `querySelector('.abbr-anchored')`, no `classList.contains` checks, no `closest()` walks.

## Event flow

- **Show**: `focusin` / `mouseover` on `main`. `tabindex="0"` collapses keyboard navigation and mobile tap into the same trigger.
- **Hide on abbr exit**: `hidePopover` delegated on `main` for both `focusout` and `mouseout` — one definition, two bubbling events. Close unless `relatedTarget` is the popover. For mouseout, that exemption lets the cursor cross to the popover to select text. For Tab-out, `relatedTarget !== popover` is always true (the popover's only child is a text node) — a redundant (DRY) check ready for Tab-into-popover if focusable content is added.
- **Hide on popover exit**: `mouseleave` on the popover itself — close unless `relatedTarget` is the active abbr. Bound directly because `mouseleave` doesn't bubble; delegation from `main` isn't an option.
- **Cleanup**: the popover's `toggle` event (`newState === 'closed'`). Every close path — programmatic hide, Escape, click-outside light-dismiss — converges here. Hide handlers never touch state; the `toggle` listener owns it.

## Title attribute handling

The browser renders `[title]` as a tooltip after its own delay. To make the custom popover the sole renderer of the expansion text, `expandAbbr` emits `<abbr tabindex="0" data-title="…">` — no `title` ever. A one-shot init walk converts the few static `<abbr title="…">` in `index.html` (decoder controls) to `data-title`. After init, no abbr in the document carries `title`.

## The hard problems

### Toggle event coalescing

The Popover spec coalesces a rapid open→close→open into a single `toggle` event with `newState: 'open'`. The intermediate `'closed'` notification never fires. Tabbing between abbrs hits this every time — listener-driven cleanup for the previous abbr never runs, and the previous abbr's `.abbr-anchored` class lingers.

`showForAbbr` clears the previous anchor up-front before claiming the slot. The `toggle` listener handles only non-show closures.

### Selectable expansion text

Tooltips that hide the moment the cursor leaves the trigger can't be read past their first frame, let alone selected. As soon as the cursor crosses from the abbr toward the popover, `mouseout` fires on the abbr with `relatedTarget` set to the popover — a naive handler closes the popover before the cursor arrives.

Each hide listener checks the destination:

```js
main.addEventListener('mouseout', e =>
    e.target === activeAbbr
    && e.relatedTarget !== popover
    && popover.hidePopover());

popover.addEventListener('mouseleave', e =>
    e.relatedTarget !== activeAbbr && popover.hidePopover());
```

Heading to the bridge partner suppresses the hide. The cursor can reach the popover, dwell on it, and select the expansion text. Only departing both surfaces closes the popover.

### Anchor flip

`position-try-fallbacks: flip-block` flips the popover below the abbr when there's no room above. A geometric bridge pointing in one direction breaks on flip — and even with the relatedTarget predicate, any pixel-level gap between the two surfaces is a place the cursor can land mid-transit, fire `mouseout` with the wrong `relatedTarget`, and trigger close.

The `::after` pseudo-element is vertically centered on the popover:

```css
top: 50%;
height: calc(100% + 1.2em);
transform: translateY(-50%);
```

— which extends it .6em past both edges so whichever side faces the abbr always reaches it. No JS direction detection.

### Exit animation in the top layer

`hidePopover()` removes the popover from the top layer synchronously. Keyframe-based exit animations never play — the element is gone by the next frame.

`transition-behavior: allow-discrete` on `display` and `overlay`, combined with `transition` on `opacity` and `transform`, holds the popover in the top layer until the visual transition completes. The exit fade plays naturally.

## What `showForAbbr` looks like

```js
const showForAbbr = (abbr) => {
  activeAbbr?.classList.remove('abbr-anchored');
  activeAbbr = abbr;
  abbr.classList.add('abbr-anchored');
  popover.textContent = abbr.dataset.title;
  if (!popover.matches(':popover-open')) popover.showPopover();
};
```

Five lines. Each step is one platform call.

## Older browsers

JS gates the module on `typeof document.body.showPopover === 'function'`. Anchor positioning and `@starting-style` are layered via `@supports` — browsers without them get a centered, instantly-shown popover and no entry animation, but no broken layout. The `[title]`-to-`data-title` migration runs unconditionally; browsers without Popover API show no tooltip at all.
