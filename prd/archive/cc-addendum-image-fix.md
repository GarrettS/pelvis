# CC Addendum: Image Mapping Fix + Anatomize This Corrections

**Status: Completed.** This addendum documents the image corrections applied during initial build. Retained for historical context.

---

## Problem 1: Wrong Image Assignments in index.html

The original Anatomy tab mapped every image to the wrong subview. The corrected mapping was applied.

### Corrected Assignments

| Subview label | Correct `src` | Content description |
|---|---|---|
| Bony Landmarks (Anterior) | `img/pelvis-angle-r-side.png` | Netter anterior pelvis, quarter-turn left, bony landmark labels |
| L AIC Chain | `img/left-aic.png` | Dual anterior/posterior L AIC chain skeleton |

Two images were removed from the project as unused:
- `img/hip-r.png` — right hemipelvis lateral view. Was intended for a "Muscle Attachments (Lateral)" subview that was never built.
- `img/pelvis-m-front.png` — Veritas anterior hip overview. Dropped per original review.

Future anatomical images can be added to `img/` as new subviews are developed. When adding images, update `sw.js` precache and the image manifest below in the same commit.

---

## Problem 2: Anatomize This — Broken Arrow/Panel Positions

Arrows and panels were pointing to wrong locations on the pelvic outlet image. Coordinates were re-mapped using the coord-picker tools (see `prd/coord-picker-workflow.md`).

### Panel placement rules (from PRD)

- Panels go on the nearest available side (left, right, top, bottom) of the image relative to the structure they label.
- No panel-to-panel overlap.
- Arrows connect panel edge to structure location — arrow tip = `arrowTo`, arrow start = nearest edge of `panelBox`.

---

## Problem 3: Image File Extensions

Resolved. All files in `img/` have correct extensions.

---

## Image Manifest

Complete `img/` directory with purpose assignments:

| Filename | Content | Used in |
|---|---|---|
| `pelvis-angle-r-side.png` | Netter anterior pelvis, bony landmarks | Anatomy > Bony Landmarks (Anterior) subview; coord-picker tool |
| `left-aic.png` | Dual anterior/posterior L AIC chain | Anatomy > L AIC Chain subview |
| `PRI-1-Pelvic-Outlet2.jpg` | Clean pelvic outlet, no labels | Anatomize This > blank_panels game image |
| `PRI-1-Pelvic-Outlet.jpg` | Labeled pelvic outlet (inferior view) | Anatomize This game image |
| `PRI-1-Pelvic-Outlet-flipped.jpg` | Labeled pelvic outlet (flipped) | Anatomize This game image |
| `PRI-1-Pelvic-Inlet.png` | Pelvic inlet illustration | Anatomize This game image |
| `PRI-1-glute-med--glute-max.png` | Glute med/max posterior view | Anatomize This game image |
