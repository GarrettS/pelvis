# Layering Doctrine

This is the target architecture for tab modules in this codebase. It separates
concerns into four pillars and names the contracts between them. Per-feature
HLA artifacts (e.g., `diagnose-hla.txt`, `patterns-hla.md`) describe how a
particular tab maps to these pillars, including any current gaps.

## Pillars

The codebase organizes around four kinds of code, each with a distinct role:

1. **Module code** — the implementation site for a feature. Wires the
   feature to the page: looks up static DOM elements, registers delegated
   listeners, dispatches events, calls into ADTs via factories, owns the
   feature's setup lifecycle.
2. **ADTs** — encapsulate domain objects with state and behavior. Hold the
   feature's identity-bearing entities (CausalChain, CaseStudy, future
   ConceptMapNode). Own DOM mutation for their own subtree only.
3. **Data** — the source of truth for domain content. JSON files. Structural
   only; carries no behavior.
4. **Loaders** — encapsulate data access. Fetch + cache (where appropriate)
   + parse. Expose the data to module code via a small surface.

Each pillar has its own rules about what it can do at module-top, what it
can touch, and how it relates to the others.

## Pillar 1: Module code

**Role:** integration. Module code is where the feature meets the page.

**Lives in:** per-feature module files (e.g., `scripts/diagnose-causal-chains.js`,
`scripts/patterns-concept-map.js`).

**Allowed at module-top:**
- Static element lookup: `document.getElementById('feature-wrap')` against
  HTML that is part of `index.html` and reliably present when the module
  loads (lazy-imported by `navigation-tabs.js` after tab activation).
- Listener registration on those static elements via `addEventListener`.
- Constant declarations, imports, helper-function definitions.

**Forbidden at module-top:**
- Triggering data fetches.
- Instantiating ADTs.
- Rendering content (DOM mutations beyond listener wiring).

**Required:**
- A single exported `setupX()` function that the tab's init module calls.
- The setup function loads its own data (via the feature's loader), then
  renders.
- Inline error handling for fetch failures: catch in setupX, render a
  failure message inside the feature's wrap. Per-section autonomy; one
  section's failure does not block others.

**Listener pattern:** delegated listeners on the feature's static wrap.
Listeners check `event.target.closest(...)` to identify the actionable
element, then call `Factory.getInstance(elOrId)` to obtain the relevant ADT
instance, then call a method on it. Listeners fire repeatedly; the Factory's
caching makes this cheap.

**Lifecycle invariant:** never render interactive UI before its data is
ready. setupX awaits the loader before calling render. Listeners can be
bound before data is available — they cannot fire until rendered content
exists for the user to interact with.

### Listener bind locations

Where listeners get bound is a judgment call, not a fixed rule. The
doctrine names the trade-offs; the engineer picks per-feature. Two
positions are valid:

**Module-top.** Bind statements run when the module body evaluates,
structurally one-shot by language semantics.

- Buys: listener-bind is exactly-once-per-module-load by construction;
  no flag needed.
- Costs: module body becomes impure. `import`-ing the module triggers
  `document.getElementById(...)` and `addEventListener(...)` as side
  effects. Tests and any non-DOM caller must work around that.

**Inside `setupX()`, guarded for idempotence.** Listener bind happens
on the first `setupX()` call; subsequent calls skip via a per-module
flag (`let listenersBound = false;`) or an equivalent `bindOnce`
helper.

- Buys: imports stay pure (no DOM at module-top). Listener-bind stays
  idempotent against the retry path —
  `navigation-tabs.js:71-74` deletes the `initialized` gate on
  `init()` rejection, so revisit re-runs every `setupX()`.
- Costs: per-module flag (or shared helper) is the bookkeeping cost.

The choice is per-feature. The feature's HLA artifact records the
chosen location and the local reasoning. The same project can have
some features bind at module-top and others bind inside setupX; that
is not a contradiction, it is each feature making the call that fits
its constraints.

Two anti-shapes:

- **Module-top binding without acknowledging the impure-import property.**
  Tests and tooling will hit it. Document the trade in the feature's HLA.
- **Setup-time binding without an idempotency guard.** Init rejection
  triggers retry; unguarded bind statements re-bind on
  already-successful sections, accumulating listeners.

## Pillar 2: ADTs

**Role:** encapsulate a domain entity with state and behavior. Own the DOM
subtree associated with that entity.

**Lives in:** the feature module file alongside module code (today; pillar
separation within a feature module is a future cleanup).

**Allowed at module-top:**
- Class definition.
- Factory IIFE establishing private `#instances` pool, `#KEY` Symbol,
  `getInstance(elOrId, definition)`, `discard(id)`, `discardAll()`.

**Forbidden at module-top:**
- Touching the DOM. The class is defined; no instance exists yet.
- Triggering data fetches. The factory does not own data loading; it
  receives definitions from module code.
- Instantiating itself. Instances are created lazily by `getInstance`.

**Required:**
- All state is private (`#fields`).
- Identity is exposed via a public `id` (typically a getter).
- Behavior methods can mutate state and the DOM subtree the ADT represents.
  An ADT may call `classList.toggle`, `insertBefore`, etc. on elements it
  owns — never on elements outside its subtree.
- Factory enforces the construction invariant via the Symbol-guarded
  constructor. External code cannot directly construct.

**Why factory over module-singleton-of-class:** features with multiple
instances (one chain per causal chain, one case study per case) need
identity-keyed lookup. Module code's listener fires repeatedly; the factory's
cache makes `getInstance(id)` cheap. Single-instance features (a quiz, a
concept map) do not need a factory; module-singleton state is sufficient.

## Pillar 3: Data

**Role:** the source of truth for domain content.

**Lives in:** `data/*.json`. One file per feature. Naming convention: each
file is named after the feature module that consumes it (e.g.,
`data/diagnose-causal-chains.json` consumed by
`scripts/diagnose-causal-chains.js`).

**Required shape:**
- Cohesive: one domain concept per file. No junk-drawer files holding
  multiple unrelated domains.
- Structural: contains data, not behavior. No instructions, no JS-shaped
  pseudocode.
- ID-as-key: when a record collection is keyed by id, the file is a keyed
  object (`{ "foo": {...}, "bar": {...} }`), not an array of objects with
  `id` fields. See the Misplaced Key antipattern.
- No dead fields: redundant id properties on records keyed by id, or fields
  no consumer reads, are removed. See the dead-key sweep precedent.

**Anti-patterns:**
- **Junk-drawer JSON** — multiple unrelated domains in one file. Forces
  consumers to share a loader, creates dependency hubs at the loader layer.
- **Misplaced Key** — array of records carrying their own id field, when the
  consumer accesses by id. Resolve: keyed object, drop the id property.
- **Dead fields** — properties no consumer reads. Remove, or document why.

## Pillar 4: Loaders

**Role:** encapsulate data access. Fetch + parse, with appropriate caching.

**Lives in:** ideally co-located with the feature module that uses the
data, OR as a tiny shared utility for the fetch+parse pattern itself
(`scripts/load-json.js`).

**Allowed:**
- Fetch from a URL.
- Parse JSON.
- Throw `Response` on HTTP error and `SyntaxError` on parse failure
  (preserving error semantics for callers).

**Forbidden:**
- **Multi-key vending.** A loader serves one data type. Loaders that vend
  multiple slices over one shared fetch (the `study-data-cache.js` shape)
  create a dependency hub: every consumer module imports the same loader
  for unrelated reasons.
- **Module-scope cross-feature cache.** When data is not actually shared
  between features, caching it across features adds coupling without
  benefit.

**Caching:** rely on the service worker for HTTP-layer caching across page
loads. Within a page load, each `setupX()` is typically called once on
the success path (navigation-tabs's `initialized` Set gates re-entry).
Re-entry IS possible: `navigation-tabs.js` deletes the gate when
`init()` rejects, so a programming bug or escaped rejection causes
revisit to run `init()` again. JS-level deduplication is unnecessary
even so — second-call refetches are fine if every other failure mode
is handled deliberately. What matters is that listener-bind sites
inside `setupX()` are idempotent (see "Listener bind locations" below).

**Anti-pattern: middleman accessor.** A function whose body is
`async () => (await load()).slice` is a middleman: it adds a function call
and a file boundary between the consumer and the data, but does not
encapsulate any logic the consumer would otherwise duplicate.

## Cross-pillar contracts

These name the thin interfaces between pillars.

### Shared Key

**The contract:** a single string identifies a domain entity across DOM,
data, and ADT pool.

- DOM: `<ol class="chain-list" id="diaphragm-to-adt">` — element id.
- Data: `"causalChains": { "diaphragm-to-adt": { ... } }` — JSON key.
- ADT pool: `instances["diaphragm-to-adt"]` — factory pool key.

The same string crosses all three layers without translation. Module code
extracts the id from the event target (`target.closest('.chain-list').id`)
and uses it directly as the lookup key in all three layers.

**Corollary:** any feature that needs id-based lookup at runtime must
ensure JSON, DOM ids, and pool keys agree on the same id. Naming is
load-bearing; treat the id as a domain-language token (not an opaque
slug).

### Factory

**The contract:** the seam between module code (which fires repeatedly
on user interaction) and ADTs (which represent identity-bearing entities).

`Factory.getInstance(elOrId, definition?)`:
- Accepts either an element (extracts `.id`) or a string id.
- Returns the cached instance, or creates one via the Symbol-guarded
  constructor on first request, or throws if no definition is available
  (cold-pool fallback typically reads from the module-scope data slice).

This is the only way module code instantiates an ADT. Listeners call this
on every event without performance concern because the cache makes
repeated calls O(1).

### Delegated listener

**The contract:** module code wires one listener per event type per
feature wrap, dispatching to actionable elements via
`event.target.closest('.actionable-class')`.

Per-element listeners are an anti-pattern: they accumulate on rebuild,
they don't survive innerHTML replacement, they multiply object count.
Delegation scales: one listener handles current and future descendants.

### Data-load gate

**The contract:** never render interactive UI before its data is ready.

- `setupX()` awaits its loader before calling render.
- Listeners on static wraps can be bound at any time; they fire only after
  rendered content exists.
- This prevents "user clicks but nothing happens" bugs from race conditions
  between data and render.

## Anti-patterns (named for grep-ability)

- **Junk-drawer module** — one file holding multiple distinct domain
  features. Resolution: split per feature.
- **Junk-drawer JSON** — one data file holding multiple unrelated domains.
  Resolution: split per feature.
- **Helper-as-category** — using "helper" or "utility" as the architectural
  classification. "Helper" hides what the code IS. Resolution: classify by
  pillar (module code, ADT operation, data shape, or genuine
  domain-agnostic utility) and place accordingly.
- **Multi-key vendor loader** — one loader exposing N accessors over one
  shared fetch. Creates a dependency hub. Resolution: per-feature loaders.
- **Middleman accessor** — `async () => (await load()).slice`. Adds a hop
  without encapsulating logic. Resolution: direct fetch in the feature's
  loader.
- **Misplaced Key** — array of records carrying id field, accessed by id.
  Resolution: keyed object, drop id field.
- **Dead-defensive fallback** — `node.question || node.id` where every node
  in the data has `.question`. Defends against a case that never happens.
  Resolution: delete the fallback; trust the data.
- **Pillar mixing** — a module that mixes module code with ADT definitions
  and a custom loader. Today this is acceptable when the ADT and module
  code are tightly coupled; future cleanup may extract the ADT to its own
  file when coupling loosens or the ADT is reused.

## Examples

### CausalChain (good ADT)

`scripts/diagnose-causal-chains.js` defines `CausalChain` (class) and
`CausalChainFactory` (IIFE). The class:
- Holds `#id`, `#steps`, `#order`, drag state.
- Exposes behavior methods (`startDrag`, `dragMove`, `commitDrop`,
  `endDrag`, `isOrderCorrect`, `orderResults`).
- Mutates DOM only on its own `<ol>` element and its `<li>` children.
- Constructor is Symbol-guarded; only the factory can instantiate.

### setupCausalChains (good module code)

Same file. The exported `setupCausalChains()`:
- Awaits `getCausalChains()` (today; per migration, will fetch its JSON
  directly).
- Renders chain cards into `#chains-wrap`.
- Module-top binds delegated `click` listeners on `#chains-wrap` and pointer
  listeners via `wireChainDrag`.

### study-data-cache.js (anti-pattern, scheduled for removal)

`scripts/study-data-cache.js` is a multi-key vendor: one `load()` Promise
behind 6 named accessors (`getCausalChains`, `getCaseStudies`, etc.). Six
consumer files all import from this one module. Each accessor is a
middleman over the same `(await load()).slice` shape. Tracked for
elimination by `diagnose-data-boundary-migration.md`.

### study-data.json (anti-pattern, scheduled for split)

`data/study-data.json` is a junk drawer holding 6 top-level keys consumed
by 2 different concerns (5 by diagnose, 1 by nomenclature). Tracked for
splitting by the migration.

## Per-feature HLA artifacts

Each tab's HLA artifact (`diagnose-hla.txt`, future `patterns-hla.md`,
etc.) describes how that tab maps to the pillars and names current gaps.
The doctrine is the target; the HLA is the as-built (with gap notes
where the tab hasn't fully aligned yet).
