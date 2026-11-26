import {getAuthSnapshot} from '../../core/auth/auth-store';
import {CHARACTER_OPTIONS,SCULPT_FIELDS,normalizeLook,type CharacterLook} from './avatar.character.config';
import {readCharacterIdentity,saveCharacterIdentity,savedCharacter,hasSavedOriginal,type CharacterIdentity,type CharacterConfig} from './avatar.identity';
import type {StudioGraphics} from './avatar.graphics';
import type {AvatarMotion,AvatarExpression} from './avatar.skinned.runtime';
import {publishSectionUpdate} from '../../core/section-update/runtime';
import {getExperience,setExperience,subscribeExperience,experienceLabel,type VisualMode,type BehaviorMode} from '../../core/experience/policy';
import './avatar.characters.css';

const OWNER='rich-bizness-avatar-characters-v1',RELEASE='avatar-visual-integration-19';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const emptyIdentity=():CharacterIdentity=>({profile:{},avatar:{},loadout:{},controller:{},model:{}});
type Host=Window&{__rbPageCleanup?:()=>void};
const presets:Record<string,Partial<CharacterLook>>={street:{outfit:'casual'},boss:{outfit:'formal'},tactical:{outfit:'workwear'},cyber:{outfit:'sport'}};
const archetypes:Record<string,Partial<CharacterLook>>={
  'Metro':{face:'angular',jaw:'square',headWidth:'0',cheekVolume:'-20',chinProminence:'20',eyeSpacing:'0',noseBridge:'20',mouthDepth:'0',shoulders:'20',waist:'-20'},
  'Icon':{face:'soft',jaw:'balanced',headWidth:'-20',cheekVolume:'20',chinProminence:'0',eyeSpacing:'20',noseBridge:'-20',mouthDepth:'20',shoulders:'0',waist:'0'},
  'Titan':{face:'strong',jaw:'square',headWidth:'20',cheekVolume:'0',chinProminence:'40',eyeSpacing:'-20',noseBridge:'20',mouthDepth:'0',shoulders:'40',waist:'-20'},
  'Nova':{face:'angular',jaw:'narrow',headWidth:'-20',cheekVolume:'-20',chinProminence:'-20',eyeSpacing:'20',noseBridge:'0',mouthDepth:'-20',shoulders:'-20',waist:'-20'}
};
const optionLabels:Record<string,string>={fade:'Short textured',curls:'Afro',braids:'Braided',long:'Long straight',bald:'Shaved',hazel:'Light brown','high-tops':'Shoe style 2',boots:'Shoe style 3',sneakers:'Shoe style 1',sport:'Sport / casual',workwear:'Work / casual'};
const groups=[
  {title:'Hair & complexion',keys:['skin','skinFinish','maturity','hair','hairColor']},
  {title:'Face sculpt',keys:['face','jaw','nose','mouth','eyeShape','eyes','brows','browStyle']},
  {title:'Physique',keys:['height','weight','stance']},
  {title:'Wardrobe',keys:['outfit','shoes','hat','wristwear']}
] as const;
const label=(s:string)=>optionLabels[s]??s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/-/g,' ');
const swatches:Record<string,string>={deep:'#754631',warm:'#ad7352',tan:'#c88f68',light:'#e5b294',black:'#1a1412','dark-brown':'#34251e',brown:'#69452b',blond:'#b89b67',silver:'#a6a3a2',hazel:'#9a783c',blue:'#779dbd'};
const pickers=()=>groups.map((group,i)=>`<details class="ac-picker" data-category="${i}" ${i===0?'open':''}><summary>${group.title}</summary><div class="ac-choice-grid">${group.keys.map(key=>`<fieldset><legend>${label(key)}</legend><div class="ac-choices">${CHARACTER_OPTIONS[key].map(value=>`<button type="button" data-look-key="${key}" data-look-value="${value}" aria-pressed="false">${(['skin','hairColor','eyes'].includes(key)&&swatches[value])?`<i class="ac-swatch" style="background:${swatches[value]}"></i>`:''}<span>${label(value)}</span></button>`).join('')}</div></fieldset>`).join('')}</div></details>`).join('');


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
  <section class="ac-layout"><div class="ac-stage"><div class="ac-viewport" id="acViewport"><div id="acConfigPreview" class="ac-config-preview"><small>CHARACTER CONFIGURATION</small><div class="ac-preview-emblem">RB</div><strong id="acPreviewName">Rich Avatar</strong><span id="acPreviewDetails"></span><div id="acPreviewSwatches"></div><small>Load textured 3D human to inspect your selected appearance.</small></div><canvas id="characterCanvas" hidden></canvas></div>
  <div class="ac-stage-controls"><div class="ac-quick"><button id="acStartGraphics" class="primary" type="button">ENABLE 3D</button><button id="acStopGraphics" type="button" disabled hidden>PAUSE 3D</button><button data-view="body">BODY</button><button data-view="face">FACE</button></div><p id="acGraphicsStatus" role="status">Graphics paused • configuration mode</p><details class="ac-experience"><summary>Experience direction <span id="acExperienceSummary"></span></summary><div class="ac-experience-fields"><label>VISUAL TREATMENT<select id="acVisual"><option value="adaptive">Adaptive by environment</option><option value="cinematic">Cinematic</option><option value="expressive">Expressive</option><option value="fantasy">Fantasy lighting</option></select></label><label>BEHAVIOR<select id="acBehavior"><option value="manual">Manual</option><option value="contextual">Contextual</option><option value="guided">Guided + manual</option></select></label></div><p id="acBehaviorGuide"></p></details><div class="ac-expression-lab"><div class="section-title"><span>EXPRESSION LAB</span><small>LIVE FACE</small></div><div class="ac-expression-buttons">${['neutral','smile','focused','surprised','confident'].map((value,i)=>`<button type="button" data-expression="${value}" aria-pressed="${i===0}">${['Neutral','Smile','Focus','Surprise','Confidence'][i]}</button>`).join('')}</div><label class="ac-quality">RENDER DETAIL<select id="acQuality"><option value="auto">Adaptive • mobile safe</option><option value="detail">High detail • 2K + skin microtexture</option></select></label></div><details class="ac-motion-tools"><summary>Motion & gesture library</summary>
  <div class="ac-motion"><button data-motion="idle">IDLE</button><button data-motion="walk">WALK</button><button data-motion="run">RUN</button><button data-motion="jump">JUMP</button><button data-motion="power">POSE</button></div><div class="ac-gestures"><button data-gesture="wave">WAVE</button><button data-gesture="look around">LOOK AROUND</button><button data-gesture="nod">NOD</button><button data-gesture="stretch">STRETCH</button></div><div class="ac-camera"><button data-view="front">FRONT</button><button data-view="back">BACK</button><button data-view="out">−</button><button data-view="in">+</button><button data-view="reset">RESET</button></div></details>
  <div class="ac-actions"><button id="acSaveTop" class="primary">SAVE TO RICH ID</button><button id="acRetryIdentity" hidden>RETRY IDENTITY</button></div><p id="acSyncStatus" role="status">Reading Rich ID…</p><a class="ac-direct-lobby" href="/avatar.html" hidden>OPEN LIVING CITY</a><nav id="acJourneyLinks" class="ac-journey-links" hidden><a href="/avatar.html?district=personal">PERSONAL RESIDENCE</a><a href="/profile.html">VIEW RICH ID</a><a href="/meta.html">EXPLORE WORLDS</a></nav></div></div>
  <aside class="ac-editor"><div class="section-title"><span>CHARACTER LAB</span><small>HYBRID · V19</small></div><div class="seg"><button data-gender="boy">BOY</button><button data-gender="girl">GIRL</button></div><label>NAME<input id="nameInput" maxlength="28" autocomplete="off"></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><div class="section-title"><span>DESIGN YOUR IDENTITY</span><small>LIVE 3D</small></div><div class="ac-style-cards" aria-label="Style presets">${Object.keys(presets).map((key,i)=>`<button type="button" data-style="${key}"><i aria-hidden="true">${["◆","♛","⬡","✦"][i]}</i><strong>${["Street luxury","Executive","Utility","Sport tech"][i]}</strong><small>${["Casual fit","Tailored fit","Workwear","Athletic fit"][i]}</small></button>`).join("")}</div><div class="section-title"><span>RICH BIZNESS SCULPT PRESETS</span><small>4 SIGNATURE LOOKS</small></div><div class="ac-archetypes">${Object.keys(archetypes).map((key,i)=>`<button type="button" data-archetype="${key}"><strong>${key}</strong><small>${["Angular street","Soft editorial","Power build","Sleek futuristic"][i]}</small></button>`).join("")}</div><nav class="ac-category-tabs" aria-label="Appearance categories">${groups.map((g,i)=>`<button type="button" data-tab="${i}" aria-pressed="${i===0}">${g.title}</button>`).join("")}</nav>${pickers()}<details class="ac-sculpt"><summary>Precision sculpt · ${SCULPT_FIELDS.length} anatomical controls</summary><p>Fine-tune the actual human mesh. Release a slider to apply. Zero preserves the selected base face or physique.</p>${SCULPT_FIELDS.map(key=>`<label>${label(key)} <output data-sculpt-readout="${key}">0</output><input type="range" min="-100" max="100" step="20" value="0" data-sculpt="${key}"></label>`).join('')}</details><p class="ac-asset-note">Wardrobe uses fitted full outfits. Fitted outfit sets, six shoe choices, hats and rig-mounted wristwear. Separate garment layers, tattoos and chains still need compatible assets.</p><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus" role="status">Connecting identity…</p><small class="ac-release">STUDIO RELEASE • ${RELEASE}</small></aside></section></main>`;
  const $=<T extends HTMLElement>(sel:string)=>root.querySelector<T>(sel)!;
  let canvas=$<HTMLCanvasElement>('#characterCanvas');const preview=$('#acConfigPreview');
  const name=$<HTMLInputElement>('#nameInput'),build=$<HTMLSelectElement>('#buildInput'),style=$<HTMLSelectElement>('#styleInput'),aura=$<HTMLSelectElement>('#auraInput');
  const saveButtons=['#acSaveEnter','#acSaveTop','#saveCharacter'].map(s=>$<HTMLButtonElement>(s));
  const editControls=[...root.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.ac-editor input,.ac-editor select,[data-gender],[data-look-key],#randomize,[data-style],[data-archetype]')];
  const start=$<HTMLButtonElement>('#acStartGraphics'),stop=$<HTMLButtonElement>('#acStopGraphics'),retry=$<HTMLButtonElement>('#acRetryIdentity');
  const motionControls=[...root.querySelectorAll<HTMLButtonElement>('[data-motion],[data-gesture],[data-view],[data-expression],#acQuality')];
  const renderExperience=()=>{const value=getExperience();$<HTMLSelectElement>('#acVisual').value=value.visual;$<HTMLSelectElement>('#acBehavior').value=value.behavior;$('#acExperienceSummary').textContent=experienceLabel(value.visual,'avatar-characters');$('#acBehaviorGuide').textContent=value.behavior==='manual'?'You choose expressions and movement.':value.behavior==='contextual'?'Your explicit movement actions drive facial reactions.':'Choose a movement to see a reaction. Save Rich ID, then explore the district or worlds. Scripted guidance; no autonomous AI.';};
  $<HTMLSelectElement>('#acVisual').onchange=e=>setExperience({visual:(e.currentTarget as HTMLSelectElement).value as VisualMode});
  $<HTMLSelectElement>('#acBehavior').onchange=e=>setExperience({behavior:(e.currentTarget as HTMLSelectElement).value as BehaviorMode});
  const stopExperience=subscribeExperience(renderExperience);signal.addEventListener('abort',stopExperience,{once:true});renderExperience();
  const report=(s:string)=>{$('#acSyncStatus').textContent=s;$('#saveStatus').textContent=s;};
  const visualReport=(s:string)=>{$('#acGraphicsStatus').textContent=s;};
  const controls=()=>{for(const b of saveButtons)b.disabled=saving||reading||!identityReady;for(const e of editControls)e.disabled=saving||reading;retry.disabled=reading||saving;retry.hidden=identityReady;start.disabled=graphicsLoading||!!graphics;start.hidden=!!graphics;stop.hidden=!graphics&&!graphicsLoading;stop.disabled=!graphics&&!graphicsLoading;root.querySelector<HTMLAnchorElement>('.ac-direct-lobby')!.hidden=dirty||!identityReady;$('#acJourneyLinks').hidden=dirty||saving||!identityReady;for(const b of motionControls)b.disabled=!graphics||!graphicsFrame;};
  const renderConfig=()=>{
    $('#acPreviewName').textContent=config.name;
    $('#acPreviewDetails').textContent=[config.gender,config.build,config.look.hair,config.look.outfit,config.look.shoes,config.aura].map(v=>v.toUpperCase()).join(' · ');
    const skin:Record<string,string>={deep:'#754631',warm:'#ad7352',tan:'#c88f68',light:'#e5b294'},clothes:Record<string,string>={emerald:'#285b48',onyx:'#20252a',gold:'#ae803b',ice:'#587f91'};
    $('#acPreviewSwatches').innerHTML=`<i style="background:${skin[config.look.skin]}"></i><i style="background:${clothes[config.look.color]}"></i>`;
    name.value=config.name;build.value=config.build;style.value=config.style;aura.value=config.aura;
    root.querySelectorAll<HTMLButtonElement>('[data-look-key]').forEach(e=>{const selected=config.look[e.dataset.lookKey as keyof CharacterLook]===e.dataset.lookValue;e.classList.toggle('active',selected);e.setAttribute('aria-pressed',String(selected));});
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(e=>e.classList.toggle('active',e.dataset.gender===config.gender));
    root.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(b=>{const selected=b.dataset.style===config.style;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    root.querySelectorAll<HTMLInputElement>('[data-sculpt]').forEach(el=>{el.value=config.look[el.dataset.sculpt as keyof CharacterLook];const out=root.querySelector<HTMLOutputElement>('[data-sculpt-readout="'+el.dataset.sculpt+'"]');if(out)out.value=el.value;});
    graphics?.update(config);
  };
  const changed=()=>{dirty=true;root.dataset.rbIdentitySync='dirty';report(identityReady?'Unsaved changes • save to Rich ID':'Unsaved configuration • reconnect Rich ID to save');renderConfig();controls();};
  const read=async()=>{
    if(reading||saving)return;reading=true;controls();report('Reading Rich ID…');
    try{identity=await readCharacterIdentity(user.id,signal);if(!current())return;identityReady=true;if(!dirty){config=savedCharacter(identity);dirty=!hasSavedOriginal(identity);renderConfig();}$('#acIdentityName').textContent=identity.profile.display_name??identity.profile.username??config.name;root.dataset.rbStudioIdentity='loaded';report(dirty?'Ready to save configuration':'Saved character loaded');}
    catch(error){if(current()){identityReady=false;root.dataset.rbStudioIdentity='unavailable';report(error instanceof Error?error.message:'Identity read failed');}}
    finally{reading=false;if(current())controls();}
  };
  const save=async(enter=false)=>{
    if(!identityReady||reading||saving)return;saving=true;controls();report('Saving character to Rich ID…');
    try{identity=await saveCharacterIdentity(user.id,{...config,look:{...config.look}},identity);if(!current())return;dirty=false;root.dataset.rbIdentitySync='verified';report('VERIFIED • Rich ID, character and loadout match');publishSectionUpdate('avatar-characters');if(enter)location.assign('/avatar.html?district=personal');}
    catch(error){if(current()){root.dataset.rbIdentitySync='failed';report(error instanceof Error?error.message:'Save failed');}}
    finally{saving=false;if(current())controls();}
  };
  const pause=(reason='Graphics paused • configuration remains editable')=>{
    graphicsGeneration++;$<HTMLSelectElement>('#acQuality').value='auto';root.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.expression==='neutral')));graphicsLoading=false;graphicsFrame=false;graphics?.dispose();graphics=null;const replacement=document.createElement('canvas');replacement.id='characterCanvas';replacement.hidden=true;replacement.dataset.rbRenderState='paused';canvas.replaceWith(replacement);canvas=replacement;preview.hidden=false;visualReport(reason);controls();
  };
  const enable=async()=>{
    if(graphics||graphicsLoading)return;const generation=++graphicsGeneration;graphicsLoading=true;graphicsFrame=false;controls();visualReport('Loading textured human mesh and fitted wardrobe…');
    try{const {createStudioGraphics}=await import('./avatar.graphics');if(!current()||generation!==graphicsGeneration)return;canvas.hidden=false;preview.hidden=true;
      graphics=createStudioGraphics(canvas,config,()=>{if(current()&&generation===graphicsGeneration&&!graphicsFrame){graphicsFrame=true;canvas.dataset.rbRenderState='frame-rendered';visualReport('Live character • capture-assisted motion');controls();}},reason=>{if(current()&&generation===graphicsGeneration)queueMicrotask(()=>{if(current()&&generation===graphicsGeneration)pause('3D stopped: '+reason+'. Your Rich ID is still available.');});});
    }catch(error){if(current()&&generation===graphicsGeneration)pause('3D unavailable: '+(error instanceof Error?error.message:'graphics startup failed')+'. You can still save.');}
    finally{if(generation===graphicsGeneration){graphicsLoading=false;controls();}}
  };
  root.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(b=>b.onclick=()=>{root.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));graphics?.expression(b.dataset.expression as AvatarExpression);});
  $<HTMLSelectElement>('#acQuality').onchange=e=>{const value=(e.currentTarget as HTMLSelectElement).value==='detail'?'detail':'auto';graphics?.quality(value);};
  root.querySelectorAll<HTMLInputElement>('[data-sculpt]').forEach(el=>{el.oninput=()=>{const out=root.querySelector<HTMLOutputElement>('[data-sculpt-readout="'+el.dataset.sculpt+'"]');if(out)out.value=el.value;};el.onchange=()=>{config.look=normalizeLook({...config.look,[el.dataset.sculpt!]:el.value});changed();graphics?.face(!['shoulders','waist','neckWidth','chest','hips'].includes(el.dataset.sculpt??''));};});
  start.onclick=()=>void enable();stop.onclick=()=>pause();retry.onclick=()=>void read();
  saveButtons.forEach(b=>b.onclick=()=>void save(b.id==='acSaveEnter'));
  name.oninput=()=>{config.name=name.value;dirty=true;$('#acPreviewName').textContent=name.value;report(identityReady?'Unsaved changes • save to Rich ID':'Reconnect Rich ID to save');controls();};
  build.onchange=()=>{config.build=build.value;changed();};style.onchange=()=>{config.style=style.value;config.look=normalizeLook({...config.look,...presets[style.value]});changed();};aura.onchange=()=>{config.aura=aura.value;changed();};
  root.querySelectorAll<HTMLButtonElement>('[data-archetype]').forEach(b=>b.onclick=()=>{config.look=normalizeLook({...config.look,...archetypes[b.dataset.archetype!]});changed();graphics?.face(true);});
  root.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(b=>b.onclick=()=>{const key=b.dataset.style!;config.style=key;config.look=normalizeLook({...config.look,...presets[key]});changed();graphics?.face(false);});
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));root.querySelectorAll<HTMLDetailsElement>('[data-category]').forEach(d=>{d.hidden=d.dataset.category!==b.dataset.tab;d.open=!d.hidden;});graphics?.face(b.dataset.tab==='0'||b.dataset.tab==='1');});
  root.querySelectorAll<HTMLDetailsElement>('[data-category]').forEach(d=>{d.hidden=d.dataset.category!=='0';});
  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(b=>b.onclick=()=>{config.gender=b.dataset.gender==='girl'?'girl':'boy';changed();});
  root.querySelectorAll<HTMLButtonElement>('[data-look-key]').forEach(e=>e.onclick=()=>{config.look=normalizeLook({...config.look,[e.dataset.lookKey!]:e.dataset.lookValue});changed();if(['face','jaw','nose','mouth','eyeShape','brows','browStyle','eyes','hair','hairColor','skin','skinFinish','maturity','hat'].includes(e.dataset.lookKey??''))graphics?.face(true);else if(['height','weight','stance','outfit','shoes','wristwear'].includes(e.dataset.lookKey??''))graphics?.face(false);});
  $<HTMLButtonElement>('#randomize').onclick=()=>{config.look=normalizeLook({...config.look,...Object.fromEntries(groups.flatMap(group=>group.keys.map(key=>{const values=CHARACTER_OPTIONS[key];return [key,values[Math.floor(Math.random()*values.length)]];})))});changed();};
  root.querySelectorAll<HTMLButtonElement>('[data-gesture]').forEach(b=>b.onclick=()=>{graphics?.gesture(b.dataset.gesture!);visualReport('Gesture: '+b.dataset.gesture);});
  root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.onclick=()=>{graphics?.motion(b.dataset.motion as AvatarMotion);visualReport('Motion: '+b.dataset.motion);});
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{switch(b.dataset.view){case 'front':graphics?.reset();break;case 'back':graphics?.reset();graphics?.rotate(Math.PI);break;case 'out':graphics?.zoom(-.15);break;case 'in':graphics?.zoom(.15);break;case 'face':graphics?.face(true);break;case 'body':graphics?.face(false);break;case 'reset':graphics?.reset();break;}});
  root.querySelector<HTMLAnchorElement>('.ac-direct-lobby')!.onclick=e=>{if(dirty||saving){e.preventDefault();report('Unsaved configuration. Use SAVE & ENTER.');}};
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();},{signal});
  renderConfig();controls();await read();
}
