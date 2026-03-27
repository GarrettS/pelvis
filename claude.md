# Claude Code — Project Contract

Read this file first on every task. Project rules in this file and in `code-guidelines.md` override AI system defaults where they conflict.

## References
- **`code-guidelines.md`** — Code standards. Read it, follow it, check against it before every commit.
- **`prd/project.md`** — Project definition, design decisions, content authority. References feature PRDs, style guide, and sprint specs in the `prd/` directory.

## Ubiquitous Language
Every project defines its own terminology. Variables, class names, CSS selectors, function names, and documentation must use that terminology consistently. If the PRD says "outlet", the code says `outlet` — not `bottom`, `lower`, or `ring2`.

## Workflow

Apply `code-guidelines.md` to every line you write and every line you touch. If existing code near your change violates the guidelines, fix it. Refactor continuously — small, incremental improvements on every commit. The codebase gets cleaner with each checkin, never dirtier.

### Before Writing Code
- Read `code-guidelines.md`.
- Read the relevant PRD section for the task at hand.
- If requirements are ambiguous, ask. Do not invent requirements.
- Do not write implementation when the user asked for a spec. Do not write a spec when the user asked for code.

### While Writing Code
- Follow `code-guidelines.md`. Exceptions require a stated reason per `code-philosophy.md` §Defaults and Exceptions.
- **Failure paths require approval.** Every time you write code that can fail at runtime (fetch, JSON.parse, storage, any async operation), stop and present the failure scenario to the user before writing the handler. State what operation can fail, what the consequence is, and list contextual handling options. Example:
  > "This fetch loads quiz data. If it fails, the quiz cannot render. Options: (1) show an error message with a retry button, (2) fall back to a cached copy of the data if available, (3) disable the quiz tab and show a status message. Which approach?"
  Do not write `console.error` and move on. Do not re-throw. Do not pick a handling strategy without presenting it.
- Do not use heredocs with template literals — the tool parser chokes on `${…}` substitutions.
- Do not batch-edit files with transformation scripts (sed, awk). Use direct edits.
- **Batch cohesive mechanical changes.** When a refactoring requires the same transformation applied to multiple locations (renaming an ID, replacing a class, removing an attribute), apply all instances in a single `replace_all` edit or a single block edit — not one at a time. Repetitive line-by-line approval fatigues the reviewer and encourages auto-approve, which defeats the review loop.
- For coordinate or positioning work, measure each element individually. Never batch-adjust.

### After Every Change
- Remove dead code: orphaned CSS selectors, unreferenced IDs, stale variable references.
- Update all selectors and references affected by structural changes.
- Run verification to confirm no regressions. Do not mark a task done with failing checks.

### Before Every Commit
Follow this sequence. Do not skip steps.

**Step 1 — Re-read `code-guidelines.md`.** Open the file and read it. By the time you are ready to commit, you have been working for a while and the guidelines have drifted out of active context. Re-reading forces a refresh. This step catches problems that would otherwise be missed.

**Step 2 — Run `bin/pre-commit-check.sh`.** Fix every violation it reports.

**Step 3 — Review the diff against `code-guidelines.md`.** The script catches mechanical violations. This step catches structural ones it cannot. Review the diff against the Patterns and Fail-Safe sections of `code-guidelines.md` specifically — these are the rules most often violated in ways a linter cannot detect.

**Step 4 — Stale asset check.** The pre-commit script flags unreferenced files in `img/` and `data/`, and verifies `sw.js` precache entries. For any flagged asset, determine whether it is used by a declared process (e.g., coord-picker tool, PRD reference) or is genuinely stale. If stale, delete the file and update any asset lists (sw.js, PRD manifests) in the same commit. If the diff adds or removes app-referenced files, also update `sw.js` precache in the same commit. A new file in `img/` or `data/` does not automatically belong in precache — before adding any entry to `sw.js`, identify the app code reference (HTML, JS, or JSON in the running app) that fetches it. Files referenced only by README.md, PRDs, or dev tools are not app assets and must not be precached.

Fix anything found in steps 2–4 before proceeding. Do not commit until all steps pass clean.

### Committing
- **Ask before pushing.** Do not push to remote without explicit approval.
- Prompt the user toward cohesive commits and discrete chunks of work.
- Commit messages: imperative mood, concise, scoped.

## Verification Standards
- Never report a task as done without evidence: console output, test results, or a before/after comparison.
- Never assert findings from project knowledge or memory without verifying against the current codebase.
- If the same fix has failed twice, stop and reassess the approach before trying a third time.
- **Fail-safe self-review**: for every `catch` block and error path in the diff, answer: *what does the user see?* If the answer is "nothing" — the code returns null, logs to console, or swallows the error — it is not handled. Passing the letter of the rule while violating the principle is not passing.
