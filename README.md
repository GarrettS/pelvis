# PRI · Pelvis

Interactive study app for the PRI Pelvis Restoration certification exam. Built on the web platform — HTML, CSS, and JavaScript, no dependencies, no build step, no network requests after load. Deployed at [garretts.github.io/pelvis](https://garretts.github.io/pelvis).

## What it does

Seven interactive modules covering the Pelvis Restoration curriculum: anatomy identification with clickable hotspot overlays, PRI-to-standard nomenclature translation, pattern comparison cheat sheet and concept map, pattern diagnosis scenarios, flashcards, equivalence chain walkthrough, and a 175-question master quiz with missed-question prioritization.

PRI's manual is the primary source. Where PRI terminology departs from standard anatomy, the app flags the departure and explains the mechanics. Where the manual's claims are idiosyncratic, the data records and cites the source. `aic-chain.json` separates anatomical fact from PRI interpretation at the field level.

![Anatomize This! — clickable hotspot overlays](img/anatomize-this.png)

![L AIC Chain — interactive muscle chain diagram](img/l-aic.png)

## Built on the web platform

HTML, CSS, JavaScript, and the DOM — the platform as specified by WHATWG, W3C, and ECMA-262. No React, no runtime dependencies, no build step, no bundler. The source files are the deployed files. `package.json` declares only dev-time linting tools (ESLint, espree).

Zero dependencies means every failure path is handled in app code. No framework intercepts exceptions; nothing is discarded silently.

The code guidelines ([code-guidelines.md](https://github.com/GarrettS/web-xp/blob/main/code-guidelines.md)) codify this and the rest of the engineering standards.

## Built with Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) proposes; the human author drives and owns design, review, and editorial direction. Every line is reviewed before commit. Constraints: [CLAUDE.md](CLAUDE.md) (behavioral), [code-guidelines.md](https://github.com/GarrettS/web-xp/blob/main/code-guidelines.md) (engineering), [bin/pre-commit-check.sh](bin/pre-commit-check.sh) (mechanical). Rules a grep can't catch — module cohesion, fail-safe handling, silent failures — require re-reading the guidelines before every commit.

Fail-safe worked example — a state machine over fetch outcomes: [prd/architecture/equivalence-quiz.md](prd/architecture/equivalence-quiz.md).

## Architecture

```
index.html   — single page; tabs swap module views in place
sw.js        — service worker (cache-first, offline support)
css/         — one stylesheet per module, plus tokens.css (custom properties) and layout.css (grid, breakpoints)
scripts/     — one ES module per feature, named by feature
data/        — one JSON file per feature; curated PRI content, no runtime generation
img/         — diagrams and screenshots
```

Modules are ES modules (`type="module"`) that share no global state; each loads its own data through `load.js`. Feature modules are named after their feature (`anatomize.js`, `flashcards.js`, `masterquiz.js`, …). The cross-cutting modules carry the shared behavior:

- `load.js` / `error-ui.js` — JSON fetch, and the user-visible load and import error UI
- `navigation-tabs.js` / `select-group.js` — Active Object for tab and selection state (deactivate the held reference, never scan siblings)
- `sortable-list-form.js` — drag-to-reorder list (causal chains)
- `quiz-form.js` / `level-quiz.js` — shared quiz rendering and the level-quiz state machine
- `el-create.js` / `escape-html.js` / `shuffle.js` — element construction, HTML escaping, Fisher–Yates

Event delegation throughout — no inline handlers, no `querySelectorAll` loops for state changes.

### Design docs

Per-feature deep dives — the engineering decisions behind each module, not the feature list:

- **[Diagnose Causal Chains](prd/architecture/diagnose-causal-chains.md)** — `pointermove` drag-to-reorder: FLIP layout animation, document-coordinate hit-testing, autoscroll beneath a sticky nav, grading that survives a re-drag. · [Live](https://garretts.github.io/pelvis/#diagnose/causal-chains)
- **[abbr-popover](prd/architecture/abbr-popover.md)** — `<abbr>` tooltips on the Popover API + CSS Anchor Positioning, Active Object pattern.
- **[Navigation Tabs](prd/architecture/navigation-tabs.md)** — hash routing, app init, and the Active Object that owns tab and selection state.
- **[L AIC Chain](prd/architecture/aic-chain.txt)** — muscle-chain SVG overlay: anchor circles, leader-line geometry, single-active-muscle selection. *(plain text — its ASCII diagrams wouldn't survive a markdown conversion.)*
- **[Equivalence Quiz](prd/architecture/equivalence-quiz.md)** — a state machine over fetch outcomes (the fail-safe worked example).

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
