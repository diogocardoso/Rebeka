export function formatJSON(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function detectContentType(body, headers = {}) {
  const ct = headers['Content-Type'] || headers['content-type'] || '';
  if (ct.includes('json') || isJSON(body)) return 'json';
  if (ct.includes('xml') || body.trim().startsWith('<?xml') || body.trim().startsWith('<')) {
    if (ct.includes('html') || body.includes('<html')) return 'html';
    return 'xml';
  }
  if (ct.includes('html')) return 'html';
  return 'text';
}

function isJSON(text) {
  if (!text || !text.trim()) return false;
  const t = text.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

export function formatBody(body, type) {
  if (!body) return '';
  switch (type) {
    case 'json': return formatJSON(body);
    case 'xml':
    case 'html': return formatXML(body);
    default: return body;
  }
}

function formatXML(xml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch {
    return xml;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function statusClass(code) {
  if (code >= 200 && code < 300) return 'status-2xx';
  if (code >= 300 && code < 400) return 'status-3xx';
  if (code >= 400 && code < 500) return 'status-4xx';
  if (code >= 500) return 'status-5xx';
  return '';
}

export function parseKeyValues(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function stringifyKeyValues(arr) {
  return JSON.stringify(arr || []);
}

export function joinUrl(base, path) {
  const b = (base || '').replace(/\/+$/, '');
  const p = (path || '').trim();
  if (!p) return b;
  if (/^https?:\/\//i.test(p)) return p;
  const normalized = p.startsWith('/') ? p : `/${p}`;
  return b ? `${b}${normalized}` : normalized;
}

export function isAbsoluteUrlMode(req) {
  return (req?.urlMode || 'host') === 'absolute';
}

export function resolveRequestUrl(req, baseUrl, envVars, interpolateFn) {
  const interp = interpolateFn || ((text) => text);
  const urlPath = interp(req?.url || '');
  const paramsJson = stringifyKeyValues(
    parseKeyValues(req?.queryParams).map((p) => ({
      ...p,
      value: interp(p.value || ''),
    })),
  );
  const withParams = buildUrlWithParams(urlPath, paramsJson);
  if (isAbsoluteUrlMode(req)) {
    return withParams;
  }
  return joinUrl(baseUrl, withParams);
}

export function buildUrlWithParams(url, queryParamsRaw) {
  const params = parseKeyValues(queryParamsRaw).filter(
    (p) => p.enabled !== false && p.key,
  );
  const base = url || '';
  if (!params.length) return base;

  const qIndex = base.indexOf('?');
  const path = qIndex >= 0 ? base.slice(0, qIndex) : base;
  const existingQuery = qIndex >= 0 ? base.slice(qIndex + 1) : '';
  const searchParams = new URLSearchParams(existingQuery);

  params.forEach((p) => searchParams.set(p.key, p.value || ''));

  const qs = searchParams.toString();
  return qs ? `${path}?${qs}` : path;
}
