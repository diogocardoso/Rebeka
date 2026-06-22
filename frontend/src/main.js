import WA from 'waframe';
import { APP } from './core/app.js';
import { hydrate, getState } from './core/store.js';
import { showToast } from './utils/toast.js';
import { mountAppLayout } from './views/AppLayout.js';

async function init() {  
  globalThis.WA = WA;
  globalThis.APP = APP;
  APP.toast = showToast;

  const app = document.getElementById('app');
  if (!app) return;

  APP.box = (id, config)=>{
    WA.box(id, WA.hp.extend({ local: 'app', skin: 'REBEK' }, config));
  };

  APP.box_confirm = (id, config)=>{
    WA.box(id, WA.hp.extend({ local:'app',skin:'REBEK',confirm:true,btAction:{text:'Sim, excluir',color:'red'},btCancel:{text:'Não, cancelar',color:'blue'}}, config));
  };

  APP.box_closed = (id)=>{
    WA.box_closed(id);
  };

  mountAppLayout(app);

  if (APP.window) {
    try {
      await hydrate();
      const requestId = getState().uiState.activeRequestId;
      if (requestId) {
        await APP.components.history.loadForRequest(requestId);
      }
    } catch (e) {
      console.error('Init hydrate failed:', e);
      APP.toast?.('Erro ao carregar dados. Verifique o banco SQLite.', { type: 'error', duration: 5000 });
    }
  } else {
    console.warn('Wails bindings não disponíveis — modo preview');
  }
}

init();

WA.APP.Element.add('app', '#app');
