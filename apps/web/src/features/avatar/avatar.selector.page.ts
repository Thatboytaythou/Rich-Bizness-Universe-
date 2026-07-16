import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.selector.css';

type Preset = { preset_key:string; title:string; aura:string; outfit:string; motion:string; config:Record<string,string> };
type Snapshot = { profile?:Record<string,unknown>; avatar?:Record<string,any>; presets?:Preset[] };

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');
  if(!root||root.dataset.avatarSelectorOwner==='mounted')return;
  root.dataset.avatarSelectorOwner='mounted';
  const user=getAuthSnapshot().user;
  if(!user){location.replace('/tap-in.html?next=%2Favatar.html');return;}
  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{});
  if(error)throw error;
  const snapshot=(data??{}) as Snapshot;
  const presets=Array.isArray(snapshot.presets)?snapshot.presets:[];
  const profile=snapshot.profile??{};
  const avatar=snapshot.avatar??{};
  let selected=String(avatar.metadata?.preset_key??presets[0]?.preset_key??'boss');
  let aura=String(avatar.aura??presets.find(p=>p.preset_key===selected)?.aura??'Emerald Gold');
  const name=String(avatar.display_name??profile.display_name??profile.username??user.email?.split('@')[0]??'Rich Avatar');
  root.innerHTML=`<main class="avatar-select-shell"><header><a href="/portal.html">← PORTAL</a><div><small>RICH BIZNESS AVATAR SYSTEM</small><h1>Choose Your Character</h1><p>Select and sync one identity before entering the 3D character lobby.</p></div><a class="launch" href="/avatar-characters.html">ENTER LOBBY</a></header><section class="identity"><div><small>ACTIVE IDENTITY</small><strong>${esc(name)}</strong><span>${esc(aura)}</span></div><button id="saveAvatar">SYNC SELECTION</button></section><section id="presetGrid" class="preset-grid">${presets.map(p=>`<button class="preset-card ${p.preset_key===selected?'active':''}" data-preset="${esc(p.preset_key)}" data-aura="${esc(p.aura)}"><i></i><small>${esc(p.motion||'ELITE MOTION')}</small><strong>${esc(p.title)}</strong><span>${esc(p.outfit)}</span><em>${esc(p.aura)}</em></button>`).join('')}</section><footer><p id="avatarStatus">One saved avatar powers Profile, Portal, Meta and the character lobby.</p><a href="/avatar-characters.html">OPEN 3D CHARACTER LOBBY →</a></footer></main>`;
  const cards=[...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const status=root.querySelector<HTMLElement>('#avatarStatus')!;
  cards.forEach(card=>card.onclick=()=>{selected=card.dataset.preset??selected;aura=card.dataset.aura??aura;cards.forEach(x=>x.classList.toggle('active',x===card));status.textContent=`${card.querySelector('strong')?.textContent??'Avatar'} selected. Sync to use it everywhere.`;});
  root.querySelector<HTMLButtonElement>('#saveAvatar')!.onclick=async()=>{const preset=presets.find(p=>p.preset_key===selected);status.textContent='Syncing selected avatar…';const{error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:name,p_preset_key:selected,p_aura:aura,p_outfit:{preset:preset?.outfit??'Rich Street',character:preset?.config??{},rig:'human-v3-proportioned'},p_accessories:{},p_smoke:{mode:'cinematic',intensity:'elite'},p_emotes:{idle:true,power_up:true,combat_pose:true},p_character_type:selected});status.textContent=saveError?saveError.message:'Avatar synced across Profile, Portal, Meta and Character Lobby.';};
}
