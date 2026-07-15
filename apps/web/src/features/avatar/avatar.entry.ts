import './avatar-universe.css';
import './avatar.elite.css';
import { mount as mountAvatar } from './avatar.page';
import { mountEliteAvatarLayer } from './avatar.elite';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.avatarOwner === 'mounted') return;
  root.dataset.avatarOwner = 'mounted';

  await mountAvatar();
  const cleanupElite = mountEliteAvatarLayer();
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupElite();
    delete root.dataset.avatarOwner;
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('beforeunload', cleanup);
  };

  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}