# CC Task: Fix Flashcard UI — Corrected UX

## Context
The flashcard tab was recently updated with new 69-card data. Two behaviors were implemented incorrectly and need fixing. This task corrects the card interaction UX and the Add Card flow.

## Fix 1: Card Action Buttons — [Flip] | [Next →]

### Current (wrong)
Three buttons: [Flip] [Got It] [Again]. Flip disables after first click.

### Required
Two buttons only:

```
[Flip]  |  [Next →]
```

**[Flip]**: Toggles between front and back of the card. Remains clickable indefinitely — the user can flip back and forth as many times as they want. **Never disables.** Remove any code that disables or hides the Flip button after first click.

**[Next →]**: Advances to the next card in the deck. Always visible, always enabled regardless of whether the card has been flipped. The user decides when to move on.

**Remove entirely:** [Got It] and [Again] buttons. Delete the buttons, their event listeners, and any associated logic (removing cards from deck, reinserting at random position, etc.).

### Deck Behavior (updated)
- Shuffle on session start.
- [Next →] decrements the "remaining" counter and advances to the next card in order.
- Progress: "12 of 69 remaining."
- When the last card is reached, [Next →] wraps to the first card and the counter resets (full loop).
- "Reset Deck" restores all cards (respecting active filters) and reshuffles.

## Fix 2: Add Card — Preview and Confirmation

### Current (wrong)
Form with [Save] [Cancel]. Save immediately writes to localStorage.

### Required
Three-step flow: Edit → Preview → Save.

**Step 1 — Edit view:**
The existing form fields are correct:
- Front (textarea, required)
- Front Hint (input, optional)
- Back (textarea, required)
- Back Detail (textarea, optional, "123 / 380" character counter)

Buttons: **[Preview]** (replaces old [Save]) and **[Cancel]**

[Preview] is disabled until both Front and Back have content.

**Step 2 — Preview view:**
Renders the card exactly as it will appear in the deck:
- Shows the front side with frontHint below it, styled identically to a real card.
- A working [Flip] button reveals the back and backDetail (if entered), also styled identically.
- The user can flip back and forth to verify.

Below the preview card: **[Save]** and **[← Edit]**

[← Edit] returns to Step 1 with all field values preserved.

**Step 3 — On Save:**
1. Card object created with `id: "user-" + Date.now()`, `category: "user_created"`, `examWeight: "high"`.
2. Appended to `userFlashcards` array in localStorage.
3. Card inserted at **position 0** of the current deck — it becomes the currently displayed card immediately.
4. Form closes. User sees their new card as the active card.
5. "Remaining" counter updates to reflect the new deck size.

### No Enter-to-Submit
All textarea and input fields in the Add Card form: prevent Enter from submitting or triggering Preview/Save. Per CC-BUILD-SPEC.md.

## What NOT to Change
- Don't touch card data (the 69-card deck is correct).
- Don't touch category/weight filters (those work).
- Don't touch abbreviation tooltips in backDetail (those work).
- Don't touch other tabs.
- Don't change nav structure or CSS custom properties.

## Validation
1. [Flip] toggles front/back without ever disabling.
2. [Next →] advances the deck. No "Got It" or "Again" buttons exist anywhere.
3. Add Card: [Preview] shows a rendered card preview before saving.
4. Add Card: [← Edit] returns to form with values preserved.
5. Add Card: [Save] inserts card at position 0; new card is immediately displayed.
6. User-created cards persist in localStorage and appear on reload.
7. No Enter-to-submit on any input/textarea.
8. "Remaining" counter reflects current deck size after adding a card.
