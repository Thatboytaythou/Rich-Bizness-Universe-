import './avatar-universe.css';
import './avatar.elite.css';
import { mount as mountAvatar } from './avatar.page';
import { mountEliteAvatarLayer } from './avatar.elite';

export async function mount(): Promise<void> {
  await mountAvatar();
  const cleanupElite = mountEliteAvatarLayer();
  window.addEventListener('beforeunload', cleanupElite, { once: true });
}
