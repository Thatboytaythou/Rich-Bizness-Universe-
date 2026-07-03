import { supabase } from './supabase-client.js';
import { ensureMetaAvatar, ensureProfile, getSessionUser } from './rb-identity.js';

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
let avatarImg = null;
const extra = {};
const state = { gender: 'boy', skin: 'brown', hair: 'shortFade', hairColor: 'black', shoes: 'Glow Sneakers', chain: 'RB Crown Chain', glasses: 'None', smoke: 'cinematic' };

const say = (text) => { status.textContent = text; };

function installPreviewCleanup() {
  if (document.getElementById('avatarLayerCleanup')) return;
  const style = document.createElement('style');
  style.id = 'avatarLayerCleanup';
  style.textContent = `.avatar-body{background:transparent!important;background-image:none!important;background-color:transparent!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important;filter:drop-shadow(0 0 32px rgba(99,255,93,.55))!important}.avatar-body:before,.avatar-body:after{display:none!important;content:none!important}.avatar-preview-img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;pointer-events:none;user-select:none}@media(max-width:760px){.avatar-body{width:255px!important;height:320px!important}}`;
  document.head.appendChild(style);
}

function ensurePreviewImage() {
  if (avatarImg) return avatarImg;
  body.textContent = '';
  body.style.backgroundImage = 'none';
  avatarImg = document.createElement('img');
  avatarImg.className = 'avatar-preview-img';
  avatarImg.alt = 'Rich Bizness full body avatar';
  body.appendChild(avatarImg);
  return avatarImg;
}

function addCreatorControls() {
  if (document.getElementById('avatarExtras')) return;
  const wrap = document.createElement('div');
  wrap.id = 'avatarExtras';
  wrap.className = 'creator-extra';
  wrap.innerHTML = `<div class="gender-pick"><button type="button" data-gender="boy" class="active">BOY</button><button type="button" data-gender="girl">GIRL</button></div><label>Skin<select id="skin"><option value="brown">Brown</option><option value="deep">Deep</option><option value="gold">Gold Glow</option><option value="light">Light</option></select></label><label>Hair<select id="hair"><option value="shortFade">Short Fade</option><option value="waves">Waves</option><option value="braids">Braids</option><option value="longFlow">Long Flow</option><option value="afro">Afro</option></select></label><label>Hair Color<select id="hairColor"><option value="black">Black</option><option value="gold">Gold Tips</option><option value="green">Neon Green</option><option value="purple">Galaxy Purple</option></select></label><label>Shoes<select id="shoes"><option>Glow Sneakers</option><option>Gold Runners</option><option>Smoke Boots</option><option>Portal Forces</option></select></label><label>Chain<select id="chain"><option>RB Crown Chain</option><option>Gold Rope</option><option>Diamond Smoke</option><option>None</option></select></label><label>Glasses<select id="glasses"><option>None</option><option>Black Shades</option><option>Gold Frames</option><option>Neon Visor</option></select></label><label>Smoke<select id="smoke"><option value="cinematic">Cinematic</option><option value="heavy">Heavy Smoke</option><option value="light">Light Mist</option><option value="none">None</option></select></label>`;
  outfit.parentElement.after(wrap);
  ['skin', 'hair', 'hairColor', 'shoes', 'chain', 'glasses', 'smoke'].forEach((id) => { extra[id] = document.getElementById(id); });
  wrap.querySelectorAll('[data-gender]').forEach((button) => {
    button.addEventListener('click', () => {
      state.gender = button.dataset.gender;
      wrap.querySelectorAll('[data-gender]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      paint();
    });
  });
  Object.entries(extra).forEach(([key, el]) => el.addEventListener('change', () => { state[key] = el.value; paint(); }));
}

function config() { Object.entries(extra).forEach(([key, el]) => { state[key] = el.value; }); return { ...state, aura: aura.value, outfit: outfit.value, motion: motion.value }; }
function initials(name = 'RB') { const clean = String(name).trim(); if (!clean) return 'RB'; return clean.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'RB'; }

function avatarSvg(name, cfg) {
  const label = initials(name);
  const colors = { 'Emerald Gold': ['#63ff5d', '#f7c948', '#061408'], 'Galaxy Smoke': ['#54e7ff', '#b25cff', '#050812'], 'Royal Flame': ['#ff9d2e', '#f7c948', '#160804'] }[cfg.aura] || ['#63ff5d', '#f7c948', '#061408'];
  const skin = { brown: '#7a3d18', deep: '#3b190b', gold: '#9a632c', light: '#bf7a42' }[cfg.skin] || '#7a3d18';
  const hair = { black: '#080604', gold: '#d6a72f', green: '#22ff63', purple: '#8f46ff' }[cfg.hairColor] || '#080604';
  const torso = cfg.gender === 'girl' ? 'M184 318c12-64 36-91 72-91s60 27 72 91l38 119H146z' : 'M164 318c12-70 45-96 92-96s80 26 92 96v105c0 31-26 49-92 49s-92-18-92-49z';
  const hairPath = cfg.hair === 'longFlow' ? `<path d="M188 143c14-60 120-63 136 0 16 63-2 111-31 148 7-64-1-104-37-104s-44 40-37 104c-29-37-47-85-31-148z" fill="${hair}"/>` : cfg.hair === 'braids' ? `<path d="M185 172c-20 49-18 100-4 143M327 172c20 49 18 100 4 143" stroke="${hair}" stroke-width="18" stroke-linecap="round"/>` : cfg.hair === 'afro' ? `<circle cx="256" cy="146" r="82" fill="${hair}"/>` : `<path d="M196 147c24-48 99-52 120-4-32-15-76-16-120 4z" fill="${hair}"/>`;
  const glasses = cfg.glasses === 'None' ? '' : `<rect x="199" y="160" width="45" height="28" rx="9" fill="#020402" stroke="${colors[0]}" stroke-width="5"/><rect x="268" y="160" width="45" height="28" rx="9" fill="#020402" stroke="${colors[0]}" stroke-width="5"/><path d="M244 174h24" stroke="${colors[1]}" stroke-width="6"/>`;
  const chain = cfg.chain === 'None' ? '' : `<path d="M215 269c21 18 61 18 82 0" fill="none" stroke="${colors[1]}" stroke-width="8" stroke-linecap="round"/><circle cx="256" cy="293" r="19" fill="#020402" stroke="${colors[1]}" stroke-width="5"/><text x="256" y="301" text-anchor="middle" fill="${colors[1]}" font-family="Arial Black" font-size="15">RB</text>`;
  const smoke = cfg.smoke === 'none' ? '' : `<path d="M96 112c53 26 81-22 135 0 58 24 91-25 185 11" fill="none" stroke="${colors[0]}" stroke-width="6" opacity=".2"/><path d="M103 493c55-41 99 23 151-12s86 19 155-21" fill="none" stroke="${colors[0]}" stroke-width="7" opacity=".22"/>`;
  const shoeColor = cfg.shoes.includes('Gold') ? colors[1] : cfg.shoes.includes('Smoke') ? '#9aa0a6' : colors[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640"><defs><radialGradient id="a" cx="50%" cy="42%" r="66%"><stop offset="0" stop-color="${colors[0]}" stop-opacity=".42"/><stop offset="1" stop-color="#020402" stop-opacity="0"/></radialGradient><filter id="g"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="256" cy="318" r="230" fill="url(#a)" opacity=".72"/>${smoke}<ellipse cx="256" cy="548" rx="132" ry="26" fill="${colors[0]}" opacity=".16"/>${hairPath}<ellipse cx="256" cy="177" rx="57" ry="64" fill="${skin}" stroke="${colors[1]}" stroke-width="7"/>${glasses}<path d="M111 309c-30 20-38 94-17 130 11 19 45 17 54-6 7-20-10-80 24-105zM401 309c30 20 38 94 17 130-11 19-45 17-54-6-7-20 10-80-24-105z" fill="#031109" stroke="${colors[0]}" stroke-width="7"/><path d="${torso}" fill="#031109" stroke="${colors[0]}" stroke-width="7"/>${chain}<path d="M191 438h46v108h-46zM275 438h46v108h-46z" fill="#031109" stroke="${colors[0]}" stroke-width="6"/><path d="M165 552h86M261 552h86" stroke="${shoeColor}" stroke-width="16" stroke-linecap="round"/><text x="256" y="373" text-anchor="middle" fill="${colors[1]}" font-family="Impact,Arial Black,sans-serif" font-size="58" filter="url(#g)">${label}</text><text x="256" y="88" text-anchor="middle" fill="${colors[1]}" font-family="Arial Black,sans-serif" font-size="31">♛</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paint() { const cfg = config(); body.dataset.aura = cfg.aura; body.dataset.outfit = cfg.outfit; body.dataset.motion = cfg.motion; body.dataset.gender = cfg.gender; const img = ensurePreviewImage(); img.src = avatarSvg(displayName.value || profile?.display_name || 'RB', cfg); body.style.backgroundImage = 'none'; body.style.backgroundColor = 'transparent'; body.style.boxShadow = 'none'; body.style.borderRadius = '0'; body.style.overflow = 'visible'; document.documentElement.dataset.aura = cfg.aura.toLowerCase().replace(/\s+/g, '-'); }

async function boot() {
  installPreviewCleanup(); addCreatorControls(); user = await getSessionUser();
  if (!user) { location.href = '/auth.html'; return; }
  profile = await ensureProfile(user); displayName.value = profile.display_name || '';
  const { data: meta } = await supabase.from('meta_avatars').select('aura,metadata').eq('user_id', user.id).maybeSingle();
  if (meta?.aura) aura.value = meta.aura; const saved = meta?.metadata || {}; Object.assign(state, saved);
  if (saved.outfit) outfit.value = saved.outfit; if (saved.motion) motion.value = saved.motion; if (saved.aura) aura.value = saved.aura;
  Object.entries(extra).forEach(([key, el]) => { if (saved[key]) el.value = saved[key]; });
  document.querySelectorAll('[data-gender]').forEach((button) => button.classList.toggle('active', button.dataset.gender === state.gender));
  say('Full body creator synced. Build the avatar, then save.'); paint();
}

async function saveAvatar(event) {
  event.preventDefault(); say('Saving full body avatar...');
  try {
    const name = displayName.value.trim() || profile.display_name || 'Rich Bizness Elite'; const cfg = config(); const avatar_url = avatarSvg(name, cfg);
    const update = { display_name: name, avatar_url, online_status: 'online', onboarding_state: 'complete', has_avatar: true, has_profile_identity: true, last_route: '/' };
    const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
    if (error) throw error;
    await ensureMetaAvatar(user, { ...profile, ...update }, cfg);
    say('Avatar saved. Entering universe...'); setTimeout(() => { location.href = '/'; }, 650);
  } catch (error) { say(error.message || String(error)); }
}

[displayName, aura, outfit, motion].forEach((el) => el.addEventListener('input', paint));
[aura, outfit, motion].forEach((el) => el.addEventListener('change', paint));
form.addEventListener('submit', saveAvatar);
outBtn?.addEventListener('click', () => { location.href = '/settings.html'; });
boot();
