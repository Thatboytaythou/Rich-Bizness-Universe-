import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/xp-runtime.css';
import './styles/media-containment.css';
import './pages/feed/feed-elite.css';
import './pages/portal/portal.cleanup.css';
import './pages/tap-in/tap-in.elite.css';
import { bootstrap } from './bootstrap';
import { mountAdminSecretDoor } from './core/admin/secret-door';
import { mountUniverseBridge } from './core/navigation/universe-bridge';
import { mountXpRuntime } from './core/xp/xp-runtime';

void bootstrap().then(async () => {
  const page = document.body.dataset.page ?? '';

  /* Mobile Search must not summon the keyboard before the user taps the field. */
  if (page === 'search' && matchMedia('(max-width: 760px)').matches) {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
  }

  /* The signed-in Portal never owns a text input. Clear stale Safari focus restored by bfcache. */
  if (page === 'portal') {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
  }

  mountUniverseBridge();
  const tasks: Promise<unknown>[] = [mountAdminSecretDoor()];
  if (page !== 'home') tasks.push(mountXpRuntime());
  await Promise.allSettled(tasks);
});
