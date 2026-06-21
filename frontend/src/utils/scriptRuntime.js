export function runPreScript(script, ctx) {
  if (!script?.trim()) return { logs: [] };
  return runScript(script, ctx, 'pre');
}

export function runPostScript(script, ctx) {
  if (!script?.trim()) return { results: [], logs: [] };
  const { results, logs } = runScript(script, ctx, 'post');
  return { results, logs };
}

function makeConsole(logs, phase) {
  const push = (level, args) => {
    logs.push({
      level,
      phase,
      message: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
      ts: Date.now(),
    });
  };
  return {
    log: (...a) => push('log', a),
    warn: (...a) => push('warn', a),
    error: (...a) => push('error', a),
  };
}

function runScript(script, ctx, phase) {
  const results = [];
  const logs = [];
  const assertions = {
    ok(value, msg) {
      if (!value) throw new Error(msg || 'Assertion failed');
      results.push({ name: msg || 'ok', passed: true, message: 'Passou' });
    },
    equal(actual, expected, msg) {
      const name = msg || `equal(${actual}, ${expected})`;
      if (actual !== expected) {
        results.push({ name, passed: false, message: `Esperado ${expected}, recebido ${actual}` });
        throw new Error(results[results.length - 1].message);
      }
      results.push({ name, passed: true, message: 'Passou' });
    },
    exists(value, msg) {
      const name = msg || 'exists';
      if (value === undefined || value === null) {
        results.push({ name, passed: false, message: 'Valor não existe' });
        throw new Error('Valor não existe');
      }
      results.push({ name, passed: true, message: 'Passou' });
    },
  };

  const api = {
    req: ctx.req,
    res: ctx.res,
    env: ctx.env,
    assert: assertions,
    setVar(key, value) {
      ctx.env[key] = String(value);
    },
    console: makeConsole(logs, phase),
  };

  try {
    const fn = new Function('req', 'res', 'env', 'assert', 'setVar', 'console', script);
    fn(api.req, api.res, api.env, api.assert, api.setVar, api.console);
  } catch (e) {
    results.push({ name: `${phase}-script`, passed: false, message: e.message });
  }

  if (phase === 'pre') return { logs };
  return { results, logs };
}

export function buildRequestContext(request, envVars) {
  const parseKV = (raw) => {
    try { return JSON.parse(raw || '[]'); } catch { return []; }
  };
  let authData = {};
  try { authData = JSON.parse(request.authData || '{}'); } catch { /* */ }

  return {
    method: request.method || 'GET',
    url: request.url || '',
    queryParams: parseKV(request.queryParams),
    headers: parseKV(request.headers),
    bodyType: request.bodyType || 'none',
    body: request.body || '',
    authType: request.authType || 'none',
    authData,
    variables: { ...envVars },
  };
}

export function applyPreScriptToRequest(req, preResult, envVars) {
  const variables = envVars ? { ...envVars } : { ...(req.variables || {}) };
  if (!preResult) return { ...req, variables };
  return {
    ...req,
    method: preResult.method || req.method,
    url: preResult.url || req.url,
    headers: preResult.headers || req.headers,
    body: preResult.body !== undefined ? preResult.body : req.body,
    authType: preResult.authType || req.authType,
    authData: preResult.authData || req.authData,
    variables,
  };
}
