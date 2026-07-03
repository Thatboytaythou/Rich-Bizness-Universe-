import { supabase } from './supabase-client.js';
import { ensureProfile, getSessionUser, signOutAndGoHome } from './rb-identity.js';
import { bootXp, loadXp } from './rb-xp.js';

const displayName = document.getElementById('displayName');
const username = document.getElementById('username');
const bio = document.getElementById('bio');
const avatarFace = document.getElementById('avatarFace');
const rank = document.getElementById('rank');
const level = document.getElementById('level');
const xp = document.getElementById('xp');
const cash = document.getElementById('cash');
const xpFill = document.getElementById('xpFill');
const outBtn = document.getElementById('outBtn');
const editAvatar = document.getElementById('editAvatar');

const fmt = (n) => Number(n || 0).toLocaleString();
const money = (cents) => '$' + (Number(cents || 0) / 100).toFixed(2);

async function getMeta(userId) {
  const { data } = await supabase.from('meta_avatars').select('aura,level,xp,metadata').eq('user_id', userId).maybeSingle();
  return data || null;
}

function render(profile, meta) {
  const cfg = meta?.metadata || {};
  const lvl = Number(profile.rich_level || meta?.level || 1);
  const points = Number(profile.rich_points || meta?.xp || 0);
  displayName.textContent = (profile.display_name || 'Rich Bizness Elite').toUpperCase();
  username.textContent = '@' + (profile.username || 'rich_user');
  bio.textContent = profile.bio || 'Building in the Rich Bizness Universe.';
  rank.textContent = profile.rank_title || 'Rookie Builder';
  level.textContent = lvl;
  xp.textContent = fmt(points);
  cash.textContent = money(profile.balance_cents);
  xpFill.style.width = Math.max(0, Math.min(100, ((points - ((lvl - 1) * 1000)) / 1000) * 100)) + '%';
  avatarFace.classList.add('live-avatar');
  avatarFace.dataset.aura = meta?.aura || cfg.aura || 'Emerald Gold';
  avatarFace.dataset.motion = cfg.motion || 'Boss Idle';
  avatarFace.title = `${meta?.aura || cfg.aura || 'Emerald Gold'} • ${cfg.gender || 'boy'} • ${cfg.outfit || 'Rich Default'} • ${cfg.motion || 'Boss Idle'}`;
  if (profile.avatar_url) {
    avatarFace.textContent = '';
    avatarFace.style.backgroundImage = 'url(' + profile.avatar_url + ')';
  } else {
    avatarFace.textContent = 'RB';
    avatarFace.style.backgroundImage = '';
  }
}

async function paint(user) {
  const profile = await ensureProfile(user);
  const meta = await getMeta(user.id);
  render(profile, meta);
  await loadXp(user.id);
}

async function boot() {
  const user = await getSessionUser();
  if (!user) {
    location.href = '/auth.html';
    return;
  }
  await bootXp();
  await paint(user);
  supabase.channel('profile-identity-' + user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + user.id }, () => paint(user))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_avatars', filter: 'user_id=eq.' + user.id }, () => paint(user))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_levels', filter: 'user_id=eq.' + user.id }, () => paint(user))
    .subscribe();
}

outBtn.addEventListener('click', signOutAndGoHome);
editAvatar.addEventListener('click', () => { location.href = '/avatar.html'; });
boot();