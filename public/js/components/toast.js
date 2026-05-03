const TOAST_DURATION = 3000;
const TOAST_CLEANUP_FALLBACK = 500;

export const showToast = (message, isError = false) => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.textContent = message.endsWith('.') ? message.slice(0, -1) : message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    const cleanup = () => {
      if (toast.parentNode) toast.remove();
    };
    toast.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, TOAST_CLEANUP_FALLBACK);
  }, TOAST_DURATION);
};
