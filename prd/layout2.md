# Layout Refactoring — pri-unified.html

**Every section in this document is mandatory. Do not skip, partially implement, or defer any section. After completing all sections, run the verification commands in CLEANUP. If any check fails, fix it before finishing.**

Do not modify data objects or content text.

---

## 1. CODE STYLE

Follow Google CSS style guide: one declaration per line, opening brace on same line as selector, one blank line between rules. Follow Google HTML style guide: semantic elements, lowercase, quoted attributes. Reformat any code you touch to match. Do not leave single-line CSS rule blocks.

---

## 2. CSS ORGANIZATION

Extract all CSS from the inline `<style>` tag into two external files:

- **layout.css** — design tokens, reset, nav, grid, `main`, tab/subtab/subview structure, spacing, responsive breakpoints, utility classes
- **components.css** — cards, callouts, flashcards, equivalence, decoder, decision tree, hotspots, concept map, AIC diagram, case study, quiz, muscle map, search, layer walkthrough

Link both in `<head>`. Remove the inline `<style>` block entirely. No CSS should remain inline in the HTML file except `style=` attributes dynamically set by JavaScript at runtime.

---

## 3. SEMANTIC HTML

- Replace all `.section-title` `<div>` elements with `<h2>` for tab-level headings, `<h3>` for subtab-level headings. Keep existing classes on these elements for styling.
- Replace all `.subsection-title` `<div>` elements with `<h4>`. Keep existing classes.
- Add `role="tablist"` to the nav tabs container, each `.subtab-row`, and each `.subview-tabs` container.
- Add `role="tab"` to all tab, subtab, and subview navigation items.
- Add `role="tabpanel"` and `aria-labelledby` to subtab and subview content areas.

---

## 4. NAV STRUCTURE

Replace the nav `.nav-tabs` button-based markup with `ul > li > a`. The `<a>` elements get `href` attributes with hash fragments (see section 9).

Do the same for `.subtab-row` and `.subview-tabs` — replace `<button>` elements with `ul > li > a`. Preserve all existing `data-*` attributes, classes, and IDs on the new elements.

---

## 5. NAV VISUAL CONTINUITY

Make the active top-level tab and its subtab row appear as one connected unit:

- The active `.nav-tab` shares `background-color` with `.subtab-row`.
- The border between nav and subtab row is removed or interrupted under the active tab.
- `.subtab-row` is sticky, positioned directly below the nav bar.

---

## 6. SPACING

- Reduce `main` bottom padding from `3rem` to `1.5rem`.
- Reduce `.section-title` margin-bottom from `1.2rem` to `0.75rem`.

---

## 7. MAX-WIDTH

- Remove `max-width:680px` from `.fc-container`.
- Keep `main` max-width at `1160px`.

---

## 8. HEADINGS

Strip the following prefixes from every section heading, leaving only the descriptive text: `1A — `, `1B — `, `2A — `, `2B — `, `2C — `, `3A — `, `3B — `, `3C — `, `3D — `, `4A — `, `4B — `, `4C — `, `4D — `, `4E — `.

Add `<h2 class="section-title">Flashcards</h2>` as the first child inside `<section id="tab-flashcards">`, before `.fc-container`.

Add `<h2 class="section-title">Equivalence Quiz</h2>` as the first child inside `<section id="tab-equivalence">`, before `.decoder-rule`.

---

## 9. NAVIGATION HASH ROUTING

All tab, subtab, and subview navigation uses `<a href="#...">` elements with hash fragments. Hash format: `#tab/subtab/subview` (slashes are legal in URI fragments).

**Remove all `history.pushState`, `history.replaceState`, and `popstate` listener calls from the navigation code.** These are replaced by:

- `<a>` elements with `href="#anatomy/images/lateral"` style hash links.
- A single delegated click listener on each nav container (`nav`, `.subtab-row`, `.subview-tabs`) that calls `preventDefault` and sets `location.hash`.
- A single `hashchange` listener that parses `location.hash` and activates the correct tab, subtab, and subview.
- On initial page load, read `location.hash` and activate accordingly.

The `activateTab` and `activateSubtab` functions handle DOM activation only — they do not accept a `pushState` parameter and do not touch the URL. The caller sets `location.hash`; the `hashchange` listener calls the activate functions.

**Sticky subtab behavior:** When a user navigates away from a tab and returns, the previously active subtab for that tab should be restored. Store last-active subtab per tab in a JS object (not in the URL, not in the History API).

**Decision tree:** Tree expand/collapse state is not represented in the URL. No History API calls for tree interactions.

---

## 10. CONCEPT MAP

Change `#concept-map-svg` height from `400px` to `min(65vh, 600px)`.

---

## 11. HOTSPOTS

- Change `.hotspot` base background from `rgba(26,122,90,.12)` to `transparent`.
- Change the dark-mode `.hotspot` base background from `rgba(58,170,128,.1)` to `transparent`.
- Leave hover and active states unchanged.

---

## 12. JS SELECTOR UPDATE

After changing `<button>` elements to `<a>` / `<li>` elements, update **every** JavaScript `querySelector`, `querySelectorAll`, `closest()`, and event delegation selector that references `button.nav-tab`, `button.subtab`, `button.subview-tab`, or `.subtab-row button` to match the new element types.

Search the entire `<script>` block for `'button'`, `'.nav-tab'`, `'.subtab'`, `'.subview-tab'` and verify each reference matches the new markup.

---

## 13. CLEANUP AND VERIFICATION

After all changes are complete, run each of these commands. If any produces unexpected output, fix the issue before finishing.

```bash
# No CSS in HTML (no <style> tags)
grep -c '<style' pri-unified.html
# Expected: 0

# No heading prefix artifacts
grep -E '"[1-4][A-E] — ' pri-unified.html
# Expected: no output

# No section-title on div elements
grep 'class="section-title"' pri-unified.html | grep -v '<h[2-3]'
# Expected: no output

# No subsection-title on div elements
grep 'class="subsection-title"' pri-unified.html | grep -v '<h4'
# Expected: no output

# No pushState or popstate in JS
grep -E 'pushState|popstate' pri-unified.html
# Expected: no output

# No button references for nav elements in JS
grep -E 'button\.subtab|button\.nav-tab|button\.subview' pri-unified.html
# Expected: no output

# Both CSS files exist and are non-empty
wc -l layout.css components.css
# Expected: both have substantial line counts

# All href hashes in nav use # prefix
grep -E 'href="#' pri-unified.html | head -20
# Expected: hash links like href="#anatomy/images"
```

**If any check fails, fix the issue. Do not finish with failing checks.**