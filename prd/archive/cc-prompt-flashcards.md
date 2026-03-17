# CC Task: Replace Flashcard Data + Update Flashcard UI

## What
Replace the existing flashcard data in `pri-unified.html` with the new 69-card deck from `./data/flashcards-batch1.json`. Update the Flashcard tab UI to support the new card schema.

## Data Source
`./data/flashcards-batch1.json` — 69 cards. Inline the `cards` array into the app as a JS constant. Drop the `meta` wrapper; just the array.

## New Card Schema
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

Categories: `test_procedure`, `bridging_term`, `initialism`, `muscle_action`, `facilitation`
Exam weights: `high`, `medium`

## UI Requirements

### Card Display — Front
- **front**: Primary question text. Large, prominent.
- **frontHint**: Displayed below front text in smaller, muted/italic text. Always visible on the front. This is a recall trigger, NOT a definition — never remove or hide it.
- **[Flip]** button below the hint.

### Card Display — Back (revealed on Flip)
- **back**: Primary answer text. Prominent.
- **[Show More]** button (only if `backDetail` exists and is non-empty).
- **backDetail**: Revealed below `back` on Show More click. Smaller text. Within backDetail, any PRI initialism in ALL CAPS (e.g., `IP ER`, `IsP IR`, `L PADT`, `ZOA`) should get a hover tooltip expanding the abbreviation. Implement via `<abbr title="...">` tags. Use this lookup for expansions:
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
  L AIC = Left Anterior Interior Chain, R AIC = Right Anterior Interior Chain
  ```
- **[Got It]** and **[Again]** buttons in a row below the answer area.

### IMPORTANT: Do NOT put initialism expansions on the card front or frontHint. No subtitle hints like "(Left Pelvic Ascension Drop Test)" on the front — that defeats the purpose of the flashcard. Tooltips are back-of-card only.

### Deck Behavior
- Shuffle on session start.
- "Got It" removes card from current session deck.
- "Again" returns card to a random position in the remaining deck (not immediately next).
- Progress: "12 of 69 remaining" counter.
- "Reset Deck" button restores all 69 cards and reshuffles.

### Category Filter
Row of toggle buttons above the deck: `All | Tests | Concepts | Initialisms | Muscles | Treatment`
Mapping:
- Tests → `test_procedure`
- Concepts → `bridging_term`
- Initialisms → `initialism`
- Muscles → `muscle_action`
- Treatment → `facilitation`

Selecting a filter resets the deck to only cards in that category (reshuffled). "All" restores full deck. Active filter highlighted.

### Exam Weight Filter
Secondary toggle: `All | High Priority | Medium Priority`
Filters by `examWeight`. Can combine with category filter. Default: All.

### User-Created Cards (localStorage)
Reserve a localStorage key `userFlashcards` (array of card objects, same schema). On load, merge user cards into the deck alongside the built-in cards. User cards get `category: "user_created"` and appear under a "My Cards" filter option.

A **[+ Add Card]** button in the Flashcard tab header opens a small form:
- Front (textarea, required)
- Front Hint (input, optional)
- Back (textarea, required)
- Back Detail (textarea, optional, max 380 chars with counter)
- [Save] [Cancel]

Saved cards go to `userFlashcards` in localStorage and immediately enter the current deck.

This same `userFlashcards` store will be used later by the Master Quiz "Save as Flashcard" feature — don't build that integration now, just make sure the store is ready.

### No Enter-to-Submit
All textarea and input fields: prevent Enter from submitting. Per CC-BUILD-SPEC.md code standards.

## What NOT to Change
- Don't touch other tabs.
- Don't change the nav structure.
- Don't modify CSS custom properties or theme system.
- Keep all existing code standards from CC-BUILD-SPEC.md.

## Sub-tabs
The Flashcard tab does NOT need sub-tabs — it's one view with filters.

## Validation
After implementation:
1. All 69 cards render correctly (front, hint, back, backDetail).
2. Flip → Show More → Got It / Again flow works.
3. Category and weight filters work and combine correctly.
4. "Reset Deck" restores and reshuffles.
5. User-created cards persist across page reloads via localStorage.
6. Abbreviation tooltips appear on hover in backDetail text.
7. No Enter-to-submit on any input/textarea.
