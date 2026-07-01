# Adjacency List Conversion

We needed primary (self) and secondary relationships, both `from` and `to`.
 
 
The JSON has the `to` and some label text and pixel data used for placing the nodes and setting their dimensions. But it does not have the `from` needed to establish and display the relationship in the browser.

When any one of these problems is selected by the user, the `from` node is that selected node itself. For example, left hemidiaphragm weakness, labeled `"diaphragm"`, when selected by the user, shows that it originates from itself. When IO/TA (internal oblique / transversus abdominis) weakness is of primary focus, then secondary relationships are the `from` – diaphragm, and `to` – "aic" (L Innominate
Anterior Tilt).

```javascript
{
  "diaphragm": { 
    "name": "L Hemidiaphragm\nWeakness",
    "x": 22,
    "y": 9,
    "to": {
      "psoas": {
        "effect": "crural pull / ZOA loss",
        "dx": 58.4,
        "dy": -17.4
      },
      "iotas": {
        "effect": "no abdominal counter-pressure",
        "dx": -17.8,
        "dy": -21.8
      }
    }
  },
  "iotas": {
    "name": "L IO/TA\nWeakness",
    "x": 7,
    "y": 44,
    "to": {
      "aic": {
        "effect": "no posterior tilt opposition",
        "dx": -21.5,
        "dy": 14.1
      }
    }
  },

...
```

 keep the authored
  relationship-and-layout data single-sourced, and derive the duplicated
  interaction index locally.
  

```javascript
function buildEdgesByNode(graph) {
  const edgesByNode = {};
  Object.keys(graph).forEach((key) => {
    edgesByNode[key] = [];
  });
  Object.entries(graph).forEach(([fromKey, node]) => {
    Object.keys(node.to || {}).forEach((toKey) => {
      const edge = { fromKey, toKey };
      edgesByNode[fromKey].push(edge);
      edgesByNode[toKey].push(edge);
    });
  });
  return edgesByNode;
}

function initNodeHighlight(svg) {
  let activeNode = null;
  const edgesByNode = buildEdgesByNode(CONCEPT_MAP);

  function toggleHighlight(nodeKey, isHighlighted) {
    const classMethod = isHighlighted ? 'add' : 'remove';
    const markerEnd = isHighlighted ? 'url(#arrow-map-hl)' : 'url(#arrow-map)';

    edgesByNode[nodeKey].forEach(({ fromKey, toKey }) => {
      const edgeEl = document.getElementById(edgeLineId(fromKey, toKey));
      const otherKey = fromKey === nodeKey ? toKey : fromKey;
      const otherNodeEl = document.getElementById(nodeId(otherKey));
      edgeEl.classList[classMethod]('highlighted');
      edgeEl.setAttribute('marker-end', markerEnd);
      otherNodeEl.classList[classMethod]('highlighted');
    });
  }

  function clearHighlight() {
    if (!activeNode) return;

    const nodeKey = parseNodeKey(activeNode.id);
    activeNode.classList.remove('highlighted');
    toggleHighlight(nodeKey, false);
    activeNode = null;
  }

  function highlightNode(nodeEl) {
    activeNode = nodeEl;
    const nodeKey = parseNodeKey(nodeEl.id);
    nodeEl.classList.add('highlighted');
    toggleHighlight(nodeKey, true);
  }

  svg.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl) return;

    clearHighlight();
    highlightNode(nodeEl);
  });
}
```

`buildEdgesByNode(graph)` starts with the stored graph shape in `CONCEPT_MAP`. That data is keyed by node, and each node stores only its outgoing edges under `to`.

```javascript
Object.keys(graph).forEach((key) => {
  edgesByNode[key] = [];
});
```

This creates one empty bucket per node. At this point, `edgesByNode` is ready to collect every edge that touches each node.

```javascript
Object.entries(graph).forEach(([fromKey, node]) => {
  Object.keys(node.to || {}).forEach((toKey) => {
    const edge = { fromKey, toKey };
    edgesByNode[fromKey].push(edge);
    edgesByNode[toKey].push(edge);
  });
});
```

This is the conversion. For every stored directed edge, the code creates one edge record with its source and target. It then pushes that same record into both endpoint buckets:

- `edgesByNode[fromKey]` gets the edge because the source node touches it
- `edgesByNode[toKey]` gets the edge because the target node also touches it

That is why the result is useful for interaction. A click on any node can immediately access every incident edge, regardless of direction.

The returned shape looks like this:

```javascript
{
  diaphragm: [
    { fromKey: 'diaphragm', toKey: 'psoas' },
    { fromKey: 'diaphragm', toKey: 'iotas' }
  ],
  psoas: [
    { fromKey: 'diaphragm', toKey: 'psoas' },
    { fromKey: 'psoas', toKey: 'aic' }
  ]
}
```

`initNodeHighlight(svg)` builds that derived structure once:

```javascript
const edgesByNode = buildEdgesByNode(CONCEPT_MAP);
```

After that, the click logic never has to scan the whole graph again.

```javascript
edgesByNode[nodeKey].forEach(({ fromKey, toKey }) => {
  const edgeEl = document.getElementById(edgeLineId(fromKey, toKey));
  const otherKey = fromKey === nodeKey ? toKey : fromKey;
  const otherNodeEl = document.getElementById(nodeId(otherKey));
  edgeEl.classList[classMethod]('highlighted');
  edgeEl.setAttribute('marker-end', markerEnd);
  otherNodeEl.classList[classMethod]('highlighted');
});
```

This is the reason for the conversion.

`edgesByNode[nodeKey]` gives the current node's incident edges. For each edge:

- `edgeEl` is the line element for that edge
- `otherKey` means "the node on the other end of this edge"
- `otherNodeEl` is that neighboring node's DOM element

`otherKey` needs the conditional because the active node can appear on either side of the stored edge record:

- if `fromKey === nodeKey`, the active node is the source, so the other endpoint is `toKey`
- otherwise, the active node is the target, so the other endpoint is `fromKey`

That lets the same loop work for both outgoing and incoming relationships.

`clearHighlight()` removes state from the previously active node and its connected edges:

```javascript
const nodeKey = parseNodeKey(activeNode.id);
activeNode.classList.remove('highlighted');
toggleHighlight(nodeKey, false);
activeNode = null;
```

`highlightNode(nodeEl)` applies the same logic in the other direction:

```javascript
activeNode = nodeEl;
const nodeKey = parseNodeKey(nodeEl.id);
nodeEl.classList.add('highlighted');
toggleHighlight(nodeKey, true);
```

The click handler just switches the active node:

```javascript
svg.addEventListener('click', (e) => {
  const nodeEl = e.target.closest('.map-node');
  if (!nodeEl) return;

  clearHighlight();
  highlightNode(nodeEl);
});
```

The stored graph stays authoritative for meaning and edge payload. The adjacency list exists to make interaction local: one node key in, connected edges and neighbor nodes out.
