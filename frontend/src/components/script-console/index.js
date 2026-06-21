import { subscribe, getState } from '../../core/store.js';

let el = null;

export function mountScriptConsole(container) {
  el = container;
  subscribe(render);
  render(getState());
}

function render(state) {
  if (!el) return;
  const logs = state.scriptLogs || [];
  if (!logs.length) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="script-console">
      <div class="script-console-header">Console</div>
      <div class="script-console-body scroll-y">
        ${logs.map((line) => `
          <div class="script-console-line script-console-${line.level}">
            <span class="script-console-phase">[${escape(line.phase)}]</span>
            <span class="script-console-msg">${escape(line.message)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
