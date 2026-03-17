# CC Task: Merge Key Distinction into Translation Table

## References
Read CC-BUILD-SPEC.md for code standards. Target: `index.html`, Nomenclature tab (`section#tab-nomenclature`).

## Summary

The Nomenclature tab currently has three sub-tabs: Joints, Translation Table, Key Distinction. Key Distinction is a single callout that doesn't justify its own sub-tab. Its content splits into two destinations:

1. The practical acronym-decoder portion moves into Translation Table as a header callout.
2. The philosophical framing moves to a new landing-page section (future task — not part of this prompt).

After this task, Nomenclature has two sub-tabs: **Joints** and **Translation Table**.

---

## Step 1: Remove the Key Distinction sub-tab button

In the `<nav>` markup, find the Nomenclature subtab row. Delete the `<li>` containing the Key Distinction subtab link:

```html
<!-- DELETE THIS ENTIRE <li> -->
<li><a class="subtab" role="tab" data-subtab="nom-keydistinction" href="#nomenclature/keydistinction">Key Distinction</a></li>
```

Do not modify the Joints or Translation Table subtab links.

---

## Step 2: Remove the Key Distinction subtab-content container

Find and delete the entire element:

```html
<div class="subtab-content" id="nom-keydistinction">
  <!-- everything inside -->
</div>
```

---

## Step 3: Add acronym-decoder callout to Translation Table

Inside the `nom-translation` subtab-content, insert a new callout **above** the existing callout and above the search/filter input. This is the first visible element in the Translation Table sub-tab.

```html
<div class="callout" style="margin-bottom:1rem;">
  <p style="margin-bottom:.5rem;"><strong>Reading PRI acronyms:</strong> The first letter names the bone PRI considers the reference point for treatment. The second letter names the bone it moves relative to. IR/ER names the direction.</p>
  <table style="font-size:var(--text-sm);margin:.5rem 0;width:100%;">
    <thead>
      <tr>
        <th>Acronym</th>
        <th>Decode</th>
        <th>Meaning</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="mono">IS</td>
        <td>Ilio-Sacral</td>
        <td>Ilium relative to sacrum — posterior inlet. Target: muscles that move the ilium (glute med, proximal iliacus).</td>
      </tr>
      <tr>
        <td class="mono">SI</td>
        <td>Sacro-Iliac</td>
        <td>Sacrum relative to ilium — posterior outlet. Same joint as IS. Target: muscles that move the sacrum (glute max, coccygeus, piriformis).</td>
      </tr>
      <tr>
        <td class="mono">IP</td>
        <td>Ilio-Pubo</td>
        <td>Ilium relative to pubic symphysis — anterior inlet. Target: muscles that tilt the ilium (rectus femoris, sartorius, iliacus, IO/TA).</td>
      </tr>
      <tr>
        <td class="mono">IsP</td>
        <td>Ischio-Pubo</td>
        <td>Ischium relative to pubic symphysis — anterior outlet. Target: muscles that move the ischium (obturator internus, pelvic floor).</td>
      </tr>
      <tr>
        <td class="mono">AF</td>
        <td>Acetabulo-Femoral</td>
        <td>Pelvis on femur — closed chain (stance leg). Target: reposition pelvis over planted femur.</td>
      </tr>
      <tr>
        <td class="mono">FA</td>
        <td>Femoro-Acetabular</td>
        <td>Femur on pelvis — open chain (swing leg). Target: mobilize femur in the socket.</td>
      </tr>
    </tbody>
  </table>
  <p class="text-dim" style="font-size:var(--text-xs);margin-top:.5rem;">These are treatment-planning codes, not anatomical terms. The same physical joint (e.g., the sacroiliac joint) gets two names (IS and SI) to encode which muscle group to facilitate.</p>
</div>
```

---

## Step 4: Update SUBTAB_MAP in JavaScript

Find the `SUBTAB_MAP` object in the navigation script. Remove the `keydistinction` entry from the `nomenclature` property:

Before:
```javascript
nomenclature: { joints: 'nom-joints', translation: 'nom-translation', keydistinction: 'nom-keydistinction' },
```

After:
```javascript
nomenclature: { joints: 'nom-joints', translation: 'nom-translation' },
```

---

## Step 5: Remove buildKeyInsight() and related code

In the NomenclatureModule (or wherever `buildKeyInsight` is defined):

1. Delete the `buildKeyInsight()` function entirely.
2. Delete the call to `buildKeyInsight()` in the module's `init()` function.
3. Delete `DATA.terminology.keyInsight` if it exists as a standalone data string (search for `keyInsight` in the DATA object).
4. Run dead-code cleanup: search for any remaining references to `keydistinction`, `keyInsight`, `key-distinction`, or `buildKeyInsight`. Delete all.

---

## Step 6: Mobile card layout for decoder table

On screens < 600px, the decoder table in Step 3 should stack as cards, same pattern used by the translation table. Each card shows:

```
[Acronym] — [Decode]
[Meaning]
```

Use the existing mobile card CSS pattern (`.card-stack` or equivalent). If the translation table already has a `@media (max-width: 599px)` rule that hides the `<table>` and shows stacked cards, apply the same pattern to this new table. If it's rendered via JS, add the decoder table to the same render function.

If the translation table uses a static HTML table with CSS-only mobile stacking (e.g., `display:block` on `tr`/`td`), apply the same CSS to this table.

---

## What NOT to change

- Translation table data (`DATA.translationMap` array) — unchanged.
- Translation table rendering, search, filter logic — unchanged.
- Translation table's existing callout text — unchanged (keep it below the new decoder callout).
- Joints sub-tab — unchanged.
- Any other tabs — unchanged.
- CSS custom properties — unchanged.
- Hash routing logic (beyond removing `keydistinction` from SUBTAB_MAP) — unchanged.

---

## Validation

1. Nomenclature tab shows exactly two sub-tabs: Joints, Translation Table.
2. No `keydistinction` sub-tab button exists in the DOM.
3. No `nom-keydistinction` container exists in the DOM.
4. Translation Table opens with the decoder callout visible above the existing callout and search input.
5. Decoder table renders correctly on desktop (table) and mobile < 600px (stacked cards or equivalent).
6. Hash `#nomenclature/translation` navigates to Translation Table. Hash `#nomenclature/keydistinction` falls back to first sub-tab (Joints).
7. No JS errors in console.
8. Search `buildKeyInsight`, `keyInsight`, `keydistinction` in the file — zero results.

### Acceptance Checklist
- [ ] Nomenclature shows exactly 2 sub-tabs: Joints, Translation Table
- [ ] Decoder callout visible above existing callout in Translation Table
- [ ] Desktop: decoder renders as 3-column table
- [ ] Mobile (≤600px): decoder renders as stacked cards
- [ ] `#nomenclature/keydistinction` falls back to Joints (first sub-tab)
- [ ] Search still filters main translation table (decoder unaffected)
- [ ] No JS console errors
- [ ] Zero source hits for `buildKeyInsight`, `keyInsight`, `keydistinction`
