import { getWindow } from '../window.js';

export async function list(hostId) {
  return getWindow().ManageEnvs({ action: 'list', hostId });
}

export async function create(workspaceId, hostId, name) {
  return getWindow().ManageEnvs({
    action: 'create',
    workspaceId,
    hostId,
    environment: { name, hostId },
  });
}

export async function remove(envId) {
  return getWindow().ManageEnvs({ action: 'delete', envId });
}

export async function setActive(hostId, envId) {
  return getWindow().ManageEnvs({ action: 'setActive', hostId, envId });
}

export async function saveVariables(envId, variables) {
  return getWindow().ManageEnvs({ action: 'saveVariables', envId, variables });
}

export async function getActiveVars(workspaceId) {
  const w = getWindow();
  if (!w?.GetActiveEnvVars) return {};
  return w.GetActiveEnvVars(workspaceId);
}
