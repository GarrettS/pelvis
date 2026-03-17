# CC Task: Rewrite Nomenclature Tab Content

## References
Read CC-BUILD-SPEC.md for code standards. Target: pri-unified.html, Nomenclature tab (section#tab-nomenclature). After the layout restructure, this tab has three sub-tabs: Joints, Translation Table, Key Distinction.

## Sub-tab 1: Joints (replaces "2A — The Two Real Joints")

### What to remove
Delete the entire `LAYER_DATA` array and `renderLayer()` function from the NomenclatureModule. Delete the layer-panel HTML (the dots, layer-content div). Delete the `.layer-panel`, `.layer-indicator`, `.layer-dot`, `.layer-content`, `.layer-next-btn` CSS rules.

The wizard UI (layer 1 → 2 → 3 with a moving Next button) is replaced by static, scrollable reference content. No wizard, no progressive disclosure, no layers.

### What to build

Replace with a single rendered view titled **"Pelvic Joints"**. Content below. Use semantic HTML with the existing CSS classes (callout, mono, text-dim, text-inlet, text-outlet). No new CSS needed beyond what the app already has.

#### Intro paragraph
```
The pelvis contains five joints. PRI's position-naming system references three of them — the sacroiliac joint, the pubic symphysis, and the hip joint. The other two (lumbosacral and sacrococcygeal) are anatomically present but excluded from PRI's framework because they do not involve innominate displacement.
```

#### Joint Table

Render as a styled table (desktop) / stacked cards (mobile <600px, same 
pattern as translation table). Six columns per joint. Column headers must 
not wrap — use white-space:nowrap on th elements. Set explicit column 
widths via colgroup or th widths to prevent the text-heavy columns from 
collapsing the others:

  Joint: 14%
  Type: 12%
  Motion: 14%
  PRI Positions: 16%
  PRI Role: 28%
  Scope: 16%  (renamed from "Why Included/Excluded" — shorter header, 
               same content, one sentence max per cell)

| Joint | Type | Motion | PRI Positions | PRI Role | Why Included/Excluded |
|-------|------|--------|---------------|----------|----------------------|
| Sacroiliac (SI) | Synovial plane / fibrocartilaginous | Nutation, counter-nutation. A few degrees of rotation. | IS IR/ER (ilium on sacrum), SI IR/ER (sacrum on ilium) | Posterior inlet + posterior outlet. PRI creates two names for this single joint to encode which bone is the treatment target: IS = move the ilium, SI = move the sacrum. | Core joint. 4 of PRI's 12 position codes reference it. |
| Pubic symphysis | Secondary cartilaginous (amphiarthrosis) | Minimal — a few mm of shear and compression during gait, pregnancy, single-leg stance. | IP IR/ER (ilium-to-pubis), IsP IR/ER (ischium-to-pubis) | Anterior inlet + anterior outlet. PRI uses the pubic symphysis as a positional landmark — the midline reference for describing how the ilium (inlet) and ischium (outlet) orient. IP and IsP describe innominate motion relative to this midline, not motion of the symphysis itself. | Positional reference. 4 of PRI's 12 position codes reference it. Despite minimal independent motion, it borders both the inlet and the outlet. |
| Hip (acetabulofemoral) | Synovial ball-and-socket | Large ROM: flexion/extension, abduction/adduction, IR/ER. | AF IR/ER (pelvis on femur), FA IR/ER (femur on pelvis) | PRI splits the standard hip joint into two names. AF = closed chain (stance leg, pelvis moves on planted femur). FA = open chain (swing leg, femur moves on pelvis). Standard anatomy calls both "hip joint motion". | Core joint. 4 of PRI's 12 position codes reference it. AF/FA distinction encodes which bone to target. |
| Lumbosacral (L5-S1) | Intervertebral disc + zygapophyseal facets | Flexion/extension, limited rotation | (none in Pelvis Restoration) | Not named. The psoas and diaphragmatic crura attach here — both are mechanically relevant to the L AIC pattern — but the joint itself involves spinal motion, not innominate displacement. | Excluded. PRI's system describes innominate and sacral motion only. Covered in Myokinematic Restoration and Postural Respiration. |
| Sacrococcygeal | Symphysis (variably fused) | Flexion/extension of coccyx | (none named directly) | Not named. Coccygeus muscle acts here, and coccyx position is implicit in outlet mechanics (SI IR/ER). PRI folds coccygeal motion into the sacrum-on-ilium description rather than isolating it. | Excluded from naming. Functionally present in outlet descriptions. |

#### Below the table: callout box

```
PRI's 12 position codes reference exactly 3 joints. The naming convention encodes which bone is displaced and which to target — not the joint itself. IS and SI are the same physical joint (sacroiliac). AF and FA are the same physical joint (hip). IP and IsP reference the same landmark (pubic symphysis). Six joint names, three anatomical structures.
```

#### Below the callout: the existing inline SVG schematics

Keep the SI_SVG and HIP_SVG inline SVG graphics that are currently used in the layer wizard. Place them in a flex row below the callout, with captions:
- Left: "Sacroiliac joint" 
- Right: "Hip joint (acetabulofemoral)"

Same styling as current: `display:flex; flex-wrap:wrap; gap:1rem; justify-content:center; margin:1rem 0;`

---

## Sub-tab 2: Translation Table

### Callout text fix

The existing callout reads:
```
PRI creates new joint names to encode treatment targets. IS vs. SI is the same SI joint — the name tells you which bone PRI is targeting. IP and IsP are not real joints at all — they describe innominate movement relative to the pubic symphysis midline.
```

Replace with:
```
PRI creates new joint names to encode treatment targets. IS vs. SI is the same sacroiliac joint — the name tells you which bone PRI considers displaced. IP and IsP describe innominate movement relative to the pubic symphysis — a real joint (amphiarthrosis) with minimal motion that PRI uses as a positional reference, not a treatment target.
```

### No other changes
The translation table data, rendering, search/filter, and mobile card layout are correct. Do not modify them.

---

## Sub-tab 3: Key Distinction

### Content update

The existing Key Distinction callout renders `DATA.terminology.keyInsight`. Replace that string in the DATA object with:

```
Joints are passive structures. They permit motion; they do not produce it. Muscles, gravity, and momentum produce motion. PRI's acronym system encodes a clinical conclusion — which bone is displaced — into a joint name. IS vs. SI, AF vs. FA: same joint, different target bone. The first letter tells you which bone PRI wants you to move. IS = target the ilium. SI = target the sacrum. AF = reposition the pelvis over the femur. FA = mobilize the femur in the socket. IP and IsP use the pubic symphysis as a midline reference for describing innominate orientation at the inlet and outlet. The acronyms are treatment codes, not anatomical terms.
```

---

## Section title updates

Remove the "2A —", "2B —", "2C —" prefixes from section titles. These are now sub-tabs, not subsections. The sub-tab buttons already provide navigation context.

- "2A — The Two Real Joints" → remove the section-title div entirely (the sub-tab is labeled "Joints" and the content heading is "Pelvic Joints")
- "2B — Translation Table" → "Translation Table"
- "2C — Key Distinction" → "Key Distinction"

---

## NomenclatureModule JS changes

The `init()` function currently calls `renderLayer()`, `buildTranslationTable()`, and `buildKeyInsight()`.

1. Replace `renderLayer()` with `buildJointsView()` — a function that renders the joint table, callout, and SVGs into the `nom-joints` subtab-content container.
2. `buildTranslationTable()` — unchanged except the callout text fix.
3. `buildKeyInsight()` — unchanged except reading the updated string.
4. Delete `currentLayer`, `LAYER_DATA`, `renderLayer()`, and all layer-related event listener code.

The SI_SVG and HIP_SVG constants referenced in the current LAYER_DATA must be preserved (they are defined elsewhere in the script). `buildJointsView()` uses them.

---

## What NOT to Change
- Translation table data (DATA.translationMap array)
- Translation table rendering, search, or filter logic
- Mobile card layout for translation table
- SVG schematic constants (SI_SVG, HIP_SVG)
- Other tabs
- CSS custom properties or theme

## Validation
1. Joints sub-tab shows the 5-joint table with correct content
2. No wizard, no layers, no dots, no Next/Start Over buttons
3. SVG schematics render below the table
4. Translation Table callout updated (pubic symphysis described as a real joint)
5. Key Distinction text updated
6. Section title prefixes removed
7. Search/filter on translation table still works
8. Mobile: joint table renders as stacked cards
9. No console errors
