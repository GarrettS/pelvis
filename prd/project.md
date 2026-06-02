# PRI Pelvis Restoration Study App

https://garretts.github.io/pelvis

An interactive study tool for the PRI Pelvis Restoration certification exam. Single-page vanilla JS application, GitHub Pages, works offline.

## Code Standards
This project follows [Web XP](https://github.com/GarrettS/web-xp), installed at `~/.web-xp/`:
- **`~/.web-xp/code-guidelines.md`** — what the code looks like. Principles, patterns, language rules, formatting.
- **`~/.web-xp/code-philosophy.md`** — why the standards are structured this way.
- Wrap CSS and JS to 88 chars. Do not wrap shorter lines just to appear tidy.
- Prefer double quotes for non-template strings that do not contain quotation marks.
- Organize files top-down: exports / public API first, then file-private helpers and internals. Consistency across files matters more than the choice itself.

This file (`project.md`) is the project overlay. Project-specific decisions live here, not in a fork of the standards. When this overlay overrides a default, it states which rule is overridden and why.

## Content Authority
- **`Pelvis Restoration 2026 Complete Manual.md`** (parent directory) — the course manual. It governs PRI content. If app data or agent output contradicts the manual, the manual wins.

## Design
- **`prd/style-guide.md`** — theme palette, typography, tone, responsive breakpoints.
- **`css/tokens.css`** — app design tokens: theme colors, type scale, durations, shadows, and PRI semantic color variables.

## Feature PRDs
- `prd/anatomize-this.md` — Anatomize This interactive anatomy feature.
- `tools/coord-picker-workflow.md` — coordinate picker tools and image data workflow.
- `prd/archive/` — historical build specs and migration plans. Do not treat archive files as active requirements without checking newer architecture docs.

## Architecture
- `prd/architecture/layering.md` — module boundaries, data-load contract, ADT guidance, and architectural anti-patterns.
- `prd/architecture/navigation-tabs.md` — hash routing, lazy import lifecycle, retry recovery, and tab activation.
- `prd/architecture/patterns.md` — Patterns tab dissolution: subtabs as direct `LAZY_INIT` entries, no `patterns.js`.
- `prd/architecture/diagnose-causal-chains.md` — sortable-list architecture for causal-chain ordering.
- `prd/architecture/equivalence-quiz.md` — state machine over answer-bundle fetch outcomes.
- `prd/architecture/master-quiz.md` — Master Quiz state machine, progress storage, save-flashcard flow, and listener topology.
- `prd/architecture/aic-chain.txt` — L AIC Chain ADT, SVG overlay, leader lines, and single-active-muscle selection.
- `prd/architecture/abbr-popover.md` — abbreviation popover using Popover API, CSS Anchor Positioning, and Active Object state.
- `prd/dlc-rule.md` — Data Load Consumption rule for JSON dependency validation.

## Directory Structure
```
bin/          dev tooling (pre-commit-check.sh)
css/          domain stylesheets and design tokens
scripts/      JS modules
data/         JSON data files
img/          image assets
prd/          PRDs, style guide, architecture notes, archive
tools/        dev tools (coord-picker)
sw.js         service worker (root — browser scope constraint)
```

`sw.js` lives at project root because browsers restrict a service worker's scope to its own directory and below. A SW at `scripts/sw.js` could only intercept fetches under `scripts/`. GitHub Pages does not support the `Service-Worker-Allowed` header that would widen the scope, so the file must be at root.

## Asset Rules

- `sw.js` precache: each entry must be justified by an app code reference (`index.html`, a JS module in `scripts/`, or a JSON data file in `data/`). Files referenced only by `tools/`, PRDs, or README are not app assets and must not be precached.
- When files are added or removed from the app, update `sw.js` precache in the same commit.
- `tools/` contains dev-only utilities (coord-picker, data generators). These are not app code and do not justify asset list entries.

## Key Decisions
- Hash-based SPA navigation (`location.hash` + `hashchange`). No History API.
- Eight top-level views: Home, Anatomy, Nomenclature, Patterns, Diagnose This!, Flashcards, Equivalence, Master Quiz.
- Flashcard taxonomy (`category`) and quiz taxonomy (`domain`) are intentionally separate; user-created flashcards from quiz saves receive `user_created` category.
- JSON data files in `data/`.
- **Abbreviation expansion** — PRI initialisms (L AIC, IsP ER, HALT, etc.) are stored as plain text in JSON data. `abbr-expand.js` wraps them in `<abbr title="...">` tags at render time using a single-pass regex with longest-first alternation (so "L AIC" is consumed before "AIC" can match inside it). Callers use `innerHTML` with `expandAbbr(text)`. Earlier iterations pre-baked `<abbr>` tags into JSON, but this mixed presentation with data. On browsers that support CSS Anchor Positioning, `abbr-popover.js` progressively enhances these `<abbr>` elements with positioned popovers on hover/tap; unsupported browsers keep native `title` tooltips.
