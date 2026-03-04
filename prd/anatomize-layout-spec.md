# Anatomize This — Layout Specification

Documents the implemented layout behavior as of 2026-03-02.

---

## DOM Structure

```
.tab-section
  .anatomize-controls
    .anatomize-control-row
      .anatomize-image-selector.btn-row   (image set buttons)
      .anatomize-filter.btn-row           (All / Muscles / Landmarks)
      button.anatomize-reset
  .anatomize-body                         (flex container, layout root)
    .anatomize-info-col                   (left in two-col, below in stacked)
      .anatomize-detail                   (prompt panel, then detail panel)
    .anatomize-image-col                  (right in two-col, above in stacked)
      .anatomize-info-header
        span.anatomize-score
        .anatomize-next                   (Next button)
      .anatomize-arena                    (image + SVG overlay or hitboxes)
```

---

## Layout Modes

### Mode Selection

Two-column when **both**:
- `window.innerWidth >= 768`
- `window.innerWidth > window.innerHeight` (landscape)

Otherwise: stacked (single column).

Checked via `isTwoCol()` in JS. The CSS class `two-col` on `.anatomize-body` activates two-column rules.

### Stacked Layout (portrait / narrow)

- `.anatomize-body` is `flex-direction: column`.
- `.anatomize-image-col` has `order: 0` (image on top).
- `.anatomize-info-col` has `order: 1` (info below).
- Image is full container width, natural aspect ratio.
- Page scrolls naturally. Viewport scrollbar is expected.
- No JS sizing algorithm runs.

### Two-Column Layout (landscape / wide)

```
[ Info Panel ] [4px gap] [    Image    ]
```

- `.anatomize-body.two-col` is `flex-direction: row`, `align-items: flex-start`.
- `.anatomize-info-col` has `order: 0` (left), `flex: 0 0 auto`, `width: var(--info-w)`.
- `.anatomize-image-col` has `order: 1` (right), `flex: 1 1 0`.
- Image fills the image-col width, maintaining aspect ratio via `width: 100%; height: auto; object-fit: contain`.
- Gap between columns: `4px`.

---

## Two-Column Sizing Algorithm

### Constants

| Name | Value | Source |
|---|---|---|
| `INFO_MIN_W` | 340px | JS constant |
| `SHRINK_STEP` | 20px | JS constant |
| `MIN_H_RATIO` | 0.4 | JS constant (image floor = `availH * 0.4`) |
| `GAP` | 4px | CSS gap on `.anatomize-body.two-col` |
| `R` | `img.naturalWidth / img.naturalHeight` | Measured from loaded image |

### Priority Order

1. **No viewport scrollbar** — entire view fits in viewport.
2. **No infopanel scrollbar** — all Layer 1 content visible without internal scroll.
3. **Image as large as possible** — fills available height.

If (2) conflicts with (3), image shrinks. If (2) cannot be satisfied at minimum image size, infopanel gets `overflow-y: auto` (last resort).

### Algorithm (`computeLayout()`)

Runs once per unique `(innerWidth, innerHeight, imageId)` tuple. Skipped if inputs haven't changed.

**Setup:**

1. Remove `two-col` class and clear all CSS custom properties to measure from a clean state.
2. If `!isTwoCol()`: stop (stacked mode, no sizing needed).
3. Zero out `main` padding-bottom/right and container margin-bottom to eliminate OVERHEAD below the layout.
4. Measure `availH = window.innerHeight - body.getBoundingClientRect().top - 8`.
5. Measure `availW = body.clientWidth - GAP`.
6. Compute `imageMinH = availH * MIN_H_RATIO`.

**Initial sizing:**

7. `imageH = availH` (start at maximum).
8. `imageW = imageH * R`.
9. `infoW = availW - imageW`.
10. If `infoW < INFO_MIN_W`: set `infoW = INFO_MIN_W`, `imageW = availW - infoW`, `imageH = imageW / R`.

**Worst-case content measurement:**

11. Find the structure with the longest combined Layer 1 text content (`findWorstCaseStructure()`).
12. Render its Layer 1 panel into a hidden off-screen measurer div at width `infoW` (`buildMeasurePanel()` + `measureWorstCaseHeight()`).
13. Record `scrollH` — the measured scrollHeight.

**Shrink loop:**

14. If `scrollH <= availH`: done, no shrinking needed.
15. If `scrollH > availH`:
    - First check if shrinking can help: measure scrollH at maximum infoW (when image is at `imageMinH`). If still overflows, set `fallback = true` (skip shrink loop).
    - Otherwise, shrink `imageH` by `SHRINK_STEP` (20px) per iteration. Recompute `imageW = imageH * R`, `infoW = availW - imageW`. Clamp `infoW >= INFO_MIN_W`. Re-measure `scrollH`. Repeat until `scrollH <= availH` or `imageH <= imageMinH`.

**Fallback:**

16. If fallback is triggered (content cannot fit even at minimum image size), reset to maximum image dimensions. The infopanel will scroll internally via `overflow-y: auto` on `.anatomize-info-col`.

**Apply:**

17. Add `two-col` class to `.anatomize-body`.
18. Set CSS custom properties on `.anatomize-body`:
    - `--body-h`: `availH` (constrains body height)
    - `--image-h`: `imageH`
    - `--image-w`: `imageW`
    - `--info-w`: `infoW` (consumed by flex basis)
    - `--info-h`: `infoH` (= `availH` if scrollH > imageH, else `imageH`)
19. Set `infoCol.style.height` directly to `infoH`.

---

## Infopanel Height Behavior

- `height`: set to `infoH` by JS (either `imageH` or `availH`).
- `overflow-y: auto`: scrollbar appears only when content exceeds the set height (fallback case).
- `overflow-x: hidden`: no horizontal scroll.
- `resize: horizontal`: user can manually drag to resize info column width.
- `min-width: 200px`, `max-width: 60%`: bounds on manual resize.

When content height exceeds image height but fits in `availH`, infopanel height extends to `availH` so content is visible without scrolling.

---

## Layout Triggers

### `ResizeObserver` (primary)

A `ResizeObserver` watches `.tab-section` (the container). Fires `computeLayout()` once per frame on any size change (window resize, orientation change, sibling visibility toggle). No debounce needed — ResizeObserver coalesces.

### Image Load

`hookImageLoad()` is called after rendering the arena. If the image is already loaded (`img.complete && img.naturalWidth`), runs `computeLayout()` immediately. Otherwise, listens for the `load` event (once).

### Image Set Change

`loadImageSet()` resets `lastLayoutInputs` to `''`, forcing `computeLayout()` to re-run with the new image's aspect ratio.

### Cache Key

`computeLayout()` caches its last inputs as `"innerWidth,innerHeight,imageId"`. If unchanged, the function returns immediately without recalculating.

---

## CSS Custom Properties (Two-Column)

Set on `.anatomize-body` by JS:

| Property | Used by | Purpose |
|---|---|---|
| `--body-h` | `.anatomize-body.two-col { height }` | Constrains overall layout height |
| `--info-w` | `.anatomize-info-col { width }` | Sets infopanel width |
| `--info-h` | `.anatomize-info-col { height }` | Sets infopanel height (also set directly) |
| `--image-w` | Not consumed in CSS | Available for debugging |
| `--image-h` | Not consumed in CSS | Available for debugging |

---

## OVERHEAD Elimination

When entering two-column mode, the algorithm zeroes out bottom spacing that would cause viewport overflow:

- `main.style.paddingBottom = '0'` (normally `3rem`)
- `main.style.paddingRight = '0'`
- `container.style.marginBottom = '0'`

These are restored when exiting two-column mode (cleared by the reset at top of `computeLayout()`).

Additionally, `main` has no `max-width` when Anatomy tab is active:
```css
main:not(:has(#tab-anatomy.active)) {
  max-width: 1160px;
}
```

---

## Worst-Case Measurement

The algorithm sizes for the tallest Layer 1 content across all structures in the current image set, not the currently displayed structure. This prevents the image from resizing on every correct answer.

**`findWorstCaseStructure()`**: Iterates all structures, sums character lengths of all Layer 1 fields (label, standard, attachments, actions, movements, pri, chain). Returns the structure with the longest total.

**`buildMeasurePanel()`**: Constructs a full detail panel DOM fragment for the structure (same markup as `renderDetailPanel()` Layer 1 only).

**`measureWorstCaseHeight(infoW)`**: Creates a hidden, off-screen div (`.anatomize-measure`) at the given width, appends the measure panel, reads `scrollHeight`, removes the measurer, returns the height.

---

## Mobile Layout

When `window.matchMedia('(max-width: 600px)')` matches:

- `isMobile = true`.
- `resetSession()` renders mobile mode (`renderMobile()`) instead of blank_panels or label_hunt.
- Mobile mode shows the image, then a vertical list of buttons (`.anatomize-mobile-list`).
- No SVG overlay, no hitboxes. All interaction through button taps.
- Stacked layout. No two-column algorithm.

Mobile breakpoint is re-evaluated on media query change, triggering `resetSession()` to switch rendering mode.

---

## Debug Logging

`computeLayout()` logs after every calculation:

```
Layout: availH=N availW=N imageH=N imageW=N infoW=N infoScrollH=N fallback=B
```

A `requestAnimationFrame` callback then logs actual rendered rects:
- `[rects] docEl: { h, scrollH, innerH }` — viewport overflow detection
- `[rects] img: { top, bottom, h, w }` — rendered image dimensions
- `[rects] info: { top, bottom, h, scrollH }` — rendered infopanel dimensions

---

## Edge Cases

- **`availH <= 100`**: Layout bails out (too small to be useful).
- **No image loaded yet**: Layout bails out (needs `naturalWidth` for aspect ratio).
- **`infoW` clamped to `INFO_MIN_W`**: Image shrinks to accommodate minimum info width.
- **Manual info-col resize**: User can drag the resize handle. CSS `min-width: 200px` and `max-width: 60%` constrain. The algorithm does not re-run on manual resize — it only responds to viewport/container size changes.
