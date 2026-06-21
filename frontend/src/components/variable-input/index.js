import {
  parseValue,
  bindVariablePicker,
  readVariableInputValue,
} from '../../utils/variableInput.js';

const mounted = new WeakMap();

export function mountVariableInput(host, { value = '', varKeys = [], onChange, inputType = 'text' } = {}) {
  if (!host) return null;

  const prev = mounted.get(host);
  if (prev?.destroy) prev.destroy();

  host.classList.add('var-input-host');
  host.innerHTML = '<div class="var-input-wrap"><div class="var-input-content"></div></div>';
  const content = host.querySelector('.var-input-content');

  let getKeys = () => varKeys;
  const unbinders = [];

  function emitChange() {
    const serialized = readVariableInputValue(host);
    host.dataset.serialized = serialized;
    onChange?.(serialized);
  }

  function createChip(key) {
    const chip = document.createElement('span');
    chip.className = 'var-tag';
    chip.dataset.var = key;
    chip.textContent = key;
    chip.title = `Variável: ${key}`;
    chip.setAttribute('contenteditable', 'false');
    chip.addEventListener('click', () => {
      chip.remove();
      emitChange();
      focusLastField();
    });
    return chip;
  }

  function insertVarAfter(inp, key) {
    const chip = createChip(key);
    inp.insertAdjacentElement('afterend', chip);
    const next = document.createElement('input');
    next.type = inp.type;
    next.className = 'var-input-field';
    next.dataset.last = 'true';
    inp.removeAttribute('data-last');
    chip.insertAdjacentElement('afterend', next);
    bindField(next);
    next.focus();
    emitChange();
  }

  function bindField(input) {
    if (input._bound) return;
    input._bound = true;

    const unbind = bindVariablePicker(input, {
      getKeys: () => getKeys(),
      onInsert: (key, inp) => insertVarAfter(inp, key),
    });
    unbinders.push(unbind);

    input.addEventListener('input', emitChange);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && input.value === '' && input.previousElementSibling?.classList.contains('var-tag')) {
        e.preventDefault();
        input.previousElementSibling.remove();
        emitChange();
      }
    });
  }

  function createField(text = '', isLast = false) {
    const input = document.createElement('input');
    input.type = inputType === 'password' ? 'password' : 'text';
    input.className = 'var-input-field';
    input.value = text;
    if (isLast) input.dataset.last = 'true';
    bindField(input);
    return input;
  }

  function focusLastField() {
    const last = content.querySelector('.var-input-field[data-last]')
      || content.querySelector('.var-input-field:last-of-type');
    last?.focus();
  }

  function buildFromValue(val) {
    content.innerHTML = '';
    const segments = parseValue(val);
    if (!segments.length) {
      content.appendChild(createField('', true));
      return;
    }
    segments.forEach((seg) => {
      if (seg.type === 'var') {
        content.appendChild(createChip(seg.key));
      } else if (seg.value) {
        content.appendChild(createField(seg.value, false));
      }
    });
    content.appendChild(createField('', true));
  }

  buildFromValue(value);
  host.dataset.serialized = value;

  const api = {
    getValue: () => readVariableInputValue(host),
    setVarKeys: (keys) => { getKeys = () => keys; },
    destroy: () => {
      unbinders.forEach((fn) => fn?.());
      unbinders.length = 0;
      mounted.delete(host);
    },
  };

  mounted.set(host, api);
  return api;
}

export function getVariableInputValue(host) {
  return readVariableInputValue(host);
}
