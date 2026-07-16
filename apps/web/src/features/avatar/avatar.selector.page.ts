import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.selector.css';

type Preset = { preset_key:string; title:string; aura:string; outfit:string; motion:string; config:Record<string,string> };
type Snapshot = { profile?:Record<string,unknown>; avatar?:Record<string,any>; presets?:Preset[] };

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const token=(v:unknown,fallback='custom')=>String(v??fallback).toLowerCase().replace(/[^a-z0-9_-]+/g,'-');

const renderFigure=(preset:Preset)=>{
  const key=token(preset.preset_key,'rich-avatar');
  const female=token(preset.config?.body_type,'custom')==='female';
  const heroic=token(preset.config?.build,'athletic')==='heroic';
  const hair=token(preset.config?.hair,'energy');
  const primary=preset.aura==='Diamond Mist'?'#8fe8ff':preset.aura==='Neon Phantom'?'#8b5cff':'#31ff63';
  const secondary=preset.aura==='Diamond Mist'?'#d99cff':'#f7c948';
  const shoulder=heroic?54:female?42:48;
  const waist=female?31:38;
  const hairPath=hair==='long-wave'
    ? '<path d="M70 42c2-21 38-29 53-9 8 11 8 41 2 55l-14-9-6-26-15-9-15 10-5 31-15 8c-5-17-5-39 0-51z" fill="#26150f"/>'
    : hair==='locs'
      ? '<g stroke="#17120f" stroke-width="7" stroke-linecap="round"><path d="M69 43l-8 39"/><path d="M80 35l-5 51"/><path d="M92 32v54"/><path d="M104 36l5 49"/><path d="M115 43l8 39"/></g>'
      : `<path d="M66 50 72 29l11 10 8-20 9 19 12-13 8 27-13-9-16 4-14-5z" fill="url(#${key}-hair)"/>`;
  return `<span class="preset-figure" aria-hidden="true">
    <svg viewBox="0 0 190 235" role="presentation" focusable="false">
      <defs>
        <radialGradient id="${key}-portal"><stop offset="0" stop-color="${primary}" stop-opacity=".34"/><stop offset=".58" stop-color="${primary}" stop-opacity=".08"/><stop offset="1" stop-color="#020402" stop-opacity="0"/></radialGradient>
        <linearGradient id="${key}-suit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset=".48" stop-color="#071108"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
        <linearGradient id="${key}-hair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
        <filter id="${key}-glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="95" cy="118" rx="82" ry="101" fill="url(#${key}-portal)"/>
      <g fill="none" stroke="${primary}" opacity=".42"><ellipse cx="95" cy="121" rx="72" ry="91"/><ellipse cx="95" cy="121" rx="59" ry="77" stroke-dasharray="4 7"/></g>
      <g filter="url(#${key}-glow)">
        ${hairPath}
        <ellipse cx="95" cy="57" rx="23" ry="27" fill="#70442f"/>
        <path d="M${95-shoulder} 102 Q95 78 ${95+shoulder} 102 L${95+waist} 174 Q95 188 ${95-waist} 174Z" fill="url(#${key}-suit)"/>
        <path d="M${95-shoulder+7} 107 52 175 68 181 85 120Z" fill="url(#${key}-suit)"/>
        <path d="M${95+shoulder-7} 107 138 175 122 181 105 120Z" fill="url(#${key}-suit)"/>
        <path d="M75 171 65 224 86 224 95 178Z" fill="#111615"/>
        <path d="M115 171 125 224 104 224 95 178Z" fill="#111615"/>
        <circle cx="95" cy="126" r="17" fill="none" stroke="${secondary}" stroke-width="3"/>
        <path d="M84 126h22M95 115v22" stroke="${secondary}" stroke-width="2" opacity=".8"/>
      </g>
      <g fill="${secondary}" font-family="system-ui,sans-serif" font-weight="900" font-size="8" letter-spacing="1.4"><text x="95" y="219" text-anchor="middle">${esc(preset.motion||'ELITE MOTION').toUpperCase()}</text></g>
    </svg>
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