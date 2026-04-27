# Diagnose Data-Boundary Migration

This is the migration plan for eliminating the data-layer indirection in the
diagnose tab. Target state is documented in `layering.md` (the layering
doctrine) and as-built in `diagnose-hla.txt`.

## Why

After #22 each diagnose feature has its own module, but they all share
`scripts/study-data-cache.js` and pull slices from `data/study-data.json`. Six
files crossing a single hub for data access. Per-feature loaders + per-feature
data files eliminate the indirection without changing the ADT/module-code/
delegation pattern that landed in #13/#17/#22.

The architectural problem is the data boundary, not the ADT/delegation
pattern. The ADT layer (CausalChain, CaseStudy) is correct. The data layer
(JSON shape, loader vending, accessor seam) is the smell.

## End state

- `data/study-data.json` deleted.
- `scripts/study-data-cache.js` deleted.
- Per-feature JSON files: `data/diagnose-causal-chains.json`,
  `data/diagnose-case-studies.json`, `data/diagnose-game-scenarios.json`,
  `data/diagnose-decision-tree.json`, `data/diagnose-muscle-exercise-map.json`,
  plus `data/nomenclature-translations.json` for the adjacent migration.
- Each `diagnose-*` module fetches its own JSON inside `setupX()` via a tiny
  utility (`scripts/load-json.js`).
- Each `setupX()` handles its own fetch failure inside its own wrap. Failures
  fragment per section.
- `scripts/diagnose.js` is composition only: imports each setupX and calls
  them. No prefetch gate, no orchestrator-level try/catch.
- No JS-level cache. Service worker handles caching across page loads.

## Out of scope

- Pillar separation within feature modules (extracting CausalChain to its own
  ADT-only file). Tracked as a future cleanup; this migration keeps each
  feature's ADT and module code co-located.
- patterns.js (#23) and other tab modules. This migration is diagnose-only.
- Behavior changes. The refactor is greenfield in module shape, not
  user-facing behavior.

## Caching decision

No JS-level cache. Reasoning:

- Each `setupX()` is called once per page load (navigation-tabs's
  `initialized` Set gates re-entry). Within a page load there is no second
  call to deduplicate.
- Across page loads, the service worker handles HTTP caching. New JSON files
  are added to `sw.js` precache; the reverse-direction precache check audits
  drift at commit time.
- Failure-rollback retry semantics that `study-data-cache.js` provided
  (clear `cached` on failure so revisit retries) become automatic when there
  is no cache to clear.

## `scripts/load-json.js`

A stateless utility:

```js
export async function loadJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw resp;
  return resp.json();
}
```

Throws the `Response` on HTTP error, the `SyntaxError` on parse failure.
Same error semantics `study-data-cache.js` provided, without the cache
machinery. Each `setupX()` calls `loadJson('./data/...')`.

## Commit sequence

Each commit is independently reviewable; sequence is forward-only.

### Commit A — Layering doctrine + migration plan + diagnose-hla update

No source-code changes. Adds:
- `prd/architecture/layering.md` (target architecture: pillars, rules,
  contracts, anti-patterns)
- `prd/architecture/diagnose-data-boundary-migration.md` (this file)
- Updates to `prd/architecture/diagnose-hla.txt` referencing the doctrine
  and describing the data-boundary gap

### Commit B — Untracked-file cleanup

Delete `scripts/listener-once.js` (created during a discarded approach,
never imported) and `tmp-flashcards-form-probe.html` (persistent dev
artifact). One small commit.

### Commit C — Revert option-B working-tree changes + per-module listener-bind guard

Restore the pre-option-B shape across the 5 diagnose modules: listener
binding inside `setupX()`, no module-top DOM lookups. Add a per-module
`let listenersBound = false;` flag and guard the listener-binding block:

```js
if (!listenersBound) {
  wrap.addEventListener('click', handleX);
  listenersBound = true;
}
```

**Rationale:** `setupX()` runs exactly once per page load only when
`diagnose.init()` resolves. `scripts/navigation-tabs.js:71-74` deletes the
`initialized` gate on init rejection, so a programming bug in any setupX
that escapes its own try/catch will trigger revisit re-running every
setupX — re-binding listeners on already-successful sections. The
per-module flag closes that gap: listener binding is idempotent regardless
of init lifecycle.

This is the per-module-flag answer we discussed at length. Symbol-marker
helper (`bindOnce(target, fn)`) is an equivalent alternative, slightly
more robust to dynamic-wrap futures (nothing on this codebase needs that
robustness today). Per-module flag preferred for minimal infrastructure.

### Commit D — Add `scripts/load-json.js`

Pure utility, no consumers yet. Adds the file to sw.js precache so the
reverse-direction check passes.

### Commit E — Create per-feature JSON files + sw.js precache

Split `data/study-data.json` into the per-feature files. Don't yet touch JS
modules. sw.js precache adds new entries (does not yet remove
study-data.json — that happens in commit H).

### Commits F-1..F-5 — Per-feature module refactor (one commit per feature)

Each commit:
- Replaces `import { getX } from './study-data-cache.js'` with
  `import { loadJson } from './load-json.js'`.
- Replaces `await getX()` with `await loadJson('./data/diagnose-*.json')` in
  `setupX()`.
- Adds inline try/catch around the fetch; on failure calls
  `showFetchError(wrap, 'diagnose-*.json', cause)`.
- Updates the corresponding regression test in `tests/diagnose.test.mjs`.

Order:
- F-1: diagnose-decision-tree (smallest)
- F-2: diagnose-case-studies
- F-3: diagnose-causal-chains
- F-4: diagnose-game
- F-5: diagnose-muscle-map

### Commit G — Migrate nomenclature

Same shape applied to `scripts/nomenclature.js`. Replaces `getTranslations`
with `loadJson('./data/nomenclature-translations.json')`. Inline error
handling.

### Commit H — Delete `study-data-cache.js` and `data/study-data.json`

Both files now have no consumers. Remove. Update `sw.js` precache: drop
study-data.json. Update `tests/issue-4-fetch-errors.test.mjs` to test
`loadJson` directly (the cache-retry semantic was a property of
study-data-cache; with no cache, the test becomes "fetch fails →
loadJson rejects with the Response" and "fetch returns invalid JSON →
loadJson rejects with SyntaxError").

### Commit I — Slim `scripts/diagnose.js`

Remove `prefetchStudyData` import. Remove the orchestrator-level try/catch
(each setupX handles its own EXPECTED errors now — fetch failures render
inline in the section's wrap and the setupX resolves cleanly). `init()`
becomes:

```js
import { setupGame } from './diagnose-game.js';
import { setupCaseStudies } from './diagnose-case-studies.js';
import { setupCausalChains } from './diagnose-causal-chains.js';
import { setupDecisionTree } from './diagnose-decision-tree.js';
import { setupMuscleMap } from './diagnose-muscle-map.js';

export async function init() {
  const container = document.getElementById('diagnose-content');
  if (!container) return;
  await Promise.all([
    setupGame(),
    setupCaseStudies(),
    setupCausalChains(),
    setupDecisionTree(),
    setupMuscleMap()
  ]);
}
```

**Use `Promise.all`, not `Promise.allSettled`.** allSettled consumes
rejections and returns them in the results array; init() would resolve
cleanly even if a setupX threw a programming bug, hiding the bug under
navigation-tabs's success-marked tab. Promise.all rejects on the first
unexpected rejection, which causes navigation-tabs to release the gate
and revisit retries — the right behavior for unexpected bugs.

Each setupX is responsible for catching its own EXPECTED errors (fetch
failures) and resolving cleanly. Only programming bugs that escape the
section's local try/catch will cause init to reject. That is the
intended behavior: expected failures fragment per section without tab
re-init; unexpected bugs surface and trigger retry on revisit.

Per-module listener-bind flag (Commit C) ensures retry does not re-bind
listeners on sections that succeeded on the first attempt.

## Work split

**Claude (me) drives all source-code commits A-I sequentially.**

**Codex parallel work (no source-code overlap):**
- Review Commit A (layering doctrine) before source-code commits begin.
  Push back on framing if anything doesn't hold up.
- Amend `prd/architecture/patterns-hla.md` against the doctrine: drop the
  proposed `patterns-data.js`, replace with per-feature loader pattern. Make
  it a doctrine-aligned target for #23.
- Audit one non-patterns tab module (anatomize, decoder, masterquiz, or
  flashcards) at the layering-doctrine level. Brief report.
- Review each commit B-I as it lands.

## Verification per commit

- `node --test` passes (16/16, plus per-feature loader tests as F-1..F-5
  add them)
- `bash bin/pre-commit-check.sh` passes (in particular the reverse-direction
  precache check catches sw.js drift)
- Manual browser check after F-5 lands: each diagnose section renders;
  fetch failures (DevTools "Offline" mode) display per-section error
  rendering inside each wrap

## Risks

### First-install network fan-out

Multiple JSON fetches on first tab visit (5 diagnose + 1 nomenclature = 6
total, vs the current 1 study-data.json). Bounds:

- The service worker precaches all on install. After SW install, every
  subsequent visit hits cache — zero network fetches.
- On the very first page load, if the user clicks Diagnose before SW install
  completes, the fetches go to network. HTTP/2 multiplexes them; small
  JSONs in parallel are typically sub-second.

Worth keeping in mind beyond the bounds:

- **Request-chain length matters for perceived responsiveness.** Five small
  parallel fetches feel different from a single larger fetch even if the
  total bytes match, because each section's render is gated on its own
  fetch. Empty sections during the small window between tab activation and
  data arrival are a UX cost.
- **Load order may need consideration during refactor.** Currently the
  proposal fires all 5 setupX in parallel via `Promise.all`. If
  user-attention focus warrants it (e.g., the user is most likely looking
  at the top section), prioritizing that section's data load — by ordering
  the awaits, prefetching from index.html, or showing skeleton loaders —
  could be added later. Not part of this migration; flagged for future
  consideration.
- **Submodule focus** is a related concern: the user may be more interested
  in Causal Chains than the Game on a given visit. Today no module knows
  which section the user has in view. If perceived latency becomes an
  issue, viewport-aware loading (e.g., IntersectionObserver-driven prefetch
  on tab open, lazy-render until visible) would be the next step. Out of
  scope here.

The migration accepts the bounded first-install cost in exchange for the
indirection elimination. If user-perceived responsiveness regresses, future
work can address it without unwinding the per-feature loader pattern.

### Test infrastructure

Tests need to mock `globalThis.fetch` per call rather than once for
study-data.json. The fetch-error test pattern already supports this; the
diagnose regression tests will need each setupX test to install a fetch
mock that returns the right per-feature JSON shape.

### Failure UX changes

Instead of "study-data.json failed" at the tab level, per-section
"couldn't load this section" inside each wrap. More informative; slightly
more code paths to test. Each section is autonomous — one section's
failure does not block the others.

## Rollback

Each commit is reversible in isolation. Commit H is the irreversible point
(study-data.json deleted). Before commit H, the codebase has both
mechanisms; after H, the cache module is gone.
