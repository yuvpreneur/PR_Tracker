import { icons } from 'lucide';

const DEFAULT_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
};

function attrsToString(attrs) {
  return Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
}

function nodeToString([tag, attrs, children]) {
  const inner = children?.length ? children.map(nodeToString).join('') : '';
  return `<${tag} ${attrsToString(attrs)}>${inner}</${tag}>`;
}

// Renders a lucide icon (by PascalCase name, e.g. "Pencil") to an inline <svg>
// string — for legacy code that builds table/modal markup as HTML strings
// instead of live DOM nodes (see bridge/index.js's lucideIcon() for the DOM-node
// equivalent used where a real element is available to mutate).
export function iconSvg(name, { size = 14, ...rest } = {}) {
  const iconNode = icons[name];
  if (!iconNode) return '';
  const attrs = { ...DEFAULT_ATTRS, width: size, height: size, style: 'vertical-align:-2px', ...rest };
  return nodeToString(['svg', attrs, iconNode]);
}
