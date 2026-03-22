# Proposed Code Guidelines Additions

Additions derived from visual-polish refactoring. Each section names the
insertion point in the canonical `code-guidelines.md`.

---

## 1. New Design Principle: Design Tokens

> Insert after **Explicit Asset Lists** (before the `---` that opens Patterns).

### Design Tokens

**Repeated values are named once.** When a CSS value — color, duration, shadow,
spacing step, font stack — appears in more than one rule, define it as a custom
property on `:root`. Reference the token everywhere; never hardcode the raw
value outside `:root`.

This is the CSS form of "no magic numbers." A hardcoded `0.12s` in twelve
files is twelve places to update and twelve chances to drift. A token
`--dur-fast: 120ms` is one.

**Name tokens by role, not by value.** Use a tiered scale that communicates
intent: `--dur-fast` / `--dur-normal`, `--box-shadow-sm` / `--box-shadow-md`.
The name describes where the token sits on a severity or size axis. The
concrete value can change without renaming, and a reader understands the
intent without inspecting the value.

❌ Named by value — the name becomes a lie when the value changes:
```css
--shadow-2px: 0 2px 6px rgba(0, 0, 0, 0.15);
--duration-120: 120ms;
```

✅ Named by role — stable across value changes:
```css
--box-shadow-sm: 0 0.05rem 0.15rem rgba(0, 0, 0, 0.06);
--dur-fast: 120ms;
```

**Dark mode is a token concern.** Define both light and dark values for every
token in the same file — light on `:root`, dark in
`@media (prefers-color-scheme: dark)`. Components consume tokens; they never
need their own dark-mode media query. If a component needs a dark-mode
override, a token is missing.

---

## 2. Additions to Language Rules > CSS

> Append to the existing CSS bullet list (after the current last bullet about
> light/dark theme).

- **Unit conventions.** `px` for borders — sub-pixel borders render poorly in
  fractional units. `rem` for padding, margin, gap, border-radius, and
  box-shadow — these scale with the root font-size and stay proportional to
  the containers they belong to. `clamp()` custom properties for font sizes
  (already stated above). Do not mix: a `rem`-padded, `rem`-radiused card with
  a `px` shadow is a unit mismatch that scales unevenly.

- **Transition consolidation.** When multiple properties in a `transition`
  declaration share the same duration and timing function, use `all` instead of
  enumerating each property. Listing three properties with identical timings
  restates the same value three times.

  ❌ Same duration repeated per property:
  ```css
  transition: border-color var(--dur-fast),
    background var(--dur-fast),
    color var(--dur-fast);
  ```

  ✅ Consolidated:
  ```css
  transition: all var(--dur-fast);
  ```

  Use individual properties only when they need *different* durations or timing
  functions.

- **Defensive selectors.** Do not use positional pseudo-classes (`:last-child`,
  `:first-of-type`, `:nth-last-child`) on containers where JavaScript adds or
  removes children. The selector breaks silently when the child count changes.
  Pin to a known structural position with `:nth-child(n)`, or use a class.

  ❌ Breaks when JS appends a sibling:
  ```css
  .card > span:last-child { color: var(--text-dim); }
  ```

  ✅ Stable regardless of dynamic children:
  ```css
  .card > span:nth-child(2) { color: var(--text-dim); }
  ```

---

## 3. Addition to Shared Key

> Append as a new bullet under the existing **Shared Key** list.

- **ID or class, not both.** When an element is a singleton addressed by
  `getElementById`, do not also give it a class that serves the same
  selector role. An `id` already uniquely selects the element in both CSS
  and JS. A class that duplicates it is a second name for the same thing —
  two selectors to maintain, two names a reader must reconcile.

---

## 4. Clarification to Fail-Safe

> Insert after the existing intentional-degradation paragraph in **Fail-Safe**
> (after "Comment the code stating what is degraded and why.").

**User-initiated vs. background operations.** The visibility requirement
applies to operations the user triggered or whose outcome the user expects.
When the app performs a background enhancement — opportunistic state
persistence, prefetching, analytics — the user did not ask for it and does
not know it exists. If a background operation fails, alerting the user that
something they never requested has broken is noise, not transparency. Silent
degradation is the correct response: the feature that depends on the
enhancement works without it, and the failure is invisible.

The distinction is intent:
- **User-initiated** — the user clicked Save, submitted a form, requested
  data. Failure must be visible.
- **Background enhancement** — the app opportunistically persists state,
  preloads data, or caches a result to improve a future interaction. Failure
  is silent. Comment the code stating what is degraded and why.

```javascript
function trySave(progress) {
  try {
    localStorage.setItem(STORAGE_KEY,
      JSON.stringify(progress));
  } catch (e) {
    // Background save — not user-initiated, no alert.
    // Quiz functions without persistence; user loses
    // streak data only.
  }
}
```

**Comment the empty catch.** An empty or suppressing `catch` block looks like
a mistake — a reader or linter will assume the error was swallowed
accidentally. A comment in the body states that the suppression is
deliberate and explains what degrades. Without the comment, the next
developer adds error handling that alerts the user about a background
failure they never needed to see. Use a specific name for the error
parameter when the error type can be determined.

---

## 5. Addition to Comments

> Append to the existing **Comments** section (after the bullet about
> convention violations).

- A comment *is* warranted in a `catch` block that intentionally suppresses
  an error. State what operation failed, why the failure is acceptable, and
  what the user loses. An empty `catch` body without a comment is
  indistinguishable from a bug.
