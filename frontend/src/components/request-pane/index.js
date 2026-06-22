import { getState, subscribe, updateRequest } from '../../core/store.js';
import { parseKeyValues, stringifyKeyValues, buildUrlWithParams, joinUrl, isAbsoluteUrlMode, resolveRequestUrl } from '../../utils/formatters.js';
import { highlightVariables, interpolate, resolveEnvVars } from '../../utils/variables.js';
import { getVarKeysFromState, bindVariablePicker, insertVarAtCursor } from '../../utils/variableInput.js';
import { mountVariableInput, getVariableInputValue } from '../variable-input/index.js';
import { sendRequest } from './send.js';
import { saveAuth } from './saveAuth.js';
import { copyUrl } from './copy.js';
import { renderScriptCodeEditor, bindScriptCodeEditor } from '../../utils/highlightScript.js';

let el = null;
let activeTab = 'params';
const varInputApis = new Map();
let shortcutBound = false;

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const BODY_TYPES = [
  { value: 'none', label: 'Nenhum' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Texto' },
  { value: 'urlencoded', label: 'URL Encoded' },
  { value: 'formdata', label: 'Form Data' },
];

export function mountRequestPane(container) {
  el = container;
  if (!shortcutBound) {
    document.addEventListener('keydown', onSendShortcut);
    shortcutBound = true;
  }
  subscribe(render);
  render(getState());
}

export function triggerSend() {
  const state = getState();
  if (state.requestSending) return;
  const id = state.uiState.activeRequestId;
  if (!id || state.uiState.activeView !== 'request') return;
  const req = state.requests[id];
  if (!req) return;
  flushRequestFromDOM(id);
  const current = getState();
  const freshReq = current.requests[id];
  if (!freshReq) return;
  sendRequest(freshReq, current);
}

function onSendShortcut(e) {
  if (!(e.ctrlKey && e.key === 'Enter')) return;
  if (document.querySelector('.WAbox, .wa-box, [id^="box_"]')) return;
  const state = getState();
  if (state.uiState.activeView !== 'request') return;
  if (!state.uiState.activeRequestId || state.requestSending) return;
  e.preventDefault();
  triggerSend();
}

function render(state) {
  if (!el) return;
  varInputApis.forEach((api) => api.destroy?.());
  varInputApis.clear();

  const req = state.requests[state.uiState.activeRequestId];
  if (!req) {
    el.innerHTML = '<div class="empty-pane">Selecione ou crie uma requisição na sidebar</div>';
    return;
  }

  const nameEnv = state.activeEnvironment?.name || '';
  const baseUrl = state.activeEnvironment?.baseUrl || '';
  const envVars = resolveEnvVars(state);
  const absoluteMode = isAbsoluteUrlMode(req);
  const urlPreview = buildUrlPreview(req, baseUrl, envVars);

  el.innerHTML = `
    <div class="request-pane">
      <div class="request-bar">
        <select class="method-select method-${(req.method || 'GET').toLowerCase()}" data-field="method">
          ${METHODS.map((m) => `<option value="${m}" ${req.method === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <div class="url-wrap">
          <div class="url-composite">
            <select class="url-mode-select" data-field="urlMode" title="Modo de URL">
              <option value="host" ${!absoluteMode ? 'selected' : ''}>Host</option>
              <option value="absolute" ${absoluteMode ? 'selected' : ''}>URL</option>
            </select>
            ${absoluteMode ? `
              <div class="url-input var-input-host url-full" data-var-field="url"></div>
            ` : `
              <div class="url-base">${nameEnv}</div>
              <div class="url-input var-input-host" data-var-field="url"></div>
            `}
          </div>
          <div class="d-flex v-center g-05 m-top-05 url-preview-row">
            <button class="btn btn-ghost" data-action="copy-url">${WA.Icon.copy2('var(--gray-5)',11)}</button>
            <span class="url-preview-link">${WA.Icon.link('var(--gray-5)',11)}</span>
            <div class="url-preview c-gray-5 d-flew-wrap m-top-05">${urlPreview}</div>
          </div>
        </div>
        <button class="btn btn-primary send-btn" data-action="send" ${state.requestSending ? 'disabled' : ''}>${state.requestSending ? 'Aguarde...' : 'Enviar'}</button>
      </div>
      <div class="tabs request-tabs">
        ${tabBtn('params', 'Params')}
        ${tabBtn('headers', 'Headers')}
        ${tabBtn('body', 'Body')}
        ${tabBtn('auth', 'Auth')}
        ${tabBtn('prescript', 'Pre-request')}
        ${tabBtn('postscript', 'Result')}
      </div>
      <div class="request-tab-content scroll-y">
        <div class="tab-panel ${activeTab === 'params' ? '' : 'hidden'}" data-panel="params">
          ${kvTable('queryParams', parseKeyValues(req.queryParams))}
        </div>
        <div class="tab-panel ${activeTab === 'headers' ? '' : 'hidden'}" data-panel="headers">
          ${kvTable('headers', parseKeyValues(req.headers))}
        </div>
        <div class="tab-panel ${activeTab === 'body' ? '' : 'hidden'}" data-panel="body">
          <select data-field="bodyType" class="body-type-select">
            ${BODY_TYPES.map((b) => `<option value="${b.value}" ${req.bodyType === b.value ? 'selected' : ''}>${b.label}</option>`).join('')}
          </select>
          ${req.bodyType === 'urlencoded' || req.bodyType === 'formdata'
    ? kvTable('bodyKv', parseKeyValues(req.body))
    : `<textarea class="body-editor" data-field="body" rows="12" placeholder='JSON ex.: {"drone_token":"{{token_auth}}"} — digite @ para inserir variável'>${escapeHtml(req.body || '')}</textarea>
       <div class="body-var-highlight" data-body-highlight></div>`}
        </div>
        <div class="tab-panel ${activeTab === 'auth' ? '' : 'hidden'}" data-panel="auth">
          ${renderAuth(req)}
        </div>
        <div class="tab-panel ${activeTab === 'prescript' ? '' : 'hidden'}" data-panel="prescript">
          <p class="script-tests-hint text-muted">Executado antes do envio: manipule <code>req</code> e <code>env</code>. Use <code>await execute("Pasta.Request")</code> para chamar outra request da coleção.</p>
          ${renderScriptCodeEditor('preScript', req.preScript || '', {
    rows: 14,
    placeholder: "// const login = await execute('Auth.login');\n// req.headers.push({ key: 'Authorization', value: 'Bearer ' + login.data.token, enabled: true });",
  })}
        </div>
        <div class="tab-panel ${activeTab === 'postscript' ? '' : 'hidden'}" data-panel="postscript">
          <p class="script-tests-hint text-muted">Executado após a resposta: <code>assert.*</code>, <code>setVar</code> e <code>await execute("Pasta.Sub.request")</code> para encadear requests de outro workspace.</p>
          ${renderScriptCodeEditor('postScript', req.postScript || '', {
    rows: 14,
    placeholder: "// assert.equal(res.statusCode, 200, 'Status OK');\n// const grid = await execute('Frota.Empresa.dataGrid', 'Sinetram');\n// assert.exists(grid.data, 'dataGrid retornou dados');",
  })}
        </div>
      </div>
    </div>
  `;

  bindEvents(req, state);
}

function tabBtn(id, label) {
  return `<button class="tab ${activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
}

function kvTable(field, rows) {
  if (!rows.length) rows = [{ key: '', value: '', enabled: true }];
  return `
    <table class="kv-table" data-kv="${field}">
      <thead><tr><th width="32"></th><th>Chave</th><th>Valor</th><th width="32"></th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr data-idx="${i}">
            <td><input type="checkbox" ${r.enabled !== false ? 'checked' : ''} data-kv-enabled /></td>
            <td><input type="text" value="${escapeAttr(r.key || '')}" data-kv-key /></td>
            <td><div class="var-input-host" data-kv-value-host data-initial="${escapeAttr(r.value || '')}"></div></td>
            <td><button class="btn-ghost btn-danger" data-kv-remove>×</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <button class="btn btn-ghost kv-add" data-kv-add="${field}">+ Adicionar linha</button>
  `;
}

function renderAuth(req) {
  let authData = {};
  try { authData = JSON.parse(req.authData || '{}'); } catch { /* */ }
  return `
    <div class="auth-form">
      <label>Tipo
        <select data-field="authType">
          <option value="none" ${req.authType === 'none' ? 'selected' : ''}>Nenhum</option>
          <option value="bearer" ${req.authType === 'bearer' ? 'selected' : ''}>Bearer Token</option>
          <option value="basic" ${req.authType === 'basic' ? 'selected' : ''}>Basic Auth</option>
        </select>
      </label>
      <div class="${req.authType === 'bearer' ? '' : 'hidden'}" data-auth-panel="bearer">
        <label>Token <div class="var-input-host" data-auth-host="token" data-initial="${escapeAttr(authData.token || '')}"></div></label>
      </div>
      <div class="${req.authType === 'basic' ? '' : 'hidden'}" data-auth-panel="basic">
        <label>Usuário <div class="var-input-host" data-auth-host="username" data-initial="${escapeAttr(authData.username || '')}"></div></label>
        <label>Senha <div class="var-input-host" data-auth-host="password" data-initial="${escapeAttr(authData.password || '')}" data-input-type="password"></div></label>
      </div>
    </div>
  `;
}

function bindEvents(req, state) {
  const id = req.id;
  const varKeys = getVarKeysFromState(state);

  el.querySelector('[data-action="send"]')?.addEventListener('click', () => triggerSend());

  el.querySelector('[data-action="copy-url"]')?.addEventListener('click', () => {
    flushRequestFromDOM(id);
    const current = getState();
    const freshReq = current.requests[id];
    if (!freshReq) return;
    const fullUrl = resolveFullUrl(
      freshReq,
      current.activeEnvironment?.baseUrl || '',
      resolveEnvVars(current),
    );
    copyUrl(fullUrl);
  });

  el.querySelector('[data-field="urlMode"]')?.addEventListener('change', (e) => {
    updateRequest(id, { urlMode: e.target.value });
    render(getState());
  });

  el.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      render(getState());
    });
  });

  el.querySelector('[data-field="method"]')?.addEventListener('change', (e) => {
    updateRequest(id, { method: e.target.value });
    render(getState());
  });

  el.querySelector('[data-field="bodyType"]')?.addEventListener('change', (e) => {
    updateRequest(id, { bodyType: e.target.value });
    render(getState());
  });

  el.querySelector('[data-field="body"]')?.addEventListener('input', (e) => {
    updateRequest(id, { body: e.target.value }, { silent: true });
    refreshBodyHighlight(e.target.value, resolveEnvVars(getState()));
  });

  el.querySelector('[data-field="preScript"]')?.addEventListener('input', (e) => {
    updateRequest(id, { preScript: e.target.value }, { silent: true });
  });

  el.querySelector('[data-field="postScript"]')?.addEventListener('input', (e) => {
    updateRequest(id, { postScript: e.target.value }, { silent: true });
  });

  el.querySelector('[data-field="authType"]')?.addEventListener('change', (e) => {
    updateRequest(id, { authType: e.target.value });
    render(getState());
  });

  bindVariableInputs(id, varKeys, state);
  bindKVTables(id);
  bindBodyPicker(varKeys);
  refreshBodyHighlight(req.body, resolveEnvVars(state));

  el.querySelectorAll('[data-script-editor="preScript"], [data-script-editor="postScript"]').forEach((wrap) => {
    bindScriptCodeEditor(wrap);
  });
}

function bindVariableInputs(id, varKeys, state) {
  const urlHost = el.querySelector('[data-var-field="url"]');
  if (urlHost) {
    const req = getState().requests[id];
    const api = mountVariableInput(urlHost, {
      value: req?.url || '',
      varKeys,
      onChange: (val) => {
        updateRequest(id, { url: val }, { silent: true });
        refreshUrlPreview(id, val, getState());
      },
    });
    if (api) varInputApis.set(urlHost, api);
  }

  el.querySelectorAll('[data-kv-value-host]').forEach((host) => {
    const api = mountVariableInput(host, {
      value: host.dataset.initial || '',
      varKeys,
      onChange: () => {
        const table = host.closest('.kv-table');
        if (table) persistKVTable(id, table);
      },
    });
    if (api) varInputApis.set(host, api);
  });

  el.querySelectorAll('[data-auth-host]').forEach((host) => {
    const api = mountVariableInput(host, {
      value: host.dataset.initial || '',
      varKeys,
      inputType: host.dataset.inputType || 'text',
      onChange: () => saveAuth(id, el, { silent: true }),
    });
    if (api) varInputApis.set(host, api);
  });

  void state;
}

function bindBodyPicker(varKeys) {
  const textarea = el.querySelector('[data-field="body"]');
  if (!textarea) return;
  bindVariablePicker(textarea, {
    getKeys: () => varKeys,
    onInsert: (key) => insertVarAtCursor(textarea, key),
  });
}

function bindKVTables(id) {
  el.querySelectorAll('.kv-table').forEach((table) => {
    table.querySelectorAll('input[data-kv-key]').forEach((inp) => {
      inp.addEventListener('change', () => persistKVTable(id, table));
      inp.addEventListener('input', () => persistKVTable(id, table));
    });
    table.querySelectorAll('[data-kv-enabled]').forEach((inp) => {
      inp.addEventListener('change', () => persistKVTable(id, table));
    });
    table.querySelectorAll('[data-kv-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('tr')?.remove();
        persistKVTable(id, table);
        render(getState());
      });
    });
  });

  el.querySelectorAll('[data-kv-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.kvAdd;
      const req = getState().requests[id];
      const key = field === 'bodyKv' ? 'body' : field;
      const rows = [...parseKeyValues(req[key]), { key: '', value: '', enabled: true }];
      updateRequest(id, { [key]: stringifyKeyValues(rows) });
      render(getState());
    });
  });
}

function persistKVTable(id, table) {
  const field = table.dataset.kv;
  const rows = collectKVRows(table);
  if (field === 'bodyKv') {
    updateRequest(id, { body: stringifyKeyValues(rows) }, { silent: true });
  } else {
    updateRequest(id, { [field]: stringifyKeyValues(rows) }, { silent: true });
    if (field === 'queryParams') refreshUrlPreview(id, undefined, getState());
  }
}

function collectKVRows(table) {
  return [...table.querySelectorAll('tbody tr')].map((tr) => ({
    key: tr.querySelector('[data-kv-key]')?.value || '',
    value: getVariableInputValue(tr.querySelector('[data-kv-value-host]')) || '',
    enabled: tr.querySelector('[data-kv-enabled]')?.checked !== false,
  }));
}

function flushRequestFromDOM(id) {
  const urlHost = el?.querySelector('[data-var-field="url"]');
  if (urlHost) {
    updateRequest(id, { url: getVariableInputValue(urlHost) }, { silent: true });
  }
  el?.querySelectorAll('.kv-table').forEach((table) => persistKVTable(id, table));
  saveAuth(id, el, { silent: true });
}

function resolveFullUrl(req, baseUrl, envVars) {
  const vars = envVars || {};
  return resolveRequestUrl(req, baseUrl, vars, (text) => interpolate(text, vars));
}

function buildUrlPreview(req, baseUrl, envVars) {
  const fullUrl = resolveFullUrl(req, baseUrl, envVars);
  if (!fullUrl.includes('{{') && !fullUrl.includes('%7B%7B')) {
    return escapeHtml(fullUrl);
  }
  const decoded = fullUrl.replace(/%7B%7B([^%]+)%7D%7D/gi, '{{$1}}');
  return highlightVariables(decoded, envVars || {});
}

function refreshUrlPreview(id, pathValue, state) {
  const preview = el.querySelector('.url-preview');
  if (!preview) return;
  const req = getState().requests[id];
  if (!req) return;
  const s = state || getState();
  preview.innerHTML = buildUrlPreview(
    { ...req, url: pathValue ?? req.url },
    s.activeEnvironment?.baseUrl || '',
    resolveEnvVars(s),
  );
}

function refreshBodyHighlight(body, envVars) {
  const strip = el?.querySelector('[data-body-highlight]');
  if (!strip) return;
  if (!body?.includes('{{') && !body?.includes('@')) {
    strip.innerHTML = '';
    strip.classList.add('hidden');
    return;
  }
  strip.classList.remove('hidden');
  const resolved = interpolate(body, envVars || {});
  strip.innerHTML = highlightVariables(resolved, envVars);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
