import { getState, patchState, scheduleSave } from '../store.js';
import { data } from '../data/index.js';

export async function create(workspaceId, name) {
  const wf = await data.workflow.create(workspaceId, name || 'Novo Workflow');
  patchState((s) => ({
    ...s,
    workflows: [...s.workflows, wf],
    uiState: { ...s.uiState, activeView: 'workflow', activeWorkflowId: wf.id },
  }));
  scheduleSave();
  return wf;
}

export async function edit(workflowId, graph) {
  const json = JSON.stringify(graph);
  patchState((s) => ({
    ...s,
    workflows: s.workflows.map((w) => (w.id === workflowId ? { ...w, graph: json } : w)),
  }));
  await data.workflow.saveGraph(workflowId, json);
  scheduleSave();
}

export async function run(workflowId) {
  const wsId = getState().uiState.activeWorkspaceId;
  return data.workflow.run(workflowId, wsId);
}

export async function schedule(workflowId, intervalSeconds = 60) {
  await data.workflow.schedule(workflowId, intervalSeconds);
}

export function addNode(graph) {
  const state = getState();
  const req = state.requests[state.uiState.activeRequestId];
  const id = `node-${Date.now()}`;
  graph.nodes.push({
    id,
    label: req ? 'Request' : 'Novo Passo',
    x: 60 + graph.nodes.length * 30,
    y: 60 + graph.nodes.length * 20,
    request: req ? {
      method: req.method,
      url: req.url,
      queryParams: JSON.parse(req.queryParams || '[]'),
      headers: JSON.parse(req.headers || '[]'),
      bodyType: req.bodyType,
      body: req.body,
      authType: req.authType,
      authData: JSON.parse(req.authData || '{}'),
      variables: state.activeEnvVars,
    } : {
      method: 'GET',
      url: '',
      queryParams: [],
      headers: [],
      bodyType: 'none',
      body: '',
      authType: 'none',
      authData: {},
    },
  });
}

export const workflow = { create, edit, run, schedule, addNode };
