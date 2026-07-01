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

function paint() {
  body.dataset.aura = aura.value;
  body.dataset.outfit = outfit.value;
  body.dataset.motion = motion.value;
  body.style.filter = aura.value.includes('Gold') ? 'drop-shadow(0 0 24px rgba(247,201,72,.45))' : 'drop-shadow(0 0 24px rgba(99,255,93,.45))';
}

async function boot() {
  user = await getSessionUser();
  if (!user) {
    location.href = '/auth.html';
    return;
  }
  profile = await ensureProfile(user);
  displayName.value = profile.display_name || '';
  say('Creator mode synced.');
  paint();
}

async function saveAvatar(event) {
  event.preventDefault();
  say('Saving avatar...');
  const name = displayName.value.trim() || profile.display_name || 'Rich Bizness Elite';
  await supabase.from('profiles').update({ display_name: name, online_status: 'online' }).eq('id', user.id);
  await ensureMetaAvatar(user, { ...profile, display_name: name }, { aura: aura.value, outfit: outfit.value, motion: motion.value });
  say('Avatar saved. Entering profile...');
  setTimeout(() => { location.href = '/profile.html'; }, 650);
}

[aura, outfit, motion].forEach((el) => el.addEventListener('change', paint));
form.addEventListener('submit', saveAvatar);
outBtn.addEventListener('click', signOutAndGoHome);
boot();
