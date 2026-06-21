import { getWindow } from '../window.js';

export async function exportBek(workspaceId) {
  return getWindow().ExportBek(workspaceId);
}

export async function importBek() {
  return getWindow().ImportBek();
}
