# Navigation Tabs

`scripts/navigation-tabs.js`:
- reads the URL hash to decide which tab and subtab to activate
- loads that tab's module into its mapped `section` the first time the tab is activated
- tracks each loaded module through its pending → loaded / failed (with retry) lifecycle
- initializes each module exactly once per page life

Function `applyHash` calls `activateTab`, which updates the UI and triggers `lazyInit`, which conditionally loads the route's mapped module.
  
## Routing

Function `applyHash` runs at load and on every `hashchange`, parses the hash, finds a corresponding tab and subtab, and, failing a match`, falls back to their defaults:

```js
const ROUTE_REGEX = /^#(?<tab>[^/]+)(?:\/(?<subtab>[^/]+))?/;

function applyHash() {
  let {tab: tabId = defaultTabId, subtab: subtabId} =
      ROUTE_REGEX.exec(location.hash)?.groups || {};
  if (!byId(tabKey.navLink(tabId))) { tabId = defaultTabId; subtabId = undefined; }

  const canonicalHash = '#' + tabId + (subtabId ? '/' + subtabId : '');
  if (location.hash !== canonicalHash) {
    window.history.replaceState(null, '', canonicalHash);
  }
  activateTab(tabId, subtabId);
}
```
`ROUTE_REGEX` captures the tab and subtab. Anything following that is for the respective route's module to read (e.g. submodule `diagnose-muscle-map.js` parses `byMuscle` from the hash with its own regex). 

An invalid tab falls back to `defaultTabId`; `replaceState` rewrites the URL so refresh/bookmark/share do not capture the broken route. `replaceState` fires no `hashchange`, so this does not recurse.

Since `handleNavClick` lets different-hash clicks fall through to native
anchor behavior, route fragments (`#tab` / `#tab/subtab`) must not equal any
element `id`. The `tabKey` naming (`nav-X`, `X-content`, `X-subtabs`,
`X-Y-subtab`, `X-Y-content`) keeps them disjoint. Don't add element ids that
collide with a route fragment.

Deeper segments (e.g. `#diagnose/muscle-map/byMuscle`) flow through native
anchor behavior to `hashchange` and the submodule's own listener (`applySubview`
in `diagnose-muscle-map.js`). `navigation-tabs.js` has no subview click handler.

## Tab activation

Function `activateTab` swaps the active nav tab, content section, and subtab row (Active Object). For subtabbed tabs it delegates entirely to `activateSubtab`, which owns the subtab swap, breadcrumb, and the single `lazyInit` call. For row-less tabs (`home`, `flashcards`, `equivalence`, `masterquiz`) it does the breadcrumb and `lazyInit` itself. Either way, the module loads via exactly one `lazyInit` call per activation.

## Module loading

Function `lazyInit` loads each tab's module the first time its tab is activated and tracks its state through three Sets, keyed by `base` — the same Shared Key `LAZY_INIT` uses to resolve a module path and `tabKey.content` uses to derive the container id:

```js
const initialized = new Set();
const pending = new Set();
const failed = new Set();
```

`pending` holds an import in flight, `initialized` one that resolved, `failed` one that rejected.

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

`importModule` wraps `import()` so it always resolves and never rejects; failure arrives as a value the caller branches on:

```js
const importModule = path => import(path).then(
    ()    => ({ok: true,  path}),
    cause => ({ok: false, path, cause}));
```

Function `startTabLoading` adds `.loading` to the just-activated link and container and schedules the skeleton; `endTabLoading` removes `.loading` and the skeleton when the import resolves. Service-worker precache usually serves the module from cache, so the load is near-instant and that window is too short to see. The skeleton shows only if the import is still pending at 250 ms (`SHOW_SKELETON_AFTER_MS`); a load resolving just after flashes it briefly, with no minimum on-screen time.

`import()` caches the settled module record by specifier: once a path rejects, every later `import()` of that path returns the same rejection without re-evaluating. So `lazyInit` re-imports a `failed` base with a unique `?r=<timestamp>` query — a new specifier, forcing a real fetch and evaluation:

```js
const retryingImport = failed.has(base);
const path = retryingImport ? entry + '?r=' + Date.now() : entry;
if (retryingImport) {
  failed.delete(base);
  clearErrors(container);
}
```

The import-error callout is cleared synchronously on retry before the re-import.
On success there is no further clear; data-load errors are owned by
`attemptLoad`.

## Module data loading

A loaded module fetches its own JSON through `loadJson`, which resolves to `{ok: true, data}` or `{ok: false, path, cause}` and never throws. `attemptLoad` runs that loader inside the same lifecycle as a tab load: it adds `.loading` to the container, awaits the result, clears the indicator, and on success renders the data. On failure it shows an error callout whose Retry button re-runs the loader.

```js
export const attemptLoad = ({loader, container, render}) =>
  (async function attempt() {
    container.classList.add('loading');
    const result = await loader();
    container.classList.remove('loading');

    if (result.ok) {
      clearErrors(container);
      return render(result.data);
    }
    handleFetchError(result, {
      render: (message, retry) => renderError(container, message, retry),
      onRetry: attempt
    });
  })();
```

A module-import failure and a data-fetch failure therefore reach the user the same way — a callout with Retry in the tab's container — diagnosed by `handleImportError` and `handleFetchError` respectively.

## Module data sharing

Modules can share data. For example: `home.js` and `masterquiz.js` both import `master-quiz-progress.js`, a DOM-free read/write module that owns the `masterQuiz_progress` and `masterQuiz_total` localStorage keys. `masterquiz.js` writes through it as the user answers; `home.js` reads `getSummary` to show progress.

A consumer statically imports the owner; if the owner fails to load, the consumer's body never runs — no half-wired tab.

## Retry

When a module or its data fails to load, its section shows an error callout with a Retry button. The user can retry two ways, both terminating in a direct `lazyInit(base, link)` call; neither routes through `applyHash`:

- **Press Retry** in the error callout → `onRetry: () => lazyInit(base, link)`.
- **Click the active tab/subtab again** → `handleNavClick` detects `link.hash === location.hash`, calls `retryActiveLoad(link)`, which decodes `base` from the link's hash and calls `lazyInit(base, link)` only if `failed.has(base)`. Re-clicking a working tab is a literal no-op.

Spam-clicking needs no extra guard: `lazyInit` returns early while `base` is in `pending`, and CSS makes `.content.loading .callout-retry` non-interactive, so extra clicks during a retry do nothing on their own.

Whoever requests a load handles its failure — only the requester knows what a retry means.

- **navigation-tabs requests the module** with `import()`. Its retry is to re-import, handed to `load.js`:

```js
handleImportError(result, {
  render: (message, retry) => renderError(container, message, retry),
  onRetry: () => lazyInit(base, link)
});
```

- **A module requests its data** with `loadJson`, through `attemptLoad` (`error-ui.js`). Its retry is to re-run the loader:

```js
handleFetchError(result, {
  render: (message, retry) => renderError(container, message, retry),
  onRetry: attempt
});
```

Both pass `load.js` two callbacks — `render` (how to show it) and `onRetry` (how to redo the request). `load.js` turns `result.cause` into a readable message and calls them; it touches no DOM and never learns who called it. `render` is always `renderError` in `error-ui.js`, the single app-specific place the callout and Retry button exist — `load.js` never imports it; the requester wires the two together.

Failure flow — both paths converge on `renderError`:

```
navigation-tabs · import()  ─┐
                             ├─▶ load.js   cause → message · DOM-free · IoC
module · loadJson           ─┘       │      requester injects render + onRetry
                                     ▼
                               renderError   error-ui.js · the one callout + Retry
```

The two paths above are module import (`lazyInit`) and `attemptLoad`-based data loads. A module that calls `loadJson` directly owns its own failure UI — equivalence does, with its own callout and retry; see `equivalence-quiz.md`.

## Re-activation and self-driven redraw

`lazyInit` maps each tab's `base` 1:1 to a section element (`tabKey.content(base)`) and a module path (`LAZY_INIT[base]`); `base` is the Shared Key. It imports and initializes that module exactly once per page life and never calls back into it: when a loaded or still-loading tab is re-activated, `lazyInit` returns early on `initialized`/`pending`.

Modules that need a live update each time they're shown handle that with an `IntersectionObserver` wired once at init — `home.js` keeps one on `#home-content` and re-runs `renderMasterQuizProgress` on each show.

navigation-tabs deliberately does not fire a custom "shown" event for modules to subscribe to. That would make navigation-tabs responsible for firing at the right moment on every path that reveals a section — subtab switch, deep link, back/forward, default-tab fallback — and one missed path leaves the module silently stale.

Besides, that would be extra code. Because modules can listen to IntersectionObserver which the platform provides for FREE, natively, and which fires when they are shown.
