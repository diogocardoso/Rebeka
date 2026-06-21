import { getState, patchState, scheduleSave, treeChildren, REQUEST_SESSION_RESET } from '../store.js';
import { data } from '../data/index.js';
import { expandNode } from '../../components/sidebar/expanded.js';
import { applyMove } from './treeMove.js';

export async function create(type, defaultName, options = {}) {
  const state = getState();
  const wsId = options.workspaceId || state.uiState.activeWorkspaceId;
  const hostId = options.hostId || state.uiState.activeHostId;
  if (!wsId || !hostId) return;

  const parentId = options.parentId !== undefined
    ? options.parentId
    : (state.uiState.activeRequestId
      ? state.tree.find((n) => n.id === state.uiState.activeRequestId && n.type === 'folder')?.id || null
      : null);

  const result = await data.tree.create(wsId, hostId, parentId, defaultName, type);
  const sortOrder = treeChildren(parentId).length;

  patchState((s) => {
    const requests = { ...s.requests };
    if (result.request) requests[result.request.id] = result.request;
    return {
      ...s,
      ...(type === 'request' ? { ...REQUEST_SESSION_RESET, requestHistory: [] } : {}),
      tree: [...s.tree, { ...result.node, hostId, parentId: parentId || null, sortOrder }],
      requests,
      uiState: {
        ...s.uiState,
        activeRequestId: type === 'request' ? result.node.id : s.uiState.activeRequestId,
        activeView: type === 'request' ? 'request' : s.uiState.activeView,
      },
    };
  });

  if (type === 'folder') expandNode(result.node.id);
  else if (parentId) expandNode(parentId);
  scheduleSave();
}

export async function rename(id, name) {
  const trimmed = name?.trim();
  if (!trimmed) return;

  await data.tree.edit(id, trimmed);
  patchState((s) => ({
    ...s,
    tree: s.tree.map((n) => (n.id === id ? { ...n, name: trimmed } : n)),
  }));
  scheduleSave();
}

export async function edit(id, currentName) {
  const name = prompt('Novo nome:', currentName);
  if (!name) return;
  await rename(id, name);
}

export async function deleteNode(id) {
  if (!confirm('Excluir este item?')) return;

  await data.tree.remove(id);
  patchState((s) => {
    const tree = s.tree.filter((n) => n.id !== id);
    const requests = { ...s.requests };
    delete requests[id];
    return {
      ...s,
      tree,
      requests,
      uiState: {
        ...s.uiState,
        activeRequestId: s.uiState.activeRequestId === id ? '' : s.uiState.activeRequestId,
      },
    };
  });
  scheduleSave();
}

export function findByID(id) {
  return getState().tree.find((n) => n.id === id) || null;
}

export function findAll(parentId = null) {
  const hostId = getState().uiState.activeHostId;
  return treeChildren(parentId).filter((n) => n.hostId === hostId || !hostId);
}

export function moveNode(nodeId, referenceNodeId, zone) {
  let moved = false;

  patchState((s) => {
    const tree = applyMove(s.tree, nodeId, referenceNodeId, zone);
    if (tree === s.tree) return s;
    moved = true;
    return { ...s, tree };
  });

  if (!moved) return;
  if (zone === 'inside' && referenceNodeId) expandNode(referenceNodeId);
  scheduleSave();
}

export const sidebar = { create, edit, rename, delete: deleteNode, findByID, findAll, moveNode };
