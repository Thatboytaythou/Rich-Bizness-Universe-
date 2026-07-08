import { supabase } from './supabase-client.js';
import { ensureProfile, getSessionUser } from './rb-identity.js?v=tap-in-foundation-3';
import { bootXp, loadXp } from './rb-xp.js?v=realtime-1';
import './section-language-foundation.js?v=language-foundation-2';

const displayName = document.getElementById('displayName');
const username = document.getElementById('username');
const bio = document.getElementById('bio');
const avatarFace = document.getElementById('avatarFace');
const rank = document.getElementById('rank');
const level = document.getElementById('level');
const xp = document.getElementById('xp');
const xpMode = document.getElementById('xpMode');
const xpFill = document.getElementById('xpFill');
const editAvatar = document.getElementById('editAvatar');
const profileStatus = document.getElementById('profileStatus');

const fmt = (n) => Number(n || 0).toLocaleString();
const say = (text) => { if (profileStatus) profileStatus.textContent = text; };
const routes = [['/','HOME'],['/feed.html','RICH FEED'],['/upload.html','DROP ZONE'],['/live.html','WE LIT🔥'],['/watch.html','We 🔥📺'],['/music.html','MUSIC'],['/store.html','STORE'],['/profile.html','PROFILE LOCK']];

function calmProfileArtifacts() {
  document.querySelectorAll('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep])').forEach((el) => {
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden', 'true');
  });
  document.body?.removeAttribute('data-rich-money');
}
function wireRoutes() {
  calmProfileArtifacts();
  const main = document.querySelector('.profile-screen') || document.body;
  let dock = document.querySelector('.profile-dock,.dock');
  if (!dock) {
    dock = document.createElement('nav');
    dock.className = 'profile-dock dock';
    dock.setAttribute('aria-label', 'Rich Bizness navigation');
    main.appendChild(dock);
  }
  dock.classList.add('dock');
  dock.innerHTML = routes.map(([href, label]) => `<a href="${href}"${href === '/profile.html' ? ' class="active"' : ''}><span>${label}</span></a>`).join('');
}

async function getMeta(userId) {
  const { data, error } = await supabase.from('meta_avatars').select('aura,level,xp,metadata').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data || null;
}
function safeSet(el, text) { if (el) el.textContent = text; }
function render(profile, meta) {
  calmProfileArtifacts();
  const cfg = meta?.metadata || {};
  const lvl = Number(profile.rich_level || meta?.level || 1);
  const points = Number(profile.rich_points || meta?.xp || 0);
  safeSet(displayName, (profile.display_name || 'Rich Bizness User').toUpperCase());
  safeSet(username, '@' + (profile.username || 'rich_user'));
  safeSet(bio, profile.bio || 'Building a Rich Bizness lane across the universe.');
  safeSet(rank, profile.rank_title || 'BIZ LEGEND');
  safeSet(level, lvl);
  safeSet(xp, fmt(points));
  safeSet(xpMode, 'REALTIME');
  if (xpFill) xpFill.style.width = Math.max(0, Math.min(100, ((points - ((lvl - 1) * 1000)) / 1000) * 100)) + '%';
  if (!avatarFace) return;
  avatarFace.classList.add('live-avatar');
  avatarFace.dataset.aura = meta?.aura || cfg.aura || 'Emerald Gold';
  avatarFace.dataset.motion = cfg.motion || 'Boss Idle';
  avatarFace.title = `${meta?.aura || cfg.aura || 'Emerald Gold'} • ${cfg.gender || 'avatar'} • ${cfg.outfit || 'Rich Default'} • ${cfg.motion || 'Boss Idle'}`;
  if (profile.avatar_url) { avatarFace.textContent = ''; avatarFace.style.backgroundImage = 'url(' + profile.avatar_url + ')'; }
  else { avatarFace.textContent = 'RB'; avatarFace.style.backgroundImage = ''; }
}
async function paint(user) {
  wireRoutes();
  const profile = await ensureProfile(user);
  const meta = await getMeta(user.id);
  render(profile, meta);
  try { await loadXp(user.id); } catch (_) {}
  say('Profile connected.');
}
async function boot() {
  try {
    wireRoutes();
    const user = await getSessionUser();
    if (!user) { location.href = '/auth.html?next=' + encodeURIComponent('/profile.html'); return; }
    try { await bootXp(); } catch (_) {}
    await paint(user);
    supabase.channel('profile-identity-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + user.id }, () => paint(user)).on('postgres_changes', { event: '*', schema: 'public', table: 'meta_avatars', filter: 'user_id=eq.' + user.id }, () => paint(user)).on('postgres_changes', { event: '*', schema: 'public', table: 'user_levels', filter: 'user_id=eq.' + user.id }, () => paint(user)).subscribe();
  } catch (error) { console.warn(error); say(error.message || String(error)); }
}
editAvatar?.addEventListener('click', () => { location.href = '/avatar.html'; });
boot();
