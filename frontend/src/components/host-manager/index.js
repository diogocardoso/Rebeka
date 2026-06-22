import { getState } from '../../core/store.js';
import { APP } from '../../core/app.js';
import { EnvironmentForm } from './forms.js';

let modalRoot = null;

export function openEnvironmentModal() {
  const state = getState();
  const wsId = state.uiState.activeWorkspaceId;
  if (!wsId) return;

  const content = document.createElement('div');
  content.className = 'host-modal';
  content.innerHTML = `<div class="host-list" id="env-list"></div>`;

  if (typeof APP !== 'undefined' && APP.box) {
    APP.box('environment-manager', {
      title: 'Gerenciar Ambientes',
      content: content.outerHTML,
      width: 520,
      height: 420,
      btClose: true,
    });
    setTimeout(() => bindEnvironmentModal(wsId), 100);
  } else {
    renderInlineModal(content, wsId);
  }
}

function renderInlineModal(content, wsId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'environment-manager-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Gerenciar Ambientes</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">${content.innerHTML}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  modalRoot = overlay;
  overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());
  bindEnvironmentModal(wsId, overlay);
}

function getModalRoot() {
  if (modalRoot?.isConnected) return modalRoot;
  return document.getElementById('environment-manager')?.closest('.WA-box') || document.body;
}

async function bindEnvironmentModal(wsId, root = getModalRoot()) {
  const listEl = root.querySelector('#env-list') || document.getElementById('env-list');
  if (!listEl) return;

  const envs = await APP.components.environment.findAll(wsId);
  const state = getState();

  listEl.innerHTML = `
    <button class="btn btn-ghost host-add">+ Novo ambiente</button>
    ${(envs || []).map((e) => `
      <div class="host-item ${e.isActive || e.id === state.uiState.activeEnvironmentId ? 'active' : ''}" data-env-id="${e.id}">
        <div class="host-item-info">
          <strong>${escape(e.name)}</strong>
          <span class="text-muted">${escape(e.baseUrl || '')}</span>
        </div>
        <div class="host-item-actions">
          <button data-activate="${e.id}" title="Ativar">✓</button>
          <button data-edit="${e.id}" title="Editar">✎</button>
          <button data-delete-env="${e.id}" title="Excluir">×</button>
        </div>
      </div>
    `).join('')}
  `;

  listEl.querySelector('.host-add')?.addEventListener('click', () => {
    new EnvironmentForm(null, async ({ name, baseUrl }) => {
      await APP.components.environment.create(wsId, name, baseUrl);
      bindEnvironmentModal(wsId, root);
    }).show();
  });

  listEl.querySelectorAll('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await APP.components.environment.activate(wsId, btn.dataset.activate);
      bindEnvironmentModal(wsId, root);
    });
  });

  listEl.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const env = (envs || []).find((e) => e.id === btn.dataset.edit);
      if (!env) return;
      new EnvironmentForm(env, async ({ name, baseUrl }) => {
        await APP.components.environment.edit({ ...env, name, baseUrl });
        bindEnvironmentModal(wsId, root);
      }).show();
    });
  });

  listEl.querySelectorAll('[data-delete-env]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir ambiente e suas variáveis?')) return;
      await APP.components.environment.delete(btn.dataset.deleteEnv);
      bindEnvironmentModal(wsId, root);
    });
  });
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// compatibilidade
export const openHostModal = openEnvironmentModal;
