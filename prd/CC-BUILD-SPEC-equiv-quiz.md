# CC-BUILD-SPEC: Equivalence Quiz Overhaul

## Summary

The equivalence quiz has four bugs (one logical, three pedagogical) and needs two new features (enriched feedback explanations, completion review screen). FA is removed from the equivalence chain.

---

## Bug Fixes

### B1: Deterministic correct-answer selection (P1)

**Problem:** `allEquiv` is built from `Object.entries(equiv)` which returns keys in insertion order (`ip, is, isp, si, af`). `slice(0, 3)` and `slice(0, 2)` always pick the same equivalents for a given region. The quiz never rotates which equivalents it tests.

Example: Given IP, shown correct answers are always IS and IsP. The user is never tested on whether AF is equivalent to IP.

**Before (equivalence-quiz.js, ~line 35):**
```js
const correctPick = allEquiv.slice(0, 3);
```

**After:**
```js
// Fisher-Yates shuffle before slicing
for (let i = allEquiv.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allEquiv[i], allEquiv[j]] = [allEquiv[j], allEquiv[i]];
}
const correctPick = allEquiv.slice(0, 3);
```

**Validation:** Run `generateQuestions()` twice. Confirm the `correctAnswers` set for the same `given` value differs between runs.

---

### B2: Misleading instruction text (P2)

**Problem:** Line 77 says `"Select ALL equivalent positions (may be zero or more):"` — there are always exactly 2 correct answers. "May be zero" implies trick questions that don't exist, creating false cognitive load.

**Before:**
```html
<p class="equiv-instruction">Select ALL equivalent positions (may be zero or more):</p>
```

**After:**
```html
<p class="equiv-instruction">Select all equivalent positions:</p>
```

---

### B3: Feedback shows untested equivalents (P3)

**Problem:** `buildEquivChainHTML` renders ALL regions from `getAllEquivalent`, including equivalents that were not shown as selectable options. Users see equivalents they couldn't have selected, which undermines confidence in the quiz.

**Fix:** Only show the equivalents that appeared as options, plus the given. Append a note linking to the full chain.

**Before (`buildEquivChainHTML`):** Iterates over all entries from `getAllEquivalent`.

**After:** Accept the question's `options` and `correctAnswers` as parameters. Show only: (1) the given position, and (2) the correct answers that were shown as options. Below the chain, add:

```html
<div class="equiv-chain-note">
  Full equivalence chain has N positions — see Equivalence Chains for complete walkthrough.
</div>
```

Where N is the total count from `getAllEquivalent` (excluding the given). The "Equivalence Chains" text does not need to be a link — just a reference to the other tab.

---

### B4: Remove FA from equivalence chain (P3)

**Problem:** FA (Femoral-Acetabular) describes treatment positioning (femur on pelvis, open chain) — a different conceptual category from the positional-diagnosis initialisms (IP, IS, IsP, SI, AF). Including it in equivalence chains conflates "where is the pelvis stuck" with "what are we doing to the femur."

**Changes:**

In `equivalence.js`, `getAllEquivalent`: remove `fa` from the returned object.

**Before:**
```js
return {
  ip: ipIsER ? 'ER' : 'IR', is: ipIsER ? 'IR' : 'ER',
  isp: ipIsER ? 'IR' : 'ER', si: ipIsER ? 'IR' : 'ER',
  af: ipIsER ? 'ER' : 'IR', fa: ipIsER ? 'ER' : 'IR'
};
```

**After:**
```js
return {
  ip: ipIsER ? 'ER' : 'IR', is: ipIsER ? 'IR' : 'ER',
  isp: ipIsER ? 'IR' : 'ER', si: ipIsER ? 'IR' : 'ER',
  af: ipIsER ? 'ER' : 'IR'
};
```

In `equivalence.js`, `getAllEquivalent`: also remove `fa` from the switch case (line 10):

**Before:**
```js
case 'ip': case 'af': case 'fa': return directionId === 'er';
```

**After:**
```js
case 'ip': case 'af': return directionId === 'er';
```

In `equivalence-quiz.js`, `buildEquivChainHTML`: remove `fa` from labels map. (This becomes moot once B3 is implemented, but clean it up anyway.)

**Do NOT remove FA from:** the SVG Pelvis Decoder (decoder.js) or the nomenclature module. FA is still a valid PRI concept — it just doesn't belong in the equivalence chain.

**Validation:** Confirm FA never appears as a quiz option or in feedback chains. Confirm the decoder still shows FA.

---

## New Features

### F1: Enriched feedback explanations (P1)

**Data source:** `equivalence-explanations.json` (provided, place at project root).

After a question is answered, the feedback section shows:

1. The scoped equivalence chain (per B3 fix)
2. Below the chain, a new `<div class="equiv-explanation">` containing:
   - **For the given region:** its `pri` and `biomechanics` text from `regions[regionId][direction]`
   - **For each shown correct answer:** the `priReasoning` and `biomechanics` from the matching entry in `links[]` (match by `from`/`to` pair — order-insensitive, i.e., look up both `from:ip,to:is` and `from:is,to:ip`)
   - **The coupling disclaimer** (`couplingDisclaimer`) — shown once at the bottom of the explanation, inside a `<div class="equiv-coupling-note callout">`

**Layout:** PRI content is the primary reading path — unstyled, default text. Biomechanics notes are marginalia — visually secondary, styled as asides. Each explanation block:

```html
<div class="equiv-explanation">
  <div class="equiv-expl-region">
    <div class="equiv-expl-label">L IP ER — Anterior Inlet</div>
    <p>[pri text]</p>
    <div class="equiv-expl-note">Note — [biomechanics text]</div>
    <div class="equiv-expl-ref">Manual pp.5–6</div>
  </div>

  <div class="equiv-expl-link">
    <div class="equiv-expl-label">Why IP ER = IS IR</div>
    <p>[priReasoning]</p>
    <div class="equiv-expl-note">Note — [biomechanics]</div>
    <div class="equiv-expl-coupling">[couplingType]</div>
  </div>

  <!-- repeat for each shown correct answer -->

  <div class="equiv-expl-note">Note — [couplingDisclaimer]</div>
</div>
```

**Styling:**

PRI content (`<p>` inside `.equiv-expl-region` and `.equiv-expl-link`): no special styling. Default text color, default weight. This is what the user is memorizing.

Biomechanics notes (`.equiv-expl-note`): the universal "aside" treatment. These are editor's notes — present and readable, but visually secondary.

```css
.equiv-expl-note {
  border-left: 3px solid var(--surface2);
  padding-left: 0.75em;
  color: var(--text-dim);
  margin: 0.5em 0;
}
```

The "Note — " prefix is part of the text content, not a pseudo-element. It renders in the same muted color as the rest of the aside. No bold, no icon, no background highlight.

`.equiv-expl-label`: existing compact label style. Slightly bolder, used as a heading for each block.

`.equiv-expl-ref`: `var(--text-dim)`, small font, right-aligned or inline after the PRI text.

`.equiv-expl-coupling`: `var(--text-dim)`, small font, inline tag-style (e.g., "same-bone, opposite-ends"). Informational, not decorative.

Do NOT use: italic text, background highlights, collapsible/expandable wrappers, icons, or colored PRI labels. The PRI text is the default. Only the notes are styled, and only with the left border + dimmed color.

**Data loading:** Import/fetch `equivalence-explanations.json` at module init. Cache it. If the fetch fails, feedback still works — just omit the explanation section. **What does the user see if the fetch fails?** They see the chain (per B3) and the correct/incorrect verdict, but no explanation block. No error message, no blank space — the explanation `div` is simply not appended.

---

### F2: Completion review screen (P2)

**Pattern:** Match the master quiz (`masterquiz.js` `renderResults` / `renderResultsList`).

**Session UI:** User selects question count before starting. Once the session begins, the config hides and a progress bar with "End Session" button replaces it. No running score during the session — score is revealed on the results screen only. This matches the master quiz pattern and avoids score anxiety changing user behavior.

When the user finishes all questions (or ends early, or a session subset — see below), show a results screen:

1. **Score summary** with color-coded percentage:
   - Green: ≥80%
   - Yellow: 60–79%
   - Red: <60%
   - Format: `"Session Complete: X / Y correct (Z%)"`

2. **Incorrect section** (`<details open>`): Each row is a collapsible button showing:
   - Summary line: `"L IP ER — You: [selected], Correct: [correct answers]"`
   - Expanded detail: the full question with options highlighted (correct = `.correct-reveal`, wrong selection = `.wrong-reveal`, missed = `.missed`), plus the enriched explanation from F1.

3. **Correct section** (`<details>`, collapsed by default): Same row structure, summary line is just the given position.

4. **Retake Missed button** (hidden if no incorrect): Starts a new mini-session with only the missed questions, re-shuffled.

5. **New Session button**: Always visible. Full reset.

**DOM structure:** Add a `#equiv-results` container (initially hidden) as a sibling to `#equiv-quiz-wrap`. Toggle visibility between quiz and results using `showScreen`-style logic — don't destroy quiz DOM, just hide/show.

**Data:** Track `sessionAnswers[]` throughout the session, same pattern as master quiz:
```js
{ question: q, selected: [...selected], correct: isCorrect }
```

Push after each submit. Use this array to render results.

**Validation:**
- Complete a session with mixed results. Incorrect section is open, correct is collapsed.
- Click "Retake Missed" — only missed questions appear, reshuffled.
- Complete retake — new results screen for just the retake.
- Score percentage and color are correct.

---

## Implementation Order

1. B4 (remove FA) — changes the data layer everything else depends on
2. B1 (shuffle) — one line, no dependencies
3. B2 (instruction text) — one line
4. B3 (scope feedback chain) — refactors `buildEquivChainHTML`
5. F1 (explanations) — depends on B3's scoped chain, loads new JSON
6. F2 (review screen) — depends on F1 for explanation content in review rows

## Files Modified

- `equivalence.js` — B4 (remove FA)
- `equivalence-quiz.js` — B1, B2, B3, F1, F2
- `index.html` — F2 (add `#equiv-results` container)
- New file: `equivalence-explanations.json` — F1 data

## Files NOT Modified

- `decoder.js` — FA stays in the decoder
- `nomenclature.js` — FA stays in nomenclature
- `study-data.json` — not touched
- `masterquiz.js` — reference only, not modified

---

## Checklist Before Commit

- [ ] FA never appears in quiz options or feedback chains
- [ ] FA still appears in decoder and nomenclature
- [ ] Run generateQuestions() twice; correctAnswers sets differ for same given
- [ ] Instruction text has no "may be zero" qualifier
- [ ] Feedback chain shows only tested equivalents + given
- [ ] Feedback chain note references full chain count
- [ ] Explanation block renders PRI + biomechanics + coupling for each shown link
- [ ] PRI text has no label, no decoration — it is unstyled default text
- [ ] Biomechanics notes have left border (`var(--surface2)`), dimmed text (`var(--text-dim)`), and start with "Note — "
- [ ] No italic, background highlight, collapsible wrapper, or icon on any explanation text
- [ ] Explanation block absent (not broken) if JSON fails to load
- [ ] Completion review shows score with correct color
- [ ] Incorrect section is open by default
- [ ] Correct section is collapsed by default
- [ ] Retake Missed starts session with only incorrect questions
- [ ] New Session fully resets
- [ ] No console errors throughout a complete session
