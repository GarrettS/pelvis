# Anatomize This! — PRD & CC Build Prompt (v2)

## Overview

Anatomize This! is a multi-image anatomy identification game. It is a subtab under the Anatomy tab, replacing the old "1A — Interactive Anatomy Images" subtab.

The game presents anatomy images and prompts structure names one at a time. The user clicks the correct region on the image. The game supports multiple images, each with its own structure set and interaction mechanic appropriate to the source image. On correct identification, a detail panel below the image reveals PRI-relevant information about the structure using progressive disclosure (3 layers).

Two mechanic types exist:

- **blank_panels** — for clean (unlabeled) illustrations. Blank SVG panels with arrows overlay the image. User clicks the panel that points to the prompted structure.
- **label_hunt** — for pre-labeled reference images. Existing printed labels on the image serve as clickable hitboxes. User finds and clicks the correct label text.

Both mechanics share the same game loop: prompt → click → score → detail panel → next.

---

## Objectives

1. Rapid identification of pelvic and hip anatomical structures.
2. Spatial mapping between name and location.
3. Repeatable, gamified practice with PRI color-coded feedback.
4. Progressive disclosure of PRI-specific detail (standard action, pattern role, treatment) on each correct answer.
5. Accuracy and speed tracking across sessions.

---

## Navigation

### Anatomy Tab Structure

```
Anatomize This! | Pelvis Decoder | L AIC Chain
```

- **Anatomize This!** replaces the old "1A — Interactive Anatomy Images" subtab. It is the first (default) subtab.
- **Pelvis Decoder** — unchanged (old 1B).
- **L AIC Chain** — interactive linked diagram using `img/left-aic.png` (dual anterior/posterior view). Uses the **anterior view only** for interaction. The infopanel displays the chain in sequence with clickable rows. Clicking a muscle name in the infopanel draws a leader line from that row to the muscle's location on the anterior image and highlights both. Clicking a muscle region on the image highlights the corresponding infopanel row and draws the same line. Bidirectional — same anchor-point data, either side triggers. See L AIC Chain Subtab section below for full spec.

The old sub-view buttons (Muscle Attachments, Bony Landmarks, L AIC Chain, Hip Overview) are removed. The lateral hip image is now inside Anatomize This as a game image. The Netter anterior pelvis (`1772049306371_image.png`) and Veritas hip overview (`1772049130888_image.png`) are dropped from the UI. They can be re-added as future Anatomize This image sets if clean versions are sourced.

### Image Selector (within Anatomize This!)

At the top of the Anatomize This subtab, a button row selects the active image:

```
[ Pelvic Outlet ]  [ Lateral Hip ]
```

Each button loads a different image, structure set, and mechanic variant. Selecting a different image resets the current session. The first image (Pelvic Outlet) is active by default.

Future images (Pelvic Inlet, Glute Med/Max, etc.) are added by appending buttons here. The architecture supports unlimited image sets.

---

## Architecture

### Data Model

```javascript
const ANATOMIZE_IMAGES = [
  {
    id: "pelvic_outlet",
    label: "Pelvic Outlet",
    mechanic: "blank_panels",
    imageSrc: "PRI1Pelvic_Outlet2.jpg",  // embedded as base64
    structures: [ /* ... */ ]
  },
  {
    id: "lateral_hip",
    label: "Lateral Hip",
    mechanic: "label_hunt",
    imageSrc: "1772049358465_image.png",  // embedded as base64
    structures: [ /* ... */ ]
  }
];
```

### Mechanic Dispatch

`AnatomizeModule` reads `mechanic` from the active image set and renders accordingly:

- `blank_panels` → SVG overlay with panels, arrows, polygon overlays.
- `label_hunt` → image-map hitboxes over existing printed text labels, hover underlines.

All other game logic (prompting, scoring, modes, detail panel) is shared.

---

## Shared Game Mechanics

These apply to both `blank_panels` and `label_hunt` images.

### Game Modes

#### Standard Mode (Default)

1. Game selects a structure name at random from the structure set. Name appears in the prompt banner.
2. User clicks the correct target on the image.
3. Immediate grading:

**Correct:**
- Visual feedback appropriate to the mechanic (see mechanic-specific sections).
- Score increases by 1.
- Detail panel expands below the image (see Detail Panel section).
- After the user has viewed the detail (or immediately if they click away), the next structure is prompted.

**Incorrect:**
- Visual feedback appropriate to the mechanic (see mechanic-specific sections).
- Score decreases by 1.
- The same structure remains in the prompt. User must try again.
- The correct target is not revealed.

4. Session ends when all structures have been correctly identified once.

#### Speed Round Mode

- Timer starts at first click.
- Structure names are presented serially.
- One attempt per structure. If wrong, session advances to the next structure (no retry).
- No right/wrong indicators during play. No detail panels during play.
- Timer visible throughout.

**End of Speed Round session:**
- Timer stops.
- All targets reveal simultaneously with correct/incorrect indicators.
- Detail panels are accessible in a post-session review mode: user clicks any revealed structure to view its detail panel.
- Display: accuracy percentage, total time, score.

### Structure Set Rules

- Each structure is tested once per session.
- Order randomized each session.
- No repeats within a session.
- Standard Mode: session completion requires all structures to be correctly identified (retry on miss).
- Speed Round: session completion after all structures prompted once (one attempt each).
- Session state resets on image switch, tab switch, or page reload. No persistence.

### Scoring

- Score starts at 0.
- Correct: +1.
- Incorrect: −1.
- Score can go negative.
- Accuracy tracked separately: (structures identified on first attempt) / (total structures).
- Score display below the image: "Score: 5 · 8 of 14 identified".

### Prompt Banner

Fixed at top of the game area. Displays the current structure name in large text (`--text-2xl`). Always visible during gameplay.

### Controls

Above the prompt banner:
- Image selector button row.
- Mode toggle: Standard / Speed Round.
- Reset button.
- Structure filter (see below).

### Structure Filter

A toggle row allowing the user to filter which structures are included in the session:

```
[ All ]  [ Muscles ]  [ Landmarks ]
```

Default: All. Filtering resets the current session. Minimum 4 structures required for a valid session — if a filter results in fewer than 4, disable that filter option.

---

## Detail Panel — Progressive Disclosure

On correct identification in Standard Mode, a detail panel expands below the image. It uses the same 3-layer progressive disclosure from the old hotspot system.

### For Structures with PRI Data

Structures that have entries in MUSCLE_HOTSPOTS or LANDMARK_HOTSPOTS get the full 3-layer panel:

**Layer 1 (revealed on correct answer):**
- Structure name, preceded by a small PRI-hue circle (colored bullet).
- Standard action.
- PRI translation.
- Chain membership.
- Left border on the entire panel: PRI hue for this structure (or `--pri-neutral`).

**Layer 2 ("Show Pattern Role" button):**
- L AIC pattern role for this structure.

**Layer 3 ("Show Treatment" button):**
- Facilitation step, exercises, HALT level.

Each layer is revealed by an explicit button press. No nested click ambiguity.

### For Structures without PRI Data

Structures not in MUSCLE_HOTSPOTS or LANDMARK_HOTSPOTS get a minimal panel:

**Layer 1 (revealed on correct answer):**
- Structure name.
- Standard anatomical action or description.
- Note: "Not a primary PRI muscle." or "Bony landmark — no PRI color assignment."

No additional layers. No Layer 2/3 buttons.

### Panel Behavior

- Panel slides open with a CSS transition (~200ms ease).
- Showing a new structure's detail replaces the previous one.
- Panel has a close/collapse button.
- In Speed Round, detail panels are suppressed during play and only accessible in post-session review mode.

---

## Mechanic: blank_panels (Pelvic Outlet)

### Applies To

Image sets where the source illustration is clean (no embedded text labels). Structures are identified by their visual appearance in the illustration.

### Rendering

- SVG overlay absolutely positioned over the image, matching its dimensions.
- Each structure has a **panel** (rectangular box) and an **arrow** (line + arrowhead) pointing from the panel to the structure's location on the image.
- All positions use percentage-based coordinates relative to the image container.

### Panel Default State (Pre-Answer)

- Rectangular outline: 1px solid `var(--border)`.
- Background: transparent.
- Arrow line + arrowhead: `var(--text-dim)`, thin stroke.
- Label text: hidden.
- Cursor: pointer.

### Correct Answer Visual

- Panel reveals its label text.
- Green check icon (✓) in upper-right of panel.
- Panel border and background change to PRI color (border: PRI hue, background: PRI hue at ~0.25 alpha).
- Arrow line + arrowhead change to PRI hue.
- Muscle polygon overlay fades in over the image: precise SVG polygon tracing the muscle boundary, filled with PRI hue at ~0.25 alpha. For bony landmarks, use a circle marker at the landmark location instead.
- Revealed panel, colored arrow, and polygon overlay persist for the rest of the session. They accumulate, gradually painting the anatomy in color.

### Incorrect Answer Visual (Standard Mode)

- Red X icon (✗) in upper-right of clicked panel, disappears after 1 second.
- Panel border briefly flashes `var(--red)`, then reverts to default.

### Mobile (< 600px)

Panels and arrow overlays are not rendered on the image. Instead:
- Image displays without overlays.
- Prompt banner shows structure name below image.
- Below that, a vertical list of clickable buttons (one per structure, randomized order). Each button is blank until answered.
- Correct/incorrect feedback per the same rules, minus arrow and polygon overlay.

### Box Placement Rules

1. Place each box on the side nearest its target structure.
2. No box may overlap another box.
3. No box may overlap a key visual feature on the image.
4. Overlap avoidance takes priority over side preference.

### Muscle Polygon Overlays

Each muscle/ligament structure has a corresponding SVG `<polygon>` element defined by percentage-based coordinate pairs tracing the muscle boundary in the illustration.

Requirements:
- Polygons precisely follow visible muscle boundaries. No approximate shapes.
- Coordinates are percentages relative to the image container.
- Fill: PRI hue at ~0.25 alpha. Stroke: PRI hue at 0.6 alpha, 1px.
- Initially hidden (`opacity: 0`). On correct identification, fade in (~300ms ease CSS transition).
- Persist for the rest of the session once revealed.
- Bony landmarks use a circle marker (r ~2% of image width) instead of a polygon.

Polygon data format:
```javascript
{
  id: "obturator_internus",
  polygon: [
    [18.5, 42.0], [20.1, 44.3], [22.0, 48.1], /* ... */
  ]
}
```

The polygon coordinate arrays must be authored by examining the image and tracing boundaries. Include in structure data alongside `panelBox` and `arrowTo`.

---

## Mechanic: label_hunt (Lateral Hip)

### Applies To

Image sets where the source image already has printed text labels with leader lines pointing to structures. The user's task is to locate and click the correct label.

### Rendering

- The image displays at full resolution. No SVG panel overlay.
- Each structure's clickable region is an invisible hitbox (image-map `<area>` or absolutely-positioned transparent `<div>`) covering the printed label text on the image.
- Hitbox coordinates are percentage-based, authored by examining the image and measuring each label's bounding box.

### Hitbox Data Format

```javascript
{
  id: "piriformis",
  label: "Piriformis",
  type: "muscle",
  hitbox: { x: 3.2, y: 37.5, w: 12.0, h: 3.5 },  // percentage-based
  // PRI data fields (if available):
  hasPriData: true,
  priData: { /* same shape as MUSCLE_HOTSPOTS entry */ }
}
```

### Hover State

- On pointer hover (any pointer type, including touch), the hitbox region shows a **neutral underline** beneath the label text. Color: `var(--text-dim)`. This gives affordance that the label is clickable without hinting at correctness.
- The underline is rendered as a positioned `<div>` or `::after` pseudo-element at the bottom edge of the hitbox, thin (1-2px).
- On mobile, the tap itself is the interaction — no hover preview is needed since the user is committing to an answer. But if the device supports hover (e.g., stylus, mouse on tablet), show the underline.

### Correct Answer Visual

- The label's hitbox underline changes to the structure's **PRI color** (persistent).
- A green check icon (✓) appears adjacent to the label (upper-right of hitbox, small).
- Hitbox background: PRI hue at ~0.10 alpha (subtle highlight, must not obscure the printed text beneath).
- The PRI-colored underline and check persist for the rest of the session.
- Detail panel expands below the image.

### Incorrect Answer Visual (Standard Mode)

- The clicked label's hitbox briefly shows a red underline (`var(--red)`) for 1 second, then reverts to neutral.
- Red X icon (✗) appears adjacent to the label for 1 second, then disappears.

### No Polygon Overlays

The lateral hip image is a complex illustration with overlapping muscle attachment lines. Polygon overlays would be unreadable. Correct answers are indicated by the PRI-colored underline + check icon only.

### Mobile (< 600px)

The image is too dense for reliable tap targets at mobile widths. Use the same fallback as `blank_panels`:
- Image displays without interactive hitboxes.
- Below the image, the prompt banner shows the structure name.
- Below that, a vertical list of clickable buttons (one per structure, randomized order). Each button shows the structure name as text (since the labels are already visible on the image, hiding them in buttons doesn't help — the user needs to find the label *on the image*, then tap the matching button below). Label text is visible on buttons for this mechanic.
- Correct/incorrect feedback: button border and background change to PRI color / red flash.

### Label Types on the Image

The lateral hip image has two visually distinct label types:
- **Muscle names**: black upright text.
- **Bony landmarks**: red italic text.

Both are included in the game. The structure filter (All / Muscles / Landmarks) lets the user narrow scope.

---

## Image Set 1: Pelvic Outlet

- **Image:** `PRI1Pelvic_Outlet2.jpg` (page 6 pelvic outlet, Elizabeth Noble illustration). Clean, no printed labels.
- **Mechanic:** `blank_panels`
- **Base64:** Embed per CC-BUILD-SPEC.md.

### Structure Set (14 minimum)

#### Muscles and Ligaments (10)

| # | Structure | PRI Color Family | PRI Hue |
|---|-----------|-----------------|---------|
| 1 | Obturator Internus | Frontal Abduction | green |
| 2 | Iliococcygeus | Frontal Abduction | green |
| 3 | Pubococcygeus | Sagittal | brown |
| 4 | Puborectalis | Sagittal | brown |
| 5 | Medial Hamstring | Sagittal | brown |
| 6 | Coccygeus | Internal Rotation | violet |
| 7 | Piriformis | Internal Rotation | violet |
| 8 | Glute Max | Internal Rotation | violet |
| 9 | Arcuate Tendon | Integration | yellow |
| 10 | Anococcygeal Ligament | Integration | yellow |

#### Bony Landmarks (4)

| # | Structure | PRI Color Family | PRI Hue |
|---|-----------|-----------------|---------|
| 11 | Sacrum | none | neutral |
| 12 | Coccyx | none | neutral |
| 13 | Pubic Symphysis | none | neutral |
| 14 | Ischial Tuberosity | none | neutral |

#### Additional Structures

If the illustration contains identifiable structures beyond these 14, add them. Use `neutral` for any structure without a PRI color family assignment.

### PRI Detail Data

All 10 muscles/ligaments have PRI detail data (color family, chain, pattern role, treatment). Author this data aligned to LEARN-PRI.md and the Pelvis Restoration manual. The 4 bony landmarks get minimal panels (name + anatomical description, no PRI layers).

---

## Image Set 2: Lateral Hip

- **Image:** `1772049358465_image.png` (lateral hip bone with muscle attachment sites and bony landmarks). Pre-labeled with text + leader lines.
- **Mechanic:** `label_hunt`
- **Base64:** Embed per CC-BUILD-SPEC.md.

### Structure Set (all visible labels)

Author hitbox coordinates for every labeled structure on the image. The complete set:

#### Muscles and Soft Tissue (~23)

| # | Label (as printed) | Type | Has PRI Data |
|---|-------------------|------|:---:|
| 1 | Gluteus maximus | muscle | ✓ |
| 2 | Gluteus medius | muscle | ✓ |
| 3 | Gluteus minimus | muscle | ✓ |
| 4 | Internal oblique | muscle | ✓ (as IO/TA) |
| 5 | External oblique | muscle | ✗ |
| 6 | Piriformis | muscle | ✓ |
| 7 | Gemellus superior | muscle | ✗ |
| 8 | Gemellus inferior | muscle | ✗ |
| 9 | Obturator externus | muscle | ✓ (contrast with internus) |
| 10 | Quadratus femoris | muscle | ✗ |
| 11 | Semimembranosus | muscle | ✗ |
| 12 | Semitendinosus and biceps femoris | muscle | ✓ (as biceps femoris) |
| 13 | Adductor magnus | muscle | ✗ |
| 14 | Adductor longus | muscle | ✗ |
| 15 | Adductor brevis | muscle | ✗ |
| 16 | Gracilis | muscle | ✗ |
| 17 | Pectineus | muscle | ✗ |
| 18 | Rectus abdominis | muscle | ✗ |
| 19 | Pyramidalis | muscle | ✗ |
| 20 | Reflected tendon of rectus | muscle | ✓ (as rectus femoris) |
| 21 | Direct head of rectus | muscle | ✓ (as rectus femoris) |
| 22 | Transverse acetabular ligament | ligament | ✗ |

#### Bony Landmarks (~11)

| # | Label (as printed) | Type | Has PRI Data |
|---|-------------------|------|:---:|
| 23 | Crest of Ilium | landmark | ✗ |
| 24 | Posterior superior spine | landmark | ✗ |
| 25 | Posterior inferior spine | landmark | ✗ |
| 26 | Greater sciatic notch | landmark | ✗ |
| 27 | Anterior superior spine | landmark | ✓ (as ASIS) |
| 28 | Acetabular fossa | landmark | ✓ |
| 29 | Spine of Ischium | landmark | ✗ |
| 30 | Lesser sciatic notch | landmark | ✗ |
| 31 | Ischial tuberosity | landmark | ✓ |
| 32 | Obturator foramen | landmark | ✓ |
| 33 | Crest of pubis | landmark | ✗ |

**Note on labels 20-21:** "Reflected tendon of rectus" and "Direct head of rectus" are two labels for parts of rectus femoris. In the game, they are two separate clickable targets. Both share the same PRI detail panel (rectus femoris data from MUSCLE_HOTSPOTS). If the game prompts "Reflected tendon of rectus", only clicking the "Reflected tendon of rectus" label is correct — the "Direct head of rectus" label is a different target.

**Additional labels:** If there are additional labeled structures visible on the image beyond this list (e.g., "Inferior pubic ramus", "Superior pubic ramus", "Iliopubic eminence", "Pubic tubercle", "Lesser trochanter of femur", "Greater trochanter of femur", "Ala of ilium", "Iliac tuberosity", "Sacral promontory", "Arcuate line", "Anterior inferior iliac spine", "Inferior pubic ligament", "Pubic arch"), include them. Author a hitbox for each. All additional labels: `type: "landmark"`, `hasPriData: false`.

Total: 33 minimum, potentially 45+ if all fine-print landmarks are included.

### PRI Detail Data Source

For structures marked "Has PRI Data: ✓", port the detail data from the existing `MUSCLE_HOTSPOTS` and `LANDMARK_HOTSPOTS` arrays in `pri-unified.html`. Each entry has: standard action, PRI translation, colorFamily, chain, laic (pattern role), treatment. Map these into the detail panel's 3-layer structure.

For structures marked "Has PRI Data: ✗", author a one-line standard anatomical description. These get the minimal detail panel (Layer 1 only, no Layer 2/3 buttons).

---

## PRI Color Usage

### CSS Custom Properties

Add as CSS custom properties:

```css
/* PRI Color Families — light mode */
--pri-brown: hsl(25, 50%, 35%);
--pri-brown-bg: hsla(25, 50%, 35%, 0.25);
--pri-red: hsl(0, 60%, 45%);
--pri-red-bg: hsla(0, 60%, 45%, 0.25);
--pri-green-family: hsl(140, 45%, 38%);
--pri-green-family-bg: hsla(140, 45%, 38%, 0.25);
--pri-orange: hsl(35, 80%, 48%);
--pri-orange-bg: hsla(35, 80%, 48%, 0.25);
--pri-violet: hsl(270, 40%, 48%);
--pri-violet-bg: hsla(270, 40%, 48%, 0.25);
--pri-yellow: hsl(50, 70%, 48%);
--pri-yellow-bg: hsla(50, 70%, 48%, 0.25);
--pri-neutral: var(--green);
--pri-neutral-bg: hsla(140, 30%, 45%, 0.2);
```

Dark mode variants: increase lightness by ~15%, keep saturation. Adjust alpha on backgrounds for readability against dark surfaces.

Structures without a PRI color family use `neutral`.

### Color-as-UI Rule

PRI color families are communicated through visual CSS — never by writing the color name in text. The user learns the association through repeated visual exposure, not by reading "Violet — Internal Rotation".

Correct usage examples:
- A small colored circle/bullet next to the structure name in the detail panel, using that structure's PRI hue.
- A left border on the detail panel row in the PRI hue.
- The panel background tint on correct answer (already specced).
- The underline color on correct answer in `label_hunt` (already specced).

Do not render text like "Color family: Violet — Internal Rotation" in the UI. The color speaks for itself.

---

## L AIC Chain Subtab — Interactive Linked Diagram

Not a game. A reference tool with bidirectional click-to-connect interaction between the chain infopanel and the anatomy image.

### Layout

Two columns on desktop (≥ 600px):
- **Left column (~40%):** Infopanel — vertical chain layout, one row per muscle.
- **Right column (~60%):** Anterior view of `img/left-aic.png`, cropped or masked to show only the anterior half. The posterior view is not interactive and can be hidden or shown as a static reference below.

On mobile (< 600px): stack vertically — image on top, infopanel below.

### Image

Source: `img/left-aic.png`. Use the `src` path directly (not base64). The image shows anterior and posterior views side by side. Only the **anterior view** has interactive regions. The posterior view can remain visible but is non-interactive.

Each chain muscle has an **anchor point** on the anterior image — a percentage-based `[x, y]` coordinate at the center of the muscle's visible red region. These are authored manually.

### Infopanel

The chain is displayed as a vertical sequence of clickable rows:

```
Diaphragm
  ↓ crural pull / ZOA loss
Psoas
  ↓ shortens, pulls ilium forward
Iliacus
  ↓ anterior pelvic tilt (L IP ER)
TFL
  ↓ orientates femur
Vastus Lateralis
  ↓ lateral knee tension
Biceps Femoris
  (long head — terminal)
```

Each **muscle name** is a clickable row (styled as the existing `.aic-muscle` class or equivalent). The **arrow text** between rows is static description, not clickable.

Each row's content when active (expanded or highlighted) can show the existing descriptive text from the old chain diagram — the "crural pull / ZOA loss" and "shortens, pulls ilium forward" text is the connection description, not the muscle detail. No progressive disclosure layers here — this is a reference view, not a quiz.

### Interaction: Click Infopanel → Image

1. User clicks a muscle name row in the infopanel (e.g., "Psoas").
2. That row highlights (background: `var(--accent)` at low alpha, left border accent).
3. An SVG leader line draws from the right edge of the infopanel row to the muscle's anchor point on the anterior image.
4. A small circle marker pulses at the anchor point on the image.
5. Any previously active row/line is deactivated (only one active at a time).

### Interaction: Click Image → Infopanel

1. User clicks near a muscle's anchor point on the anterior image (hitbox: circle, r ~5% of image width centered on anchor).
2. The corresponding infopanel row highlights and scrolls into view if needed.
3. Leader line draws from the row to the anchor point (same visual as above).
4. Any previously active row/line is deactivated.

### Leader Line Rendering

- SVG overlay spanning both columns (or use absolute positioning relative to the shared container).
- Line style: 1.5px solid `var(--accent)`, slight curve (quadratic bezier) so it doesn't cross other elements awkwardly.
- Animate in: ~200ms ease.
- Arrowhead at the image end (pointing to the muscle).
- Line disappears when a different muscle is selected or when clicking empty space.

### Anchor Points (to be authored)

```javascript
const AIC_CHAIN_ANCHORS = [
  { id: "diaphragm",       label: "Diaphragm",        anchor: [x, y] },
  { id: "psoas",            label: "Psoas",             anchor: [x, y] },
  { id: "iliacus",          label: "Iliacus",           anchor: [x, y] },
  { id: "tfl",              label: "TFL",               anchor: [x, y] },
  { id: "vastus_lateralis",  label: "Vastus Lateralis",  anchor: [x, y] },
  { id: "biceps_femoris",   label: "Biceps Femoris",    anchor: [x, y] },
];
```

Coordinates are percentages relative to the **anterior view** portion of the image. CC must measure these by examining the image.

### No Game Mechanics

No scoring, no prompting, no modes, no session state. This is purely click-to-explore. It replaces the old static chain diagram with an interactive version that connects the conceptual chain (text) to the spatial anatomy (image).

---

## Feedback Tone

Per CC-BUILD-SPEC.md: clinical and direct. No exclamation points.

- Correct: visual feedback only. No text toast.
- Incorrect: red flash. No text toast.
- End of session: "Session complete. Score: 10 · Accuracy: 85%." — not "Great job!".

---

## Build Instructions

### Step 1: Author Structure Data for Pelvic Outlet

Before writing game logic, examine `PRI1Pelvic_Outlet2.jpg` and author:
1. Polygon coordinate arrays for each muscle/ligament (trace visible boundaries, 15-30 points per muscle).
2. `panelBox` and `arrowTo` positions for each structure (following box placement rules).
3. `landmarkMarker` positions for bony landmarks.

Use the labeled PDF pages (pages 4 and 6 of `Handout_1__Anatomy_Families_by_Color.pdf`) as reference for identifying muscle boundaries on the clean image.

Verify adjacent muscles share boundary edges where they meet (no gaps, no overlaps between polygons).

### Step 2: Author Hitbox Data for Lateral Hip

Examine `1772049358465_image.png` and author `hitbox` coordinates (percentage-based bounding boxes) for every visible label. Each hitbox should tightly wrap the printed text.

Measure carefully — dense regions (inferior pubic area) have labels close together. Hitboxes must not overlap.

### Step 3: Author PRI Detail Data

For each structure with PRI relevance:
- Port existing data from MUSCLE_HOTSPOTS and LANDMARK_HOTSPOTS.
- Verify against LEARN-PRI.md. LEARN-PRI.md wins on any conflict.
- Structure the data for the 3-layer progressive disclosure format.
- Apply the Color-as-UI Rule: use PRI hues as colored bullets, panel borders, and tints — never as written color names in the UI text.

For structures without PRI data:
- Write a one-line standard anatomical description (action, location, or clinical note).

### Step 4: Implement AnatomizeModule

Build as a closure-based module exposing `init(imageId)` and `reset()`.

Internal structure:
1. `renderImageSelector()` — button row for image selection.
2. `loadImageSet(imageId)` — loads structures, switches mechanic renderer.
3. `renderBlankPanels(structures)` — SVG overlay for `blank_panels` mechanic.
4. `renderLabelHunt(structures)` — hitbox overlay for `label_hunt` mechanic.
5. `promptNext()` — selects next structure, updates prompt banner.
6. `handleAnswer(structureId, isCorrect)` — scores, triggers visual feedback, shows detail panel.
7. `renderDetailPanel(structure)` — progressive disclosure below image.
8. `endSession()` — final score display, review mode for Speed Round.

Wire into the Anatomy tab's subtab switching logic, replacing the old 1A content.

### Step 5: Add PRI Color Custom Properties

Add the `--pri-*` color variables to the existing `:root` and dark mode blocks in the app's `<style>`.

### Step 6: Build L AIC Chain Interactive Subtab

Replace the text-only chain diagram with the interactive linked diagram:
1. Add `img/left-aic.png` as an `<img>` (use `src` path directly, no base64).
2. Author anchor point coordinates for each of the 6 chain muscles on the anterior view.
3. Build the infopanel as clickable rows with the chain sequence text.
4. Implement bidirectional click handlers: infopanel row → draw line to image anchor; image anchor click → highlight infopanel row.
5. SVG leader line overlay spanning the container.
6. Remove the old static `.aic-diagram`, `.aic-muscle`, `.aic-arrow` CSS layout elements.

### Step 7: Remove Old 1A Code

Remove:
- Old subview-tabs button row (Muscle Attachments, Bony Landmarks, L AIC Chain, Hip Overview).
- Old `renderHotspots()` function and hotspot CSS.
- Old `showDetail()` / `renderMuscleDetail()` / `renderLandmarkDetail()` functions (replaced by AnatomizeModule's detail panel).
- References to `view-lateral`, `view-anterior`, `view-aic`, `view-hip` containers.

Preserve:
- MUSCLE_HOTSPOTS and LANDMARK_HOTSPOTS data arrays — these are consumed by AnatomizeModule for PRI detail panels.
- The AIC chain data (moved to the L AIC Chain subtab).

### Step 8: Test

- Image selector switches between Pelvic Outlet and Lateral Hip correctly.
- Pelvic Outlet: all 14+ panels render without overlap. Arrows point to correct structures. Polygon overlays accumulate.
- Lateral Hip: all 33+ hitboxes are clickable. Hover shows neutral underline. Correct shows PRI-colored underline.
- Standard Mode: correct answer reveals visual + detail panel + advances. Incorrect flashes red + decrements score + retries.
- Speed Round: timer runs, no feedback during play, full reveal + review mode at end.
- Detail panel: Layer 1 shows on correct. Layer 2/3 buttons work. Structures without PRI data show minimal panel.
- Structure filter (All / Muscles / Landmarks) works for both images.
- Mobile: both images fall back to button list below image.
- Scoring and accuracy display correctly.
- Image switch and tab switch reset session.
- Light and dark themes render correctly.
- L AIC Chain: clicking infopanel row draws leader line to correct anchor on image. Clicking image anchor highlights correct infopanel row. Only one active at a time. Line animates in. Mobile stacks vertically.
- No console errors.

---

## Future Expansion

Additional image sets can be added by pushing entries to `ANATOMIZE_IMAGES`:

- **Pelvic Inlet (bone):** `PRI1PelvicInlet.png` — clean, bone-only. Mechanic: `blank_panels` with arrow-to-region for muscle attachment sites (approximate). Structures: iliacus, sartorius, rectus femoris, IO/TA, glute med, glute max, plus bony landmarks (ASIS, sacral base, pubic symphysis, arcuate line).
- **Pelvic Outlet (view 1):** `PRI1Pelvic_Outlet.jpg` — clean, different angle. Mechanic: `blank_panels`. Structures: subset of outlet muscles visible in this view (obturator internus, glute max, coccygeus).
- **Glute Med / Glute Max (inlet):** `PRI1glutemedglutemax.png` — real bone photo with white overlays. Mechanic: `blank_panels`. Structures: 2 (glute med, glute max). Short round — could combine with inlet bone image.
- **Netter Anterior Pelvis:** `1772049306371_image.png` — if sourced without labels, mechanic: `blank_panels`. Otherwise `label_hunt` with hitboxes over existing Netter labels.

No code changes needed to support these — only data authoring (structure sets, hitboxes/panels, PRI detail where applicable).
