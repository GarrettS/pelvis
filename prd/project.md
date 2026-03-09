# PRI Pelvis Restoration Study App

https://garretts.github.io/pelvis

An interactive study tool for the PRI Pelvis Restoration certification exam. Single-page vanilla JS application, GitHub Pages, works offline.

## Content Authority
- **`Pelvis_Restoration_2026_Complete_Manual.md`** — the course manual. Authoritative for all PRI content. If app data contradicts this file, the manual wins. If Claude's training data contradicts this file, the manual wins.
- **`LEARN-PRI.md`** — supplementary course knowledge.

## Design
- **`prd/style-guide.md`** — theme palette, typography, tone, responsive breakpoints.

## Feature PRDs
- `prd/CC-BUILD-SPEC.md` — build spec (feature inventory, navigation, data strategy, build order)
- `prd/anatomize-this.md` — Anatomize This interactive anatomy feature

## Directory Structure
```
bin/          dev tooling (pre-commit-check.sh)
css/          layout.css, components.css
scripts/      JS modules
data/         JSON data files
img/          image assets
prd/          PRDs, style guide, sprint specs
```

## Key Decisions
- Hash-based SPA navigation (`location.hash` + `hashchange`). No History API.
- Six tabs: Anatomy, Nomenclature, Patterns, Diagnose This!, Flashcards, Equivalence.
- Flashcard taxonomy (`category`) and quiz taxonomy (`domain`) are intentionally separate; user-created flashcards from quiz saves receive `user_created` category.
- JSON data files in `data/`.
