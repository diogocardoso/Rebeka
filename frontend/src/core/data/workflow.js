import { getWindow } from '../window.js';

export async function create(workspaceId, name) {
  return getWindow().CreateWorkflow(workspaceId, name);
}

export async function saveGraph(id, graph) {
  return getWindow().SaveWorkflowGraph(id, graph);
}

export async function run(workflowId, workspaceId) {
  return getWindow().RunWorkflow(workflowId, workspaceId);
}

export async function schedule(workflowId, intervalSeconds) {
  return getWindow().ScheduleJob(workflowId, intervalSeconds);
}
