# PRD: HALT & Squat Level Data Accuracy Fix

**Priority:** P1 — content bugs in exam-prep material

---

## Problem

`halt-levels.json` and `squat-levels.json` contain inaccurate, incomplete, or flattened content compared to the PRI manual. Specific muscles, differential findings, compensation criteria, and mechanism descriptions are missing. The current flat schema (`failure`/`facilitate` for HALT; `failure`/`hyperactive` for Squat) cannot represent the manual's multi-clause detail.

---

## Scope

1. Expand JSON schemas for both files.
2. Replace all level content with manual-accurate text.
3. Update rendering in `patterns.js` to display new fields.
4. Update hardcoded data in `CC-BUILD-SPEC.md` to match.

---

## 1. Squat Levels — Schema & Content

### New schema

```json
[
  {
    "level": 1,
    "ability": "…",
    "inability": "…",
    "hyperactive": "…"
  }
]
```

**Added field:** `ability` — what the patient CAN do at this level (the manual defines each level by ability first, inability second).

### Corrected content

```json
[
  {
    "level": 1,
    "ability": "Initiate a squat by slightly bending knees while trunk remains in flexion",
    "inability": "Lack of posterior pelvic rotation",
    "hyperactive": "Back extensors, rectus femoris, sartorius"
  },
  {
    "level": 2,
    "ability": "Begin squatting, moving bottom back and knees forward while trunk remains in flexion",
    "inability": "Lack of femoral adduction",
    "hyperactive": "Hip flexors; overactive FA ERs (inferior glute max, coccygeus, piriformis)"
  },
  {
    "level": 3,
    "ability": "Squat bringing bottom below knee level while keeping heels down and trunk flexed",
    "inability": "Tight intercostals; hyperactive anterior/posterior tibialis; lack of integration of IO/TAs with posterior mediastinum expansion",
    "hyperactive": "Intercostals, anterior tibialis, posterior tibialis"
  },
  {
    "level": 4,
    "ability": "Squat keeping heels down, trunk flexed, and bottom to heels",
    "inability": "Lack of integration of IO/TAs with frontal plane of pelvis",
    "hyperactive": "Quads, gastroc-soleus"
  },
  {
    "level": 5,
    "ability": "Maximally squat keeping heels down and trunk flexed while keeping center of gravity through heels",
    "inability": "Lack of maximal AF IR and synchronized mechanics of diaphragm and pelvic diaphragm respiration",
    "hyperactive": ""
  }
]
```

### What changed vs. current JSON

| Level | Bug | Fix |
|-------|-----|-----|
| 1 | "Extensors" — missing "back" qualifier | → "Back extensors" |
| 1 | Missing "lack of posterior pelvic rotation" | → added to `inability` |
| 2 | "FA external rotators" — no specific muscles | → "inferior glute max, coccygeus, piriformis" |
| 3 | "Poor IO/TA integration" — generic | → "lack of integration of IO/TAs with posterior mediastinum expansion" |
| 5 | `hyperactive` listed muscles not in manual | → empty string (manual names no hyperactive muscles at Level 5) |

---

## 2. HALT Levels — Schema & Content

### New schema

```json
[
  {
    "level": 0,
    "ability": "…",
    "inability": "…",
    "muscles": "…",
    "also_reflects": "…",
    "differentials": "…",
    "facilitate": "…"
  }
]
```

**Added fields:**
- `ability` — the test step the patient CAN perform (empty string for Level 0, which is a positioning gate)
- `muscles` — specific muscles named in the inability description
- `also_reflects` — the "Also reflects" line from the manual that corresponds to this level
- `differentials` — alternative explanations the manual lists (e.g., lax ligament, labral impingement)

### Corrected content

```json
[
  {
    "level": 0,
    "ability": "",
    "inability": "Inability to position top leg in alignment with top shoulder and hip and with top knee above top shoulder without experiencing top hip impingement, SI pain, or low back pain",
    "muscles": "Adductors, abductors, FA rotators (frontal plane integration)",
    "also_reflects": "",
    "differentials": "Top hip impingement; sacroiliac pain; low back pain",
    "facilitate": "Repositioning first — pelvis not yet neutral. Malaligned pelvis and poor integration of adductors, abductors, and FA rotators in frontal plane"
  },
  {
    "level": 1,
    "ability": "Push bottom hip into surface",
    "inability": "Weakness in bottom IO/TA, or bottom quadratus lumborum, or top external obliques",
    "muscles": "IO/TAs, quadratus lumborum, external obliques",
    "also_reflects": "Inability to inhibit inlet abduction (proximal rectus femoris/sartorius) of the flexed extremity via inlet extension with IO/TAs",
    "differentials": "",
    "facilitate": "IO/TAs + inlet inhibition"
  },
  {
    "level": 2,
    "ability": "Raise or turn in bottom knee without moving top pelvis backwards",
    "inability": "Poor strength or kinesthetic awareness of ischiocondylar adductor or anterior gluteus medius",
    "muscles": "Ischiocondylar adductor, anterior gluteus medius",
    "also_reflects": "Inability to achieve outlet abduction of the flexed extremity via facilitation of the inferior medial obturator internus and iliococcygeus with femoral adduction",
    "differentials": "Lax iliofemoral–pubofemoral ligament",
    "facilitate": "IC adductor + anterior glute med"
  },
  {
    "level": 3,
    "ability": "Rotate top extremity inward (FA IR) without moving top pelvis forward",
    "inability": "Poor strength or kinesthetic awareness of ipsilateral gluteus minimus and anterior gluteus medius",
    "muscles": "Gluteus minimus, anterior gluteus medius",
    "also_reflects": "Inability to achieve inlet adduction of the flexed extremity via ilium attachment of the iliacus and left gluteus medius",
    "differentials": "Impingement of medial femoral head on anterior medial cotyloid labral rim secondary to forward, anteriorly rotated contralateral pelvis",
    "facilitate": "Glute min + anterior glute med"
  },
  {
    "level": 4,
    "ability": "Raise top leg completely off the wall and hold without using lateral trunk muscle",
    "inability": "Poor integration between contralateral hip adductors and ipsilateral hip abductor (gluteus medius)",
    "muscles": "Contralateral adductors, ipsilateral gluteus medius",
    "also_reflects": "Inability to achieve inlet abduction of the extended extremity via superior gluteus maximus",
    "differentials": "",
    "facilitate": "Contralateral adductor + ipsilateral glute med"
  },
  {
    "level": 5,
    "ability": "Move correctly abducted top lower extremity into extension without extending low back or flexing knee or rotating leg externally (FA ER)",
    "inability": "Inability to extend leg with gluteus maximus during concomitant abduction and FA stabilization provided by adductors (IRs) and anterior gluteus medius and TFL",
    "muscles": "Gluteus maximus, adductors (IRs), anterior gluteus medius, TFL",
    "also_reflects": "Inability to achieve outlet adduction of the extended extremity via inferior gluteus maximus",
    "differentials": "",
    "facilitate": "Glute max extension during abduction"
  }
]
```

### What changed vs. current JSON

| Level | Bug | Fix |
|-------|-----|-----|
| 0 | Missing impingement/SI pain/LBP symptom presentations | → added to `inability` and `differentials` |
| 0 | "Can't inhibit outlet abduction of extended leg" wrongly attributed to Level 0 (it's a general preamble) | → removed from Level 0; preamble lines mapped to Levels 0–1 `also_reflects` |
| 1 | Missing QL and external obliques as alternative weakness | → added to `inability` and `muscles` |
| 2 | Missing "kinesthetic awareness" qualifier | → added to `inability` |
| 2 | Missing lax iliofemoral–pubofemoral ligament differential | → added to `differentials` |
| 2 | Missing OI/iliococcygeus from "Also reflects" | → added to `also_reflects` |
| 3 | "Labral impingement" — vague | → full mechanism description in `differentials` |
| 3 | Missing iliacus reference from "Also reflects" | → added to `also_reflects` |
| 4 | Missing superior glute max from "Also reflects" | → added to `also_reflects` |
| 5 | Missing compensation criteria (no LB extension, no knee flexion, no FA ER) | → added to `ability` |
| 5 | Missing adductors/anterior glute med/TFL as FA stabilizers | → added to `inability` and `muscles` |
| 5 | Missing inferior glute max from "Also reflects" | → added to `also_reflects` |

---

## 3. Rendering Changes — `patterns.js`

### HALT Quiz answer reveal (current: lines 197–200)

**Before:**
```javascript
q.innerHTML += '<div class="feedback-box" style="margin-top:.75rem;">'
  + '<strong>Answer:</strong> ' + level.failure + '<br>'
  + '<strong>Facilitate:</strong> ' + level.facilitate
  + '</div>';
```

**After:**
```javascript
let html = '<div class="feedback-box" style="margin-top:.75rem;">';
if (level.ability) {
  html += '<strong>Ability:</strong> ' + level.ability + '<br>';
}
html += '<strong>Inability:</strong> ' + level.inability + '<br>'
  + '<strong>Muscles:</strong> ' + level.muscles + '<br>'
  + '<strong>Facilitate:</strong> ' + level.facilitate;
if (level.also_reflects) {
  html += '<br><strong>Also reflects:</strong> ' + level.also_reflects;
}
if (level.differentials) {
  html += '<br><strong>Differentials:</strong> ' + level.differentials;
}
html += '</div>';
q.innerHTML += html;
```

### Squat Quiz answer reveal (current: lines 226–229)

**Before:**
```javascript
q.innerHTML += '<div class="feedback-box" style="margin-top:.75rem;">'
  + '<strong>Failure:</strong> ' + level.failure + '<br>'
  + '<strong>Hyperactive muscles:</strong> ' + level.hyperactive
  + '</div>';
```

**After:**
```javascript
let html = '<div class="feedback-box" style="margin-top:.75rem;">'
  + '<strong>Ability:</strong> ' + level.ability + '<br>'
  + '<strong>Inability:</strong> ' + level.inability;
if (level.hyperactive) {
  html += '<br><strong>Hyperactive:</strong> ' + level.hyperactive;
}
html += '</div>';
q.innerHTML += html;
```

---

## 4. CC-BUILD-SPEC.md Hardcoded Data

`CC-BUILD-SPEC.md` contains inline `HALT_LEVELS` and `SQUAT_LEVELS` arrays that CC may use as source-of-truth. These must be updated to match the new JSON schemas and content, or — preferably — replaced with a reference: "See `data/halt-levels.json` and `data/squat-levels.json` for canonical data."

---

## 5. Validation Checklist

CC must verify each item against the JSON and rendering code in this spec before committing. This spec's content was verified against the PRI manual — CC's job is to implement it exactly.

### Squat JSON

- [ ] Level 1 `hyperactive` says "Back extensors" not "Extensors"
- [ ] Level 1 `inability` includes "Lack of posterior pelvic rotation"
- [ ] Level 2 `hyperactive` names inferior glute max, coccygeus, piriformis
- [ ] Level 3 `inability` includes "posterior mediastinum expansion"
- [ ] Level 5 `hyperactive` is empty string
- [ ] Every level has all three fields: `ability`, `inability`, `hyperactive`

### HALT JSON

- [ ] Level 0 `inability` includes impingement, SI pain, LBP
- [ ] Level 0 `facilitate` includes "poor integration of adductors, abductors, and FA rotators in frontal plane"
- [ ] Level 1 `inability` includes QL and external obliques
- [ ] Level 2 `inability` includes "kinesthetic awareness"
- [ ] Level 2 `differentials` includes lax iliofemoral–pubofemoral ligament
- [ ] Level 2 `also_reflects` names OI and iliococcygeus
- [ ] Level 3 `differentials` includes full labral impingement mechanism
- [ ] Level 3 `also_reflects` names iliacus
- [ ] Level 4 `also_reflects` names superior gluteus maximus
- [ ] Level 5 `ability` includes compensation criteria (no LB extension, no knee flexion, no FA ER)
- [ ] Level 5 `inability` names adductors (IRs), anterior glute med, TFL
- [ ] Level 5 `also_reflects` names inferior gluteus maximus
- [ ] Every level has all six fields: `ability`, `inability`, `muscles`, `also_reflects`, `differentials`, `facilitate`

### Rendering

- [ ] HALT quiz shows `ability`, `inability`, `muscles`, `facilitate`, and conditionally `also_reflects` and `differentials`
- [ ] Squat quiz shows `ability`, `inability`, and conditionally `hyperactive`
- [ ] Old field names (`failure`) are not referenced anywhere in `patterns.js`
- [ ] No console errors on load — verify JSON parses and all fields exist
