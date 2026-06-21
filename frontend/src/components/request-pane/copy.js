import { showToast } from '../../utils/toast.js';

export function copyUrl(text) {
  navigator.clipboard.writeText(text);
  showToast('URL copiada', { type: 'info' });
}
