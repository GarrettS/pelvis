# Diagnose Tab Migration

End state: each diagnose feature is its own self-running module activated as its own subtab via `LAZY_INIT`. No `scripts/diagnose.js` orchestrator. No `mount(container, dataPath)` exports. Data load via `loadJson` (POJO return) with per-feature `showFetchError` on `!result.ok`.

Originally scoped as a data-boundary migration (eliminate `study-data-cache.js`'s indirection over `data/study-data.json`). That work is largely landed. The remaining work is **subtab dissolution**, planned here because it touches the same set of files.

## Why

### Data-boundary phase (largely complete)

After the original diagnose split, each diagnose feature had its own module but shared `scripts/study-data-cache.js` and pulled slices from `data/study-data.json`. Six files crossing a single hub for data access. Each feature also exported a `setupX()` wrapper that hid the fetch behind a parameterless function with hardcoded selectors.

The phase split `study-data.json` into per-feature JSON files and replaced the cache hub with direct `loadJson` calls. Per-feature JSON files exist; `study-data.json` and `scripts/study-data-cache.js` are deleted in staging.

### Dissolution phase (pending)

The five diagnose subtabs must run independently. Constraint:

> No cross-submodule dependencies. No big-up-front load — only the active submodule loads. Skeleton is shown per-subtab.

A `diagnose.js` orchestrator — even a clean declarative one with a feature table and top-level `await Promise.all(...)` — violates all three:

- It couples the five features through one import.
- It fans out all five fetches on tab activation regardless of which subtab is active.
- It produces a single tab-level skeleton instead of per-subtab skeletons.

The Patterns tab already dissolved its orchestrator for the same reasons. Diagnose follows the same shape.

## What dissolution means structurally

Each diagnose subtab's route segment, container id, and module path share one token:

```
#diagnose/game           → diagnose-game-content           → scripts/diagnose-game.js
#diagnose/case-studies   → diagnose-case-studies-content   → scripts/diagnose-case-studies.js
#diagnose/causal-chains  → diagnose-causal-chains-content  → scripts/diagnose-causal-chains.js
#diagnose/decision-tree  → diagnose-decision-tree-content  → scripts/diagnose-decision-tree.js
#diagnose/muscle-map     → diagnose-muscle-map-content     → scripts/diagnose-muscle-map.js
```

Route token, container id, and module path align through one Shared Key per subtab. `navigation-tabs.js` keys `LAZY_INIT` by container id; the dissolution just registers each subtab module under its own content id and removes the tab-level `diagnose-content` entry.

## Target LAZY_INIT

```js
'diagnose-game-content':          './diagnose-game.js',
'diagnose-case-studies-content':  './diagnose-case-studies.js',
'diagnose-causal-chains-content': './diagnose-causal-chains.js',
'diagnose-decision-tree-content': './diagnose-decision-tree.js',
'diagnose-muscle-map-content':    './diagnose-muscle-map.js',
```

The `'diagnose-content': './diagnose.js'` entry is removed. `scripts/diagnose.js` is deleted.

## Per-feature module shape

Each diagnose feature module becomes self-running. Module-top side effects do the work on import — the same shape `patterns-cheat-sheet.js` and its siblings use.

```js
import {loadJson} from './load-json.js';
import {showFetchError} from './load-errors.js';

const container = document.getElementById('diagnose-causal-chains-content');

container.addEventListener('click', (event) => {
  const target = event.target.closest('.chain');
  if (!target) return;
  CausalChainFactory.getInstance(target).handleClick();
});

const result = await loadJson('./data/diagnose-causal-chains.json');
if (result.ok) {
  renderChains(container, result.data);
} else {
  showFetchError(container, result);
}
```

Key points:

- Container lookup at module top — the container id is hardcoded; the module knows which subtab it belongs to.
- `loadJson` returns a POJO `{ok, data, path, cause}`; it does not throw. Render is gated on `result.ok`.
- Render bugs propagate as ordinary errors past the `result.ok` branch (they reject the module's top-level await, which rejects the import, which `navigation-tabs.js` renders via `showImportError`).
- No `mount(container, dataPath)` export — the orchestrator that would have called it is gone.
- ADT classes (`CausalChain`, `CaseStudy`) stay page-independent — pure entity behavior, no app-level error rendering, no DOM lookups by absolute selector. The page-coupled glue lives at module top.

## Pre-data control caveat: `diagnose-muscle-map.js`

Four of the five diagnose features render their interactive controls from data — no actionable controls exist in source HTML before render, so `closest()` early-returns protect handlers from pre-data clicks.

`diagnose-muscle-map.js` is different. It has source-rendered controls (`#muscle-view-tabs`, `#muscle-search`) and a `hashchange` handler. A pre-data click or hash change would act on undefined data.

Fix: bind these listeners inside the `result.ok` branch, not at module top. After binding, call `applySubview()` once so any current hash is honored.

This is the same pattern Patterns uses for its source-rendered quiz controls (symptom answer buttons, level quiz reveal/next): the data-ready gate.

## Lifecycle: top-level await as the readiness signal

With top-level `await loadJson(...)` in each module, `navigation-tabs.js`'s `import(path)` promise resolves only after the module's data has loaded and the first render has run. The existing skeleton machinery stays honest: the skeleton appears inside the active subtab's container until the subtab module finishes evaluating.

No dynamic imports inside diagnose modules. Dynamic import is `navigation-tabs.js`'s responsibility — feature modules own data, listeners, and render only.

## Caching decision

No JS-level cache. Each per-feature module's load runs once per page load (modules evaluate once per realm by ES module caching). Across page loads, the service worker handles HTTP caching. The new JSON files are precached by `sw.js`; the reverse-direction precache check audits drift at commit time.

## Cross-feature dependency check

The five diagnose modules do not import each other. They share only common utilities (`loadJson`, `showFetchError`, expand-abbreviation helpers). No dependency blocks dissolution.

## Commit sequence

### Already landed

- Per-feature JSON files: `data/diagnose-causal-chains.json`, `data/diagnose-case-studies.json`, `data/diagnose-game-scenarios.json`, `data/diagnose-decision-tree.json`, `data/diagnose-muscle-exercise-map.json`, plus `data/nomenclature-translations.json` for the adjacent nomenclature migration.
- `scripts/load-json.js` exists and returns the POJO `{ok, data, path, cause}`.
- `data/study-data.json` and `scripts/study-data-cache.js` deleted in staging.

### Pending — doctrine reconciliation

`prd/architecture/layering.md` previously described the typed-error `FetchFailure` contract and the orchestrated `mount(container, dataPath)` shape. Reconciliation against the POJO contract and the dissolution direction lands before or alongside the first feature conversion so doc and code don't drift.

### Pending — per-feature conversion (one commit per feature, any order)

For each diagnose feature:

1. Convert the module from `export async function mount(container, dataPath)` to self-running module-top side effects:
   - Move container lookup to module top using the subtab content id.
   - Move the delegated listener bind to module top (generated controls) or inside the `result.ok` branch (source-rendered controls — `diagnose-muscle-map.js` only).
   - `const result = await loadJson(path)` at module top.
   - `if (result.ok) render(...); else showFetchError(container, result);`.
   - For `diagnose-muscle-map.js`: defer source-rendered-control listeners and `hashchange` to inside the `result.ok` branch; call `applySubview()` once after binding.
2. Add the module to `LAZY_INIT` under its subtab content id; remove the matching mount call from `diagnose.js`.
3. Update the per-feature regression test to fetch-mock + dynamic-import-the-module pattern (mirroring Patterns subtab tests).

### Pending — final dissolution commit

When all five features are self-running and registered under their subtab content ids:

- Remove the `'diagnose-content': './diagnose.js'` entry from `LAZY_INIT`.
- Delete `scripts/diagnose.js`.
- Update `sw.js` precache: `diagnose.js` removed; each feature module remains.
- Manual browser check per the `MEMORY.md` verification checklist, plus: each diagnose subtab loads its JSON only when activated; per-subtab fetch failures render inside the active subtab container; switching between subtabs does not re-fetch.

## Verification per commit

- `node --test` passes.
- `bash bin/pre-commit-check.sh` passes; the reverse-direction precache check catches `sw.js` drift.
- Manual browser check: the converted subtab activates with skeleton; renders on success; renders per-feature error inside its own container on fetch failure; programming-bug render errors surface as import errors via `showImportError`, not as fetch errors.

## Risks

### Per-subtab fetch instead of bulk

Each subtab now fetches its own JSON on first activation. On a cold cache, switching through all five subtabs in one session triggers five separate fetches — up from the previous one-fetch-then-cache pattern. The service worker precaches all five files, so post-install this is zero network round-trips. The bounded cold-cache cost buys subtab independence.

### Source-rendered controls in `diagnose-muscle-map.js`

The pre-data-click hazard is real and must be addressed in that file's conversion commit, not left for a follow-up. The Patterns precedent (symptom quiz, level quiz) is the model.

## Out of scope

- Behavior changes. The refactor is greenfield in module shape, not user-facing behavior.
- `aic-chain.js` `cached` → `instance` rename. Optional drive-by; can be a small commit on its own.

## Rollback

Each per-feature conversion is reversible in isolation (revert the commit, restore the LAZY_INIT entry, restore the `mount` export). The final dissolution commit (delete `diagnose.js`, remove the tab-level LAZY_INIT entry) is the irreversible point.
