import { supabase } from './supabase-client.js';
import { loadPersonality, label } from './rb-personality.js';

await loadPersonality();

document.documentElement.dataset.rbPersonal = 'true';

function css(href, id) { if (document.getElementById(id)) return; const link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link); }
css('/src/rb-personal-build.css?v=personal-2', 'rbPersonalBuildCss');
css('/src/rb-personality-motion.css?v=motion-1', 'rbPersonalityMotionCss');

const page = document.body?.dataset?.rbPage || document.body?.dataset?.section || location.pathname.split('/').pop().replace('.html','') || 'index';
const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => { if (el && text) el.textContent = text; });
const soft = (sel, text) => document.querySelectorAll(sel).forEach((el) => { if (el && text && !el.dataset.locked) el.textContent = text; });
const addStrip = (target, title, text) => { const node = document.querySelector(target); if (!node || node.querySelector('.rb-personal-strip')) return; const div = document.createElement('div'); div.className = 'rb-personal-strip'; div.innerHTML = `<b>${title}</b><span>${text}</span>`; node.appendChild(div); };

const PAGE = {
  messages: ['RICH-DM’S', 'Smoke-cloud threads, calls, reactions, reads, and typing.', 'DM STYLE', 'rolling smoke...'],
  store: ['STORE MARKET', 'Products, unlocks, carts, seller profiles, and creator money.', 'MONEY FLOW', 'shop / sell / unlock'],
  gaming: ['RICH BIZNESS ARCADE', 'Elite action, strategy, chess, racing, cards, and score XP.', 'ELITE PLAY', '5 action + 5 strategy loaded'],
  music: ['MUSIC DISTRICT', 'Tracks, playlists, likes, comments, and play events.', 'AUDIO MODE', 'drop music and build plays'],
  podcast: ['PODCAST ARENA', 'Shows, episodes, covers, audio, likes, and comments.', 'VOICE MODE', 'real conversations'],
  radio: ['RB RADIO', 'Stations, sessions, and radio listeners from real records.', 'RADIO MODE', 'live from records'],
  sports: ['SPORTS ARENA', 'Sports posts, picks, teams, leagues, brackets, and broadcasts.', 'GAME DAY', 'picks + clips + broadcasts'],
  gallery: ['GALLERY DISTRICT', 'Visual drops, uploads, media, and creator gallery posts.', 'VISUAL MODE', 'real gallery drops'],
  creator: ['CREATOR HUB', 'Creator balances, alerts, page settings, live, store, music, and meta.', 'BOSS MODE', 'monetize the universe'],
  admin: ['CONTROL ROOM', 'Roles, audits, review queue, flags, jobs, logs, and system health.', 'OPS MODE', 'real control only'],
  notifications: ['RICH ALERTS', 'Notifications, reads, push devices, live, creator, sports, game, and store alerts.', 'ALERT MODE', 'nothing fake, real events only'],
  edit: ['EDIT PROFILE', 'Update identity, avatar, banner, socials, rank, and presence.', 'IDENTITY MODE', 'make the profile yours'],
  settings: ['SETTINGS HUB', 'Theme, privacy, user preferences, app controls, and personal setup.', 'SETTINGS MODE', 'lock in your experience'],
  avatar: ['RICH AVATAR', 'Boss walk, smoke aura, meta presence, profile sync, and full-body motion.', 'CHARACTER MODE', 'ThatboyTayThou boss walk'],
  auth: ['TAP INTO RICH BIZNESS', 'Sign in and unlock Live, Music, Gaming, Sports, Gallery, Store, and Meta.', 'ACCESS MODE', 'create or sign in'],
  profile: ['THATBOYTAYTHOU', 'XP wallet, rank, avatar, creator systems, and real drops.', 'PROFILE MODE', 'Money Road • Smoke Cloud • Green Gold'],
  index: ['RICH BIZNESS UNIVERSE', label('brand_voice','motto','Your world. Your rules. Your empire.'), 'PORTAL MODE', 'WELCOME BACK']
};

async function currentProfile() { const { data: auth } = await supabase.auth.getUser(); const user = auth?.user; if (!user) return null; const { data } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,rank_title,rich_level,rich_points,balance_cents,metadata').eq('id', user.id).maybeSingle(); return data || { id: user.id, display_name: label('brand_voice', 'owner_handle', 'ThatboyTayThou'), username: 'thatboytaythou' }; }

function paintPage() {
  const c = PAGE[page]; if (!c) return;
  soft('.hero h1', c[0]); soft('.hero p', c[1]); soft('.kicker', c[2]);
  addStrip('.hero', c[2], c[3]);
  document.title = `${c[0]} • Rich Bizness`;
  document.body.dataset.rbPersonalPage = page;
}

function stripOldDebugWords() {
  const replace = { 'Schema Sync':'Live State', 'Gaming Sync':'Elite Game State', 'Message Sync':'Rich-DM State', 'Store Sync':'Market State', 'PRIMARY':'SECTION', 'TABLES':'STATUS', 'SYNC':'LIVE', 'Loading gaming...':'Loading real games...', 'Loading messages...':'Loading Rich-DMs...', 'Loading store...':'Loading real products...' };
  document.querySelectorAll('h2,small,b,div').forEach((el) => { if (el.children.length) return; const t = el.textContent?.trim(); if (replace[t]) el.textContent = replace[t]; });
}

async function paintIdentityPages() {
  if (page === 'auth') { set('.auth-card h1', 'TAP INTO RICH BIZNESS'); set('.auth-card .sub', 'Build your Rich Bizness lane across Live, Music, Gaming, Sports, Gallery, Store, and Meta.'); const dn = document.getElementById('displayName'); if (dn && !dn.value) dn.placeholder = label('brand_voice','owner_handle','ThatboyTayThou'); addStrip('.auth-card', 'ONE HOME BASE', 'Real wealth. Real power. Build legacy.'); }
  if (page === 'profile') { const p = await currentProfile(); if (p) { set('#displayName', p.display_name || label('brand_voice','owner_handle','ThatboyTayThou')); set('#username', '@' + (p.username || 'thatboytaythou')); set('#bio', p.bio || 'Building my Rich Bizness lane across live, music, gaming, sports, gallery, store, and money.'); set('#rank', p.rank_title || label('home_labels','rank_default','BIZ LEGEND')); set('#level', String(p.rich_level || 1)); set('#xp', String(p.rich_points || 0)); set('#cash', '$' + (Number(p.balance_cents || 0) / 100).toFixed(2)); } addStrip('.profile-screen .hero', 'THATBOYTAYTHOU MODE', 'Money Tree • Money Road • Smoke Cloud • Green Gold Universe'); }
  if (page === 'avatar') { set('.avatar-panel p', 'FULL BODY CINEMA CHARACTER'); set('.avatar-panel h1', 'BUILD YOUR RICH BIZNESS CHARACTER'); const dn = document.getElementById('displayName'); if (dn && !dn.value) dn.placeholder = label('brand_voice','owner_handle','ThatboyTayThou'); addStrip('.avatar-panel', 'CHARACTER UPGRADE', 'Boss walk, smoke-cloud aura, green-gold motion, Meta sync.'); }
  if (page === 'index' || document.querySelector('.rb-universe')) set('.headline p', label('brand_voice','motto','Your world. Your rules. Your empire.'));
}

paintPage();
stripOldDebugWords();
await paintIdentityPages();
setTimeout(() => { paintPage(); stripOldDebugWords(); }, 450);
