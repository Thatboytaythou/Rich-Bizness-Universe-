import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.selector.css';

type Preset = { preset_key:string; title:string; aura:string; outfit:string; motion:string; config:Record<string,string> };
type Snapshot = { profile?:Record<string,unknown>; avatar?:Record<string,any>; presets?:Preset[] };

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const token=(v:unknown,fallback='custom')=>String(v??fallback).toLowerCase().replace(/[^a-z0-9_-]+/g,'-');

const renderFigure=(preset:Preset)=>{
  const body=token(preset.config?.body_type,'custom');
  const build=token(preset.config?.build,'athletic');
  const hair=token(preset.config?.hair,'energy');
  const style=token(preset.config?.style,preset.preset_key);
  return `<span class="preset-figure" data-body="${esc(body)}" data-build="${esc(build)}" data-hair="${esc(hair)}" data-style="${esc(style)}" aria-hidden="true">
    <i class="preset-figure__portal"></i><i class="preset-figure__aura"></i><i class="preset-figure__head"></i><i class="preset-figure__hair"></i><i class="preset-figure__torso"></i><i class="preset-figure__arm preset-figure__arm--left"></i><i class="preset-figure__arm preset-figure__arm--right"></i><i class="preset-figure__leg preset-figure__leg--left"></i><i class="preset-figure__leg preset-figure__leg--right"></i><i class="preset-figure__signature"></i>
  </span>`;
};

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
  const activePreset=()=>presets.find(p=>p.preset_key===selected)??presets[0];
  root.innerHTML=`<main class="avatar-select-shell"><div class="avatar-select-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div><header><a href="/portal.html">← PORTAL</a><div><small>RICH BIZNESS AVATAR SYSTEM</small><h1>Choose Your Character</h1><p>Select one identity. The same rig, aura, style and progression will follow you into Profile, Meta and the 3D lobby.</p></div><a class="launch" id="launchLobby" href="/avatar-characters.html?preset=${encodeURIComponent(selected)}">ENTER LOBBY</a></header><section class="identity"><div class="identity-orb"><span>RB</span></div><div><small>ACTIVE IDENTITY</small><strong>${esc(name)}</strong><span id="activeIdentityAura">${esc(aura)}</span><em id="activeIdentityPreset">${esc(activePreset()?.title??'Rich Character')}</em></div><button id="saveAvatar">SYNC SELECTION</button></section><section id="presetGrid" class="preset-grid">${presets.map(p=>`<button class="preset-card ${p.preset_key===selected?'active':''}" data-preset="${esc(p.preset_key)}" data-aura="${esc(p.aura)}" style="--card-accent:${p.aura==='Diamond Mist'?'#8fe8ff':p.aura==='Neon Phantom'?'#8b5cff':'#31ff63'};--card-gold:${p.aura==='Diamond Mist'?'#d99cff':'#f7c948'}"><span class="preset-card__status">${p.preset_key===selected?'ACTIVE':'AVAILABLE'}</span>${renderFigure(p)}<span class="preset-card__copy"><small>${esc(p.motion||'ELITE MOTION')}</small><strong>${esc(p.title)}</strong><span>${esc(p.outfit)}</span><em>${esc(p.aura)}</em></span></button>`).join('')}</section><footer><p id="avatarStatus">One saved character powers Profile, Portal, Meta and the character lobby.</p><div><a id="previewLobby" href="/avatar-characters.html?preset=${encodeURIComponent(selected)}">PREVIEW SELECTED</a><a href="/meta.html">OPEN META →</a></div></footer></main>`;
  const cards=[...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const status=root.querySelector<HTMLElement>('#avatarStatus')!;
  const activeAura=root.querySelector<HTMLElement>('#activeIdentityAura')!;
  const activeTitle=root.querySelector<HTMLElement>('#activeIdentityPreset')!;
  const launch=root.querySelector<HTMLAnchorElement>('#launchLobby')!;
  const preview=root.querySelector<HTMLAnchorElement>('#previewLobby')!;
  const updateSelection=(card:HTMLButtonElement)=>{
    selected=card.dataset.preset??selected;
    aura=card.dataset.aura??aura;
    const preset=activePreset();
    cards.forEach(x=>{const isActive=x===card;x.classList.toggle('active',isActive);const badge=x.querySelector<HTMLElement>('.preset-card__status');if(badge)badge.textContent=isActive?'ACTIVE':'AVAILABLE';});
    activeAura.textContent=aura;
    activeTitle.textContent=preset?.title??'Rich Character';
    launch.href=`/avatar-characters.html?preset=${encodeURIComponent(selected)}`;
    preview.href=launch.href;
    status.textContent=`${preset?.title??'Avatar'} selected. Sync once to use it everywhere.`;
  };
  cards.forEach(card=>card.onclick=()=>updateSelection(card));
  root.querySelector<HTMLButtonElement>('#saveAvatar')!.onclick=async()=>{const preset=activePreset();status.textContent='Synchronizing character identity across the universe…';const button=root.querySelector<HTMLButtonElement>('#saveAvatar')!;button.disabled=true;const{error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:name,p_preset_key:selected,p_aura:aura,p_outfit:{preset:preset?.outfit??'Rich Street',character:preset?.config??{},rig:'human-v3-proportioned'},p_accessories:{signature:preset?.config?.signature??null},p_smoke:{mode:preset?.config?.smoke??'cinematic',intensity:'elite'},p_emotes:{idle:true,power_up:true,combat_pose:true},p_character_type:selected});button.disabled=false;status.textContent=saveError?saveError.message:`${preset?.title??'Character'} is now synced across Profile, Portal, Meta and Character Lobby.`;};
}