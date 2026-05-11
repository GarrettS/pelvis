# Patterns Tab HLA

The Patterns tab has three subtabs. Each subtab is independent — different data, different DOM, no shared state across subtabs. There is no `patterns.js` orchestrator: each subtab's file is a direct LAZY_INIT entry in `scripts/navigation-tabs.js`.

The Patterns HTML already contains the subtab panels, headings, quiz buttons, table, and SVG shell. JSON fills the dynamic content inside those elements.

References:
- `prd/architecture/layering.md` — module shape, ADT classes, anti-patterns.
- `prd/architecture/navigation-tabs.md` — module contract (import resolution = readiness, no init export, skeleton ownership, ResizeObserver for layout-sensitive redraw).

## Diagram

```text
navigation-tabs.js LAZY_INIT
  patterns-cheat-sheet-content   -> patterns-cheat-sheet.js
  patterns-concept-map-content   -> patterns-concept-map.js, patterns-symptom-quiz.js
  patterns-level-quiz-content    -> patterns-level-quiz.js
                                     |
                                     v
                                   LevelQuiz ADT (two instances: halt, squat)
```

No tab-level module. Each subtab file is the implementation layer for that subtab: thin glue at module top that finds container elements and instantiates ADTs (where applicable) or loads + renders directly (where no ADT is warranted).

## Shared Key across route, container id, and module path

Each subtab's route segment, container id, and module path share one token. The mapping is:

```text
#patterns/cheat-sheet  -> #patterns-cheat-sheet-content  -> scripts/patterns-cheat-sheet.js
#patterns/concept-map  -> #patterns-concept-map-content  -> scripts/patterns-concept-map.js
                                                          + scripts/patterns-symptom-quiz.js
#patterns/level-quiz   -> #patterns-level-quiz-content   -> scripts/patterns-level-quiz.js
```

`navigation-tabs.js` derives `contentId = tab + '-' + subtab + '-content'` from the URL hash, so the route segment and the container id are mechanically linked.

## Target files

```text
scripts/patterns-cheat-sheet.js    loads data/cheat-data.json, fills the cheat-sheet grid
scripts/patterns-concept-map.js    loads data/concept-map.json, fills the concept-map SVG
scripts/patterns-symptom-quiz.js   thin glue + SymptomQuiz ADT (singleton)
scripts/patterns-level-quiz.js     thin glue + LevelQuiz ADT (two instances)
scripts/load-json.js               shared loadJson(path) — see layering.md
```

`scripts/patterns.js` is deleted.

ADT classes (`SymptomQuiz`, `LevelQuiz`) are co-located with their thin glue inside the per-subtab files. Glue is two or three lines per ADT instance; co-location keeps the file readable as one unit. The ADT itself is page-independent (parameterized by container element); only the module-top glue knows the container ID for this page.

## LAZY_INIT entry shape

`navigation-tabs.js` supports a list of paths per content id. The concept-map subtab needs two files; LAZY_INIT lists both:

```js
'patterns-cheat-sheet-content': './patterns-cheat-sheet.js',
'patterns-concept-map-content': [
  './patterns-concept-map.js',
  './patterns-symptom-quiz.js'
],
'patterns-level-quiz-content': './patterns-level-quiz.js',
```

Single string or array — the orchestrator handles both.

Multi-path failure: a programming bug or import failure in any one path rejects the content-id import; data failures render locally inside their own feature. Per-path retry semantics are not added.

## Module shape

Each subtab file is the implementation layer for its subtab. The shape:

- ADT classes (where present) own their data load, render, listener bind, and behavior. Parameterized by a container element they don't choose. Page-independent: no app-level error rendering inside the class.
- Module top is thin glue: find container, construct ADT, call its `load(path)`, branch on the returned POJO and call `showFetchError` on failure. For features without an ADT, module top loads data and renders directly using the same shape.

Data-loading shape (used both inside ADT `load(path)` methods and in non-ADT modules):

```js
import {loadJson} from './load-json.js';
import {showFetchError} from './load-errors.js';

// inside ADT.load(path):
async load(path) {
  const result = await loadJson(path);
  if (result.ok) {
    this.#data = result.data;
    this.#render();           // render bugs propagate as ordinary errors
  }
  return result;
}
```

```js
// at module top, the glue branches on the POJO result:
const symptomQuiz = new SymptomQuiz(document.getElementById('symptom-quiz-wrap'));
const result = await symptomQuiz.load('./data/symptom-patterns.json');
if (!result.ok) showFetchError(symptomQuiz.container, result);
```

`loadJson` returns a POJO `{ok, data, path, cause}` and does not throw on data failure. ADT classes call `loadJson`, render on `result.ok`, and return the POJO. The module-top glue branches on `result.ok` and calls `showFetchError(container, result)` on failure. Render bugs propagate as ordinary errors past the `result.ok` branch and surface via navigation-tabs's `showImportError`.

This keeps the ADT class free of app-level UI knowledge: it doesn't know how to render error messages, only that data load can fail. The implementation layer (the per-subtab file) decides how the app communicates errors.

## Pre-data controls

Some Patterns controls exist in source HTML before data loads (symptom quiz answer buttons, level quiz reveal/next buttons). A pre-data click on these passes `closest()` and reaches the handler, which would try to act on undefined state.

The contract: source-rendered interactive controls are either `disabled` (or hidden) until render completes, or their handlers guard explicitly on data-ready. The `closest()` early-return pattern only protects controls that don't exist in source HTML (generated controls).

Each ADT decides between `disabled` toggle and explicit guard based on what reads cleanest. Both are valid; the rule is just "no pre-data click acts on undefined state."

## `patterns-cheat-sheet.js`

Container: `#patterns-cheat-sheet-content`. Touches `#cheat-sheet-grid` and `#cheat-legend-labels`.

Module-top loads `data/cheat-data.json`. `renderCheatSheet(cheatData)` clears `#cheat-sheet-grid`, writes the comparison columns and rows, updates the legend labels from rows marked `key`. Uses `expandAbbr(...)` for content with PRI abbreviations.

No per-entity state. No ADT. No delegated listener (cheat sheet is non-interactive; `<abbr>` popovers come from `scripts/abbr-popover.js`, which already registers callbacks on `main`).

Module-top error handling: branch on `result.ok`; on failure, call `showFetchError(container, result)`.

## `patterns-concept-map.js`

Container: `#patterns-concept-map-content`. Touches `#concept-map-svg`.

Module-top loads `data/concept-map.json`. Renders nodes, edge labels, and edge lines into the SVG; sizes label backgrounds after labels exist; binds one delegated click handler on the SVG.

ID functions (Shared Key across data, DOM, adjacency lookup):

```text
nodeId(nodeKey)             -> 'concept-map-' + nodeKey
parseNodeKey(domId)         -> domId.replace(/^concept-map-/, '')
edgeKey(fromKey, toKey)     -> fromKey + '--to--' + toKey
edgeLineId(fromKey, toKey)  -> 'concept-map-edge-' + edgeKey(...)
edgeLabelId(fromKey, toKey) -> 'concept-map-edge-label-' + edgeKey(...)
```

`nodeKey` is the Shared Key across `data/concept-map.json`, node DOM IDs, and the adjacency lookup. Edge DOM IDs use the ordered `(fromKey, toKey)` pair. In data, an edge is addressed as `conceptMap[fromKey].to[toKey]`.

Click handler uses `event.target.closest('.map-node')`, returns early when no node was clicked, applies highlight from the adjacency lookup. Single active-node value at module scope (no per-node state to encapsulate; one feature-level active value).

No ADT. ConceptMapNode-as-class is optional and would only earn its keep if per-node state grew beyond "is active" (e.g., per-node behavior differing across nodes, persistent metadata).

Module-top error handling: branch on `result.ok`; on failure, call `showFetchError(container, result)`.

## `patterns-symptom-quiz.js`

Container: `#symptom-quiz-wrap`. Touches `#symptom-score`, `#symptom-condition`, `#symptom-answers`, `#symptom-feedback`, `#symptom-next`.

Owns the `SymptomQuiz` ADT — a single instance, constructed at module top with the container as root. The ADT encapsulates current item, answered state, score, marked buttons, and owns its own data load. The ADT does *not* render error UI — it returns the POJO result; the module-top glue handles failure.

```js
class SymptomQuiz {
  #idx = 0;
  #isAnswered = false;
  #score = { correct: 0, total: 0 };
  #markedBtns = [];
  #data;

  constructor(container) {
    this.container = container;
    container.querySelector('#symptom-answers').addEventListener('click', (e) => this.#handleAnswer(e));
    container.querySelector('#symptom-next').addEventListener('click', () => this.#advance());
  }

  async load(path) {
    const result = await loadJson(path);
    if (result.ok) {
      this.#data = result.data;
      this.#render();
    }
    return result;
  }
  // grading, scoring, marking, advance methods
}

const symptomQuiz = new SymptomQuiz(document.getElementById('symptom-quiz-wrap'));
const result = await symptomQuiz.load('./data/symptom-patterns.json');
if (!result.ok) showFetchError(symptomQuiz.container, result);
```

Singleton — no Factory pool. Direct `new` construction. The ADT class is justified by the per-instance state (current item, score, marked buttons) and the readability the encapsulation buys; the Factory pool from the Decorator Factory pattern is not needed here because there's only one instance and no keyed lookup.

`pattern.patternKey` is the answer Shared Key across `data/symptom-patterns.json`, each answer button's `value`, and the grading comparison.

Pre-data: answer buttons exist in source HTML. `#handleAnswer` guards on `this.#data` (or the buttons are `disabled` until first render).

## `patterns-level-quiz.js`

Containers: `#halt-quiz-wrap`, `#squat-quiz-wrap`. Two instances of one `LevelQuiz` class.

Owns the `LevelQuiz` ADT. Two named instances constructed eagerly at module top:

```js
class LevelQuiz {
  #idx = 0;
  #isRevealed = false;
  #data;
  #prompt;
  #buildParts;

  constructor(container, opts) {
    this.container = container;
    this.#prompt = opts.prompt;
    this.#buildParts = opts.buildParts;
    container.querySelector('.reveal-btn').addEventListener('click', () => this.#reveal());
    container.querySelector('.next-btn').addEventListener('click', () => this.#advance());
  }

  async load(path) {
    const result = await loadJson(path);
    if (result.ok) {
      this.#data = result.data;
      this.#render();
    }
    return result;
  }
  // render, reveal, advance methods
}

const halt  = new LevelQuiz(document.getElementById('halt-quiz-wrap'),  { prompt: haltPrompt,  buildParts: haltParts });
const squat = new LevelQuiz(document.getElementById('squat-quiz-wrap'), { prompt: squatPrompt, buildParts: squatParts });

const [haltResult, squatResult] = await Promise.all([
  halt.load('./data/halt-levels.json'),
  squat.load('./data/squat-levels.json'),
]);

if (!haltResult.ok)  showFetchError(halt.container,  haltResult);
if (!squatResult.ok) showFetchError(squat.container, squatResult);
```

Two-instance feature — direct `new` per instance, not a Factory pool. Each instance owns its current level, reveal state, prefix-derived selectors. Two `new` calls; no further coordination.

Per-instance error rendering is two lines at module top. No helper function; the POJO branch is simple enough to repeat inline.

Pre-data: reveal/next buttons exist in source HTML. Either `disabled` until first render, or `#reveal`/`#advance` guard on `this.#data`.

## When does an ADT use a Factory pool?

Factory pool (`static #instances = new Map()`, `getInstance(elOrId)`) is the right shape for many-instance features where the count and keys come from data — `CausalChain` instances keyed by chain id, `CaseStudy` instances keyed by case id. The pool gives O(1) lazy lookup as delegated events fire on different keyed elements.

For singletons (SymptomQuiz, ConceptMap) and known fixed-count instances (LevelQuiz: halt + squat), direct `new` construction is the right shape. The Factory adds machinery for lookup that doesn't apply.

## Data files

Each subtab file owns its data:

- `patterns-cheat-sheet.js` → `data/cheat-data.json`
- `patterns-concept-map.js` → `data/concept-map.json`
- `patterns-symptom-quiz.js` → `data/symptom-patterns.json`
- `patterns-level-quiz.js` → `data/halt-levels.json`, `data/squat-levels.json`

All listed in `sw.js` precache.

## Anti-patterns specific to this tab

In addition to the anti-patterns in `layering.md`:

- **`patterns.js` as sub-orchestrator.** The previous shape (`SUBTAB_FILES`, `loadShownSubtab`, `init()` re-loading the active panel) existed only because `subtab-shown` dispatched before the lazy import resolved, requiring manual catch-up. With the navigation-tabs contract change (no `subtab-shown` dispatch; per-subtab files as direct LAZY_INIT entries), the sub-orchestrator role disappears. `patterns.js` is deleted.
- **`initLevelQuiz` as a function instead of a class.** Two named instances, each with their own state, deserve an ADT class. The function-per-instance form mixes construction with module-scope state and obscures the per-instance ownership.
- **Factory pool for a singleton.** SymptomQuiz has one instance per page; using `static #instances = new Map()` + `getInstance(container)` adds machinery for keyed lookup that never applies. Direct `new` is simpler.
- **ADT calling `showFetchError` directly.** Couples the ADT class to the app's error-rendering machinery. The ADT's `load` returns the POJO result; module-top glue branches on `result.ok` and calls `showFetchError`.

## Execution order

Each step is independently reviewable. Each subtab file is a separate commit.

1. Add `scripts/load-json.js` with `loadJson(path)` returning the POJO `{ok, data, path, cause}`.
2. navigation-tabs prep: `lazyInit` becomes tolerant of modules with no `init` export; LAZY_INIT supports list-of-paths entries.
3. Extract `patterns-cheat-sheet.js`. No ADT; pure render. Update LAZY_INIT to add `patterns-cheat-sheet-content`.
4. Extract `patterns-concept-map.js`. Single active-node module state. Update LAZY_INIT to add `patterns-concept-map-content` (single path for now).
5. Extract `patterns-symptom-quiz.js` with `SymptomQuiz` ADT (singleton, direct `new`). Update LAZY_INIT entry for `patterns-concept-map-content` to list both concept-map and symptom-quiz paths.
6. Extract `patterns-level-quiz.js` with `LevelQuiz` ADT (two direct `new` instances). Update LAZY_INIT to add `patterns-level-quiz-content`.
7. Delete `patterns.js`. Remove its current LAZY_INIT entry (`patterns-content`).
8. Manual browser check: each subtab renders on first activation; data fetch failures show per-feature errors; subtab switching loads on demand; pre-data clicks on source-rendered controls don't act on undefined state.
