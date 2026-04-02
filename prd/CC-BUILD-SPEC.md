# Feature Spec: PRI Pelvis Restoration Study Tool

## What This Is
A SPA for PRI Pelvis Restoration certification exam preparation. See `prd/project.md` for architecture, directory structure, and content authority. See `~/.web-xp/code-guidelines.md` for code standards. See `prd/style-guide.md` for design tokens.

---

## Anatomy Tab

### Anatomize This
Interactive anatomy explorer with image-based hotspots and detail panels. See `prd/anatomize-this.md` for full specification.

Data: `data/anatomize-data.json`. Images in `img/`.

### SVG Pelvis Decoder
Interactive SVG pelvis schematic showing:
- Lateral view of hemipelvis with labeled landmarks (ASIS, sacral base, pubic symphysis, acetabulum, ischial tuberosity, coccyx)
- Inlet ring (blue) and outlet ring (orange)
- Neutral ghost (faded) + tilted pelvis (rotated around acetabulum)
- Directional arrows showing ASIS/ischial tuberosity movement
- Ring status labels ("INLET OPENS" / "OUTLET CLOSES")
- Pelvic floor status note

Controls: Side (Left/Right), Reference Frame (IP, IS, IsP, SI, AF, FA), Direction (IR/ER).
Below: equivalence chain display showing all equivalent positions.
Below that: muscles that produce the selected motion.
Bottom: rule callout — "Inlet direction matches femur direction. Outlet is always opposite."

SVG tilt direction: anterior tilt (IP ER) rotates ASIS forward-down (clockwise in lateral view). Posterior tilt (IP IR) rotates ASIS backward-up. Arrow labels must match rotation direction.

### L AIC Chain
Reference image (`img/left-aic.png`) showing diaphragm → psoas → iliacus → TFL → vastus lateralis → biceps femoris. Caption: "The Anterior Interior Chain (AIC): diaphragm → psoas → iliacus → TFL → vastus lateralis → biceps femoris. Left side shown."

---

## Nomenclature Tab

### The Two Real Joints — Layer Walkthrough
Three layers (Structure → Mechanics → PRI Overlay), each revealed by a button. Uses inline SVG schematics (SI joint, hip joint). Expand buttons are proximally located near the next expandable section, not at the bottom.

### Translation Table
6-column table: PRI Term, Real Structure, What PRI Renamed, What Actually Happened, Standard Term, Encoded Treatment Target. Search/filter input above. Explanatory callout at top.

Data: `translationMap` from `data/study-data.json`.

On mobile (<600px): render each row as a stacked card.

### Key Distinction
Static callout — the difference between PRI nomenclature and standard anatomical terminology.

---

## Patterns Tab

### Pattern Comparison Cheat Sheet
Three columns: Left AIC | Bilateral PEC | Bilateral Patho PEC. The 3 Patho-distinguishing tests (PART, SRT, Squat) highlighted with accent/warn color.

Data: `data/cheat-data.json`.

### Symptom-to-Pattern Mapping
Interactive matching exercise. Present a clinical condition; user picks the pattern. Three answer buttons (Left AIC / Bilateral PEC / B Patho PEC). After answer: correct/incorrect + explanation. Running score.

Data: `data/symptom-patterns.json`.

### Test Reference
Test profiles table (ADT, PADT, PART, SRT, Squat, HALT by pattern). HALT level details and Squat level details as expandable sections.

**HALT Level Quiz:**
"Patient fails HALT at level 2. What does this mean?" 6 levels (0–5), each a quiz card.

Data: `data/halt-levels.json` and `data/squat-levels.json`. See `prd/cc-prd-test-level-fix.md` for schema and content rationale.

---

## Diagnose This! Tab

### Pattern Identifier (2-Round Game)
8 scenarios. Round 1: identify pattern from test profile. Round 2: 3 sub-questions (repositioning, post-reposition program, facilitation/clinical question). After each answer: correct/incorrect + explanation. Running score. Progress indicator: "Scenario 3 of 8".

### Case Studies
Two cases (B PEC 6 visits, L AIC 3 visits). Interactive — user makes decisions at each visit, sees result with explanation.

### Causal Chains
Drag-to-order exercises. 6 chains. Mobile: tap-to-order fallback.

Data: `data/causal-map.json`.

### Decision Tree
Interactive expandable flowchart. Terminal nodes referencing "Myokinematic Restoration & Postural Respiration" append "(out of scope for this course)".

### Muscle-to-Exercise Map
Two views (by muscle, by finding). Search/filter input.

---

## Flashcards Tab

Deck of flashcards covering PRI concepts, test interpretation, facilitation steps, and initialisms.

**Interaction model:**
- "Flip" button reveals the answer (no click-to-flip).
- "Show More" button (where applicable) reveals extended detail.
- "Got It" removes card from deck.
- "Again" returns card to deck.

**Progressive disclosure on card back:** Layered information uses reveal buttons within the answer panel, not nested card clicks.

**Difficulty adjustment:** Cards referencing material not covered in the seminar should have clearer, more clinically relevant titles and simplified answers. Specifically:
- "Respiratory Test Clustering" → retitle to "PADT-Respiratory Link" with answer: "Positive PADT predicts positive posterior outlet mediastinum expansion test and positive contralateral apical expansion test. The same pelvic position (outlet closure, pelvic diaphragm descent) drives all three failures."
- Facilitation Step 3 → clarify answer: "Step 3: L posterior inlet (IS ER). Facilitate L iliacus (proximal, for inlet adduction) + L gluteus medius (for counter-nutation). This step corrects the left ilium's nutation on the sacrum. Test markers: +L PADT persists, −R PART achieved, R HALT reaches 2/5."
- "L IsP IR" card → clarify the correction: "Corrected by facilitating L pelvic floor muscles (obturator internus, iliococcygeus, puborectalis, pubococcygeus) accessed via L adductor activation. This is facilitation Step 2 — the adductors create femoral adduction which, in closed chain, activates the pelvic floor to pull ischial tuberosities apart (outlet abduction = IsP ER)."

**Initialism tooltips/hints:** Every initialism on the card front should have a subtitle hint. Examples:
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

Data: `data/flashcard-deck.json`. Display: "12 of 38 remaining". Deck shuffled on session start. "Reset Deck" button.

---

## Equivalence Tab

Standalone interactive matching test — the "Rosetta Stone" of PRI nomenclature. See `prd/CC-BUILD-SPEC-equiv-quiz.md` for detailed spec including bug fixes and enriched feedback.

### How It Works
1. Present a position, e.g., "L IP ER"
2. Show 4 option cards. User must select ALL correct answers and NONE of the wrong answers to pass.
3. After submit: show result with explanation.

### Question Pool
The master equivalence rule: `L IP ER = L IS IR = L IsP IR = L SI IR = L AF ER`
And the inverse: `L IP IR = L IS ER = L IsP ER = L SI ER = L AF IR`
Plus right-side versions. FA is excluded from equivalence chains (see equiv-quiz spec).

Questions generated dynamically. Minimum 12 per session. Shuffle.

**Key rule displayed prominently at top:**
"Inlet direction matches femur direction. Outlet direction is always opposite."

Running score. Reset button. Completion review screen with retake-missed.

---

## Master Quiz Tab

Cross-domain quiz drawing questions from all feature areas. Configurable session size. Completion review screen with score breakdown, incorrect/correct sections, and retake-missed.

Data: `data/master-quiz.json`.

---

## Initialism Tooltips (Global)

Every initialism throughout the entire app has hover/click tooltip expansion. Implementation: `abbr-expand.js` wraps initialisms in `<abbr title="...">` at render time. On supported browsers, `abbr-popover.js` progressively enhances with positioned popovers. See `prd/project.md` for architecture details.

---

## Data Strategy

1. App data belongs in HTML or JSON, not in JS. JS is for behavior.
2. Data structures (quiz questions, hotspot definitions, flashcards, level descriptions, etc.) live in JSON files in `data/`.
3. Decoder logic (equivalence rules, triplanar mappings, muscle lookups) lives in feature-specific JS modules.

Content authority is defined in `prd/project.md`.

## Images

All images are external files in `img/`. Referenced by `src` attribute in HTML or constructed in JS. No base64 embedding.

---

## Content Adjustments

1. **Out-of-scope references:** Keep mentions of "Myokinematic Restoration & Postural Respiration" in decision tree and treatment algorithms, but append "(out of scope)" wherever they appear.
2. **Remove truly out-of-scope material:** Do not include Brachial Chain details beyond defining the initialism. Do not include hormonal/diet/psychosocial content. Do not include A-B-A design details beyond one flashcard.
3. **Respiratory tests:** One flashcard on the PADT-respiratory link. Do not include detailed apical expansion or posterior outlet mediastinum expansion test procedures.

---

## Testing Checklist
- [ ] All 8 tabs switch correctly
- [ ] Light theme renders (test with `prefers-color-scheme: light`)
- [ ] Dark theme renders (test with `prefers-color-scheme: dark`)
- [ ] Anatomize This: images load, hotspots click, detail panel populates
- [ ] SVG decoder controls work (side, region, direction)
- [ ] SVG anterior tilt shows ASIS dropping forward (confirm not flipped)
- [ ] Flashcards: Flip button reveals answer, Got It / Again buttons work
- [ ] Pattern Identifier: all 8 scenarios complete with Round 2
- [ ] Equivalence Quiz: questions generate, multi-select works, scoring works
- [ ] Causal chains: drag-to-order works
- [ ] Decision tree: branches expand/collapse
- [ ] Mobile: tabs scroll, tables stack, images scale
- [ ] No console errors
- [ ] Enter key doesn't submit in any input
- [ ] All initialisms have tooltip expansion
