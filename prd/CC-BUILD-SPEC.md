# CC Build Spec: PRI Pelvis Restoration Study Tool — Unified Build

## What This Is
Single-page vanilla JS study application for the PRI Pelvis Restoration post-course exam (March 9, 2026). Offline-capable, zero external dependencies.

## Output
One self-contained HTML file: `pri-unified.html`. All CSS in `<style>`, all JS in `<script type="module">`, all images embedded as base64 data URIs. Zero network requests after load.

---

## Building: Bash Restrictions

- Do not use python3 -c with inline code. The project path may cause parsing issues.
- Do not use cd with && chains.
- Instead: write Python scripts to a temp file (e.g. /tmp/edit.py), then run python3 /tmp/edit.py. Pass the file path as a string inside the script.
- Use the str_replace / file edit tool for targeted edits.

- Do not use heredocs or bash echo/cat to write JavaScript. The app contains template literals with dollar-sign curly braces that bash cannot handle. Use the file edit tool (str_replace) or write Python scripts to temp files, then execute them.

## Code Standards (MANDATORY — apply everywhere)

### JavaScript
- `<script type="module">` — strict mode by default (do not include "use strict" directive).
- Do not concatenate or merge script elements. Script IDs:
  `module-data, module-nav, module-anatomy, module-nomenclature,
  module-patterns, module-diagnose, module-flashcards, module-equivalence,
  module-masterquiz`, et al.
- If the current file has one large script block, split it so each module's code lives in its own script element with the appropriate id. Each script tag must be type="module". Module-scoped variables do not leak between script elements of type="module", so shared data (DATA, FLASHCARD_DECK, etc.) must be on the window object or in a dedicated module-data script that attaches to window.
- **Event listeners over handler attributes.** No `onclick="..."` in HTML. Use `element.addEventListener('click', handler)`.
- **textContent over innerHTML** wherever possible. Use innerHTML only when inserting HTML structure (tags). For plain text updates, use textContent.
- **Modular design:** Group related functionality into classes or closure-based modules. Example: `const FlashcardModule = (() => { ... return { init, reset }; })();`
- **Boolean naming:** Prefix with is/has/does/can. `isFlipped`, `hasAnswered`, `canAdvance`.
- **No form submission on Enter.** Every `<input>` and `<textarea>` must have: `addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); })` or equivalent.
- **No global state pollution.** Module-scoped variables only. The only global should be the init call.
- Constants: UPPER_SNAKE_CASE. Functions/variables: camelCase. Classes: PascalCase.
- **Deferred initialization for hidden content.** Modules whose DOM starts hidden (inactive sub-tab, `display:none`) must not measure dimensions, canvas sizes, or SVG viewBoxes on `DOMContentLoaded`. The nav module dispatches a `subtab-shown` custom event on the newly visible `.subtab-content` element after switching. Modules that need dimensions listen for this event:
  ```javascript
  // module-nav, after showing a subtab:
  subtabEl.dispatchEvent(new CustomEvent('subtab-shown', { bubbles: true }));

  // module that needs layout measurements:
  document.getElementById('my-container').addEventListener('subtab-shown', () => {
    resizeCanvas();
  });
  ```
### CSS
- **All colors via CSS custom properties.** Never hardcode hex in rules. Always `var(--name)`.
- **Light/dark theme via `prefers-color-scheme`.** Define light as default on `:root`, dark in `@media (prefers-color-scheme: dark)`. No manual toggle — OS controls it.
- **Scalable font sizes using clamp():**
```css
:root {
  --text-xs: clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.82rem + 0.25vw, 1.0625rem);
  --text-base: clamp(1rem, 0.92rem + 0.35vw, 1.1875rem);
  --text-lg: clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem);
  --text-xl: clamp(1.125rem, 1rem + 0.5vw, 1.4375rem);
  --text-2xl: clamp(1.5rem, 1.2rem + 1vw, 2.25rem);
}
```
  Use these variables for all font-size declarations. No fixed px or rem font sizes.
- **System font stacks only. No CDN, no Google Fonts.**
  - Mono: `ui-monospace, 'Cascadia Code', 'SF Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, monospace`
  - Serif: `Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif`
  - Sans: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- **Images:** `img { max-width: 100%; height: auto; }` handles responsive scaling. Hotspot overlays use percentage-based positioning.
- **Mobile-first responsive.** Tables stack as cards below 600px. Tab bar scrolls horizontally on mobile.

### Theme Colors

Light mode (`:root` default):
```css
--bg: #ffffff; --surface: #f5f5f0; --surface2: #eaeae5; --border: #d0d0c8;
--text: #1a1a1a; --text-dim: #6b6b6b;
--accent: #1a7a5a; --accent-dim: #b0d8c8; --accent-bg: #e8f5ef;
--warn: #b87a20; --warn-bg: #fdf3e0;
--error: #c03030; --error-bg: #fde8e8;
--inlet: #2a6a9a; --outlet: #9a5a2a;
--green: #2a7a4a; --red: #a03030;
```

Dark mode (`@media (prefers-color-scheme: dark)`):
```css
--bg: #1a1c1b; --surface: #242826; --surface2: #2e3230; --border: #3a403e;
--text: #d4dbd6; --text-dim: #7a8a82;
--accent: #3aaa80; --accent-dim: #2a6a50; --accent-bg: #1a2e24;
--warn: #d49540; --warn-bg: #2a2218;
--error: #d05050; --error-bg: #2a1818;
--inlet: #5ea8d4; --outlet: #d4815e;
--green: #5a9a5a; --red: #b05555;
```

### Tone
Clinical and direct. "Correct." not "Great job!" No exclamation points in feedback. Professional CE tone.

---

## Navigation — 7 Tabs

```
Anatomy | Nomenclature | Patterns | Diagnose This! | Flashcards | Equivalence | Master Quiz
```

SPA-style: one section visible at a time. Sticky top nav. Active tab highlighted with accent color + bottom border. Mobile: horizontal scroll, no wrapping. Short label for mobile: "Diagnose This!" may display as "Diagnose" in the tab bar (full name as heading inside the tab).

## Sub-tab System

Tabs with multiple features use a secondary nav row (`.subtab-row`) at the top of the tab's content area (not inside the sticky main nav — scrolls with content). One sub-tab visible at a time. First sub-tab active by default when switching to the parent tab.

```css
.subtab-row {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.subtab-row::-webkit-scrollbar { display: none; }
.subtab {
  font-family: var(--mono);
  font-size: var(--text-xs);
  background: none;
  border: none;
  color: var(--text-dim);
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.subtab:hover { color: var(--text); }
.subtab.active { color: var(--accent); border-bottom-color: var(--accent); }
.subtab-content { display: none; }
.subtab-content.active { display: block; }
```
### Fragment Identifiers

Tab and sub-tab state is reflected in the URL hash for bookmarking, refresh persistence, and back/forward navigation.

Format: `#tabname` for top-level tabs, `#tabname/subtabname` for sub-tabs.

Examples: `#anatomy`, `#anatomy/decoder`, `#patterns/tests`, `#masterquiz`

Tab name mapping (hash → section ID prefix):
```
anatomy, nomenclature, patterns, diagnose, flashcards, equivalence, masterquiz
```

Sub-tab name mapping (hash → subtab-content ID suffix):
```
anatomy: images, decoder, anatomize
nomenclature: joints, translation
patterns: cheatsheet, conceptmap, tests
diagnose: patternid, cases, chains, tree, exercises
```

Behavior:
1. On tab/sub-tab switch: `history.pushState(null, '', '#' + fragment)`. Do not use `location.hash =` (causes scroll jump).
2. On page load: parse `location.hash`, activate matching tab and sub-tab. Empty or invalid hash defaults to first tab, first sub-tab.
3. On `popstate` (back/forward): parse new hash, switch to that tab/sub-tab.
4. On initial load: use `replaceState`, not `pushState`, so loading the page doesn't create a double history entry.
### Sub-tab Assignments

| Tab | Sub-tabs | Content |
|-----|----------|---------|
| Anatomy | `Images` · `Pelvis Decoder` · `Anatomize This!` | 1A → Images, 1B → Decoder, 1C → Anatomize This! |
| Nomenclature | (none) | Single view |
| Patterns | `Cheat Sheet` · `Concept Map` · `Test Reference` | 3A–3D grouped into 3 views |
| Diagnose This! | `Pattern ID` · `Case Studies` · `Causal Chains` · `Decision Tree` · `Exercise Map` | 4A–4E, one per sub-tab |
| Flashcards | (none) | Single view with filters |
| Equivalence | (none) | Single view |
| Master Quiz | (none) | Internal view states: config → quiz → results |

---

## Tab 1: Anatomy

### Sub-tab: Images (1A)
Four sub-views selectable via button row:
- **Muscle Attachments (Lateral)** — image `1772049358465_image.png`
- **Bony Landmarks (Anterior)** — image `1772049306371_image.png`
- **L AIC Chain** — image `1772079947458_image.png`
- **Hip Overview** — image `1772049130888_image.png`

Each image displayed with percentage-based clickable hotspot overlays. Clicking a hotspot populates a detail panel below the image.

**Hotspot data:** Port MUSCLE_HOTSPOTS (12 entries) and LANDMARK_HOTSPOTS (7 entries) from pri-study-tool.jsx. L AIC Chain image: no hotspots — display with caption: "The Anterior Interior Chain (AIC): diaphragm → psoas → iliacus → TFL → vastus lateralis → biceps femoris. Left side shown."

**Detail panel — progressive disclosure (3 layers):**
Layer 1 (on click): muscle name, standard action, PRI translation, color family, chain membership.
Layer 2 ("Show Pattern Role" button): L AIC role for this muscle.
Layer 3 ("Show Treatment" button): facilitation step, exercises, HALT level.

### Sub-tab: Pelvis Decoder (1B)
SVG pelvis schematic (vanilla JS, ported from pri-decoder.jsx). Shows lateral hemipelvis with labeled landmarks, inlet ring (blue), outlet ring (orange), neutral ghost + tilted pelvis, directional arrows, ring status labels.

Controls: Side (Left/Right), Reference Frame (IP, IS, IsP, SI, AF, FA), Direction (IR/ER).
Below: equivalence chain display → muscles that produce the motion → rule callout.

**SVG tilt direction:** Anterior tilt (IP ER) = ASIS drops forward-down = clockwise in lateral view. Posterior tilt (IP IR) = ASIS rises backward-up. Verify rotation transform direction matches.

### Sub-tab: Anatomize This! (1C)
Interactive anatomy identification game. Spec in a separate PRD (TBD). Placeholder section until content is ready:
```html
<div class="subtab-content" id="anatomy-anatomize">
  <div class="tab-section">
    <h2 class="section-title">Anatomize This!</h2>
    <p class="text-dim">Coming soon. Interactive anatomy game loading...</p>
  </div>
</div>
```

---

## Tab 2: Nomenclature

### 2A: The Two Real Joints — Layer Walkthrough
Three layers (Structure → Mechanics → PRI Overlay), each revealed by "Next" button. Uses inline SVG schematics. Layer expansion buttons must be proximally located and clearly labeled.

### 2B: Translation Table
6-column table (PRI Term, Real Structure, What PRI Renamed, What Actually Happened, Standard Term, Encoded Treatment Target). Search/filter input above. Mobile (<600px): stacked cards.

### 2C: Key Distinction
Static callout. No changes needed.

---

## Tab 3: Patterns

### Sub-tab: Cheat Sheet (3A)
Three columns: Left AIC | Bilateral PEC | Bilateral Patho PEC. Highlight the 3 Patho distinguishing tests (PART, SRT, Squat) with accent/warn color.

### Sub-tab: Concept Map (3B)
Interactive node map. Click node → highlight connections.

### Sub-tab: Test Reference (3D)
Test profiles table (ADT, PADT, PART, SRT, Squat, HALT by pattern). Expandable HALT level details and Squat level details.

**HALT Level Quiz (inline):** "Patient fails HALT at level 2. What does this mean?" → quiz cards for levels 0–5.

**Squat Level Quiz (inline):** Same structure, levels 1–5.

Data:
```javascript
const HALT_LEVELS = [
  { level: 0, failure: "Can't position (malaligned pelvis) + can't inhibit outlet abduction of extended leg", facilitate: "Repositioning first — pelvis not yet neutral" },
  { level: 1, failure: "IO/TA weakness + can't inhibit inlet abduction (rectus femoris/sartorius) of flexed leg", facilitate: "IO/TAs + inlet inhibition" },
  { level: 2, failure: "Poor IC adductor/anterior glute med + can't achieve outlet abduction of flexed leg", facilitate: "IC adductor + anterior glute med" },
  { level: 3, failure: "Poor glute min/anterior glute med or labral impingement + can't achieve inlet adduction of flexed leg", facilitate: "Glute min + anterior glute med" },
  { level: 4, failure: "Poor contralateral adductor/ipsilateral glute med integration + can't achieve inlet abduction of extended leg", facilitate: "Contralateral adductor + ipsilateral glute med" },
  { level: 5, failure: "Can't extend with glute max during concomitant abduction + can't achieve outlet adduction of extended leg", facilitate: "Glute max extension during abduction" }
];

const SQUAT_LEVELS = [
  { level: 1, failure: "Can't initiate squat (slight knee bend, trunk flexed)", hyperactive: "Extensors, rectus femoris, sartorius" },
  { level: 2, failure: "Can't get bottom back, knees forward, trunk flexed", hyperactive: "Hip flexors, FA external rotators. Lack of femoral adduction." },
  { level: 3, failure: "Can't get bottom below knees, heels down, trunk flexed", hyperactive: "Intercostals, tib ant/post. Poor IO/TA integration." },
  { level: 4, failure: "Can't achieve full squat, heels down, bottom to heels", hyperactive: "Quads, gastroc-soleus. Poor IO/TA frontal plane integration." },
  { level: 5, failure: "Can't achieve maximal squat with COG through heels", hyperactive: "Lack of maximal AF IR. Poor respiratory/pelvic diaphragm synchronization." }
];
```

---

## Tab 4: Diagnose This!

### Sub-tab: Pattern ID (4A)
8 scenarios. Round 1: identify pattern from test profile. Round 2: 3 sub-questions (repositioning, post-reposition program, facilitation/clinical question). Running score. Progress indicator: "Scenario 3 of 8."

### Sub-tab: Case Studies (4B)
Two cases (B PEC 6 visits, L AIC 3 visits). Interactive — user makes decisions at each visit, sees result with explanation.

### Sub-tab: Causal Chains (4C)
Drag-to-order exercises. 6 chains. Mobile: tap-to-order fallback.

### Sub-tab: Decision Tree (4D)
Interactive expandable flowchart. At terminal nodes referencing "Myokinematic Restoration & Postural Respiration", append "(out of scope for this course)".

### Sub-tab: Exercise Map (4E)
Two views (by muscle, by finding). Search/filter input.

---

## Tab 5: Flashcards

### Data Source
`./data/flashcards-batch1.json` — 69 cards. Inline the `cards` array as a JS constant. Drop the `meta` wrapper.

### Card Schema
```json
{
  "id": "test-001",
  "category": "test_procedure",
  "examWeight": "high",
  "front": "How is the Adduction Drop Test (ADT) performed?",
  "frontHint": "Passive test. The examiner moves the top leg — the patient does nothing.",
  "back": "Patient sidelying, bottom hip/knee flexed 90°...",
  "backDetail": "Positive = top knee cannot cross midline..."
}
```

Categories: `test_procedure`, `bridging_term`, `initialism`, `muscle_action`, `facilitation`, `user_created`

### Card Display — Front
- **front**: Primary question text. Large, prominent.
- **frontHint**: Below front text in smaller, muted/italic text. Always visible on the front. This is a recall trigger — not a definition.
- **[Flip]** button below the hint.

**IMPORTANT:** Do NOT put initialism expansions on the card front or frontHint. No subtitle hints like "(Left Pelvic Ascension Drop Test)" on the front — that defeats the purpose. Tooltips are back-of-card only.

### Card Display — Back (revealed on Flip)
- **back**: Primary answer text. Prominent.
- **[Show More]** button (only if `backDetail` exists and is non-empty).
- **backDetail**: Revealed below `back` on Show More click. Smaller text. PRI initialisms in ALL CAPS within backDetail get `<abbr title="...">` hover tooltips (see Acronym Tooltips section for the lookup table).

### Card Actions — Two Buttons Only

```
[Flip]  |  [Next →]
```

**[Flip]**: Reveals the back of the card. Remains clickable to toggle between front and back as many times as the user wants. Does NOT disable after first click.

**[Next →]**: Advances to the next card in the deck. Always visible, always enabled. The user decides when they're done with a card. No "Got It" / "Again" — those are removed.

### Deck Behavior
- Shuffle on session start.
- Progress: "12 of 69 remaining" counter. Decrements as [Next →] is pressed.
- "Reset Deck" button restores all cards (filtered set) and reshuffles.
- When the last card is reached, [Next →] wraps to the first card and the counter resets.

### Category Filter
Row of toggle buttons above the deck:
```
All | Tests | Concepts | Initialisms | Muscles | Treatment
```
Mapping: Tests → `test_procedure`, Concepts → `bridging_term`, Initialisms → `initialism`, Muscles → `muscle_action`, Treatment → `facilitation`.

Selecting a filter resets the deck to only cards in that category (reshuffled). "All" restores full deck. Active filter highlighted.

### Exam Weight Filter
Secondary toggle: `All | High Priority | Medium Priority`
Filters by `examWeight`. Combines with category filter.

### User-Created Cards

#### Storage
localStorage key: `userFlashcards` — array of card objects, same schema. On load, merge user cards into the deck alongside built-in cards. User cards get `category: "user_created"` and appear under a "My Cards" filter option.

#### Add Card Flow

**[+ Add Card]** button in the Flashcard tab header opens an inline form (not a modal):

1. **Edit view:**
   - Front (textarea, required)
   - Front Hint (input, optional)
   - Back (textarea, required)
   - Back Detail (textarea, optional, character counter showing "123 / 380")
   - [Preview] [Cancel]

2. **Preview view:** Renders the card exactly as it will appear in the deck — front side shown with frontHint, [Flip] reveals back and backDetail. This lets the user verify formatting and completeness before committing.
   - [Save] [← Edit]

3. **On Save:**
   - Card saved to `userFlashcards` in localStorage.
   - Card is inserted at position 0 of the current deck (shown immediately as the active card).
   - Form closes. The user sees their new card displayed as the current card.
   - `id` auto-generated: `"user-" + Date.now()`

4. **No Enter-to-submit** on any textarea or input in the form.

This same `userFlashcards` store is used by the Master Quiz "Save as Flashcard" feature.

---

## Tab 6: Equivalence

Standalone interactive matching test.

1. Present a position, e.g., "L IP ER"
2. Show 4 option cards. Zero or more may be correct.
3. User must select ALL correct answers and NONE of the wrong ones to pass.
4. After submit: show result with explanation.

### Question Pool
The master equivalence rule: `L IP ER = L IS IR = L IsP IR = L SI IR = L AF ER`
Inverse: `L IP IR = L IS ER = L IsP ER = L SI ER = L AF IR`
Plus right-side versions. Generate questions dynamically. Minimum 12 per session.

### Equivalence Chain Display
- Hidden by default.
- On wrong answer: reveal chain with relevant positions highlighted (accent color on matching terms, dim on others).
- On [Next]: clear highlighting, re-hide chain.
- "Keep pinned" toggle: when active, chain stays visible across questions but highlighting updates per question (applied only after Submit).

### Explanation Content
Each answer explanation includes: (1) why correct options match (which chain rule), (2) what wrong options would mean, (3) muscles involved, (4) clinical movement or corrective exercise this represents. Concise.

Running score. Reset button.

---

## Tab 7: Master Quiz

Full spec in `cc-prompt-masterquiz.md`. Data in `./data/master-quiz.json`.

Three screens managed as internal view states (not sub-tabs):
1. **Config**: domain selection, question count, priority mode toggle, stats summary.
2. **Quiz**: stem, 4 radio-style option buttons (A–D single-select), Submit, explanation reveal, equivalence chain display (where applicable), Save as Flashcard, Next.
3. **Results**: score summary, questions grouped by correct/incorrect, expandable review, Save as Flashcard on incorrect, Retake Missed, New Session, Reset All Progress.

Spaced repetition via localStorage key `masterQuiz_progress`. See `cc-prompt-masterquiz.md` for full schema and queue ordering logic.

---

## Acronym Tooltips (GLOBAL)

Every PRI acronym throughout the entire app gets hover/click tooltip expansion via `<abbr title="...">` or `<span class="abbr" data-full="...">` with CSS tooltip on hover and tap-to-reveal on mobile.

Lookup table:
```
IP = Ilio-Pubo, IS = Ilio-Sacral, IsP = Ischio-Pubo, SI = Sacro-Iliac,
AF = Acetabulo-Femoral, FA = Femoro-Acetabular, ER = External Rotation,
IR = Internal Rotation, ADT = Adduction Drop Test, PADT = Pelvic Ascension Drop Test,
PART = Passive Abduction Raise Test, SRT = Standing Reach Test,
HALT = Hruska Abduction Lift Test, ZOA = Zone of Apposition,
AIC = Anterior Interior Chain, PEC = Posterior Exterior Chain,
IO = Internal Oblique, TA = Transversus Abdominis, TFL = Tensor Fasciae Latae,
IAP = Intra-Abdominal Pressure, OI = Obturator Internus,
B PEC = Bilateral PEC, B Patho PEC = Bilateral Pathological PEC,
L AIC = Left Anterior Interior Chain, R AIC = Right Anterior Interior Chain,
BC = Brachial Chain, FEV = Forced Expiratory Volume, FVC = Forced Vital Capacity,
SUI = Stress Urinary Incontinence, ASLR = Active Straight Leg Raise, COG = Center of Gravity
```

Implement as a shared utility function that both the Flashcard and Master Quiz modules (and all other tabs) can call.

---

## Data Files

| File | Purpose |
|------|---------|
| `./data/flashcards-batch1.json` | 69-card flashcard deck |
| `./data/master-quiz.json` | Master Quiz question bank |
| `pri-study-tool-data-v2.json` | Legacy app data (scenarios, causal chains, case studies, decision tree, muscle-exercise map, translation map). Inline as `const DATA = { ... };` |
| `LEARN-PRI.md` | Course knowledge file. Authoritative for all PRI content. Wins over any other data source on conflict. |

### Images
Embed all 4 PNGs as base64 data URIs: `1772049130888_image.png`, `1772049306371_image.png`, `1772049358465_image.png`, `1772079947458_image.png`.

### localStorage Keys

| Key | Owner | Purpose |
|-----|-------|---------|
| `userFlashcards` | Flashcard tab + Master Quiz | User-created flashcard cards (shared store) |
| `masterQuiz_progress` | Master Quiz | Per-question SRS tracking |

---

## Content Adjustments

1. **Out-of-scope references:** Keep mentions of "Myokinematic Restoration & Postural Respiration" in decision tree and treatment algorithms, but append "(out of scope)" wherever they appear.
2. **Remove truly out-of-scope material:** No Brachial Chain details beyond defining the acronym. No hormonal/diet/psychosocial content. No A-B-A design details beyond one flashcard.
3. **Respiratory tests:** One flashcard on the PADT-respiratory link. No detailed apical expansion or posterior outlet mediastinum expansion test procedures.

---

## Testing Checklist

- [ ] All 7 tabs switch correctly
- [ ] Sub-tabs work in Anatomy, Patterns, Diagnose This!
- [ ] First sub-tab active by default when switching to parent tab
- [ ] Light theme renders
- [ ] Dark theme renders
- [ ] Image hotspots click and show detail panel
- [ ] SVG decoder controls work; anterior tilt shows ASIS dropping forward
- [ ] Flashcards: [Flip] toggles front/back without disabling; [Next →] advances
- [ ] Flashcards: [Flip] remains clickable after first use (never disables)
- [ ] Flashcards: Add Card → Preview → Save → new card shown as current card
- [ ] Flashcards: category and weight filters work and combine
- [ ] Flashcards: user-created cards persist across page reloads via localStorage
- [ ] Abbreviation tooltips appear on hover in backDetail text
- [ ] Pattern Identifier: all 8 scenarios complete with Round 2
- [ ] Equivalence: questions generate, multi-select works, chain hidden/revealed correctly
- [ ] Master Quiz: config → quiz → results flow works
- [ ] Master Quiz: Save as Flashcard writes to userFlashcards; cards appear in Flashcard tab on reload
- [ ] Master Quiz: SRS prioritization orders missed questions first
- [ ] Anatomize This! placeholder visible under Anatomy tab
- [ ] Causal chains: drag-to-order works
- [ ] Decision tree: branches expand/collapse
- [ ] Mobile: both nav rows scroll horizontally; tables stack; images scale
- [ ] No console errors
- [ ] No network requests
- [ ] Enter key doesn't submit in any input/textarea
- [ ] All acronyms have tooltip expansion
