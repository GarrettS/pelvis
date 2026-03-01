# PRD: PRI Pelvis Restoration Study Tool

## Purpose
Interactive single-page HTML app for studying the PRI Pelvis Restoration course. Designed for physical therapy professionals preparing for the post-course exam (March 9, 2026). Serves four goals in priority order:

1. **Nomenclature clarity** — untangle PRI's proprietary terminology from standard kinesiology. Separate structure (joints) from mechanics (muscles/forces). Reconcile the two systems.
2. **Comprehension** — progressive depth: connect pieces → hold the whole system → trace causal chains.
3. **Test prep** — pattern identification, treatment selection, decision tree navigation.
4. **Practical application** — case walkthroughs, clinical decision trees, muscle-to-exercise mapping.

## Technical Constraints
- Single self-contained HTML file. All CSS in `<style>`, all JS and data in `<script>`.
- No frameworks, no build step, no external APIs.
- **No third-party font loading, no Google Fonts, no CDN requests, no trackers of any kind.** Use system font stacks only:
  - Monospace: `ui-monospace, 'Cascadia Code', 'SF Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, monospace`
  - Serif: `Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif`
  - Sans: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Zero network requests after initial page load. Fully offline-capable.
- Runs entirely client-side. Will be hosted on Netlify Drop (drag-and-drop deploy).
- Enter key in any text input must NOT submit forms or trigger page reload.

## Design System

**Light-dark adaptive theme using `prefers-color-scheme`.** Define all colors as CSS custom properties on `:root` (light default) and override in `@media (prefers-color-scheme: dark)`. The user's OS setting controls the theme automatically. No manual toggle needed.

Light mode (default):
- --bg: #ffffff, --surface: #f5f5f0, --surface2: #eaeae5, --border: #d0d0c8
- --text: #1a1a1a, --text-dim: #6b6b6b, --accent: #1a7a5a, --accent-dim: #b0d8c8
- --warn: #b87a20, --error: #c03030
- --inlet: #2a6a9a, --outlet: #9a5a2a

Dark mode:
- --bg: #1a1c1b, --surface: #242826, --surface2: #2e3230, --border: #3a403e
- --text: #d4dbd6, --text-dim: #7a8a82, --accent: #3aaa80, --accent-dim: #2a6a50
- --warn: #d49540, --error: #d05050
- --inlet: #5ea8d4, --outlet: #d4815e

All color references in CSS must use `var(--name)`, never hardcoded hex values. This applies to backgrounds, text, borders, accents, and the inlet/outlet color coding.

- Monospace headings (system monospace stack), serif body text (system serif stack)
- Responsive: must work on phone (portrait, 375px+). Tables stack vertically on mobile.
- Tone: clinical and direct. No exclamation points. "Correct." not "Great job!" Professional CE tone.

## Navigation
Top navbar with section links. SPA-style tab switching (one section visible at a time, no routing library). Sections correspond to the four goals. Active tab highlighted. Mobile: horizontal scrollable tab bar or hamburger menu.

---

## Section 1: Nomenclature (Goal 1)

This section teaches the user to separate structure from mechanics, then shows how PRI's naming maps onto both.

### 1A: Anatomical Joints and PRI's Renamed Versions

A guided walkthrough. The pelvis has two anatomical joints relevant to this course: the sacroiliac joint and the hip joint. PRI renames each into two versions, creating four PRI joint names from two actual joints. This walkthrough starts with the anatomy, then layers PRI's naming on top so you can see exactly what was renamed and why.

Three progressive layers, each building on the previous. User advances with a "Next" button. Each layer adds information to the same visual layout so the user sees knowledge accumulating, not replacing.

**Layer 1 — Structure (what exists):**

Two panels side by side (stacked on mobile). One per joint:

- **Sacroiliac joint:** Where the ilium meets the sacrum. Synovial joint, minimal ROM (a few degrees). Permits the ilium and sacrum to rotate relative to each other in a small arc. The two named positions: nutation (sacral base ends up relatively forward compared to the ilium) and counter-nutation (sacral base ends up relatively backward). Plain English: nutation = the sacrum "nods yes" relative to the ilium. Counter-nutation = the "un-nod."
- **Hip joint:** Where the acetabulum meets the femoral head. Ball and socket, large ROM in all three planes. In open chain (leg off ground), the femur moves relative to pelvis. In closed chain (foot planted), the pelvis moves relative to femur. Both bones are always capable of moving — which one moves more depends on loading, not on the joint itself.

Anatomical images: Do NOT draw anatomy with SVG or canvas. Do not attempt schematic diagrams of joints. Use real CC-licensed anatomical illustrations, fetched, compressed, and embedded as base64 data URIs.

**Image sourcing instructions (for the build tool):**

1. **Sacroiliac joint image:** Download from Injurymap (CC BY 4.0):
   `curl -o si-joint.jpg "https://injurymap.com/wp-content/uploads/2024/01/Sacroiliac_Joint_v1-08-scaled.jpg"`
   - Resize to max 600px wide: `convert si-joint.jpg -resize 600x -quality 80 si-joint-sm.jpg` (requires ImageMagick; if unavailable, use: `python3 -c "from PIL import Image; img=Image.open('si-joint.jpg'); img.thumbnail((600,600)); img.save('si-joint-sm.jpg', quality=80)"`)
   - Convert to base64: `base64 -i si-joint-sm.jpg` (macOS) or `base64 si-joint-sm.jpg` (Linux)
   - Embed as: `<img src="data:image/jpeg;base64,{BASE64_STRING}" alt="Sacroiliac joint — where the ilium meets the sacrum. Illustration by Injurymap, CC BY 4.0.">`
   - Attribution (must appear near the image): `Illustration: <a href="https://www.injurymap.com/free-human-anatomy-illustrations">Injurymap</a>, CC BY 4.0`

2. **Hip joint image:** Download from OpenStax via Wikimedia Commons (CC BY):
   `curl -o hip-joint.jpg "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/909_Hip_Joint.jpg/800px-909_Hip_Joint.jpg"`
   - Resize to max 600px wide, same method as above.
   - Convert to base64 and embed as: `<img src="data:image/jpeg;base64,{BASE64_STRING}" alt="Hip joint — ball-and-socket joint where the acetabulum meets the femoral head. From OpenStax Anatomy and Physiology, CC BY.">`
   - Attribution: `Illustration: OpenStax Anatomy and Physiology, <a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints">fig. 9.18</a>, CC BY`

3. **If either download fails or the image is unavailable:** Use a placeholder div styled as a bordered box (border: 1px dashed var(--text-dim), padding 2rem, text-align center) with the text "Image unavailable — see [source URL]" and the attribution link. Do NOT attempt to draw the anatomy.

4. **If ImageMagick and Pillow are both unavailable:** Embed the full-resolution image. File size may be 200-500KB per image. This is acceptable — total HTML file under 2MB is fine.

**Layer 2 — Mechanics (what moves the bones):**

Same two panels. Below each joint's structural description, add the muscle groups that act on that joint. Organized by what the muscle does, not by PRI's naming:

Sacroiliac joint muscles:
- Muscles that pull the ilium forward (toward nutation): psoas, iliacus, rectus femoris
- Muscles that pull the ilium backward (toward counter-nutation): gluteus medius, hamstrings
- Muscles that act on the sacrum: gluteus maximus (pulls sacrum backward), piriformis (stabilizes or pulls sacrum forward), coccygeus (controls coccyx)

Hip joint muscles:
- Muscles that move the pelvis on the femur (closed chain): IO/TA (posterior tilt), proximal iliacus (inlet adduction), gluteus medius (frontal plane stabilizer), hamstrings (posterior tilt via ischium), adductors (connect to pelvic floor)
- Muscles that move the femur on the pelvis (open chain): standard hip flexors, extensors, abductors, adductors, rotators
- Pelvic floor muscles (outlet control): obturator internus, iliococcygeus, puborectalis, pubococcygeus

**Layer 3 — PRI's Naming (the overlay):**

Same two panels. Now add PRI's acronym labels to each joint, showing how PRI splits one structural joint into two named versions:

Sacroiliac joint becomes:
- IS (Ilio-Sacral) — PRI uses this at the "posterior inlet." Means: PRI considers the ilium the displaced bone. Treatment targets ilium-movers (glute med, iliacus).
- SI (Sacro-Ilio) — PRI uses this at the "posterior outlet." Means: PRI considers the sacrum the displaced bone. Treatment targets sacrum-movers (glute max, piriformis, coccygeus).
- Callout: "Same joint, two names. The name tells you which bone PRI wants you to target."

Hip joint becomes:
- AF (Acetabular-Femoral) — PRI uses this when the pelvis moved on the femur. Closed-chain perspective.
- FA (Femoral-Acetabular) — PRI uses this when the femur moved on the pelvis. Open-chain perspective. Used in treatment positions, not as a pathological finding.
- Callout: "Same joint, two names. AF = fix the pelvis position. FA = the femur is being positioned for treatment."

### 1B: The Translation Table (PRI → Standard Kinesiology)

**Display this introductory callout at the top of Section 1B, styled as a callout box with accent border:**

"Why this table exists: PRI's naming system is designed for clinical efficiency — the acronym tells you which bone to target and what to do. It works. Practitioners use it daily to get results. The problem is that it's hard to learn, because PRI encodes clinical decisions (which bone is displaced, what treatment to use) directly into structural terminology (joint names). If you already know standard anatomy, this creates a collision: the same words mean different things, and new terms appear for structures that already have names. This table doesn't replace PRI's system. It adds a translation layer underneath it. For each PRI term, it shows: which real anatomical structure PRI is referring to, what PRI renamed and why, which muscles actually caused the displacement (information the acronym doesn't carry), and what the conventional kinesiology term would be for the same position. The goal: when you see 'IS IR' on the exam or in clinic, you don't just know 'that's nutation' — you know why PRI called it IS instead of SI, which muscles pulled the ilium there, and what you'd call it if you were talking to a colleague who doesn't speak PRI."

This is the core untangling tool. PRI creates new terms for existing anatomical structures by encoding functional/clinical conclusions into the structure name. This table decomposes each PRI term into four explicit layers so the user can see exactly what PRI did, what it maps to in standard anatomy, and what's lost or added in the translation.

**The problem this solves:** PRI takes a static structure (the SI joint) and renames it based on which bone they think moved (IS or SI). This conflates structure with function — the joint didn't change, only the clinical interpretation of what happened at that joint. Rather than clarifying movement, this overloads structural terms with functional implications that are lossy (you can't recover "which muscles caused it" from the acronym alone). This table adds the lost information back.

**Table columns (6 columns, each a distinct layer):**

1. **PRI Term** — the acronym and full PRI name (e.g., IS IR = Ilio-Sacral Internal Rotation)
2. **Real Structure** — the actual anatomical joint this refers to, by its standard name (e.g., "Sacroiliac joint" — not "ilio-sacral" or "sacro-ilio")
3. **What PRI Renamed** — what PRI changed and why. Explicitly state: "PRI reversed the joint name to IS (ilium-on-sacrum) to encode that the ilium is the displaced bone." This is the layer where the obfuscation happens, so name it clearly.
4. **What Actually Happened (Muscles)** — which muscles caused this displacement. This is what PRI's naming system loses. (e.g., "Psoas and iliacus pulled the ilium forward relative to the sacrum, producing nutation at the SI joint.")
5. **Standard Kinesiology Term** — the conventional name for the resulting joint position (e.g., "Nutation" or "Anterior pelvic tilt"). If there is no standard equivalent (e.g., IP ER has no single standard term), state that explicitly: "No single standard term. PRI is describing tri-planar innominate motion (anterior tilt + abduction + external rotation) as one event."
6. **PRI's Encoded Treatment Target** — what the acronym is designed to tell the clinician to do (e.g., "IS = target the ilium. Facilitate L gluteus medius to counter-nutate.")

**Search/filter input above the table.** Filters across all columns. No form submission on Enter.

**Data source:** `data.json` → `translationMap` array.

**Design note:** This table is wide (6 columns). On mobile (<600px), render each row as a stacked card (label: value pairs) rather than forcing horizontal scroll. On desktop, use a standard table with the first two columns (PRI Term, Real Structure) frozen/sticky if horizontal scrolling is needed.

### 1C: The Key Distinction (Persistent Callout)

A persistent or easily accessible callout panel at the top or bottom of Section 1 that states the core insight:

"Joints are passive structures. They permit motion along certain axes. They do not produce motion. Muscles, gravity, and momentum produce motion. PRI's acronym system encodes a clinical conclusion (which bone is displaced) into a joint name (IS vs. SI, AF vs. FA). This conflates the result — which bone ended up out of position — with the structure — the joint. The acronyms are treatment codes disguised as anatomical terms. IS = 'target the ilium.' SI = 'target the sacrum.' AF = 'target the pelvis over the femur.' FA = 'the femur is being moved.'"

---

## Section 2: Comprehension (Goal 2)

Progressive depth. Three tiers, each accessible independently (not locked behind previous tiers — the user may jump around).

### 2A: Connect the Pieces

Interactive concept map. The user sees core elements as clickable nodes in a spatial layout. Clicking a node highlights all connected nodes and shows labeled edges explaining the relationship.

Nodes:
- Left hemidiaphragm weakness
- Left psoas/iliacus shortening
- Left innominate anterior tilt (IP ER)
- Left SI joint nutation (IS IR)
- Left outlet closure (IsP IR)
- Left pelvic floor descent
- Left IO/TA weakness
- Spine rightward orientation
- Right compensatory position

Edges: directional arrows with short labels like "pulls ilium forward," "loses ZOA," "no opposition from IO/TAs."

Implementation: positioned divs in a container with SVG overlay for arrows. Clicking a node adds `.active` class, JS highlights connected nodes. No graph library needed.

### 2B: Hold the System (Cheat Sheet)

A single reference view displaying all three patterns simultaneously, side-by-side, with every relevant data point. Everything on one screen (scrollable).

Three columns (stacked on mobile): Left AIC | Bilateral PEC | Bilateral Patho PEC.

Per pattern:
- Inlet positions (L and R)
- Outlet positions (L and R)
- Pelvic floor state
- IO/TA state
- ZOA state
- Symmetry
- All 6 test expected results (ADT, PADT, PART, SRT, Squat, HALT)
- Repositioning techniques (3)
- Post-repositioning decision
- Treatment hierarchy summary

Highlight the three B PEC vs. B Patho PEC distinguishing tests (PART, SRT, Squat) with accent color or bold. Mnemonic: "Patho = Paradoxical performance."

### 2C: Trace the Causal Chain

Interactive "why does X lead to Y" exercises. Present a starting condition and ending condition. User arranges intermediate steps in correct order.

Example:
- Start: "Left hemidiaphragm loses ZOA"
- End: "Positive left ADT"
- Correct sequence: "Left psoas/iliacus shorten" → "Left innominate pulled into anterior tilt" → "Left acetabulum rotates forward on femur" → "Femoral head impinges on acetabular rim" → "Femur can't adduct in sidelying" → "Positive left ADT"

Implementation: drag-and-drop ordering on desktop (native HTML drag-and-drop API: `draggable`, `dragover`, `drop`). Mobile fallback: numbered tap-to-order (tap items in sequence, they stack into an ordered list).

6-8 causal chain exercises. Data in `data.json` → `causalChains` array. Each has: startCondition, endCondition, steps (array in correct order), and annotations (explanation per step shown after completion).

---

## Section 3: Test Prep (Goal 3)

### 3A: Pattern Identifier → Diagnose This (Progressive Game)

Two-round game. Round 1 success unlocks Round 2 for that scenario.

**Round 1: Pattern Identifier.** Present a test profile table (ADT, PADT, PART, SRT, Squat, HALT values). Three answer buttons: Left AIC | Bilateral PEC | Bilateral Patho PEC. On correct: show explanation, then "Continue to Treatment" button. On incorrect: show correct answer with explanation, allow advancing to next scenario.

**Round 2: Diagnose This.** Three sequential sub-questions per scenario:
a. "Which repositioning techniques?" — select 3 from a list of 6 (checkboxes, confirm button)
b. "Post-repositioning, [test results]. What program?" — select 1 from 3 options
c. Pattern-specific question (first facilitation step, balloon vs. straw, hierarchy priority, etc.) — select 1 from 4 options

8 scenarios minimum. Data in `data.json` → `game.scenarios` array.

UI details:
- "Scenario 3 of 8" progress indicator
- Selected answer gets highlight border before confirm
- Green border + "Correct." on right answer, red border + "Incorrect." on wrong
- Explanation paragraph shown after every answer regardless of correctness
- Running score: "Round 1: 5/8 | Round 2: 12/18" in top corner of game section
- "Reset" button to restart from scenario 1

### 3B: Flashcard Drill

30+ cards. Data in `data.json` → `flashcards` array.

- Front: term, acronym, or concept name
- Back: definition, plain English explanation, pattern context, treatment reference
- Click/tap anywhere on card to flip (CSS `transform: rotateY(180deg)`, `perspective` on parent, `backface-visibility: hidden` on both faces)
- Below card: "Got it" (removes from deck) and "Again" (returns to deck)
- Cards marked "Again" recycle back into remaining deck
- Session complete when all cards "Got it"
- Display: "7 of 32 remaining"
- Deck shuffled on each session start and on reset
- "Reset Deck" button

---

## Section 4: Practical Application (Goal 4)

### 4A: Case Walkthroughs

Multi-visit narrative case studies. Interactive — the user makes decisions at each visit.

Per visit:
1. Show patient context and test results (styled as a clinical chart)
2. Question: what pattern / what treatment / what to address next (user selects from options)
3. On answer: show correct answer, explanation, and rationale
4. Show updated test results for the next visit
5. Advance button to next visit

Two cases from the manual:

**B PEC Case (6 visits):**
- Visit 1: + B ADT, + B PADT, − B PART, SRT 8", Squat 1/5, HALT 1/1 → Identify pattern, select repositioning
- Visit 2: − B ADT, + B PADT → select next treatment focus
- Visit 3: − B ADT, + L PADT / − R PADT, − L PART / + R PART → what changed and why, select treatment
- Visit 4: − B PADT, − L PART / + R PART → select treatment
- Visit 5: − B PADT, − B PART, HALT 4/4 → select integration exercise
- Visit 6: HALT 5/5, Squat 4/5 → select final phase activities

**L AIC Case (5 visits):**
- Visit 1: + L ADT, + L PADT, + R PART, SRT 4" → Identify pattern, select repositioning
- Visit 2: − B ADT, − B PADT, + R PART → select treatment
- Visit 3: − B ADT, − B PADT, − B PART → select integration

Data in `data.json` → `caseStudies` array.

### 4B: Clinical Decision Tree

Interactive flowchart for use with a real patient. NOT a quiz — there are no wrong answers. This is a navigation tool.

Start node: "Perform ADT bilaterally. What are the results?"

Branching logic:
- + Bilateral ADT → "Perform PADT bilaterally" → + Bilateral PADT → "Determine pattern (check PART, SRT, Squat)" → branches to L AIC / B PEC / B Patho PEC → "Reposition with 3 techniques (listed)" → "Retest ADT"
- Post-repositioning branches:
  - − B ADT / − B PADT → Myokinematic Restoration & Postural Respiration
  - − B ADT / + B PADT → Pelvis Restoration program → show hierarchy
  - − L ADT / + L PADT → L AIC Pelvis Restoration → show facilitation hierarchy with HALT gating
  - All still positive → Reevaluate technique or other PRI courses

Implementation: nested expandable nodes (could be `<details>` elements or JS-toggled divs). User clicks an answer/branch, next node expands below. Collapse and re-expand to explore different paths.

At each terminal node: show the specific treatment hierarchy, exercises, and expected test improvements.

### 4C: Muscle-to-Exercise Map

Reference table with two access patterns (toggle between views):

**View 1 — By Muscle:** Rows are muscles. Columns: muscle name, action, which pattern it corrects, which exercises activate it, facilitation hierarchy step.

**View 2 — By Finding:** Rows are test findings. Columns: finding (e.g., "+ L PADT"), what it means, muscles to facilitate, exercises, hierarchy step.

Search/filter input above the table. No form submission on Enter.

Data in `data.json` → `muscleExerciseMap` array.

---

## Data File

All content lives in a separate `data.json` file (provided alongside this PRD). The build step: embed the entire JSON object as `const DATA = { ... };` in a `<script>` tag at the top of the HTML file. The JSON must NOT be loaded via fetch — it must be inlined.

The data file contains:
- `acronyms`: 12 acronym entries (columns: code, name, region, regionType, description, patternContext, treatment)
- `terminology`: joint descriptions and muscle maps for Section 1A
- `causalChains`: 6-8 chain exercises for Section 2C
- `game.scenarios`: 8 pattern-identifier scenarios with 3-question Round 2 chains for Section 3A
- `flashcards`: 30+ entries for Section 3B
- `caseStudies`: 2 multi-visit case studies for Section 4A
- `decisionTree`: nested object for Section 4B
- `muscleExerciseMap`: muscle and finding → exercise mappings for Section 4C
