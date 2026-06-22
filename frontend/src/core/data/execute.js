import { getWindow } from '../window.js';

export async function resolve(path, workspaceRef) {
  const w = getWindow();
  if (!w?.ResolveRequestByPath) {
    throw new Error('ResolveRequestByPath indisponível — reinicie o app Wails');
  }
  return w.ResolveRequestByPath(String(path || ''), String(workspaceRef || ''));
}
