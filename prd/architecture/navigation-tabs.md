# Navigation-Tabs Contract

`scripts/navigation-tabs.js` maps the URL hash to a tab and imports that tab's module the first time the tab is activated. The hash is `#tab` or `#tab/subtab`.

Scope is loading and recovery: the scroll-shadow affordance (`initScrollAffordance`) and service-worker registration also live in this file but are outside this contract. A hash may carry a third `/subview` segment; navigation-tabs forwards it untouched and the owning module reads it — only `diagnose-muscle-map.js`, today.

## Recovery

```js
const initialized = new Set();  // imports that resolved ok
const pending     = new Set();  // imports in flight
const failed      = new Set();  // imports that resolved with error
```

`lazyInit` adds the contentId to `pending` before starting an import. On resolution, it removes from `pending` and adds it to either `initialized` (ok) or `failed` (error).

`importModule` wraps `import()` so it always resolves — never rejects — to the `result` that `handleImportError` later branches on:

```js
const importModule = path => import(path).then(
    ()    => ({ok: true,  path}),
    cause => ({ok: false, path, cause}));
```

On failure, `handleImportError` renders a callout whose retry button calls `lazyInit` again. Re-clicking the tab calls `lazyInit` too. The tab and the retry button share one lifecycle: while the import is in flight, the tab dims and the retry button is locked by CSS cascade — see "Idempotent retry path" below.

```
                  tab activation              import ok
  start ──▶ Idle ──────────────────▶ Pending ───────────────▶ Loaded
                                       │  ▲
                         import error  │  │ re-activation or retry
                                       ▼  │ button (cache-busted)
                                     Failed ┘

  Re-activating a tab that is already loading or loaded is a no-op (dedupe):
    Pending stays Pending while its import is still in flight.
    Loaded stays Loaded after a successful import.
```

Data-load failure (module imported ok but `loadJson` returned `{ok: false}`) is handled by `attemptLoad` in `scripts/error-ui.js`, called per-module — not this contract.

### Cache-Busting

Dynamic `import` cache outcome — including failure — in the module map. To enable retry, `lazyInit` appends cache-busting query when `failed.has(contentId)`:

```js
const path = failed.has(contentId) ? entry + '?r=' + Date.now() : entry;
failed.delete(contentId);
```

## Idempotent retry path

The tab (or subtab) and the retry button are two actuators for the same state transition: `Failed → Pending` for a given contentId. The state machine cares about the contentId, not which actuator triggered it. Both routes land in the same `lazyInit(contentId, link)` call.

While the import is in flight `lazyInit` adds `.loading` to the clicked link and to the content container. `.nav-tab.loading` / `.subtab.loading` dim the tab and set `cursor: wait`; `.content.loading` cascades to `.callout-retry`, dimming and disabling any retry button still on screen.

`handleNavClick` short-circuits same-hash clicks. Assigning the same value to `location.hash` fires no `hashchange` event, so re-clicking the failed tab would otherwise be a no-op. When the clicked link's hash equals `location.hash`, `handleNavClick` calls `applyHash()` directly.

Spam-clicks have two independent guards:

1. **JS-side**, `lazyInit` returns early when `pending.has(contentId)`.
2. **CSS-side**, `.content.loading .callout-retry` makes the button uninteractive while `.loading` is set.

The renderer is a separate concern from the loader. `load.js` diagnoses failures and delegates rendering through a callback. `handleImportError(result, {render, onRetry})` translates `result.cause` into a user-readable message, then invokes `render(message, onRetry)`. The render delegate lives in `error-ui.js` as `renderError`, which constructs the callout and retry button. The loader names no DOM element; the renderer is swappable without touching `load.js`.

The retry button's `click` handler:

```js
onRetry: () => lazyInit(contentId, link)
```

Clicking it re-enters `lazyInit` for the same contentId — the `Failed → Pending` transition (cache-busted), the same call re-activating the tab makes. Callout lifecycle belongs to the state machine: `lazyInit` calls `clearErrors(container)` after the import resolves, before re-rendering content or showing a fresh callout.

## Single path per entry

`LAZY_INIT` maps each contentId to one module path. A module that needs another — a sibling subtab module on the same tab, or a cross-feature read like home's master-quiz progress — statically imports it at module top. ES module static imports propagate failure: if the dependency fails to fetch, parse, or evaluate, the importer's body does not execute, so a partial-state "half-wired UI plus an error callout" is impossible by construction.

## Re-activation and self-driven redraw

`lazyInit` runs a module exactly once per contentId — it returns early when `initialized.has(contentId)`. navigation-tabs.js never re-invokes a module on re-activation — re-activating a loaded tab is the dedupe no-op the diagram notes. Whatever a module wires up at init runs once for the page's life — re-activating its tab cannot stack listeners. The corollary: a module that must react each time its section is shown is not re-run, so it owns a long-lived subscription instead. navigation-tabs.js does not call back into modules.

### Examples

`flashcards.js` `setupFlashcards` binds at init:

```js
function setupFlashcards(deckData) { // module init — runs once, not a render
  // …build the deck…
  containerEl.addEventListener('click', cardActionHandler);
  new IntersectionObserver(refreshDeckIfUserCardsAdded).observe(containerEl);
}
```

To a React-trained reader, this trips the effect-without-cleanup alarm — `addEventListener` plus an `observe()` with no teardown leaks when a component re-renders or remounts. There is no render here: by the rule above the function runs once per page, so there is nothing to tear down. The delegated handler stays safe under churn for the same reason — card actions resolve through that one `containerEl` listener, so `buildCard` adds no per-node handlers and `resetDeck()` cannot accumulate them.

`home.js` is the corollary in practice: it must refresh each time its tab is shown, so it holds one long-lived `IntersectionObserver` on `#home-content` and re-runs `renderMasterQuizProgress` on each display — one observer firing repeatedly, not a new observer per show.

## Skeleton

```js
const SHOW_SKELETON_AFTER_MS = 250;
```

A load that resolves within 250 ms shows no skeleton; a longer one shows the skeleton from 250 ms until the import resolves. A load resolving just after 250 ms flashes the skeleton briefly before removing it. The timer has no minimum on-screen duration — adding one would hold the skeleton past content-ready and make fast loads look slow.
