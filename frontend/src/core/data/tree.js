import { getWindow } from '../window.js';

export async function create(workspaceId, hostId, parentId, name, nodeType) {
  return getWindow().CreateTreeNode(workspaceId, hostId, parentId, name, nodeType);
}

export async function edit(id, name) {
  return getWindow().UpdateTreeNode(id, name);
}

export async function remove(id) {
  return getWindow().DeleteTreeNode(id);
}
