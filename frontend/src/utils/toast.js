let host = null;

export function showToast(message, options = {}) {
  const { type = 'info', duration = 2500 } = options;
  if (!host) {
    host = document.createElement('div');
    host.id = 'rebeka-toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  const dismiss = () => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 200);
  };

  const timer = setTimeout(dismiss, duration);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
}
