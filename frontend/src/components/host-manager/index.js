import { getState } from '../../core/store.js';
import { APP } from '../../core/app.js';
import { HostForm, MirrorHostForm } from './forms.js';

let modalRoot = null;

export function openHostModal() {
  const state = getState();
  const wsId = state.uiState.activeWorkspaceId;
  if (!wsId) return;

  const content = document.createElement('div');
  content.className = 'host-modal';
  content.innerHTML = `
    <div class="host-list" id="host-list"></div>
    <div class="host-actions">
      <button class="btn btn-ghost" id="host-mirror-btn">Espelhar estrutura</button>
    </div>
  `;

  if (typeof APP !== 'undefined' && APP.box) {
    APP.box('host-manager', {
      title: 'Gerenciar Hosts',
      content: content.outerHTML,
      width: 520,
      height: 420,
      btClose: true,
    });
    setTimeout(() => bindHostModal(wsId), 100);
  } else {
    renderInlineModal(content, wsId);
  }
}

function renderInlineModal(content, wsId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'host-manager-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Gerenciar Hosts</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">${content.innerHTML}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  modalRoot = overlay;
  overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());
  bindHostModal(wsId, overlay);
}

function getModalRoot() {
  if (modalRoot?.isConnected) return modalRoot;
  return document.getElementById('host-manager')?.closest('.WA-box') || document.body;
}

async function bindHostModal(wsId, root = getModalRoot()) {
  const listEl = root.querySelector('#host-list') || document.getElementById('host-list');
  if (!listEl) return;

  const hosts = await APP.components.host.findAll(wsId);
  const state = getState();

  listEl.innerHTML = `
    <button class="btn btn-ghost host-add">+ Novo host</button>
    ${(hosts || []).map((h) => `
      <div class="host-item ${h.isActive ? 'active' : ''}" data-host-id="${h.id}">
        <div class="host-item-info">
          <strong>${escape(h.name)}</strong>
          <span class="text-muted">${escape(h.baseUrl)}</span>
        </div>
        <div class="host-item-actions">
          <button data-activate="${h.id}" title="Ativar">✓</button>
          <button data-edit="${h.id}" title="Editar">✎</button>
          <button data-delete-host="${h.id}" title="Excluir">×</button>
        </div>
      </div>
    `).join('')}
  `;

  listEl.querySelector('.host-add')?.addEventListener('click', () => {
    new HostForm(null, async ({ name, baseUrl }) => {
      await APP.components.host.create(wsId, name, baseUrl);
      bindHostModal(wsId, root);
    }).show();
  });

  listEl.querySelectorAll('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await APP.components.host.activate(wsId, btn.dataset.activate);
      bindHostModal(wsId, root);
    });
  });

  listEl.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const host = (hosts || []).find((h) => h.id === btn.dataset.edit);
      if (!host) return;
      new HostForm(host, async ({ name, baseUrl }) => {
        await APP.components.host.edit({ ...host, name, baseUrl });
        bindHostModal(wsId, root);
      }).show();
    });
  });

  listEl.querySelectorAll('[data-delete-host]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir host e todos os dados associados?')) return;
      await APP.components.host.delete(btn.dataset.deleteHost);
      bindHostModal(wsId, root);
    });
  });

  const mirrorBtn = root.querySelector('#host-mirror-btn') || document.getElementById('host-mirror-btn');
  mirrorBtn?.replaceWith(mirrorBtn.cloneNode(true));
  root.querySelector('#host-mirror-btn')?.addEventListener('click', () => {
    const source = (hosts || []).find((h) => h.id === state.uiState.activeHostId) || hosts?.[0];
    if (!source) return;
    new MirrorHostForm(source, hosts, async (sourceId, targetId) => {
      await APP.components.host.mirror(sourceId, targetId);
      if (targetId === getState().uiState.activeHostId) {
        await APP.components.host.reloadActiveHost();
      }
      alert('Estrutura espelhada com sucesso.');
    }).show();
  });
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
