# Navigation-Tabs Contract

`scripts/navigation-tabs.js` is the orchestrator for tab/subtab activation, lazy module loading, and loading-state UI. This doc is the canonical contract every lazy-loaded module follows. Per-tab HLAs (`prd/architecture/*`) reference this doc rather than restating the contract.

## What navigation-tabs owns

- Tab and subtab activation: hash routing, `.activeTab` class management, scroll affordance.
- Lazy import dispatch: imports the module(s) for a content id on first activation.
- Skeleton loading UI: delayed-show placeholder shown only when load takes longer than a threshold.
- Import-error rendering: when a module's `import()` rejects (file not found, syntax error, etc.), navigation-tabs renders the error inside the content container.

## What navigation-tabs does *not* own

- Module readiness signaling (no awaitable contract beyond import resolution).
- Module-internal setup beyond what `import()` runs (end-state contract; the transitional `r.module.init?.()` call is documented under "Transition state").
- Module activation events (no `subtab-shown` dispatch).
- Data loading or data-error rendering (each module owns its data; data errors render inside the module's container).
- Subsequent activations beyond the first (the module cache handles repeat imports; modules use `ResizeObserver` for layout-redraw on revisit).

## LAZY_INIT shape

```js
const LAZY_INIT = {
  'contentId-1': './module-a.js',
  'contentId-2': ['./module-b.js', './module-c.js'],
  // ...
};
```

Each key is a content-element id. Each value is a string (single path) or array of strings (multiple paths to import together).

Tab-level entries (e.g., `'diagnose-content'`) point to the tab's implementation file or files. Subtab-level entries (e.g., `'patterns-cheat-sheet-content'`) point directly to per-subtab files when the tab has no orchestrator.

The decision of "tab module exists, point at it" vs "tab module dissolves, point at per-subtab files" is per-tab and lives in the tab's HLA. Navigation-tabs just dispatches based on what LAZY_INIT says.

## Lazy import flow

On first activation of a content id:

1. **Dedupe.** Check the `initialized` Set; return if already activated.
2. **Mark active.** Add the content id to `initialized`. (Stays even on failure — retry policy is page reload, not revisit.)
3. **Resolve container.** `document.getElementById(contentId)`. Return if absent.
4. **Start skeleton timer.** `setTimeout(showSkeleton, SHOW_SKELETON_AFTER_MS)`.
5. **Import each path in parallel** via a small `importModule(path)` helper that resolves to a plain result object — never rejects. `Promise.all` then collects every outcome.
6. **After all resolve:** cancel skeleton timer; clear skeleton (no-op if never shown); render an import-error message for each failed path.

```js
const SHOW_SKELETON_AFTER_MS = 250;

function importModule(path) {
  return import(path).then(
    ()      => ({ ok: true,  path }),
    (cause) => ({ ok: false, path, cause })
  );
}

function lazyInit(contentId) {
  if (initialized.has(contentId)) return;
  const entry = LAZY_INIT[contentId];
  if (!entry) return;

  initialized.add(contentId);
  const container = document.getElementById(contentId);
  if (!container) return;

  const paths = Array.isArray(entry) ? entry : [entry];
  const skeletonTimer = setTimeout(() => showTabLoading(container), SHOW_SKELETON_AFTER_MS);

  Promise.all(paths.map(importModule)).then((results) => {
    clearTimeout(skeletonTimer);
    clearTabLoading(container);
    results
      .filter((r) => !r.ok)
      .forEach((r) => showImportError(container, r.path, r.cause));
  });
}
```

`importModule` resolves with `{ok, path}` on success or `{ok: false, path, cause}` on failure — a plain result object, no mutation of built-in `Error` instances and no custom error subclass. Each call always resolves, so `Promise.all` is sufficient (no `Promise.allSettled` needed). Successful imports' module-top side effects already ran during the import attempt, so their content is in the container regardless of sibling failures.

For single-path entries: one result, render its error if it failed.

For multi-path entries (e.g., `patterns-concept-map-content` loading both concept-map and symptom-quiz): one path failing does not bail out the others. The user sees whichever modules rendered successfully *and* an import-error message for each that failed, identifying the specific file via `r.path`.

`clearTabLoading` is idempotent (it removes `.tab-loading` if present, no-ops if not), so canceling the timer + always calling `clearTabLoading` is safe whether or not the skeleton ever became visible.

## Skeleton timing

- **Threshold (`SHOW_SKELETON_AFTER_MS`):** 250ms. Loads under threshold show no skeleton at all. Loads over threshold show the skeleton until they complete.
- **No minimum display.** Skeleton hides exactly when the load completes. A brief flash zone exists (load resolves shortly after the timer fires) but is preferable to padding load times. If brief flashes turn out to be perceptible in practice, raise the threshold; do not add minimum-display padding.
- **Polish (later):** a CSS opacity transition on `.tab-loading` would soften the show/hide; not required for the contract.

The skeleton itself is a generic placeholder (one heading skeleton + two line skeletons). It does not match per-feature layout — it only signals "loading is taking longer than expected." A skeleton's *presence* is the information; its content is incidental.

## Module contract

A lazy-loaded module:

- **MAY** export anything it needs internally. **Is not required to export `init()`.**
- **Performs setup at module top** as side effects on import. Module-top runs once per realm via the ES module cache.
- **Handles its own data load.** Uses `loadJson` from `scripts/load-json.js`, which returns a POJO `{ok, data, path, cause}`. Render runs only on `result.ok`; render bugs propagate as ordinary errors past the explicit `if (!result.ok)` branch.
- **Renders its own data errors** at the implementation layer (the file imported by navigation-tabs, or the file that calls per-feature `mount` functions). ADT classes / per-feature functions return or propagate the result; the implementation layer checks `result.ok` and calls `showFetchError(container, result)` on failure.
- **For layout-sensitive features** (those needing redraw when the container becomes visible or resizes): observes its own container with `ResizeObserver`. Does not rely on a `subtab-shown` event.
- **Pre-data controls** (interactive elements present in source HTML before data loads) are either `disabled` until render or guard explicitly on data-ready in their handlers. Generated controls (those that don't exist before render) need no guard — `closest()` returns null and handlers return early.

Modules **MUST NOT**:

- Depend on navigation-tabs calling any function on them (the import is the only signal).
- Depend on a `subtab-shown` event for activation work (it is being removed; use `ResizeObserver` for what actually matters, which is dimension change).
- Add or remove the skeleton themselves — that is navigation's responsibility.

## Retry semantics

There is no retry. The recovery path for any failure is page reload.

- **Successful import:** module cached forever in the realm's module map; revisit returns the cached module instantly.
- **Failed import:** the import promise's rejection is also cached. The `initialized` Set is not cleared on failure; revisit shows the same error already rendered in the container. Page reload is the only way to retry.
- **Data-load failure inside a successfully-imported module:** module is initialized; data error is rendered in the feature's container by the implementation layer's `!result.ok` branch. Retry is feature-level (a retry button if the feature wants one) or page reload.

Distinct failure modes; one recovery mechanism. Documented honestly so users and contributors don't expect retry that doesn't exist.

## ResizeObserver as the layout-redraw signal

Replaces the previous `subtab-shown` event for modules that need redraw on visibility/dimension change (anatomize, aic-chain).

- The module observes its own container with `ResizeObserver`.
- When the container goes from 0×0 (hidden via `display: none`) to non-zero (becomes visible), the observer fires — initial draw at first visibility.
- When the container resizes (window resize, panel resize), the observer fires — redraw on dimension change.
- The observer callback should be idempotent (existing draw functions in this codebase already are: e.g., `drawArrows` skips structures that already have an arrow drawn).

Activation in this codebase uses CSS `display: none ↔ block` for subtab visibility, so dimensions change on activation and `ResizeObserver` fires reliably. If activation ever switches to `visibility` or `opacity` toggling, dimensions wouldn't change and `ResizeObserver` wouldn't fire — that's a contract dependency worth knowing.

## Import-error rendering

`showImportError(container, pathSpec, moduleError)` (existing helper in `scripts/load-errors.js`) renders an import error inside the container. Used by navigation-tabs's `.catch` on the import promise.

`pathSpec` is a string — for multi-path entries, the paths joined by `', '`. Sufficient for the developer to identify which files were involved; the user-facing message says "couldn't load this section" and the path is diagnostic.

## Removal targets (post-migration)

After all modules have migrated to self-running module-top side effects:

- The `r.module.init?.()` call in `lazyInit` is removed entirely.
- The `subtab-shown` `dispatchEvent` call in `activateSubtab` is removed (after `anatomize.js` and `aic-chain.js` migrate to `ResizeObserver`).
- `LAZY_INIT` no longer accepts the legacy entry value `{ path: './foo.js' }`. Entries are a direct path string or array of strings only.

## Transition state (current)

Until all modules migrate, navigation-tabs accepts both the current contract and legacy forms:

- `lazyInit` calls `r.module.init?.()` on each successfully-imported module. Four modules still export `init()` and depend on this call: `scripts/decoder.js`, `scripts/flashcards.js`, `scripts/masterquiz.js`, `scripts/equivalence-quiz.js`. Modules without `init` are fine — the optional chain no-ops. The `r.module.init?.()` call is removed once these four migrate to self-running module-top side effects (see *Removal targets*).
- `LAZY_INIT` entries can be either the legacy form `{ path: './foo.js' }` or a direct path string / array of strings. Final state is string or array only.
- `subtab-shown` continues to dispatch until `anatomize.js` and `aic-chain.js` no longer listen to it.

## What this doc does *not* cover

- `scripts/load-json.js` and the result POJO `{ok, data, path, cause}` — see `prd/architecture/layering.md` and the diagnose migration plan.
- ADT class shape, Decorator Factory pool — see `prd/architecture/layering.md`.
- Per-tab module structure decisions (when does a tab module exist?) — see per-tab HLAs.
- App-level error UI styling (`showImportError`, `showFetchError` rendering) — those helpers are app-level and live in `scripts/load-errors.js`.
