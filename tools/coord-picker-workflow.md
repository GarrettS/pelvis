# Coordinate Picker — Workflow

Development tool for recording percentage-based coordinates on anatomical images. Coordinates feed into `data/anatomize-data.json` (Anatomize This feature) and `data/aic-chain.json` (L AIC Chain feature).

`coord-picker.html` supports multiple recording modes for complex shapes (hitboxes, panel boxes, polygon boundaries).

**Modes:**
- **Point** — single `{x, y}` click. Use for `arrowTo`, `landmarkMarker`, or `anchor`.
- **Box** — click-drag rectangle. Outputs `{x, y, w, h}`. Use for `panelBox` or `hitbox`.
- **Polygon** — multi-click vertex recording. Outputs `[[x,y], ...]` arrays. Use for muscle overlay boundaries.

**Workflow:**
1. Select image from dropdown
2. Set mode (Point / Box / Polygon)
3. Enter structure ID (e.g. `obturator_internus`)
4. Field auto-selects based on mode (`arrowTo`, `panelBox`, `polygon`)
5. Click/drag on the image to record coordinates
6. Click "Record Current" to save the structure entry
7. Continue recording fields for the same or other structures
8. Copy JSON output and paste into the relevant data file

**Features:**
- Canvas overlay with grid (5% or 10%) for alignment
- Undo support
- Accumulated multi-structure recording with JSON export
- Visual feedback (drawn points, boxes, polygon outlines)

## Output Format

All coordinates are **percentages** of the image's rendered dimensions (0–100). This makes them resolution-independent — the same coordinates work regardless of display size.

```
arrowTo:  {x: 45.2, y: 31.0}         — where the label arrow points
panelBox: {x: 60, y: 10, w: 35, h: 25} — detail panel position
hitbox:   {x: 30, y: 20, w: 15, h: 20} — clickable region
polygon:  [[x,y], [x,y], ...]         — muscle boundary vertices
anchor:   [x, y]                       — AIC chain circle position
```

## Data Files That Consume Coordinates

- **`data/anatomize-data.json`** — `arrowTo`, `panelBox`, `hitbox`, `polygon` for each structure on each image
- **`data/aic-chain.json`** — `anchor.anterior` and `anchor.posterior` arrays for each muscle's circle position

## Process for Updating Coordinates

1. Open the appropriate coord-picker in a browser (file:// or local server)
2. Load the target image
3. Record coordinates for each structure/field
4. Copy the JSON output
5. Paste into the relevant data file, replacing old values
6. Verify in the running app — check marker positions, panel placement, hitbox accuracy
7. Iterate as needed (coordinates often require 2–3 passes to get right)
