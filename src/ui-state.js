const listeners = new Set();

export function setRegionState(target, { title = '', message = '', action = '', tone = 'ready' } = {}) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (!node) return;
  const button = action ? `<button type="button" data-ui-retry>${escapeHtml(action)}</button>` : '';
  node.innerHTML = `<section class="rb-ui-state" data-tone="${escapeHtml(tone)}" role="status" aria-live="polite"><span class="rb-ui-state-orb" aria-hidden="true"></span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>${button}</section>`;
}

export function bindRetry(handler) {
  if (typeof handler !== 'function') return () => {};
  const listener = (event) => {
    const button = event.target.closest('[data-ui-retry]');
    if (!button) return;
    handler(event);
  };
  document.addEventListener('click', listener);
  listeners.add(listener);
  return () => {
    document.removeEventListener('click', listener);
    listeners.delete(listener);
  };
}

export function watchConnection(onChange) {
  const emit = () => onChange?.(navigator.onLine);
  addEventListener('online', emit);
  addEventListener('offline', emit);
  emit();
  return () => {
    removeEventListener('online', emit);
    removeEventListener('offline', emit);
  };
}

export function focusRequestedCard(container, queryKey = 'post') {
  const id = new URLSearchParams(location.search).get(queryKey);
  if (!id || !container) return false;
  const node = container.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!node) return false;
  node.dataset.focused = 'true';
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => delete node.dataset.focused, 2400);
  return true;
}

export function cleanupUiState() {
  listeners.forEach((listener) => document.removeEventListener('click', listener));
  listeners.clear();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
