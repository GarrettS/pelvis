# PRI Pelvis Restoration Study App

https://garretts.github.io/pelvis

An interactive study tool for the PRI Pelvis Restoration certification exam. Single-page vanilla JS application, GitHub Pages, works offline.

## Content Authority
- **`Pelvis Restoration 2026 Complete Manual.md`** (parent directory) — the course manual. Authoritative for all PRI content. If app data contradicts this file, the manual wins. If Claude's training data contradicts this file, the manual wins.

## Design
- **`prd/style-guide.md`** — theme palette, typography, tone, responsive breakpoints.

## Feature PRDs
- `prd/CC-BUILD-SPEC.md` — feature spec (all tabs, content requirements, data strategy)
- `prd/CC-BUILD-SPEC-equiv-quiz.md` — equivalence quiz detail spec (bug fixes, enriched feedback, review screen)
- `prd/anatomize-this.md` — Anatomize This interactive anatomy feature
- `prd/coord-picker-workflow.md` — coordinate picker tools and image data workflow

## Directory Structure
```
bin/          dev tooling (pre-commit-check.sh)
css/          domain stylesheets
scripts/      JS modules
data/         JSON data files
img/          image assets
prd/          PRDs, style guide, sprint specs
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
