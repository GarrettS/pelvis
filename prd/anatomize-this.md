# Anatomize This! — PRD & CC Build Prompt

## Overview

Anatomize This! is a pelvic outlet anatomy identification game. It replaces the current "1A — Interactive Anatomy Images" sub-tab under the Anatomy tab.

The game displays the pelvic outlet illustration with unlabeled panels arranged around it. Each panel is a blank rectangle with an arrow pointing to an anatomical structure on the image. The game prompts a structure name; the user clicks the matching panel.

This is a visual identification tool. It trains rapid spatial recognition of pelvic outlet landmarks and muscles using PRI's color-coded muscle family system as a reward mechanic.

---

## Objectives

1. Improve rapid identification of pelvic outlet anatomical structures.
2. Reinforce spatial mapping between name and location.
3. Provide repeatable, gamified practice with PRI color-coded feedback.
4. Track accuracy and speed across sessions.

---

## Navigation

Replaces "1A — Interactive Anatomy Images" as a sub-tab under the Anatomy tab. The sub-tab label is "Anatomize This!". All other Anatomy sub-tabs (1B Pelvis Decoder, etc.) are unchanged.

---

## Image Source

Single image: `PRI1Pelvic_Outlet2.jpg` (the page 6 pelvic outlet illustration from Handout 1). This image is clean — no printed labels. Embed as base64 data URI per CC-BUILD-SPEC.md.

No image preprocessing required. Panels and arrows are rendered as SVG overlays on top of the image.

---

## Structure Set

### Source

Union of all labeled structures from Handout 1 pages 4 and 6 (both pelvic outlet views), mapped onto the single page 6 image. Plus bony landmarks clearly identifiable in the illustration.

### Muscles and Ligaments (10)

| # | Structure | PRI Color Family | PRI Hue Name |
|---|-----------|-----------------|--------------|
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

### Bony Landmarks (4)

| # | Structure | PRI Color Family | PRI Hue Name |
|---|-----------|-----------------|--------------|
| 11 | Sacrum | none | neutral |
| 12 | Coccyx | none | neutral |
| 13 | Pubic Symphysis | none | neutral |
| 14 | Ischial Tuberosity | none | neutral |

### Additional Structures

If the illustration contains identifiable structures beyond these 14, add them. Use `neutral` for any structure without a PRI color family assignment.

Total: 14 minimum.

---

## PRI Color Definitions

Add these as CSS custom properties. Each has a base hue used for borders, arrows, and overlay fills.

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

Dark mode variants: increase lightness by ~15%, keep saturation. Adjust alpha on backgrounds as needed for readability against dark surfaces.

---

## Layout

### Desktop (≥ 600px)

- **Prompt banner**: fixed at top of the game area. Displays the current structure name in large text (`--text-2xl`). Always visible during gameplay.
- **Image container**: the pelvic outlet illustration, scaled responsively (`max-width: 100%; height: auto`). Positioned below the prompt banner.
- **SVG overlay**: absolutely positioned over the image, same dimensions. Contains all panels, arrows, and muscle polygon overlays.
- **Score display**: below the image. Shows current score and progress (e.g., "Score: 5 · 8 of 14 identified").
- **Mode selector and controls**: above the prompt banner. Mode toggle (Standard / Speed Round), Reset button.

### Panel Layout

Each structure has one panel — a rectangular box positioned near its corresponding structure on the image. Each panel has an arrow (line + arrowhead) pointing from the panel to the structure's location on the image.

All positions use percentage-based coordinates relative to the image container.

**Box placement rules:**
1. Place each box on the side nearest its target landmark. If the landmark is on the left side of the image, the box favors the left side.
2. No box may overlap another box.
3. No box may overlap a landmark or key visual feature on the image.
4. If rule 1 conflicts with rule 2 or 3, move the box to avoid overlap. Overlap avoidance takes priority over side preference.

### Panel Default State (Pre-Answer)

- Rectangular outline: 1px solid `var(--border)`.
- Background: transparent.
- Arrow line + arrowhead: `var(--text-dim)`, thin stroke.
- Label text: hidden.
- Cursor: pointer.

### Mobile (< 600px)

Panels and arrow overlays are not rendered on the image. Instead:

- The image displays without overlays.
- Below the image, the prompt banner shows the structure name.
- Below that, a vertical list of clickable buttons — one per structure, in randomized order. Each button is a blank rectangle (no label text shown until answered).
- Correct/incorrect feedback follows the same rules as desktop, minus the arrow and polygon overlay. Buttons show label text, border color, and check/X icon on answer.

---

## Game Modes

### 1. Standard Mode (Default)

#### Flow

1. Game selects a structure name at random from the structure set. The name appears in the prompt banner.
2. User clicks a panel.
3. Immediate grading:

**Correct:**
- Panel reveals its label text.
- Green check icon (✓) appears in the upper-right corner of the panel.
- Panel border and background change to the structure's PRI color (border: PRI hue, background: PRI hue at low opacity).
- Arrow line + arrowhead change to the PRI hue.
- Muscle polygon overlay fades in over the image — a precise SVG polygon tracing the muscle boundary as drawn in the illustration, filled with the PRI hue at low opacity (~0.25 alpha). For bony landmarks, use `--pri-neutral` and `--pri-neutral-bg`.
- The revealed panel, colored arrow, and polygon overlay persist for the rest of the session. They accumulate as the user progresses, gradually painting the anatomy in color.
- Score increases by 1.
- Next structure is automatically selected and displayed in the prompt banner.

**Incorrect:**
- Red X icon (✗) appears in the upper-right corner of the clicked panel. The X disappears after 1 second.
- Panel border briefly flashes `var(--red)`, then returns to default state.
- Score decreases by 1.
- The same structure remains in the prompt banner. User must try again.
- The correct panel is not revealed.

4. Session ends when all structures have been correctly identified once.

#### End of Session

- All panels are in their revealed state (accumulated during play).
- Display final score and accuracy: "Score: 10 · Accuracy: 85% (14/14 correct, 3 misses)".
- "Play Again" button resets the session.

### 2. Speed Round Mode

- Timer starts at first click (not at mode selection).
- Structure names are presented serially, same as Standard Mode.
- User clicks panels normally — one attempt per structure. If wrong, the session advances to the next structure (no retry).
- No right/wrong indicators shown during play.
- No panel tinting, no polygon overlays during play.
- Timer visible throughout session.

#### End of Session

- Timer stops.
- All panels reveal their labels simultaneously.
- Green check (upper-right) on correctly identified panels.
- Red X (upper-right) on incorrectly identified panels.
- All polygon overlays appear simultaneously — correct ones in PRI colors, incorrect ones in `var(--red)` at low opacity.
- Display: accuracy percentage, total time, score.

---

## Structure Set Rules

- Each structure is tested once per session.
- Order randomized each session.
- No repeats within a session.
- Standard Mode: session completion requires all structures to be correctly identified (retry on miss).
- Speed Round: session completion occurs after all structures have been prompted once (one attempt each).
- Session state resets on tab switch or page reload. No persistence.

---

## Scoring

- Score starts at 0.
- Correct answer: +1.
- Incorrect answer: −1.
- Score can go negative.
- Accuracy is tracked separately: (number of structures identified on first attempt) / (total structures).

---

## Visual Styling Rules

### Correct (with PRI hue)

- Panel border: PRI hue for that structure's color family.
- Panel background: PRI hue at ~0.25 alpha.
- Arrow line + arrowhead: PRI hue.
- Polygon overlay on image: PRI hue at ~0.25 alpha, precise muscle boundary trace.
- Green check icon (✓) in upper-right of panel.

### Correct (no PRI hue — bony landmarks)

- Panel border: `var(--pri-neutral)`.
- Panel background: `var(--pri-neutral-bg)`.
- Arrow line + arrowhead: `var(--pri-neutral)`.
- No polygon overlay (bony landmarks don't have traceable muscle boundaries — use a small circle or dot marker at the landmark location instead).
- Green check icon (✓) in upper-right of panel.

### Incorrect (Standard Mode, transient)

- Panel border: `var(--red)` for 1 second, then revert.
- Red X icon (✗) in upper-right of panel for 1 second, then disappear.

### Incorrect (Speed Round, end-of-session reveal)

- Panel border: `var(--red)`.
- Panel background: `var(--error-bg)`.
- Red X icon (✗) in upper-right of panel.

### Text

- Label text color: `var(--text)` (theme-controlled, light/dark mode). Labels do not change color based on PRI hue.
- Only background, border, arrow, polygon overlay, and check/X icon change color.

---

## Muscle Polygon Overlays

Each muscle/ligament structure has a corresponding SVG `<polygon>` element defined by a series of percentage-based coordinate pairs that trace the muscle boundary as it appears in `PRI1Pelvic_Outlet2.jpg`.

### Requirements

- Polygons must precisely follow the visible muscle boundaries in the illustration. No approximate shapes.
- Coordinates are percentages relative to the image container (matching the panel/arrow coordinate system).
- Fill: PRI hue at ~0.25 alpha. Stroke: PRI hue at 0.6 alpha, 1px.
- Initially hidden (`opacity: 0`). On correct identification, fade in with a CSS transition (~300ms ease).
- Persist for the rest of the session once revealed.
- Bony landmarks use a circle marker (r ~2% of image width) at the landmark location instead of a polygon.

### Data Format

```javascript
{
  id: "obturator_internus",
  polygon: [
    [18.5, 42.0], [20.1, 44.3], [22.0, 48.1], /* ... */
  ]
}
```

The polygon coordinate arrays must be authored by examining the image and tracing boundaries. Include these in the structure data alongside `panelBox` and `arrowTo`.

---

## Data Model

```javascript
const ANATOMIZE_DATA = {
  imageId: "pelvic_outlet_2",
  imageSrc: "PRI1Pelvic_Outlet2.jpg",  // embedded as base64
  structures: [
    {
      id: "obturator_internus",
      label: "Obturator Internus",
      colorFamily: "green",         // PRI Frontal Abduction
      priHue: "var(--pri-green-family)",
      priHueBg: "var(--pri-green-family-bg)",
      panelBox: { x: 0, y: 0, w: 0, h: 0 },     // percentage-based
      arrowTo: { x: 0, y: 0 },                     // percentage-based
      polygon: [ /* [x, y] pairs, percentages */ ], // or null for bony landmarks
      landmarkMarker: null                           // { x, y, r } for bony landmarks
    },
    // ... remaining structures
  ]
};
```

All coordinate values (`panelBox`, `arrowTo`, `polygon`, `landmarkMarker`) are percentages (0–100) relative to the image's rendered dimensions.

---

## Feedback Tone

Per CC-BUILD-SPEC.md: clinical and direct. No exclamation points.

- Correct: panel reveals silently. No text toast.
- Incorrect: red flash. No text toast.
- End of session: "Session complete. Score: 10 · Accuracy: 85%." — not "Great job!" or "Well done!".

---

## Code Standards

All code standards from CC-BUILD-SPEC.md apply. Key points for this feature:

- Vanilla JS, `<script type="module">`.
- `addEventListener` only — no `onclick` attributes.
- `textContent` over `innerHTML` wherever possible.
- Module pattern: `const AnatomizeModule = (() => { ... return { init, reset }; })();`
- No global state pollution.
- All colors via CSS custom properties.
- No Enter-to-submit on any inputs.
- Boolean naming: `isCorrect`, `hasAnswered`, `isRevealed`.
- Constants: `UPPER_SNAKE_CASE`. Functions: `camelCase`.

---

## Build Instructions

### Step 1: Trace Polygons

Before writing any game logic, examine `PRI1Pelvic_Outlet2.jpg` and author the polygon coordinate arrays for each muscle/ligament structure. Use the labeled PDF pages (pages 4 and 6 of `Handout_1__Anatomy_Families_by_Color.pdf`) as reference for identifying muscle boundaries on the clean image.

For each muscle:
1. Identify the muscle's visible boundary in the illustration.
2. Trace the boundary as a series of `[x%, y%]` coordinate pairs.
3. Use enough points to follow curves smoothly (15–30 points per muscle is typical).
4. Verify adjacent muscles share boundary edges where they meet (no gaps, no overlaps between polygons).

For bony landmarks, define a `landmarkMarker: { x, y, r }` instead of a polygon.

### Step 2: Author Panel Positions

Place panels following the box placement rules (favor nearest side, no overlap). Author `panelBox` and `arrowTo` for each structure.

### Step 3: Implement the Module

Build `AnatomizeModule` as a closure-based module. It should expose `init()` and `reset()`. Wire it into the existing Anatomy tab's sub-tab switching logic, replacing the current 1A content.

### Step 4: Add PRI Color Custom Properties

Add the `--pri-*` color variables to the existing `:root` and dark mode blocks in the app's `<style>`.

### Step 5: Test

- All 14+ panels render without overlap.
- Arrows point to correct structures.
- Standard Mode: correct answer reveals panel + polygon + advances. Incorrect flashes red + decrements score + retries.
- Speed Round: timer runs, no feedback during play, full reveal at end.
- Mobile: panels render as button list below image.
- Polygon overlays accumulate through session.
- Score and accuracy display correctly.
- Tab switch resets session.
- Light and dark themes render correctly.
- No console errors.