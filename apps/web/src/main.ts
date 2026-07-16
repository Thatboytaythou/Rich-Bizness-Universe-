import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/avatar-premium.css';
import './styles/xp-runtime.css';
import './styles/media-containment.css';
import { bootstrap } from './bootstrap';
import { mountAdminSecretDoor } from './core/admin/secret-door';
import { mountXpRuntime } from './core/xp/xp-runtime';

void bootstrap().then(async () => {
  await Promise.allSettled([
    mountXpRuntime(),
    mountAdminSecretDoor()
  ]);
});
