# Navigation Tabs

[Source: `navigation-tabs.js`](../../scripts/navigation-tabs.js)

The core file that handles routing, app initialization, and global app behavior and configuration.

`scripts/navigation-tabs.js`:
- **Routing and lazy module loading:**
  - reads the URL hash to decide which tab and subtab to activate
  - loads that tab's module into its `section` the first time the tab is activated
  - tracks each loaded module through its pending → loaded / failed (with retry) lifecycle
  - imports each module at most once per page life — the import is the module's initialization; there is no `init()` export
- **App initialization and configuration:**
  - flips the preloaded stylesheets to active
  - registers the service worker
  - sets the scrollport below the sticky nav (scroll-padding-top)
  - fades the nav tab edge when it overflows horizontally (horizontal scroll for mobile)
## Navigation and Routing
`initNavigationTabs` runs once when the app loads. It registers a delegated click handler on `<nav>` and a `hashchange` handler, `routeChangeHandler`, then runs `routeChangeHandler` and `initScrollAffordance` once for the initial route. Function `routeChangeHandler` runs `applyHash` to route, then `updateScrollInset` to re-measure the sticky nav, whose height changes with the route.

```js
(function initNavigationTabs() {
  document.querySelector('nav').addEventListener('click', handleNavClick);
  window.addEventListener('hashchange', routeChangeHandler);
  routeChangeHandler();
  initScrollAffordance();
})();

function routeChangeHandler() {
  applyHash();
  updateScrollInset();
}
```
This handles routing in two cases: 1. Initial page load, and 2. hashchange navigation. 
The named `initNavigationTabs` IIFE invoked at the bottom of the file wires `routeChangeHandler` to the hashchange listener and then invokes it to handle the initial page load.

The `routeChangeHandler` callback calls `applyHash`, which kicks off routing the path in the requested location's fragment identifier (e.g. `#diagnose/muscle-map`) to a js module, and can also call other functions it may need during hash navigation (`updateScrollInset`, explained below).
## Routing
Function `applyHash` derives the requested route from `location.hash`, then calls `activateTab`, which calls `lazyInit` to conditionally load the route's module.

```js
const ROUTE_REGEX = /^#(?<tab>[^/]+)(?:\/(?<subtab>[^/]+))?/;

function applyHash() {
  let {tab: tabId = defaultTabId, subtab: subtabId} =
      ROUTE_REGEX.exec(location.hash)?.groups || {};
  const tabValid = byId(tabKey.navLink(tabId));
  if (!tabValid) {
    tabId = defaultTabId;
    subtabId = undefined;
  }
  if (!tabValid || !location.hash) {
    window.history.replaceState(null, '',
      '#' + tabId + (subtabId ? '/' + subtabId : ''));
  }
  activateTab(tabId, subtabId);
}
```

`ROUTE_REGEX` captures the tab and subtab; anything after is for the route's module to read (e.g. `diagnose-muscle-map.js` parses `byMuscle` with its own regex).

A broken hash must not stick, but a working one must not be touched. For that, `history.replaceState` fires in two cases: 1. an unknown tab (fall back to `defaultTabId`), and 2. an empty hash (maps to the default route).

Valid partial hash with deeper hash paths, like `#diagnose/muscle-map/byMuscle`, are applied and left intact so the respective submodule can read the remaining fragment (`"byMuscle"). 

Navigation needs no click handler. The links are anchors (`href="#anatomy/decoder"`), so activating them changes `location.hash`, which fires `hashchange` → `applyHash`.

### Re-Clicking the Active Tab
When the user re-clicks the **already-active** tab, its hash equals `location.hash`, so the click changes nothing, fires no `hashchange`, and `applyHash` never runs. That's correct when the tab is healthy — but if its module *failed* to load, re-clicks retry, and there's no native event to hang that on. (See: [[#Module Load Failure and Retry]])

This is handled in `handleNavClick`, a delegated click handler on `<nav>`:
```js
function handleNavClick(e) {
  const link = e.target.closest('.nav-tab, .subtab');
  if (!link?.hash || link.hash !== location.hash) return;
  e.preventDefault();
  retryActiveLoad(link);
}
```

Any hash navigation that differs from the current one is applied immediately (`hashchange` → `applyHash`). 

Because navigation resolves as anchor targets, route fragments (`#tab` / `#tab/subtab`) must not equal any element `id`. The `tabKey` naming (`nav-X`, `X-content`, `X-subtabs`, `X-Y-subtab`, `X-Y-content`) keeps them disjoint. Don't add element ids that collide with a route fragment.

Deeper segments (e.g. `#diagnose/muscle-map/byMuscle`) flow through native
anchor behavior to `hashchange` and the submodule's own listener (`applySubview`
in `diagnose-muscle-map.js`). `navigation-tabs.js` has no subview click handler.

## Tab Activation
Function `activateTab` swaps the active nav tab, top-level content section, and subtab row (Active Object). For subtabbed tabs it delegates entirely to `activateSubtab`, which owns the subtab swap, breadcrumb, and the single `lazyInit` call. For row-less tabs (`home`, `flashcards`, `equivalence`, `masterquiz`) it does the breadcrumb and `lazyInit` itself. Either way, the module loads via exactly one `lazyInit` call per activation.

The Active Object design is intentional: `activeNavTab`, `activeSection`, and `activeSubtabRow` each hold the currently active element or null. `activeSubtabRow` is null before the first route and on row-less tabs (home, flashcards, equivalence, masterquiz). Navigation deactivates and activates those known elements directly; it never resets state by scanning the whole nav or content tree.

`activeSubtabLink` and `activeSubtabContent` are objects keyed by tab id. On a tab's first activation the entry is `undefined`, so `??=` initializes it to the subtab the row already marks `aria-current`; later activations swap it to the chosen subtab:

```js
activeSubtabLink[tabId] ??= row.querySelector('.subtab[aria-current]');
activeSubtabLink[tabId] = swapAriaCurrent(activeSubtabLink[tabId], link);
```

Per-tab entries track each tab family's active subtab and active subtab content, so reopening a tab restores whichever subtab it last showed without querying every sibling or clearing every panel.

`applyHash` validates only the top tab; `activateSubtab` resolves the subtab by precedence — the requested subtab if its id exists, else the tab's retained subtab, else the row's first. So an unknown subtab segment still resolves to a valid subtab, with no rewrite.

## Module Loading
Function `lazyInit` loads each tab's module the first time its tab is activated and tracks its state through three Sets, keyed by `base` — the same Shared Key `LAZY_INIT` uses to resolve the module path. `tabKey.content(base)` derives the section id from `base`, so a row-less tab's module renders into its `section.content` and a subtab's into its `section.subtab-content`.

Module import and load happen once on the first successful load of that module.
```js
const initialized = new Set(); // resolved
const pending = new Set(); // in-flight import
const failed = new Set(); // rejected import
```

There is no `init()` export to call — importing *is* initialization. Each data-backed module opens with a top-level `await attemptLoad(...)` (see `nomenclature-joints.js`), so its import stays pending until that first render or failure settles. One `pending` flag therefore spans both "fetching the module" and "the module fetching its data," and a `base` reaches `initialized` only once the tab has rendered or shown its error callout.

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

Function `importModule` wraps `import()` so it always resolves and never rejects; failure arrives as a value the caller branches on:

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

## Module Data Loading
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

## Module Data Sharing
Modules can share data. For example: `home.js` and `masterquiz.js` both import `master-quiz-progress.js`, a DOM-free read/write module that owns the `masterQuiz_progress` and `masterQuiz_total` localStorage keys. `masterquiz.js` writes through it as the user answers; `home.js` reads `getSummary` to show progress.

A consumer statically imports the owner; if the owner fails to load, the consumer's body never runs — no half-wired tab.

## Module Load Failure and Retry
When a module or its data fails to load, its container shows the same kind of error callout with a Retry button which re-runs whatever failed to load.

Module imports are done by navigation-tabs, so if an import failed, the stack trace will point to navigation-tabs. For it, the retry is to re-import the module via `lazyInit`.

Data fetching is done by modules, via `loadJson` through `attemptLoad`. The stack trace and user-displayed error message will indicate that, and the retry is to re-run that loader.

A module-import failure can be retried two ways, both terminating in a direct `lazyInit(base, link)` call; neither routes through `applyHash`:

- **Press Retry** in the error callout → `onRetry: () => lazyInit(base, link)`.
- **Click the active tab/subtab again** → `handleNavClick` detects `link.hash === location.hash`, calls `retryActiveLoad(link)`, which decodes `base` from the link's hash and calls `lazyInit(base, link)` only if `failed.has(base)`. Re-clicking a working tab is a literal no-op.

Spam-clicking module-import retry needs no extra guard: `lazyInit` returns early while `base` is in `pending`, so extra clicks during a retry do nothing on their own.

Data-load failure is different: once a module import resolves, `base` is `initialized`, so an active tab re-click does not retry the data request. The callout's Retry button re-runs the module's loader through `attemptLoad`.

Whoever requests a load handles its failure; only the requester knows what a retry means.

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

## Reactivation and Self-driven Redraw
`lazyInit` maps each tab's `base` 1:1 to a container element (`tabKey.content(base)`) and a module path (`LAZY_INIT[base]`); `base` is the Shared Key. It imports that module exactly once per page life and never calls back into it: when a loaded or still-loading tab is re-activated, `lazyInit` returns early on `initialized`/`pending`.

Modules that need a live update each time they're shown handle that with an `IntersectionObserver` wired once at init — `home.js` keeps one on `#home-content` and re-runs `renderMasterQuizProgress` on each show.

navigation-tabs deliberately does not fire a custom "shown" event for modules to subscribe to. That would make navigation-tabs responsible for firing at the right moment on every path that reveals a section — subtab switch, deep link, back/forward, default-tab fallback — and one missed path leaves the module silently stale.

Custom events would be extra code, and modules can listen to `IntersectionObserver` which fires when they are shown.

## Service Worker Caching
`navigation-tabs.js` registers `sw.js`. A reload re-requests the shell (the hash never reaches the network). The router then lazy-imports the current route's script as a second request (see [[#Routing]] and [[#Module Loading]]). Both must come from one build, or one build's code runs against another build's DOM. The handler serves navigation and sub-resources by one strategy, stale-while-revalidate:

```
rejected — network-first navigation
[reload]
  ├──▶ shell         network-first ──▶ server ──▶ build B
  └──▶ route script  SWR           ──▶ cache  ──▶ build A
       B's DOM runs A's code

chosen — uniform SWR
[reload]
  ├──▶ shell         SWR           ──▶ cache  ──▶ build A
  └──▶ route script  SWR           ──▶ cache  ──▶ build A
       one build
```

```js
self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;   // only GET responses are cacheable

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);

    // Fetch fresh; replace the cached copy on a good response (cloned before its
    // body is read). A 404/500 is left uncached so a transient error can't evict
    // a working copy.
    const refresh = fetch(request).then(async response => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    });
    // Outlive respondWith so the background refresh finishes and updates the cache.
    event.waitUntil(refresh.catch(() => { /* offline: the cached copy was already served */ }));

    return cached || refresh;
  })());
});
```

## Sticky-nav Scroll Offset
The sticky nav overlays the top of the document, the default window scrollport, so an anchor jump or `scrollIntoView` aligns its target to that top edge — under the nav, where it's hidden. `updateScrollInset` reserves the nav's current height as `scroll-padding-top`. That height isn't fixed — the subtab row makes the nav taller on subtabbed routes — so `routeChangeHandler` re-measures every route, calling `updateScrollInset` after `applyHash` has shown the row. A single measure on a top-level route with no submenu (e.g. Home) would be too short elsewhere.
## Tab-overflow Affordance
On narrow viewports the nav-tab strip scrolls sideways. `initScrollAffordance` toggles `scrolled-end` on `#nav-tabs` so the edge-fade — the cue that more tabs are offscreen — clears once the strip is scrolled to its end.