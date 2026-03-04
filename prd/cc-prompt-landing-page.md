# CC Task: Add Landing Page

## References
Read CC-BUILD-SPEC.md for code standards. Target: `index.html`.

## Summary

The app currently defaults to the Anatomy tab when the hash is empty. Add a landing page that displays on first load (empty hash). The landing page introduces the app and frames PRI nomenclature before the user encounters it.

---

## Step 1: Add the landing page section

Insert a new `<section>` as the **first** child of `<main>`, before `<section id="tab-anatomy">`:

```html
<section id="tab-home" class="tab active">
  <div class="tab-section home-landing">

    <h1 style="font-family:var(--mono);font-size:var(--text-2xl);color:var(--accent);margin-bottom:.25rem;">PRI · Pelvis</h1>
    <p class="text-dim" style="margin-bottom:2rem;">Pelvis Restoration exam preparation.</p>

    <div class="callout" style="margin-bottom:2rem;">
      <h2 style="font-family:var(--mono);font-size:var(--text-base);color:var(--text);margin-bottom:.75rem;">Before you start: how PRI names things</h2>

      <p style="margin-bottom:.75rem;">Joints are passive structures. They permit motion; they do not produce it. Muscles produce motion. At any joint, both bones move relative to each other — which one moves more depends on loading, not on the joint itself. There is no inherent "mover" and "fixed bone."</p>

      <p style="margin-bottom:.75rem;">PRI's naming system departs from this. Each acronym (IS, SI, IP, IsP, AF, FA) names a joint by putting one bone first — declaring it the reference point for treatment. IS and SI are the same sacroiliac joint. AF and FA are the same hip joint. The first letter tells you which bone PRI wants you to influence; the second letter is the bone it moves relative to. IR/ER names the direction.</p>

      <p style="margin-bottom:.75rem;">This is treatment-planning shorthand, not biomechanical description. The acronyms encode three things in one label: anatomy (which bones), a clinical frame (which muscle group to facilitate), and position (IR or ER). If you read them as literal mechanics — one bone moves, the other stays put — they will not make sense, because that is not how joints work.</p>

      <p>The <a href="#nomenclature/translation" class="accent-link">Translation Table</a> maps every PRI term to its standard anatomical equivalent with this logic explained.</p>
    </div>

    <h2 style="font-family:var(--mono);font-size:var(--text-base);color:var(--text);margin-bottom:.75rem;">What's in the app</h2>

    <div class="home-nav-grid">
      <a href="#anatomy/anatomize" class="home-nav-card">
        <span class="home-nav-title">Anatomy</span>
        <span class="home-nav-desc">Anatomize This identification game, pelvis decoder, L AIC chain diagram.</span>
      </a>
      <a href="#nomenclature/joints" class="home-nav-card">
        <span class="home-nav-title">Nomenclature</span>
        <span class="home-nav-desc">Pelvic joints, PRI-to-standard translation table.</span>
      </a>
      <a href="#patterns/cheatsheet" class="home-nav-card">
        <span class="home-nav-title">Patterns</span>
        <span class="home-nav-desc">L AIC, B PEC, Patho PEC comparison. Test profiles. Concept map.</span>
      </a>
      <a href="#diagnose/tree" class="home-nav-card">
        <span class="home-nav-title">Diagnose This</span>
        <span class="home-nav-desc">Decision tree, causal chains, case studies, exercise map.</span>
      </a>
      <a href="#flashcards" class="home-nav-card">
        <span class="home-nav-title">Flashcards</span>
        <span class="home-nav-desc">Pre-loaded deck. Tests, concepts, initialisms, muscles, treatment.</span>
      </a>
      <a href="#equivalence" class="home-nav-card">
        <span class="home-nav-title">Equivalence</span>
        <span class="home-nav-desc">Interactive quiz mapping inlet, outlet, and femoral positions.</span>
      </a>
      <a href="#masterquiz" class="home-nav-card">
        <span class="home-nav-title">Master Quiz</span>
        <span class="home-nav-desc">175 questions across all domains. Missed-question prioritization.</span>
      </a>
    </div>

  </div>
</section>
```

Remove the `active` class from `<section id="tab-anatomy">` (it should no longer be the default).

---

## Step 2: Add CSS for the landing page

Add to the existing stylesheet (inside `components.css` or inline `<style>`, whichever is current):

```css
.home-landing {
  max-width: 720px;
  margin: 0 auto;
}

.home-nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: .75rem;
  margin-top: .5rem;
}

.home-nav-card {
  display: flex;
  flex-direction: column;
  gap: .25rem;
  padding: .75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--text);
  transition: border-color .15s, background .15s;
}

.home-nav-card:hover {
  border-color: var(--accent);
  background: var(--surface2);
}

.home-nav-title {
  font-family: var(--mono);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent);
}

.home-nav-desc {
  font-size: var(--text-xs);
  color: var(--text-dim);
  line-height: 1.4;
}

.accent-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.accent-link:hover {
  color: var(--text);
}
```

---

## Step 3: Add "Home" to the nav bar

Add a Home tab as the **first** item in the nav tab list:

```html
<li>
  <a class="nav-tab active" role="tab" data-tab="tab-home" href="#home">PRI · Pelvis</a>
</li>
```

Remove the `active` class from the Anatomy nav-tab link.

The Home tab label is "PRI · Pelvis" (matches the brand). It does not display a subtab row.

---

## Step 4: Update TAB_MAP and hash routing

Add `home` to `TAB_MAP`:

```javascript
const TAB_MAP = {
  home: 'tab-home',
  anatomy: 'tab-anatomy',
  // ... rest unchanged
};
```

Update the empty-hash fallback in `applyHash()`:

Before:
```javascript
if (!tab || !TAB_MAP[tab]) {
  activateTab('tab-anatomy');
  activateFirstSubtab('tab-anatomy');
  return;
}
```

After:
```javascript
if (!tab || !TAB_MAP[tab]) {
  activateTab('tab-home');
  return;
}
```

The home tab has no sub-tabs, so no `activateFirstSubtab` call is needed.

---

## Step 5: Nav card click behavior

The nav cards on the landing page are `<a>` elements with hash hrefs (e.g., `href="#anatomy/anatomize"`). They work via the existing `hashchange` listener — no additional JS needed. Clicking a card navigates to the target tab and subtab.

---

## Step 6: Hide the existing nav-brand

The current `<div class="nav-brand">PRI · Pelvis</div>` in the nav bar is now redundant — the Home tab link serves the same purpose. Remove the `.nav-brand` div. If `.nav-brand` has CSS rules, delete them.

---

## Step 7: Mobile considerations

On screens < 600px, the `.home-nav-grid` should collapse to a single column:

```css
@media (max-width: 599px) {
  .home-nav-grid {
    grid-template-columns: 1fr;
  }
}
```

The callout text should remain readable at 375px. No additional mobile changes needed — the existing `.callout` styles handle padding and font sizing.

---

## What NOT to change

- No changes to any existing tab content.
- No changes to any existing CSS custom properties.
- No changes to any existing sub-tab or subview logic.
- The landing page is static HTML. No JS module, no init function, no data dependencies.

---

## Validation

1. Loading the app with no hash (`garretts.github.io/pelvis`) shows the landing page.
2. Loading with `#home` shows the landing page.
3. Loading with any existing hash (e.g., `#anatomy/anatomize`) goes directly to that tab — does not show landing page.
4. The "PRI · Pelvis" nav tab is highlighted when on the landing page.
5. Clicking any nav card navigates to the correct tab and subtab.
6. The "Translation Table" link in the callout navigates to `#nomenclature/translation`.
7. All seven nav cards render in a grid on desktop, single column on mobile.
8. Light and dark themes render correctly.
9. No JS errors in console.
10. The `.nav-brand` div no longer exists.
