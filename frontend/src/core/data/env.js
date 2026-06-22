import { getWindow } from '../window.js';

export async function list(workspaceId) {
  return getWindow().ManageEnvs({ action: 'list', workspaceId });
}

export async function create(workspaceId, name, baseUrl) {
  return getWindow().ManageEnvs({
    action: 'create',
    workspaceId,
    environment: { name, baseUrl },
  });
}

export async function update(environment) {
  return getWindow().ManageEnvs({
    action: 'update',
    environment,
  });
}

export async function remove(envId) {
  return getWindow().ManageEnvs({ action: 'delete', envId });
}

export async function setActive(workspaceId, envId) {
  return getWindow().ManageEnvs({ action: 'setActive', workspaceId, envId });
}

export async function saveVariables(envId, variables) {
  return getWindow().ManageEnvs({ action: 'saveVariables', envId, variables });
}

export async function getActiveVars(workspaceId) {
  const w = getWindow();
  if (!w?.GetActiveEnvVars) return {};
  return w.GetActiveEnvVars(workspaceId);
}

export async function getActiveInfo(workspaceId) {
  const w = getWindow();
  if (!w?.GetActiveEnvironmentInfo) return { environment: null, variables: {} };
  return w.GetActiveEnvironmentInfo(workspaceId);
}
