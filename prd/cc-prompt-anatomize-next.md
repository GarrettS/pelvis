# CC Prompt: Anatomize This — Next Iteration

Reference: `prd/anatomize-this-prd-v2.md` for all specs. `Handout 1 — Anatomy Families by Color` (page 1) is the authoritative source for color assignments.

---

## 1. Color Family Corrections

PRI color families are **side-specific** corrective assignments for the L AIC pattern. They encode which muscle on which side is a treatment target. A muscle on the opposite side is not automatically the same color — if Handout 1 doesn't list it, it gets `--pri-neutral`.

### Audit all structures against Handout 1 page 1

Handout 1 assignments (complete list):

| Color | Family | Muscles |
|---|---|---|
| Brown | Sagittal | **R** Rectus Femoris (inlet), **R** Sartorius (inlet), **L** Hamstring (outlet), **L** Pubococcygeus (outlet), **L** Puborectalis (outlet) |
| Red | Frontal Adduction | **L** Iliacus (inlet) |
| Green | Frontal Abduction | **L** Obturator Internus (outlet), **L** Iliococcygeus (outlet) |
| Orange | Transverse | **L** Gluteus Medius (inlet) |
| Violet | Internal Rotation | **R** Gluteus Maximus (inlet & outlet), **R** Piriformis (outlet), **R** Coccygeus (outlet) |
| Yellow | Integration | **L** Internal Obliques (inlet), **L** Transverse Abdominis (inlet), **L** Arcuate Tendon (outlet), **L** Anococcygeal Ligament (outlet) |

Any structure not on this list gets `--pri-neutral`. This includes:

- **L** Coccygeus → `--pri-neutral` (only **R** Coccygeus is Violet)
- **L** Piriformis → `--pri-neutral` (only **R** Piriformis is Violet)
- **R** Arcuate Tendon → `--pri-neutral` (only **L** Arcuate Tendon is Yellow)
- **R** Anococcygeal Ligament → `--pri-neutral` (only **L** is Yellow)

Fix every `priColor` value in `scripts/anatomize-data.js` to match this table exactly. Verify every structure, both L and R instances.

---

## 2. Arrow Coordinates — TODO Images

Author `arrowTo` coordinates for structures in these image sets using the coordinate picker only.

- Pelvic Outlet (current — arrows still wrong on most structures, see prior addenda)
- Outlet Inferior (Flipped) — `img/PRI-1-Pelvic-Outlet.jpg`
- Pelvic Inlet — `img/PRI-1-Pelvic-Inlet.png`
- Glute Med / Max — `img/PRI-1-glute-med--glute-max.png`
- Anterior Pelvis — `img/pelvis-angle-r-side.png`
- L AIC Chain — `img/left-aic.png` (anchor points still wrong)

### Coordinate Picker Modifications

Modify the coordinate picker tool so that:

1. Each image set displays a list of its structure labels, each with an associated text field.
2. When I focus a label's text field, then click a point on the image, the clicked coordinates populate that label's text field.
3. A textarea at the bottom collates all labels and their recorded coordinates, updated live as fields are populated.

This workflow lets me (the human who can see the image) record accurate coordinates efficiently, then paste the result to CC for data replacement.

---

## 3. Anatomical Side Labels on Pelvic Outlet Images

Each pelvic outlet image needs **Left** and **Right** text labels placed in the upper left and right portions of the image, within the image bounds. These labels indicate the **anatomical** side — not screen position.

The pelvic outlet viewed from below (inferior/lithotomy view) is anatomically **Right** on screen-left and **Left** on screen-right. So for `PRI-1-Pelvic-Outlet2.jpg` (inferior view), the labels are:

```
Right                                Left
```

For the flipped outlet view (`PRI-1-Pelvic-Outlet.jpg`), determine orientation from the image and label accordingly.

For the pelvic inlet (superior view), Right and Left will also be reversed from screen position — verify against Handout 1 page 2 which prints "Right" and "Left" on the image.

Render these labels as SVG text or positioned HTML elements overlaid on the image. Style: white or light text with a subtle drop shadow for legibility against both light and dark image regions.

---

## 4. Infopanel — Not Implemented

The detail infopanel specified in `prd/anatomize-this-prd-v2.md` has not been implemented for Anatomize This. Implement it now.

### Spec (from PRD v2)

On correct identification, a detail panel expands below the image.

**Layer 1 (always, on correct answer):**
- Structure name.
- Standard anatomical description: attachments, actions, movements affected.
- PRI translation (if applicable) — colored bullet using PRI hue.
- Chain membership.
- Left border on the panel in PRI hue (or `--pri-neutral`).

**Layer 2 ("Show Pattern Role" button, only if `hasPriData: true`):**
- L AIC pattern role.
- Pathology implications: which patterns this structure is implicated in (L AIC, B PEC, Patho PEC).

**Layer 3 ("Show Treatment" button, only if `hasPriData: true`):**
- Facilitation step, exercises, HALT level.

Structures with `hasPriData: false`: Layer 1 only, no Layer 2/3 buttons.

### Content depth

The infopanel should teach, not just label. Layer 1 should include:

- **Attachments**: origin and insertion.
- **Actions**: standard anatomical actions (e.g. "hip ER in open chain, pelvic diaphragm ascension in closed chain").
- **Movements affected**: what joint motions this muscle contributes to.
- **PRI translation**: what PRI calls this muscle's role, stated as a corrective action (e.g. "L IsP ER — outlet abduction").

This gives the student context for why a muscle matters, not just its name.

---

## 5. Label Box Fixes (blank_panels mechanic)

### 5a. Label boxes must fit their text

Not all boxes are too small — some are fine. CC must calculate the correct `panelBox` dimensions for each structure based on its label text length and font size. A box that clips "Obturator Internus" is wrong; a box that's oversized for "Sacrum" is also wrong. Measure, don't guess.

### 5b. Label text is translucent — WRONG

Only the label box **background** should be translucent (PRI hue at ~0.25 alpha on correct answer, transparent before answer). The **text** itself must be fully opaque: `var(--text)` at `opacity: 1`.

Fix: ensure the label `<text>` element (or equivalent) has `opacity: 1` and `fill: var(--text)` regardless of the panel's background alpha.

### 5c. Labels must not exceed image bounds

No label box may extend beyond the image container edges. No text may be clipped by the image boundary. Panels that would overflow must be repositioned to stay within bounds. How this is achieved (CSS positioning, JS clamping, or a combination) is up to CC — the requirement is that every label is fully visible and contained within the image area at all viewport sizes.

---

## Execution Order

After **every** step: remove dead code, update affected selectors/references, verify no regressions. Direct edits only. No transformation scripts.

1. Fix all `priColor` values against Handout 1 (Section 1). Verify every structure, both sides.
2. Fix label text opacity and box sizing (Section 5a, 5b). Verify text is fully opaque and boxes fit their labels.
3. Fix label boundary containment (Section 5c). Verify no labels clipped at any viewport size.
4. Add Left/Right anatomical side labels to pelvic outlet images (Section 3).
5. Implement infopanel with 3-layer progressive disclosure (Section 4). Verify panels render for every structure.
6. Modify coordinate picker per Section 2 spec (label list with text fields, focus-click-populate, collating textarea).
7. Using the modified picker, author arrow coordinates for all image sets in Section 2. Measure each individually.
8. Final verification: full testing checklist. No console errors. No dead code. Commit.
