import { getState, patchState, scheduleSave, hydrate, flushPersist, persistUIState, REQUEST_SESSION_RESET } from '../store.js';
import { data } from '../data/index.js';

export async function create(name) {
  const ws = await data.workspace.create(name);
  patchState((s) => ({
    ...s,
    workspaces: [...s.workspaces, ws],
    uiState: { ...s.uiState, activeWorkspaceId: ws.id, activeEnvironmentId: '', activeRequestId: '', activeView: 'request' },
    tree: [],
    requests: {},
    environments: [],
    workflows: [],
    activeEnvironment: null,
    activeEnvVars: {},
    ...REQUEST_SESSION_RESET,
    requestHistory: [],
  }));
  await persistUIState();
  await hydrate();
  scheduleSave();
  return ws;
}

export async function activate(workspaceId) {
  if (getState().uiState.activeWorkspaceId === workspaceId) return;

  await flushPersist();

  patchState((s) => ({
    ...s,
    uiState: {
      ...s.uiState,
      activeWorkspaceId: workspaceId,
      activeEnvironmentId: '',
      activeRequestId: '',
      activeView: 'request',
    },
    tree: [],
    requests: {},
    environments: [],
    workflows: [],
    activeEnvironment: null,
    activeEnvVars: {},
    ...REQUEST_SESSION_RESET,
    requestHistory: [],
    loading: true,
  }));

  await persistUIState();
  await hydrate();
}

export async function edit(id, name) {
  await data.workspace.edit(id, name);
  patchState((s) => ({
    ...s,
    workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
  }));
  scheduleSave();
}

export async function deleteWorkspace(id) {
  await data.workspace.remove(id);
  const s = getState();
  const remaining = s.workspaces.filter((w) => w.id !== id);
  const nextActive = s.uiState.activeWorkspaceId === id
    ? (remaining[0]?.id || '')
    : s.uiState.activeWorkspaceId;
  patchState((st) => ({
    ...st,
    workspaces: remaining,
    uiState: { ...st.uiState, activeWorkspaceId: nextActive, activeEnvironmentId: '', activeRequestId: '', activeView: 'request' },
    tree: [],
    requests: {},
    environments: [],
    workflows: [],
    activeEnvironment: null,
    activeEnvVars: {},
    activeWorkflowId: '',
    ...REQUEST_SESSION_RESET,
    requestHistory: [],
  }));
  await persistUIState();
  await hydrate();
  scheduleSave();
}

export function findByID(id) {
  return getState().workspaces.find((w) => w.id === id) || null;
}

export function findAll() {
  return getState().workspaces;
}

export async function exportBek(workspaceId) {
  return data.bek.exportBek(workspaceId);
}

export async function importBek() {
  const ws = await data.bek.importBek();
  if (ws?.id) {
    patchState((s) => ({
      ...s,
      workspaces: [...s.workspaces, ws],
      uiState: { ...s.uiState, activeWorkspaceId: ws.id, activeEnvironmentId: '', activeRequestId: '', activeView: 'request' },
      tree: [],
      requests: {},
      environments: [],
      workflows: [],
      activeEnvironment: null,
      activeEnvVars: {},
      ...REQUEST_SESSION_RESET,
      requestHistory: [],
    }));
    await persistUIState();
    await hydrate();
    scheduleSave();
  }
  return ws;
}

export const workspace = {
  create,
  activate,
  edit,
  delete: deleteWorkspace,
  findByID,
  findAll,
  exportBek,
  importBek,
};
