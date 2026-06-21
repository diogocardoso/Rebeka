import { data } from './data/index.js';
import { getWindow } from './window.js';

let state = {
  uiState: {
    activeWorkspaceId: '',
    activeHostId: '',
    activeRequestId: '',
    activeView: 'request',
    sidebarWidth: 280,
  },
  workspaces: [],
  hosts: [],
  activeHost: null,
  tree: [],
  requests: {},
  environments: [],
  activeEnvVars: {},
  workflows: [],
  activeWorkflowId: '',
  response: null,
  testResults: [],
  scriptLogs: [],
  requestHistory: [],
  requestSending: false,
  jobRuns: [],
  loading: true,
};

export const REQUEST_SESSION_RESET = {
  response: null,
  testResults: [],
  scriptLogs: [],
  requestSending: false,
};

export function clearRequestSession() {
  patchState((s) => ({ ...s, ...REQUEST_SESSION_RESET }));
}

const listeners = new Set();
let saveTimer = null;
let hydrating = false;

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error('Store subscriber error:', e);
    }
  });
}

export function setState(partial) {
  state = { ...state, ...partial };
  notify();
}

export function patchState(updater) {
  state = updater(state);
  notify();
}

export function getActiveRequest() {
  const id = state.uiState.activeRequestId;
  return id ? state.requests[id] : null;
}

export function updateRequest(id, data, options = {}) {
  state.requests[id] = { ...state.requests[id], ...data };
  if (!options.silent) notify();
  scheduleSave();
}

export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(), 500);
}

export async function flushPersist() {
  clearTimeout(saveTimer);
  saveTimer = null;
  await persist();
}

export async function persist() {
  if (!getWindow()) return;
  const payload = {
    uiState: state.uiState,
    workspaceId: state.uiState.activeWorkspaceId,
    tree: state.tree,
    requests: Object.values(state.requests),
  };
  try {
    await data.persist.save(payload);
  } catch (e) {
    console.error('Save failed', e);
  }
}

export async function persistUIState() {
  if (!getWindow()) return;
  try {
    await data.persist.save({
      uiState: state.uiState,
      workspaceId: state.uiState.activeWorkspaceId,
      tree: [],
      requests: [],
    });
  } catch (e) {
    console.error('Save UI state failed', e);
  }
}

export async function hydrate() {
  const viewAtStart = state.uiState.activeView;
  hydrating = true;

  const loaded = await data.persist.load();
  if (!loaded) {
    hydrating = false;
    state.loading = false;
    notify();
    return;
  }
  try {
    const requests = {};
    (loaded.requests || []).forEach((r) => { requests[r.id] = r; });
    const envVars = {};
    let activeHost = null;
    if (loaded.uiState?.activeWorkspaceId) {
      const hostResult = await data.host.getActiveVars(loaded.uiState.activeWorkspaceId);
      Object.assign(envVars, hostResult?.variables || {});
      activeHost = hostResult?.host || (loaded.hosts || []).find(
        (h) => h.id === loaded.uiState?.activeHostId,
      ) || null;
    }

    const loadedUI = loaded.uiState || state.uiState;
    const loadedView = loadedUI.activeView || 'request';
    const viewAtEnd = state.uiState.activeView;
    let activeView = loadedView;
    if (viewAtEnd !== viewAtStart && viewAtEnd !== loadedView) {
      activeView = viewAtEnd;
    }

    state = {
      ...state,
      uiState: { ...loadedUI, activeView },
      workspaces: loaded.workspaces || [],
      hosts: loaded.hosts || [],
      activeHost,
      tree: loaded.tree || [],
      requests,
      environments: loaded.environments || [],
      activeEnvVars: envVars,
      workflows: loaded.workflows || [],
      jobRuns: loaded.jobRuns || [],
      loading: false,
    };
    notify();
  } catch (e) {
    console.error('Load failed', e);
    state.loading = false;
    notify();
  } finally {
    hydrating = false;
  }
}

export function requestById(id) {
  return state.requests[id] || null;
}

export function treeChildren(parentId) {
  return state.tree
    .filter((n) => (n.parentId || null) === (parentId || null))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
