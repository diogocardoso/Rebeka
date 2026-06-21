import { getWindow } from './window.js';
import { data } from './data/index.js';
import { host } from './components/host.js';
import { sidebar } from './components/sidebar.js';
import { envManager } from './components/envManager.js';
import { workspace } from './components/workspace.js';
import { pane } from './components/pane/index.js';
import { workflow } from './components/workflow.js';
import { history } from './components/history.js';
import { fn, unregister, listFns } from './fn.js';

export const APP = {
  get window() {
    return getWindow();
  },
  data,
  components: {
    sidebar,
    envManager,
    host,
    workspace,
    pane,
    workflow,
    history,
  },
  fn,
  unregister,
  listFns,
};
