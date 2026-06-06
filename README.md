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

## Built with Web XP

Agentic pair programming under [Web XP](https://github.com/GarrettS/web-xp) doctrine, with adapter skill files for Claude Code and Codex. Code guidelines, pre-commit, and agent skill files are in Web XP.

## Architecture

```
index.html   — single page; tabs swap module views in place
sw.js        — service worker (cache-first, offline support)
css/         — one stylesheet per module, plus tokens.css (custom properties) and layout.css (grid, breakpoints)
scripts/     — one ES module per feature, named by feature
data/        — one JSON file per feature; curated PRI content, no runtime generation
img/         — diagrams and screenshots
```

Each feature module loads its own data via `loadJson` (load.js) and is named for what it does — `anatomize.js`, `flashcards.js`, `masterquiz.js`. The shared modules:

**Extracted behaviors** — encapsulation chosen by fit:

- `sortable-list-form.js` — `SortableListContainer` / `SortableListForm` (classes): drag-to-reorder (causal chains)
- `resize-handle.js` — `createResizeHandle` (factory): a draggable resize handle
- `select-group.js` — `bindSelectGroup` (closure): a generic single-select binder

**Structural** — drive the app:

- `navigation-tabs.js` — routing, init, the Active Object tab state
- `load.js` / `error-ui.js` — the data-load + error boundary every feature runs through

**Generic functions** — domain-agnostic, drop into any project:

- `shuffle.js` — Fisher–Yates · `escape-html.js` — HTML-entity escaping · `el-create.js` — DOM/SVG construction

Event delegation paired with the Shared Key buys class-based handling: one container listener gets or creates the instance from the clicked element — no init loop, no handlers attached per instance or per element, and it works for dynamically added elements. One-off handlers go where delegation earns nothing, like `chainsWrap.addEventListener('animationend', clearChainEntering)`.

### Design docs

Per-feature deep dives — the engineering decisions behind each module, not the feature list:

- **[Diagnose Causal Chains](prd/architecture/diagnose-causal-chains.md)** — `pointermove` drag-to-reorder: FLIP layout animation, document-coordinate hit-testing, autoscroll beneath a sticky nav, grading that survives a re-drag. · [Live](https://garretts.github.io/pelvis/#diagnose/causal-chains)
- **[abbr-popover](prd/architecture/abbr-popover.md)** — `<abbr>` tooltips on the Popover API + CSS Anchor Positioning, Active Object pattern.
- **[Navigation Tabs](prd/architecture/navigation-tabs.md)** — hash routing, app init, and the Active Object that owns tab and selection state.
- **[L AIC Chain](prd/architecture/aic-chain.txt)** — muscle-chain SVG overlay: anchor circles, leader-line geometry, single-active-muscle selection. *(plain text — its ASCII diagrams wouldn't survive a markdown conversion.)*

## Code standards

Built to **[Web XP](https://github.com/GarrettS/web-xp)** — a web-platform engineering method, applied to every line and re-checked before every commit. Three of its rules:

- **Fail-safe handling.** Every failure case handled explicitly. `return null`, `console.error`, and `throw` are the same anti-pattern — all silent failures that delegate the problem to the user's blank screen.
- **Module naming by domain concept.** No `utils.js`, `helpers.js`, `tools.js`. If a module cannot be named after what it does, it does not have a single responsibility.
- **Active Object for exclusive state.** Hold a reference to the active element. Deactivate it directly on switch. Never scan siblings.

Full guidelines: [code-guidelines.md](https://github.com/GarrettS/web-xp/blob/main/code-guidelines.md)

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
