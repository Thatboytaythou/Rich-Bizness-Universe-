import { supabase } from './supabase-client.js';
import { ensureMetaAvatar, ensureProfile, getSessionUser, signOutAndGoHome } from './rb-identity.js';

const form = document.getElementById('avatarForm');
const status = document.getElementById('status');
const body = document.getElementById('avatarBody');
const displayName = document.getElementById('displayName');
const aura = document.getElementById('aura');
const outfit = document.getElementById('outfit');
const motion = document.getElementById('motion');
const outBtn = document.getElementById('outBtn');

let user = null;
let profile = null;

const say = (text) => { status.textContent = text; };

function initials(name = 'RB') {
  const clean = String(name).trim();
  if (!clean) return 'RB';
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join('').toUpperCase() || 'RB';
}

function avatarSvg(name, config) {
  const label = initials(name);
  const auraName = config.aura || 'Emerald Gold';
  const colors = {
    'Emerald Gold': ['#63ff5d', '#f7c948', '#061408'],
    'Galaxy Smoke': ['#54e7ff', '#b25cff', '#050812'],
    'Royal Flame': ['#ff9d2e', '#f7c948', '#160804'],
  }[auraName] || ['#63ff5d', '#f7c948', '#061408'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="${colors[1]}"/><stop offset=".38" stop-color="${colors[0]}" stop-opacity=".55"/><stop offset="1" stop-color="${colors[2]}"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="512" height="512" rx="108" fill="#020402"/><circle cx="256" cy="256" r="214" fill="url(#g)" opacity=".95"/><circle cx="256" cy="256" r="178" fill="#020805" stroke="${colors[0]}" stroke-width="12"/><ellipse cx="256" cy="176" rx="62" ry="66" fill="#5a2c12" stroke="${colors[1]}" stroke-width="8"/><path d="M154 365c10-99 45-144 102-144s92 45 102 144c4 43-20 65-102 65s-106-22-102-65z" fill="#031109" stroke="${colors[0]}" stroke-width="6"/><path d="M127 268c-27 14-37 84-20 116 8 16 37 15 43-3 6-18-6-72 17-93zM385 268c27 14 37 84 20 116-8 16-37 15-43-3-6-18 6-72-17-93z" fill="#031109" stroke="${colors[0]}" stroke-width="5"/><text x="256" y="340" text-anchor="middle" fill="${colors[1]}" font-family="Impact,Arial Black,sans-serif" font-size="64" filter="url(#glow)">${label}</text><text x="256" y="100" text-anchor="middle" fill="${colors[1]}" font-family="Arial Black,sans-serif" font-size="28">♛</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paint() {
  const config = { aura: aura.value, outfit: outfit.value, motion: motion.value };
  body.dataset.aura = config.aura;
  body.dataset.outfit = config.outfit;
  body.dataset.motion = config.motion;
  body.style.backgroundImage = `url("${avatarSvg(displayName.value || profile?.display_name || 'RB', config)}")`;
  body.style.backgroundSize = 'cover';
  body.style.backgroundPosition = 'center';
  body.textContent = '';
  document.documentElement.dataset.aura = config.aura.toLowerCase().replace(/\s+/g, '-');
}

async function boot() {
  user = await getSessionUser();
  if (!user) {
    location.href = '/auth.html';
    return;
  }
  profile = await ensureProfile(user);
  displayName.value = profile.display_name || '';
  const { data: meta } = await supabase.from('meta_avatars').select('aura,avatar_config').eq('user_id', user.id).maybeSingle();
  if (meta?.aura) aura.value = meta.aura;
  if (meta?.avatar_config?.outfit) outfit.value = meta.avatar_config.outfit;
  if (meta?.avatar_config?.motion) motion.value = meta.avatar_config.motion;
  say('Creator mode synced. Change aura, outfit, motion, then save.');
  paint();
}

async function saveAvatar(event) {
  event.preventDefault();
  say('Saving avatar...');
  const name = displayName.value.trim() || profile.display_name || 'Rich Bizness Elite';
  const config = { aura: aura.value, outfit: outfit.value, motion: motion.value };
  const avatar_url = avatarSvg(name, config);
  const { error } = await supabase.from('profiles').update({ display_name: name, avatar_url, online_status: 'online' }).eq('id', user.id);
  await ensureMetaAvatar(user, { ...profile, display_name: name, avatar_url }, config);
  if (error) {
    say(error.message);
    return;
  }
  say('Avatar saved. Entering profile...');
  setTimeout(() => { location.href = '/profile.html'; }, 650);
}

[displayName, aura, outfit, motion].forEach((el) => el.addEventListener('input', paint));
[aura, outfit, motion].forEach((el) => el.addEventListener('change', paint));
form.addEventListener('submit', saveAvatar);
outBtn.addEventListener('click', signOutAndGoHome);
boot();
