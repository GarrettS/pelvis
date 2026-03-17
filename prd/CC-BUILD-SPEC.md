# CC Build Spec: PRI Pelvis Restoration Study Tool — Unified Build

## What This Is
Merge three existing apps (pri-study-tool.html, pri-decoder.jsx, pri-study-tool.jsx) into one unified vanilla JS single-page application. Add new features, fix existing issues, apply code standards.

## Input Files (all in same directory as this spec)
- `pri-study-tool.html` — most complete app. Vanilla JS + inline data. 1563 lines. Has: nomenclature (layer walkthrough, acronym table, key insight), comprehension (concept map, cheat sheet, causal chains), test prep (pattern identifier 8 scenarios, flashcards 32 cards), practical (case studies, decision tree, muscle map). Dark-only theme, fixed font sizes, uses onclick attributes and innerHTML extensively.
- `pri-decoder.jsx` — React. 606 lines. Has: SVG pelvis schematic (lateral view with inlet/outlet rings, anterior/posterior tilt arrows, landmark labels), equivalence chain display, muscle-to-region mapping, quiz mode. The SVG pelvis diagram is the most valuable component.
- `pri-study-tool.jsx` — React. 1270 lines. Has: image hotspot data (MUSCLE_HOTSPOTS with 12 entries, LANDMARK_HOTSPOTS with 7 entries), nomenclature table, pattern comparison, test reference, treatment hierarchy, quiz. Includes FACILITATION_STEPS and COLOR_FAMILIES data.
- `pri-study-tool-data-v2.json` — canonical data. 962 lines. Contains: acronyms (12), terminology, causalChains (6), game scenarios (8), caseStudies (2), decisionTree, muscleExerciseMap, flashcards (32), translationMap (12).
- `pri-study-tool-prd-v2.md` — original PRD. Reference for section descriptions and design intent. 320 lines.
- `LEARN-PRI.md` — course knowledge file. The authoritative reference for all PRI content. If any data in the app contradicts this file, LEARN-PRI.md wins.
- 4 images (PNG):
  - `1772049130888_image.png` — Veritas anterior hip overview
  - `1772049306371_image.png` — Netter-style anterior pelvis with bony landmarks
  - `1772049358465_image.png` — Lateral hip bone with muscle attachment sites
  - `1772079947458_image.png` — L AIC chain (skeleton with muscles highlighted in red)

## Output
Vanilla JS single-page application. No frameworks, no build tools. ES modules with explicit exports. External stylesheets per domain. JSON-backed content fetched per feature. Hash-routed with lazy initialization. Service worker for offline support. Hosted on GitHub Pages. See `prd/project.md` for directory structure, `code-guidelines.md` for code standards.

---

## Code Standards

Code standards: `code-guidelines.md` (at project root).
Project-specific design (palette, typography, tone, breakpoints): `prd/style-guide.md`.

---

## Navigation — 8 Views

```
Home | Anatomy | Nomenclature | Patterns | Diagnose This! | Flashcards | Equivalence | Master Quiz
```

SPA-style: one section visible at a time. Sticky top nav. Active tab highlighted with accent color + bottom border. Mobile: horizontal scroll, no wrapping.

---

## Tab 1: Anatomy

### 1A: Interactive Images with Hotspots
Three sub-views selectable via button row:
- **Muscle Attachments (Lateral)** — image `1772049358465_image.png`
- **Bony Landmarks (Anterior)** — image `1772049306371_image.png`
- **L AIC Chain** — image `1772079947458_image.png`
- **Hip Overview** — image `1772049130888_image.png`

Each image is displayed with percentage-based clickable hotspot overlays. Clicking a hotspot populates a detail panel below the image.

**Hotspot data for Lateral image (muscle attachments):**
Port the MUSCLE_HOTSPOTS array from pri-study-tool.jsx (12 entries). Each has: id, name, x/y/w/h (percentages), standard action, PRI translation, colorFamily, chain, laic pattern role, treatment info.

**Hotspot data for Anterior image (bony landmarks):**
Port the LANDMARK_HOTSPOTS array from pri-study-tool.jsx (7 entries). Each has: id, name, x/y/w/h, pri_role, joints, laic info.

**L AIC Chain image:** No hotspots needed — this is a reference image showing diaphragm → psoas → iliacus → TFL → vastus lateralis → biceps femoris. Display with caption: "The Anterior Interior Chain (AIC): diaphragm → psoas → iliacus → TFL → vastus lateralis → biceps femoris. Left side shown."

**Detail panel — progressive disclosure (3 layers):**
Layer 1 (on click): muscle name, standard action, PRI translation, color family, chain membership.
Layer 2 ("Show Pattern Role" button): L AIC role for this muscle.
Layer 3 ("Show Treatment" button): facilitation step, exercises, HALT level.

Each layer is revealed by an explicit button press. No nested click ambiguity.

### 1B: SVG Pelvis Decoder
Port the PelvisSchematic component from pri-decoder.jsx, converting from React to vanilla JS SVG generation. This shows:
- Lateral view of hemipelvis with labeled landmarks (ASIS, sacral base, pubic symphysis, acetabulum, ischial tuberosity, coccyx)
- Inlet ring (blue) and outlet ring (orange)
- Neutral ghost (faded) + tilted pelvis (rotated around acetabulum)
- Directional arrows showing ASIS/ischial tuberosity movement
- Ring status labels ("INLET OPENS" / "OUTLET CLOSES")
- Pelvic floor status note

Controls: Side (Left/Right), Reference Frame (IP, IS, IsP, SI, AF, FA), Direction (IR/ER).
Below: equivalence chain display showing all 6 equivalent positions.
Below that: muscles that produce the selected motion.
Bottom: rule callout — "Inlet direction matches femur direction. Outlet is always opposite."

**SVG tilt direction fix:** In the decoder JSX, anterior tilt uses `rotate(14deg)` and posterior tilt uses `rotate(-14deg)` around the acetabulum. Verify that anterior tilt (IP ER) rotates the ASIS forward-down (clockwise in lateral view) and posterior tilt (IP IR) rotates ASIS backward-up. The user reported these might be flipped — check and correct if needed. The arrow labels ("ASIS drops forward" for anterior tilt, "ASIS rises backward" for posterior tilt) must match the rotation direction.

---

## Tab 2: Nomenclature

### 2A: The Two Real Joints — Layer Walkthrough
Port from pri-study-tool.html Section 1A. Three layers (Structure → Mechanics → PRI Overlay), each revealed by "Next" button. Uses the inline SVG schematics (SI_SVG and HIP_SVG) from the HTML file. Keep layer progression exactly as-is, but move the buttons so for the nomenclature tab. Nomenclature tab is to have actuators to expand the next level of detail proximally located and appropriately labeled that section. (This feature is currently shown as "← Prev Next →" and not located near just above the next expandable section.)

### 2B: Translation Table
Port from pri-study-tool.html Section 1B. 6-column table (PRI Term, Real Structure, What PRI Renamed, What Actually Happened, Standard Term, Encoded Treatment Target). Search/filter input above. Data source: `translationMap` array from the JSON. Keep the explanatory callout at the top.

On mobile (<600px): render each row as a stacked card instead of a table.

### 2C: Key Distinction
Port from pri-study-tool.html Section 1C. Static callout. No changes needed.

---

## Tab 3: Patterns

### 3A: Pattern Comparison Cheat Sheet
Port from pri-study-tool.html Section 2B (cheat sheet). Three columns: Left AIC | Bilateral PEC | Bilateral Patho PEC. Highlight the 3 Patho distinguishing tests (PART, SRT, Squat) with accent/warn color.

### 3B: Concept Map
Port from pri-study-tool.html Section 2A. Interactive node map. Click node → highlight connections. Keep existing implementation.

### 3C: Symptom-to-Pattern Mapping (NEW)
Interactive matching exercise. Present a clinical condition, user picks the pattern and explains why. Data: `data/symptom-patterns.json`. UI: Present condition as a card. Three answer buttons (Left AIC / Bilateral PEC / B Patho PEC). After answer: show correct/incorrect + explanation. "Next" button advances. Running score.

### 3D: Test Reference
Port test data and display from the existing apps. Include the test profiles table (ADT, PADT, PART, SRT, Squat, HALT by pattern). Add HALT level details and Squat level details as expandable sections.

**HALT Level Quiz (NEW):**
"Patient fails HALT at level 2. What does this mean?"
→ "Poor IC adductor/anterior glute med. Can't achieve outlet abduction of flexed leg."
→ "Facilitate: IC adductor + anterior glute med."
6 levels (0-5), each a quiz card.

Canonical data: `data/halt-levels.json` and `data/squat-levels.json`. See `prd/cc-prd-test-level-fix.md` for schema and content rationale.

---

## Tab 4: Diagnose This!

### 4A: Pattern Identifier (2-Round Game)
Port from pri-study-tool.html Section 3A. 8 scenarios. Round 1: identify pattern from test profile. Round 2: 3 sub-questions (repositioning, post-reposition program, facilitation/clinical question).

**Changes from existing:**
- After the student submits each answer, show: correct/incorrect result + correct answer + explanation of what pathology this leads to and/or corrects. The existing explanations already do this — keep them.
- Running score displayed.
- Progress indicator: "Scenario 3 of 8"

### 4B: Case Studies
Port from pri-study-tool.html Section 4A. Two cases (B PEC 6 visits, L AIC 3 visits). Interactive — user makes decisions at each visit, sees result with explanation.

### 4C: Causal Chains
Port from pri-study-tool.html Section 2C. Drag-to-order exercises. 6 chains. Mobile: tap-to-order fallback.

### 4D: Decision Tree
Port from pri-study-tool.html Section 4B. Interactive expandable flowchart. Keep existing implementation.

**Change:** At terminal nodes that reference "Myokinematic Restoration & Postural Respiration", append "(out of scope for this course)".

### 4E: Muscle-to-Exercise Map
Port from pri-study-tool.html Section 4C. Two views (by muscle, by finding). Search/filter input.

---

## Tab 5: Flashcards

Port flashcard data from pri-study-tool-data-v2.json (32 cards). Merge in the 10 decoder quiz questions from pri-decoder.jsx (deduplicate if overlap).

**Changes from existing:**
1. **No click-to-flip.** Use explicit buttons:
   - "Flip" button reveals the answer.
   - "Show More" button (where applicable) reveals extended detail.
   - "Got It" removes card from deck.
   - "Again" returns card to deck.
2. **Progressive disclosure on card back:** Some cards have layered information. Use reveal buttons within the answer panel, not nested card clicks.
3. **Difficulty adjustment:** Cards referencing material not covered in the seminar (e.g., "Respiratory Test Clustering") should have clearer, more clinically relevant titles and simplified answers. Specifically:
   - "Respiratory Test Clustering" → retitle to "PADT-Respiratory Link" with answer: "Positive PADT predicts positive posterior outlet mediastinum expansion test and positive contralateral apical expansion test. The same pelvic position (outlet closure, pelvic diaphragm descent) drives all three failures."
   - Facilitation Step 3 → clarify answer: "Step 3: L posterior inlet (IS ER). Facilitate L iliacus (proximal, for inlet adduction) + L gluteus medius (for counter-nutation). This step corrects the left ilium's nutation on the sacrum. Test markers: +L PADT persists, −R PART achieved, R HALT reaches 2/5."
   - "L IsP IR" card → clarify the correction: "Corrected by facilitating L pelvic floor muscles (obturator internus, iliococcygeus, puborectalis, pubococcygeus) accessed via L adductor activation. This is facilitation Step 2 — the adductors create femoral adduction which, in closed chain, activates the pelvic floor to pull ischial tuberosities apart (outlet abduction = IsP ER)."
4. **Acronym tooltips/hints:** Every initialism on the card front should have a subtitle hint. Examples:
   - Front: "L PADT" → subtitle: "(Left Pelvic Ascension Drop Test)"
   - Front: "B PEC" → subtitle: "(Bilateral Posterior Exterior Chain)"
   - Front: "IsP IR" → subtitle: "(Ischio-Pubo Internal Rotation)"

**All course initialisms that must appear as flashcards (add if missing):**
- AIC = Anterior Interior Chain
- PEC = Posterior Exterior Chain
- BC = Brachial Chain (note: out of scope for exam, but define it)
- B PEC = Bilateral PEC
- B Patho PEC = Bilateral Pathological PEC
- ZOA = Zone of Apposition
- ADT = Adduction Drop Test
- PADT = Pelvic Ascension Drop Test
- PART = Passive Abduction Raise Test
- SRT = Standing Reach Test
- HALT = Hruska Abduction Lift Test
- IP = Ilio-Pubo (Anterior Inlet)
- IS = Ilio-Sacral (Posterior Inlet)
- IsP = Ischio-Pubo (Anterior Outlet)
- SI = Sacro-Ilio (Posterior Outlet)
- AF = Acetabular-Femoral (pelvis-on-femur)
- FA = Femoral-Acetabular (femur-on-pelvis)
- IO = Internal Oblique
- TA = Transversus Abdominis
- IAP = Intra-Abdominal Pressure
- FEV = Forced Expiratory Volume
- FVC = Forced Vital Capacity
- SUI = Stress Urinary Incontinence
- ASLR = Active Straight Leg Raise
- COG = Center of Gravity

Display: "12 of 38 remaining". Deck shuffled on session start. "Reset Deck" button.

---

## Tab 6: Master Equivalence

Standalone interactive matching test. This is the "Rosetta Stone" of PRI nomenclature.

### How It Works
1. Present a position, e.g., "L IP ER"
2. Show 4 option cards. Zero or more may be correct.
3. User must select ALL correct answers and NONE of the wrong answers to pass.
4. After submit: show result with explanation.

### Question Pool
The master equivalence rule: `L IP ER = L IS IR = L IsP IR = L SI IR = L AF ER`
And the inverse: `L IP IR = L IS ER = L IsP ER = L SI ER = L AF IR`
Plus right-side versions.

Generate questions dynamically:
- Given "L IP ER", present 4 options: "L IS IR" (correct), "L IsP ER" (wrong — outlet is opposite), "L AF ER" (correct), "R IP ER" (wrong — different side)
- Given "R SI IR", present: "R IsP IR" (correct — same outlet closing), "R IP IR" (wrong — inlet is opposite of outlet), "R IS ER" (wrong), "R AF ER" (wrong)

Minimum 12 questions per session. Shuffle. Display each equivalence on its own line for readability:
```
L IP ER
= L IS IR
= L IsP IR
= L SI IR  
= L AF ER
```

**Key rule to display prominently at top:**
"Inlet direction matches femur direction. Outlet direction is always opposite."

Running score. Reset button.

---

## Acronym Tooltips (GLOBAL)

Every acronym throughout the entire app should have hover/click tooltip expansion. Implementation: wrap each acronym in `<abbr title="...">` or a custom `<span class="abbr" data-full="...">` with CSS tooltip on hover and tap-to-reveal on mobile.

This applies in: flashcard fronts/backs, test profile displays, pattern descriptions, decision tree text, case study text, equivalence displays. Everywhere.

---

## Data Strategy

1. Start with `pri-study-tool-data-v2.json` as the base. Inline it as `const DATA = { ... };` at the top of the script.
2. Add the new data structures defined in this spec: SYMPTOM_PATTERNS, HALT_LEVELS, SQUAT_LEVELS, MUSCLE_HOTSPOTS, LANDMARK_HOTSPOTS, and the master equivalence question generator.
3. Add the decoder data: REGIONS array, getAllEquivalent() function, getTriplanar() function, getMuscles() function — all from pri-decoder.jsx.
4. Merge flashcard sets: 32 from JSON + decoder quiz questions (deduplicated) + any missing initialisms from the list above.
5. For any content conflict between the data files and LEARN-PRI.md, LEARN-PRI.md wins.

## Images

Embed all 4 PNGs as base64 data URIs. Read each file, convert to base64, insert as `src="data:image/png;base64,..."` on the appropriate `<img>` tags.

Command per image:
```bash
base64 -w 0 FILENAME.png
```

---

## Content Adjustments

1. **Out-of-scope references:** Keep mentions of "Myokinematic Restoration & Postural Respiration" in decision tree and treatment algorithms, but append "(out of scope)" wherever they appear.
2. **Remove truly out-of-scope material:** Do not include Brachial Chain details beyond defining the acronym. Do not include hormonal/diet/psychosocial content. Do not include A-B-A design details beyond one flashcard.
3. **Respiratory tests:** One flashcard on the PADT-respiratory link. Do not include detailed apical expansion or posterior outlet mediastinum expansion test procedures.

---

## Build Order

1. Create the HTML shell with `<style>` (all CSS including theme, fonts, layout, component styles, responsive breakpoints).
2. Create the `<script type="module">` block. Define all data objects at top.
3. Build the navigation module (tab switching, active state).
4. Build each tab's module in order: Anatomy, Nomenclature, Patterns, Diagnose This!, Flashcards, Equivalence.
5. Wire up init on DOMContentLoaded.
6. Embed images as base64.
7. Test both light and dark themes.
8. Verify all event listeners (no onclick attributes remain).
9. Verify Enter key prevention on all inputs.
10. Verify all acronyms have tooltips.

## Testing Checklist
- [ ] All 6 tabs switch correctly
- [ ] Light theme renders (test with `prefers-color-scheme: light`)
- [ ] Dark theme renders (test with `prefers-color-scheme: dark`)
- [ ] Image hotspots click and show detail panel
- [ ] SVG decoder controls work (side, region, direction)
- [ ] SVG anterior tilt shows ASIS dropping forward (confirm not flipped)
- [ ] Flashcards: Flip button reveals answer, Got It / Again buttons work
- [ ] Pattern Identifier: all 8 scenarios complete with Round 2
- [ ] Master Equivalence: questions generate, multi-select works, scoring works
- [ ] Causal chains: drag-to-order works
- [ ] Decision tree: branches expand/collapse
- [ ] Mobile: tabs scroll, tables stack, images scale
- [ ] No console errors
- [ ] No network requests (check DevTools Network tab)
- [ ] Enter key doesn't submit in any input
- [ ] All acronyms have tooltip expansion
