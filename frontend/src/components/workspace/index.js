import { getState, subscribe } from '../../core/store.js';
import { APP } from '../../core/app.js';
import { WorkspaceForm } from './forms.js';

let root = null;
const Icon = {
        add: WA.Icon.show({ type: 'add', color: 'var(--gray-3)', size:12 }),
};

export function mountWorkspaceHeader(container) {
  root = container;
  root.innerHTML = `
    <select id="workspace-select" class="workspace-select"></select>
    <button class="btn btn-ghost" data-action="new-workspace">${Icon.add}</button>
  `;

  bindEvents();
  subscribe(render);
  render(getState());
}

function bindEvents() {
  root.querySelector('[data-action="new-workspace"]')?.addEventListener('click', () => {
    new WorkspaceForm(async (name) => {
      await APP.components.workspace.create(name);
    }).show();
  });

  root.querySelector('#workspace-select')?.addEventListener('change', async (e) => {
    await APP.components.workspace.activate(e.target.value);
  });
}

function render(state) {
  const wsSelect = root.querySelector('#workspace-select');
  if (!wsSelect) return;

  if (!state.workspaces?.length) {
    wsSelect.innerHTML = '<option value="">Sem workspace</option>';
    return;
  }

  wsSelect.innerHTML = state.workspaces.map((w) =>
    `<option value="${w.id}" ${w.id === state.uiState.activeWorkspaceId ? 'selected' : ''}>${escape(w.name)}</option>`
  ).join('');
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
