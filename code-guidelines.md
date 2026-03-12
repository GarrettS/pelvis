# Code Guidelines

Standards for web application development. Vanilla JavaScript, no frameworks, no build tools.

Baseline authorities: [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html), [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html), and [Code Guidelines for Rich Internet Application Development](https://web.archive.org/web/20240805191807/http://jibbering.com/faq/notes/code-guidelines/) by Garrett Smith et al. Where this document is silent, defer to those. Where it speaks, it governs.

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

### Event Delegation

Do not loop through elements to attach event listeners. Attach one handler to a common ancestor and inspect `event.target`. This scales, avoids initialization loops, and works for dynamically added elements.

### Active Object

For exclusive-active state (tabs, selections, panels): hold a reference to the currently active element. On switch, deactivate it directly, then activate the new one. Never `querySelectorAll` to scan siblings and remove a class.

### Ancestor Class for Batch Styles

To style a group of descendants, add a class to the nearest common ancestor. Define the CSS rule as `.state-class .descendant-class`. Never loop through descendants to set `element.style`.

### DOM-Light

Favor source HTML over JS-generated markup. Keep the DOM to the simplest semantic structure necessary — more markup means more bytes, more parsing, and a larger tree for scripts to traverse. When creating elements dynamically, use `createElement`. In loops, create one element as a prototype, then `cloneNode`.

### Single Responsibility

Functions do one thing. Consistent return types. Test the happy path and the sad path. Consider refactoring conditionals to dynamic dispatch or function redefinition.

### Short Parameter Lists

Three or fewer parameters per function. When a function needs more context, pass a single options object with named properties. This eliminates ordering bugs and makes call sites self-documenting.

### Directory Structure

App code lives in designated directories: `scripts/` for JS modules, `css/` for domain stylesheets, `data/` for JSON data files, `img/` for image assets. Dev tools — coordinate pickers, data generators, debug utilities — belong in `tools/`, not in the project root. The project root contains only files that must be there: `index.html`, `sw.js` (browser scope constraint), `layout.css` (shared across all tabs), and project documentation.

### Explicit Asset Lists

When code enumerates project assets — service worker precache manifests, build tool file lists, resource loaders — each entry must be individually justified by an *app* code reference: `index.html`, a JS module in `scripts/`, or a JSON data file in `data/`. Dev tools (`tools/`) and PRD documents are not app code; a reference from a dev tool does not justify inclusion in an asset list. Never glob-include a directory or add files carte blanche. An asset list is a contract: every entry is used by the running app, every app-used asset is listed. When files are added or removed from the project, update asset lists in the same commit.

### Module Cohesion

Each module owns one domain concept. Name the module after what it does: `quiz.js`, `flashcards.js`, `navigation.js`. If the name describes a role instead of a domain concept, it is a junk drawer — `utils.js`, `helpers.js`, `tools.js`, `misc.js`, `common.js` are common examples, but any name that could apply to any project instead of *this* project violates the principle. If a function does not belong in an existing module, create a new module with a specific name. When a module grows to cover multiple concerns, split it.

---

## HTML

- Valid markup. Code that uses malformed HTML is expecting nonstandard behavior. When a browser encounters an HTML error it performs proprietary error correction, producing a DOM that differs from what the code expects.
- Semantic elements: headings, nav, section, article — not generic divs. Nav lists, not buttons. ARIA roles where semantics fall short. Lowercase tags, quoted attributes.
- No inline styles except those set dynamically by JS at runtime.
- No self-closing slash where end tag is forbidden (`<img>` not `<img />`).
- No `javascript:` pseudo-protocol.
- No inline event handler attributes (`onclick`, `onchange`, etc.).

## CSS

- External stylesheets only. No inline `<style>` blocks.
- Separate structure from domain styles (e.g., `layout.css` for shared primitives; `css/<domain>.css` for each module).
- One declaration per line, opening brace on selector line, one blank line between rules.
- Class and id selectors must have semantic meaning. `.redButton` is meaningless; `.errorAction` represents a state. See: [Use class with semantics in mind](https://www.w3.org/QA/Tips/goodclassnames). Use unambiguous names from the project's ubiquitous language: `activeTab`, `activeSubtab` — not `.active`.
- All colors via CSS custom properties. Never hardcode hex or rgb in rules. Define the palette on `:root`; override in `@media (prefers-color-scheme: dark)`.
- System font stacks. No CDN fonts, no Google Fonts. Scalable font sizes using `clamp()` — define a font scale as custom properties on `:root` and use those for all `font-size` declarations. No fixed `px` or bare `rem` font sizes in rules.
- In CSS functions like `rgb()`, include a single space after each comma.
- Mobile-first. Base styles target small screens; widen with `min-width` media queries. Images: `max-width: 100%; height: auto`. Overlay positioning uses percentages. No layout element should require horizontal scrolling on a 320px-wide viewport.
- Light/dark theme via `prefers-color-scheme`. Define light as `:root` default, dark in the media query. No manual toggle unless the project spec requires one.

## JavaScript

- `<script type="module">` — strict mode by default. ES modules with explicit exports. Do not use the IIFE module pattern inside ES modules.
- Constants: `UPPER_SNAKE_CASE`. Functions/variables: `camelCase`. Classes: `PascalCase`. Booleans prefixed: `is`/`has`/`does`/`can`.
- Declare variables in the narrowest possible scope. Always use `const` or `let`. No assignment to undeclared identifiers. Give each identifier a meaningful name from the project's ubiquitous language.
- `textContent` over `innerHTML`. Use `innerHTML` only when inserting HTML structure.
- No form submission on Enter unless that is the intended UX. Prevent default on `keydown` where needed.
- `===` for strict equality. Always use strict equality to compare objects.
- Do not use Boolean coercion on values that may be acceptably falsy (e.g., `if (e.pageX)`). Use `typeof`: `if (typeof e.pageX === 'number')`.
- Semicolons explicit. Do not rely on ASI. Restricted productions (`return`, `throw`, `break`, `continue`, postfix `++`/`--`): the expression must start on the same line as the keyword. Do not add a semicolon after a function declaration, block, switch, or try/catch — a semicolon there is an empty statement.
- Efficient string concatenation. Do not repeatedly create and discard temporary strings. In loops, avoid long chains of identifiers — assign to a variable.
- Prefer simple regular expressions. Anchor where needed to avoid false matches. Test success and failure cases.
- Let the code speak for itself. Comments explain *why*, not *what*. Avoid comments likely to become obsolete. No decorative banner comments (`═══`, `───`, `****`) — use code structure instead.
