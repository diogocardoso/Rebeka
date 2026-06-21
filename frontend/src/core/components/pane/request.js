import { setState, patchState, updateRequest } from '../../store.js';
import { data as api } from '../../data/index.js';
import { resolveEnvVars } from '../../../utils/variables.js';
import { isAbsoluteUrlMode } from '../../../utils/formatters.js';
import { showToast } from '../../../utils/toast.js';
import {
  buildRequestContext,
  runPreScript,
  runPostScript,
  applyPreScriptToRequest,
} from '../../../utils/scriptRuntime.js';
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

    let httpReq = buildRequestContext(req, freshVars);
    const baseURL = isAbsoluteUrlMode(req) ? '' : (state.activeHost?.baseUrl || '');

    const preCtx = { req: { ...httpReq }, res: {}, env: { ...freshVars } };
    const { logs: preLogs } = runPreScript(req.preScript, preCtx);
    httpReq = applyPreScriptToRequest(httpReq, preCtx.req, preCtx.env);

    const resp = await api.request.send(httpReq, req.id, baseURL, '[]');

    const postCtx = {
      req: httpReq,
      res: {
        statusCode: resp.statusCode,
        body: resp.body,
        headers: resp.headers,
        durationMs: resp.durationMs,
      },
      env: { ...preCtx.env },
    };
    const { results: testResults, logs: postLogs } = runPostScript(req.postScript, postCtx);
    const scriptLogs = [...(preLogs || []), ...(postLogs || [])];

    patchState((s) => ({ ...s, activeEnvVars: postCtx.env }));
    try {
      await persistScriptVars(wsId, freshVars, postCtx.env);
    } catch {
      /* persistência de script vars não deve bloquear o envio */
    }

    const testsJson = JSON.stringify(testResults || []);
    try {
      await api.history.patchTests(req.id, testsJson);
    } catch {
      /* histórico de tests não deve bloquear o envio */
    }

    await history.loadForRequest(req.id);

    setState({
      response: { ...resp, historyId: null },
      testResults,
      scriptLogs,
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
