import { getState, patchState } from '../store.js';
import { data } from '../data/index.js';

export async function create(wsId, name, baseUrl) {
  const env = await data.env.create(wsId, name, baseUrl || 'http://localhost:3000');
  await findAll(wsId);
  if (env?.id) {
    await activate(wsId, env.id);
  }
  return env;
}

export async function edit(envId, variables, wsId) {
  await data.env.saveVariables(envId, variables);

  const activeVars = {};
  (variables || []).forEach((v) => {
    if (v.key) activeVars[v.key] = v.value ?? '';
  });

  const envs = await data.env.list(wsId);
  patchState((s) => ({ ...s, activeEnvVars: activeVars, environments: envs || [] }));
}

export async function deleteEnv(envId) {
  await data.env.remove(envId);
}

export async function activate(wsId, envId) {
  await data.env.setActive(wsId, envId);
  const [info, envs] = await Promise.all([
    data.env.getActiveInfo(wsId),
    data.env.list(wsId),
  ]);
  patchState((s) => ({
    ...s,
    activeEnvVars: info?.variables || {},
    environments: envs || [],
    activeEnvironment: info?.environment || envs?.find((e) => e.id === envId) || null,
    uiState: { ...s.uiState, activeEnvironmentId: envId },
  }));
}

export function findByID(id) {
  return getState().environments.find((e) => e.id === id) || null;
}

export async function findAll(wsId) {
  const envs = await data.env.list(wsId);
  patchState((s) => ({ ...s, environments: envs || [] }));
  return envs || [];
}

export async function persistScriptVars(wsId, beforeVars, afterVars) {
  if (!wsId || !afterVars) return;

  const before = beforeVars || {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(afterVars)]);
  const changed = [...allKeys].some((k) => before[k] !== afterVars[k]);
  if (!changed) return;

  const state = getState();
  const envId = state.uiState.activeEnvironmentId;
  const active = state.environments?.find((e) => e.id === envId)
    || state.environments?.find((e) => e.isActive)
    || state.environments?.[0];
  if (!active?.id) return;

  const variables = Object.entries(afterVars).map(([key, value]) => ({ key, value }));
  await edit(active.id, variables, wsId);
}

export const envManager = {
  create,
  edit,
  delete: deleteEnv,
  findByID,
  findAll,
  activate,
  persistScriptVars,
};
