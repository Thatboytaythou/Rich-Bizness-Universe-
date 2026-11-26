import {getAuthSnapshot} from '../../core/auth/auth-store';
import {CHARACTER_OPTIONS,normalizeLook,type CharacterLook} from './avatar.character.config';
import {readCharacterIdentity,saveCharacterIdentity,savedCharacter,hasSavedOriginal,type CharacterIdentity,type CharacterConfig} from './avatar.identity';
import type {StudioGraphics} from './avatar.graphics';
import type {AvatarMotion} from './avatar.skinned.runtime';
import './avatar.characters.css';

const OWNER='rich-bizness-avatar-characters-v1',RELEASE='avatar-face-layout-9';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const emptyIdentity=():CharacterIdentity=>({profile:{},avatar:{},loadout:{},controller:{},model:{}});
type Host=Window&{__rbPageCleanup?:()=>void};
const presets:Record<string,Partial<CharacterLook>>={street:{top:'hoodie',pants:'cargo',shoes:'sneakers'},boss:{top:'jacket',pants:'tailored',shoes:'boots',gear:'chain'},tactical:{top:'vest',pants:'cargo',shoes:'boots'},cyber:{top:'vest',pants:'denim',shoes:'high-tops',color:'ice',gear:'shades'}};

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app');if(!root)throw Error('Missing app');
  const epoch=root.dataset.pageEpoch??'',user=getAuthSnapshot().user;
  if(!user){location.replace('/tap-in.html?next=%2Favatar-characters.html');return;}
  let disposed=false,identity=emptyIdentity(),config=savedCharacter(identity),identityReady=false,saving=false,dirty=false,reading=false;
  let graphics:StudioGraphics|null=null,graphicsGeneration=0,graphicsLoading=false,graphicsFrame=false;
  const lifecycle=new AbortController(),signal=lifecycle.signal;
  const current=()=>!disposed&&root.dataset.pageEpoch===epoch&&root.dataset.pageOwner===OWNER;
  const cleanup=()=>{if(disposed)return;disposed=true;lifecycle.abort();graphicsGeneration++;graphics?.dispose();graphics=null;if((window as Host).__rbPageCleanup===cleanup)(window as Host).__rbPageCleanup=undefined;};
  (window as Host).__rbPageCleanup=cleanup;window.addEventListener('pagehide',cleanup,{once:true,signal});
  root.dataset.rbStudioRelease=RELEASE;
  root.innerHTML=`<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS • CHARACTER SYSTEM</small><h1>Avatar Studio</h1></div><button type="button" class="enter" id="acSaveEnter">SAVE & ENTER</button></header>
  <div class="ac-system-bar"><div><small>RICH ID • STUDIO</small><strong id="acIdentityName">Connecting…</strong></div><div id="acXpSlot"></div><div id="acOmniSlot"></div></div>
  <section class="ac-layout"><div class="ac-stage"><div class="ac-viewport" id="acViewport"><div id="acConfigPreview" class="ac-config-preview"><small>CHARACTER CONFIGURATION</small><div class="ac-preview-emblem">RB</div><strong id="acPreviewName">Rich Avatar</strong><span id="acPreviewDetails"></span><div id="acPreviewSwatches"></div><small>Graphics are optional. Your Rich ID can save independently.</small></div><canvas id="characterCanvas" hidden></canvas></div>
  <div class="ac-stage-controls"><div class="ac-quick"><button id="acStartGraphics" class="primary" type="button">ENABLE 3D</button><button id="acStopGraphics" type="button" disabled hidden>PAUSE 3D</button><button data-view="body">BODY</button><button data-view="face">FACE</button></div><p id="acGraphicsStatus" role="status">Graphics paused • configuration mode</p><details class="ac-motion-tools"><summary>Motion & camera controls</summary>
  <div class="ac-motion"><button data-motion="idle">IDLE</button><button data-motion="walk">WALK</button><button data-motion="run">RUN</button><button data-motion="jump">JUMP</button><button data-motion="power">POSE</button></div><div class="ac-camera"><button data-view="front">FRONT</button><button data-view="back">BACK</button><button data-view="out">−</button><button data-view="in">+</button><button data-view="reset">RESET</button></div></details>
  <div class="ac-actions"><button id="acSaveTop" class="primary">SAVE TO RICH ID</button><button id="acRetryIdentity" hidden>RETRY IDENTITY</button></div><p id="acSyncStatus" role="status">Reading Rich ID…</p><a class="ac-direct-lobby" href="/avatar.html" hidden>OPEN SAVED LOBBY</a></div></div>
  <aside class="ac-editor"><div class="section-title"><span>CHARACTER LAB</span><small>BUILD · STYLE · FX</small></div><div class="seg"><button data-gender="boy">BOY</button><button data-gender="girl">GIRL</button></div><label>NAME<input id="nameInput" maxlength="28" autocomplete="off"></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><div class="section-title"><span>APPEARANCE</span><small>ORIGINAL CONFIGURATION</small></div><div class="ac-appearance">${Object.entries(CHARACTER_OPTIONS).map(([key,options])=>`<label>${key.toUpperCase()}<select data-appearance="${key}">${options.map(v=>`<option value="${v}">${v.toUpperCase()}</option>`).join('')}</select></label>`).join('')}</div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus" role="status">Connecting identity…</p><small class="ac-release">STUDIO RELEASE • ${RELEASE}</small></aside></section></main>`;
  const $=<T extends HTMLElement>(sel:string)=>root.querySelector<T>(sel)!;
  let canvas=$<HTMLCanvasElement>('#characterCanvas');const preview=$('#acConfigPreview');
  const name=$<HTMLInputElement>('#nameInput'),build=$<HTMLSelectElement>('#buildInput'),style=$<HTMLSelectElement>('#styleInput'),aura=$<HTMLSelectElement>('#auraInput');
  const saveButtons=['#acSaveEnter','#acSaveTop','#saveCharacter'].map(s=>$<HTMLButtonElement>(s));
  const editControls=[...root.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.ac-editor input,.ac-editor select,[data-gender],#randomize')];
  const start=$<HTMLButtonElement>('#acStartGraphics'),stop=$<HTMLButtonElement>('#acStopGraphics'),retry=$<HTMLButtonElement>('#acRetryIdentity');
  const motionControls=[...root.querySelectorAll<HTMLButtonElement>('[data-motion],[data-view]')];
  const report=(s:string)=>{$('#acSyncStatus').textContent=s;$('#saveStatus').textContent=s;};
  const visualReport=(s:string)=>{$('#acGraphicsStatus').textContent=s;};
  const controls=()=>{for(const b of saveButtons)b.disabled=saving||reading||!identityReady;for(const e of editControls)e.disabled=saving||reading;retry.disabled=reading||saving;retry.hidden=identityReady;start.disabled=graphicsLoading||!!graphics;start.hidden=!!graphics;stop.hidden=!graphics&&!graphicsLoading;stop.disabled=!graphics&&!graphicsLoading;root.querySelector<HTMLAnchorElement>('.ac-direct-lobby')!.hidden=dirty||!identityReady;for(const b of motionControls)b.disabled=!graphics||!graphicsFrame;};
  const renderConfig=()=>{
    $('#acPreviewName').textContent=config.name;
    $('#acPreviewDetails').textContent=[config.gender,config.build,config.look.hair,config.look.top,config.look.pants,config.look.shoes,config.look.gear,config.aura].map(v=>v.toUpperCase()).join(' · ');
    const skin:Record<string,string>={deep:'#754631',warm:'#ad7352',tan:'#c88f68',light:'#e5b294'},clothes:Record<string,string>={emerald:'#285b48',onyx:'#20252a',gold:'#ae803b',ice:'#587f91'};
    $('#acPreviewSwatches').innerHTML=`<i style="background:${skin[config.look.skin]}"></i><i style="background:${clothes[config.look.color]}"></i>`;
    name.value=config.name;build.value=config.build;style.value=config.style;aura.value=config.aura;
    root.querySelectorAll<HTMLSelectElement>('[data-appearance]').forEach(e=>{e.value=config.look[e.dataset.appearance as keyof CharacterLook];});
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(e=>e.classList.toggle('active',e.dataset.gender===config.gender));
    graphics?.update(config);
  };
  const changed=()=>{dirty=true;root.dataset.rbIdentitySync='dirty';report(identityReady?'Unsaved changes • save to Rich ID':'Unsaved configuration • reconnect Rich ID to save');renderConfig();};
  const read=async()=>{
    if(reading||saving)return;reading=true;controls();report('Reading Rich ID…');
    try{identity=await readCharacterIdentity(user.id,signal);if(!current())return;identityReady=true;if(!dirty){config=savedCharacter(identity);dirty=!hasSavedOriginal(identity);renderConfig();}$('#acIdentityName').textContent=identity.profile.display_name??identity.profile.username??config.name;root.dataset.rbStudioIdentity='loaded';report(dirty?'Ready to save configuration':'Saved character loaded');}
    catch(error){if(current()){identityReady=false;root.dataset.rbStudioIdentity='unavailable';report(error instanceof Error?error.message:'Identity read failed');}}
    finally{reading=false;if(current())controls();}
  };
  const save=async(enter=false)=>{
    if(!identityReady||reading||saving)return;saving=true;controls();report('Saving character to Rich ID…');
    try{identity=await saveCharacterIdentity(user.id,{...config,look:{...config.look}},identity);if(!current())return;dirty=false;root.dataset.rbIdentitySync='verified';report('VERIFIED • Rich ID, character and loadout match');if(enter)location.assign('/avatar.html');}
    catch(error){if(current()){root.dataset.rbIdentitySync='failed';report(error instanceof Error?error.message:'Save failed');}}
    finally{saving=false;if(current())controls();}
  };
  const pause=(reason='Graphics paused • configuration remains editable')=>{
    graphicsGeneration++;graphicsLoading=false;graphicsFrame=false;graphics?.dispose();graphics=null;const replacement=document.createElement('canvas');replacement.id='characterCanvas';replacement.hidden=true;replacement.dataset.rbRenderState='paused';canvas.replaceWith(replacement);canvas=replacement;preview.hidden=false;visualReport(reason);controls();
  };
  const enable=async()=>{
    if(graphics||graphicsLoading)return;const generation=++graphicsGeneration;graphicsLoading=true;graphicsFrame=false;controls();visualReport('Opening 3D engine…');
    try{const {createStudioGraphics}=await import('./avatar.graphics');if(!current()||generation!==graphicsGeneration)return;canvas.hidden=false;preview.hidden=true;
      graphics=createStudioGraphics(canvas,config,()=>{if(current()&&generation===graphicsGeneration&&!graphicsFrame){graphicsFrame=true;canvas.dataset.rbRenderState='frame-rendered';visualReport('3D ready • original stylized character');controls();}},reason=>{if(current()&&generation===graphicsGeneration)queueMicrotask(()=>{if(current()&&generation===graphicsGeneration)pause('3D stopped: '+reason+'. Your Rich ID is still available.');});});
    }catch(error){if(current()&&generation===graphicsGeneration)pause('3D unavailable: '+(error instanceof Error?error.message:'graphics startup failed')+'. You can still save.');}
    finally{if(generation===graphicsGeneration){graphicsLoading=false;controls();}}
  };
  start.onclick=()=>void enable();stop.onclick=()=>pause();retry.onclick=()=>void read();
  saveButtons.forEach(b=>b.onclick=()=>void save(b.id==='acSaveEnter'));
  name.oninput=()=>{config.name=name.value;dirty=true;$('#acPreviewName').textContent=name.value;report(identityReady?'Unsaved changes • save to Rich ID':'Reconnect Rich ID to save');};
  build.onchange=()=>{config.build=build.value;changed();};style.onchange=()=>{config.style=style.value;config.look=normalizeLook({...config.look,...presets[style.value]});changed();};aura.onchange=()=>{config.aura=aura.value;changed();};
  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(b=>b.onclick=()=>{config.gender=b.dataset.gender==='girl'?'girl':'boy';changed();});
  root.querySelectorAll<HTMLSelectElement>('[data-appearance]').forEach(e=>e.onchange=()=>{config.look=normalizeLook({...config.look,[e.dataset.appearance!]:e.value});changed();});
  $<HTMLButtonElement>('#randomize').onclick=()=>{config.look=normalizeLook(Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,values])=>[key,values[Math.floor(Math.random()*values.length)]])));changed();};
  root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.onclick=()=>{graphics?.motion(b.dataset.motion as AvatarMotion);visualReport('Motion: '+b.dataset.motion);});
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{switch(b.dataset.view){case 'front':graphics?.reset();break;case 'back':graphics?.reset();graphics?.rotate(Math.PI);break;case 'out':graphics?.zoom(-.15);break;case 'in':graphics?.zoom(.15);break;case 'face':graphics?.face(true);break;case 'body':graphics?.face(false);break;case 'reset':graphics?.reset();break;}});
  root.querySelector<HTMLAnchorElement>('.ac-direct-lobby')!.onclick=e=>{if(dirty||saving){e.preventDefault();report('Unsaved configuration. Use SAVE & ENTER.');}};
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();},{signal});
  renderConfig();controls();await read();
}
