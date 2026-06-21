import { patchState } from '../store.js';
import { data } from '../data/index.js';

export async function loadForRequest(requestId) {
  if (!requestId) {
    patchState((s) => ({ ...s, requestHistory: [] }));
    return [];
  }
  try {
    const entries = await data.history.list(requestId);
    patchState((s) => ({ ...s, requestHistory: entries || [] }));
    return entries || [];
  } catch (e) {
    console.error('Load history failed:', e);
    patchState((s) => ({ ...s, requestHistory: [] }));
    return [];
  }
}

export function historyEntryToResponse(entry) {
  let headers = {};
  try {
    headers = JSON.parse(entry.responseHeaders || '{}');
  } catch {
    /* */
  }
  return {
    statusCode: entry.statusCode,
    body: entry.responseBody || '',
    headers,
    durationMs: entry.durationMs,
    sizeBytes: entry.sizeBytes,
    historyId: entry.id,
  };
}

export function parseHistoryTests(entry) {
  try {
    return JSON.parse(entry.testResults || '[]');
  } catch {
    return [];
  }
}

export const history = { loadForRequest, historyEntryToResponse, parseHistoryTests };
