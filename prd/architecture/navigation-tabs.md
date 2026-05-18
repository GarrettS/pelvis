# Navigation Tabs

`scripts/navigation-tabs.js`:
- reads the URL hash to decide which tab and subtab to activate
- loads that tab's module into its mapped `section` the first time the tab is activated
- tracks each loaded module through its pending → loaded / failed (with retry) lifecycle
- initializes each module exactly once per page life

The tab strip is always on screen — activation changes which `section` shows, not whether tabs exist. A hash names a tab and optionally a subtab and a subview: `#home`, `#patterns/cheat-sheet`, `#diagnose/muscle-map/byMuscle`. Routing acts on the tab and subtab; anything after stays in the hash for the owning module to read (today only `diagnose-muscle-map.js`).

## Routing

Tab and subtab navigation funnels through one function. `applyHash` runs at load and on every `hashchange`, parses the hash, finds a corresponding tab and subtab, and failing a match falls back to their defaults:

```js
const ROUTE_REGEX = /^#(?<tab>[^/]+)(?:\/(?<subtab>[^/]+))?/;

function applyHash() {
  let {tab: tabId = defaultTabId, subtab: subtabId} =
      ROUTE_REGEX.exec(location.hash)?.groups || {};
  if (!byId(tabKey.navLink(tabId))) { tabId = defaultTabId; subtabId = undefined; }
  activateTab(tabId, subtabId);
}
```

`activateTab` removes `aria-current` from the previously active nav tab and adds `hidden` to its section, then sets `aria-current` on the new nav tab and removes `hidden` from its section. When the tab has a subtab row, the same pair of swaps at the subtab level is delegated to `activateSubtab`. CSS handles the UI update. `lazyInit` is then called for the now-active content; loading starts there.

## Module loading

`lazyInit` loads each tab's module the first time its tab is activated and tracks its state through three Sets, keyed by `base` — the same Shared Key `LAZY_INIT` uses to resolve a module path and `tabKey.content` uses to derive the container id:

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

Modules are precached by the service worker at window load, so an `import()` is usually served from cache and resolves almost immediately. `lazyInit` still adds `.loading` to the clicked link and the content container at the start of every load and clears it on resolution; with a warm cache that window is too short to see. A skeleton appears only if the import is still pending 250 ms in (`SHOW_SKELETON_AFTER_MS`), so a load resolving just after that flashes it briefly; there is no minimum on-screen time.

`import()` caches the settled module record by specifier: once a path rejects, every later `import()` of that path returns the same rejection without re-evaluating. So `lazyInit` re-imports a `failed` base with a unique `?r=<timestamp>` query — a new specifier, forcing a real fetch and evaluation:

```js
const path = failed.has(base) ? entry + '?r=' + Date.now() : entry;
failed.delete(base);
```

## Module data loading

A loaded module fetches its own JSON through `loadJson`, which resolves to `{ok: true, data}` or `{ok: false, path, cause}` and never throws. `attemptLoad` runs that loader inside the same lifecycle as a tab load: it adds `.loading` to the container, awaits the result, clears the indicator, and on success renders the data. On failure it shows an error callout whose Retry button re-runs the loader.

```js
export const attemptLoad = ({loader, container, render}) =>
  (async function attempt() {
    container.classList.add('loading');
    const result = await loader();
    container.classList.remove('loading');
    clearErrors(container);
    if (result.ok) return render(result.data);
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

When a module or its data fails to load, its section shows an error callout with a Retry button. The user can retry two ways and both re-attempt the same load: press Retry, or click the tab again. Re-clicking works because of a branch in `handleNavClick`: clicking the already-active tab does not change `location.hash`, so the browser fires no `hashchange` and `applyHash` would never run on its own — `handleNavClick` detects the same-hash click and calls `applyHash()` directly, which re-enters `lazyInit` for the failed base. Spam-clicking needs no guard: `lazyInit` returns early while the base is in `pending`, and CSS makes `.content.loading .callout-retry` non-interactive, so extra clicks during a retry do nothing on their own.

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
