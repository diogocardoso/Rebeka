import { getState, patchState, scheduleSave } from '../store.js';
import { data } from '../data/index.js';

export async function create(wsId, name, baseUrl) {
  await data.env.create(wsId, name, baseUrl);
  await findAll(wsId);
}

export async function edit(environment) {
  await data.env.update(environment);
  await findAll(environment.workspaceId);
}

export async function deleteEnv(envId) {
  await data.env.remove(envId);
  const wsId = getState().uiState.activeWorkspaceId;
  await findAll(wsId);
}

export async function activate(wsId, envId) {
  await data.env.setActive(wsId, envId);
  const [info, envs] = await Promise.all([
    data.env.getActiveInfo(wsId),
    data.env.list(wsId),
  ]);

  patchState((s) => ({
    ...s,
    environments: envs || [],
    uiState: {
      ...s.uiState,
      activeEnvironmentId: envId,
    },
    activeEnvironment: info?.environment || envs?.find((e) => e.id === envId) || null,
    activeEnvVars: info?.variables || {},
  }));
  scheduleSave();
}

export function findByID(id) {
  return getState().environments.find((e) => e.id === id) || null;
}

export async function findAll(wsId) {
  const envs = await data.env.list(wsId);
  patchState((s) => ({ ...s, environments: envs || [] }));
  return envs || [];
}

export const environment = {
  create,
  edit,
  delete: deleteEnv,
  findByID,
  findAll,
  activate,
};
