import { getState, subscribe } from '../core/store.js';
import { registerViewApplier, setActiveView } from '../core/view.js';
import { APP } from '../core/app.js';
import { mountSidebar } from '../components/sidebar/index.js';
import { mountRequestPane } from '../components/request-pane/index.js';
import { mountResponsePane } from '../components/response-pane/index.js';
import { mountTestResults } from '../components/TestResults.js';
import { mountVariablesPane } from '../components/variables-pane/index.js';
import { mountScriptsPane } from '../components/scripts-pane/index.js';
import { mountScriptConsole } from '../components/script-console/index.js';
import { mountWorkflowCanvas, createWorkflow } from '../components/workflow/index.js';
import { openEnvironmentModal } from '../components/host-manager/index.js';
import { mountWorkspaceHeader } from '../components/workspace/index.js';
import { mountDocsDrawer } from '../components/docs-pane/index.js';
import { bindWindowControls } from '../utils/windowChrome.js';
import logoUrl from '../assets/images/logo.png';

let root = null;
//<button class="btn btn-ghost" data-view="workflow">Workflow</button>
//<button class="btn btn-ghost" data-action="new-workflow">+ Workflow</button>
export function mountAppLayout(container) {
  root = container;
  root.innerHTML = `
    <div class="app-layout">
      <header class="app-header">
        <div class="header-brand">
          <img class="header-logo" src="${logoUrl}" alt="Rebeka" />         
        </div>
        <div class="header-workspace" id="header-workspace"></div>
        <div class="header-host">
          <select id="env-select" class="host-select" title="Ambiente"></select>
          <button class="btn btn-ghost" data-action="manage-env">${WA.Icon.add('var(--gray-3)',12)}</button>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost ${''}" data-view="request">Requisição</button>          
          <button class="btn btn-ghost" data-action="import-bek">Importar</button>
          <button class="btn btn-ghost" data-action="export-bek">Exportar</button>          
          <div class="window-controls">
            <button type="button" class="win-btn win-minimize" data-win="minimize" title="Minimizar"><span></span></button>
            <button type="button" class="win-btn win-maximize" data-win="maximize" title="Maximizar"><span></span></button>
            <button type="button" class="win-btn win-close" data-win="close" title="Fechar">${WA.Icon.show({ type: 'close', color: 'currentColor', size: 12 })}</button>
          </div>
        </div>
      </header>
      <div class="app-body">
        <aside class="app-sidebar" id="sidebar"></aside>
        <div class="app-content-wrap">
          <main class="app-main">
            <div class="split-vertical" id="request-split">
              <div class="pane-request" id="request-pane"></div>
              <div class="pane-response" id="response-pane"></div>
              <div class="pane-script-console" id="script-console"></div>
              <div class="pane-tests" id="test-results"></div>
            </div>
            <div class="pane-variables hidden" id="variables-pane"></div>
            <div class="pane-scripts hidden" id="scripts-pane"></div>
            <div class="pane-workflow hidden" id="workflow-pane"></div>
          </main>
          <div class="panel-resizer docs-resizer" id="docs-resizer" title="Arraste para redimensionar"></div>
          <aside class="docs-drawer" id="docs-drawer"></aside>
        </div>
      </div>
    </div>
  `;

  mountWorkspaceHeader(root.querySelector('#header-workspace'));
  mountSidebar(root.querySelector('#sidebar'));
  mountRequestPane(root.querySelector('#request-pane'));
  mountResponsePane(root.querySelector('#response-pane'));
  mountScriptConsole(root.querySelector('#script-console'));
  mountTestResults(root.querySelector('#test-results'));
  mountVariablesPane(root.querySelector('#variables-pane'));
  mountScriptsPane(root.querySelector('#scripts-pane'));
  mountWorkflowCanvas(root.querySelector('#workflow-pane'));
  mountDocsDrawer(
    root.querySelector('#docs-drawer'),
    root.querySelector('#docs-resizer'),
  );

  bindHeader();
  bindWindowControls(root);
  registerViewApplier(applyViewUI);
  subscribe(renderHeader);
  renderHeader(getState());
}

function bindHeader() {
  root.querySelector('#env-select')?.addEventListener('change', async (e) => {
    const wsId = getState().uiState.activeWorkspaceId;
    await APP.components.environment.activate(wsId, e.target.value);
  });

  root.querySelector('[data-action="manage-env"]')?.addEventListener('click', openEnvironmentModal);

  root.querySelector('[data-action="export-bek"]')?.addEventListener('click', async () => {
    const wsId = getState().uiState.activeWorkspaceId;
    const path = await APP.components.workspace.exportBek(wsId);
    if (path) APP.toast(`Exportado: ${path}`, { type: 'success', duration: 3500 });
  });

  root.querySelector('[data-action="import-bek"]')?.addEventListener('click', async () => {
    await APP.components.workspace.importBek();
  });

  root.querySelector('[data-action="new-workflow"]')?.addEventListener('click', async () => {
    const wsId = getState().uiState.activeWorkspaceId;
    const name = prompt('Nome do workflow:', 'Novo Workflow');
    await createWorkflow(wsId, name);
    switchView('workflow');
  });

  root.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function applyViewUI(view) {
  const isWorkflow = view === 'workflow';
  const isVariables = view === 'variables';
  const isScripts = view === 'scripts';
  const isRequest = view === 'request';

  root.querySelector('#request-split')?.classList.toggle('hidden', !isRequest);
  root.querySelector('#variables-pane')?.classList.toggle('hidden', !isVariables);
  root.querySelector('#scripts-pane')?.classList.toggle('hidden', !isScripts);
  root.querySelector('#workflow-pane')?.classList.toggle('hidden', !isWorkflow);

  root.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('btn-primary', btn.dataset.view === view);
    btn.classList.toggle('btn-ghost', btn.dataset.view !== view);
  });
}

function switchView(view) {
  setActiveView(view);
}

function renderHeader(state) {
  const envSelect = root.querySelector('#env-select');
  if (envSelect) {
    envSelect.innerHTML = (state.environments || []).map((e) =>
      `<option value="${e.id}" ${e.isActive || e.id === state.uiState.activeEnvironmentId ? 'selected' : ''}>${escape(e.name)}</option>`
    ).join('');
    if (!state.environments?.length) {
      envSelect.innerHTML = '<option value="">Sem ambiente</option>';
    }
  }

  applyViewUI(state.uiState.activeView || 'request');
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
