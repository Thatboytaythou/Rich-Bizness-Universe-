import * as THREE from 'three';
import {createCharacterLightMap} from './avatar.light-map';
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
import {ELITE_COLLECTIONS,type Collection} from './avatar.elite.catalog';
import { createTexturedAvatar } from './avatar.textured.runtime';
import {getExperience,resolveVisual,subscribeExperience,type Experience} from '../../core/experience/policy';
import {readCharacterIdentity,savedCharacter,hasSavedOriginal} from './avatar.identity';
import {DISTRICTS,resolveDistrict,districtHref} from './world.catalog';
import {createDistrictScene,moveWithinWorld,nearbyAction,cameraClearance} from './world.scene';
import {createWorldPresence} from './world.presence';
import {readResidence,saveResidence,defaultResidence,mountRecordingConsole,type Residence} from './world.services';
import './avatar.lobby.css';

type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
type Snapshot = {
  profile?: Record<string, any>;
  avatar?: Record<string, any>;
  loadout?: Record<string, any>;
  model?: Record<string, any>;
  controller?: Record<string, any>;
};

const OWNER = 'rich-bizness-avatar-lobby-v1';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));

function disposeObject(root: THREE.Object3D): void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if(mesh.geometry)geometries.add(mesh.geometry);
    for (const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){if(!material)continue;materials.add(material);for(const v of Object.values(material))if((v as THREE.Texture|undefined)?.isTexture)textures.add(v as THREE.Texture);}
  });textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}

function addStreetWorld(scene: THREE.Scene): THREE.Group {
  const world = new THREE.Group();
  world.name = 'rb-avatar-street';
  // Original seamless asphalt surface, shared across the city instead of flat color.
  const surface=document.createElement('canvas');surface.width=surface.height=256;const ctx=surface.getContext('2d')!;ctx.fillStyle='#b5b5b5';ctx.fillRect(0,0,256,256);let seed=9137;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<7500;i++){const v=85+Math.floor(rand()*160);ctx.fillStyle='rgb('+v+','+v+','+v+')';ctx.fillRect(rand()*256,rand()*256,1+rand()*2,1+rand()*2);}const roadMap=new THREE.CanvasTexture(surface);roadMap.colorSpace=THREE.SRGBColorSpace;roadMap.wrapS=roadMap.wrapT=THREE.RepeatWrapping;roadMap.repeat.set(7,50);
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x40464a, roughness: .92,map:roadMap });
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0xa8b0ac, roughness: .9 });
  const curb = new THREE.MeshStandardMaterial({ color: 0xd1d6d2, roughness: .86 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf0cf52, roughness: .72 });
  const wallMats = [0x52636d, 0x62717a, 0x6e706c, 0x455e57].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .82 }));
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x84bed1, roughness: .22, metalness: .04, transparent: true, opacity: .7 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x252b2d, roughness: .48, metalness: .48 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe7a8 });
  const carMats = [0x183d58, 0x692c31, 0x2f5e42].map((color) => new THREE.MeshPhysicalMaterial({ color, roughness: .4, metalness: .18, clearcoat: .28 }));
  const tire = new THREE.MeshStandardMaterial({ color: 0x0b0d0d, roughness: .9 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 110), sidewalk);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -.08, -40);
  ground.receiveShadow = true;
  world.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 100), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -38);
  road.receiveShadow = true;
  world.add(road);

  for (const x of [-8.1, 8.1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3.8, .16, 100), curb);
    walk.position.set(x, .08, -38);
    walk.receiveShadow = true;
    world.add(walk);
  }

  for (const laneX of [-2.05, 2.05]) {
    for (let z = -82; z <= -5; z += 8) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(.11, .025, 2.4), stripeMat);
      dash.position.set(laneX, .018, z);
      world.add(dash);
    }
  }

  const blocks = [
    [-13, 7, -12, 6, 4.5], [13, 8, -15, 5.5, 5],
    [-15, 10, -25, 7, 5.5], [15, 12, -29, 6, 6],
    [-14, 13, -42, 6.5, 6], [14, 9, -45, 5, 5],
    [-16, 15, -59, 7, 6.5], [16, 14, -62, 6, 6],
    [-14, 11, -76, 6, 5], [14, 16, -78, 7, 6]
  ] as const;
  const windows:THREE.Matrix4[]=[],frames:THREE.Matrix4[]=[];const dummy=new THREE.Object3D();const record=(arr:THREE.Matrix4[],x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();arr.push(dummy.matrix.clone());};
  blocks.forEach(([x, h, z, w, d], index) => {
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[index % wallMats.length]);
    building.position.set(x, h / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    world.add(building);
    for(let y=1.8;y<h-.6;y+=1.35){for(let offset=-d/2+.65;offset<d/2-.35;offset+=1.1){const side=x+(x<0?w/2+.035:-w/2-.035);record(frames,side,y,z+offset,.13,.99,.91);record(windows,side+(x<0?.072:-.072),y,z+offset,.035,.86,.76);}}
    for(let y=1.25;y<h;y+=2.7){record(frames,x+(x<0?w/2+.08:-w/2-.08),y,z,.18,.085,d+.1);}
    record(frames,x,h+.16,z,w+.25,.32,d+.25);
  });

  // Two instanced batches replace hundreds of individually submitted façade pieces.
  const batch=(mat:THREE.Material,items:THREE.Matrix4[])=>{const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,items.length);items.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;world.add(mesh);};
  batch(new THREE.MeshStandardMaterial({color:0x263137,roughness:.61,metalness:.23}),frames);
  batch(new THREE.MeshStandardMaterial({color:0x538197,metalness:.48,roughness:.26,emissive:0x12232b,emissiveIntensity:.45}),windows);
  for (const z of [-14, -29, -44, -59, -74]) {
    for (const x of [-7.3, 7.3]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, 3.9, 10), poleMat);
      pole.position.set(x, 1.95, z);
      world.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.62, .05, .05), poleMat);
      arm.position.set(x + (x < 0 ? .28 : -.28), 3.78, z);
      world.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 8), glowMat);
      bulb.position.set(x + (x < 0 ? .57 : -.57), 3.76, z);
      world.add(bulb);
    }
  }

  const carPositions = [
    [-4.9, -17, 0], [4.9, -31, Math.PI], [-4.9, -50, 0], [4.9, -67, Math.PI]
  ] as const;
  carPositions.forEach(([x, z, rotation], index) => {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, .46, 3.3), carMats[index % carMats.length]);
    body.position.y = .47;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.38, .44, 1.5), glass);
    cabin.position.set(0, .83, -.08);
    car.add(cabin);
    for (const sx of [-.74, .74]) for (const sz of [-1.08, 1.08]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .17, 18), tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, .26, sz);
      car.add(wheel);
    }
    car.position.set(x, 0, z);
    car.rotation.y = rotation;
    world.add(car);
  });

  scene.add(world);
  return world;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  let renderer: THREE.WebGLRenderer | null = null;let lightMap:THREE.WebGLRenderTarget|undefined;
  let avatarRuntime: SkinnedAvatarRuntime | null = null;
  let world: THREE.Group | null = null;
  let raf = 0;
  let renderScale=1,averageFrame=32,frameSamples=0,lastAdapt=0,lastTelemetry=0;let resize = () => {};let observer:ResizeObserver|undefined;let stopExperience=()=>{};let stopLife=()=>{};
  const abort = new AbortController();
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();stopExperience();stopLife();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);observer?.disconnect();
    if (avatarRuntime) disposeSkinnedAvatar(avatarRuntime);
    if (world) disposeObject(world);
    lightMap?.dispose();renderer?.dispose();renderer?.forceContextLoss();
    const host = window as CleanupHost;
    if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null;
  };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  const district=resolveDistrict(new URLSearchParams(location.search).get('district')),definition=DISTRICTS[district];
  const user = getAuthSnapshot().user;
  if (!user) { location.replace('/tap-in.html?next='+encodeURIComponent(districtHref(district))); return; }
  let snap;
  try{snap=await readCharacterIdentity(user.id,abort.signal);}
  catch(error){if(isCurrent())root.innerHTML='<main class="al-shell"><header><h1>Rich ID unavailable</h1><a href="/avatar-characters.html">RETURN TO STUDIO</a></header><p>Saved character could not be loaded. Reopen the lobby to retry.</p></main>';return;}
  if(!isCurrent())return;
  const character=savedCharacter(snap);
  const {name,gender,aura,build,style}=character;
  const original=hasSavedOriginal(snap);
  let controller:Record<string,any>={};
  if(snap.loadout.controller_profile_id){
    const {data}=await supabase.from('avatar_controller_profiles').select('*').eq('id',snap.loadout.controller_profile_id).maybeSingle().abortSignal(abort.signal);
    controller=(data??{}) as Record<string,any>;
  }
  if(!isCurrent())return;
  const cameraConfig = controller.camera_config ?? {};
  const moveSpeed = Math.min(2.2,Math.max(1,Number(controller.move_speed ?? 2.2)));
  const sprintSpeed = Math.min(4.2,Math.max(2.5,Number(controller.sprint_speed ?? 4.2)));
  const jumpForce = Number(controller.jump_force ?? 6.8);
  const gravity = Number(controller.gravity ?? 18);
  const acceleration = Number(controller.acceleration ?? 20);
  const deceleration = Number(controller.deceleration ?? 16);
  const turnSpeed = Number(controller.turn_speed ?? 8);

  root.innerHTML = `<main class="al-shell"><header><h1>${definition.title}</h1><nav><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/avatar-characters.html#elite">ELITE</a><a href="/profile.html">PROFILE</a><a href="/meta.html">WORLDS</a></nav></header><div class="al-experience"><span id="alExperienceMode"></span><span id="alGuide" role="status" hidden></span><a href="/meta.html">World Exchange ↗</a></div><nav class="al-districts" aria-label="Travel between districts">${(Object.keys(DISTRICTS) as Array<keyof typeof DISTRICTS>).map(key=>`<a href="${districtHref(key)}" ${key===district?'aria-current="page"':''}>${DISTRICTS[key].title}</a>`).join("")}</nav><section class="al-play"><div class="al-hud"><span class="al-mode">${original?'RICH ID • SAVED':'UNSAVED DEFAULT • CUSTOMIZE'}</span><span class="al-aura">${esc(aura)}</span><small id="alPerformance" class="al-mode">Measuring render performance…</small><div id="alXpSlot"></div><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(character.look.collection==='none'?character.look.outfit.toUpperCase()+' OUTFIT':ELITE_COLLECTIONS[character.look.collection as Collection]?.title??'ELITE')}</em></div></div><div class="al-stage"><canvas id="lobbyCanvas"></canvas><div class="al-loading" id="avatarLoading">LOADING CHARACTER…</div></div><div class="al-camera-tools" aria-label="Camera control"><button type="button" data-camera="close" aria-pressed="true">CHARACTER</button><button type="button" data-camera="wide" aria-pressed="false">EXPLORE</button><button type="button" data-camera="turn">TURN VIEW</button></div><div class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">SPRINT</button><button data-action="power">POWER</button><button data-action="idle">RESET</button></div></div></section><section class="al-interaction" aria-label="District interactions"><div><small id="alWorldStatus">Connecting world entry…</small><h2 id="alActionTitle">Explore the environment</h2><p id="alActionDescription">${definition.description}</p></div><button id="alInteract" disabled type="button">MOVE TO A MARKER</button></section><section class="al-life" aria-label="World services"><div class="al-life-head"><small>RICH BIZNESS / WORLD LIFE</small><h2>${district==='personal'?'Residence controls':district==='creative'?'Creative services':'City services'}</h2></div>${district==='personal'?`<div class="al-residence"><label>Lighting<select id="rbResidenceLighting"><option value="daylight">Daylight</option><option value="evening">Evening</option></select></label><label>Furniture finish<select id="rbResidenceFinish"><option value="emerald">Emerald leather</option><option value="onyx">Onyx leather</option><option value="cognac">Cognac leather</option></select></label><button id="rbResidenceSave" disabled>SAVE RESIDENCE</button><p id="rbResidenceStatus" role="status">Reading your private settings…</p></div>`:`<label class="al-presence"><input type="checkbox" id="rbPresence">Share my in-world movement with other signed-in members</label><p id="rbPresenceStatus" role="status">Solo mode · movement not shared</p><p id="rbWayfinder" role="status">Choose a destination below to track its distance.</p><label>Destination<select id="rbTarget"><option value="">Nearest station</option>${definition.actions.map(a=>`<option value="${a.id}">${a.label}</option>`).join("")}</select></label>`}${district==='creative'?'<div id="rbRecording" class="al-recording"></div>':''}</section><div class="al-destinations">${definition.actions.filter(a=>a.href).map(a=>`<a href="${a.href}"><strong>${a.label}</strong><small>${a.description}</small></a>`).join("")}</div></main>`;

  const worldStatus=root.querySelector<HTMLElement>('#alWorldStatus')!;
  const interaction=root.querySelector<HTMLButtonElement>('#alInteract')!;
  let activeAction:typeof definition.actions[number]|undefined;
  let residence:Residence={...defaultResidence};let evening=false,residenceReady=false,residenceSaving=false;
  const canvas = root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  // Only the public catalog template is entered; personal room geometry is local to this session.
  void (async()=>{try{const {data,error}=await supabase.from('meta_worlds').select('id,access_type').eq('slug',definition.slug).eq('status','active').eq('access_type','public').maybeSingle().abortSignal(abort.signal);if(!isCurrent())return;if(error||!data){worldStatus.textContent='Catalog entry unavailable • local exploration';return;}if(!original){worldStatus.textContent='Preview identity • save a character to link visits';return;}const entered=await supabase.rpc('rb_enter_meta_world',{p_world_id:data.id}).abortSignal(abort.signal);if(!isCurrent())return;worldStatus.textContent=!entered.error&&(entered.data as any)?.entered===true?'Rich ID world entry confirmed':'World entry not confirmed • local exploration';}catch{if(isCurrent())worldStatus.textContent='World service unavailable • local exploration';}})();
  const quality = qualityProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c9d8);
  scene.fog = new THREE.Fog(0xa9c9d8, 32, 130);
  const camera = new THREE.PerspectiveCamera(THREE.MathUtils.clamp(Number(cameraConfig.fov ?? 48)||48,38,58), 1, .08, 180);
  const baseDistance = Math.min(5.8,Math.max(4.5, Number(cameraConfig.distance ?? 5.4)||5.4));
  let cameraMode:'close'|'wide'='close',cameraYaw=0;const cameraTools=root.querySelectorAll<HTMLButtonElement>('[data-camera]');
  const baseHeight = Math.min(2.5,Math.max(1.5, Number(cameraConfig.height ?? 2.2)||2.2));

  const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;
  const failure=(message:string)=>{cancelAnimationFrame(raf);stopLife();root.querySelector<HTMLElement>('#avatarLoading')?.remove();const panel=document.createElement('div');panel.className='al-loading';panel.setAttribute('role','status');panel.textContent=message+' ';const link=document.createElement('a');link.href='/avatar-characters.html';link.textContent='Return to Avatar Studio';panel.append(link);canvas.parentElement?.append(panel);root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>button.disabled=true);};
  try{renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: mobile?'low-power':'high-performance' });}catch{failure('3D graphics unavailable. Your saved Rich ID is unchanged.');return;}
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failure('3D graphics paused. Your saved Rich ID is unchanged.');},{signal:abort.signal,once:true});
  renderer.setPixelRatio(mobile?1:quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  try{lightMap=createCharacterLightMap(renderer);scene.environment=lightMap.texture;scene.environmentIntensity=.4;}catch{ /* direct lights remain available */ }
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemi=new THREE.HemisphereLight(0xf3fbff,0x5d675f,2.7);scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d9, 3.2);
  sun.position.set(8, 13, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 42;sun.shadow.bias=-.0002;sun.shadow.normalBias=.025;sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb8ddff, 1.4);
  fill.position.set(-7, 5, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x80ffc0, .7);
  rim.position.set(4, 4, -6);
  scene.add(rim);
  world=district==='city'?addStreetWorld(scene):new THREE.Group();if(district!=='city')scene.add(world);
  const districtScene=createDistrictScene(district);world.add(districtScene.group);
  let experience=getExperience();
  const applyExperience=(value:Experience)=>{experience=value;const mode=resolveVisual(value.visual,'avatar');canvas.dataset.rbVisualMode=mode;canvas.dataset.rbBehaviorMode=value.behavior;
    const fantasy=mode==='fantasy',expressive=mode==='expressive';
    (scene.background as THREE.Color).setHex(district==='city'?(fantasy?0x292645:expressive?0xc7dbe3:0xa9c9d8):(fantasy?0x211b32:0x141d19));(scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
    fill.intensity=1.15;fill.color.setHex(0xd2e1f0);sun.color.setHex(fantasy?0xc6b4ff:0xfff2d9);sun.intensity=fantasy?2.0:3.2;hemi.intensity=expressive?3.1:fantasy?1.6:2.5;rim.color.setHex(fantasy?0x9e86ff:0x80ffc0);rim.intensity=fantasy?3.1:.7;
    if(district==='personal'&&evening){sun.intensity=1.1;hemi.intensity=.95;fill.intensity=.85;rim.color.setHex(0xffbd72);rim.intensity=1.7;}
    if(district==='creative'){sun.intensity=1.8;hemi.intensity=1.6;rim.color.setHex(0x57c8a5);rim.intensity=2.7;}
    if(district==='personal'&&!evening){sun.intensity=2.25;hemi.intensity=1.55;fill.intensity=1.2;rim.intensity=1.4;}
    if(renderer)renderer.toneMappingExposure=expressive?1.05:.98;
    root.querySelector<HTMLElement>('#alExperienceMode')!.textContent=mode+' · '+value.behavior;
    const guide=root.querySelector<HTMLElement>('#alGuide')!;guide.hidden=value.behavior!=='guided';guide.textContent='Use joystick to move. Sprint, jump or pose, then explore a world.';
    if(value.behavior==='manual')avatarRuntime?.expression?.('neutral');
  };
  applyExperience(experience);stopExperience=subscribeExperience(applyExperience);
  const applyResidence=()=>{evening=residence.lighting==='evening';districtScene.setFurnishing(residence.furnishing);applyExperience(experience);};
  if(district==='personal'){
    const lighting=root.querySelector<HTMLSelectElement>('#rbResidenceLighting')!,finish=root.querySelector<HTMLSelectElement>('#rbResidenceFinish')!,save=root.querySelector<HTMLButtonElement>('#rbResidenceSave')!,status=root.querySelector<HTMLElement>('#rbResidenceStatus')!;
    const sync=()=>{lighting.value=residence.lighting;finish.value=residence.furnishing;applyResidence();};
    const setBusy=(busy:boolean)=>{lighting.disabled=finish.disabled=busy;save.disabled=busy||!residenceReady;};setBusy(true);sync();
    void readResidence(user.id,abort.signal).then(value=>{if(!isCurrent())return;residence=value;residenceReady=true;sync();status.textContent='Private settings loaded from Rich ID';setBusy(false);}).catch(()=>{if(isCurrent()){status.textContent='Could not read private settings. Reopen to retry.';setBusy(false);}});
    lighting.onchange=()=>{residence={...residence,lighting:lighting.value as Residence['lighting']};applyResidence();status.textContent='Unsaved preview';};finish.onchange=()=>{residence={...residence,furnishing:finish.value as Residence['furnishing']};applyResidence();status.textContent='Unsaved preview';};
    save.onclick=async()=>{if(!residenceReady||residenceSaving)return;residenceSaving=true;setBusy(true);status.textContent='Saving…';try{residence=await saveResidence(user.id,residence,abort.signal);if(isCurrent()){sync();status.textContent='Verified • saved to your Rich ID';}}catch(error){if(isCurrent())status.textContent='Save failed: '+(error instanceof Error?error.message:'Retry');}finally{residenceSaving=false;if(isCurrent())setBusy(false);}};
  }

  try{avatarRuntime=await createTexturedAvatar(gender,character.look,build);}catch(error){if(isCurrent())failure('Character asset unavailable: '+(error instanceof Error?error.message:'load failed')+'. Saved Rich ID is unchanged.');return;}
  setAvatarMotion(avatarRuntime,'idle',0);
  canvas.dataset.rbModelState=original?'textured-human':'unsaved-textured-human';
  if (!isCurrent()) { disposeSkinnedAvatar(avatarRuntime); return; }
  avatarRuntime.root.position.set(definition.spawn[0],0,definition.spawn[1]);
  scene.add(avatarRuntime.root);avatarRuntime.root.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=!mobile;o.receiveShadow=!mobile;}});
  root.querySelector<HTMLElement>('#avatarLoading')?.remove();
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d')!;const grad=ctx.createRadialGradient(64,64,3,64,64,62);grad.addColorStop(0,'rgba(0,0,0,.65)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const shadowTexture=new THREE.CanvasTexture(shadowCanvas);const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.9),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.025;world.add(contact);

  const joystick = root.querySelector<HTMLElement>('#joystick')!;
  const stick = root.querySelector<HTMLElement>('#stick')!;
  let joyX = 0;
  let joyY = 0;
  let sprint = false;
  let verticalVelocity = 0;
  let grounded = true;
  let powerTimer = 0;
  let dragging = false;
  const velocity = new THREE.Vector3();
  const desiredVelocity = new THREE.Vector3();

  const setJoy = (clientX: number, clientY: number) => {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (clientX - cx) / (rect.width * .34);
    let y = (clientY - cy) / (rect.height * .34);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    joyX = x;
    joyY = y;
    stick.style.transform = `translate(${x * 24}px,${y * 24}px)`;
  };
  joystick.onpointerdown = (event) => {
    dragging = true;
    joystick.setPointerCapture(event.pointerId);
    setJoy(event.clientX, event.clientY);
  };
  joystick.onpointermove = (event) => { if (dragging) setJoy(event.clientX, event.clientY); };
  const release = () => {
    dragging = false;
    joyX = 0;
    joyY = 0;
    stick.style.transform = 'translate(0,0)';
  };
  joystick.onpointerup = release;
  joystick.onpointercancel = release;joystick.onlostpointercapture=release;
  const keys=new Set<string>();const updateKeys=()=>{joyX=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));joyY=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));};
  window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,textarea,select,button'))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();keys.add(k);updateKeys();}if(k==='e'&&activeAction){e.preventDefault();interaction.click();}},{signal:abort.signal});
  window.addEventListener('keyup',e=>{if(keys.delete(e.key.toLowerCase()))updateKeys();},{signal:abort.signal});window.addEventListener('blur',()=>{keys.clear();release();},{signal:abort.signal});
  interaction.onclick=()=>{if(!activeAction||!avatarRuntime)return;const a=nearbyAction(definition.actions,avatarRuntime.root.position.x,avatarRuntime.root.position.z);if(!a||a.id!==activeAction.id)return;if(a.effect==='lighting'){if(residenceSaving)return;residence={...residence,lighting:evening?'daylight':'evening'};applyResidence();const light=root.querySelector<HTMLSelectElement>('#rbResidenceLighting');if(light)light.value=residence.lighting;const status=root.querySelector<HTMLElement>('#rbResidenceStatus');if(status)status.textContent='Unsaved lighting preview • use Save Residence';interaction.textContent=evening?'SWITCH TO DAYLIGHT':'SWITCH TO EVENING';}else if(a.href)location.assign(a.href);};

  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.action;
      if (action === 'jump' && grounded) {
        grounded = false;
        verticalVelocity = jumpForce;
      }
      if (action === 'run') {
        sprint = !sprint;
        button.classList.toggle('active', sprint);button.setAttribute('aria-pressed',String(sprint));
      }
      if (action === 'power' && grounded) powerTimer = 2.4;
      if (action === 'idle') {
        joyX = 0;
        joyY = 0;
        sprint = false;
        powerTimer = 0;
        velocity.set(0, 0, 0);
        const sprintButton=root.querySelector<HTMLButtonElement>('[data-action="run"]');sprintButton?.classList.remove('active');sprintButton?.setAttribute('aria-pressed','false');release();keys.clear();
      }
    };
  });

  resize = () => {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    const limit=mobile?960:1440;const scale=Math.min(1,limit/Math.max(1,rect.width,rect.height))*renderScale;renderer.setSize(Math.max(1,Math.round(rect.width*scale)),Math.max(1,Math.round(rect.height*scale)),false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);observer=new ResizeObserver(resize);observer.observe(canvas);
  resize();
  cameraTools.forEach(b=>b.onclick=()=>{if(b.dataset.camera==='turn'){cameraYaw=(cameraYaw+Math.PI/2)%(Math.PI*2);return;}cameraMode=b.dataset.camera==='wide'?'wide':'close';cameraTools.forEach(t=>{if(t.dataset.camera!=='turn')t.setAttribute('aria-pressed',String(t===b));});});

  const clock = new THREE.Clock();
  const targetCamera = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  camera.position.set(definition.spawn[0],1.65,definition.spawn[1]+3.1);camera.lookAt(definition.spawn[0],avatarRuntime.height*.52,definition.spawn[1]);
  let activeMotion: AvatarMotion = 'idle';
  const presence=createWorldPresence(scene,district,user.id,()=>avatarRuntime?{x:avatarRuntime.root.position.x,y:Math.min(4,Math.max(0,avatarRuntime.root.position.y)),z:avatarRuntime.root.position.z,yaw:Math.atan2(Math.sin(avatarRuntime.root.rotation.y),Math.cos(avatarRuntime.root.rotation.y)),motion:activeMotion}:null,s=>{const el=root.querySelector<HTMLElement>('#rbPresenceStatus');if(el)el.textContent=s;});
  const toggle=root.querySelector<HTMLInputElement>('#rbPresence');if(toggle){toggle.disabled=!original;toggle.onchange=()=>{if(toggle.checked)presence.start();else presence.stop();};document.addEventListener('visibilitychange',()=>{if(document.hidden&&toggle.checked){toggle.checked=false;presence.stop();}},{signal:abort.signal});}
  const recording=root.querySelector<HTMLElement>('#rbRecording');const stopRecording=recording?mountRecordingConsole(recording):()=>{};let lifeStopped=false;stopLife=()=>{if(lifeStopped)return;lifeStopped=true;presence.dispose();stopRecording();if(toggle){toggle.checked=false;toggle.disabled=true;}};
  let lastGuide=0;
  let sampleTime = 0;
  let sampleFrames = 0;
  let pixelRatio = mobile?1:quality.dpr;

  let lastFrame=0;
  const loop = (now=0) => {
    if (disposed || !avatarRuntime || !renderer) return;
    raf=requestAnimationFrame(loop);
    if(document.hidden||now-lastFrame<(mobile?32:16))return;
    const interval=lastFrame?now-lastFrame:0;lastFrame=now;if(interval>0&&interval<250){averageFrame+=(interval-averageFrame)*.08;frameSamples++;}
    if(frameSamples>30&&now-lastAdapt>3000){lastAdapt=now;const next=averageFrame>(mobile?48:32)?Math.max(.65,renderScale-.10):averageFrame<(mobile?37:21)?Math.min(1,renderScale+.06):renderScale;if(Math.abs(next-renderScale)>.01){renderScale=next;resize();}}
    if(now-lastTelemetry>1000){lastTelemetry=now;const status=root.querySelector<HTMLElement>('#alPerformance');if(status)status.textContent='~'+Math.round(1000/averageFrame)+' fps · '+Math.round(renderScale*100)+'% render scale';}
    const dt = Math.min(clock.getDelta(), .075);
    try{
    const inputMagnitude = Math.min(1, Math.hypot(joyX, joyY));
    const moving = inputMagnitude > .10;
    if(moving)powerTimer=0;
    const nominal=avatarRuntime.locomotionSpeed?.[sprint?'run':'walk']??(sprint?3.8:1.9);
    const topSpeed = Math.min(sprint?sprintSpeed:moveSpeed,nominal*1.28);

    if (moving) {
      desiredVelocity.set(joyX, 0, joyY).applyAxisAngle(new THREE.Vector3(0,1,0),cameraYaw).normalize().multiplyScalar(topSpeed * inputMagnitude);
      const blend = Math.min(1, acceleration * dt);
      velocity.lerp(desiredVelocity, blend);
    } else {
      const blend = Math.min(1, deceleration * dt);
      velocity.lerp(new THREE.Vector3(), blend);
    }

    const position=avatarRuntime.root.position;const ox=position.x,oz=position.z;const [nx,nz]=moveWithinWorld(ox,oz,velocity.x*dt,velocity.z*dt,definition.bounds,districtScene.obstacles);position.x=nx;position.z=nz;
    const actualSpeed=Math.hypot(nx-ox,nz-oz)/Math.max(dt,.001);
    const nearby=nearbyAction(definition.actions,nx,nz);if(nearby?.id!==activeAction?.id){activeAction=nearby;root.querySelector<HTMLElement>('#alActionTitle')!.textContent=nearby?.label??'Explore the environment';root.querySelector<HTMLElement>('#alActionDescription')!.textContent=nearby?.description??definition.description;interaction.disabled=!nearby;interaction.textContent=nearby?(nearby.effect==='lighting'?(evening?'SWITCH TO DAYLIGHT':'SWITCH TO EVENING'):'OPEN '+nearby.label.toUpperCase()):'MOVE TO A MARKER';}
    if (actualSpeed > .11) {
      const targetYaw = Math.atan2(velocity.x, velocity.z);
      const turnBlend = 1-Math.exp(-turnSpeed*dt);
      const deltaYaw=Math.atan2(Math.sin(targetYaw-avatarRuntime.root.rotation.y),Math.cos(targetYaw-avatarRuntime.root.rotation.y));avatarRuntime.root.rotation.y+=deltaYaw*turnBlend;
    }

    if (!grounded) {
      verticalVelocity -= gravity * dt;
      avatarRuntime.root.position.y += verticalVelocity * dt;
      if (avatarRuntime.root.position.y <= 0) {
        avatarRuntime.root.position.y = 0;
        verticalVelocity = 0;
        grounded = true;
      }
    }

    powerTimer = Math.max(0, powerTimer - dt);
    const nextMotion: AvatarMotion = powerTimer > 0 ? 'power' : !grounded ? 'jump' : actualSpeed>.11 ? (sprint&&actualSpeed>(avatarRuntime.locomotionSpeed?.walk??1.1)*1.25?'run':'walk') : 'idle';
    if (nextMotion !== activeMotion) {
      activeMotion = nextMotion;
      setAvatarMotion(avatarRuntime, nextMotion);
      if(experience.behavior!=='manual')avatarRuntime.expression?.(nextMotion==='power'?'confident':nextMotion==='jump'?'surprised':nextMotion==='run'?'focused':'neutral');
      if(experience.behavior==='guided')root.querySelector<HTMLElement>('#alGuide')!.textContent=nextMotion==='run'?'Sprint active. Release sprint to walk.':nextMotion==='jump'?'Landing returns you to movement.':nextMotion==='power'?'Pose active. You remain in control.':nextMotion==='walk'?'Explore the district or enter Worlds.':'Choose a direction or open Worlds.';
    }
    if(nextMotion==='walk'||nextMotion==='run'){const strideSpeed=avatarRuntime.locomotionSpeed?.[nextMotion]??(nextMotion==='run'?3.8:1.9);avatarRuntime.currentAction?.setEffectiveTimeScale(THREE.MathUtils.clamp(actualSpeed/strideSpeed,.08,1.45));}else if(nextMotion==='jump'&&avatarRuntime.currentAction){avatarRuntime.currentAction.setEffectiveTimeScale(THREE.MathUtils.clamp(avatarRuntime.currentAction.getClip().duration/Math.max(.3,2*jumpForce/gravity),.6,2));}
    avatarRuntime.lookAt?.(experience.behavior!=='manual'&&activeMotion==='idle'?camera.position:null);
    updateSkinnedAvatar(avatarRuntime, dt);

    const distance=cameraMode==='close'?Math.max(2.3,avatarRuntime.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*.76)):baseDistance;
    targetCamera.set(position.x+Math.sin(cameraYaw)*distance,position.y+(cameraMode==='close'?avatarRuntime.height*.91:baseHeight),position.z+Math.cos(cameraYaw)*distance);
    if(district!=='city'){targetCamera.z=THREE.MathUtils.clamp(targetCamera.z,definition.bounds.minZ+.15,8.5);targetCamera.x=THREE.MathUtils.clamp(targetCamera.x,-5.65,5.65);}
    const clearance=cameraClearance(position.x,position.z,targetCamera.x,targetCamera.z,districtScene.obstacles);targetCamera.x=position.x+(targetCamera.x-position.x)*clearance;targetCamera.z=position.z+(targetCamera.z-position.z)*clearance;
    // Collision moves inward immediately; outward motion eases back to the preferred view.
    if(clearance<.99)camera.position.copy(targetCamera);else camera.position.lerp(targetCamera,1-Math.exp(-6.5*dt));
    cameraLook.set(position.x,position.y+avatarRuntime.height*.52,position.z);
    contact.position.set(position.x,.025,position.z);contact.material.opacity=Math.max(.13,1-position.y*.8);
    camera.lookAt(cameraLook);

    sampleTime += dt;
    sampleFrames += 1;
    if (sampleTime >= 2.2 && !mobile) {
      const averageFrame = sampleTime / Math.max(sampleFrames, 1);
      const nextRatio = averageFrame > .027 ? Math.max(1.15, pixelRatio - .2) : averageFrame < .019 ? Math.min(quality.dpr, pixelRatio + .1) : pixelRatio;
      if (Math.abs(nextRatio - pixelRatio) > .04) {
        pixelRatio = nextRatio;
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
      sampleTime = 0;
      sampleFrames = 0;
    }

    districtScene.tick(now/1000,activeAction?.id,camera.quaternion);presence.tick(dt,now/1000);
    if(now-lastGuide>500){lastGuide=now;const guide=root.querySelector<HTMLElement>('#rbWayfinder'),selection=root.querySelector<HTMLSelectElement>('#rbTarget');if(guide){const p=avatarRuntime.root.position;const target=definition.actions.find(a=>a.id===selection?.value)??[...definition.actions].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(target){const distance=Math.hypot(target.x-p.x,target.z-p.z);const direction=target.z<p.z?'ahead (north)':'behind (south)';guide.textContent=target.label+' · '+distance.toFixed(1)+' m · '+(distance<1.85?'within interaction range':direction+' / '+(target.x<p.x?'west':'east'));}}}
    if(!mobile){sun.position.set(position.x+8,13,position.z+6);sun.target.position.set(position.x,0,position.z);sun.target.updateMatrixWorld();}
    renderer.render(scene, camera);canvas.dataset.rbRenderState='frame-rendered';canvas.dataset.rbDistrict=district;
    }catch(error){failure('Graphics stopped. Saved appearance is unchanged.');console.warn('[Avatar Lobby]',error);}
  };
  raf=requestAnimationFrame(loop);
}
