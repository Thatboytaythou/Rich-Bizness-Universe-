import { supabase } from './supabase-client.js';
import { ensureProfile, getMetaAvatar, getSessionUser } from './rb-identity.js?v=identity-owner-2';

const status = document.getElementById('characterStatus');
const preview = document.getElementById('characterPreview');
const grid = document.getElementById('savedRoster');
const stage = document.getElementById('rosterStage');
const openCount = document.getElementById('openCount');
const unlockCount = document.getElementById('unlockCount');
const unlockList = document.getElementById('unlockList');

let user = null;
let profile = null;
let meta = null;
let rows = [];
let saveFlight = null;

const starter = [
  { id:'boss', name:'Boss Walk', icon:'♛', config:{gender:'boy',outfit:'Black Gold Boss',motion:'Boss Walk',aura:'Emerald Gold',skin:'brown',hair:'shortFade',hairColor:'black',quality:'4D-HD'} },
  { id:'girlboss', name:'Girl Boss', icon:'💎', config:{gender:'girl',outfit:'Diamond Fur',motion:'Boss Walk',aura:'Diamond Mist',skin:'brown',hair:'longFlow',hairColor:'gold',quality:'4D-HD'} },
  { id:'meta', name:'Meta Runner', icon:'◎', config:{gender:'girl',outfit:'Meta Armor',motion:'Power Up',aura:'Neon Phantom',skin:'gold',hair:'ponytail',hairColor:'green',quality:'4D-HD'} }
];

const unlocks = [
  {name:'Vault Phantom', need:5000, lane:'RB Vault', icon:'◆'},
  {name:'Live Legend', need:2500, lane:'WE LIT', icon:'◉'},
  {name:'Game Boss', need:1800, lane:'Gaming', icon:'🎮'},
  {name:'Store Mogul', need:2200, lane:'Store', icon:'$'},
  {name:'Sports Captain', need:1400, lane:'Sports', icon:'🏆'},
  {name:'Music Star', need:1200, lane:'Music', icon:'♪'},
  {name:'Meta King', need:3500, lane:'Meta', icon:'◎'},
  {name:'Shadow NPC', need:800, lane:'NPC Mode', icon:'☯'}
];

const say = (text) => { if (status) status.textContent = text; };
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const xp = () => Number(profile?.rich_points || meta?.xp || 0);
const safeId = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
const safeImage = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';
  if (input.startsWith('data:image/svg+xml')) return input;
  try {
    const url = new URL(input, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

function palette(a){ return {'Emerald Gold':['#63ff5d','#f7c948','#061408'],'Diamond Mist':['#d8ffe5','#9dff63','#071007'],'Neon Phantom':['#9dff63','#54e7ff','#03030a']}[a] || ['#63ff5d','#f7c948','#061408']; }
function skin(c){ return {brown:'#7a3d18',deep:'#321207',gold:'#9a632c',light:'#bf7a42'}[c.skin] || '#7a3d18'; }
function hair(c){ return {black:'#090604',gold:'#d6a72f',green:'#22ff63',purple:'#8f46ff'}[c.hairColor] || '#090604'; }
function quickAvatar(c){ const p=palette(c.aura), s=skin(c), h=hair(c), label=(c.gender==='girl'?'G':'RB'); const torso=c.outfit==='Meta Armor'?'#07142d':c.outfit==='Diamond Fur'?'#f4fff2':'#030504'; const accent=c.outfit==='Diamond Fur'?'#9dff63':p[1]; const hairPath=c.hair==='longFlow'?`<path d="M116 80c18-48 104-50 122 0 22 63-2 107-24 136 6-52-8-84-37-84s-43 32-37 84c-22-29-46-73-24-136z" fill="${h}"/>`:c.hair==='ponytail'?`<path d="M118 84c34-42 89-42 119 0" fill="${h}"/><path d="M232 104c41 11 46 63 8 96" fill="none" stroke="${h}" stroke-width="18" stroke-linecap="round"/>`:`<path d="M116 86c24-42 92-45 118-3-35-13-77-12-118 3z" fill="${h}"/>`; return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500"><defs><radialGradient id="a"><stop stop-color="${p[0]}" stop-opacity=".5"/><stop offset="1" stop-color="#020402" stop-opacity="0"/></radialGradient></defs><circle cx="180" cy="248" r="180" fill="url(#a)"/>${hairPath}<ellipse cx="180" cy="118" rx="46" ry="52" fill="${s}" stroke="${accent}" stroke-width="6"/><rect x="162" y="166" width="36" height="42" fill="${s}" stroke="${accent}" stroke-width="5"/><path d="M98 214c16-54 148-54 164 0l-22 142c-14 28-106 28-120 0z" fill="${torso}" stroke="${p[0]}" stroke-width="7"/><path d="M86 232c-38 26-44 109-13 133 20 16 43 0 38-24-8-40 5-77 36-96zM274 232c38 26 44 109 13 133-20 16-43 0-38-24 8-40-5-77-36-96z" fill="${torso}" stroke="${p[0]}" stroke-width="6"/><path d="M136 352h35v96h-35zM189 352h35v96h-35z" fill="#030806" stroke="${p[0]}" stroke-width="6"/><path d="M112 456h76M172 456h76" stroke="${accent}" stroke-width="14" stroke-linecap="round"/><rect x="142" y="111" width="32" height="22" rx="7" fill="#020402" stroke="${p[0]}" stroke-width="5"/><rect x="190" y="111" width="32" height="22" rx="7" fill="#020402" stroke="${p[0]}" stroke-width="5"/><path d="M174 122h16" stroke="${accent}" stroke-width="5"/><path d="M151 202c17 16 41 16 58 0" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><circle cx="180" cy="227" r="18" fill="#020402" stroke="${accent}" stroke-width="5"/><text x="180" y="233" text-anchor="middle" font-family="Arial Black" fill="${accent}" font-size="13">${label}</text><text x="180" y="62" text-anchor="middle" fill="${accent}" font-size="34">♛</text></svg>`)}`; }

function hydrate(c){
  const item = c && typeof c === 'object' ? c : {};
  const config = item.config && typeof item.config === 'object' ? item.config : {};
  return {
    ...item,
    id: safeId(item.id) || `avatar-${crypto.randomUUID()}`,
    name: String(item.name || 'Rich Avatar').slice(0, 80),
    icon: String(item.icon || '♛').slice(0, 8),
    config,
    avatar_url: safeImage(item.avatar_url) || quickAvatar(config),
  };
}

function roster(){
  const saved = Array.isArray(meta?.metadata?.savedCharacters) ? meta.metadata.savedCharacters : [];
  return (saved.length ? saved : starter).slice(0, 36).map(hydrate);
}

function setStage(c){
  if (!stage) return;
  const image = safeImage(c?.avatar_url);
  stage.innerHTML = image
    ? `<img src="${esc(image)}" alt="${esc(c?.name || 'Avatar')}">`
    : `<div class="roster-stage-fallback">${esc(c?.icon || '♛')}</div>`;
  if (preview) preview.textContent = c?.config?.gender === 'girl' ? 'GIRL' : c?.config?.gender === 'npc' ? 'NPC' : 'BOY';
}

function card(c){
  const active = (meta?.metadata?.selectedCharacter || '').toLowerCase() === String(c.name || '').toLowerCase();
  const image = safeImage(c.avatar_url);
  const face = image ? `<img src="${esc(image)}" alt="">` : esc(c.icon || '♛');
  const motion = c.config?.motion || 'Motion Ready';
  const aura = c.config?.aura || 'Emerald Gold';
  const gender = c.config?.gender || 'boy';
  const id = safeId(c.id);
  return `<article class="character-card ${active?'active':''}" data-id="${esc(id)}"><div class="character-face">${face}</div><b>${esc(c.name)}</b><p>${esc(gender.toUpperCase())} • ${esc(motion)} • ${esc(aura)} • ${esc(c.quality || c.config?.quality || '4D-HD')}</p><div class="character-actions"><button class="primary" type="button" data-choose="${esc(id)}">ACTIVE</button><a href="/avatar.html?preset=${encodeURIComponent(id)}">EDIT</a><button type="button" data-clone="${esc(id)}">CLONE</button><button type="button" data-remove="${esc(id)}">REMOVE</button></div></article>`;
}

function renderUnlocks(){
  const total = xp();
  const open = unlocks.filter((u) => total >= u.need).length;
  if (unlockCount) unlockCount.textContent = open.toLocaleString();
  if (!unlockList) return;
  unlockList.innerHTML = unlocks.map((u) => `<article class="unlock-card ${total>=u.need?'open':'locked'}"><b>${esc(u.icon)} ${esc(u.name)}</b><small>${total>=u.need?'UNLOCKED':'LOCKED'} • ${esc(u.lane)} • ${total.toLocaleString()} / ${u.need.toLocaleString()} XP</small></article>`).join('');
}

function render(){
  rows = roster();
  if (openCount) openCount.textContent = rows.length.toLocaleString();
  if (grid) grid.innerHTML = rows.map(card).join('');
  const active = rows.find((c) => (meta?.metadata?.selectedCharacter || '').toLowerCase() === String(c.name || '').toLowerCase()) || rows[0];
  setStage(active);
  renderUnlocks();
  say(`${active?.name || 'Avatar'} ready. Set active to use it in Meta.`);
}

function select(id){ const c = rows.find((x) => x.id === id) || rows[0]; if (!c) return; setStage(c); say(`${c.name} selected. Active it, edit it, clone it, or launch Meta.`); }

async function saveRows(nextRows, activeName){
  if (saveFlight) return saveFlight;
  saveFlight = (async () => {
    const cleanRows = nextRows.slice(0, 36).map(hydrate);
    const metadata = { ...(meta?.metadata || {}), savedCharacters: cleanRows, selectedCharacter: activeName || meta?.metadata?.selectedCharacter || cleanRows[0]?.name || 'Boss Walk', updatedAt: new Date().toISOString() };
    const active = cleanRows.find((c) => c.name === metadata.selectedCharacter) || cleanRows[0];
    const payload = { user_id:user.id, display_name:profile.display_name, avatar_url:safeImage(active?.avatar_url) || safeImage(meta?.avatar_url), aura:active?.config?.aura || meta?.aura || 'Emerald Gold', rank:profile.rank_title || 'BIZ LEGEND', level:profile.rich_level || 1, xp:profile.rich_points || 0, position:meta?.position || {world:'portal-hub',x:0,y:0,z:0}, is_active:true, metadata };
    const { error } = await supabase.from('meta_avatars').upsert(payload,{onConflict:'user_id'});
    if (error) throw error;
    meta = await getMetaAvatar(user.id).catch(() => ({ ...payload }));
    return true;
  })();
  try { return await saveFlight; }
  catch (error) { say(error.message || String(error)); return false; }
  finally { saveFlight = null; }
}

async function choose(id){ const c = rows.find((x) => x.id === id) || rows[0]; if (!c) return; if (await saveRows(rows,c.name)){ say(`${c.name} is active in Meta World.`); render(); } }
async function clone(id){ const c = rows.find((x) => x.id === id); if (!c) return; const copy = hydrate({...c, id:`${safeId(c.id)}-clone-${Date.now().toString(36)}`, name:`${c.name} Clone`, createdAt:new Date().toISOString()}); const next = [copy,...rows].slice(0,36); if(await saveRows(next,copy.name)){ say(`${copy.name} cloned.`); render(); } }
async function remove(id){ if(rows.length<=1){ say('Keep at least one avatar character.'); return; } const removed = rows.find((x) => x.id === id); const next = rows.filter((x) => x.id !== id); if(await saveRows(next,next[0]?.name)){ say(`${removed?.name || 'Character'} removed from roster.`); render(); } }

async function boot(){
  user = await getSessionUser();
  if(!user){ location.href='/auth.html?next=/avatar-characters/'; return; }
  profile = await ensureProfile(user);
  meta = await getMetaAvatar(user.id).catch(() => null);
  render();
}

document.addEventListener('click', (event) => {
  const cardNode = event.target.closest('[data-id]');
  const chooseButton = event.target.closest('[data-choose]');
  const cloneButton = event.target.closest('[data-clone]');
  const removeButton = event.target.closest('[data-remove]');
  if (chooseButton) { event.stopPropagation(); choose(chooseButton.dataset.choose); return; }
  if (cloneButton) { event.stopPropagation(); clone(cloneButton.dataset.clone); return; }
  if (removeButton) { event.stopPropagation(); remove(removeButton.dataset.remove); return; }
  if (cardNode) select(cardNode.dataset.id);
});

document.getElementById('randomActive')?.addEventListener('click',()=>{ if(!rows.length || saveFlight)return; const pick=rows[Math.floor(Math.random()*rows.length)]; choose(pick.id); });
boot().catch((error) => say(error.message || String(error)));
