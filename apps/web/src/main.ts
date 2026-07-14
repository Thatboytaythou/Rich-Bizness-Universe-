import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/avatar-premium.css';
import './styles/xp-runtime.css';
import './styles/live-studio-v2.css';
import { bootstrap } from './bootstrap';
import { mountXpRuntime } from './core/xp/xp-runtime';

void bootstrap().then(() => mountXpRuntime());
