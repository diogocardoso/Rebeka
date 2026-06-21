import { getState, subscribe } from '../../core/store.js';
import { APP } from '../../core/app.js';

let el = null;
let renderToken = 0;

export function mountVariablesPane(container) {
  el = container;
  subscribe((state) => { render(state); });
  render(getState());
}

async function render(state) {
  if (!el) return;
  if (state.uiState.activeView !== 'variables') {
    el.innerHTML = '';
    return;
  }

  const token = ++renderToken;
  const hostId = state.uiState.activeHostId;
  const wsId = state.uiState.activeWorkspaceId;

  if (!hostId) {
    el.innerHTML = '<div class="empty-pane">Configure um host para gerenciar variáveis</div>';
    return;
  }

  let envs = state.environments || [];
  if (!envs.length) {
    envs = await APP.components.envManager.findAll(hostId) || [];
  }

  if (token !== renderToken) return;

  const env = envs.find((e) => e.isActive) || envs[0];

  if (!env) {
    renderCreateProfile(wsId, hostId, token);
    return;
  }

  renderEditor(env, wsId);
}

function renderCreateProfile(wsId, hostId, token) {
  el.innerHTML = `
    <div class="variables-pane">
      <div class="pane-header">
        <h3>Variáveis</h3>
      </div>
      <div class="empty-pane" style="flex-direction:column;gap:12px">
        <p>Nenhum perfil de variáveis neste host.</p>
        <button class="btn btn-primary" data-action="create-profile">Criar perfil Padrão</button>
      </div>
    </div>
  `;

  el.querySelector('[data-action="create-profile"]')?.addEventListener('click', async () => {
    await APP.components.envManager.create(wsId, 'Padrão');
    if (token === renderToken) {
      render(getState());
    }
  });
}

function renderEditor(env, wsId) {
  const rows = env.variables?.length
    ? env.variables.map((v) => ({ key: v.key, value: v.value, enabled: true }))
    : [{ key: '', value: '', enabled: true }];

  el.innerHTML = `
    <div class="variables-pane">
      <div class="pane-header">
        <h3>Variáveis — ${escape(env.name)}</h3>
        <button class="btn btn-primary" data-action="save-vars">Salvar</button>
      </div>
      <div class="pane-body scroll-y">
        ${kvTable(rows)}
      </div>
    </div>
  `;

  bindEvents(env.id, wsId);
}

function kvTable(rows) {
  return `
    <table class="kv-table" data-kv="variables">
      <thead><tr><th>Chave</th><th>Valor</th><th width="32"></th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td><input type="text" value="${escapeAttr(r.key || '')}" data-kv-key /></td>
            <td><input type="text" value="${escapeAttr(r.value || '')}" data-kv-value /></td>
            <td><button class="btn-ghost btn-danger" data-kv-remove>×</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <button class="btn btn-ghost kv-add" data-kv-add>+ Adicionar linha</button>
  `;
}

function bindEvents(envId, wsId) {
  el.querySelector('[data-kv-add]')?.addEventListener('click', () => {
    const tbody = el.querySelector('tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input data-kv-key /></td><td><input data-kv-value /></td><td><button class="btn-ghost btn-danger" data-kv-remove>×</button></td>';
    tbody.appendChild(tr);
    bindRemove();
  });

  bindRemove();

  el.querySelector('[data-action="save-vars"]')?.addEventListener('click', async () => {
    const rows = collectRows();
    await APP.components.envManager.edit(envId, rows, wsId);
    alert('Variáveis salvas');
  });
}

function bindRemove() {
  el.querySelectorAll('[data-kv-remove]').forEach((btn) => {
    btn.onclick = () => btn.closest('tr')?.remove();
  });
}

function collectRows() {
  return [...el.querySelectorAll('tbody tr')].map((tr) => ({
    key: tr.querySelector('[data-kv-key]')?.value || '',
    value: tr.querySelector('[data-kv-value]')?.value || '',
  })).filter((r) => r.key);
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return escape(s).replace(/"/g, '&quot;');
}
