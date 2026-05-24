# Data Load Consumption Proposal

Data Load Consumption protects the service-worker asset list from stale JSON dependencies. A `data/*.json` file belongs in `sw.js` when app code loads that file and reads the parsed JSON value in a feature path. A string reference, a successful fetch branch, or a module-scope assignment does not justify precaching by itself.

## Current Script Scan

The current script scan found no remaining stale data-load pattern under `scripts/`. The uncommitted decoder precedent is no longer present in app code: `scripts/decoder.js` does not load `data/regions.json`, `data/regions.json` is deleted in the working tree, and `sw.js` no longer lists `./data/regions.json`.

The current static app data loads consume their parsed JSON values. Direct consumption appears in calls such as `buildCheatSheet(result.data)`, `renderTree(result.data, treeWrap)`, `new LevelQuiz(haltResult.data)`, `new LevelQuiz(squatResult.data)`, `buildJointsView(jointsResult.data)`, `buildTranslationTable(translationsResult.data)`, and `AicMuscleFactory.acceptData(result.data)`. Assignment followed by later reads appears in `anatomizeData`, `SYMPTOM_PATTERNS`, `muscleExerciseMap`, `causalChains`, `caseStudies`, `scenarios`, `explanations`, `QUESTIONS`, `FLASHCARD_DECK`, and `CONCEPT_MAP`.

## Consumed Data Load

A consumed data load is a static `data/*.json` load whose parsed JSON value reaches app behavior. The checker counts a load as consumed when the loaded value or a binding derived from it is read by render code, passed to a constructor or feature function, written into a domain object that later serves render or event logic, or used to derive another value that the feature reads. The success check for `result.ok` and the error call to `showFetchError` are failure handling, not consumption.

The reduced decoder precedent fails this rule because the JSON value reached only an unused binding. A pattern such as `REGIONS = result.data` proves that the load succeeded and that the module stored the value. It does not prove that the app uses the value. A later read such as `renderRegions(REGIONS)`, `REGIONS[regionKey]`, or `new RegionIndex(REGIONS)` supplies the missing consumption.

## Checker Patterns

The checker analyzes app JavaScript modules under `scripts/` with an AST. It recognizes imported local names for `loadJson`, static string paths such as `loadJson('./data/master-quiz.json')`, top-level `await`, function-local `await`, and `Promise.all` result destructuring. It also handles direct `fetch('./data/file.json')` followed by `response.json()` when both bindings remain in the same function or module block.

The checker follows current project idioms. It treats `result.data` as consumed when passed to a feature render function, ADT constructor, setup function, domain factory, or method such as `acceptData`. It also treats assignment from `result.data` to a local or module binding as consumed only when that binding is read later in the same module. Assignment targets, cache writes, `result.ok`, `result.path`, `result.cause`, and `showFetchError(container, result)` do not count as reads.

The checker records one canonical URL for each consumed load. It normalizes `data/file.json` and `./data/file.json` to `./data/file.json`, and it rejects parent-directory traversal for app data paths. Duplicate consumed loads are allowed because ES modules and the service worker handle caching; the checker reports them as informational output only when that helps review a noisy diff.

## Deliberate Limits

The checker does not replace ESLint. ESLint owns unused bindings, unused imports, undefined names, and unreachable code. The DLC checker owns the project rule that a data URL reference counts only when the parsed JSON value is consumed.

The checker does not implement unused-export or file-graph tooling. It does not prove that a module is reachable from navigation, that an exported function is called by another file, or that every feature path is live. It also does not validate JSON schemas or domain content.

The checker does not prove dynamic data paths. Template literals with expressions, string concatenation, lookup tables of paths, custom wrapper functions, reflection through `window`, `eval`, or imported cache helpers are outside the failure path. When a module uses one of these patterns with a `data/*.json` path, the checker emits a warning that names the file and asks for a direct `loadJson('./data/file.json')` pattern or an explicit allowlist entry with a reason.

The checker does not count docs, PRDs, tests, dev tools, or `sw.js` as app consumption. Those files can explain, verify, or precache a data file, but they do not prove that the running app reads the parsed JSON value.

## Warning And Failure Policy

The checker fails a static app data load when no consumption is found. This failure catches the stale-load case before it can become a false dependency in `sw.js` or a user-visible import failure. The checker also fails parse errors in app JavaScript because an unparsable module prevents reliable asset verification.

The checker warns when it sees a `data/*.json` path in an unsupported load pattern. Dynamic paths and custom wrappers may be legitimate, but the checker cannot prove consumption. The warning gives the reviewer a concrete choice: rewrite the load into a recognized pattern, add a narrow allowlist entry with a reason, or remove the stale reference.

The asset check fails when `sw.js` precaches a `data/*.json` file that has no consumed app load. It also fails when a consumed app data load is absent from `sw.js`. A data file that exists on disk but has no consumed app load remains an orphan-asset warning unless it is also listed in `sw.js`.

## Interaction With `sw.js`

The DLC checker produces the canonical set of consumed app data URLs. The service-worker check uses that set as the data side of the precache contract. Every consumed app data URL must appear in `PRECACHE_URLS`, and every `PRECACHE_URLS` entry under `./data/` must appear in the consumed set.

The existing `sw.js` existence check remains unchanged. A precache entry that points to a missing file fails before consumption is considered. The reverse-direction check changes only for JSON data files: it no longer requires every file under `data/` to be precached. It requires every consumed app data load to be precached.

The non-data asset checks keep their current boundary. JavaScript and CSS files remain direct precache requirements. Image orphan checks still search app references, including JSON files that the app consumes. Documentation, PRDs, tests, and dev tools remain excluded from deployed asset justification.
