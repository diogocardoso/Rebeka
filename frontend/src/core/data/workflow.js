import { getWindow } from '../window.js';

export async function create(workspaceId, hostId, name) {
  return getWindow().CreateWorkflow(workspaceId, hostId, name);
}

export async function saveGraph(id, graph) {
  return getWindow().SaveWorkflowGraph(id, graph);
}

export async function run(workflowId, workspaceId) {
  return getWindow().RunWorkflow(workflowId, workspaceId);
}

export async function schedule(workflowId, intervalSeconds = 60) {
  return getWindow().ScheduleJob(workflowId, intervalSeconds);
}
