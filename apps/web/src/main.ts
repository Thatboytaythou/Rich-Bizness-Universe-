import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/xp-runtime.css';
import './styles/media-containment.css';
import './pages/feed/feed-elite.css';
import { bootstrap } from './bootstrap';
import { mountAdminSecretDoor } from './core/admin/secret-door';
import { mountUniverseBridge } from './core/navigation/universe-bridge';
import { mountXpRuntime } from './core/xp/xp-runtime';

void bootstrap().then(async () => {
  mountUniverseBridge();
  const tasks: Promise<unknown>[] = [mountAdminSecretDoor()];
  if ((document.body.dataset.page ?? '') !== 'home') tasks.push(mountXpRuntime());
  await Promise.allSettled(tasks);
});