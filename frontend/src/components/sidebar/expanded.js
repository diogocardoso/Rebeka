const expanded = new Set();

export function expandNode(id) {
  expanded.add(id);
}

export function isNodeExpanded(id) {
  return expanded.has(id);
}

export function toggleNodeExpanded(id) {
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
}
