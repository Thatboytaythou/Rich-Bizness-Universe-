import { mount as mountHumanAvatar } from './avatar.human.page';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.avatarCharactersOwner === 'mounted') return;
  root.dataset.avatarCharactersOwner = 'mounted';
  await mountHumanAvatar();
}
