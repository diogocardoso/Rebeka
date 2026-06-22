import {
  Quit,
  WindowMinimise,
  WindowToggleMaximise,
} from '../../wailsjs/runtime/runtime.js';

export function isWailsDesktop() {
  return typeof window !== 'undefined' && !!window.runtime;
}

export function bindWindowControls(root) {
  if (!isWailsDesktop()) {
    root.querySelector('.window-controls')?.remove();
    return;
  }

  root.querySelector('[data-win="minimize"]')?.addEventListener('click', () => {
    WindowMinimise();
  });

  root.querySelector('[data-win="maximize"]')?.addEventListener('click', () => {
    WindowToggleMaximise();
  });

  root.querySelector('[data-win="close"]')?.addEventListener('click', () => {
    Quit();
  });

  const header = root.querySelector('.app-header');
  header?.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, select, input, a, .window-controls')) return;
    WindowToggleMaximise();
  });
}
