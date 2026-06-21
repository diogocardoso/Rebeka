function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const KEYWORDS = new Set([
  'if', 'else', 'const', 'let', 'var', 'return', 'try', 'catch', 'finally',
  'throw', 'new', 'typeof', 'instanceof', 'in', 'of', 'for', 'while', 'do',
  'function', 'true', 'false', 'null', 'undefined',
]);

const API_NAMES = new Set([
  'setVar', 'assert', 'console', 'JSON', 'req', 'res', 'env',
  'parse', 'stringify', 'log', 'warn', 'error', 'ok', 'equal', 'exists',
  'statusCode', 'body', 'headers', 'durationMs', 'method', 'url',
]);

function span(cls, text) {
  return `<span class="${cls}">${text}</span>`;
}

/**
 * Syntax highlight leve para scripts Pre-request / Tests (regex, estilo VS Code dark).
 */
export function highlightScript(code) {
  if (!code) return '';

  const tokens = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const rest = code.slice(i);

    // Comentário linha
    if (rest.startsWith('//')) {
      const end = code.indexOf('\n', i);
      const sliceEnd = end === -1 ? len : end;
      tokens.push(span('hl-comment', escapeHtml(code.slice(i, sliceEnd))));
      i = sliceEnd;
      continue;
    }

    // String template, double, single
    const strMatch = rest.match(/^(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
    if (strMatch) {
      tokens.push(span('hl-string', escapeHtml(strMatch[0])));
      i += strMatch[0].length;
      continue;
    }

    // Número
    const numMatch = rest.match(/^\b\d+\.?\d*\b/);
    if (numMatch) {
      tokens.push(span('hl-number', escapeHtml(numMatch[0])));
      i += numMatch[0].length;
      continue;
    }

    // Identificador / keyword / API
    const idMatch = rest.match(/^[a-zA-Z_$][\w$]*/);
    if (idMatch) {
      const word = idMatch[0];
      let cls = 'hl-plain';
      if (KEYWORDS.has(word)) cls = 'hl-keyword';
      else if (API_NAMES.has(word)) cls = 'hl-api';
      tokens.push(span(cls, escapeHtml(word)));
      i += word.length;
      continue;
    }

    // Pontuação e operadores (destaque leve em chaves)
    if (/^[{}()[\];,.]/.test(rest)) {
      const ch = rest[0];
      const cls = ch === '{' || ch === '}' ? 'hl-brace' : 'hl-punct';
      tokens.push(span(cls, escapeHtml(ch)));
      i += 1;
      continue;
    }

    if (/^(===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!])/.test(rest)) {
      const opMatch = rest.match(/^(===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!])/);
      tokens.push(span('hl-operator', escapeHtml(opMatch[0])));
      i += opMatch[0].length;
      continue;
    }

    // Espaço ou outro caractere
    tokens.push(escapeHtml(rest[0]));
    i += 1;
  }

  return tokens.join('');
}

export function bindScriptCodeEditor(wrap) {
  if (!wrap) return;
  const textarea = wrap.querySelector('textarea');
  const pre = wrap.querySelector('.script-code-highlight');
  if (!textarea || !pre) return;

  const sync = () => {
    pre.innerHTML = `${highlightScript(textarea.value)}\n`;
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  };

  textarea.addEventListener('input', sync);
  textarea.addEventListener('scroll', sync);
  sync();
}

export function renderScriptCodeEditor(field, value, options = {}) {
  const { rows = 14, placeholder = '', extraClass = '' } = options;
  const ph = placeholder ? ` placeholder="${escapeAttr(placeholder)}"` : '';
  return `
    <div class="script-code-editor ${extraClass}" data-script-editor="${field}">
      <pre class="script-code-highlight" aria-hidden="true"></pre>
      <textarea class="script-editor script-editor-code" data-field="${field}" rows="${rows}"${ph} spellcheck="false">${escapeHtml(value || '')}</textarea>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
