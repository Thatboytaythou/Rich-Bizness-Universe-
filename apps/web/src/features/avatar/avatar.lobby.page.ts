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
import { createTexturedAvatar } from './avatar.textured.runtime';
import {getExperience,resolveVisual,subscribeExperience,type Experience} from '../../core/experience/policy';
import {readCharacterIdentity,savedCharacter,hasSavedOriginal} from './avatar.identity';
import {DISTRICTS,resolveDistrict,districtHref} from './world.catalog';
import {createDistrictScene,moveWithinWorld,nearbyAction} from './world.scene';
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
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: .93 });
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
  blocks.forEach(([x, h, z, w, d], index) => {
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[index % wallMats.length]);
    building.position.set(x, h / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    world.add(building);
    for (let row = 0; row < Math.min(5, Math.floor(h / 2)); row++) {
      const windowPanel = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1.1, w * .42), .34), glass);
      windowPanel.position.set(x + (x < 0 ? w / 2 + .01 : -(w / 2 + .01)), 1.7 + row * 1.55, z);
      windowPanel.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      world.add(windowPanel);
    }
  });

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
  let renderer: THREE.WebGLRenderer | null = null;
  let avatarRuntime: SkinnedAvatarRuntime | null = null;
  let world: THREE.Group | null = null;
  let raf = 0;
  let resize = () => {};let stopExperience=()=>{};
  const abort = new AbortController();
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();stopExperience();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (avatarRuntime) disposeSkinnedAvatar(avatarRuntime);
    if (world) disposeObject(world);
    renderer?.dispose();renderer?.forceContextLoss();
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

  root.innerHTML = `<main class="al-shell"><header><h1>${definition.title}</h1><nav><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/profile.html">PROFILE</a><a href="/meta.html">WORLDS</a></nav></header><div class="al-experience"><span id="alExperienceMode"></span><span id="alGuide" role="status" hidden></span><a href="/meta.html">World Exchange ↗</a></div><nav class="al-districts" aria-label="Travel between districts">${(Object.keys(DISTRICTS) as Array<keyof typeof DISTRICTS>).map(key=>`<a href="${districtHref(key)}" ${key===district?'aria-current="page"':''}>${DISTRICTS[key].title}</a>`).join("")}</nav><section class="al-stage"><canvas id="lobbyCanvas"></canvas><div class="al-hud"><span class="al-mode">${original?'RICH ID • SAVED':'UNSAVED DEFAULT • CUSTOMIZE'}</span><span class="al-aura">${esc(aura)}</span><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></div><div class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">SPRINT</button><button data-action="power">POWER</button><button data-action="idle">RESET</button></div></div><div class="al-loading" id="avatarLoading">LOADING CHARACTER…</div></section><section class="al-interaction" aria-label="District interactions"><div><small id="alWorldStatus">Connecting world entry…</small><h2 id="alActionTitle">Explore the environment</h2><p id="alActionDescription">${definition.description}</p></div><button id="alInteract" disabled type="button">MOVE TO A MARKER</button></section><div class="al-destinations">${definition.actions.filter(a=>a.href).map(a=>`<a href="${a.href}"><strong>${a.label}</strong><small>${a.description}</small></a>`).join("")}</div></main>`;

  const worldStatus=root.querySelector<HTMLElement>('#alWorldStatus')!;
  const interaction=root.querySelector<HTMLButtonElement>('#alInteract')!;
  let activeAction:typeof definition.actions[number]|undefined;
  let evening=false;const lightingKey='rb.residence.lighting.'+user.id;
  try{evening=localStorage.getItem(lightingKey)==='evening';}catch{}
  const canvas = root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  // Only the public catalog template is entered; personal room geometry is local to this session.
  void (async()=>{try{const {data,error}=await supabase.from('meta_worlds').select('id,access_type').eq('slug',definition.slug).eq('status','active').eq('access_type','public').maybeSingle().abortSignal(abort.signal);if(!isCurrent())return;if(error||!data){worldStatus.textContent='Catalog entry unavailable • local exploration';return;}if(!original){worldStatus.textContent='Preview identity • save a character to link visits';return;}const entered=await supabase.rpc('rb_enter_meta_world',{p_world_id:data.id}).abortSignal(abort.signal);if(!isCurrent())return;worldStatus.textContent=!entered.error&&(entered.data as any)?.entered===true?'Rich ID world entry confirmed':'World entry not confirmed • local exploration';}catch{if(isCurrent())worldStatus.textContent='World service unavailable • local exploration';}})();
  const quality = qualityProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c9d8);
  scene.fog = new THREE.Fog(0xa9c9d8, 22, 115);
  const camera = new THREE.PerspectiveCamera(Number(cameraConfig.fov ?? 48), 1, .08, 180);
  const baseDistance = Math.max(3.8, Number(cameraConfig.distance ?? 5.4));
  const baseHeight = Math.max(1.5, Number(cameraConfig.height ?? 2.2));

  const mobile=matchMedia('(pointer:coarse),(max-width:860px)').matches;
  const failure=(message:string)=>{cancelAnimationFrame(raf);root.querySelector<HTMLElement>('#avatarLoading')?.remove();const panel=document.createElement('div');panel.className='al-loading';panel.setAttribute('role','status');panel.textContent=message+' ';const link=document.createElement('a');link.href='/avatar-characters.html';link.textContent='Return to Avatar Studio';panel.append(link);canvas.parentElement?.append(panel);root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>button.disabled=true);};
  try{renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: mobile?'low-power':'high-performance' });}catch{failure('3D graphics unavailable. Your saved Rich ID is unchanged.');return;}
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failure('3D graphics paused. Your saved Rich ID is unchanged.');},{signal:abort.signal,once:true});
  renderer.setPixelRatio(mobile?1:quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemi=new THREE.HemisphereLight(0xf3fbff,0x5d675f,2.7);scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d9, 3.2);
  sun.position.set(8, 13, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 42;
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
    (scene.background as THREE.Color).setHex(fantasy?0x292645:expressive?0xc7dbe3:0xa9c9d8);(scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
    sun.color.setHex(fantasy?0xc6b4ff:0xfff2d9);sun.intensity=fantasy?2.0:3.2;hemi.intensity=expressive?3.1:fantasy?1.6:2.5;rim.color.setHex(fantasy?0x9e86ff:0x80ffc0);rim.intensity=fantasy?3.1:.7;
    if(district==='personal'&&evening){sun.intensity=.75;hemi.intensity=.75;rim.color.setHex(0xffbd72);rim.intensity=3.4;}
    if(district==='creative'){sun.intensity=1.8;hemi.intensity=1.6;rim.color.setHex(0x57c8a5);rim.intensity=2.7;}
    if(renderer)renderer.toneMappingExposure=expressive?1.16:1.08;
    root.querySelector<HTMLElement>('#alExperienceMode')!.textContent=mode+' · '+value.behavior;
    const guide=root.querySelector<HTMLElement>('#alGuide')!;guide.hidden=value.behavior!=='guided';guide.textContent='Use joystick to move. Sprint, jump or pose, then explore a world.';
    if(value.behavior==='manual')avatarRuntime?.expression?.('neutral');
  };
  applyExperience(experience);stopExperience=subscribeExperience(applyExperience);

  try{avatarRuntime=await createTexturedAvatar(gender,character.look,build);}catch(error){if(isCurrent())failure('Textured character unavailable. Saved Rich ID is unchanged.');return;}
  setAvatarMotion(avatarRuntime,'idle',0);
  canvas.dataset.rbModelState=original?'textured-human':'unsaved-textured-human';
  if (!isCurrent()) { disposeSkinnedAvatar(avatarRuntime); return; }
  avatarRuntime.root.position.set(definition.spawn[0],0,definition.spawn[1]);
  scene.add(avatarRuntime.root);
  root.querySelector<HTMLElement>('#avatarLoading')?.remove();

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
  interaction.onclick=()=>{if(!activeAction||!avatarRuntime)return;const a=nearbyAction(definition.actions,avatarRuntime.root.position.x,avatarRuntime.root.position.z);if(!a||a.id!==activeAction.id)return;if(a.effect==='lighting'){evening=!evening;try{localStorage.setItem(lightingKey,evening?'evening':'daylight');}catch{}applyExperience(experience);interaction.textContent=evening?'SWITCH TO DAYLIGHT':'SWITCH TO EVENING';}else if(a.href)location.assign(a.href);};

  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.action;
      if (action === 'jump' && grounded) {
        grounded = false;
        verticalVelocity = jumpForce;
      }
      if (action === 'run') {
        sprint = !sprint;
        button.classList.toggle('active', sprint);
      }
      if (action === 'power') powerTimer = .75;
      if (action === 'idle') {
        joyX = 0;
        joyY = 0;
        sprint = false;
        powerTimer = 0;
        velocity.set(0, 0, 0);
        root.querySelector<HTMLButtonElement>('[data-action="run"]')?.classList.remove('active');
      }
    };
  });

  resize = () => {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    const limit=mobile?720:1280;const scale=Math.min(1,limit/Math.max(1,rect.width,rect.height));renderer.setSize(Math.max(1,Math.round(rect.width*scale)),Math.max(1,Math.round(rect.height*scale)),false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  const targetCamera = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  camera.position.set(definition.spawn[0],baseHeight,definition.spawn[1]+baseDistance);camera.lookAt(definition.spawn[0],avatarRuntime.height*.57,definition.spawn[1]);
  let activeMotion: AvatarMotion = 'idle';
  let sampleTime = 0;
  let sampleFrames = 0;
  let pixelRatio = mobile?1:quality.dpr;

  let lastFrame=0;
  const loop = (now=0) => {
    if (disposed || !avatarRuntime || !renderer) return;
    raf=requestAnimationFrame(loop);
    if(document.hidden||now-lastFrame<(mobile?32:16))return;
    lastFrame=now;
    const dt = Math.min(clock.getDelta(), .05);
    try{
    const inputMagnitude = Math.min(1, Math.hypot(joyX, joyY));
    const moving = inputMagnitude > .10;
    const topSpeed = sprint ? sprintSpeed : moveSpeed;

    if (moving) {
      desiredVelocity.set(joyX, 0, joyY).normalize().multiplyScalar(topSpeed * inputMagnitude);
      const blend = Math.min(1, acceleration * dt);
      velocity.lerp(desiredVelocity, blend);
    } else {
      const blend = Math.min(1, deceleration * dt);
      velocity.lerp(new THREE.Vector3(), blend);
    }

    const position=avatarRuntime.root.position;const [nx,nz]=moveWithinWorld(position.x,position.z,velocity.x*dt,velocity.z*dt,definition.bounds,districtScene.obstacles);position.x=nx;position.z=nz;
    const nearby=nearbyAction(definition.actions,nx,nz);if(nearby?.id!==activeAction?.id){activeAction=nearby;root.querySelector<HTMLElement>('#alActionTitle')!.textContent=nearby?.label??'Explore the environment';root.querySelector<HTMLElement>('#alActionDescription')!.textContent=nearby?.description??definition.description;interaction.disabled=!nearby;interaction.textContent=nearby?(nearby.effect==='lighting'?(evening?'SWITCH TO DAYLIGHT':'SWITCH TO EVENING'):'OPEN '+nearby.label.toUpperCase()):'MOVE TO A MARKER';}
    if (velocity.lengthSq() > .03) {
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
    const nextMotion: AvatarMotion = powerTimer > 0 ? 'power' : !grounded ? 'jump' : moving ? (sprint ? 'run' : 'walk') : 'idle';
    if (nextMotion !== activeMotion) {
      activeMotion = nextMotion;
      setAvatarMotion(avatarRuntime, nextMotion);
      if(experience.behavior!=='manual')avatarRuntime.expression?.(nextMotion==='power'?'confident':nextMotion==='jump'?'surprised':nextMotion==='run'?'focused':'neutral');
      if(experience.behavior==='guided')root.querySelector<HTMLElement>('#alGuide')!.textContent=nextMotion==='run'?'Sprint active. Release sprint to walk.':nextMotion==='jump'?'Landing returns you to movement.':nextMotion==='power'?'Pose active. You remain in control.':nextMotion==='walk'?'Explore the district or enter Worlds.':'Choose a direction or open Worlds.';
    }
    if(nextMotion==='walk'||nextMotion==='run'){avatarRuntime.currentAction?.setEffectiveTimeScale(THREE.MathUtils.clamp(velocity.length()/(nextMotion==='run'?3.8:1.9),.45,1.3));}
    updateSkinnedAvatar(avatarRuntime, dt);

    targetCamera.set(
      avatarRuntime.root.position.x,
      avatarRuntime.root.position.y + baseHeight,
      avatarRuntime.root.position.z + baseDistance
    );
    if(district!=='city'){targetCamera.z=Math.min(9,targetCamera.z);targetCamera.x=THREE.MathUtils.clamp(targetCamera.x,-4.9,4.9);}
    camera.position.lerp(targetCamera, 1 - Math.exp(-6.5 * dt));
    cameraLook.set(
      avatarRuntime.root.position.x,
      avatarRuntime.root.position.y + avatarRuntime.height * .57,
      avatarRuntime.root.position.z - .3
    );
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

    renderer.render(scene, camera);canvas.dataset.rbRenderState='frame-rendered';canvas.dataset.rbDistrict=district;
    }catch(error){failure('Graphics stopped. Saved appearance is unchanged.');console.warn('[Avatar Lobby]',error);}
  };
  raf=requestAnimationFrame(loop);
}
