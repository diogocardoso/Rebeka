function normalizedParentId(parentId) {
  return parentId || null;
}

export function sortedSiblings(tree, parentId, excludeId = null) {
  return tree
    .filter((n) => normalizedParentId(n.parentId) === normalizedParentId(parentId) && n.id !== excludeId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function isDescendant(tree, ancestorId, nodeId) {
  if (!ancestorId || !nodeId) return false;
  if (ancestorId === nodeId) return true;
  let cur = tree.find((n) => n.id === nodeId);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = tree.find((n) => n.id === cur.parentId);
  }
  return false;
}

function reindexTree(tree, nodeId, parentId, insertIndex) {
  const next = tree.map((n) => ({ ...n, parentId: n.parentId || null }));
  const moved = next.find((n) => n.id === nodeId);
  if (!moved) return tree;

  moved.parentId = parentId;
  const siblings = sortedSiblings(next, parentId, nodeId);
  const idx = Math.max(0, Math.min(insertIndex, siblings.length));
  siblings.splice(idx, 0, moved);
  siblings.forEach((n, i) => {
    const node = next.find((x) => x.id === n.id);
    node.parentId = parentId;
    node.sortOrder = i;
  });
  return next;
}

export function applyMove(tree, nodeId, referenceNodeId, zone) {
  const moved = tree.find((n) => n.id === nodeId);
  if (!moved) return tree;

  let parentId = null;
  let insertIndex = 0;

  if (zone === 'root-end') {
    parentId = null;
    insertIndex = sortedSiblings(tree, null, nodeId).length;
  } else if (zone === 'inside') {
    const ref = tree.find((n) => n.id === referenceNodeId);
    if (!ref || ref.type !== 'folder') return tree;
    if (isDescendant(tree, nodeId, referenceNodeId)) return tree;
    parentId = referenceNodeId;
    insertIndex = sortedSiblings(tree, parentId, nodeId).length;
  } else {
    const ref = tree.find((n) => n.id === referenceNodeId);
    if (!ref) return tree;
    parentId = ref.parentId || null;
    if (moved.type === 'folder' && parentId && isDescendant(tree, nodeId, parentId)) return tree;

    const siblings = sortedSiblings(tree, parentId, nodeId);
    const refIndex = siblings.findIndex((n) => n.id === referenceNodeId);
    if (refIndex < 0) return tree;
    insertIndex = zone === 'before' ? refIndex : refIndex + 1;
  }

  const currentParent = normalizedParentId(moved.parentId);
  const currentSiblings = sortedSiblings(tree, currentParent);
  const currentIndex = currentSiblings.findIndex((n) => n.id === nodeId);

  if (normalizedParentId(parentId) === currentParent && currentIndex === insertIndex) {
    return tree;
  }
  if (normalizedParentId(parentId) === currentParent && currentIndex < insertIndex) {
    insertIndex -= 1;
  }

  return reindexTree(tree, nodeId, parentId, insertIndex);
}
