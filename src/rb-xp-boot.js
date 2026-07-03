import { bootXp, awardXp } from './rb-xp.js';
const key = document.body?.dataset?.section || document.body?.dataset?.rbPage || 'global';
const eventKey = key === 'auth' ? 'daily_tap_in' : key === 'profile' ? 'profile_view' : key === 'creator' ? 'creator_open' : key === 'meta' ? 'meta_enter' : 'section_visit';
bootXp(eventKey);
window.RB_XP = { awardXp, bootXp, key };
