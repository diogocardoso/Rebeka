import { patchState, scheduleSave, getState } from './store.js';
import { APP } from './app.js';

let applyViewUI = null;

export function registerViewApplier(fn) {
  applyViewUI = fn;
}

export async function setActiveView(view) {
  patchState((s) => ({
    ...s,
    uiState: {
      ...s.uiState,
      activeView: view,
      activeRequestId: view === 'request' ? s.uiState.activeRequestId : '',
    },
  }));
  applyViewUI?.(view);

  if (view === 'variables') {
    const { activeHostId } = getState().uiState;
    if (activeHostId && !(getState().environments || []).length) {
      await APP.components.envManager.findAll(activeHostId);
    }
  }

  scheduleSave();
}
