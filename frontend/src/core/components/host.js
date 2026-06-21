import { getState, patchState, scheduleSave, REQUEST_SESSION_RESET } from '../store.js';
import { data } from '../data/index.js';
import { history } from './history.js';
export async function create(wsId, name, baseUrl) {
  await data.host.create(wsId, name, baseUrl);
  await findAll(wsId);
}

export async function edit(host) {
  await data.host.update(host);
  await findAll(host.workspaceId);
}

export async function deleteHost(hostId) {
  await data.host.remove(hostId);
  const wsId = getState().uiState.activeWorkspaceId;
  await findAll(wsId);
}

export async function activate(wsId, hostId) {
  await data.host.setActive(wsId, hostId);
  const [hostData, activeResult, hosts] = await Promise.all([
    data.host.loadData(hostId),
    data.host.getActiveVars(wsId),
    data.host.list(wsId),
  ]);

  const activeRequestId = getState().uiState.activeRequestId;
  const requestStillValid = hostData.requests?.some((r) => r.id === activeRequestId);

  patchState((s) => {
    const requests = {};
    (hostData.requests || []).forEach((r) => { requests[r.id] = r; });
    return {
      ...s,
      ...REQUEST_SESSION_RESET,
      requestHistory: [],
      hosts: hosts || [],
      uiState: {
        ...s.uiState,
        activeHostId: hostId,
        activeRequestId: requestStillValid ? activeRequestId : '',
      },
      tree: hostData.tree || [],
      requests,
      environments: hostData.environments || [],
      workflows: hostData.workflows || [],
      activeEnvVars: activeResult?.variables || {},
      activeHost: activeResult?.host || hosts?.find((h) => h.id === hostId) || null,
    };
  });
  scheduleSave();
  if (requestStillValid && activeRequestId) {
    await history.loadForRequest(activeRequestId);
  }
}

export async function mirror(sourceHostId, targetHostId) {
  return data.host.mirror(sourceHostId, targetHostId);
}

export async function mirrorBranch(sourceNodeId, targetHostId) {
  return data.host.mirrorBranch(sourceNodeId, targetHostId);
}

export function findByID(id) {
  return getState().hosts.find((h) => h.id === id) || null;
}

export async function findAll(wsId) {
  const hosts = await data.host.list(wsId);
  patchState((s) => ({ ...s, hosts: hosts || [] }));
  return hosts || [];
}

export async function reloadActiveHost() {
  const { uiState } = getState();
  if (!uiState.activeHostId) return;
  await activate(uiState.activeWorkspaceId, uiState.activeHostId);
}

export const host = {
  create,
  edit,
  delete: deleteHost,
  findByID,
  findAll,
  activate,
  mirror,
  mirrorBranch,
  reloadActiveHost,
};
