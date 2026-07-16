import { mount as mountAvatarSelector } from './avatar.selector.page';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.avatarOwner === 'mounted') return;
  root.dataset.avatarOwner = 'mounted';
  await mountAvatarSelector();
}
