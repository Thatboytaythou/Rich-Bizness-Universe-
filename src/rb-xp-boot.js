import { bootXp, awardXp } from './rb-xp.js';

const key = document.body?.dataset?.section || document.body?.dataset?.rbPage || 'global';
const earnMap = {
  feed: 'feed_post',
  music: 'music_play',
  podcast: 'podcast_play',
  radio: 'radio_listen',
  live: 'live_watch',
  watch: 'live_watch',
  gaming: 'game_play',
  games: 'game_play',
  sports: 'sports_pick',
  store: 'store_action',
  upload: 'upload_drop',
  meta: 'meta_enter',
  creator: 'creator_open'
};

bootXp(earnMap[key] || null);
window.RB_XP = { awardXp, bootXp, key };
