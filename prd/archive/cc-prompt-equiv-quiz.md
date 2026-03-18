# Equivalence Quiz Overhaul

Read `prd/CC-BUILD-SPEC-equiv-quiz.md` completely before writing any code.

Read `code-guidelines.md` and `CLAUDE.md` before writing any code.

## Context

The equivalence quiz has four bugs and needs two new features. A new data file `equivalence-explanations.json` is provided at the project root — do not modify its content.

## Implementation Order

Follow the order specified in the PRD: B4 → B1 → B2 → B3 → F1 → F2. Commit after each step compiles and runs without console errors. Do not batch.

## Key Constraints

- Do NOT touch `decoder.js`, `nomenclature.js`, `study-data.json`, or any file not listed in the PRD's "Files Modified" section.
- FA stays in the decoder and nomenclature. FA is removed ONLY from `getAllEquivalent` in `equivalence.js` and from the quiz.
- The completion review screen (F2) follows the master quiz pattern in `masterquiz.js`. Read `renderResults` and `renderResultsList` before implementing. Match the DOM structure, class naming conventions, and interaction patterns. Do not invent a new pattern.
- For every `catch` block you write: answer "what does the user see?" in a comment. If the answer is "nothing" or "a blank space," that's wrong — handle it visibly or omit the element.
- The explanation JSON fetch can fail. If it does, feedback still works — the explanation div is simply not appended. No error toast, no blank space, no console.error.

## Validation

After all steps, run through this manually:
1. Start a session. Confirm FA never appears.
2. Answer 3+ questions. Confirm feedback shows only tested equivalents + given, with explanations.
3. Complete the session. Confirm review screen matches master quiz layout.
4. Click Retake Missed. Confirm only missed questions appear.
5. Restart the app. Start another session. Confirm different equivalents are tested for the same given (B1 shuffle fix).

Report findings for each of the 5 validation steps.
