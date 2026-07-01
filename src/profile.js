import { supabase } from './supabase-client.js';
import { ensureProfile, getSessionUser, signOutAndGoHome } from './rb-identity.js';

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

function render(profile) {
  const lvl = Number(profile.rich_level || 1);
  const points = Number(profile.rich_points || 0);
  displayName.textContent = (profile.display_name || 'Rich Bizness Elite').toUpperCase();
  username.textContent = '@' + (profile.username || 'rich_user');
  bio.textContent = profile.bio || 'Building in the Rich Bizness Universe.';
  rank.textContent = profile.rank_title || 'Rookie Builder';
  level.textContent = lvl;
  xp.textContent = fmt(points);
  cash.textContent = money(profile.balance_cents);
  xpFill.style.width = Math.max(0, Math.min(100, ((points - ((lvl - 1) * 1000)) / 1000) * 100)) + '%';
  if (profile.avatar_url) {
    avatarFace.textContent = '';
    avatarFace.style.backgroundImage = 'url(' + profile.avatar_url + ')';
  }
}

async function boot() {
  const user = await getSessionUser();
  if (!user) {
    location.href = '/auth.html';
    return;
  }
  const profile = await ensureProfile(user);
  render(profile);
  supabase.channel('profile-identity-' + user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + user.id }, async () => {
      const fresh = await ensureProfile(user);
      render(fresh);
    })
    .subscribe();
}

outBtn.addEventListener('click', signOutAndGoHome);
editAvatar.addEventListener('click', () => { location.href = '/avatar.html'; });
boot();
