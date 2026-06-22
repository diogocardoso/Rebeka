import { getState } from '../../core/store.js';
import { APP } from '../../core/app.js';

export function openEnvModal() {
  const state = getState();
  const wsId = state.uiState.activeWorkspaceId;
  if (!wsId) return;

  const content = document.createElement('div');
  content.className = 'env-modal';
  content.innerHTML = `
    <div class="env-list" id="env-list"></div>
    <div class="env-editor" id="env-editor">
      <p class="text-muted">Selecione um ambiente para editar variáveis</p>
    </div>
  `;

  if (typeof APP !== 'undefined' && APP.box) {
    APP.box('env-manager', {
      title: 'Ambientes e Variáveis',
      content: content.outerHTML,
      width: 720,
      height: 480,
      skin: 'dark',
      btClose: true,
    });
    setTimeout(() => renderEnvList(wsId), 100);
  } else {
    renderInlineModal(content, wsId);
  }
}

function renderInlineModal(content, wsId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Ambientes e Variáveis</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">${content.innerHTML}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  renderEnvList(wsId, overlay);
}

async function renderEnvList(wsId, root = document) {
  const listEl = root.querySelector('#env-list') || document.getElementById('env-list');
  if (!listEl) return;

  const envs = await APP.components.envManager.findAll(wsId);

  listEl.innerHTML = `
    <button class="btn btn-ghost env-add">+ Novo ambiente</button>
    ${(envs || []).map((e) => `
      <div class="env-item ${e.isActive ? 'active' : ''}" data-env-id="${e.id}">
        <span>${escape(e.name)} <small class="text-muted">${escape(e.baseUrl || '')}</small></span>
        <div class="env-item-actions">
          <button data-activate="${e.id}" title="Ativar">✓</button>
          <button data-edit="${e.id}" title="Editar vars">✎</button>
          <button data-delete-env="${e.id}" title="Excluir">×</button>
        </div>
      </div>
    `).join('')}
  `;

  listEl.querySelector('.env-add')?.addEventListener('click', async () => {
    const name = prompt('Nome do ambiente:', 'Homolog');
    if (!name) return;
    const baseUrl = prompt('Base URL:', 'http://localhost:3000');
    if (!baseUrl) return;
    await APP.components.environment.create(wsId, name, baseUrl);
    renderEnvList(wsId, root);
  });

  listEl.querySelectorAll('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await APP.components.environment.activate(wsId, btn.dataset.activate);
      renderEnvList(wsId, root);
    });
  });

  listEl.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => renderEnvEditor(btn.dataset.edit, envs, wsId, root));
  });

  listEl.querySelectorAll('[data-delete-env]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir ambiente?')) return;
      await APP.components.environment.delete(btn.dataset.deleteEnv);
      renderEnvList(wsId, root);
    });
  });
}

function renderEnvEditor(envId, envs, wsId, root) {
  const editor = root.querySelector('#env-editor') || document.getElementById('env-editor');
  if (!editor) return;
  const env = (envs || []).find((e) => e.id === envId);
  if (!env) return;

  const vars = env.variables || [];
  editor.innerHTML = `
    <h4>${escape(env.name)}</h4>
    <table class="kv-table" id="env-vars-table">
      <thead><tr><th>Chave</th><th>Valor</th><th></th></tr></thead>
      <tbody>
        ${(vars.length ? vars : [{ key: '', value: '' }]).map((v, i) => `
          <tr data-idx="${i}">
            <td><input type="text" value="${escapeAttr(v.key)}" data-var-key /></td>
            <td><input type="text" value="${escapeAttr(v.value)}" data-var-val /></td>
            <td><button data-var-rm>×</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <button class="btn btn-ghost" id="env-var-add">+ Variável</button>
    <button class="btn btn-primary" id="env-var-save">Salvar</button>
  `;

  editor.querySelector('#env-var-add')?.addEventListener('click', () => {
    const tbody = editor.querySelector('tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input data-var-key /></td><td><input data-var-val /></td><td><button data-var-rm>×</button></td>';
    tbody.appendChild(tr);
    bindVarRemove(editor);
  });

  bindVarRemove(editor);

  editor.querySelector('#env-var-save')?.addEventListener('click', async () => {
    const rows = [...editor.querySelectorAll('tbody tr')].map((tr) => ({
      key: tr.querySelector('[data-var-key]')?.value || '',
      value: tr.querySelector('[data-var-val]')?.value || '',
    })).filter((r) => r.key);
    await APP.components.envManager.edit(envId, rows, wsId);
    APP.toast?.('Variáveis salvas', { type: 'success' });
  });
}

function bindVarRemove(editor) {
  editor.querySelectorAll('[data-var-rm]').forEach((btn) => {
    btn.onclick = () => btn.closest('tr')?.remove();
  });
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return escape(s).replace(/"/g, '&quot;');
}
