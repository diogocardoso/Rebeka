import { getState, subscribe, patchState, scheduleSave, treeChildren, REQUEST_SESSION_RESET } from '../../core/store.js';
import { setActiveView } from '../../core/view.js';
import { APP } from '../../core/app.js';
import { createNode } from './create.js';
import { renameNode } from './edit.js';
import { deleteNode } from './delete.js';
import { isNodeExpanded, toggleNodeExpanded, expandNode } from './expanded.js';
import { Handlers } from './handlers.js';
import { bindTreeDragDrop, shouldSuppressTreeClick } from './dragdrop.js';
import { moveNode } from './move.js';
import { toggleDocsDrawer, isDocsOpen } from '../docs-pane/index.js';

const Sidebar = new WA.Element();
let el = null;

const icon_folder = WA.Icon.show({ type: 'folder2', color: '#fff', size: 16 });
const icon_folder_open = WA.Icon.show({ type: 'folder2_open', color: '#fff', size: 16 });
const icon_add = WA.Icon.show({ type: 'add', color: '#fff', size: 16 });
const icon_delete = WA.Icon.show({ type: 'trash', color: '#fff', size: 16 });
const icon_settings = WA.Icon.show({ type: 'settings3', color: '#fff', size: 16 });
const icon_rename = WA.Icon.show({ type: 'rename', color: '#fff', size: 16 });
const icon_variables = WA.Icon.show({ type: 'config_fill', color:'var(--orange-5)', size: 12 });
const icon_docs = WA.Icon.show({ type: 'doc', color: 'var(--accent)', size: 12 });

const Template = {
  menuActions: {
    folder(item) {
      const jsonNode = WA.hp.json_encode(item);
      return `
        <div class="item" onclick="addRequest('${jsonNode}');"><span>Request</span> ${icon_add}</div>
        <div class="item" onclick="editSidebar('${jsonNode}');"><span>Renomear</span> ${icon_rename}</div>
        <div class="item" onclick="confirmDeleteSidebar('${jsonNode}');"><span>Excluir</span> ${icon_delete}</div>
      `;
    },
    request(item) {
      const jsonNode = WA.hp.json_encode(item);
      return `
        <div class="item" onclick="editSidebar('${jsonNode}');"><span>Renomear</span> ${icon_rename}</div>
        <div class="item" onclick="confirmDeleteSidebar('${jsonNode}');"><span>Excluir</span> ${icon_delete}</div>
      `;
    },
  },
};

export function mountSidebar(container) {
  el = container;
  Sidebar.add('main', container);
  subscribe(render);

  getState().tree
    .filter((n) => n.type === 'folder' && !n.parentId)
    .forEach((n) => expandNode(n.id));

  render(getState());
  new Handlers().register();

  window.addEventListener('rebeka:docs-toggle', () => render(getState()));
}

function renderSpecialItems(state) {
  const view = state.uiState.activeView;
  return `
    <div class="tree-node tree-special ${view === 'variables' ? 'active' : ''}" data-type="variables" style="padding-left:0">
      <span class="tree-spacer"></span>
      <span class="tree-icon">${icon_variables}</span>
      <span class="m-let-1 f-size-1 c-orange-5">Variáveis</span>
    </div>   
  `;
}

function render(state) {
  if (!el) return;
  const roots = treeChildren(null);

  Sidebar.content('main', `
    <div class="sidebar-inner">
      <div class="sidebar-header">
        <span class="sidebar-title">Coleções</span>
        <div class="sidebar-actions">
          <button class="btn-icon" data-action="add-folder" title="Nova pasta">${icon_folder}</button>
          <button class="btn-icon" data-action="add-request" title="Nova requisição">${icon_add}</button>
          <button class="btn-icon" title="Excluir workspace" onclick="confirmDeleteWorkspace();">${icon_delete}</button>
        </div>
      </div>
      <div class="sidebar-tree scroll-y">
        ${renderSpecialItems(state)}
        ${roots.map((n) => renderNode(n, state, 0)).join('')}
      </div>
      <div class="sidebar-footer">
        <button type="button" class="sidebar-docs-btn ${isDocsOpen() ? 'active' : ''}" data-action="toggle-docs">
          <span class="tree-icon">${icon_docs}</span>
          <span>Documentação</span>
        </button>
      </div>
    </div>
  `);

  Sidebar.add('add-folder', '[data-action="add-folder"]');
  Sidebar.add('add-request', '[data-action="add-request"]');

  Sidebar.addEvent('add-folder', 'click', () => createNode('folder', 'Nova Pasta'));
  Sidebar.addEvent('add-request', 'click', () => createNode('request', 'Nova Requisição'));

  el.querySelector('[data-action="toggle-docs"]')?.addEventListener('click', () => {
    toggleDocsDrawer();
    render(getState());
  });

  bindTreeEvents(state);

  const treeEl = el.querySelector('.sidebar-tree');
  bindTreeDragDrop(treeEl, {
    onMove: (dragId, targetId, zone) => moveNode(dragId, targetId, zone),
  });
}

function closeMenuActions(id) {
  const menu = el.querySelector(`[data-id="menu-actions-${id}"]`);
  if (menu) menu.style.display = 'none';
}

function toggleMenuActions(id) {
  const menu = el.querySelector(`[data-id="menu-actions-${id}"]`);
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  el.querySelectorAll('.tree-menu-actions').forEach((m) => { m.style.display = 'none'; });
  menu.style.display = isOpen ? 'none' : 'block';
}

function renderNode(node, state, depth) {
  const children = treeChildren(node.id);
  const isExpanded = isNodeExpanded(node.id);
  const isActive = state.uiState.activeRequestId === node.id;
  const icon = node.type === 'folder' ? (isExpanded ? icon_folder_open : icon_folder) : methodIcon(state.requests[node.id]?.method);
  const indent = depth * 16;

  let html = `
    <div class="tree-node ${isActive ? 'active' : ''}" data-id="${node.id}" data-type="${node.type}" style="padding-left:${12 + indent}px">
      ${node.type === 'folder' ? `<button class="tree-toggle" data-toggle="${node.id}">${isExpanded ? '▼' : '▶'}</button>` : '<span class="tree-spacer"></span>'}
      <span class="tree-icon">${icon}</span>
      <span class="tree-label" data-rename="${node.id}">${escape(node.name)}</span>
      <div class="tree-menu d-flex">
        <button class="WA-bt transparent-gray p-0-01" data-menu-toggle="${node.id}" title="Ações">${icon_settings}</button>
      </div>
      <div class="tree-menu-actions" data-id="menu-actions-${node.id}">
        ${Template.menuActions[node.type](node)}
      </div>
    </div>
  `;

  if (node.type === 'folder' && isExpanded) {
    html += children.map((c) => renderNode(c, state, depth + 1)).join('');
  }
  return html;
}

function methodIcon(method) {
  const colors = { GET: '#61affe', POST: '#49cc90', PUT: '#fca130', PATCH: '#51A2FF', DELETE: '#f93e3e' };
  const m = (method || 'GET').toUpperCase();
  return `<span style="color:${colors[m] || '#aaa'};font-size:10px;font-weight:700">${m}</span>`;
}

function bindTreeEvents(state) {
  el.querySelectorAll('.tree-special').forEach((nodeEl) => {
    nodeEl.addEventListener('click', () => {
      setActiveView(nodeEl.dataset.type);
    });
  });

  el.querySelectorAll('.tree-node:not(.tree-special)').forEach((nodeEl) => {
    const id = nodeEl.dataset.id;
    const type = nodeEl.dataset.type;
    nodeEl.addEventListener('mouseleave', () => closeMenuActions(id));
    nodeEl.addEventListener('click', (e) => {
      if (shouldSuppressTreeClick()) return;
      if (e.target.closest('[data-delete]') || e.target.closest('[data-toggle]') || e.target.closest('[data-menu-toggle]') || e.target.closest('.tree-menu-actions')) return;

      if (type === 'folder') {
        toggleNodeExpanded(id);
        render(getState());
        return;
      }

      if (type === 'request') {
        patchState((s) => {
          const requests = { ...s.requests };
          if (!requests[id]) {
            requests[id] = {
              id,
              method: 'GET',
              url: '',
              urlMode: 'host',
              queryParams: '[]',
              headers: '[]',
              bodyType: 'none',
              body: '',
              authType: 'none',
              authData: '{}',
              preScript: '',
              postScript: '',
            };
          }
          return {
            ...s,
            ...REQUEST_SESSION_RESET,
            requests,
            uiState: { ...s.uiState, activeRequestId: id, activeView: 'request' },
          };
        });
        scheduleSave();
        APP.components.history.loadForRequest(id);
      }
    });
  });

  el.querySelectorAll('[data-menu-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenuActions(btn.dataset.menuToggle);
    });
  });

  el.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNodeExpanded(btn.dataset.toggle);
      render(getState());
    });
  });

  el.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteNode(btn.dataset.delete);
    });
  });

  el.querySelectorAll('[data-rename]').forEach((label) => {
    label.addEventListener('dblclick', async (e) => {
      e.stopPropagation();
      await renameNode(label.dataset.rename, label.textContent);
    });
  });
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
