# Pointer-capture probe — test protocol

Tests for `pointer-capture-probe.html`. Each test isolates **one** question and maps every
possible result to a conclusion. Open the probe in the target browser, set the checkboxes,
perform the gesture exactly, **clear** between tests, and read the tagged lines.

## Field legend
- `[EL]` — the captured box's own listener fired (the event reached the element).
- `[DOC]` — the document listener fired (always, via capture/bubble). `[DOC]` with no `[EL]`
  for the same event = element-level delivery stopped, document still receives it.
- `in=Y/N` — pointer inside / outside the window.
- `btn` — buttons bitmask: `1` = a button is down, `0` = no button down (released).
- `hasCap=Y/N` — the box still holds pointer capture at that event.
- `tgt` — the event target.
- Tags: `*** GPC ***` gotpointercapture, `*** LPC ***` lostpointercapture
  (with `pointerup-before-lpc=Y/N`), `>>> AFTER-LPC` = first same-pointer event after capture loss.

Paste the lines from the `setPointerCapture` row onward.

---

## Mouse

### Does capture deliver `pointermove` while the cursor is outside the window?
Decides whether edge-scroll (which needs input while the cursor is below the window) is possible at all.
- **Setup:** setPointerCapture ON.
- **Gesture:** press the box, hold, drag the cursor fully outside the window, keep holding.
- **Read:** `pointermove` lines while `in=N`.
- **Implies:**
  - `pointermove btn=1 in=N hasCap=Y` present → capture delivers off-window → **edge-scroll works, and only because of capture.**
  - No `pointermove` while `in=N` (events stop at the edge) → **capture does not help off-window; edge-scroll cannot work.**
- **Result:** off-window moves fire (`btn=1 in=N hasCap=Y tgt=DIV#box [EL+DOC]`). Capture delivers. ✓

### Is the release `pointerup` a genuine button-up, or synthesized by capture loss?
The load-bearing one: decides whether commit-on-`pointerup` is safe.
- **Setup:** setPointerCapture ON.
- **Gesture:** press the box, drag outside, and **keep holding — do not release.**
- **Read:** any `pointerup` that appears while you are still holding (before you let go).
- **Implies:**
  - A `pointerup` appears while `btn=1` / before you release → it is **synthesized on capture loss** → committing on it drops the item the instant capture is lost = **premature-drop bug; commit-on-`pointerup` is unsafe.**
  - No `pointerup` until you actually release (`btn` becomes `0`) → it is a **genuine release** → **commit-on-`pointerup` is safe.**
- **Result:** no `pointerup` while holding; it appears only after release (`btn=0`). Genuine release. **Safe.** ✓

### On a release *outside* the window, where does the `pointerup` land, and in what order vs lostpointercapture?
Decides which listener binding catches the release.
- **Setup:** setPointerCapture ON.
- **Gesture:** press the box, drag outside, **release outside.**
- **Read:** the `pointerup` line (`tgt`, `[EL]`/`[DOC]`) and the `*** LPC ***` line (`pointerup-before-lpc`).
- **Implies (two valid outcomes; both must commit):**
  - `pointerup tgt=DIV#box [EL+DOC]` then `*** LPC *** (pointerup-before-lpc=Y)` → capture held; spec-normal order; the box got the `pointerup`, and it also bubbles to document → **commit.**
  - `*** LPC *** (pointerup-before-lpc=N)` then `pointerup tgt=HTML [DOC only]` → capture lost first; `pointerup` displaced to the document; the box never sees it → **commit only via the document listener.**
  - Both fire a `document` + `pointerId` listener → **commit-on-document-`pointerup` is order-independent.** An element-only listener catches the first but **misses the second.**
- **Result:** both observed — capture-held (`pointerup` on box) and capture-lost (`pointerup` on `HTML`). Both commit. ✓

### Does capture ever drop *mid-drag* while the button is still down?
Decides whether lostpointercapture with the button down must be treated as keep-tracking, not as an end.
- **Setup:** setPointerCapture ON.
- **Gesture:** press the box and drag in and out of the window **repeatedly, without releasing.**
- **Read:** any `*** LPC ***` line with `btn=1`.
- **Implies:**
  - `*** LPC *** btn=1` appears mid-drag → capture lost while holding → the drag must **keep tracking** (continue via the document stream), not end.
  - No mid-drag `*** LPC ***` across many excursions → mid-drag revocation is **rare/hard to trigger**; capture is stable across out-and-back.
- **Result:** not triggered despite repeated excursions. Revocation is rare. — *log it if `*** LPC *** btn=1` ever appears.*

### Can capture be restored after it is lost?
Decides whether a re-grab-and-continue recovery exists.
- **Setup:** setPointerCapture ON, **recapture on LPC ON.**
- **Gesture:** press the box, drag outside, release (to fire lostpointercapture).
- **Read:** the `recapture attempt -> hasCap=?` line.
- **Implies:**
  - `hasCap=Y` → capture can be re-grabbed → a re-acquire recovery is possible.
  - `hasCap=N` → **capture cannot be restored; recapture is a dead end.**
- **Result:** `hasCap=N`. Dead end. ✓

### Can the release `pointerup` be dropped entirely? (the GarrettS/pelvis#29 strand)
Decides whether a non-pointer fallback is actually needed.
- **Setup:** setPointerCapture ON.
- **Gesture:** drag outside and release outside, **repeatedly** — it is intermittent.
- **Read:** whether any single release produces **no `pointerup` at all** (none on the box, none on the document, after `btn` goes `0`).
- **Implies:**
  - Every release yields a `pointerup` (on box or `HTML`) → **not reproduced**; commit-on-`pointerup` always fires.
  - A release yields **no `pointerup` anywhere** → **reproduced**: the drag strands. For that case, check whether a `>>> AFTER-LPC pointermove btn=0` fired (the mouse-only `buttons===0` backstop) and whether `window.blur` fired (a fallback candidate).
- **Result:** not reproduced so far; rare tail. **Open.**

---

## Touch (touch device / finger)

### What is `btn` during a finger drag, and when does lostpointercapture fire?
Decides whether the recovery gate must exclude touch.
- **Setup:** setPointerCapture ON.
- **Gesture:** press the box with a finger, drag, lift.
- **Read:** `btn` on `touch` `pointermove`/`pointerup`; the `*** LPC ***` line.
- **Implies:**
  - `btn=0` on every finger `pointermove` → **a `buttons===0` test cannot tell dragging from release on touch** → the recovery gate MUST exclude touch (`pointerType !== 'touch'`).
  - `btn=1` while the finger is down → touch is buttons-bearing → the gate could include touch. (Confirm which.)

### Can a touch pointer leave the window?
Decides whether the off-window strand applies to touch at all.
- **Setup:** touch device.
- **Gesture:** finger-drag toward and off the screen edge.
- **Read:** any `in=N` on a `touch` pointer event.
- **Implies:**
  - No `in=N` for touch → a finger cannot leave the viewport → **the off-window/strand path does not apply to touch; a mouse-only recovery is sufficient.**
  - `in=N` occurs for touch → touch can go off-window → the recovery must consider touch too.

---

## Pen (stylus, if available)

### Does pen `btn` behave like a mouse?
Decides whether the recovery gate is `=== 'mouse'` or `!== 'touch'`.
- **Setup:** setPointerCapture ON.
- **Gesture:** pen-press the box, drag, lift.
- **Read:** `btn` while the tip is down vs lifted.
- **Implies:**
  - `btn=1` down, `btn=0` up → pen is buttons-bearing like mouse → the recovery gate should be **`pointerType !== 'touch'`** (include pen).
  - `btn=0` throughout → pen behaves like touch → the gate stays **`=== 'mouse'`** (exclude pen).
