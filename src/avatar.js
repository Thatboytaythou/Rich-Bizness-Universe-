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
const extra = {};
const state = { gender: 'boy', skin: 'brown', hair: 'shortFade', hairColor: 'black', shoes: 'Glow Sneakers', chain: 'RB Crown Chain', glasses: 'None', smoke: 'cinematic' };

const say = (text) => { status.textContent = text; };

function addCreatorControls() {
  if (document.getElementById('avatarExtras')) return;
  const wrap = document.createElement('div');
  wrap.id = 'avatarExtras';
  wrap.className = 'creator-extra';
  wrap.innerHTML = `
    <div class="gender-pick"><button type="button" data-gender="boy" class="active">BOY</button><button type="button" data-gender="girl">GIRL</button></div>
    <label>Skin<select id="skin"><option value="brown">Brown</option><option value="deep">Deep</option><option value="gold">Gold Glow</option><option value="light">Light</option></select></label>
    <label>Hair<select id="hair"><option value="shortFade">Short Fade</option><option value="waves">Waves</option><option value="braids">Braids</option><option value="longFlow">Long Flow</option><option value="afro">Afro</option></select></label>
    <label>Hair Color<select id="hairColor"><option value="black">Black</option><option value="gold">Gold Tips</option><option value="green">Neon Green</option><option value="purple">Galaxy Purple</option></select></label>
    <label>Shoes<select id="shoes"><option>Glow Sneakers</option><option>Gold Runners</option><option>Smoke Boots</option><option>Portal Forces</option></select></label>
    <label>Chain<select id="chain"><option>RB Crown Chain</option><option>Gold Rope</option><option>Diamond Smoke</option><option>None</option></select></label>
    <label>Glasses<select id="glasses"><option>None</option><option>Black Shades</option><option>Gold Frames</option><option>Neon Visor</option></select></label>
    <label>Smoke<select id="smoke"><option value="cinematic">Cinematic</option><option value="heavy">Heavy Smoke</option><option value="light">Light Mist</option><option value="none">None</option></select></label>`;
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

function config() {
  Object.entries(extra).forEach(([key, el]) => { state[key] = el.value; });
  return { ...state, aura: aura.value, outfit: outfit.value, motion: motion.value };
}

function initials(name = 'RB') {
  const clean = String(name).trim();
  if (!clean) return 'RB';
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join('').toUpperCase() || 'RB';
}

function avatarSvg(name, cfg) {
  const label = initials(name);
  const colors = {
    'Emerald Gold': ['#63ff5d', '#f7c948', '#061408'],
    'Galaxy Smoke': ['#54e7ff', '#b25cff', '#050812'],
    'Royal Flame': ['#ff9d2e', '#f7c948', '#160804'],
  }[cfg.aura] || ['#63ff5d', '#f7c948', '#061408'];
  const skin = { brown: '#7a3d18', deep: '#3b190b', gold: '#9a632c', light: '#bf7a42' }[cfg.skin] || '#7a3d18';
  const hair = { black: '#080604', gold: '#d6a72f', green: '#22ff63', purple: '#8f46ff' }[cfg.hairColor] || '#080604';
  const waist = cfg.gender === 'girl' ? 'M176 344c18-94 54-125 80-125s62 31 80 125l32 88H144z' : 'M160 345c13-95 47-126 96-126s83 31 96 126c6 54-19 83-96 83s-102-29-96-83z';
  const hairPath = cfg.hair === 'longFlow' ? `<path d="M190 151c12-52 120-56 135 0 20 74-9 117-34 135 7-60 0-105-35-105s-42 45-35 105c-26-18-51-62-31-135z" fill="${hair}" opacity=".9"/>` : cfg.hair === 'braids' ? `<path d="M176 176c-20 46-16 95-2 136M336 176c20 46 16 95 2 136" stroke="${hair}" stroke-width="18" stroke-linecap="round"/>` : cfg.hair === 'afro' ? `<circle cx="256" cy="151" r="82" fill="${hair}" opacity=".9"/>` : `<path d="M194 151c20-48 100-56 126-8-18-18-83-19-126 8z" fill="${hair}"/>`;
  const glasses = cfg.glasses === 'None' ? '' : `<path d="M213 178h36M263 178h36" stroke="${colors[1]}" stroke-width="8" stroke-linecap="round"/><rect x="198" y="162" width="46" height="30" rx="10" fill="#020402" stroke="${colors[0]}" stroke-width="5"/><rect x="268" y="162" width="46" height="30" rx="10" fill="#020402" stroke="${colors[0]}" stroke-width="5"/>`;
  const chain = cfg.chain === 'None' ? '' : `<path d="M213 270c21 20 65 20 86 0" fill="none" stroke="${colors[1]}" stroke-width="8" stroke-linecap="round"/><text x="256" y="299" text-anchor="middle" fill="${colors[1]}" font-family="Arial Black" font-size="22">RB</text>`;
  const smoke = cfg.smoke === 'none' ? '' : `<path d="M120 418c45-42 93 26 139-14s75 14 132-25" fill="none" stroke="${colors[0]}" stroke-width="7" opacity=".28"/><path d="M108 96c46 22 78-20 126 0 59 25 84-24 151 4" fill="none" stroke="${colors[0]}" stroke-width="6" opacity=".22"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640"><defs><radialGradient id="g" cx="50%" cy="32%" r="75%"><stop offset="0" stop-color="${colors[1]}"/><stop offset=".36" stop-color="${colors[0]}" stop-opacity=".58"/><stop offset="1" stop-color="${colors[2]}"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="512" height="640" rx="108" fill="#020402"/><circle cx="256" cy="278" r="226" fill="url(#g)" opacity=".92"/>${smoke}<circle cx="256" cy="264" r="190" fill="#020805" stroke="${colors[0]}" stroke-width="12" opacity=".88"/>${hairPath}<ellipse cx="256" cy="177" rx="58" ry="64" fill="${skin}" stroke="${colors[1]}" stroke-width="7"/>${glasses}<path d="M104 318c-24 15-31 91-12 127 10 18 42 15 49-6 7-22-11-84 22-108zM408 318c24 15 31 91 12 127-10 18-42 15-49-6-7-22 11-84-22-108z" fill="#031109" stroke="${colors[0]}" stroke-width="6"/> <path d="${waist}" fill="#031109" stroke="${colors[0]}" stroke-width="7"/>${chain}<path d="M185 424h48v126h-48zM279 424h48v126h-48z" fill="#031109" stroke="${colors[0]}" stroke-width="6"/><path d="M164 552h84M264 552h84" stroke="${colors[1]}" stroke-width="16" stroke-linecap="round"/><text x="256" y="366" text-anchor="middle" fill="${colors[1]}" font-family="Impact,Arial Black,sans-serif" font-size="54" filter="url(#glow)">${label}</text><text x="256" y="86" text-anchor="middle" fill="${colors[1]}" font-family="Arial Black,sans-serif" font-size="30">♛</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paint() {
  const cfg = config();
  body.dataset.aura = cfg.aura;
  body.dataset.outfit = cfg.outfit;
  body.dataset.motion = cfg.motion;
  body.dataset.gender = cfg.gender;
  body.style.backgroundImage = `url("${avatarSvg(displayName.value || profile?.display_name || 'RB', cfg)}")`;
  body.style.backgroundSize = 'contain';
  body.style.backgroundRepeat = 'no-repeat';
  body.style.backgroundPosition = 'center';
  body.textContent = '';
  document.documentElement.dataset.aura = cfg.aura.toLowerCase().replace(/\s+/g, '-');
}

async function boot() {
  addCreatorControls();
  user = await getSessionUser();
  if (!user) { location.href = '/auth.html'; return; }
  profile = await ensureProfile(user);
  displayName.value = profile.display_name || '';
  const { data: meta } = await supabase.from('meta_avatars').select('aura,metadata').eq('user_id', user.id).maybeSingle();
  if (meta?.aura) aura.value = meta.aura;
  const saved = meta?.metadata || {};
  Object.assign(state, saved);
  if (saved.outfit) outfit.value = saved.outfit;
  if (saved.motion) motion.value = saved.motion;
  if (saved.aura) aura.value = saved.aura;
  Object.entries(extra).forEach(([key, el]) => { if (saved[key]) el.value = saved[key]; });
  document.querySelectorAll('[data-gender]').forEach((button) => button.classList.toggle('active', button.dataset.gender === state.gender));
  say('Full body creator synced. Build the avatar, then save.');
  paint();
}

async function saveAvatar(event) {
  event.preventDefault();
  say('Saving full body avatar...');
  const name = displayName.value.trim() || profile.display_name || 'Rich Bizness Elite';
  const cfg = config();
  const avatar_url = avatarSvg(name, cfg);
  const { error } = await supabase.from('profiles').update({ display_name: name, avatar_url, online_status: 'online' }).eq('id', user.id);
  await ensureMetaAvatar(user, { ...profile, display_name: name, avatar_url }, cfg);
  if (error) return say(error.message);
  say('Avatar saved. Entering profile...');
  setTimeout(() => { location.href = '/profile.html'; }, 650);
}

[displayName, aura, outfit, motion].forEach((el) => el.addEventListener('input', paint));
[aura, outfit, motion].forEach((el) => el.addEventListener('change', paint));
form.addEventListener('submit', saveAvatar);
outBtn.addEventListener('click', signOutAndGoHome);
boot();
