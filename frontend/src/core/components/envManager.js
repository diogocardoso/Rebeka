import { getState, patchState } from '../store.js';
import { data } from '../data/index.js';

export async function create(wsId, name) {
  const hostId = getState().uiState.activeHostId;
  const env = await data.env.create(wsId, hostId, name);
  await findAll(hostId);
  if (env?.id) {
    await activate(hostId, env.id);
  }
  return env;
}

export async function edit(envId, variables, wsId) {
  const hostId = getState().uiState.activeHostId;
  let envs = hostId ? await data.env.list(hostId) : [];
  const target = envs.find((e) => e.id === envId);
  if (target && !target.isActive && hostId) {
    await data.env.setActive(hostId, envId);
  }

  await data.env.saveVariables(envId, variables);

  const activeVars = {};
  (variables || []).forEach((v) => {
    if (v.key) activeVars[v.key] = v.value ?? '';
  });

  envs = hostId ? await data.env.list(hostId) : envs;
  patchState((s) => ({ ...s, activeEnvVars: activeVars, environments: envs || [] }));
}

export async function deleteEnv(envId) {
  await data.env.remove(envId);
}

export async function activate(hostId, envId) {
  await data.env.setActive(hostId, envId);
  const wsId = getState().uiState.activeWorkspaceId;
  const [vars, envs] = await Promise.all([
    data.env.getActiveVars(wsId),
    data.env.list(hostId),
  ]);
  patchState((s) => ({ ...s, activeEnvVars: vars || {}, environments: envs || [] }));
}

export function findByID(id) {
  return getState().environments.find((e) => e.id === id) || null;
}

export async function findAll(hostId) {
  const envs = await data.env.list(hostId);
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
  const envs = state.environments || [];
  const active = envs.find((e) => e.isActive) || envs[0];
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
