import { supabase } from './supabase-client.js';

const FALLBACK = {
  brand_voice: {
    brand: 'Rich Bizness',
    app: 'Rich Bizness Universe',
    owner_handle: 'ThatboyTayThou',
    tone: 'bossed-up cinematic smoke-cloud green-gold',
    greeting: 'They’re here Rich',
    cta: 'Check them out Rich →',
    motto: 'Your world. Your rules. Your empire.'
  },
  home_labels: {
    welcome: 'WELCOME BACK',
    rich_level: 'RICH LEVEL',
    rank_default: 'BIZ LEGEND',
    online_label: 'ONLINE',
    portal: 'PORTAL HUB',
    live: 'WE 🔥 📺',
    live_room: 'Bizness Party',
    profile: 'XP WALLET'
  },
  live_labels: {
    screen: 'WE 🔥 📺',
    room: 'Bizness Party',
    status: 'Get Right',
    cohost: 'Rich Playa Co-Host Room',
    party_over: 'Party’s Over',
    chat_enabled: 'Chat enabled',
    replay_enabled: 'Replay enabled'
  },
  dm_labels: {
    brand: 'Rich-DM’s',
    reaction: '💨',
    typing: 'rolling smoke...',
    call_theme: 'Rich Call',
    bubble: 'smoke-cloud',
    effect: 'smoke-trail'
  },
  visual_identity: {
    theme: 'smoke-cloud',
    color_theme: 'green-gold',
    quality: '4k-hd',
    depth: '3d',
    cinema_mode: true,
    tv_mode: true,
    motion_level: 'cinema'
  }
};

let cache = FALLBACK;

export async function loadPersonality() {
  try {
    const { data, error } = await supabase.rpc('rb_personality', { p_key: null });
    if (!error && data && typeof data === 'object') cache = { ...FALLBACK, ...data };
  } catch (_) {}
  applyPersonality(cache);
  return cache;
}

export function personality() { return cache; }
export function label(group, key, fallback = '') { return cache?.[group]?.[key] || FALLBACK?.[group]?.[key] || fallback; }

export function applyPersonality(p = cache) {
  const voice = p.brand_voice || FALLBACK.brand_voice;
  const home = p.home_labels || FALLBACK.home_labels;
  const live = p.live_labels || FALLBACK.live_labels;
  const dm = p.dm_labels || FALLBACK.dm_labels;
  document.documentElement.dataset.rbPersonality = 'thatboytaythou';
  document.documentElement.dataset.rbTheme = p.visual_identity?.theme || 'smoke-cloud';
  document.querySelectorAll('[data-rb-brand]').forEach((el) => { el.textContent = voice.brand; });
  document.querySelectorAll('[data-rb-app]').forEach((el) => { el.textContent = voice.app; });
  document.querySelectorAll('[data-rb-owner]').forEach((el) => { el.textContent = voice.owner_handle; });
  document.querySelectorAll('[data-rb-motto]').forEach((el) => { el.textContent = voice.motto; });
  document.querySelectorAll('[data-rb-welcome]').forEach((el) => { el.textContent = home.welcome; });
  document.querySelectorAll('[data-rb-rank-default]').forEach((el) => { el.textContent = home.rank_default; });
  document.querySelectorAll('[data-rb-live-title], #tvTitle').forEach((el) => { if (!el.dataset.locked) el.textContent = live.screen; });
  document.querySelectorAll('[data-rb-live-room], #tvRoom').forEach((el) => { if (!el.dataset.locked) el.textContent = live.room; });
  document.querySelectorAll('[data-rb-dm-brand]').forEach((el) => { el.textContent = dm.brand; });
}

loadPersonality();
