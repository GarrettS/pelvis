# PRI · Pelvis

Interactive study app for the PRI Pelvis Restoration certification exam. Vanilla JS, zero dependencies, zero network requests after load. Deployed at [garretts.github.io/pelvis](https://garretts.github.io/pelvis).

## What it does

Seven interactive modules covering the Pelvis Restoration curriculum: anatomy identification with clickable hotspot overlays, PRI-to-standard nomenclature translation, pattern comparison cheat sheet and concept map, pattern diagnosis scenarios, flashcards, equivalence chain walkthrough, and a 175-question master quiz with missed-question prioritization.

PRI's manual is the primary source. Where PRI terminology departs from standard anatomy, the app flags the departure and explains the mechanics. Where the manual's claims are idiosyncratic, the data says so and cites the source. The `aic-chain.json` separates anatomical fact from PRI interpretation at the field level.

![Anatomize This! — clickable hotspot overlays](img/anatomize-this.png)

![L AIC Chain — interactive muscle chain diagram](img/l-aic.png)

## Built on the web platform

HTML, CSS, JavaScript, and the DOM — the platform as specified by WHATWG, W3C, and ECMA-262. No React, no runtime dependencies, no build step, no bundler. Source files are the deployed files. `package.json` declares only dev-time linting tools (ESLint, espree).

Zero dependencies means every failure mode is the author's to handle. There is no framework lifecycle to defer to and no black-box error boundary to swallow exceptions.

The code guidelines ([code-guidelines.md](https://github.com/GarrettS/web-xp/blob/main/code-guidelines.md)) codify this and the rest of the engineering standards.

## Built with Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) proposes; the human author drives and owns design, review, and editorial direction. Every line is reviewed before commit. Constraints: [CLAUDE.md](CLAUDE.md) (behavioral), [code-guidelines.md](https://github.com/GarrettS/web-xp/blob/main/code-guidelines.md) (engineering), [bin/pre-commit-check.sh](bin/pre-commit-check.sh) (mechanical). Rules a grep can't see — module cohesion, fail-safe, silent failures — require re-reading the guidelines before every commit.

Fail-safe worked example — a state machine over fetch outcomes: [prd/architecture/equivalence-quiz.md](prd/architecture/equivalence-quiz.md).

## Architecture

```
index.html
sw.js                     — service worker (cache-first, offline support)
css/
  layout.css              — structure, grid, responsive breakpoints
  landing.css             — home tab
  abbr-popover.css        — abbreviation popover
  anatomize.css           — anatomy ID game
  aic-chain.css           — L AIC chain diagram
  decoder.css             — SVG pelvis schematic, equivalence quiz
  diagnose.css            — clinical scenarios, case studies
  flashcards.css          — flashcard deck
  masterquiz.css          — master quiz
  quiz-progress.css       — shared quiz progress bar
  nomenclature.css        — joints, translation table
  patterns.css            — cheat sheet, concept map, test reference
scripts/
  navigation-tabs.js       — hash routing, tab/subtab activation, lazy module loading
  home-progress.js         — home-tab progress indicators
  anatomize.js             — anatomy ID game (hotspots, polygon overlays)
  nomenclature-joints.js   — pelvic joints reference
  nomenclature-translation.js — PRI ↔ standard translation
  patterns-cheat-sheet.js  — pattern comparison cheat sheet
  patterns-concept-map.js  — concept map SVG
  patterns-symptom-quiz.js — symptom-to-pattern quiz
  patterns-level-quiz.js   — HALT and Squat level quizzes
  level-quiz.js            — shared level-quiz state machine
  diagnose-game.js         — pattern identification game
  diagnose-case-studies.js — clinical case studies
  diagnose-causal-chains.js — causal chain ordering
  diagnose-decision-tree.js — decision tree walkthrough
  diagnose-muscle-map.js   — muscle-to-exercise map
  flashcards.js            — flashcard deck
  equivalence.js           — chain walkthrough
  equivalence-quiz.js      — equivalence chain quiz mode
  equivalence-answers.js   — equivalence answer-key fetch
  masterquiz.js            — 175-question bank, session config
  master-quiz-progress.js  — master quiz progress bar
  aic-chain.js             — L AIC chain interactive diagram
  decoder.js               — SVG pelvis schematic
  abbr-expand.js           — abbreviation expansion
  abbr-popover.js          — abbreviation popover UI
  load-json.js             — POJO-returning data loader
  load-errors.js           — user-visible load error handling
  shuffle.js               — Fisher–Yates shuffle
  resize-handle.js         — draggable split-pane resize
data/
  aic-chain.json           — chain data: anatomy separated from PRI interpretation
  anatomize-data.json      — image sets with hotspot coordinates
  master-quiz.json         — question bank with explanations
  flashcard-deck.json      — 69 cards, categorized by exam weight
  diagnose-*.json          — per-feature diagnose data (5 files)
  nomenclature-translations.json — PRI ↔ standard translation table
  (+ 7 additional data files)
img/
```

Modules are ES modules (`type="module"`). No globals except a shared data cache. Event delegation throughout — no inline handlers, no `querySelectorAll` loops for state changes. Active Object pattern for tab/selection state.

## Code standards

[Google JS](https://google.github.io/styleguide/jsguide.html)/[CSS](https://google.github.io/styleguide/htmlcssguide.html)/[HTML](https://google.github.io/styleguide/htmlcssguide.html) style guides as baseline, extended with project-specific rules:

- **Fail-safe handling.** Every failure case handled explicitly. `return null`, `console.error`, and `throw` are the same anti-pattern — all silent failures that delegate the problem to the user's blank screen.
- **Module naming by domain concept.** No `utils.js`, `helpers.js`, `tools.js`. If a module cannot be named after what it does, it does not have a single responsibility.
- **Active Object for exclusive state.** Hold a reference to the active element. Deactivate it directly on switch. Never scan siblings.
- **Event delegation over per-element listeners.** Attach to ancestors, match via `closest()`.
- **Dead code removal after every change.** Orphaned selectors, unreferenced IDs, stale variables — cleaned on commit, not accumulated.

Full standards: [code-guidelines.md](https://github.com/GarrettS/web-xp/blob/main/code-guidelines.md)

## Run locally

```bash
git clone https://github.com/GarrettS/pelvis.git
cd pelvis
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). No install, no build.

## Performance

![PageSpeed Insights score](img/pagespeed.png)

*March 2026*
