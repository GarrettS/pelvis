# Replace Anatomize This Data File

## What changed

The Anatomize This infopanel data has been rewritten. The new file is `data/anatomize-data.json`. It replaces `scripts/anatomize-data.js`.

## File operations

1. Copy `data/anatomize-data.json` (attached to this prompt or already in repo) into the `data/` directory.
2. Delete `scripts/anatomize-data.js`.
3. Update `index.html`: remove the `<script>` tag loading `scripts/anatomize-data.js`. Replace it with a fetch or import of `data/anatomize-data.json`.

## Data format changes

The file is now valid JSON (not a JS file assigning to `window`). The consuming code must parse it. Key structural differences from the old JS file:

### Top-level shape

```json
{
  "sharedStructures": {
    "outletInferior": [ ... ]
  },
  "images": [ ... ]
}
```

`sharedStructures.outletInferior` is the array of 12 structures shared by both the normal and flipped inferior outlet views. Two image entries reference it via `"structuresRef": "outletInferior"` instead of inlining the array. The consuming code must resolve this: if an image entry has `structuresRef` instead of `structures`, look up the array from `sharedStructures[structuresRef]`.

The old JS file used a top-level `OUTLET_INFERIOR_STRUCTURES` const and a separate `window.ANATOMIZE_IMAGES` array. The new file unifies both under one JSON object.

### Field renames

| Old field | New field | Notes |
|-----------|-----------|-------|
| `standard` (in `priDetail.layer1`) | `standard` | Name unchanged. Content rewritten — now purely conventional anatomy, no PRI language. |
| `type: "muscle"` on ligaments/tendons | `type: "connective"` | Arcuate tendon and anococcygeal ligament. Affects rendering: use circle markers, not polygon overlays. |

### New field: `attachments` as object

Old: `attachments` was a string.
New: `attachments` is an object with `proximal` and `distal` arrays.

```json
"attachments": {
  "proximal": ["Ischial spine"],
  "distal": ["Lateral margins of coccyx", "S5"]
}
```

Rendering code that displayed `attachments` as a string must iterate the arrays instead.

### Removed: color names in text

The old data included color names in `pri` fields (e.g., "Brown (Sagittal)", "Violet — Internal Rotation"). These have been stripped. The PRI color is communicated visually via the `priColor` CSS custom property on the panel border/background — never in text. Do not re-add color names to any text field.

## Loading the data

The old pattern assigned data to `window.ANATOMIZE_IMAGES` via a script tag. Replace with a JSON fetch. Example:

```js
let anatomizeData = null;

async function loadAnatomizeData() {
  if (anatomizeData) return anatomizeData;
  const resp = await fetch('data/anatomize-data.json');
  anatomizeData = await resp.json();
  return anatomizeData;
}

function getImageSet(imageId) {
  if (!anatomizeData) return null;
  const img = anatomizeData.images.find((i) => i.id === imageId);
  if (!img) return null;
  // Resolve shared structure references
  if (img.structuresRef && !img.structures) {
    img.structures = anatomizeData.sharedStructures[img.structuresRef];
  }
  return img;
}
```

Update `scripts/anatomize.js` to call `loadAnatomizeData()` before first use. Remove all references to `window.ANATOMIZE_IMAGES`.

## Rendering changes for `type: "connective"`

The PRD specifies landmarks use circle markers, muscles use polygon overlays. Connective tissue structures (arcuate tendon, anococcygeal ligament) should render like landmarks — circle marker at the `arrowTo` position, not a polygon fill. Update the rendering logic that checks `structure.type` to handle `"connective"` the same as `"landmark"` for overlay purposes.

## Content corrections (already applied in the JSON — do not revert)

These are documented so you understand what changed and why. Do not modify these values.

- **R Glute Max `pri`**: was "R IS ER" → corrected to "R IS IR" (nutation, posterior inlet closing).
- **R Glute Max `treatment`**: was "Step 6, HALT 4/5 → 5/5" → corrected to "Step 4, HALT 4/5".
- **L Glute Med `treatment`**: was "Step 5, HALT 3/5 → 4/5" → corrected to "Step 3, HALT 2/5 → 3/5".
- **L Iliacus `treatment`**: was "Not directly facilitated" → corrected to "Proximal iliacus: Step 3".
- **L Iliacus `pri`**: now includes proximal vs. distal distinction and "anterior glute med" note.
- **L Hamstring `pri`**: removed misleading "(L IsP IR)" parenthetical.
- **All `standard` fields**: rewritten to remove PRI language. These must contain only conventional anatomical terminology.
- **`pathology` subfield**: added consistently to layer2 of all PRI-relevant muscles.

## Verification

After all changes:

1. `data/anatomize-data.json` exists and passes `python3 -c "import json; json.load(open('data/anatomize-data.json'))"`.
2. `scripts/anatomize-data.js` is deleted.
3. No remaining references to `window.ANATOMIZE_IMAGES` or `OUTLET_INFERIOR_STRUCTURES` in any file.
4. No `<script>` tag loading `scripts/anatomize-data.js` in `index.html`.
5. Anatomize This tab loads and displays image selector buttons.
6. Selecting each image loads its structures (including the two inferior outlet views that use `structuresRef`).
7. Infopanel renders `standard` and `attachments` fields correctly (attachments as proximal/distal lists, not a raw string).
