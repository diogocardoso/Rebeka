import * as docsData from '../../core/data/docs.js';
import { renderMarkdown } from '../../utils/markdown.js';

let el = null;
let resizerEl = null;
let contentEl = null;
let open = false;
let activeId = null;
let entries = [];
let loadToken = 0;

const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.72;
const DEFAULT_WIDTH = 480;
const WIDTH_KEY = 'rebeka.docsDrawerWidth';

let drawerWidth = readStoredWidth();

const icon_docs = WA.Icon.show({ type: 'doc', color: 'var(--accent)', size: 14 });
const icon_close = WA.Icon.show({ type: 'close', color: 'var(--text-muted)', size: 14 });

function readStoredWidth() {
  const n = Number(localStorage.getItem(WIDTH_KEY));
  return Number.isFinite(n) && n >= MIN_WIDTH ? n : DEFAULT_WIDTH;
}

function persistWidth() {
  localStorage.setItem(WIDTH_KEY, String(drawerWidth));
}

function applyOpenWidth() {
  if (!el || !open) return;
  const wrap = el.parentElement;
  const maxW = wrap
    ? Math.max(MIN_WIDTH, Math.min(wrap.clientWidth * MAX_WIDTH_RATIO, wrap.clientWidth - 160))
    : drawerWidth;
  drawerWidth = Math.max(MIN_WIDTH, Math.min(maxW, drawerWidth));
  el.style.width = `${drawerWidth}px`;
}

function setResizerVisible(visible) {
  resizerEl?.classList.toggle('visible', visible);
}

export function mountDocsDrawer(container, resizer) {
  el = container;
  resizerEl = resizer;
  contentEl = document.createElement('div');
  contentEl.className = 'docs-pane-host';
  el.appendChild(contentEl);
  bindResize();
  renderShell();
}

export function toggleDocsDrawer() {
  open = !open;
  if (open) {
    applyOpenWidth();
    setResizerVisible(true);
    loadDocs();
  } else {
    el.style.width = '0';
    setResizerVisible(false);
    renderShell();
  }
  el?.classList.toggle('open', open);
  window.dispatchEvent(new CustomEvent('rebeka:docs-toggle', { detail: { open } }));
}

export function isDocsOpen() {
  return open;
}

async function loadDocs() {
  const token = ++loadToken;
  try {
    entries = await docsData.list();
    if (token !== loadToken) return;
    if (!activeId || !entries.some((e) => e.id === activeId)) {
      activeId = entries.find((e) => e.id === 'inicio')?.id || entries[0]?.id || null;
    }
    if (activeId) {
      await showDoc(activeId, token);
    } else {
      renderShell('<div class="empty-pane">Nenhum documento disponível</div>');
    }
  } catch (e) {
    console.error('Docs load failed:', e);
    renderShell('<div class="empty-pane">Erro ao carregar documentação</div>');
  }
}

async function showDoc(id, token = ++loadToken) {
  activeId = id;
  renderShell('<div class="docs-loading">Carregando…</div>');
  try {
    const raw = await docsData.get(id);
    if (token !== loadToken) return;
    const html = renderMarkdown(raw);
    renderShell(`<article class="docs-article scroll-y">${html}</article>`);
    bindContentLinks();
  } catch (e) {
    console.error('Doc read failed:', e);
    renderShell('<div class="empty-pane">Documento não encontrado</div>');
  }
}

function renderShell(contentHtml = '') {
  if (!contentEl) return;

  const menu = entries.length
    ? entries.map((doc) => `
        <button type="button" class="docs-menu-item ${doc.id === activeId ? 'active' : ''}" data-doc-id="${escapeAttr(doc.id)}">
          ${escape(doc.title)}
        </button>
      `).join('')
    : '<div class="docs-menu-empty">…</div>';

  contentEl.innerHTML = `
    <div class="docs-pane">
      <div class="docs-pane-header">
        <span class="docs-pane-title">${icon_docs} Documentação</span>
        <button type="button" class="btn-icon docs-close" data-action="close-docs" title="Fechar">${icon_close}</button>
      </div>
      <div class="docs-pane-body">
        <nav class="docs-menu scroll-y">${menu}</nav>
        <div class="docs-content">${contentHtml}</div>
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  contentEl.querySelector('[data-action="close-docs"]')?.addEventListener('click', () => toggleDocsDrawer());

  contentEl.querySelectorAll('[data-doc-id]').forEach((btn) => {
    btn.addEventListener('click', () => showDoc(btn.dataset.docId));
  });
}

function bindContentLinks() {
  contentEl.querySelectorAll('.docs-article a[href]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/(?:\.\/)?([a-z0-9-]+)\.md$/i);
      if (match) {
        e.preventDefault();
        showDoc(match[1]);
      }
    });
  });
}

function bindResize() {
  if (!resizerEl) return;

  resizerEl.addEventListener('mousedown', (e) => {
    if (!open) return;
    e.preventDefault();

    const startX = e.clientX;
    const startW = drawerWidth;

    resizerEl.classList.add('active');
    el.classList.add('resizing');
    document.body.classList.add('docs-resizing');

    const onMove = (ev) => {
      const wrap = el.parentElement;
      const maxW = wrap
        ? Math.max(MIN_WIDTH, Math.min(wrap.clientWidth * MAX_WIDTH_RATIO, wrap.clientWidth - 160))
        : startW + 400;
      const delta = startX - ev.clientX;
      drawerWidth = Math.max(MIN_WIDTH, Math.min(maxW, startW + delta));
      el.style.width = `${drawerWidth}px`;
    };

    const onUp = () => {
      resizerEl.classList.remove('active');
      el.classList.remove('resizing');
      document.body.classList.remove('docs-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      persistWidth();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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
