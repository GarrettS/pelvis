# Scroll-basis coherence probe

Settles one question empirically before it reaches the drag article: during async
(compositor) scrolling, do `getBoundingClientRect`, `window.scrollY`, and
`PointerEvent.pageY` read one shared scroll basis, or can they diverge within a single
main-thread sample?

## Why it matters

The sortable-list drag freezes each drop boundary once at pickup as a page coordinate
(`gBCR.top + scrollY`) and compares the live pointer against it. The claim worth testing
is that `gBCR` carries a *staler* scroll term than `window.scrollY` or `pageY`, so the
frozen boundary decouples from the live pointer and the target selection jumps.

Two residuals expose any such decoupling:

- **drift** — `ref.getBoundingClientRect().top + window.scrollY − docTop0`. `gBCR.top`
  already has a scroll term subtracted out; adding `scrollY` back cancels it to the box's
  document-absolute top, which is constant. Nonzero drift means `gBCR`'s scroll term is
  not `window.scrollY` — the exact "stale negative scroll" hypothesis, isolated from the
  pointer.
- **residual** — `e.pageY − e.clientY − window.scrollY`. `pageY` is `clientY` plus the
  scroll offset; a nonzero value means the event's page coordinate was stamped against a
  different scroll than `window.scrollY`.

Both read zero (within subpixel rounding, `EPS = 1`) when every value shares the
main-thread snapshot.

## Run it

Open `scroll-basis-coherence.html` on a real device — iOS Safari first, since async
scroll and rAF throttling differ most there. Then:

1. Let layout settle, tap **set baseline**.
2. Fling the page hard, repeatedly, top to bottom — the larger the per-frame scroll
   delta, the larger any cross-thread lag would read.
3. Drag the reference box with one finger while the page is still moving, to sample the
   pointer leg under live scroll.
4. Watch the pinned readout for red **drift** / **residual**, and the log for `DRIFT!` /
   `RESIDUAL!` lines. The maxima persist until **clear**.

No pinch-zoom during a run — a visual-viewport offset shifts the coordinate frames and is
out of scope here.

## Reading the result

- **`max|drift|` and `max|residual|` stay subpixel** through every fling → the three reads
  share one basis. The "cross-thread trap" does not occur, and the article describes the
  reconciliation (boundaries frozen as scroll-invariant document constants; avatar offset
  a same-basis `pageY` delta; one scroll authority during the drag).
- **Either spikes to the order of the scroll delta** → the divergence is real on this
  engine. The article may then document it — but the fix is to drive the hot path from
  `clientY + scrollY` (as the autoscroll re-feed already does) rather than `e.pageY`, not
  to restate the boundaries in viewport space.

Record the device, browser version, and observed maxima alongside the result.
