# Claude Code — Project Contract

Read this file first on every task.

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
- Follow `code-guidelines.md` without exception.
- Do not use heredocs with template literals — the tool parser chokes on `${…}` substitutions.
- Do not batch-edit files with transformation scripts. Make direct edits, one at a time, verifying each.
- For coordinate or positioning work, measure each element individually. Never batch-adjust.

### After Every Change
- Remove dead code: orphaned CSS selectors, unreferenced IDs, stale variable references.
- Update all selectors and references affected by structural changes.
- Run verification to confirm no regressions. Do not mark a task done with failing checks.

### Before Every Commit
Follow this sequence. Do not skip steps.

**Step 1 — Re-read `code-guidelines.md`.** Open the file and read it. By the time you are ready to commit, you have been working for a while and the guidelines have drifted out of active context. Re-reading forces a refresh. This step catches problems that would otherwise be missed.

**Step 2 — Run `bin/pre-commit-check.sh`.** Fix every violation it reports.

**Step 3 — Review the diff against `code-guidelines.md`.** The script catches mechanical violations. This step catches structural ones it cannot:
- Active Object pattern (no `querySelectorAll` scans for state removal).
- Event delegation (no loops attaching listeners to individual elements).
- Ancestor-class pattern (no loops applying inline styles to descendants).
- Null guards on `querySelector` results used as references.
- Fire-and-forget async calls missing `.catch()`.
- `fetch` response status checks (`if (!response.ok)`).

Fix anything found in steps 2 or 3 before proceeding. Do not commit until all three steps pass clean.

### Committing
- Prompt the user toward cohesive commits and discrete chunks of work.
- Commit messages: imperative mood, concise, scoped.

## Verification Standards
- Never report a task as done without evidence: console output, test results, or a before/after comparison.
- Never assert findings from project knowledge or memory without verifying against the current codebase.
- If the same fix has failed twice, stop and reassess the approach before trying a third time.
