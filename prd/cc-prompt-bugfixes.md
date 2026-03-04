# CC Prompt: Anatomize This — Bug Fixes (Do Not Skip)

CC claimed these were fixed. They are not. Verify each fix visually before reporting it done.

---

## 1. priColor Audit — NOT DONE

CC reported: "All values already match Handout 1 exactly. No changes needed."

This is false. R Arcuate Tendon is currently `--pri-green-family`. It should be `--pri-neutral`. Only **L** Arcuate Tendon is Yellow (per Handout 1 page 1).

Open `scripts/anatomize-data.js`. Search for every structure that appears on both L and R sides. Check each against this table. Fix every mismatch.

| Structure | L side | R side |
|---|---|---|
| Obturator Internus | `--pri-green-family` (Green) | `--pri-neutral` |
| Iliococcygeus | `--pri-green-family` (Green) | `--pri-neutral` |
| Coccygeus | `--pri-neutral` | `--pri-violet` (Violet) |
| Piriformis | `--pri-neutral` | `--pri-violet` (Violet) |
| Glute Max | `--pri-neutral` | `--pri-violet` (Violet) |
| Arcuate Tendon | `--pri-yellow` (Yellow) | `--pri-neutral` |
| Anococcygeal Ligament | `--pri-yellow` (Yellow) | `--pri-neutral` |
| Pubococcygeus | `--pri-brown` (Brown) | `--pri-neutral` |
| Puborectalis | `--pri-brown` (Brown) | `--pri-neutral` |
| Medial Hamstring | `--pri-brown` (Brown) | `--pri-neutral` |

Do not report "no changes needed" without checking every value.

---

## 2. Label Text Invisible — NOT FIXED

CC reported label text opacity was fixed. The text is nearly invisible on the images.

Root cause: `fill: var(--text)` resolves to light text in light mode, placed on a white/light image background. This makes labels unreadable.

Fix: Label text on anatomy images must be **dark and fully opaque** regardless of theme. Do not use `var(--text)`. Do not use any opacity or alpha channel on text.

```
fill: #1a1a1a
opacity: 1
font-weight: 600
```

This applies to all SVG `<text>` elements used as panel labels in the `blank_panels` mechanic. The text must be readable against the illustration background — which is light-colored on all current images.

Test: switch to light mode and verify every label is clearly readable against the image.

---

## 3. Infopanel — NOT IMPLEMENTED

CC reported: "The 3-layer progressive disclosure was already implemented."

This is false. There is no infopanel visible when clicking structures in Anatomize This.

### Requirement

When the user correctly identifies a structure, a detail panel appears below the image showing information about that structure. This is the core learning mechanism — without it, the game is just a click exercise.

### What the infopanel must show

**Layer 1 (appears immediately on correct answer):**

- **Structure name** (bold, with PRI color bullet if applicable).
- **Attachments**: proximal (origin) and distal (insertion).
- **Actions**: standard anatomical actions this muscle performs.
- **Movements affected**: what joint motions this muscle contributes to.
- **PRI role** (if `hasPriData: true`): what PRI calls this muscle's corrective action, stated concretely (e.g. "L Obturator Internus → L IsP ER — opens left outlet, ascends pelvic diaphragm").
- **Chain**: which PRI chain this muscle belongs to.
- Left border on the panel in PRI hue (or `--pri-neutral`).

**Layer 2 ("Show Pattern Role" button, only if `hasPriData: true`):**

- L AIC pattern role: how this muscle behaves in the L AIC pattern (shortened/lengthened, overactive/inhibited).
- Pathology implications: which patterns this structure is implicated in (L AIC, B PEC, Patho PEC).
- How this muscle relates to PRI assessments (which tests it affects and how).

**Layer 3 ("Show Treatment" button, only if `hasPriData: true`):**

- Facilitation step in the treatment hierarchy.
- Exercises that target this muscle.
- HALT level.

Structures with `hasPriData: false`: Layer 1 only. No Layer 2/3 buttons.

### Example: Piriformis (L)

User is prompted "Piriformis (L)". User correctly clicks that muscle.

**Layer 1:**
- Piriformis (L) ● (neutral bullet — L piriformis has no PRI color)
- Attachments: anterior sacrum (S2–S4) → greater trochanter of femur.
- Actions: hip ER (hip extended), hip abduction, stabilizes hip joint.
- PRI role: L piriformis is not a primary PRI corrective muscle (no color family assignment). R piriformis is Violet (Internal Rotation).

**Layer 2:**
- In L AIC: L piriformis may be overactive as a compensator. Not a facilitation target.
- In B PEC: bilateral piriformis hypertonic.

**Layer 3:**
- Not directly facilitated. Inhibited through positioning and reciprocal activation of corrective muscles.

### Implementation

The `priDetail` object in `scripts/anatomize-data.js` must contain this content for every structure. For structures currently missing `priDetail` fields (attachments, actions, movements), add them. The rendering code in `scripts/anatomize.js` must create a visible DOM element below the image arena when `handleAnswer` processes a correct click.

---

## Verification — Actually Do This

After making these changes:

1. Open the live site.
2. Switch to Anatomize This, select Pelvic Outlet.
3. Correctly identify a structure.
4. Confirm: label text is dark and readable.
5. Confirm: infopanel appears below the image with attachments, actions, PRI role.
6. Confirm: R Arcuate Tendon renders with neutral color, not green or yellow.

Do not report these as fixed without completing this verification.
