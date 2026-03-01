# CC Addendum: Image Mapping Fix + Anatomize This Corrections

## Priority: P0 — do this before any other work.

---

## Problem 1: Wrong Image Assignments in index.html

The current Anatomy tab maps every image to the wrong subview. Here is the **correct** mapping. Fix `index.html` accordingly.

### Current (WRONG)

```html
<img src="img/pelvis-angle-r-side.png" id="img-lateral" />  <!-- WRONG: this is Netter anterior, not lateral -->
<img src="img/pelvis-m-front.png" id="img-anterior" />       <!-- WRONG: this is Veritas, should be dropped -->
<img src="img/hip-r.png" id="img-hip" />                     <!-- WRONG: this is the 33-label lateral hip -->
```

### Corrected Assignments

| Subview label | Correct `src` | Content description |
|---|---|---|
| Muscle Attachments (Lateral) | `img/hip-r.png` | Right hemipelvis lateral view, 33+ printed labels (muscles black, landmarks red italic) |
| Bony Landmarks (Anterior) | `img/pelvis-angle-r-side.png` | Netter anterior pelvis, quarter-turn left, bony landmark labels |
| L AIC Chain | `img/left-aic` (check extension — may be `.png` or `.webp`) | Dual anterior/posterior L AIC chain skeleton |
| Hip Overview | **REMOVE THIS SUBVIEW** | `pelvis-m-front.png` is dropped. Delete the subview tab and its container. |

### Fix

```html
<!-- Lateral — hip-r.png -->
<div id="view-lateral" class="hotspot-container" style="display:block;">
  <img src="img/hip-r.png" alt="Right hemipelvis lateral view with muscle attachment labels" id="img-lateral" />
</div>

<!-- Anterior — pelvis-angle-r-side.png -->
<div id="view-anterior" class="hotspot-container" style="display:none;">
  <img src="img/pelvis-angle-r-side.png" alt="Anterior pelvis with bony landmark labels" id="img-anterior" />
</div>
```

Remove `view-hip` entirely. Remove its tab button from `#anatomy-subview-tabs`.

---

## Problem 2: Anatomize This — Broken Arrow/Panel Positions

Arrows and panels are pointing to wrong locations on the pelvic outlet image. The `panelBox` and `arrowTo` coordinates are inaccurate.

### Root cause

The percentage-based coordinates were authored without verifying them against the actual rendered image. Coordinates must be re-mapped by examining `img/PRI-1-Pelvic-Outlet2` (check extension — `.jpg` or `.png`).

### Fix instructions

1. Open `img/PRI-1-Pelvic-Outlet2` and identify each structure's location visually.
2. Use the **labeled** version (`img/PRI-1-Pelvic-Outlet.jpg`) as reference — it has leader lines showing where each structure is.
3. Re-author every `arrowTo: { x, y }` coordinate so the arrow tip lands on the correct anatomical structure.
4. Re-author every `panelBox: { x, y, w, h }` coordinate so panels don't overlap each other or the image content.
5. Re-trace every `polygon` array so muscle boundary overlays match the actual illustration boundaries.

### Panel placement rules (from PRD)

- Panels go on the nearest available side (left, right, top, bottom) of the image relative to the structure they label.
- No panel-to-panel overlap.
- Arrows connect panel edge to structure location — arrow tip = `arrowTo`, arrow start = nearest edge of `panelBox`.

### Verification

After fixing coordinates:
- Every arrow must visually point to the correct anatomical structure.
- No arrows should cross other panels.
- No panels should overlap.
- Compare against the labeled image (`PRI-1-Pelvic-Outlet.jpg`) to confirm accuracy.

---

## Problem 3: Image File Extensions

Some files in `img/` may be missing extensions. Verify:

```bash
ls -la img/
```

If `left-aic` has no extension, check the actual file type:

```bash
file img/left-aic
```

Add the correct extension and update the `src` attribute in `index.html` to match.

Same for `PRI-1-Pelvic-Outlet2` — confirm whether it's `.jpg` or `.png`.

---

## Verified Image Manifest

Complete `img/` directory with purpose assignments:

| Filename | Content | Used in |
|---|---|---|
| `hip-r.png` | Right hemipelvis lateral, 33+ labels | Anatomy > Muscle Attachments (Lateral) subview |
| `pelvis-angle-r-side.png` | Netter anterior pelvis, bony landmarks | Anatomy > Bony Landmarks (Anterior) subview |
| `left-aic` (check ext) | Dual anterior/posterior L AIC chain | Anatomy > L AIC Chain subview |
| `PRI-1-Pelvic-Outlet2` (check ext) | Clean pelvic outlet, no labels | Anatomize This > blank_panels game image |
| `PRI-1-Pelvic-Outlet.jpg` | Labeled pelvic outlet | Reference for authoring Anatomize This coordinates |
| `PRI-1-Pelvic-Inlet.png` | Pelvic inlet illustration | Not currently used in game |
| `PRI-1-glute-med--glute-max.png` | Glute med/max posterior view | Not currently used in game |
| `pelvis-m-front.png` | Veritas anterior hip overview | **DROPPED — not used anywhere** |

---

## Execution Order

Each step below is one change. After **every** step, follow the "After Every Change" rules from `claude.md`:

- Remove dead code: orphaned selectors, unreferenced IDs, stale variable references.
- Update all selectors and references affected by structural changes.
- Run verification commands to confirm no regressions. Do not finish with failing checks.
- Do not write transformation scripts to batch-edit files. Make direct edits, one change at a time, verifying each.

### Steps

1. Fix file extensions (Problem 3). Verify files load.
2. Fix image `src` assignments in `index.html` (Problem 1). Verify each image renders in the correct subview.
3. Remove Hip Overview subview — delete the tab button, its container `div#view-hip`, and any JS references to it (`'hip'` in view arrays, `switchView`, etc.). Remove orphaned CSS selectors targeting `#view-hip` or `#img-hip`.
4. Fix Anatomize This `arrowTo` coordinates (Problem 2). Verify every arrow tip lands on the correct structure.
5. Fix Anatomize This `panelBox` coordinates. Verify no panel overlap.
6. Fix Anatomize This `polygon` arrays. Verify overlays match muscle boundaries.
7. Final verification: run full testing checklist from CC-BUILD-SPEC.md. No console errors. No dead code. Commit.
