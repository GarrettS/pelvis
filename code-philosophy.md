# Code Philosophy

Why these guidelines exist, what they protect, and who they serve.

---

## The Approach

Vanilla JavaScript. No frameworks. No build tools. Named patterns applied through continuous refactoring, small commits, each one leaving the code cleaner than the last.

This is not the mainstream approach. Most AI-assisted development leans heavily on frameworks, TypeScript, and build tooling. Most developers use AI to generate code fast, not to refine it iteratively. This approach is different on every axis:

- **No framework, no framework debt.** There is no abstraction layer to learn, no version to upgrade, no deprecation cycle to chase. The patterns used here — Active Object, Shared Key, event delegation, dispatch tables — are rooted in how the DOM actually works. They will work the same in ten years.
- **A living code-guidelines document as a contract.** It keeps every contributor — human or AI — honest across sessions. It is not a suggestion file. It governs.
- **Pattern literacy over code generation.** Changes are justified by named refactoring patterns from the software engineering canon: Compose Method, Extract Shared Logic, Decompose Conditional. The question is never "does it work" — it is "is this the right abstraction?"
- **The AI is a pair programmer, not a code generator.** Its output is reviewed, challenged, and corrected. "Caught you slipping" is the expected dynamic, not an exception.

## What This Produces

Code that is future-proof, tuneable, maintainable, robust, clear, and fast. Vanilla JS starts at the performance ceiling — there is no framework overhead to optimize away. The guidelines compound: each refactoring encodes a principle that applies to the next, across projects. The codebase gets more consistent over time instead of accumulating layers of different authors' styles and framework idioms.

## The Market Reality

The volume of framework-heavy, AI-generated, nobody-reviewed code is growing. Developers who cannot distinguish a for loop from a DFS are churning out large applications built on the worst practices, compounding the existing mass of bloated framework code. This will produce spectacular failures.

When it does, the people who can point to principled, performant, maintainable vanilla code will be in a very different position. Code quality is not a luxury — it is a market differentiator. The code quality renaissance is here.

## Why This Cannot Be Easily Replicated

Someone could copy these guidelines and get mechanical value — a linter-level improvement. But the process requires judgment that guidelines cannot transfer:

- **An experienced developer** who knows the patterns by name can use the guidelines and push back on AI output effectively. They get most of the value.
- **A mid-level developer** follows the rules but does not know when to break them, when to push back, when the AI is slipping. They produce clean-looking code that misses the deeper design.
- **A vibe coder** ignores the guidelines within three prompts because they slow things down. That is the whole point — they slow things down *just enough* to get it right.

The edge is not the document. It is the ability to pair-program with an AI to make the code better.

---

## When Rules Conflict

The guidelines contain principles, rules, defaults, and heuristics. They are not all the same kind of statement, and they do not all carry the same weight.

- **Principles** govern judgment (Fail-Safe, Module Cohesion, DOM-Light). They are the reasons behind the rules.
- **Rules** are specific and testable (`===` always, no `addEventListener` in repeatable functions, all colors via custom properties). They are followed unless a principle overrides them.
- **Defaults** apply unless there is a stated reason not to ("favor source HTML," "prefer CSS over JS for state"). The word "prefer" or "avoid" signals a default.
- **Heuristics** are context-dependent guidance (extract shared logic, decompose conditional). They require judgment about when to apply.

When two rules pull in opposite directions, the more specific rule governs within its scope. When two rules of equal specificity conflict, the one closer to the user's experience wins: Fail-Safe outranks optimization, legibility outranks mechanical compliance.

Example: Extract Shared Logic says to extract duplicated structure into a parameterized function. But extraction is not justified by duplication alone — it is justified when it names an operation and makes the calling code read as a sequence of intentions. If extraction adds indirection without improving legibility at the call site, the extraction is not warranted. The principle (legible code) governs the heuristic (extract shared structure), not the other way around.

When the conflict is not resolvable by these rules, state the tension and ask. Do not silently pick a side.

## Shared Key: Why IDs Are the Architecture

The Shared Key pattern uses a unique `id` as a single-token address across every layer — DOM lookup, dispatch routing, data access. The rationale:

**Greppability.** A developer sees `cmap-edge-3` in the browser inspector, greps `cmap-edge` in the IDE, and lands exactly on the module that owns that logic. No prop-tracing through framework abstractions. No "which component renders this?" — the prefix IS the module.

**Zero-translation path.** Frameworks pay a translation tax on every interaction: Event → Synthetic Event → Action Creator → Reducer → State Update → Virtual DOM Diff → Real DOM Update. The Shared Key path is: Event → Dispatch Table[ID] → Method → getElementById(ID). A straight line from click to execution, with no intermediate representations.

**Reduced indirection.** Frameworks introduce ref objects, virtual keys, and state hooks that must be reconciled against a state tree. The Shared Key collapses the distinction between DOM identity and action route. The ID is the pointer — `getElementById` for the node, `DISPATCH[id]()` for the behavior, `data[id]` for the record. All O(1), all using the same string.

**Collision control as a simple contract.** Critics fear ID collisions, but module-owned prefixes make collisions a failure to follow the grep protocol, not a failure of the architecture. It is a social and technical contract that scales because it is simple, not because it is wrapped in a library. If two developers both use `edge-` for different features, the collision is visible in a single grep — not hidden behind framework-managed component scoping.

**Why frameworks avoid IDs.** React discourages `id` attributes because components may be rendered multiple times, producing duplicate IDs that break `getElementById` and accessibility associations. React provides `useId()` for accessibility attributes and `useRef()` for imperative DOM access — abstractions that solve a problem the framework created by taking DOM control away from the developer. Worse, `useId()` generates opaque tokens (`:r1:`, `:r2:`) that are meaningless to human readers, invisible to grep, and useless in the browser inspector — far from "give each identifier a meaningful name from the project's ubiquitous language." React could have encouraged unique, developer-chosen IDs scoped to component instances; instead it chose disposable machine-generated tokens. In vanilla JS, the developer controls instantiation. If you need two calendars, you parameterize the ID from the caller (`salon-calendar`, `deliveries-calendar`) and there is no duplication because you decided how many instances exist and what each one is called. The Shared Key pattern works because the developer manages DOM identity directly — no reconciliation layer can invalidate an ID the developer explicitly created and maintains.

**The triple-threat.** A meaningful, human-readable ID — named from the project's ubiquitous language — is the universal coordinate across JS dispatch, DOM lookup, and CSS styling. See it in the inspector, find it in the code, know what it represents. No translation layer to hide bugs.

| Layer | Implementation | Doctrine |
|---|---|---|
| JS | `CLICK_DISPATCH['prefix-id']` | O(1) Dispatch |
| DOM | `id="prefix-id-3"` | Namespaced Address |
| CSS | `.anatomize-label`, `.equiv-opt` | Module-prefixed classes |

## Good Names

Correct terminology is not cosmetic. When code, data, selectors, and documentation use the same domain terms, moving from user terminology to implementation requires no translation. That reduces debugging cost, improves grepability, and lowers the risk of model drift.

Identifiers with material accuracy — `pelvisRotationDegrees` instead of `val`, `activeDragItem` instead of `dragging`, `ABBR_TITLES` instead of `MAP`. The name describes the domain reality, not the programming artifact. If the user calls it a "concept map," the code says `conceptMap` — not `cmap`. Programmer shorthand (`mq`, `expl`, `btn`) forces a translation in the reader's head; domain abbreviations do not, because they are the language of the domain itself. A medical app uses `ADT` and `PADT` because the clinicians do. A trading app uses `WTI` and `EUR` because the traders do. A dental app uses `FMX` and `BW` because the hygienists do. These are not programmer abbreviations — they are the vocabulary of the people the software serves.

Module-scoped variables in ES modules are not globals. Even if they were, a unique name with a descriptive prefix provides a logical namespace that the human brain (and grep) can navigate effortlessly. The "fear of globals" is a framework-era anxiety that does not apply to module-scoped state with material-accuracy naming. Name it well, scope it to the module, and move on.

The grep test: if you can find a feature by searching for the same word the user uses, the naming is correct. If you have to know that the user's "concept map" is `cmap` in the code, the naming has failed. Generic frameworks reward generic naming; this doctrine prefers custom-fit domain naming that makes the code an explicit map of the system it models.

## The CSS Engine as a State Machine

The browser's CSS engine is a declarative partner to the JS logic, not just a painting tool.

**Zero-iteration styling.** The Ancestor Class pattern — one state class on a common ancestor, descendant rules in CSS — offloads state-based visual changes to the browser's C++ style-recalc pass. No JS loops toggling classes on descendants. Example: `#tab-equivalence.showing-results .equiv-quiz-wrap` — the ancestor gets the class, the cascade hides/shows the descendants.

**Predictable collision guard.** A collision in CSS is a violation of the Module Ownership contract. If two modules' styles conflict, it means they didn't grep for the prefix before implementation. The same contract that prevents ID collisions in JS prevents selector collisions in CSS.

## Defaults and Exceptions

The guidelines use "avoid," "prefer," and "where possible" to signal defaults. A default is not a suggestion — it is the expected behavior in the common case. Taking an exception requires a stated reason.

Valid reasons for exceptions:
- The alternative violates a higher-priority rule.
- The platform or browser imposes a constraint that makes the default inapplicable.
- The specific context has been discussed and an exception approved.

Invalid reasons:
- "It felt right."
- "It was easier."
- "The other approach also works."

When taking an exception, comment the code stating which default is overridden and why. This prevents a future reader from "fixing" the code back to the default and breaking the design.

## Adopting the Doctrine

The guidelines are the canonical doctrine. They are not a project-specific document with transfer notes — they are the standard, and individual projects overlay their own decisions on top.

**The doctrine** — principles, patterns, language rules, formatting, and comments policy — applies to any vanilla JS browser application without modification. The examples in `code-guidelines.md` are drawn from real projects (anatomy tools, quiz systems, interactive maps). They illustrate the rules; they are not requirements. A dental scheduling app, a commodity trading dashboard, and a medical reference tool all follow the same Fail-Safe, Shared Key, and Event Delegation rules — with different domain vocabulary, different data shapes, and different UI concerns.

**Project overlays** handle decisions that vary by project:
- Directory names and structure (app/dev separation is doctrine; specific directory names are overlay)
- Asset management strategy (service worker precache, build tool manifests, or neither)
- Typography (system font stacks are the default; brand typefaces are an overlay decision)
- Minimum target viewport width (320px is typical; the project spec may set a different floor)
- Theming (light/dark is doctrine when theming is needed; whether theming is needed is a project decision)
- Color system (CSS custom properties for all colors is a strong default; a two-color utility app may not need the indirection)

A project overlay is a separate file — not a fork of the doctrine. The PRI Pelvis Restoration study tool uses [`prd/project.md`](prd/project.md) as its overlay — directory structure, asset rules, content authority, and architecture decisions live there. The doctrine evolves; overlays track project-specific decisions that the doctrine intentionally leaves open. When the overlay contradicts the doctrine, the overlay must state which rule it overrides and why, per §Defaults and Exceptions.
