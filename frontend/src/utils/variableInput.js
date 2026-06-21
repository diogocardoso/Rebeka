const VAR_RE = /\{\{([^}]+)\}\}/g;

let activePicker = null;

export function parseValue(str) {
  const segments = [];
  const text = str || '';
  let lastIndex = 0;
  let m;
  const re = new RegExp(VAR_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    const key = m[1].trim();
    if (key) segments.push({ type: 'var', key });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function serialize(segments) {
  return (segments || [])
    .map((s) => (s.type === 'var' ? `{{${s.key}}}` : s.value || ''))
    .join('');
}

export function getVarKeysFromState(state) {
  const envs = state.environments || [];
  const active = envs.find((e) => e.isActive) || envs[0];
  if (active?.variables?.length) {
    return active.variables.map((v) => v.key).filter(Boolean);
  }
  return Object.keys(state.activeEnvVars || {});
}

function hidePicker() {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
}

function showPicker(anchor, filter, keys, onSelect) {
  hidePicker();
  const q = (filter || '').toLowerCase();
  const filtered = keys.filter((k) => k.toLowerCase().includes(q));
  if (!filtered.length) return;

  const picker = document.createElement('div');
  picker.className = 'var-picker';
  picker.innerHTML = filtered
    .map((k) => `<button type="button" class="var-picker-item" data-key="${escapeAttr(k)}">${escapeHtml(k)}</button>`)
    .join('');

  document.body.appendChild(picker);
  const rect = anchor.getBoundingClientRect();
  picker.style.left = `${rect.left}px`;
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.minWidth = `${Math.max(rect.width, 160)}px`;

  picker.querySelectorAll('.var-picker-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onSelect(btn.dataset.key);
      hidePicker();
    });
  });

  activePicker = picker;

  const onDocClick = (e) => {
    if (!picker.contains(e.target) && e.target !== anchor) {
      hidePicker();
      document.removeEventListener('mousedown', onDocClick);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
}

export function bindVariablePicker(input, { getKeys, onInsert }) {
  const handler = () => {
    const val = input.value;
    const match = val.match(/@([\w.-]*)$/);
    if (!match) {
      hidePicker();
      return;
    }
    const keys = typeof getKeys === 'function' ? getKeys() : getKeys;
    showPicker(input, match[1], keys, (key) => {
      const atIdx = val.lastIndexOf('@');
      const before = val.slice(0, atIdx);
      input.value = before;
      onInsert(key, input);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  input.addEventListener('input', handler);
  input.addEventListener('blur', () => setTimeout(hidePicker, 150));
  return () => {
    input.removeEventListener('input', handler);
    hidePicker();
  };
}

export function insertVarAtInput(input, key) {
  const val = input.value;
  const atIdx = val.lastIndexOf('@');
  if (atIdx >= 0) {
    input.value = val.slice(0, atIdx);
  }
  return `{{${key}}}`;
}

export function insertVarAtCursor(textarea, key) {
  const insert = `{{${key}}}`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const before = val.slice(0, start);
  const atMatch = before.match(/@([\w.-]*)$/);
  let newBefore;
  let pos;
  if (atMatch) {
    const atIdx = before.lastIndexOf('@');
    newBefore = before.slice(0, atIdx) + insert;
    pos = newBefore.length;
  } else {
    newBefore = before + insert;
    pos = newBefore.length;
  }
  textarea.value = newBefore + val.slice(end);
  textarea.selectionStart = textarea.selectionEnd = pos;
}

export function readVariableInputValue(host) {
  if (!host) return '';
  const content = host.querySelector('.var-input-content');
  if (!content) return host.dataset.serialized || '';
  const parts = [];
  content.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('var-tag')) {
        parts.push(`{{${node.dataset.var}}}`);
      } else if (node.classList.contains('var-input-field')) {
        parts.push(node.value);
      }
    }
  });
  return parts.join('');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
