import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import {
  disposeSkinnedAvatar,
  loadSkinnedAvatar,
  qualityProfile,
  resolveAvatarModelUrl,
  setAvatarMotion,
  updateSkinnedAvatar,
  type AvatarGender,
  type AvatarMotion,
  type SkinnedAvatarRuntime
} from './avatar.skinned.runtime';
import { CHARACTER_RIG, CHARACTER_OPTIONS, normalizeLook, createOriginalAvatar, type CharacterLook } from './avatar.original.runtime';
import './avatar.characters.css';

type Snapshot = {
  profile?: Record<string, any>;
  avatar?: Record<string, any>;
  loadout?: Record<string, any>;
  model?: Record<string, any>;
};
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
const RELEASE = "avatar-original-system-6";
const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
const auraColor = (aura: string) => aura === 'Neon Phantom' ? 0x765dff : aura === 'Diamond Mist' ? 0x76d8ff : 0x21df81;

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let runtime: SkinnedAvatarRuntime | null = null;
  let raf = 0;
  let resize = () => {};
  let releaseStage = () => {};
  let modelAbort: AbortController | null = null;
  const abort = new AbortController();
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    modelAbort?.abort();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (runtime) { disposeSkinnedAvatar(runtime); runtime = null; }
    releaseStage();
    renderer?.dispose();
    renderer = null;
    const host = window as CleanupHost;
    if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null;
  };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  const user = getAuthSnapshot().user;
  if (!user) { location.replace('/tap-in.html?next=%2Favatar-characters.html'); return; }
  root.innerHTML='<main class="ac-shell"><p role="status">Opening your Avatar Studio…</p></main>';
  const snapshotAbort=new AbortController();
  abort.signal.addEventListener('abort',()=>snapshotAbort.abort(),{once:true});
  let snapshotTimer=0;
  let data:unknown=null;
  let snapshotFailure=false;
  try {
    const request=supabase.rpc('rb_avatar_runtime_snapshot',{}).abortSignal(snapshotAbort.signal);
    const result=await Promise.race([request,new Promise<null>(resolve=>{
      snapshotTimer=window.setTimeout(()=>{snapshotAbort.abort();resolve(null);},6500);
    })]);
    snapshotFailure=!result||!!result.error;
    data=result?.data??null;
    if(snapshotFailure)console.warn('[Avatar Studio] Identity snapshot unavailable; reference view only.');
  } catch { snapshotFailure=true; }
  finally { clearTimeout(snapshotTimer); }
  if (!isCurrent()) return;

  const snap = (snapshotFailure ? {} : (data ?? {})) as Snapshot;
  const current = snap.avatar ?? {};
  const loadout = snap.loadout ?? {};
  const outfit = loadout.outfit_config ?? current.metadata?.outfit ?? {};
  const display = String(current.display_name ?? loadout.display_name ?? snap.profile?.display_name ?? snap.profile?.username ?? 'Rich Avatar');
  const currentKind = String(current.character_type ?? 'male');
  let gender: AvatarGender = currentKind === 'female' ? 'girl' : 'boy';
  const initialBuild = String(outfit.build ?? 'athletic');
  const initialStyle = String(outfit.style ?? 'street');
  let look=normalizeLook(outfit.appearance);
  const appearanceFields=Object.entries(CHARACTER_OPTIONS).map(([key,values])=>`<label>${key.toUpperCase()}<select data-appearance="${key}">${values.map(value=>`<option value="${value}" ${look[key as keyof CharacterLook]===value?'selected':''}>${value.toUpperCase()}</option>`).join('')}</select></label>`).join('');
  const initialAura = String(current.aura ?? loadout.aura_config?.name ?? 'Emerald Gold');

  root.dataset.rbStudioRelease=RELEASE;
  root.innerHTML = `<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS CHARACTER GARAGE</small><h1>Avatar Studio</h1></div><a href="/avatar.html" class="enter">ENTER LOBBY</a></header><div class="ac-system-bar"><div><small>RICH ID • STUDIO</small><strong>${esc(display)}</strong></div><div id="acXpSlot"></div><div id="acOmniSlot"></div></div><section class="ac-layout"><div class="ac-stage"><div class="ac-viewport"><canvas id="characterCanvas"></canvas><div class="ac-stage-top"><span>SKINNED FULL BODY</span><b id="previewGender">${gender.toUpperCase()}</b></div><div class="ac-stage-copy"><strong id="previewName">${esc(display)}</strong><em id="previewStyle">${esc(initialBuild.toUpperCase())} · ${esc(initialStyle.toUpperCase())}</em></div><div class="ac-loading" id="characterLoading">LOADING CHARACTER…</div></div><div class="ac-stage-controls"><div class="ac-motion"><button data-motion="idle" class="active">IDLE</button><button data-motion="walk">WALK</button><button data-motion="run">RUN</button><button data-motion="jump">JUMP</button><button data-motion="power">POSE</button></div><div class="ac-camera"><button type="button" id="acFront">FRONT</button><button type="button" id="acBack">BACK</button><button type="button" id="acZoomOut" aria-label="Zoom out">−</button><button type="button" id="acZoomIn" aria-label="Zoom in">+</button><button type="button" id="acReset">RESET</button></div><small id="acMotionStatus" role="status">Drag to rotate • Zoom to inspect</small></div></div><aside class="ac-editor"><div class="section-title"><span>CHARACTER LAB</span><small>BUILD · STYLE · FX</small></div><div class="seg"><button data-gender="boy" class="${gender === 'boy' ? 'active' : ''}">BOY</button><button data-gender="girl" class="${gender === 'girl' ? 'active' : ''}">GIRL</button></div><label>NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><div class="section-title"><span>APPEARANCE</span><small>ORIGINAL CHARACTER</small></div><div class="ac-appearance">${appearanceFields}</div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">${snapshotFailure ? 'Saved identity unavailable. Reference view only; no changes will be saved.' : 'Save once the character, motion and proportions look right.'}</p>${snapshotFailure ? '<button type="button" id="acRetryIdentity">Retry saved identity</button>' : ''}<small class="ac-release">STUDIO RELEASE • ${RELEASE}</small></aside></section></main>`;

  root.querySelector<HTMLButtonElement>('#acRetryIdentity')?.addEventListener('click',()=>location.reload());
  root.dataset.rbStudioIdentity=snapshotFailure?'unavailable':'loaded';
  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!;
  const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!;
  const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!;
  const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!;
  buildInput.value = ['athletic','lean','heroic'].includes(initialBuild) ? initialBuild : 'athletic';
  styleInput.value = ['street','boss','tactical','cyber'].includes(initialStyle) ? initialStyle : 'street';
  auraInput.value = ['Emerald Gold','Neon Phantom','Diamond Mist'].includes(initialAura) ? initialAura : 'Emerald Gold';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081910);
  scene.fog = new THREE.Fog(0x081910, 9, 23);
  const camera = new THREE.PerspectiveCamera(34, 1, .08, 70);
  camera.position.set(0, 1.26, 4.4);
  const quality = qualityProfile();
  const loading=root.querySelector<HTMLElement>('#characterLoading')!;
  const saveButton=root.querySelector<HTMLButtonElement>('#saveCharacter')!;
  saveButton.disabled=true;
  const stageMessage=(state:string,message:string)=>{
    canvas.dataset.rbRenderState=state;loading.textContent=message;loading.hidden=false;
  };
  const mobile=matchMedia('(max-width:860px), (pointer:coarse)').matches;
  let contextLost=false;
  let stageDirty=true;
  let lastFailure='';
  const recoveryMessage=(state:string,message:string)=>{stageMessage(state,message);saveButton.disabled=true;};
  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'low-power',alpha:false});
    renderer.setPixelRatio(Math.min(quality.dpr,mobile?1:1.5));
  } catch (error) { console.warn('[Avatar Studio] WebGL init',error); renderer?.dispose();renderer=null; recoveryMessage('unavailable','3D graphics unavailable on this device. Reload to retry; Profile and Portal remain available.'); return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xe3f4eb, 0x28452f, 2.2));
  const key = new THREE.DirectionalLight(0xffe3ac, 2.9);
  key.position.set(5, 9, 5);
  key.castShadow = !mobile;
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x79e8ad, 1.8);
  fill.position.set(-5, 4, 3);
  scene.add(fill);
  const auraLight = new THREE.PointLight(auraColor(auraInput.value), 2.2, 7, 2);
  auraLight.position.set(-2, 1.4, 2.2);
  scene.add(auraLight);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 72), new THREE.MeshStandardMaterial({ color: 0x16291f, roughness: .66, metalness:.25 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.02;
  floor.receiveShadow = true;
  scene.add(floor);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0x0b1d14, roughness: .9 }));
  backWall.position.set(0, 2.15, -2.2);
  scene.add(backWall);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.06,.014,8,80),new THREE.MeshBasicMaterial({color:auraColor(auraInput.value)}));halo.rotation.x=-Math.PI/2;halo.position.y=.015;scene.add(halo);
  const innerHalo=new THREE.Mesh(new THREE.TorusGeometry(.88,.008,6,64),new THREE.MeshBasicMaterial({color:0xe6c679}));innerHalo.rotation.x=-Math.PI/2;innerHalo.position.y=.018;scene.add(innerHalo);
  camera.lookAt(0,.95,0);
  const onContextLost=(event:Event)=>{
    event.preventDefault();contextLost=true;modelAbort?.abort();cancelAnimationFrame(raf);saveButton.disabled=true;
    stageMessage('context-lost','Graphics paused. Reload Avatar Studio to recover.');
  };
  canvas.addEventListener('webglcontextlost',onContextLost);
  releaseStage=()=>{
    canvas.removeEventListener('webglcontextlost',onContextLost);
    floor.geometry.dispose();floor.material.dispose();backWall.geometry.dispose();backWall.material.dispose();halo.geometry.dispose();halo.material.dispose();innerHalo.geometry.dispose();innerHalo.material.dispose();key.shadow.dispose();
  };

  let motion: AvatarMotion = 'idle';
  let loadGeneration = 0;
  let userYaw = 0;
  let zoom=1;
  const setZoom=(value:number)=>{zoom=THREE.MathUtils.clamp(value,.8,1.65);camera.zoom=zoom;camera.updateProjectionMatrix();stageDirty=true;};
  const setYaw=(value:number)=>{userYaw=value;if(runtime)runtime.root.rotation.y=value;stageDirty=true;};
  root.querySelector<HTMLButtonElement>("#acFront")!.onclick=()=>setYaw(0);
  root.querySelector<HTMLButtonElement>("#acBack")!.onclick=()=>setYaw(Math.PI);
  root.querySelector<HTMLButtonElement>("#acZoomIn")!.onclick=()=>setZoom(zoom+.15);
  root.querySelector<HTMLButtonElement>("#acZoomOut")!.onclick=()=>setZoom(zoom-.15);
  root.querySelector<HTMLButtonElement>("#acReset")!.onclick=()=>{setYaw(0);setZoom(1);};
  let dragging = false;
  let dragStartX = 0;
  let dragStartYaw = 0;

  const modelSnapshotFor = (nextGender: AvatarGender) => {
    const modelBodyType = String(snap.model?.body_type ?? '').toLowerCase();
    const matches = (nextGender === 'girl' && modelBodyType === 'female') || (nextGender === 'boy' && modelBodyType === 'male');
    return matches ? snap as Record<string, any> : ({ model: null } as Record<string, any>);
  };

  const applyBuildScale = () => {
    if (!runtime) return;
    const xScale = buildInput.value === 'lean' ? .95 : buildInput.value === 'heroic' ? 1.035 : 1;
    runtime.root.scale.x = runtime.root.scale.y * xScale;
    runtime.root.updateMatrixWorld(true);
  };

  const materialColors=new Map<THREE.MeshStandardMaterial,THREE.Color>();
  const applyStylePreview=()=>{
    if(!runtime||canvas.dataset.rbModelState!=='reference-model')return;
    const tint=styleInput.value==='boss'?0xf3c95f:styleInput.value==='cyber'?0x7da8ff:styleInput.value==='tactical'?0x74897c:0xffffff;
    runtime.root.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      for(const mat of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){
        const m=mat as THREE.MeshStandardMaterial;if(!m.isMeshStandardMaterial)continue;
        if(!materialColors.has(m))materialColors.set(m,m.color.clone());
        m.color.copy(materialColors.get(m)!).multiply(new THREE.Color(tint));
      }
    });stageDirty=true;
  };
  const applyAura=()=>{const color=auraColor(auraInput.value);auraLight.color.setHex(color);halo.material.color.setHex(color);stageDirty=true;};
  const loadCharacter = async () => {
    const generation = ++loadGeneration;
    if(contextLost||disposed)return;
    modelAbort?.abort();
    const selectionAbort=new AbortController();modelAbort=selectionAbort;
    saveButton.disabled=true;canvas.dataset.rbModelState='loading';delete canvas.dataset.rbModelFailure;stageDirty=true;
    stageMessage('loading-model','Loading character…');
    if (runtime) {
      scene.remove(runtime.root);
      disposeSkinnedAvatar(runtime);
      materialColors.clear();
      runtime = null;
    }
    const model=modelSnapshotFor(gender).model;
    const approved=outfit.rig!==CHARACTER_RIG&&!snapshotFailure&&model?.is_active===true&&model?.is_realistic===true&&model?.rig_type==='skinned-humanoid'&&model?.metadata?.production_art_ready===true&&model?.metadata?.role!=='temporary-reference-skinned-model'&&!String(model?.model_key??'').startsWith('rb-skinned-');
    const timer=window.setTimeout(()=>{
      selectionAbort.abort();
      if(isCurrent()&&generation===loadGeneration&&!contextLost){
        canvas.dataset.rbModelState='unavailable';
        stageMessage('model-error','Character load timed out. Select a character to retry.');
      }
    },18000);
    try {
      let modelUrl=resolveAvatarModelUrl({model:null},gender);
      if(approved){
        const path=String(model.metadata?.asset_path??model.model_url??'').trim();
        if(!path)throw new Error('Approved character asset path is missing.');
        if(/^https:\/\//i.test(path))modelUrl=path;
        else{
          const signed=await supabase.storage.from('game-assets').createSignedUrl(path.replace(/^\/+/,''),3600);
          if(signed.error||!signed.data?.signedUrl)throw new Error('Approved character asset unavailable.');
          modelUrl=signed.data.signedUrl;
        }
      }
      if(selectionAbort.signal.aborted)throw new Error('Character load timed out.');
      const next=approved?await loadSkinnedAvatar({modelUrl,targetHeight:gender==='girl'?1.72:1.82,signal:selectionAbort.signal}):createOriginalAvatar(gender,look,buildInput.value);
      if (!isCurrent() || generation !== loadGeneration || contextLost || selectionAbort.signal.aborted) { disposeSkinnedAvatar(next); return; }
      runtime = next;
      // Preserve the grounded transform established by the loader.
      runtime.root.rotation.y = userYaw;
      if(approved)applyBuildScale();
      scene.add(runtime.root);
      setAvatarMotion(runtime, motion, 0);
      canvas.dataset.rbModelState=approved?'approved-model':'original-stylized';
      applyStylePreview();
      const poseButton=root.querySelector<HTMLButtonElement>('[data-motion="power"]')!;
      const hasPose=next.clips.some(clip=>/power|attack|dance|pose|action/i.test(clip.name));poseButton.disabled=!hasPose;poseButton.title=hasPose?'Play pose clip':'This asset has no pose animation';if(!hasPose&&motion==='power'){motion='idle';setAvatarMotion(next,'idle',0);root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(item=>item.classList.toggle('active',item.dataset.motion==='idle'));}
      canvas.dataset.rbRenderState='awaiting-frame';loading.hidden=true;
      root.querySelector<HTMLElement>('.ac-stage-top span')!.textContent=approved?'RICH BIZNESS CHARACTER':'RB ORIGINAL • STYLIZED V1';
      root.querySelector<HTMLElement>('#saveStatus')!.textContent=snapshotFailure?'Saved identity unavailable; saving is disabled.':approved?'Ready to save your approved character.':'Original stylized character. Save to use this appearance in your lobby.';
    } catch (error) {
      if(!isCurrent()||generation!==loadGeneration||contextLost)return;
      lastFailure=error instanceof Error?error.message:'Unknown model error';
      console.warn('[Avatar Studio] Model load',lastFailure);
      canvas.dataset.rbModelFailure=lastFailure.slice(0,160);
      canvas.dataset.rbModelState='unavailable';
      stageMessage('model-error',selectionAbort.signal.aborted?'Character load timed out. Select a character to retry.':'Character asset unavailable. Select a character to retry.');
    } finally {clearTimeout(timer);}
  };

  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((button) => {
    button.onclick = async () => {
      gender = button.dataset.gender === 'girl' ? 'girl' : 'boy';
      root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((item) => item.classList.toggle('active', item === button));
      root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase();
      await loadCharacter();
    };
  });

  root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach((button) => {
    button.onclick = () => {
      motion = (button.dataset.motion ?? 'idle') as AvatarMotion;
      root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach((item) => item.classList.toggle('active', item === button));
      if (runtime) {setAvatarMotion(runtime, motion);root.querySelector<HTMLElement>('#acMotionStatus')!.textContent='Motion: '+motion.toUpperCase()+' • '+(runtime.currentAction?.getClip().name??'unavailable');}
    };
  });

  buildInput.onchange = () => {
    if(canvas.dataset.rbModelState==='original-stylized')void loadCharacter();else applyBuildScale();
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
  };
  styleInput.onchange = () => {
    if(canvas.dataset.rbModelState==='original-stylized'){
      const presets:Record<string,Partial<CharacterLook>>={street:{top:'hoodie',pants:'cargo',shoes:'sneakers'},boss:{top:'jacket',pants:'tailored',shoes:'boots',gear:'chain'},tactical:{top:'vest',pants:'cargo',shoes:'boots'},cyber:{top:'vest',pants:'denim',shoes:'high-tops',color:'ice',gear:'shades'}};
      look=normalizeLook({...look,...presets[styleInput.value]});syncLook();void loadCharacter();
    }else applyStylePreview();
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
  };
  const syncLook=()=>root.querySelectorAll<HTMLSelectElement>('[data-appearance]').forEach(el=>{el.value=look[el.dataset.appearance as keyof CharacterLook];});
  root.querySelectorAll<HTMLSelectElement>('[data-appearance]').forEach(el=>el.onchange=()=>{look=normalizeLook({...look,[el.dataset.appearance!]:el.value});void loadCharacter();});
  auraInput.onchange = () => {
    applyAura();
  };
  nameInput.oninput = () => {
    root.querySelector<HTMLElement>('#previewName')!.textContent = nameInput.value || 'Rich Avatar';
  };

  root.querySelector<HTMLButtonElement>('#randomize')!.onclick = async () => {
    gender = Math.random() > .5 ? 'girl' : 'boy';
    buildInput.selectedIndex = Math.floor(Math.random() * buildInput.options.length);
    styleInput.selectedIndex = Math.floor(Math.random() * styleInput.options.length);
    auraInput.selectedIndex = Math.floor(Math.random() * auraInput.options.length);
    applyAura();
    look=normalizeLook(Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,values])=>[key,values[Math.floor(Math.random()*values.length)]])));syncLook();
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((item) => item.classList.toggle('active', item.dataset.gender === gender));
    root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase();
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
    await loadCharacter();
  };

  let saving=false;
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick = async () => {
    const status = root.querySelector<HTMLElement>('#saveStatus')!;
    if(saving)return;
    if(snapshotFailure||!runtime||contextLost||canvas.dataset.rbModelState!=='original-stylized'||canvas.dataset.rbRenderState!=='frame-rendered'){status.textContent='A rendered original character and verified identity are required before saving.';return;}
    saving=true;saveButton.disabled=true;
    status.textContent = 'Saving character…';
    const presetKey = gender === 'girl' ? 'street_queen_hd' : 'street_king_hd';
    try {
    const { data: saved, error: saveError } = await supabase.rpc('rb_save_avatar_studio', {
      p_display_name: nameInput.value || display,
      p_preset_key: presetKey,
      p_aura: auraInput.value,
      p_outfit: { ...outfit, build: buildInput.value, style: styleInput.value, rig: CHARACTER_RIG, appearance: {...look} },
      p_accessories: { ...(loadout.accessory_config??current.metadata?.accessories??{}) },
      p_smoke: { ...(loadout.smoke_config??current.metadata?.smoke??{mode:'off'}) },
      p_emotes: { ...(loadout.emote_config??{}), idle: true, walk: true, run: true, jump: true, power: true },
      p_character_type: gender === 'girl' ? 'female' : 'male'
    });
    if(!isCurrent())return;
    status.textContent = saveError ? saveError.message : (saved as any)?.saved===true?'Saved to Rich ID. Open the lobby to use this appearance.':'Save not confirmed. Retry before leaving.';
    }catch{if(isCurrent())status.textContent='Save interrupted. Retry.';}finally{saving=false;if(isCurrent())saveButton.disabled=snapshotFailure||canvas.dataset.rbModelState!=='original-stylized'||canvas.dataset.rbRenderState!=='frame-rendered';}
  };

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragStartX = event.clientX;
    dragStartYaw = userYaw;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    userYaw = dragStartYaw + (event.clientX - dragStartX) * .012;
    if (runtime) runtime.root.rotation.y = userYaw;
  });
  const stopDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);

  resize = () => {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    const limit=mobile?1152:2048;
    const scale=Math.min(1,limit/Math.max(rect.width,rect.height));
    renderer.setSize(Math.max(1,Math.round(rect.width*scale)),Math.max(1,Math.round(rect.height*scale)),false);
    camera.aspect = rect.width / rect.height;
    camera.position.z=4.4*Math.max(1,.63/camera.aspect);
    stageDirty=true;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const clock=new THREE.Clock();
  let lastFrame=0;
  const target=new THREE.Vector3(0,.95,0);
  const loop=(now=0)=>{
    if(disposed||!renderer||contextLost)return;
    raf=requestAnimationFrame(loop);
    if(document.hidden||now-lastFrame<(mobile?42:16)||(!runtime&&!stageDirty))return;
    lastFrame=now;
    const dt=Math.min(clock.getDelta(),.04);
    try {
      if (runtime) {
        updateSkinnedAvatar(runtime, dt);
        target.set(0,runtime.height*.52,0);
        camera.lookAt(target);
      }
      renderer.render(scene,camera);stageDirty=false;
      if(runtime&&canvas.dataset.rbRenderState==='awaiting-frame'){
        canvas.dataset.rbRenderState='frame-rendered';saveButton.disabled=saving||snapshotFailure||canvas.dataset.rbModelState!=='original-stylized';
      }
    } catch (error) {
      console.warn('[Avatar Studio] Frame failed',error);
      contextLost=true;cancelAnimationFrame(raf);saveButton.disabled=true;
      stageMessage('render-error','Graphics stopped. Reload Avatar Studio to recover.');
    }
  };
  raf=requestAnimationFrame(loop);
  void loadCharacter();
}
