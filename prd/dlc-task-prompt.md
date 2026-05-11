# Data Load Consumption

Data Load Consumption (DLC) is the project rule that validates app JSON dependencies by parsed-value use, not by string reference. A `data/*.json` path counts as an app dependency only when app code reads the parsed JSON value in a feature path. A module that loads JSON, assigns the value to a binding, and never reads that binding creates a false service-worker dependency and a failure path the user did not need.

The decoder precedent defines the violation. `scripts/decoder.js` loaded `data/regions.json`, assigned the parsed value to `REGIONS`, never read `REGIONS`, and kept `./data/regions.json` in `sw.js`. The service worker then treated unused JSON as an app asset, and the load path introduced failure handling for data the decoder did not consume.

The DLC checker owns the project-specific dependency rule. The checker records consumed app data loads, reports static JSON loads whose parsed values are never read, and warns on data-path patterns it cannot prove. The detailed checker design lives in [dlc-proposal-draft.md](dlc-proposal-draft.md).

DLC checks whether app code reads the parsed JSON value after loading it. It does not check the failure response. Fail-Safe load classification handles failure response: required loads render user-visible failure, optional-enrichment loads degrade silently only when a comment names the degraded content and reason, and background loads fail silently.

ESLint owns general JavaScript mechanics. Unused bindings, unused imports, undefined names, and unreachable code belong to ESLint because those checks apply across all JavaScript files. Unused-export and file-graph analysis remain outside DLC.

The service-worker asset check uses DLC output for JSON data. Every consumed app data URL appears in `sw.js`, and every `./data/*.json` entry in `sw.js` has a consumed app load. JavaScript and CSS precache checks remain direct file-list checks because those files execute or style the app as assets, not parsed data values.

Every app JSON load gets a DLC check. The load passes DLC only when app code reads the parsed JSON value. Fail-Safe load classification is a separate check: it decides whether a failed load renders a user-visible message or degrades silently.
