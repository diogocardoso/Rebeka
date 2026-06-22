import { environment } from './components/environment.js';
import { workspace } from './components/workspace.js';
import { sidebar } from './components/sidebar.js';
import { envManager } from './components/envManager.js';
import { history } from './components/history.js';
import { workflow } from './components/workflow.js';
import { pane } from './components/pane/index.js';
import { fn, listFns, unregister } from './fn.js';
import { getWindow } from './window.js';

export const APP = {
  window: getWindow(),
  components: {
    environment,
    workspace,
    sidebar,
    envManager,
    history,
    workflow,
    pane,
  },
  fn,
  listFns,
  unregisterFn: unregister,
};
