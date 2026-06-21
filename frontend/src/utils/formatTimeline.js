const STATUS_TEXT = {
  100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request',
  401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  408: 'Request Timeout', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusText(code) {
  return STATUS_TEXT[code] || '';
}

function sortedHeaderKeys(headers, preferredFirst = []) {
  const keys = Object.keys(headers || {});
  const seen = new Set();
  const ordered = [];
  for (const k of preferredFirst) {
    if (headers[k] !== undefined) {
      ordered.push(k);
      seen.add(k);
    }
  }
  keys.filter((k) => !seen.has(k)).sort((a, b) => a.localeCompare(b)).forEach((k) => ordered.push(k));
  return ordered;
}

/**
 * Formata timeline estilo Insomnia/curl verbose (request + response headers).
 */
export function formatTimeline(resp) {
  if (!resp) return '';

  const lines = [];
  const method = resp.requestMethod || 'GET';
  const uri = resp.requestURL || '/';

  lines.push({ type: 'req', text: `${method} ${uri} HTTP/1.1` });

  const reqHeaders = resp.requestHeaders || {};
  for (const key of sortedHeaderKeys(reqHeaders, ['Host'])) {
    lines.push({ type: 'req', text: `${key}: ${reqHeaders[key]}` });
  }

  lines.push({ type: 'blank', text: '' });

  if (resp.error) {
    lines.push({ type: 'info', text: resp.error });
    return renderTimelineHtml(lines);
  }

  const code = resp.statusCode || 0;
  const label = resp.statusText || statusText(code);
  lines.push({ type: 'res', text: `HTTP/1.1 ${code}${label ? ` ${label}` : ''}` });

  const resHeaders = resp.headers || {};
  for (const key of sortedHeaderKeys(resHeaders)) {
    lines.push({ type: 'res', text: `${key}: ${resHeaders[key]}` });
  }

  lines.push({ type: 'blank', text: '' });
  return renderTimelineHtml(lines);
}

function renderTimelineHtml(lines) {
  return lines.map((line) => {
    if (line.type === 'blank') return '';
    const prefix = line.type === 'req' ? '&gt; ' : line.type === 'res' ? '&lt; ' : '* ';
    const cls = line.type === 'req' ? 'timeline-req' : line.type === 'res' ? 'timeline-res' : 'timeline-info';
    return `<div class="timeline-line ${cls}">${prefix}${escapeHtml(line.text)}</div>`;
  }).join('\n');
}

export function timelinePlainText(resp) {
  if (!resp) return '';
  const div = document.createElement('div');
  div.innerHTML = formatTimeline(resp);
  return div.textContent || '';
}
