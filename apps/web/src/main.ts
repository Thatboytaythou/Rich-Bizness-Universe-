import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/xp-runtime.css';
import './styles/media-containment.css';
import './styles/live-command-v4.css';
import './features/watch/watch-elite.css';
import './pages/feed/feed-elite.css';
import './pages/tap-in/tap-in.elite.css';
import { bootstrap } from './bootstrap';
import { mountAdminSecretDoor } from './core/admin/secret-door';
import { mountUniverseBridge } from './core/navigation/universe-bridge';
import { mountXpRuntime } from './core/xp/xp-runtime';

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

  mountUniverseBridge();
  const tasks: Promise<unknown>[] = [mountAdminSecretDoor()];
  if (page !== 'home') tasks.push(mountXpRuntime());
  await Promise.allSettled(tasks);
});