import { showToast } from '../../../utils/toast.js';

export function copyBody(text) {
  navigator.clipboard.writeText(text);
  showToast('Body copiado', { type: 'info' });
}

export function copyHeaders(headers) {
  navigator.clipboard.writeText(JSON.stringify(headers, null, 2));
  showToast('Headers copiados', { type: 'info' });
}

export const response = { copyBody, copyHeaders };
