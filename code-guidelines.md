# Code Guidelines

Standards for web application development. Vanilla JavaScript, no frameworks, no build tools.

Baseline authorities for formatting: [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html), [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html), and [Code Guidelines for Rich Internet Application Development](https://web.archive.org/web/20240805191807/http://jibbering.com/faq/notes/code-guidelines/) by Garrett Smith et al. The Formatting section below overrides and extends those guides. Where both this document and the Formatting section are silent, defer to the baseline authorities.

---

## Design Principles

These principles govern judgment calls. They are not suggestions.

### Fail-Safe

Bad things happen at runtime: networks drop, APIs return garbage, users enter nonsense, browsers block storage. Every operation that can fail must have an explicit failure path. Silent failures are bugs. Unhandled throws are crashes.

Fail-safe code is defensive programming: it tests for failure paths and handles them. Code that throws on failure is not fail-safe — it fails by throwing runtime errors, then leaves the app in a broken state where it will throw more. A helper that checks `response.ok` and throws looks safe at a glance. It is not. It moves the problem up the stack and calls it a solution. The caller still crashes if it does not catch, and `console.error` in a `catch` block is not handling — the user sees nothing; the app is broken.

Returning `null`, `undefined`, or an empty value from a failed operation is the same problem in different clothes. The failure is still silent — the user sees nothing, the app is in a broken state, and the problem is delegated to whatever calls the function. The caller must now check for `null`, and if it does not, the app breaks downstream. This is not handling. This is hiding.

**Every failure path must include user-visible feedback.** The user must know something went wrong and what to do about it. "Handling" means the user sees a message, a retry option, a fallback, or a graceful degradation — not that the code swallowed the error and returned a sentinel value.

**Do not throw errors in production code.** Do not return null/undefined as a silent failure signal. Handle failures where they are caught, with a user-visible response.

**When writing a failure path, present the failure scenario and handling options to the person directing the work.** State what can fail, what the consequence is, and list contextual options. Do not pick a strategy silently.

**Two categories of failure must be addressed:**
- *Runtime failures* — network errors, parse failures, storage quota exceeded, missing resources. Catch at the source. Do not let upstream failures cascade into downstream reference errors.
- *User errors* — invalid input, out-of-range values, malformed data. Validate, give clear feedback, do not proceed with bad data.

Specific operations that require guarded handling:
- `fetch()` — network errors and HTTP error status. Both paths need a user-visible response.
  ```javascript
  try {
    const response = await fetch(url);
    if (!response.ok) {
      showError('Could not load quiz data. Check your connection.');
      return;
    }
    const data = await response.json();
    renderQuiz(data);
  } catch (err) {
    showError('Could not load quiz data. Check your connection.');
  }
  ```
- `JSON.parse()` — malformed data must not crash the app.
- `localStorage` / `sessionStorage` — browsers throw in private mode or when quota is exceeded.
- Fire-and-forget async — any `async` function called without `await` must have `.catch()` at the call site.

### Single Responsibility

Functions do one thing. Consistent return types. Test the happy path and the sad path. Consider refactoring conditionals to dynamic dispatch or function redefinition.

### Short Parameter Lists

Three or fewer parameters per function. When a function needs more context, pass a single options object with named properties. This eliminates ordering bugs and makes call sites self-documenting.

### Module Cohesion

Each module owns one domain concept. Name the module after what it does: `quiz.js`, `flashcards.js`, `navigation.js`. If the name describes a role instead of a domain concept, it is a junk drawer — `utils.js`, `helpers.js`, `tools.js`, `misc.js`, `common.js` are common examples, but any name that could apply to any project instead of *this* project violates the principle. If a function does not belong in an existing module, create a new module with a specific name. When a module grows to cover multiple concerns, split it.

### DOM-Light

Favor source HTML over JS-generated markup. Keep the DOM to the simplest semantic structure necessary — more markup means more bytes, more parsing, and a larger tree for scripts to traverse. When creating elements dynamically, use `createElement`. In loops, create one element as a prototype, then `cloneNode`.

### Directory Structure

Separate app code from dev tools. App code lives in designated directories by type (scripts, styles, data, assets). Dev tools live in their own directory, not mixed with app code. The project root contains only files that must be there (entry HTML, files with browser scope constraints) and project documentation.

### Progressive Enhancement

Use progressive enhancement sparingly, and generally avoid polyfills. Degrade gracefully; don't try hamfisted approaches to force it to work in all browsers.

### Explicit Asset Lists

When code enumerates project assets — precache manifests, build tool file lists, resource loaders — each entry must be individually justified by an app code reference. Dev tools and documentation are not app code; a reference from a dev tool does not justify inclusion in an asset list. Never glob-include a directory. An asset list is a contract: every entry is used by the running app, every app-used asset is listed. When files are added or removed, update asset lists in the same commit.

---

## Patterns

Implementation patterns for DOM-heavy vanilla JS applications.

### Event Delegation

Do not loop through elements to attach event listeners. Attach one handler to a common ancestor and inspect `event.target`. This scales, avoids initialization loops, and works for dynamically added elements.

Attach listeners once. Never place `addEventListener` in a function that can be called more than once — listeners accumulate (there is no `replaceEventListener`). Separate one-time initialization (DOM refs, listeners) from repeatable actions (reset state, re-render). `init` may call `reset`; `reset` must never call `init`.

Do not eagerly cache DOM refs into a lookup object. `getElementById` is a hash lookup — effectively free. Caching adds a sync burden (HTML changes require updating the cache) and initialization cost for elements the user may never interact with. Look up elements at point of use.

### Active Object

For exclusive-active state (tabs, selections, panels): hold a reference to the currently active element. On switch, deactivate it directly, then activate the new one. Never `querySelectorAll` to scan siblings and remove a class.

### Shared Key

When a data record and a DOM element represent the same entity, give them the same `id`. This single key indexes both — data by object property, DOM by `getElementById`. Do not search either collection for a known key.

- **Data format**: structure JSON as a keyed object (`{"item-foo": {...}}`) instead of an array of objects with `id` fields (`[{"id": "foo", ...}]`). When data is looked up by key, the source format should be keyed — no runtime indexing step needed.
- **Namespaced keys**: prefix keys with the module name (e.g. `item-`). This makes the key unique across the DOM, self-documenting (which module owns it), and greppable across all layers without false matches.
- **DOM side**: use the namespaced key as the element's `id` attribute. Lookup is `getElementById(id)`. Related elements use convention-based suffixes (e.g. `id + "-detail"`), each directly addressable.
- **One key across all layers**: the same string appears in JSON keys, element `id` attributes, SVG element `id` attributes, and JS lookups. No translation between layers.
- **Access pattern (getById)**: event delegation derives the key from the target element's `id`, then addresses both data (`map[id]`) and DOM (`getElementById(id)`) directly. When construction is expensive, use create-on-first-access: `pool[id] || (pool[id] = create(id))`.
- **Antipattern**: `.find(item => item.id === id)`, `querySelector('[data-id="' + id + '"]')` — linear scans for a known key.

### Ancestor Class for Batch Styles

To style a group of descendants, add a class to the nearest common ancestor. Define the CSS rule as `.state-class .descendant-class`. Never loop through descendants to set `element.style`.

### Inline Styles in Scripts

Avoid inline styles — use CSS classes. When dynamic inline styles cannot be avoided (e.g. computed positions), assign multiple values via `element.style.cssText` rather than setting individual `style` properties one at a time.

### CSS over JS for State Presentation

Use CSS for visual state changes wherever possible. Prefer `:hover`, `:focus`, `:not(.class)`, and `pointer-events` over JS event handlers (`mouseenter`/`mouseleave`) and programmatic `disabled` toggling. If CSS can express the rule, JS should not be involved.

### `hidden` Attribute for Visibility

Use the native `hidden` attribute for show/hide toggling instead of `style.display`. It is semantic, works without knowing the element's display type, and is removable with `el.hidden = false`.

### Extract Shared Logic

When two or more code blocks follow the same structure but differ in specific values or operations, extract the shared structure into a function parameterized by the varying parts. Pass data for values that differ; pass a function for operations that differ. This applies to DOM construction, string building, iteration — any structural duplication. The extracted function encapsulates *structure*; the caller supplies *what varies*.

### Dispatch Table

When a chain of conditionals maps a value to an action, replace it with a keyed object. The table makes the mapping visible at a glance, is trivial to extend, and separates routing from logic.

### Compose Method

A long function should read as a sequence of named steps at the same level of abstraction. Extract each step into a function whose name describes *what* it does. The original function becomes a table of contents — readable top-down without scrolling into implementation.

### Decompose Conditional

When a boolean expression is complex, extract it into a named variable or function that reads as intent. The name replaces the logic, making the condition's purpose obvious at the call site.

### Template and cloneNode

When creating multiple similar elements in a loop, build one template element outside the loop with shared attributes and classes, then `cloneNode(false)` inside the loop and set only the per-instance values. Avoids redundant `createElement` / `setAttribute` / `classList.add` calls per iteration.

---

## Formatting

### General

- Line length: target 80 columns, 90 maximum. Break long concatenation and conditionals across lines.

### HTML

- Lowercase tags, quoted attributes.
- No self-closing slash where end tag is forbidden (`<img>` not `<img />`).

### CSS

- External stylesheets only. No inline `<style>` blocks.
- One declaration per line, opening brace on selector line, one blank line between rules.
- Space after the colon in property declarations: `margin: 0` not `margin:0`.
- In CSS functions like `rgb()`, include a single space after each comma.

### JavaScript

- Semicolons explicit. Do not rely on ASI. Restricted productions (`return`, `throw`, `break`, `continue`, postfix `++`/`--`): the expression must start on the same line as the keyword. Do not add a semicolon after a function declaration, block, switch, or try/catch — a semicolon there is an empty statement.
- Use template literals for large multi-line HTML/SVG builders. Use concatenation for short one-liners.

---

## Language Rules

Semantic and behavioral rules. Where these overlap with the baseline authorities, this document governs.

### HTML

- Valid markup. Code that uses malformed HTML is expecting nonstandard behavior. When a browser encounters an HTML error it performs proprietary error correction, producing a DOM that differs from what the code expects.
- Semantic elements: headings, nav, section, article — not generic divs. Nav lists, not buttons. ARIA roles where semantics fall short.
- No inline styles except those set dynamically by JS at runtime.
- No `javascript:` pseudo-protocol.
- No inline event handler attributes (`onclick`, `onchange`, etc.).

### CSS

- Separate structure from domain styles (e.g., `layout.css` for shared primitives; `css/<domain>.css` for each module).
- Class and id selectors must have semantic meaning. `.redButton` is meaningless; `.errorAction` represents a state. See: [Use class with semantics in mind](https://www.w3.org/QA/Tips/goodclassnames). Use unambiguous names from the project's ubiquitous language: `activeTab`, `activeSubtab` — not `.active`.
- Modular CSS: each file groups conceptually-related functionality, does one thing, and minimizes dependence on other CSS files.
- All colors via CSS custom properties. Never hardcode hex or rgb in rules. Define custom properties on `:root` in the CSS file that owns the concept. If a dark mode override is needed, define it in `@media (prefers-color-scheme: dark)` in the same file.
- System font stacks. No CDN fonts, no Google Fonts. Scalable font sizes using `clamp()` — define a font scale as custom properties on `:root` and use those for all `font-size` declarations. No fixed `px` or bare `rem` font sizes in rules.
- Mobile-first. Base styles target small screens; widen with `min-width` media queries. Images: `max-width: 100%; height: auto`. Overlay positioning uses percentages. No layout element should require horizontal scrolling on a 320px-wide viewport.
- Light/dark theme via `prefers-color-scheme`. Define light as `:root` default, dark in the media query. No manual toggle unless the project spec requires one.

### JavaScript

- `<script type="module">` — strict mode by default. ES modules with explicit exports. Do not wrap an entire module body in an IIFE — the module already provides scope. IIFEs remain useful for creating closures within a module (e.g. binding private state to a function).
- Function declarations for named module-level functions (hoisted, readable top-down). Use arrow functions instead of anonymous function expressions when context (`this`) doesn't matter, for brevity. When an event handler needs to reference the element it is attached to, use a function expression (not an arrow) so `this` is bound to the element by `addEventListener`.
- Constants: `UPPER_SNAKE_CASE`. Functions/variables: `camelCase`. Classes: `PascalCase`. Booleans prefixed: `is`/`has`/`does`/`can`.
- Event handler functions: `[object][EventName]Handler` (e.g. `itemClickHandler`, `formSubmitHandler`). Functions that process results but do not receive an event object are not handlers — name them by what they do (e.g. `validateInput`, `saveRecord`).
- Declare variables in the narrowest possible scope. Always use `const` or `let`. No assignment to undeclared identifiers. Give each identifier a meaningful name from the project's ubiquitous language.
- Guard clauses: use early `return` to reject invalid state at the top of a function rather than wrapping the body in a conditional. Always follow a guard clause with a blank line so the pattern stands out visually.
  ```javascript
  function update(id) {
    if (!id) return;

    // function body
  }
  ```
- `textContent` over `innerHTML`. Use `innerHTML` only when inserting HTML structure.
- No form submission on Enter unless that is the intended UX. Prevent default on `keydown` where needed.
- `===` for strict equality. Always use strict equality to compare objects.
- Do not use Boolean coercion on values that may be acceptably falsy (e.g., `if (e.pageX)`). Use `typeof`: `if (typeof e.pageX === 'number')`.
- Efficient string concatenation. Do not repeatedly create and discard temporary strings. Do not `+=` in a loop — each iteration creates and discards an intermediate string. Use `.join()` to build repeated markup; use `.map()` + `.join('')` when each item needs distinct attributes.

  Wrong — `+=` in a loop creates n intermediate strings:
  ```javascript
  let html = '<ul>';
  items.forEach((item) => { html += '<li>' + item + '</li>'; });
  html += '</ul>';
  ```

  Right — uniform items: join with delimiter (guard empty case):
  ```javascript
  if (items.length) {
    el.innerHTML = '<ul><li>' + items.join('</li><li>') + '</li></ul>';
  }
  ```

  Right — per-item attributes: map + join:
  ```javascript
  el.innerHTML = items.map((item) =>
    '<div data-id="' + item.id + '">' + item.name + '</div>'
  ).join('');
  ```
- Prefer simple regular expressions. Anchor where needed to avoid false matches. Test success and failure cases.

---

## Comments

Comments are a failure of the code to explain itself. When one is necessary, it should justify its existence.

- Comments explain *why*, not *what*. If the comment restates the code, delete it.
- Avoid comments likely to become obsolete. A comment that drifts from the code it describes is worse than no comment.
- No decorative banner or landmark comments (`═══`, `───`, `****`, `/* ── Section ── */`). Use code structure — function names, module boundaries, blank lines — to communicate organization.
- A comment *is* warranted when code intentionally violates a project convention. State the violation, why it exists, and how it is handled instead. Without this, a future reader will "fix" the code back to the convention and break the design.
- Remove dead comments. Commented-out code, obsolete TODOs, and notes that no longer apply are clutter. They mislead readers and accumulate. If the code is gone, the comment goes with it. Version control preserves history — the comment does not need to.

---

## Version Control

- Atomic commits: one logical, cohesive change per commit. A commit should do one thing and do it completely — all files affected by that change, nothing unrelated.
