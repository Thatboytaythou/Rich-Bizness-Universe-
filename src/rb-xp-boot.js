import { bootXp, awardXp } from './rb-xp.js';

const key = document.body?.dataset?.section || document.body?.dataset?.rbPage || 'global';

bootXp(null);
window.RB_XP = { awardXp, bootXp, key, passiveXp: false };
