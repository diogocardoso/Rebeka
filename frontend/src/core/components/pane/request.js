import { setState, patchState, updateRequest } from '../../store.js';
import { data as api } from '../../data/index.js';
import { resolveEnvVars } from '../../../utils/variables.js';
import { isAbsoluteUrlMode } from '../../../utils/formatters.js';
import { showToast } from '../../../utils/toast.js';
import { runRequestPipeline, executeByPath } from '../../../utils/scriptExecute.js';
import { persistScriptVars } from '../envManager.js';
import { history } from '../history.js';

export function edit(id, patch, options = {}) {
  updateRequest(id, patch, options);
}

export async function send(req, state) {
  if (state.requestSending) return;

  patchState((s) => ({ ...s, requestSending: true, scriptLogs: [] }));

  try {
    const wsId = state.uiState.activeWorkspaceId;
    let freshVars = resolveEnvVars(state);

    if (wsId) {
      try {
        const fromDb = await api.env.getActiveVars(wsId);
        if (fromDb && Object.keys(fromDb).length > 0) {
          freshVars = fromDb;
        }
      } catch {
        /* mantém vars resolvidas do store */
      }
    }

    patchState((s) => ({ ...s, activeEnvVars: freshVars }));

    const result = await runRequestPipeline(req, {
      workspaceId: wsId,
      baseUrl: isAbsoluteUrlMode(req) ? '' : (state.activeEnvironment?.baseUrl || ''),
      envVars: freshVars,
      callingWorkspaceId: wsId,
      createExecuteFn: (callingWsId) => (path, workspaceName, env) =>
        executeByPath(path, workspaceName, env, callingWsId),
    });

    patchState((s) => ({ ...s, activeEnvVars: result.env || freshVars }));

    await history.loadForRequest(req.id);

    const resp = {
      statusCode: result.statusCode,
      body: result.body,
      headers: result.headers,
      durationMs: result.durationMs,
      error: result.error,
    };

    setState({
      response: { ...resp, historyId: null },
      testResults: result.testResults || [],
      scriptLogs: result.logs || [],
      requestSending: false,
    });

    if (resp.error) {
      showToast(resp.error, { type: 'error' });
    } else {
      showToast(`${resp.statusCode} — ${resp.durationMs ?? 0} ms`, { type: 'success' });
    }
  } catch (e) {
    console.error('Send request failed:', e);
    setState({
      response: {
        error: e.message,
        statusCode: 0,
        body: '',
        headers: {},
        durationMs: 0,
        sizeBytes: 0,
      },
      testResults: [],
      scriptLogs: [],
      requestSending: false,
    });
    showToast(e.message || 'Falha ao enviar', { type: 'error' });
  }
}

export const request = { send, edit };
