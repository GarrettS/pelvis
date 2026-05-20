// Declarative element construction: one call returns a configured node, with
// optional children appended. For one-time setup paths — not per-frame
// attribute updates, where allocating a props object per call would land in
// the hot path.
//
// HTML elements: properties are assigned directly (Object.assign onto the
// node), so callers write `className`, `textContent`, `id`, `style.cssText`,
// etc. directly against the DOM property API.
//
// SVG elements: every prop goes through setAttribute (SVG's `className` is a
// SVGAnimatedString, not a string). `className` is translated to the `class`
// attribute so callers can use the same prop name across both helpers.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function newEl(tag, props = {}) {
  const {children, ...rest} = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (children) node.append(...children);
  return node;
}

export function newSvg(tag, props = {}) {
  const {children, ...rest} = props;
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(rest)) {
    node.setAttribute(key === 'className' ? 'class' : key, value);
  }
  if (children) node.append(...children);
  return node;
}
