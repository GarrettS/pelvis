# `patterns.js` HLA

## Scope

`scripts/patterns.js` currently owns four distinct features:

- cheat sheet
- concept map
- symptom quiz
- level quizzes (`halt`, `squat`)

Target architecture: split the file by domain concept, give each
feature a clear state boundary, and make listener lifetime local to
the feature that owns it. This HLA describes the post-split target,
not current `patterns.js`.

Reference: layering doctrine in `prd/architecture/layering.md`.
Sibling: `prd/hla/diagnose.txt`, `prd/hla/aic-chain.txt`.

## Target Modules

Each domain concept gets its own module. The four features under the
Patterns tab are independent: cheat sheet, concept map, symptom quiz,
and level quiz (instantiated twice, for HALT and Squat). Each feature
module owns its own data file load and its own fetch-failure path.

`scripts/patterns.js` is the integration host. It exports `init()`,
which calls each feature module's exported lifecycle function.
`patterns.js` does not load data and does not handle per-feature
fetch failures.

### Module list

```text
scripts/patterns.js          integration host. Exports init():
                             dispatches to each feature's lifecycle
                             function. Loads no data of its own.

scripts/cheat-sheet.js       Render module (no class, no instance,
                             no owned state).
                             Exports initCheatSheet(): loads
                             data/cheat-data.json, renders the grid
                             + legend on success, calls
                             showFetchError on
                             #patterns-cheatsheet-content on
                             failure.

scripts/concept-map.js       Owns ConceptMap (singleton; one
                             instance per page; no factory pool).
                             Exports initConceptMap(): loads
                             data/causal-map.json, constructs the
                             singleton, builds nodes + edges +
                             labels, and binds the delegated click
                             on the SVG root. On fetch failure,
                             calls showFetchError on
                             #patterns-conceptmap-content.

scripts/symptom-quiz.js      Owns SymptomQuiz (singleton; eager
                             construction).
                             Exports initSymptomQuiz(): loads
                             data/symptom-patterns.json, constructs
                             the singleton, binds two listeners
                             (delegated answer-button click +
                             direct next-button click), renders
                             question 0. On fetch failure, calls
                             showFetchError on #symptom-quiz-wrap.

scripts/level-quiz.js        Owns LevelQuiz (per-prefix instance:
                             halt and squat are independent
                             singletons; no factory pool).
                             Exports initLevelQuiz(opts), where
                             opts is { prefix, prompt, buildParts }.
                             Loads data/<prefix>-levels.json,
                             constructs one instance scoped to its
                             prefix, binds direct listeners on its
                             reveal and next buttons, renders. On
                             fetch failure, calls showFetchError on
                             #<prefix>-quiz-wrap.

scripts/load-json.js         Leaf utility: fetch + parse + throw on
                             !ok. No cache, no schema, no shared
                             promise. If it grows beyond fetch+parse,
                             it has become the study-data-cache.js
                             anti-pattern under a new name.
```

The `init` function-name prefix matches the existing convention
inside `patterns.js` today (`initSymptomQuiz`, `initHaltQuiz`,
`initSquatQuiz`). Stateless render helpers inside a feature module
may still use the `build` prefix (`buildCheatSheet(data)` as a
private render function called by `initCheatSheet()`). The diagnose
tab uses `setupX()` for the equivalent role; the architectural shape
is the same — one module per feature, each exporting one lifecycle
function that owns its own data load.

### What an ADT owns

`ConceptMap`, `SymptomQuiz`, and `LevelQuiz` are UI-owning types,
not data-only. Each owns:

- the **keys** (Shared Key strings) that identify its slice in the
  DOM and in its data
- **state** derived from those keys (active node, current question
  index, answered flag, score)
- **behavior** that operates through those keys (render, highlight,
  grade)

DOM elements are reached via the keys (`document.getElementById(...)`
or delegated event resolution). Cached element refs are an
optimization, not the type's identity.

`cheat-sheet.js` is not a class: it has no identity-bearing state.
It is a render module — a function that takes parsed cheat data and
emits the grid + legend.

## Init flow

```text
patterns.js init()
  +--> initCheatSheet()
  |      +--> loadJson('data/cheat-data.json')
  |             ok:  buildCheatSheet(data) renders into
  |                  #cheat-sheet-grid
  |             err: showFetchError on
  |                  #patterns-cheatsheet-content
  |
  +--> initConceptMap()
  |      +--> loadJson('data/causal-map.json')
  |             ok:  construct ConceptMap, render nodes/edges/
  |                  labels, bind delegated click on SVG root
  |             err: showFetchError on
  |                  #patterns-conceptmap-content
  |
  +--> initSymptomQuiz()
  |      +--> loadJson('data/symptom-patterns.json')
  |             ok:  construct SymptomQuiz, bind listeners,
  |                  render question 0
  |             err: showFetchError on #symptom-quiz-wrap
  |
  +--> initLevelQuiz({prefix:'halt', prompt, buildParts})
  |      +--> loadJson('data/halt-levels.json')
  |             ok:  construct LevelQuiz, bind listeners, render
  |             err: showFetchError on #halt-quiz-wrap
  |
  +--> initLevelQuiz({prefix:'squat', prompt, buildParts})
         +--> loadJson('data/squat-levels.json')
                ok:  construct LevelQuiz, bind listeners, render
                err: showFetchError on #squat-quiz-wrap
```

Per-feature failure isolation: each feature catches its own expected
fetch failure, calls `showFetchError` on its own DOM region, and
resolves. Sibling features render normally.

## Module Roles

### `patterns.js`

- exports `init()` only
- calls each feature module's exported lifecycle function
- loads no data; constructs no instances; handles no per-feature
  fetch failures
- does not retain instance references — each feature module retains
  its own singleton internally if needed

The data boundary is per-feature: each feature module owns its own
`loadJson(...)` call and the user-visible failure path that goes
with it.

### `cheat-sheet.js`

- render module (no class, no instance, no owned state)
- exports `initCheatSheet()`: async; loads cheat data, then renders
  via private `buildCheatSheet(data)` (clears the grid, renders
  columns + rows + legend)
- on fetch failure, calls `showFetchError` on
  `#patterns-cheatsheet-content`
- idempotent: render clears its slot before inserting

### `concept-map.js`

```text
ConceptMap (singleton, constructed in initConceptMap)
-----------------------------------------------------
+-- private  #activeNode       Active Object: currently highlighted
|                               .map-node element (or null)
|            #edgesByNode      adjacency built from CAUSAL_MAP:
|                               { nodeKey -> [{fromKey, toKey}] }
|            #svgRootEl
+-- public   activate(nodeEl)  Active Object swap: clear prior
|                               active, set new active, apply
|                               .highlighted to node + each
|                               connected edge + the node on the
|                               other end; flip marker-end on
|                               highlighted edges to arrow-map-hl
+-- effects  DOM mutations confined to #svgRootEl
+-- listener delegated click on #svgRootEl, bound once in
             initConceptMap(); resolves target via
             closest('.map-node'); calls activate(nodeEl)

Build helpers (module-private, not on the singleton):
  buildNodes(data)        -> SVG <g class="map-node" id="...">
  buildEdgeLabels(data)   -> SVG <g class="map-edge-label-group">
  buildEdgeLines(data)    -> SVG <line class="map-edge">
  sizeEdgeLabelBoxes()    measures rendered text, sizes label rects
```

DOM-id helpers (derived from `nodeKey`):

```text
nodeId(nodeKey)             -> 'concept-map-' + nodeKey
parseNodeKey(domId)         -> domId.replace(/^concept-map-/, '')
edgeKey(fromKey, toKey)     -> fromKey + '--to--' + toKey
edgeLineId(fromKey, toKey)  -> 'concept-map-edge-' + edgeKey(...)
edgeLabelId(fromKey, toKey) -> 'concept-map-edge-label-' + edgeKey(...)
```

`nodeKey` is the cross-layer Shared Key. `edgeKey(fromKey, toKey)`
is a derived DOM-id string only — at the data layer, edges are
identified by the nested pair `CAUSAL_MAP[fromKey].to[toKey]`, not
by a single string.

Why one singleton instead of `ConceptMapNodeFactory`:

- there is one map on the page
- highlight state is global to the map, not independent per node
- `activate` derives the highlight set from one active node + the
  adjacency list; no per-node mutable state to cache

### `symptom-quiz.js`

```text
SymptomQuiz (singleton, constructed in initSymptomQuiz)
-------------------------------------------------------
+-- private  #patterns         parsed SYMPTOM_PATTERNS array
|            #idx              current question index
|            #isQuizDone       true after gradeAnswer; cleared on
|                               advance
|            #score            { correct, total }
|            #markedBtns       buttons styled .correct/.incorrect,
|                               cleared on re-render
+-- public   render()          paint question at #idx; reset
|                               feedback + marks
|            gradeAnswer(btn)  compare btn.value to
|                               #patterns[#idx].patternKey; mark
|                               correct/incorrect, update #score,
|                               show feedback
|            advance()         #idx = (#idx + 1) % length;
|                               clear #isQuizDone; render()
+-- effects  DOM mutations confined to the symptom-quiz subtree
+-- listeners (bound once in initSymptomQuiz):
|            - delegated click on #symptom-answers, target
|              closest('.answer-btn'): -> gradeAnswer(btn)
|            - direct click on #symptom-next: -> advance()
```

### `level-quiz.js`

```text
LevelQuiz (per-prefix instance; halt and squat independent)
-----------------------------------------------------------
+-- private  #prefix           'halt' | 'squat' (Shared Key:
|                               scopes instance + prefixes DOM ids)
|            #levels           parsed levels array
|            #idx
|            #isQuizDone
|            #prompt           (level) -> string
|            #buildParts       (level) -> [[label, value], ...]
+-- public   render()          paint level at #idx in
|                               #<prefix>-question
|            reveal()          if !#isQuizDone: set #isQuizDone,
|                               disable #<prefix>-reveal, append
|                               feedback box from #buildParts
|            advance()         #idx = (#idx + 1) % length; clear
|                               #isQuizDone; re-enable reveal;
|                               render()
+-- effects  DOM mutations confined to the #<prefix>-question subtree
+-- listeners (bound once in initLevelQuiz):
|            - direct click on #<prefix>-reveal: -> reveal()
|            - direct click on #<prefix>-next:   -> advance()
```

Call shape (twice from `patterns.js`):

```js
initLevelQuiz({
  prefix,        // 'halt' or 'squat'
  prompt,        // (level) => string
  buildParts     // (level) => [[label, value], ...]
});
// initLevelQuiz loads data/<prefix>-levels.json itself.
```

## Coupling channels

```text
+-- nodeKey     ConceptMap cross-layer Shared Key: data key in
|               CAUSAL_MAP <-> DOM id ('concept-map-' + nodeKey)
|               <-> #edgesByNode key
+-- edge ids    ConceptMap derived DOM-id strings only.
|               edgeLineId(from,to)  = 'concept-map-edge-' +
|                                       edgeKey(from,to)
|               edgeLabelId(from,to) = 'concept-map-edge-label-' +
|                                       edgeKey(from,to)
|               At the data layer, edges are addressed by the
|               nested pair CAUSAL_MAP[fromKey].to[toKey], not by
|               a single string key.
+-- patternKey  SymptomQuiz: pattern.patternKey in data <-> answer
|               button [value] attribute <-> gradeAnswer comparison
+-- prefix      LevelQuiz: 'halt' | 'squat' selects instance, names
|               its data file (data/<prefix>-levels.json), scopes
|               its DOM ids ('#<prefix>-question',
|               '#<prefix>-reveal', '#<prefix>-next',
|               '#<prefix>-quiz-wrap'), and labels its UI badges
+-- closure     each initX() closes over its singleton; handlers
                reference the singleton directly, not a registry
```

## Listener Lifecycle

Each feature module separates:

- one-shot setup (the `initX()` call): construct the singleton (if
  the feature has one), bind the listeners specified in its module
  role above (delegated or direct, per the feature's needs), render
  initial state
- repeatable render (called from handlers): rebuild or refresh
  visible content; clear before insert so re-entry does not
  duplicate DOM

Listener binding lives inside each feature module's `initX()`
function. This matches `layering.md`'s rule that module code owns
listeners — the feature module is the relevant module. `patterns.js`
binds no feature listeners.

The binding target varies by feature:

- ConceptMap: one delegated click on the SVG root
- SymptomQuiz: delegated click on `#symptom-answers` plus direct
  click on `#symptom-next`
- LevelQuiz: direct clicks on `#<prefix>-reveal` and
  `#<prefix>-next` (single static elements; delegation not needed)

Idempotency: if `initX()` is called more than once, it must guard
against double-binding. Render functions must clear before inserting
to avoid duplicate DOM on re-entry.

## Render Boundaries

- Keep HTML/SVG construction inside the feature module, not at the
  call site.
- Do not force `createElement` everywhere.
- Break large opaque render strings into smaller helpers where that
  improves readability.

Examples:

- `renderConceptMapNode(nodeKey, node)`
- `renderConceptMapEdge(fromKey, toKey, edge)`
- `renderSymptomFeedback(...)`
- `renderLevelFeedback(...)`

## Recommended Execution Order

1. Add `scripts/load-json.js` (created by the diagnose data-boundary
   migration; reused here).
2. Extract the concept map into `scripts/concept-map.js`.
   `patterns.js` calls `initConceptMap()`.
3. Extract symptom quiz into `scripts/symptom-quiz.js`. `patterns.js`
   calls `initSymptomQuiz()`.
4. Extract level quiz into `scripts/level-quiz.js`. `patterns.js`
   calls `initLevelQuiz()` twice (HALT, Squat).
5. Extract cheat sheet into `scripts/cheat-sheet.js` as a render
   module. `patterns.js` calls `initCheatSheet()`.
6. Reduce `patterns.js` to imports + the five lifecycle calls.

This keeps the highest-risk interaction code first and the stateless
render module last.

## Non-Goals

- Do not force diagnose-style decorator/factory machinery onto
  singleton quizzes or onto the single-instance ConceptMap.
- Do not do a blanket `innerHTML` rewrite.
- Do not redesign behavior while splitting architecture.

Behavior should stay stable. The refactor is greenfield in module
shape, not in user-facing behavior.

## Doctrine alignment

- Shared Key — ConceptMap's `nodeKey` is the cross-layer Shared
  Key (data key in `CAUSAL_MAP`, DOM-id suffix in
  `concept-map-<nodeKey>`, key in `#edgesByNode`).
  `edgeKey(fromKey, toKey)` is a derived DOM-id string, not a data
  key. SymptomQuiz: `patternKey` crosses data
  (`pattern.patternKey`) and answer button `[value]`. LevelQuiz:
  `prefix` (`'halt'` | `'squat'`) scopes the instance, names its
  data file, and prefixes its DOM ids.
- Active Object — ConceptMap's `#activeNode` is the currently
  highlighted `.map-node` element; `activate(nodeEl)` swaps it
  without scanning siblings.
- Event Delegation — ConceptMap delegates on the SVG root.
  SymptomQuiz delegates on `#symptom-answers`. LevelQuiz binds two
  direct listeners on single static elements (delegation is not
  needed for one-of-one targets).
- Encapsulation — each class's private fields stay private; only
  the methods called from handlers are public.
- DOM-Light — HTML/SVG built from data; CSS owns highlight state
  (`.highlighted`, `.correct`, `.incorrect`, `.answered`).
