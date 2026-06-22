import { data as api } from '../core/data/index.js';
import { resolveEnvVars } from './variables.js';
import { isAbsoluteUrlMode } from './formatters.js';
import {
  buildRequestContext,
  runPreScript,
  runPostScript,
  applyPreScriptToRequest,
} from './scriptRuntime.js';
import { persistScriptVars } from '../core/components/envManager.js';
import { findWorkspaceRef, resolvePathInTree } from './resolveRequestPath.js';
import { getState } from '../core/store.js';

function normalizeResponse(resp, env) {
  let data = null;
  if (resp?.body) {
    try {
      data = JSON.parse(resp.body);
    } catch {
      /* body não é JSON */
    }
  }
  return {
    statusCode: resp?.statusCode ?? 0,
    body: resp?.body ?? '',
    headers: resp?.headers || {},
    durationMs: resp?.durationMs ?? 0,
    data,
    env: { ...env },
    error: resp?.error || '',
  };
}

async function resolveRequestContext(path, workspaceRef, callingWorkspaceId) {
  const wsRef = String(workspaceRef || '').trim() || callingWorkspaceId;
  if (!wsRef) {
    throw new Error('workspace não definido para execute()');
  }

  const state = getState();
  const ws = findWorkspaceRef(wsRef, state.workspaces || []);

  if (ws && ws.id === state.uiState.activeWorkspaceId) {
    const { request } = resolvePathInTree(state.tree || [], state.requests || {}, path);
    return {
      workspaceId: ws.id,
      workspaceName: ws.name,
      request,
      baseUrl: isAbsoluteUrlMode(request) ? '' : (state.activeEnvironment?.baseUrl || ''),
      envVars: resolveEnvVars(state),
    };
  }

  const remote = await api.execute.resolve(path, ws?.id || wsRef);
  return {
    workspaceId: remote.workspaceId,
    workspaceName: remote.workspaceName,
    request: remote.request,
    baseUrl: remote.baseUrl || '',
    envVars: remote.envVars || {},
  };
}

export async function runRequestPipeline(req, options = {}) {
  const {
    workspaceId,
    baseUrl = '',
    envVars: startVars = {},
    callingWorkspaceId,
    createExecuteFn,
  } = options;

  if (!req?.id) {
    throw new Error('request inválida');
  }

  let freshVars = { ...startVars };

  if (workspaceId) {
    try {
      const fromDb = await api.env.getActiveVars(workspaceId);
      if (fromDb && Object.keys(fromDb).length > 0) {
        freshVars = { ...fromDb, ...startVars };
      }
    } catch {
      /* mantém vars do contexto */
    }
  }

  const effectiveBaseUrl = isAbsoluteUrlMode(req) ? '' : baseUrl;
  let httpReq = buildRequestContext(req, freshVars);

  const executeFn = createExecuteFn
    ? createExecuteFn(callingWorkspaceId)
    : null;

  const preCtx = { req: { ...httpReq }, res: {}, env: { ...freshVars } };
  const { logs: preLogs } = await runPreScript(req.preScript, preCtx, executeFn);
  httpReq = applyPreScriptToRequest(httpReq, preCtx.req, preCtx.env);

  const resp = await api.request.send(httpReq, req.id, effectiveBaseUrl, '[]');

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

  const { results: testResults, logs: postLogs } = await runPostScript(req.postScript, postCtx, executeFn);
  const scriptLogs = [...(preLogs || []), ...(postLogs || [])];

  if (workspaceId) {
    try {
      await persistScriptVars(workspaceId, freshVars, postCtx.env);
    } catch {
      /* persistência não deve bloquear */
    }
  }

  const testsJson = JSON.stringify(testResults || []);
  try {
    await api.history.patchTests(req.id, testsJson);
  } catch {
    /* histórico de tests não deve bloquear */
  }

  const result = normalizeResponse(resp, postCtx.env);
  result.testResults = testResults || [];
  result.logs = scriptLogs;
  return result;
}

export async function executeByPath(path, workspaceName, envOverrides = {}, callingWorkspaceId) {
  const ctx = await resolveRequestContext(path, workspaceName, callingWorkspaceId);
  const mergedEnv = { ...(ctx.envVars || {}), ...(envOverrides || {}) };

  const result = await runRequestPipeline(ctx.request, {
    workspaceId: ctx.workspaceId,
    baseUrl: ctx.baseUrl,
    envVars: mergedEnv,
    callingWorkspaceId,
    createExecuteFn: (wsId) => (p, wsName, env) => executeByPath(p, wsName, env, wsId),
  });

  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}
