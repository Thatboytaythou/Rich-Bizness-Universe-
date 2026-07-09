import { supabase } from './supabase-client.js';
import { ensureProfile, getMetaAvatar, getSessionUser } from './rb-identity.js?v=profile-avatar-separate-1';

const status = document.getElementById('characterStatus');
const preview = document.getElementById('characterPreview');
const openGrid = document.querySelector('.character-grid');
let user = null;
let profile = null;
let meta = null;
const starter = [
  { id:'boss-walk', name:'Boss Walk', icon:'♛', preset:'boss-walk', config:{outfit:'Black Gold Boss', motion:'Boss Walk', aura:'Emerald Gold', gender:'boy'} },
  { id:'creator-mode', name:'Creator Mode', icon:'🎙️', preset:'creator', config:{outfit:'Creator Hoodie', motion:'Dance Flex', aura:'Diamond Mist', gender:'boy'} },
  { id:'meta-runner', name:'Meta Runner', icon:'◎', preset:'meta-runner', config:{outfit:'Meta Armor', motion:'Power Up', aura:'Neon Phantom', gender:'girl'} }
];
const say = (text) => { if (status) status.textContent = text; };
function roster(){ return Array.isArray(meta?.metadata?.savedCharacters) && meta.metadata.savedCharacters.length ? meta.metadata.savedCharacters : starter; }
function card(c){ const face = c.avatar_url ? `<img src="${c.avatar_url}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:20px">` : (c.icon || '♛'); return `<article class="card character-card open" data-character="${c.name}" data-id="${c.id}" data-preset="${c.preset || ''}"><div class="character-face">${face}</div><b>${c.name}</b><p>${c.config?.motion || c.config?.outfit || 'Saved Rich Bizness avatar character.'}</p><button class="identity-pill primary" type="button" data-choose="${c.id}">SET ACTIVE</button></article>`; }
function render(){ const rows = roster(); if (openGrid) openGrid.innerHTML = rows.map(card).join(''); document.querySelectorAll('[data-character]').forEach((el)=>el.addEventListener('click',()=>select(el))); document.querySelectorAll('[data-choose]').forEach((el)=>el.addEventListener('click',(e)=>{ e.preventDefault(); choose(el.dataset.choose); })); if (rows[0]) select(document.querySelector('[data-character]')); }
function select(card){ document.querySelectorAll('[data-character]').forEach((item)=>item.classList.toggle('selected', item===card)); const name=card?.dataset.character || 'Boss Walk'; const face=card?.querySelector('.character-face'); if(preview) preview.textContent = face?.textContent?.trim() || '♛'; say(`${name} selected. Set active or open Avatar to customize.`); }
async function choose(id){ const rows=roster(); const chosen=rows.find(c=>c.id===id) || rows[0]; if(!chosen) return; const metadata={...(meta?.metadata||{}),...(chosen.config||{}),selectedCharacter:chosen.name,savedCharacters:rows,updatedAt:new Date().toISOString()}; const payload={ user_id:user.id, display_name:profile.display_name, avatar_url:chosen.avatar_url||meta?.avatar_url||'', aura:metadata.aura||'Emerald Gold', rank:profile.rank_title||'BIZ LEGEND', level:profile.rich_level||1, xp:profile.rich_points||0, position:meta?.position||{world:'portal-hub',x:0,y:0,z:0}, is_active:true, metadata }; const { error } = await supabase.from('meta_avatars').upsert(payload, { onConflict:'user_id' }); if(error){ say(error.message); return; } say(`${chosen.name} is active for Meta World.`); setTimeout(()=>location.href='/meta.html',550); }
async function boot(){ user=await getSessionUser(); if(!user){ location.href='/auth.html?next=/avatar-characters/'; return; } profile=await ensureProfile(user); meta=await getMetaAvatar(user.id).catch(()=>null); render(); }
boot();
