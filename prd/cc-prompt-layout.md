# CC Task: Restructure Navigation — Sub-tabs + New Tab

## References
Read CC-BUILD-SPEC.md first. It defines code standards, bash restrictions, script module structure, sub-tab CSS, fragment identifier behavior, and deferred initialization. Do not duplicate those patterns here — implement them as specified there.

## What
Update pri-unified.html: 6 tabs become 7. Four tabs get sub-tabs. One new placeholder tab. Layout-only — do not rewrite existing feature content or JS modules.

## New Tab Bar

```
Anatomy | Nomenclature | Patterns | Diagnose This! | Flashcards | Equivalence | Master Quiz
```

Add after Equivalence:
```html
<button class="nav-tab" role="tab" data-tab="tab-masterquiz">Master Quiz</button>
```

## Sub-tab Restructuring

For each tab below: insert a `.subtab-row` at the top of the section, then wrap each existing `div.tab-section` in a `<div class="subtab-content" id="...">`. Do not modify content inside the wrapped divs.

### Tab 1: Anatomy — 3 sub-tabs

Existing content:
- "1A — Interactive Anatomy Images"
- "1B — SVG Pelvis Decoder"

```html
<section id="tab-anatomy" class="tab active">
  <div class="subtab-row">
    <button class="subtab active" data-subtab="anatomy-images">Images</button>
    <button class="subtab" data-subtab="anatomy-decoder">Pelvis Decoder</button>
    <button class="subtab" data-subtab="anatomy-anatomize">Anatomize This!</button>
  </div>
  <div class="subtab-content active" id="anatomy-images">
    <!-- existing 1A content -->
  </div>
  <div class="subtab-content" id="anatomy-decoder">
    <!-- existing 1B content -->
  </div>
  <div class="subtab-content" id="anatomy-anatomize">
    <div class="tab-section">
      <div class="section-title">Anatomize This!</div>
      <p style="color:var(--text-dim);">Coming soon. Interactive anatomy identification game.</p>
    </div>
  </div>
</section>
```

### Tab 2: Nomenclature — 3 sub-tabs

Existing content:
- "2A — The Two Real Joints"
- "2B — Translation Table"
- "2C — Key Distinction"

```html
<section id="tab-nomenclature" class="tab">
  <div class="subtab-row">
    <button class="subtab active" data-subtab="nom-joints">Joints</button>
    <button class="subtab" data-subtab="nom-translation">Translation Table</button>
    <button class="subtab" data-subtab="nom-keydistinction">Key Distinction</button>
  </div>
  <div class="subtab-content active" id="nom-joints">
    <!-- existing 2A content -->
  </div>
  <div class="subtab-content" id="nom-translation">
    <!-- existing 2B content -->
  </div>
  <div class="subtab-content" id="nom-keydistinction">
    <!-- existing 2C content -->
  </div>
</section>
```

### Tab 3: Patterns — 3 sub-tabs

Existing content:
- "3A — Pattern Comparison Cheat Sheet"
- "3B — Concept Map"
- "3C — Symptom-to-Pattern Matching"
- "3D — Test Reference" (includes HALT and Squat quizzes)

Group 3B and 3C together under Concept Map.

```html
<section id="tab-patterns" class="tab">
  <div class="subtab-row">
    <button class="subtab active" data-subtab="patterns-cheatsheet">Cheat Sheet</button>
    <button class="subtab" data-subtab="patterns-conceptmap">Concept Map</button>
    <button class="subtab" data-subtab="patterns-tests">Test Reference</button>
  </div>
  <div class="subtab-content active" id="patterns-cheatsheet">
    <!-- existing 3A content -->
  </div>
  <div class="subtab-content" id="patterns-conceptmap">
    <!-- existing 3B content -->
    <!-- existing 3C content -->
  </div>
  <div class="subtab-content" id="patterns-tests">
    <!-- existing 3D content -->
  </div>
</section>
```

### Tab 4: Diagnose This! — 5 sub-tabs

Existing content: 4A through 4E, one div.tab-section each.

```html
<section id="tab-diagnose" class="tab">
  <div class="subtab-row">
    <button class="subtab active" data-subtab="diagnose-patternid">Pattern ID</button>
    <button class="subtab" data-subtab="diagnose-cases">Case Studies</button>
    <button class="subtab" data-subtab="diagnose-chains">Causal Chains</button>
    <button class="subtab" data-subtab="diagnose-tree">Decision Tree</button>
    <button class="subtab" data-subtab="diagnose-exercises">Exercise Map</button>
  </div>
  <div class="subtab-content active" id="diagnose-patternid"><!-- 4A --></div>
  <div class="subtab-content" id="diagnose-cases"><!-- 4B --></div>
  <div class="subtab-content" id="diagnose-chains"><!-- 4C --></div>
  <div class="subtab-content" id="diagnose-tree"><!-- 4D --></div>
  <div class="subtab-content" id="diagnose-exercises"><!-- 4E --></div>
</section>
```

### Tabs without sub-tabs (no structural changes)
- Tab 5: Flashcards
- Tab 6: Equivalence

## New Tab 7: Master Quiz — Placeholder

Insert after the Equivalence section, before closing `</main>`:

```html
<section id="tab-masterquiz" class="tab">
  <div class="tab-section">
    <div class="section-title">Master Quiz</div>
    <p style="color:var(--text-dim);">Coming soon. Question bank loading...</p>
  </div>
</section>
```

Do not build quiz functionality. The module will be built from cc-prompt-masterquiz.md and ./data/master-quiz.json.

## JavaScript Changes

1. **Tab switching**: update to handle 7 tabs. When switching to a tab with a `.subtab-row`, activate its first sub-tab.
2. **Sub-tab switching**: event delegation on `.subtab` buttons per build spec.
3. **Fragment identifiers**: implement per CC-BUILD-SPEC.md. Map tab/sub-tab names to the IDs defined above.
4. **Deferred init**: dispatch `subtab-shown` per build spec. Check existing modules (especially ConceptMapModule, SVG decoder) for dimension-dependent init that needs deferral.
5. **Script splitting**: split the single script block into per-module scripts per build spec.

## What NOT to Change
- Existing feature content, text, data objects
- Existing JS module logic (wrap containers only)
- CSS custom properties or theme colors
- Flashcard tab (separate task)

## Validation
1. All 7 tabs switch correctly
2. Sub-tabs work in all 4 tabs (Anatomy, Nomenclature, Patterns, Diagnose This!)
3. First sub-tab active by default when switching to parent tab
4. Fragment identifiers: refresh preserves tab/sub-tab state; back/forward works
5. Existing features function in new sub-tab wrappers
6. Master Quiz and Anatomize This! show placeholders
7. Mobile: both nav rows scroll horizontally
8. No console errors, no visual regressions
