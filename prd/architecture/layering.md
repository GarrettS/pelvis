# Layering Architecture

Target architecture for tabs and features in this codebase. Splits a tab into a small set of named pieces with clear contracts between them. The per-tab HLA artifacts describe how a particular tab maps to this architecture.

References:
- `prd/architecture/navigation-tabs.md` — the orchestrator contract every lazy-loaded module follows. Canonical for the POJO data-load contract and the skeleton/error-rendering lifecycle.
- `prd/architecture/patterns.md` — per-tab HLA for Patterns (dissolved tab; subtabs are direct LAZY_INIT entries).
- `prd/architecture/diagnose-data-boundary-migration.md` — per-tab HLA for Diagnose (dissolving; same shape as Patterns).
- `prd/architecture/aic-chain.txt` — per-tab HLA for the L AIC Chain tab.

## What the pieces are

A tab is composed of:

- **Per-feature module** — the integration site for one feature. Owns its container's listeners, its module-scope state, its data load, and its render. Self-running: module-top side effects do the work on import. Registered as a `LAZY_INIT` entry in `navigation-tabs.js`, keyed by the feature's container id.
- **ADT class(es)** — where a feature has per-entity state worth encapsulating. Each class is page-independent: pure entity behavior, no app-level error rendering, no DOM lookups by absolute selector. Many-instance ADTs use a Factory pool.
- **Data files** — JSON, one per feature.
- **Shared loader** `scripts/load-json.js` — exports `loadJson(path)` which returns a POJO `{ok, data, path, cause}`. No higher-level helper; modules use `loadJson` directly and gate render on `result.ok`.
- **App error helpers** `scripts/load-errors.js` — exports `showFetchError(container, result)` and `showImportError(container, pathSpec, error)`. Called by per-feature modules on `!result.ok`.

There is no tab-implementation orchestrator. Both tabs that previously had one (Patterns, Diagnose) dissolved it. Subtab activation goes directly from `navigation-tabs.js` LAZY_INIT to per-feature module.

## Per-feature module

The integration site for one feature. Self-contained: someone reading this one file knows everything about how the feature works.

### Module-top shape

```js
import {loadJson} from './load-json.js';
import {showFetchError} from './load-errors.js';

const container = document.getElementById('feature-container');

container.addEventListener('click', (event) => {
  const target = event.target.closest('.actionable-class');
  if (!target) return;
  FeatureFactory.getInstance(target).handleClick();
});

const result = await loadJson('./data/feature.json');
if (result.ok) {
  renderFeature(container, result.data);
} else {
  showFetchError(container, result);
}

function renderFeature(container, data) { /* paint */ }
```

`loadJson` returns a POJO and does not throw on data failure. The `result.ok` branch decides render vs `showFetchError`.

Render bugs propagate as ordinary errors past the `result.ok` branch — they reject the module's top-level await, which rejects the import, which `navigation-tabs.js` renders via `showImportError`. The POJO contract keeps fetch failures and programming bugs in distinct paths without typed-error machinery.

### Listener pattern

```js
container.addEventListener('click', (event) => {
  const target = event.target.closest('.actionable-class');
  if (!target) return;
  const instance = FeatureFactory.getInstance(target);
  instance.handleClick();
});
```

The handler resolves the target's id via `closest`, looks up or creates the entity via the Factory's keyed cache, and dispatches a behavior method on the instance. Listeners fire repeatedly; the Factory cache makes `getInstance(id)` cheap.

For features without identity-keyed entities (a singleton concept map, a stateless cheat sheet, a single quiz), there is no Factory — the listener acts on module-scope state or a singleton instance directly.

### Two-instance features

A few features render twice with the same shape and different data (HALT and Squat level quizzes share a shape). The per-feature module defines a class for the shape, constructs two named instances eagerly at module top via direct `new`, binds each instance's listener in its own constructor, and calls each instance's `load(path)`.

```js
import {loadJson} from './load-json.js';
import {showFetchError} from './load-errors.js';

class LevelQuiz {
  #idx = 0;
  #data;

  constructor(container) {
    this.container = container;
    container.addEventListener('click', (event) => this.#handleClick(event));
  }

  async load(path) {
    const result = await loadJson(path);
    if (result.ok) {
      this.#data = result.data;
      this.#render();
    }
    return result;
  }

  #render() { /* paint */ }
  #handleClick(event) { /* … */ }
}

const halt  = new LevelQuiz(document.getElementById('halt-wrap'));
const squat = new LevelQuiz(document.getElementById('squat-wrap'));

const [haltResult, squatResult] = await Promise.all([
  halt.load('./data/halt-levels.json'),
  squat.load('./data/squat-levels.json'),
]);

if (!haltResult.ok)  showFetchError(halt.container,  haltResult);
if (!squatResult.ok) showFetchError(squat.container, squatResult);
```

Direct `new` per instance, not a Factory pool. The class itself is page-independent — `load` returns the POJO result; the module-top glue decides what to do with failures. ADT classes don't call `showFetchError`.

### Pre-data controls

If interactive controls exist in source HTML before data loads (quiz answer buttons, reveal/next buttons, hash-driven views), a pre-data click on these passes `closest()` and reaches the handler — which would try to act on undefined state.

Three valid mitigations:
- The control is `disabled` (or hidden) until first render completes.
- The handler guards on data-ready (`if (!this.#data) return;`).
- The listener bind is deferred to inside the `result.ok` branch (use this for `hashchange` and similar — they can't reasonably guard or disable). After binding, run once to honor any current state.

The `closest()` early-return safety only protects controls that don't exist in source HTML (generated controls). Source-rendered controls need explicit guards or deferred binding.

### Anti-shapes

- **Tab-implementation orchestrator** — a `fooTab.js` that imports each feature's `mount(container, dataPath)` and calls them in a loop. Couples features through one import, fans out all data fetches on tab activation regardless of which subtab is shown, emits one tab-level skeleton instead of per-subtab. Patterns and Diagnose both dissolved this shape; each subtab is a direct LAZY_INIT entry instead.
- **`mount(container, dataPath)` export** — the contract the orchestrator called. Without an orchestrator, the export has no caller. Self-running module-top side effects replace it.
- **Parameterless `setupX()` wrapper.** A function that just calls `loadJson` with hardcoded selectors and renders, when module-top could do the same. The wrapper adds an indirection hop with no logic of its own.
- **Listener bind inside a function called from outside the module.** Re-entry accumulates listeners. Module-top bind (or constructor-time bind on a single-instance class) is the standard answer.
- **Per-element listeners.** They accumulate on render, don't survive `innerHTML` replacement, multiply object count. Delegate on the container.
- **`init()` export to satisfy navigation-tabs.** The navigation-tabs contract no longer requires it. Module-top side effects on import are the readiness signal.
- **Dynamic imports inside a feature module.** Dynamic import is `navigation-tabs.js`'s responsibility; feature modules own data, listeners, and render only. A second lazy-loading layer inside a feature duplicates navigation-tabs and creates conflicting error semantics.

## Per-entity classes (ADT pattern)

When a feature has identity-keyed entities — many causal chains in one section, many case studies in one section — each entity is a class. Instances are constructed lazily via a Factory keyed by id.

### Factory shape

```js
class FeatureFactory {
  static #instances = new Map();
  static #KEY = Symbol();

  static getInstance(elOrId) {
    const id = typeof elOrId === 'string' ? elOrId : elOrId.id;
    let instance = FeatureFactory.#instances.get(id);
    if (!instance) {
      instance = new Feature(id, FeatureFactory.#KEY);
      FeatureFactory.#instances.set(id, instance);
    }
    return instance;
  }
}
```

- Pool: `static #instances = new Map()`. `Map`'s `.get`/`.set`/`.delete`/`.clear` read cleanly and avoid prototype-chain gotchas of plain object literals.
- Construction guard: `#KEY` Symbol checked in the class constructor prevents external code from instantiating directly. Only the Factory can.
- Lookup: `getInstance(elOrId)` accepts an element (reads `.id`) or a string id, returns the cached instance or creates one. Listeners call this on every event; the cache makes it O(1).

### Class shape

- Private fields (`#id`, `#state`, `#refs`) for state and DOM refs.
- Public `id` getter for identity. Behavior methods mutate state and the DOM subtree the entity owns — never elements outside its subtree.
- Constructor takes `(id, key)` and any per-entity definition. It validates the key matches the Factory's `#KEY`.

### When to use a Factory pool

Factory pool is the right shape only for **many-instance features keyed by data IDs** — `CausalChain` instances keyed by chain id, `CaseStudy` instances keyed by case id. The pool gives O(1) lazy lookup as delegated events fire on different keyed elements.

For other cases, use direct construction:
- **Singleton** (one instance per page): direct `new`. The Factory's keyed lookup is machinery for nothing.
- **Fixed-count instances** (two-instance features like halt + squat): direct `new` per instance.
- **No per-entity state**: no class needed at all; module-scope state is enough.

The Factory's value is keyed lookup at event-dispatch time. Without that need, the Factory adds machinery that doesn't earn its keep.

## Data files

JSON, one file per feature. Naming follows the consuming feature module (`scripts/diagnose-causal-chains.js` consumes `data/diagnose-causal-chains.json`).

Required:

- **Cohesive.** One domain concept per file.
- **Structural.** Data, not behavior.
- **ID-as-key.** When a record collection is keyed by id, the file is a keyed object (`{ "foo": {...}, "bar": {...} }`), not an array of objects carrying an `id` field. (See *Misplaced Key* below.)
- **No dead fields.** Properties no consumer reads are removed.

## The shared loader

```js
export async function loadJson(path) {
  let resp;
  try {
    resp = await fetch(path);
  } catch (cause) {
    return { ok: false, path, cause };
  }
  if (!resp.ok) return { ok: false, path, cause: resp };
  try {
    return { ok: true, data: await resp.json() };
  } catch (cause) {
    return { ok: false, path, cause };
  }
}
```

`loadJson` returns a POJO. On success: `{ok: true, data}`. On failure: `{ok: false, path, cause}` where `cause` is the underlying `fetch` exception, the non-OK `Response`, or the `SyntaxError` from parse — depending on which step failed.

Callers check `result.ok` and branch. There is no thrown error, no `instanceof` check, no typed error class.

### Why POJO instead of typed errors

- The branch is the same conceptual operation at every call site: "did the load succeed?" `if (result.ok)` is the most direct way to ask. An `instanceof FetchFailure` check would be noise.
- Throwing reserves the throw channel for unexpected failures (programming bugs). Data-load failures are expected. Mixing them through the same channel forces every caller to filter.

### Why no `loadInto` helper

A helper of the shape `loadJson(path).then(render).catch(showFetchError)` would catch render bugs in the same `.catch` as fetch errors, misclassifying programming bugs as fetch failures. The POJO branch keeps render outside the failure path: `if (result.ok) render(...); else showError(...)`. Render bugs propagate as ordinary rejections past the branch.

### Why no JS-level cache

Each per-feature module's load runs once per page load (modules evaluate once per realm by ES module caching). Across page loads, the service worker handles HTTP-layer caching. Failure-rollback retry semantics that a JS-level cache would add are automatic when there is no cache to clear.

## Cross-cutting contracts

### Shared Key

A single string identifies a domain entity across DOM, data, and Factory pool.

- DOM: `<ol class="chain-list" id="diaphragm-to-adt">` — element id.
- Data: `{ "diaphragm-to-adt": {...} }` — JSON key.
- Factory pool: `instances.get('diaphragm-to-adt')` — Map key.

The same string crosses all three layers without translation. Listeners extract the id from the event target (`target.closest('.chain-list').id`) and use it directly as the lookup key.

The same principle scales up to subtab identity: `#diagnose/case-studies` (route) → `diagnose-case-studies-content` (container id) → `./diagnose-case-studies.js` (module path) all share a token. `navigation-tabs.js` keys LAZY_INIT by container id — route, container, and module path align through one Shared Key per subtab.

Naming is load-bearing; treat the id as a domain-language token, not an opaque slug.

### Delegated listener

One listener per event type per feature container, dispatching to actionable elements via `event.target.closest('.actionable-class')`. Bound at module top (or in a single-instance class's constructor); ES module caching makes the bind structurally exactly-once.

Per-element listeners are an anti-pattern: they accumulate on render, don't survive `innerHTML` replacement, multiply object count. Delegation scales: one listener handles current and future descendants.

### Data-load gate

Listeners are bound at module top before data has loaded. For **generated controls** (those that don't exist in source HTML), they are harmless before render: `closest('.actionable-class')` returns null, handler returns early. Once render paints content, clicks dispatch through the same already-bound listener.

For **source-rendered controls** (those present in the HTML before data loads — e.g., static quiz answer buttons, hash-driven views), `closest()` finds them and the handler runs. Pre-data clicks would act on undefined state. Mitigations: the control is `disabled` (or hidden) until render completes; the handler guards explicitly on data-ready; or the listener bind is deferred to inside the `result.ok` branch.

### Error-handling boundary

Per-feature modules call `showFetchError(container, result)` directly on `!result.ok`. There is no implementation-layer-vs-feature-layer split because there is no implementation layer above the feature — each feature is its own LAZY_INIT entry, and the per-feature module is the implementation layer for its own subtab.

ADT classes do not call `showFetchError`. An ADT's `load(path)` method returns the POJO result; the module-top glue decides how to render data errors. This keeps the ADT page-independent (no knowledge of how this app renders errors).

## Anti-patterns

Names kept consistent for grep-ability.

- **Junk-drawer module** — one file holding multiple distinct domain features. Split per feature.
- **Junk-drawer JSON** — one data file holding multiple unrelated domains. Split per feature.
- **Helper-as-category** — using "helper" or "utility" as the architectural classification. Hides what the code IS. Classify by what it does (per-feature module, ADT class, data file, loader, app error helper, cross-cutting utility).
- **Multi-key vendor loader** — one loader exposing N accessors over one shared fetch. Creates a dependency hub. Use per-feature `loadJson` calls instead.
- **Module-scope cross-feature cache** — caching data across features when the data is not actually shared. Adds coupling without benefit.
- **Middleman accessor** — `async () => (await load()).slice`. Adds a function call and a file boundary without encapsulating logic. Call `loadJson` directly.
- **Misplaced Key** — array of records carrying id field, accessed by id. Use a keyed object; drop the id field.
- **Dead-defensive fallback** — `node.question || node.id` where every record has `.question`. Defends against a case that never happens. Trust the data.
- **Parameterless `setupX()` wrapper** — a function that hides `loadJson` behind a parameterless call with hardcoded selectors. Module-top can do the same work directly.
- **Tab-implementation orchestrator** — a `fooTab.js` importing per-feature `mount(...)` exports. Couples features and forces up-front loading of all subtabs. Each subtab is its own LAZY_INIT entry instead.
- **ADT calling `showFetchError` directly** — couples the ADT to the app's error-rendering machinery. The ADT's `load` returns the POJO result; module-top glue calls `showFetchError`.
- **`loadInto`-style render-inside-catch helper** — `.then(render).catch(showFetchError)` catches render bugs as if they were fetch errors. Use `loadJson` with the `if (result.ok)` branch and render in the success arm.
- **`init()` export to satisfy navigation-tabs** — the navigation-tabs contract no longer requires it. Module-top side effects on import are the readiness signal.
- **Dynamic imports inside a feature module** — duplicates `navigation-tabs.js`'s lazy-loading responsibility and creates a second error-handling surface. Static imports only.
- **Listening for tab-activation events** — feature modules should not depend on synthetic activation events. For features that need redraw on visibility/dimension change, observe the container with `ResizeObserver`.

## Examples

### CausalChain class + Factory + self-running module

`scripts/diagnose-causal-chains.js` defines a `CausalChain` class and a `CausalChainFactory`. The class holds `#id`, `#steps`, `#order`, drag state. It exposes behavior methods (`startDrag`, `dragMove`, `commitDrop`, `endDrag`, `isOrderCorrect`, `orderResults`). It mutates DOM only on its own `<ol>` and its `<li>` children. The constructor is Symbol-guarded.

The Factory holds `static #instances = new Map()`. Module-top side effects find the container by id (`diagnose-causal-chains-content`), bind the delegated click listener (lookup via `getInstance`), and await `loadJson('./data/diagnose-causal-chains.json')`. On `result.ok`, render the chains; on failure, call `showFetchError(container, result)`. First click on a given chain creates the instance via `getInstance`; subsequent clicks retrieve from the pool.

The module is registered in `navigation-tabs.js` under `'diagnose-causal-chains-content': './diagnose-causal-chains.js'`. No `diagnose.js` orchestrator above it.

### Patterns subtabs as direct LAZY_INIT entries

Patterns subtabs (cheatsheet, conceptmap, tests) are independent. No `patterns.js` exists. Each subtab file is its own LAZY_INIT entry in `navigation-tabs.js`; module-top side effects do the work on import. Each file is its own implementation layer (loads data, branches on `result.ok`, renders or calls `showFetchError`).
