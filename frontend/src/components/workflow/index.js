import { getState, subscribe } from '../../core/store.js';
import { addNode, createWorkflow } from './create.js';
import { saveGraph, runWorkflow, scheduleWorkflow } from './edit.js';

export { createWorkflow };

let canvasEl = null;
let svgEl = null;
let graph = { nodes: [], edges: [] };
let dragging = null;
let connecting = null;
let workflowId = '';

const NODE_W = 180;
const NODE_H = 72;

export function mountWorkflowCanvas(container) {
  canvasEl = container;
  subscribe(onStateChange);
  onStateChange(getState());
}

function onStateChange(state) {
  if (state.uiState.activeView !== 'workflow') return;
  const wfId = state.uiState.activeWorkflowId || state.workflows[0]?.id;
  if (!wfId) {
    canvasEl.innerHTML = '<div class="empty-pane">Crie um workflow para começar</div>';
    return;
  }
  workflowId = wfId;
  const wf = state.workflows.find((w) => w.id === wfId);
  try {
    graph = JSON.parse(wf?.graph || '{"nodes":[],"edges":[]}');
  } catch {
    graph = { nodes: [], edges: [] };
  }
  render();
}

function render() {
  if (!canvasEl) return;

  canvasEl.innerHTML = `
    <div class="workflow-toolbar">
      <button class="btn btn-ghost" data-wf-add>+ Nó</button>
      <button class="btn btn-primary" data-wf-run>Executar</button>
      <button class="btn btn-ghost" data-wf-schedule>Agendar (60s)</button>
      <span class="wf-status" id="wf-status"></span>
    </div>
    <div class="workflow-canvas-wrap">
      <svg class="workflow-svg" id="workflow-svg"></svg>
      <div class="workflow-nodes" id="workflow-nodes"></div>
    </div>
  `;

  svgEl = canvasEl.querySelector('#workflow-svg');
  const nodesEl = canvasEl.querySelector('#workflow-nodes');

  graph.edges.forEach((e) => drawEdge(e));
  graph.nodes.forEach((n) => nodesEl.appendChild(createNodeEl(n)));

  canvasEl.querySelector('[data-wf-add]')?.addEventListener('click', handleAddNode);
  canvasEl.querySelector('[data-wf-run]')?.addEventListener('click', handleRunWorkflow);
  canvasEl.querySelector('[data-wf-schedule]')?.addEventListener('click', handleScheduleWorkflow);
}

function handleAddNode() {
  addNode(graph);
  saveGraph(workflowId, graph);
  render();
}

async function handleRunWorkflow() {
  const status = canvasEl.querySelector('#wf-status');
  if (status) status.textContent = 'Executando...';
  try {
    const result = await runWorkflow(workflowId);
    if (status) status.textContent = `Status: ${result.status} (${result.results?.length || 0} nós)`;
  } catch (e) {
    if (status) status.textContent = `Erro: ${e.message}`;
  }
}

async function handleScheduleWorkflow() {
  await scheduleWorkflow(workflowId);
  const status = canvasEl.querySelector('#wf-status');
  if (status) status.textContent = 'Job agendado a cada 60s';
}

function createNodeEl(node) {
  const el = document.createElement('div');
  el.className = 'wf-node';
  el.dataset.id = node.id;
  el.style.left = `${node.x || 40}px`;
  el.style.top = `${node.y || 40}px`;
  el.innerHTML = `
    <div class="wf-node-header">${escape(node.label || 'Request')}</div>
    <div class="wf-node-method">${node.request?.method || 'GET'}</div>
    <div class="wf-node-url">${escape((node.request?.url || '').slice(0, 30))}</div>
    <button class="wf-anchor wf-anchor-out" data-anchor="out" title="Conectar">+</button>
    <button class="wf-anchor wf-anchor-in" data-anchor="in" title="Entrada">+</button>
  `;

  el.addEventListener('mousedown', (e) => {
    if (e.target.closest('.wf-anchor')) return;
    dragging = { id: node.id, ox: e.clientX - (node.x || 40), oy: e.clientY - (node.y || 40) };
  });

  el.querySelector('[data-anchor="out"]')?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    connecting = { from: node.id };
  });

  el.querySelector('[data-anchor="in"]')?.addEventListener('mouseup', (e) => {
    if (!connecting || connecting.from === node.id) return;
    e.stopPropagation();
    graph.edges.push({ from: connecting.from, to: node.id });
    connecting = null;
    saveGraph(workflowId, graph);
    render();
  });

  return el;
}

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const node = graph.nodes.find((n) => n.id === dragging.id);
  if (!node) return;
  const wrap = canvasEl?.querySelector('.workflow-canvas-wrap');
  if (!wrap) return;
  node.x = Math.max(0, e.clientX - wrap.getBoundingClientRect().left - 90);
  node.y = Math.max(0, e.clientY - wrap.getBoundingClientRect().top - 36);
  const nodeEl = canvasEl.querySelector(`[data-id="${node.id}"]`);
  if (nodeEl) {
    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;
  }
  redrawEdges();
});

document.addEventListener('mouseup', () => {
  if (dragging) {
    saveGraph(workflowId, graph);
    dragging = null;
  }
});

function drawEdge(edge) {
  const from = graph.nodes.find((n) => n.id === edge.from);
  const to = graph.nodes.find((n) => n.id === edge.to);
  if (!from || !to || !svgEl) return;
  const x1 = (from.x || 0) + NODE_W;
  const y1 = (from.y || 0) + NODE_H / 2;
  const x2 = to.x || 0;
  const y2 = (to.y || 0) + NODE_H / 2;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const mx = (x1 + x2) / 2;
  path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  path.setAttribute('stroke', '#6c5ce7');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('fill', 'none');
  path.dataset.edge = `${edge.from}-${edge.to}`;
  svgEl.appendChild(path);
}

function redrawEdges() {
  if (!svgEl) return;
  svgEl.innerHTML = '';
  graph.edges.forEach(drawEdge);
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
