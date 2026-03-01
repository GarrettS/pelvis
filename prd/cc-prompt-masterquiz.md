# CC Task: Build Master Quiz Tab

## What
Add a new top-level tab **Master Quiz** to `pri-unified.html`. Multiple-choice quiz engine with a question bank (JSON), spaced repetition tracking, session configuration, results review, and flashcard export.

## Data Source
Question bank JSON will be provided in `./data/master-quiz-batch1.json`. Inline the `questions` array as a JS constant. Schema:

```json
{
  "id": "nom-001",
  "domain": "nomenclature",
  "stem": "In the Left AIC pattern, what is the position of the left anterior pelvic inlet?",
  "options": [
    { "key": "A", "text": "IP IR (extension, adduction, internal rotation)" },
    { "key": "B", "text": "IP ER (flexion, abduction, external rotation)" },
    { "key": "C", "text": "IsP ER (flexion, abduction, external rotation)" },
    { "key": "D", "text": "IS ER (counter-nutation)" }
  ],
  "answer": "B",
  "explanation": "The left inlet is in IP ER — the ASIS drops forward, the ring widens. This is anterior pelvic tilt described in PRI's tri-planar terms. Option A (IP IR) is the corrected position. Option C (IsP ER) describes the outlet opening, not the inlet. Option D (IS ER) is counter-nutation, which is the right side's posterior inlet position in L AIC, not the left."
}
```

Domains: `nomenclature`, `tests`, `treatment`, `anatomy`, `procedures`, `clinical`

## Navigation
Add "Master Quiz" as a new top-level tab. Position it after "Equivalence" (rightmost tab). Same nav styling as other tabs.

No sub-tabs needed — the quiz has distinct screens (config → quiz → results) managed as view states within the single tab.

---

## Screen 1: Session Config

Shown when entering the tab or after completing/abandoning a session.

### Domain Selection
Row of checkbox toggles (all checked by default):
```
☑ Nomenclature  ☑ Tests  ☑ Treatment  ☑ Anatomy  ☑ Procedures  ☑ Clinical
```
"Select All" / "Deselect All" links.

### Question Count
Dropdown or number input: 10, 20, 35 (default), 50, All.
If selected count exceeds available questions in chosen domains, cap silently.

### Priority Mode
Toggle: `☑ Prioritize missed questions`
When enabled (default ON): questions answered incorrectly in prior sessions appear first. Questions with the most cumulative correct answers are pushed to the back. Questions with 3+ consecutive correct answers are excluded entirely.

When disabled: pure random shuffle from selected domains.

### Stats Summary (if any prior session data exists)
Show: "42 of 200 questions attempted · 8 missed · 3 mastered (excluded)"
Derived from localStorage data.

### [Start Quiz] button
Disabled until at least one domain is selected. Transitions to Screen 2.

---

## Screen 2: Quiz Interface

### Layout — Top
Progress bar + counter: `Question 7 of 35`
Domain badge for current question (small, muted): `[nomenclature]`

### Layout — Question Area
**Stem**: Large text, the question.

**Options**: 4 radio-style option buttons (A–D). Single-select, not multi-select. Each button shows the key letter and text. Visually distinct clickable cards/buttons, not small radio circles.

Selecting an option highlights it. No answer is committed until Submit.

### Layout — Action Row
**[Submit]** button (disabled until an option is selected).
**[Next Question →]** button (hidden until after Submit, appears in the same row next to Submit).

### On Submit
1. Lock option buttons (no changing answer).
2. Highlight correct answer in green. If the user chose wrong, highlight their choice in red.
3. Reveal the **Explanation Panel** below the options.
4. Show **[Next Question →]** button next to Submit.
5. Show **[Save as Flashcard]** button below the explanation.
6. If the question involves an equivalence concept, reveal the **Equivalence Chain** (see below).

### Explanation Panel
Full text of the `explanation` field. Style: callout box, readable. Within explanations, apply `<abbr>` tooltips for PRI initialisms (same lookup table as flashcard spec — reuse or share the utility function).

### Equivalence Chain Display
Only shown when the question's content involves PRI joint nomenclature (detect: if the stem or any option text contains patterns like `IP ER`, `IS IR`, `IsP`, `SI`, `AF`).

- **Hidden by default** — not shown until Submit is pressed.
- On reveal: show the full equivalence chain for the relevant side, e.g.:
  ```
  L IP ER = L IS IR = L IsP IR = L SI IR = L AF ER
  ```
- **Highlight** the specific position(s) referenced in the question and correct answer.
- Include a 1–2 sentence expository note connecting the equivalence to the question context.
- **[Keep Pinned]** toggle: when active, the chain stays visible across questions. Highlighting updates per question (applied only after Submit). When not pinned, chain hides on Next Question.

### Save as Flashcard
**[Save as Flashcard]** button appears after Submit (below explanation).

On click:
1. Auto-generate a flashcard:
   - `front`: The question stem (truncate to 200 chars if needed, append "…")
   - `frontHint`: Domain label, e.g., "From Master Quiz — nomenclature"
   - `back`: Correct answer text (key + text)
   - `backDetail`: The full explanation (truncate to 380 chars if needed)
   - `id`: `"user-mq-" + question.id`
   - `category`: `"user_created"`
   - `examWeight`: `"high"`
2. Save to `userFlashcards` in localStorage (same store the Flashcard tab reads).
3. Button text changes to "✓ Saved" and disables (prevent duplicates).
4. If a card with the same `id` already exists in `userFlashcards`, show "Already saved" instead.

### Next Question
Clears the current question, loads the next from the session queue. If equivalence chain is not pinned, hide it. If pinned, keep it visible but clear highlighting until next Submit.

---

## Screen 3: Results Review

Shown after the last question is answered (or if user clicks **[End Session]** which should be available in the top-right during the quiz).

### Summary Header
```
Session Complete: 28 / 35 correct (80%)
```
Color-coded: green if ≥80%, yellow if 60–79%, red if <60%.

### Question List — Grouped
Two sections:
1. **Incorrect (review these)** — expanded by default
2. **Correct** — collapsed by default

Each question row shows:
- Question number + first 80 chars of stem
- Your answer vs. correct answer (if wrong)
- Expand/collapse to see full stem, all options, and explanation
- **[Save as Flashcard]** button on each incorrect question (same behavior as in-quiz)

### Session Actions
- **[Retake Missed]** — starts a new session with only the questions answered incorrectly in this session
- **[New Session]** — returns to Screen 1 (config)
- **[Reset All Progress]** — clears all localStorage quiz data (confirm dialog first)

---

## Spaced Repetition (localStorage)

### Storage Key: `masterQuiz_progress`
```json
{
  "nom-001": { "correctStreak": 0, "totalCorrect": 0, "totalAttempts": 2, "lastSeen": "2026-02-27" },
  "nom-002": { "correctStreak": 3, "totalCorrect": 5, "totalAttempts": 5, "lastSeen": "2026-02-27" }
}
```

### Update Logic (after each question Submit)
- Correct: `correctStreak++`, `totalCorrect++`, `totalAttempts++`, update `lastSeen`
- Incorrect: `correctStreak = 0`, `totalAttempts++`, update `lastSeen`

### Queue Ordering (when Priority Mode is ON)
1. **Front of deck**: questions with `correctStreak === 0 && totalAttempts > 0` (previously missed). Shuffle within this group.
2. **Middle**: questions with `totalAttempts === 0` (never seen). Shuffle within this group.
3. **Back**: questions with `correctStreak > 0`, sorted ascending by `totalCorrect` (fewest correct first).
4. **Excluded**: questions with `correctStreak >= 3`. These are "mastered" — do not appear in the session. Show count in config screen stats.

### Queue Ordering (when Priority Mode is OFF)
Pure random shuffle of all questions in selected domains (no exclusions).

---

## Code Standards
Follow all standards in `CC-BUILD-SPEC.md`:
- Module pattern: `const MasterQuizModule = (() => { ... return { init, reset }; })();`
- Event listeners, not onclick attributes
- textContent over innerHTML (use innerHTML only for HTML structure)
- No Enter-to-submit on any input
- CSS custom properties for all colors
- Responsive: works on mobile (option buttons must be tap-friendly, min 44px touch target)

## Abbreviation Tooltips
Reuse or share the `<abbr>` tooltip utility from the Flashcard tab (if it exists) or create a shared function both tabs can use. Same lookup table. Apply to: explanations, equivalence chain display.

## What NOT to Change
- Don't touch other tabs' content or behavior
- Don't change nav structure beyond adding the new tab
- Don't modify CSS custom properties or theme system
- Don't modify the flashcard tab (the `userFlashcards` localStorage contract is the only integration point)

## Validation
1. Config screen: domain filters, question count, priority toggle all work
2. Quiz flow: select → submit → explanation → next — no broken states
3. Correct/incorrect highlighting renders properly
4. Equivalence chain appears only for nomenclature-relevant questions, only after Submit
5. "Save as Flashcard" writes to `userFlashcards` localStorage; cards appear in Flashcard tab on reload
6. Results screen: grouped by correct/incorrect, expandable, retake-missed works
7. SRS: missed questions appear first in subsequent sessions; 3-streak questions excluded
8. localStorage persists across page reloads
9. [End Session] available during quiz, leads to results for questions answered so far
10. No Enter-to-submit anywhere
