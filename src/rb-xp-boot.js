import { bootXp, awardXp } from './rb-xp.js?v=xp-engine-2';

const key = document.body?.dataset?.section || document.body?.dataset?.rbPage || 'global';

bootXp(null);
window.RB_XP = { awardXp, bootXp, key, passiveXp: false, engine: 'xp-engine-2' };
