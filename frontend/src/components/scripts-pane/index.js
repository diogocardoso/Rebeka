import { getState, subscribe } from '../../core/store.js';

let el = null;

export function mountScriptsPane(container) {
  el = container;
  subscribe(render);
  render(getState());
}

function render(state) {
  if (!el) return;
  if (state.uiState.activeView !== 'scripts') {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <div class="scripts-pane empty-pane">
      <h3>Scripts do host</h3>
      <p class="text-muted">Em breve — scripts compartilhados por host.</p>
    </div>
  `;
}
