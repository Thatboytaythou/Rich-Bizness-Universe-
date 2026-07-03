import { supabase } from './supabase-client.js';

const FALLBACK = {
  brand_voice: { brand: 'Rich Bizness', app: 'Rich Bizness Universe', owner_handle: 'ThatboyTayThou', tone: 'bossed-up cinematic smoke-cloud green-gold', greeting: 'They’re here Rich', cta: 'Check them out Rich →', motto: 'Your world. Your rules. Your empire.' },
  home_labels: { welcome: 'WELCOME BACK', rich_level: 'RICH LEVEL', rank_default: 'BIZ LEGEND', online_label: 'ONLINE', portal: 'PORTAL HUB', live: 'WE 🔥 📺', live_room: 'Bizness Party', profile: 'XP WALLET' },
  live_labels: { screen: 'WE 🔥 📺', room: 'Bizness Party', status: 'Get Right', cohost: 'Rich Playa Co-Host Room', party_over: 'Party’s Over', chat_enabled: 'Chat enabled', replay_enabled: 'Replay enabled' },
  dm_labels: { brand: 'Rich-DM’s', reaction: '💨', typing: 'rolling smoke...', call_theme: 'Rich Call', bubble: 'smoke-cloud', effect: 'smoke-trail' },
  visual_identity: { theme: 'smoke-cloud', color_theme: 'green-gold', quality: '4k-hd', depth: '3d', cinema_mode: true, tv_mode: true, motion_level: 'cinema' }
};

const PAGE_COPY = {
  index: ['RICH BIZNESS UNIVERSE', 'WELCOME BACK TO THE PORTAL HUB', 'ONE UNIVERSE. REAL ROUTES. REAL DATA.'],
  auth: ['TAP IN', 'Sign in and unlock Rich Bizness access.', 'CREATE OR SIGN IN'],
  profile: ['THATBOYTAYTHOU', 'XP wallet, rank, avatar, creator systems, and real drops.', 'OPEN PROFILE'],
  avatar: ['RICH AVATAR', 'Boss walk, smoke aura, profile identity, and meta presence.', 'SAVE AVATAR'],
  messages: ['RICH-DM’S', 'Smoke-cloud threads, calls, reactions, and typing.', 'OPEN DMS'],
  store: ['STORE MARKET', 'Products, seller profiles, unlocks, and creator money.', 'SHOP / SELL'],
  gaming: ['RICH BIZNESS ARCADE', 'Elite action, strategy, chess, racing, cards, and XP scores.', 'PLAY NOW'],
  music: ['MUSIC DISTRICT', 'Tracks, playlists, plays, likes, and creator audio.', 'DROP MUSIC'],
  podcast: ['PODCAST ARENA', 'Episodes, shows, covers, audio, likes, and comments.', 'DROP EPISODE'],
  radio: ['RB RADIO', 'Stations and sessions powered by radio records.', 'OPEN RADIO'],
  sports: ['SPORTS ARENA', 'Sports posts, picks, brackets, uploads, and broadcasts.', 'DROP SPORTS'],
  gallery: ['GALLERY DISTRICT', 'Visual drops routed from uploads and gallery media.', 'UPLOAD VISUAL'],
  creator: ['CREATOR HUB', 'Creator page, balances, alerts, store, music, live, and meta.', 'OPEN CREATOR'],
  admin: ['CONTROL ROOM', 'Admin roles, review queue, flags, jobs, logs, and system health.', 'CHECK OPS'],
  notifications: ['RICH ALERTS', 'Alerts, reads, push devices, live, creator, sports, game, store.', 'CHECK ALERTS'],
  edit: ['EDIT PROFILE', 'Update identity, avatar, banner, socials, and Rich presence.', 'SAVE PROFILE'],
  settings: ['SETTINGS HUB', 'Personal preferences, theme, privacy, and app controls.', 'SAVE SETTINGS']
};

let cache = FALLBACK;
const pageKey = () => document.body?.dataset?.section || document.body?.dataset?.rbPage || location.pathname.split('/').pop().replace('.html', '') || 'index';

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

function set(sel, text) { document.querySelectorAll(sel).forEach((el) => { if (el && text) el.textContent = text; }); }
function soft(sel, text) { document.querySelectorAll(sel).forEach((el) => { if (el && text && !el.dataset.locked) el.textContent = text; }); }

function applyPageCopy() {
  const key = pageKey();
  const copy = PAGE_COPY[key];
  if (!copy) return;
  soft('.hero h1', copy[0]);
  soft('.hero p', copy[1]);
  soft('.panel h2', key === 'messages' ? 'Rich Threads' : key === 'gaming' ? 'Elite Game Hub' : copy[0]);
  document.title = `${copy[0]} • Rich Bizness`;
  document.body.dataset.rbPageReady = 'true';
}

function cleanOldWords() {
  const swaps = new Map([
    ['Schema Sync', 'Live State'], ['Gaming Sync', 'Elite Game State'], ['Message Sync', 'Rich-DM State'], ['Store Sync', 'Market State'], ['PRIMARY', 'SECTION'], ['TABLES', 'STATUS'], ['SYNC', 'LIVE'], ['Tap In', 'Rich Access'], ['Live 24/7', 'Live from records'], ['ENERGY HIGH', 'REAL DATA']
  ]);
  document.querySelectorAll('h1,h2,h3,p,small,b,span,button,a,div').forEach((el) => {
    if (el.children.length) return;
    const t = el.textContent?.trim();
    if (swaps.has(t)) el.textContent = swaps.get(t);
  });
}

function ensureMotionLayer() {
  if (document.getElementById('rbMotionLayer')) return;
  const layer = document.createElement('div');
  layer.id = 'rbMotionLayer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<i></i><i></i><i></i>';
  document.body.appendChild(layer);
}

function ensureAvatarPresence() {
  const key = pageKey();
  if (!['auth', 'profile', 'avatar', 'edit', 'settings'].includes(key)) return;
  if (document.getElementById('rbCharacter')) return;
  const char = document.createElement('section');
  char.id = 'rbCharacter';
  char.innerHTML = '<div class="rb-char-aura"></div><div class="rb-char-head"><span>RB</span></div><div class="rb-char-body"><b></b></div><div class="rb-char-shadow"></div><small>ThatboyTayThou • Boss Walk</small>';
  const target = document.querySelector('.hero') || document.querySelector('main') || document.body;
  target.insertAdjacentElement('beforeend', char);
}

export function applyPersonality(p = cache) {
  const voice = p.brand_voice || FALLBACK.brand_voice;
  const home = p.home_labels || FALLBACK.home_labels;
  const live = p.live_labels || FALLBACK.live_labels;
  const dm = p.dm_labels || FALLBACK.dm_labels;
  document.documentElement.dataset.rbPersonality = 'thatboytaythou';
  document.documentElement.dataset.rbTheme = p.visual_identity?.theme || 'smoke-cloud';
  document.body?.classList.add('rb-personality-on');
  set('[data-rb-brand]', voice.brand);
  set('[data-rb-app]', voice.app);
  set('[data-rb-owner]', voice.owner_handle);
  set('[data-rb-motto]', voice.motto);
  set('[data-rb-welcome]', home.welcome);
  set('[data-rb-rank-default]', home.rank_default);
  soft('[data-rb-live-title], #tvTitle', live.screen);
  soft('[data-rb-live-room], #tvRoom', live.room);
  set('[data-rb-dm-brand]', dm.brand);
  applyPageCopy();
  cleanOldWords();
  ensureMotionLayer();
  ensureAvatarPresence();
}

loadPersonality();
