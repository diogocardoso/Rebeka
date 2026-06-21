import { getWindow } from '../window.js';

export async function list(workspaceId) {
  return getWindow().ManageHosts({ action: 'list', workspaceId });
}

export async function create(workspaceId, name, baseUrl) {
  return getWindow().ManageHosts({
    action: 'create',
    workspaceId,
    host: { name, baseUrl },
  });
}

export async function update(host) {
  return getWindow().ManageHosts({
    action: 'update',
    host,
  });
}

export async function remove(hostId) {
  return getWindow().ManageHosts({ action: 'delete', hostId });
}

export async function setActive(workspaceId, hostId) {
  return getWindow().ManageHosts({ action: 'setActive', workspaceId, hostId });
}

export async function loadData(hostId) {
  return getWindow().LoadHostData(hostId);
}

export async function mirror(sourceHostId, targetHostId) {
  return getWindow().MirrorHostStructure(sourceHostId, targetHostId);
}

export async function mirrorBranch(sourceNodeId, targetHostId) {
  return getWindow().MirrorTreeBranch(sourceNodeId, targetHostId);
}

export async function getActiveVars(workspaceId) {
  const w = getWindow();
  if (!w?.GetActiveHostVars) return { host: null, variables: {} };
  return w.GetActiveHostVars(workspaceId);
}
