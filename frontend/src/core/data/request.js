import { getWindow } from '../window.js';

export async function send(httpReq, requestId, baseURL, testResults = '[]') {
  return getWindow().SendRequest(httpReq, requestId, baseURL, testResults);
}
