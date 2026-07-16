type Preset={preset_key:string;title:string;aura:string;outfit:string;motion:string;config:Record<string,string>};
const esc=(v:any)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]??c));

export function mountHumanUi(root:HTMLElement,data:{name:string;level:number;xp:number;rank:string;presets:Preset[];aura:string;selectedPresetKey:string}){
  root.innerHTML=`<main class="avatar-shell human-owner"><header class="avatar-top"><a href="/avatar.html" aria-label="Back to character selector">←</a><div><p>RICH BIZNESS CHARACTER UNIVERSE</p><h1>GTA-Style Avatar Studio</h1></div><div class="avatar-live"><i></i> HUMAN RIG ONLINE</div></header><section class="avatar-workspace"><div class="avatar-stage"><div class="avatar-engine-bar"><span><i></i> HUMAN STREET RIG</span><div><button data-camera="orbit" class="active">ORBIT</button><button data-camera="street">STREET</button><button data-camera="portrait">PORTRAIT</button></div><button id="fullscreenBtn">FULLSCREEN</button></div><div class="avatar-motion-bar">${['idle','walk','run','combat','power','smoke','dance'].map(x=>`<button data-motion="${x}">${x.toUpperCase()}</button>`).join('')}</div><div class="avatar-scene-frame"><canvas id="avatarCanvas"></canvas><div class="avatar-scene-vignette" aria-hidden="true"></div><div class="avatar-scene-reticle" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="avatar-control-deck"><div class="avatar-hud"><div><span id="motionState">IDLE</span><b id="stageName">${esc(data.name)}</b><small id="stagePreset"></small></div><div class="avatar-meter"><span>LEVEL ${data.level}</span><span>${data.xp} XP</span><span>${esc(data.rank)}</span></div></div><div class="avatar-mobile-controls"><div id="joystick" class="avatar-joystick"><i></i></div><div><button data-action="jump">JUMP</button><button data-action="sprint">RUN</button><button data-action="power">POWER</button><button data-action="combat">COMBAT</button></div></div></div></div><aside class="avatar-console"><section><h3>CHARACTER IDENTITY</h3><label>DISPLAY NAME<input id="displayName" maxlength="80" value="${esc(data.name)}"></label><div id="identityTags" class="avatar-runtime-strip"></div></section><section><h3>CHARACTER UNIVERSE</h3><div id="presetOptions" class="avatar-grid"></div></section><section><h3>AURA</h3><label>STYLE<select id="auraSelect">${['Emerald Gold','Diamond Mist','Neon Phantom'].map(x=>`<option>${x}</option>`).join('')}</select></label></section><section><h3>RUNTIME</h3><div class="avatar-runtime-grid"><article><small>BODY</small><b>HUMAN PROPORTIONS</b></article><article><small>RIG</small><b>SEGMENTED JOINTS</b></article><article><small>CAMERA</small><b>THIRD PERSON</b></article><article><small>SYNC</small><b>REALTIME</b></article></div></section><div class="avatar-save-row"><button id="resetBtn">RESET</button><button id="saveBtn" class="primary">SAVE CHARACTER</button></div><p id="status"></p></aside></section></main>`;

  const canvas=root.querySelector<HTMLCanvasElement>('#avatarCanvas')!;
  const stage=root.querySelector<HTMLElement>('.avatar-stage')!;
  const state=root.querySelector<HTMLElement>('#motionState')!;
  const status=root.querySelector<HTMLElement>('#status')!;
  const nameInput=root.querySelector<HTMLInputElement>('#displayName')!;
  const auraSelect=root.querySelector<HTMLSelectElement>('#auraSelect')!;
  const presetBox=root.querySelector<HTMLElement>('#presetOptions')!;
  const tags=root.querySelector<HTMLElement>('#identityTags')!;
  auraSelect.value=data.aura;
  let active=data.presets.find(x=>x.preset_key===data.selectedPresetKey)??data.presets[0];
  let onCamera=(v:string)=>{},onMotion=(v:string)=>{},onAction=(v:string)=>{},onActionEnd=(v:string)=>{},onJoystick=(v:{x:number;y:number})=>{},onAura=(v:string)=>{},onPreset=(v:string)=>{},onReset=()=>{},onSave=()=>{};

  const refresh=(preset:Preset|undefined,aura:string)=>{
    active=preset;
    root.querySelector('#stageName')!.textContent=nameInput.value.trim()||'Rich Avatar';
    root.querySelector('#stagePreset')!.textContent=`${preset?.title??'Custom'} · ${aura} · ${preset?.outfit??'Street Fit'}`;
    tags.innerHTML=[preset?.config.body_type??'custom',preset?.config.build??'athletic',preset?.config.style??'human rig'].map(x=>`<span>${esc(x)}</span>`).join('');
    presetBox.innerHTML=data.presets.map(x=>`<button class="${x.preset_key===preset?.preset_key?'active':''}" data-preset="${esc(x.preset_key)}"><b>${esc(x.title)}</b><small>${esc(x.outfit)} · ${esc(x.motion)}</small></button>`).join('');
    presetBox.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>button.onclick=()=>onPreset(button.dataset.preset??''));
  };

  root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button=>button.onclick=()=>{root.querySelectorAll('[data-camera]').forEach(x=>x.classList.toggle('active',x===button));onCamera(button.dataset.camera??'orbit');});
  root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(button=>button.onclick=()=>onMotion(button.dataset.motion??'idle'));
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>{const action=button.dataset.action??'';button.onpointerdown=()=>onAction(action);button.onpointerup=()=>onActionEnd(action);button.onpointercancel=()=>onActionEnd(action);button.onpointerleave=()=>onActionEnd(action);});
  root.querySelector<HTMLButtonElement>('#fullscreenBtn')!.onclick=()=>void(document.fullscreenElement?document.exitFullscreen():stage.requestFullscreen());
  root.querySelector<HTMLButtonElement>('#resetBtn')!.onclick=()=>onReset();
  root.querySelector<HTMLButtonElement>('#saveBtn')!.onclick=()=>onSave();
  auraSelect.onchange=()=>onAura(auraSelect.value);
  nameInput.oninput=()=>refresh(active,auraSelect.value);

  const joy=root.querySelector<HTMLElement>('#joystick')!;
  const stick=joy.querySelector<HTMLElement>('i')!;
  const move=(event:PointerEvent)=>{const rect=joy.getBoundingClientRect(),value={x:Math.max(-1,Math.min(1,(event.clientX-rect.left-rect.width/2)/(rect.width*.34))),y:Math.max(-1,Math.min(1,(event.clientY-rect.top-rect.height/2)/(rect.height*.34)))};stick.style.transform=`translate(${value.x*28}px,${value.y*28}px)`;onJoystick(value);};
  const release=()=>{stick.style.transform='translate(0,0)';onJoystick({x:0,y:0});};
  joy.onpointerdown=event=>{joy.setPointerCapture(event.pointerId);move(event);};
  joy.onpointermove=event=>{if(joy.hasPointerCapture(event.pointerId))move(event);};
  joy.onpointerup=release;
  joy.onpointercancel=release;
  refresh(active,data.aura);

  return{canvas,stage,state,status,nameInput,refresh,cleanup:()=>release(),set onCamera(v){onCamera=v},set onMotion(v){onMotion=v},set onAction(v){onAction=v},set onActionEnd(v){onActionEnd=v},set onJoystick(v){onJoystick=v},set onAura(v){onAura=v},set onPreset(v){onPreset=v},set onReset(v){onReset=v},set onSave(v){onSave=v}};
}