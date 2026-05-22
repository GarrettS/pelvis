// Declarative element construction: one call returns a configured node, with
// optional children appended. For one-time setup paths — not per-frame
// attribute updates, where allocating a props object per call would land in
// the hot path.
//
// HTML elements: properties are assigned directly (Object.assign onto the
// node), so callers write `className`, `textContent`, `id`, `style.cssText`,
// etc. directly against the DOM property API. Pass an `attrs` sub-map for
// HTML attributes with no IDL property analog (e.g. `data-*`, `aria-*`); each
// entry goes through setAttribute.
//
// SVG elements: every prop goes through setAttribute. Callers pass `class`,
// not `className`.

const SVG_NS = 'http://www.w3.org/2000/svg';

export const setAttrs = (node, attrs) =>
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));

export function newEl(tag, props = {}) {
  const {children, attrs, ...rest} = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (attrs) setAttrs(node, attrs);
  if (children) node.append(...children);
  return node;
}

export function newSvg(tag, props = {}) {
  const {children, ...rest} = props;
  const node = document.createElementNS(SVG_NS, tag);
  setAttrs(node, rest);
  if (children) node.append(...children);
  return node;
}
