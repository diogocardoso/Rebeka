import { subscribe, getState, setState } from '../../core/store.js';
import { formatBody, detectContentType, formatBytes, statusClass } from '../../utils/formatters.js';
import { highlightCode } from '../../utils/variables.js';
import { formatTimeline, timelinePlainText } from '../../utils/formatTimeline.js';
import { historyEntryToResponse, parseHistoryTests } from '../../core/components/history.js';
import { copyBody, copyHeaders } from './copy.js';

let el = null;
let activeTab = 'preview';
let responseExpanded = false;
let lastWorkspaceId = '';

export function mountResponsePane(container) {
  el = container;
  el.addEventListener('click', onPaneClick);
  subscribe(render);
  render(getState());
}

function expandBtnHtml() {
  const icon = responseExpanded
    ? WA.Icon.collapse('var(--gray-5)', 12)
    : WA.Icon.expand('var(--gray-5)', 12);
  const title = responseExpanded ? 'Restaurar painéis' : 'Expandir resposta (mantém barra e preview da URL)';
  return `<button class="btn btn-ghost response-expand-btn" data-action="toggle-expand" title="${title}">${icon}</button>`;
}

function applyExpandedState() {
  document.getElementById('request-split')?.classList.toggle('response-expanded', responseExpanded);
}

function updateExpandBtn(btn) {
  const target = btn || el?.querySelector('[data-action="toggle-expand"]');
  if (!target) return;
  target.title = responseExpanded
    ? 'Restaurar painéis'
    : 'Expandir resposta (mantém barra e preview da URL)';
  target.innerHTML = responseExpanded
    ? WA.Icon.collapse('var(--gray-5)', 12)
    : WA.Icon.expand('var(--gray-5)', 12);
}

function onPaneClick(e) {
  const expandBtn = e.target.closest('[data-action="toggle-expand"]');
  if (expandBtn && el?.contains(expandBtn)) {
    responseExpanded = !responseExpanded;
    applyExpandedState();
    updateExpandBtn(expandBtn);
    return;
  }

  const historyBtn = e.target.closest('[data-history-id]');
  if (historyBtn && el?.contains(historyBtn)) {
    const entryId = historyBtn.dataset.historyId;
    const state = getState();
    if (entryId === 'live') {
      const latest = state.requestHistory?.[0];
      if (!latest) return;
      setState({
        response: { ...historyEntryToResponse(latest), historyId: null },
        testResults: parseHistoryTests(latest),
      });
      return;
    }
    const entry = (state.requestHistory || []).find((h) => h.id === entryId);
    if (!entry) return;
    setState({
      response: historyEntryToResponse(entry),
      testResults: parseHistoryTests(entry),
    });
  }
}

function formatHistoryLabel(entry) {
  const date = entry.createdAt ? new Date(entry.createdAt) : null;
  const when = date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
  return `${when} · ${entry.statusCode || 0} · ${entry.durationMs ?? 0}ms`;
}

function renderHistoryBar(state, resp) {
  const entries = state.requestHistory || [];
  if (!entries.length) return '';

  const activeId = resp?.historyId || (resp ? 'live' : '');

  return `
    <div class="response-history">
      <span class="response-history-label">Histórico</span>
      <div class="response-history-list">
        ${resp ? `<button type="button" class="history-chip ${activeId === 'live' ? 'active' : ''}" data-history-id="live">Atual</button>` : ''}
        ${entries.map((entry) => `
          <button type="button" class="history-chip ${activeId === entry.id ? 'active' : ''}" data-history-id="${escapeAttr(entry.id)}" title="${escapeAttr(formatHistoryLabel(entry))}">
            ${escape(formatHistoryLabel(entry))}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function render(state) {
  if (!el) return;

  const workspaceId = state.uiState.activeWorkspaceId;
  if (workspaceId !== lastWorkspaceId) {
    lastWorkspaceId = workspaceId;
    if (responseExpanded) {
      responseExpanded = false;
      applyExpandedState();
    }
  }

  const historyBar = renderHistoryBar(state, state.response);

  if (state.requestSending) {
    el.innerHTML = `
      <div class="response-pane">
        ${historyBar}
        <div class="response-metrics">
          <span class="metric">Aguardando resposta...</span>
          ${expandBtnHtml()}
        </div>
        <div class="empty-pane">Enviando requisição...</div>
      </div>
    `;
    applyExpandedState();
    return;
  }

  const resp = state.response;

  if (!resp) {
    el.innerHTML = `
      <div class="response-pane">
        ${historyBar}
        <div class="response-metrics">${expandBtnHtml()}</div>
        <div class="empty-pane">${historyBar ? 'Selecione um envio no histórico ou envie a requisição' : 'Envie uma requisição para ver a resposta'}</div>
      </div>
    `;
    applyExpandedState();
    return;
  }

  const code = resp.error ? resp.error : (resp.body || '');
  const contentType = resp.error ? 'text' : detectContentType(resp.body || '', resp.headers || {});
  const formatted = resp.error ? code : formatBody(resp.body || '', contentType);
  const highlighted = highlightCode(formatted, contentType);
  const statusCls = statusClass(resp.statusCode || 0);
  const timelineHtml = formatTimeline(resp);

  const headers = resp.headers || {};
  const headerRows = Object.entries(headers).map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join('');

  el.innerHTML = `
    <div class="response-pane">
      ${historyBar}
      <div class="response-metrics">
        <span class="metric ${statusCls}">Status: ${resp.statusCode || '—'}${resp.error ? ' (erro)' : ''}</span>
        <span class="metric">Tempo: ${resp.durationMs ?? 0} ms</span>
        <span class="metric">Tamanho: ${formatBytes(resp.sizeBytes || 0)}</span>
        <button class="btn btn-ghost" data-copy="body">Copiar body</button>
        <button class="btn btn-ghost" data-copy="headers">Copiar headers</button>
        <button class="btn btn-ghost" data-copy="timeline">Copiar timeline</button>
        ${expandBtnHtml()}
      </div>
      <div class="tabs">
        <button class="tab ${activeTab === 'preview' ? 'active' : ''}" data-tab="preview">Preview</button>
        <button class="tab ${activeTab === 'raw' ? 'active' : ''}" data-tab="raw">Raw</button>
        <button class="tab ${activeTab === 'headers' ? 'active' : ''}" data-tab="headers">Headers</button>
        <button class="tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</button>
      </div>
      <div class="response-content scroll-y">
        <div class="tab-panel code-block ${activeTab === 'preview' ? '' : 'hidden'}" data-panel="preview">${highlighted}</div>
        <pre class="tab-panel code-block ${activeTab === 'raw' ? '' : 'hidden'}" data-panel="raw">${escape(resp.body || resp.error || '')}</pre>
        <div class="tab-panel ${activeTab === 'headers' ? '' : 'hidden'}" data-panel="headers">
          <table class="kv-table">
            <thead><tr><th>Header</th><th>Valor</th></tr></thead>
            <tbody>${headerRows || '<tr><td colspan="2">Sem headers</td></tr>'}</tbody>
          </table>
        </div>
        <div class="tab-panel timeline-view ${activeTab === 'timeline' ? '' : 'hidden'}" data-panel="timeline">${timelineHtml}</div>
      </div>
    </div>
  `;

  el.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      render(getState());
    });
  });

  el.querySelector('[data-copy="body"]')?.addEventListener('click', () => {
    copyBody(resp.body || resp.error || '');
  });

  el.querySelector('[data-copy="headers"]')?.addEventListener('click', () => {
    copyHeaders(headers);
  });

  el.querySelector('[data-copy="timeline"]')?.addEventListener('click', () => {
    copyBody(timelinePlainText(resp));
  });

  applyExpandedState();
}

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
