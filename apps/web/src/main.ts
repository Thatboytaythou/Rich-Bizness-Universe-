import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/xp-runtime.css';
import './styles/media-containment.css';
import { bootstrap } from './bootstrap';
import { mountXpRuntime } from './core/xp/xp-runtime';

const ADMIN_SECRET_DOOR_PAGES = new Set([
  'portal',
  'profile',
  'settings',
  'notifications',
  'messages',
  'creator',
  'admin'
]);

void bootstrap().then(async () => {
  const page = document.body.dataset.page ?? '';

  if (page === 'search' && matchMedia('(max-width: 760px)').matches) {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
  }

  if (page === 'portal') {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
  }

  const tasks: Promise<unknown>[] = [];

  if (page === 'live') {
    tasks.push(import('./core/navigation/universe-bridge').then(({ mountUniverseBridge }) => mountUniverseBridge()));
  }

  if (ADMIN_SECRET_DOOR_PAGES.has(page)) {
    tasks.push(import('./core/admin/secret-door').then(({ mountAdminSecretDoor }) => mountAdminSecretDoor()));
  }

  tasks.push(mountXpRuntime());
  await Promise.allSettled(tasks);
});