# Code Guidelines

Standards for web application development. Vanilla JavaScript, no frameworks, no build tools.

These guidelines derive from [Code Guidelines for Rich Internet Application Development](https://web.archive.org/web/20240805191807/http://jibbering.com/faq/notes/code-guidelines/) by Garrett Smith et al.

---

## HTML

- Valid markup. Code that uses malformed HTML is expecting nonstandard behavior. When a browser encounters an HTML error it performs proprietary error correction, producing a DOM that differs from what the code expects.
- Semantic elements: headings, nav, section, article — not generic divs. ARIA roles where semantics fall short.
- Keep the DOM light. Do not add div or span unless structurally necessary.
- No inline styles except those set dynamically by JS at runtime.
- No self-closing slash where end tag is forbidden (`<img>` not `<img />`).
- No `javascript:` pseudo-protocol.
- No inline event handler attributes (`onclick`, `onchange`, etc.).

## CSS

### Organization
- External stylesheets only. No inline `<style>` blocks.
- Separate structure from components (e.g., `layout.css` and `components.css`).
- One declaration per line, opening brace on selector line, one blank line between rules.

### Naming
- Class and id selectors must have semantic meaning. `.redButton` is meaningless; `.errorAction` represents a state. See: [Use class with semantics in mind](https://www.w3.org/QA/Tips/goodclassnames).
- Use unambiguous names from the project's ubiquitous language: `activeTab`, `activeSubtab` — not `.active`.

### Colors
- All colors via CSS custom properties. Never hardcode hex or rgb in rules.
- Define the palette on `:root`. Override in `@media (prefers-color-scheme: dark)` for dark mode.

### Typography
- System font stacks. No CDN fonts, no Google Fonts.
- Scalable font sizes using `clamp()`. Define a font scale as custom properties on `:root` and use those variables for all `font-size` declarations. No fixed `px` or bare `rem` font sizes in rules.
- In CSS functions like `rgb()`, include a single space after each comma.

### Responsiveness
- Mobile-first. Base styles target small screens; widen with `min-width` media queries.
- Images: `max-width: 100%; height: auto`. Overlay positioning uses percentages.
- No layout element should require horizontal scrolling on a 320px-wide viewport.
- Test both orientations.

### Theme
- Light/dark via `prefers-color-scheme`. Define light as `:root` default, dark in the media query. No manual toggle unless the project spec requires one.

## JavaScript

### Modules
- `<script type="module">` — strict mode by default.
- ES modules with explicit exports. Do not use the IIFE module pattern inside ES modules.
- Constants: `UPPER_SNAKE_CASE`. Functions/variables: `camelCase`. Classes: `PascalCase`.
- Boolean names prefixed: `is`/`has`/`does`/`can`.

### Variables and Scope
- Declare variables in the narrowest possible scope. Never global.
- Always use `const` or `let`. No assignment to undeclared identifiers.
- Give each identifier a meaningful name from the project's ubiquitous language.

### Functions
- Single responsibility. Avoid methods that do too much or have side effects.
- Short parameter lists.
- Consistent return types.
- Test the happy path and the sad path.
- Consider refactoring conditionals to dynamic dispatch or function redefinition.

### DOM

- **Do not traverse the DOM on page load.** Do not loop through elements to apply styles or attach listeners.
- **Event delegation.** Attach handlers to a common ancestor and inspect `event.target`. Replace loops that add callbacks to individual elements.
- **Ancestor class for batch styles.** To style a group of descendants, add a class to the nearest common ancestor. Define the CSS rule as `.state-class .descendant-class`. Never loop through descendants to set `element.style`.
- **Active Object pattern for exclusive-active state** (tabs, selections, panels): hold a reference to the currently active element. On switch, deactivate it directly, then activate the new one. Never `querySelectorAll` to scan and remove a class from every sibling.
- **Favor source HTML over JS-generated markup.** When creating elements dynamically, use `createElement`. In loops, create one element as a prototype, then `cloneNode`.
- `textContent` over `innerHTML`. Use `innerHTML` only when inserting HTML structure.

### Error Boundaries

All fallible operations must be guarded. Unhandled exceptions break the app silently.

1. **`fetch()`** — Must be inside `try/catch` (if awaited) or have `.catch()`. The response status must also be checked; `fetch` does not reject on HTTP errors.
   ```javascript
   try {
     const response = await fetch(url);
     if (!response.ok) {
       throw new Error(`${response.status} ${response.statusText}`);
     }
     const data = await response.json();
   } catch (err) {
     // handle: user feedback, log, degrade gracefully
   }
   ```

2. **`JSON.parse()`** — Must be inside `try/catch`.

3. **`querySelector` / `getElementById` used as a reference** — If the result is chained (property access, method call), guard against `null`.
   ```javascript
   const panel = document.querySelector('.detail-panel');
   if (panel) {
     panel.textContent = name;
   }
   ```

4. **Fire-and-forget async** — Any `async` function called without `await` must have `.catch()` at the call site.

5. **`localStorage` / `sessionStorage`** — Wrap in `try/catch`. Browsers throw in private mode or when quota is exceeded.

6. **General principle** — If an operation can fail at runtime — network, parse, DOM lookup, storage — it needs an explicit failure path. Silent failures are bugs.

### Input Handling
- No form submission on Enter unless that is the intended UX. Prevent default on `keydown` where needed.
- Delegated event listeners only. No inline handler attributes.

### Statements and Operators
- `===` for strict equality. Always use strict equality to compare objects.
- Do not use Boolean coercion on values that may be acceptably falsy (e.g., `if (e.pageX)`). Check with `typeof`: `if (typeof e.pageX === 'number')`.
- Semicolons explicit. Do not rely on ASI.
- Restricted productions (`return`, `throw`, `break`, `continue`, postfix `++`/`--`): the expression must start on the same line as the keyword.
- Do not add a semicolon after a function declaration, block, switch, or try/catch. A semicolon there is an empty statement.

### Strings
- Efficient concatenation. Do not repeatedly create and discard temporary strings.

### Regular Expressions
- Prefer simple expressions. Anchor where needed to avoid false matches.
- Test success and failure cases.

### Comments
- Let the code speak for itself. Avoid comments likely to become obsolete.
- Explain *why*, not *what*.
- Comments must never contain inaccurate statements or terminology.
- No decorative banner comments (`═══`, `───`, `****`). Use code structure instead.
