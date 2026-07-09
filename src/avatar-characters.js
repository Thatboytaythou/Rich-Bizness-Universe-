import { supabase } from './supabase-client.js';
import { ensureProfile, getMetaAvatar, getSessionUser } from './rb-identity.js?v=profile-avatar-separate-1';

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
const starter = [
  { id:'boss-walk', name:'Boss Walk', icon:'♛', avatar_url:'', config:{gender:'boy',outfit:'Black Gold Boss',motion:'Boss Walk',aura:'Emerald Gold',quality:'4D-HD'} },
  { id:'girl-boss', name:'Girl Boss', icon:'💎', avatar_url:'', config:{gender:'girl',outfit:'Diamond Fur',motion:'Boss Walk',aura:'Diamond Mist',quality:'4D-HD'} },
  { id:'meta-runner', name:'Meta Runner', icon:'◎', avatar_url:'', config:{gender:'girl',outfit:'Meta Armor',motion:'Power Up',aura:'Neon Phantom',quality:'4D-HD'} }
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
const xp = () => Number(profile?.rich_points || meta?.xp || 0);
function roster(){ const saved = Array.isArray(meta?.metadata?.savedCharacters) ? meta.metadata.savedCharacters : []; return saved.length ? saved : starter; }
function setStage(c){ if(!stage) return; if(c?.avatar_url){ stage.innerHTML = `<img src="${c.avatar_url}" alt="${c.name}">`; } else { stage.innerHTML = `<div class="roster-stage-fallback">${c?.icon || '♛'}</div>`; } if(preview) preview.textContent = c?.config?.gender === 'girl' ? 'GIRL' : c?.config?.gender === 'npc' ? 'NPC' : 'BOY'; }
function card(c){ const active = (meta?.metadata?.selectedCharacter || '').toLowerCase() === String(c.name || '').toLowerCase(); const face = c.avatar_url ? `<img src="${c.avatar_url}" alt="">` : (c.icon || '♛'); const motion = c.config?.motion || 'Motion Ready'; const aura = c.config?.aura || 'Emerald Gold'; const gender = c.config?.gender || 'boy'; return `<article class="character-card ${active?'active':''}" data-id="${c.id}"><div class="character-face">${face}</div><b>${c.name}</b><p>${gender.toUpperCase()} • ${motion} • ${aura} • ${c.quality || c.config?.quality || '4D-HD'}</p><div class="character-actions"><button class="primary" type="button" data-choose="${c.id}">ACTIVE</button><a href="/avatar.html?preset=${encodeURIComponent(c.id)}">EDIT</a><button type="button" data-clone="${c.id}">CLONE</button><button type="button" data-remove="${c.id}">REMOVE</button></div></article>`; }
function renderUnlocks(){ const total = xp(); const open = unlocks.filter(u=>total>=u.need).length; if(unlockCount) unlockCount.textContent = open.toLocaleString(); if(!unlockList) return; unlockList.innerHTML = unlocks.map(u=>`<article class="unlock-card ${total>=u.need?'open':'locked'}"><b>${u.icon} ${u.name}</b><small>${total>=u.need?'UNLOCKED':'LOCKED'} • ${u.lane} • ${total.toLocaleString()} / ${u.need.toLocaleString()} XP</small></article>`).join(''); }
function render(){ rows = roster(); if(openCount) openCount.textContent = rows.length.toLocaleString(); if(grid) grid.innerHTML = rows.map(card).join(''); document.querySelectorAll('[data-id]').forEach(el=>el.addEventListener('click',()=>select(el.dataset.id))); document.querySelectorAll('[data-choose]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();choose(el.dataset.choose)})); document.querySelectorAll('[data-clone]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();clone(el.dataset.clone)})); document.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();remove(el.dataset.remove)})); const active = rows.find(c => (meta?.metadata?.selectedCharacter || '').toLowerCase() === String(c.name || '').toLowerCase()) || rows[0]; setStage(active); renderUnlocks(); say(`${active?.name || 'Avatar'} ready. Set active to use it in Meta.`); }
function select(id){ const c = rows.find(x=>x.id===id) || rows[0]; setStage(c); say(`${c.name} selected. Active it, edit it, clone it, or launch Meta.`); }
async function saveRows(nextRows, activeName){ const metadata = { ...(meta?.metadata || {}), savedCharacters: nextRows, selectedCharacter: activeName || meta?.metadata?.selectedCharacter || nextRows[0]?.name || 'Boss Walk', updatedAt: new Date().toISOString() }; const active = nextRows.find(c=>c.name===metadata.selectedCharacter) || nextRows[0]; const payload = { user_id:user.id, display_name:profile.display_name, avatar_url:active?.avatar_url || meta?.avatar_url || '', aura:active?.config?.aura || meta?.aura || 'Emerald Gold', rank:profile.rank_title || 'BIZ LEGEND', level:profile.rich_level || 1, xp:profile.rich_points || 0, position:meta?.position || {world:'portal-hub',x:0,y:0,z:0}, is_active:true, metadata }; const { error } = await supabase.from('meta_avatars').upsert(payload,{onConflict:'user_id'}); if(error){ say(error.message); return false; } meta = await getMetaAvatar(user.id).catch(()=>({metadata})); return true; }
async function choose(id){ const c = rows.find(x=>x.id===id) || rows[0]; if(!c) return; if(await saveRows(rows,c.name)){ say(`${c.name} is active in Meta World.`); render(); } }
async function clone(id){ const c = rows.find(x=>x.id===id); if(!c) return; const copy = {...c, id:`${c.id}-clone-${Date.now().toString(36)}`, name:`${c.name} Clone`, createdAt:new Date().toISOString()}; const next = [copy,...rows].slice(0,36); if(await saveRows(next,copy.name)){ say(`${copy.name} cloned.`); render(); } }
async function remove(id){ if(rows.length<=1){ say('Keep at least one avatar character.'); return; } const removed = rows.find(x=>x.id===id); const next = rows.filter(x=>x.id!==id); if(await saveRows(next,next[0]?.name)){ say(`${removed?.name || 'Character'} removed from roster.`); render(); } }
async function boot(){ user = await getSessionUser(); if(!user){ location.href='/auth.html?next=/avatar-characters/'; return; } profile = await ensureProfile(user); meta = await getMetaAvatar(user.id).catch(()=>null); render(); }
document.getElementById('randomActive')?.addEventListener('click',()=>{ if(!rows.length)return; const pick=rows[Math.floor(Math.random()*rows.length)]; choose(pick.id); });
boot();