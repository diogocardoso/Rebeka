import { subscribe, getState } from '../core/store.js';

let el = null;

export function mountTestResults(container) {
  el = container;
  subscribe(render);
  render(getState());
}

function render(state) {
  if (!el) return;
  const results = state.testResults || [];
  if (!results.length) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="test-results">
      <h4>Resultados dos Testes</h4>
      <table class="kv-table">
        <thead><tr><th>Teste</th><th>Status</th><th>Mensagem</th></tr></thead>
        <tbody>
          ${results.map((r) => `
            <tr>
              <td>${escape(r.name)}</td>
              <td class="${r.passed ? 'status-2xx' : 'status-5xx'}">${r.passed ? 'Passou' : 'Falhou'}</td>
              <td>${escape(r.message)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
