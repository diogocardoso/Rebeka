import { getWindow } from '../window.js';

export async function list(requestId) {
  if (!requestId) return [];
  return getWindow().ListHistory(requestId) || [];
}

export async function patchTests(requestId, testResults) {
  if (!requestId) return;
  await getWindow().UpdateLatestHistoryTests(requestId, testResults);
}
