export function highlightCode(text, type) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  if (type === 'json') return highlightJSON(escaped);
  if (type === 'xml' || type === 'html') return highlightXML(escaped);
  return escaped;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightJSON(text) {
  return text.replace(
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(\b\d+\.?\d*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g,
    (match, key, str, num, bool) => {
      if (key) return `<span style="color:#9cdcfe">${match}</span>`;
      if (str) return `<span style="color:#ce9178">${match}</span>`;
      if (num) return `<span style="color:#b5cea8">${match}</span>`;
      if (bool) return `<span style="color:#569cd6">${match}</span>`;
      return match;
    }
  );
}

function highlightXML(text) {
  return text
    .replace(/(&lt;\/?[\w-]+)/g, '<span style="color:#569cd6">$1</span>')
    .replace(/([\w-]+)=/g, '<span style="color:#9cdcfe">$1</span>=')
    .replace(/(&quot;[^&]*&quot;)/g, '<span style="color:#ce9178">$1</span>');
}

export function findVariables(text) {
  const found = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(text || '')) !== null) {
    const name = m[1].trim();
    if (name && !found.includes(name)) found.push(name);
  }
  const atRe = /@([a-zA-Z_][\w.-]*)/g;
  while ((m = atRe.exec(text || '')) !== null) {
    const name = m[1].trim();
    if (name && !found.includes(name)) found.push(name);
  }
  return found;
}

export function interpolate(text, vars) {
  if (!text || !vars) return text || '';
  let result = text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    return vars[k] !== undefined ? vars[k] : `{{${k}}}`;
  });
  result = result.replace(/@([a-zA-Z_][\w.-]*)/g, (match, key) => {
    const k = key.trim();
    return vars[k] !== undefined ? vars[k] : match;
  });
  return result;
}

/** Resolve variáveis do store: activeEnvVars → perfil ativo → primeiro perfil */
export function resolveEnvVars(state) {
  const cached = state?.activeEnvVars;
  if (cached && Object.keys(cached).length > 0) return { ...cached };

  const envs = state?.environments || [];
  const env = envs.find((e) => e.isActive) || envs[0];
  if (env?.variables?.length) {
    const vars = {};
    for (const v of env.variables) {
      if (v.key) vars[v.key] = v.value ?? '';
    }
    if (Object.keys(vars).length > 0) return vars;
  }
  return { ...(cached || {}) };
}

export function highlightVariables(text, vars) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const k = key.trim();
    const cls = vars[k] !== undefined && vars[k] !== '' ? 'var-resolved' : 'var-unresolved';
    return `<span class="${cls}">${match}</span>`;
  });
  html = html.replace(/@([a-zA-Z_][\w.-]*)/g, (match, key) => {
    const k = key.trim();
    const cls = vars[k] !== undefined && vars[k] !== '' ? 'var-resolved' : 'var-unresolved';
    return `<span class="${cls}">${match}</span>`;
  });
  return html;
}
