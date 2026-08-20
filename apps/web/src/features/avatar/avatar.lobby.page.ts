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
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material?.dispose();
  });
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
  let resize = () => {};
  const abort = new AbortController();
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (avatarRuntime) disposeSkinnedAvatar(avatarRuntime);
    if (world) disposeObject(world);
    renderer?.dispose();
    const host = window as CleanupHost;
    if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null;
  };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  const user = getAuthSnapshot().user;
  if (!user) { location.replace('/tap-in.html?next=%2Favatar.html'); return; }
  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {});
  if (error) throw error;
  if (!isCurrent()) return;

  const snap = (data ?? {}) as Snapshot;
  const avatar = snap.avatar ?? {};
  const loadout = snap.loadout ?? {};
  const outfit = loadout.outfit_config ?? avatar.metadata?.outfit ?? {};
  const name = String(avatar.display_name ?? loadout.display_name ?? snap.profile?.display_name ?? snap.profile?.username ?? 'Rich Avatar');
  const gender: AvatarGender = String(avatar.character_type ?? 'male') === 'female' ? 'girl' : 'boy';
  const aura = String(avatar.aura ?? loadout.aura_config?.name ?? 'Emerald Gold');
  const build = String(outfit.build ?? 'athletic');
  const style = String(outfit.style ?? 'street');
  const controller = snap.controller ?? {};
  const cameraConfig = controller.camera_config ?? {};
  const moveSpeed = Number(controller.move_speed ?? 4.8);
  const sprintSpeed = Number(controller.sprint_speed ?? 8.2);
  const jumpForce = Number(controller.jump_force ?? 6.8);
  const gravity = Number(controller.gravity ?? 18);
  const acceleration = Number(controller.acceleration ?? 20);
  const deceleration = Number(controller.deceleration ?? 16);
  const turnSpeed = Number(controller.turn_speed ?? 8);

  root.innerHTML = `<main class="al-shell"><header><h1>Avatar Lobby</h1><nav><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><canvas id="lobbyCanvas"></canvas><div class="al-hud"><span class="al-mode">STREET</span><span class="al-aura">${esc(aura)}</span><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></div><div class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">SPRINT</button><button data-action="power">POWER</button><button data-action="idle">RESET</button></div></div><div class="al-loading" id="avatarLoading">LOADING CHARACTER…</div></section></main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  const quality = qualityProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c9d8);
  scene.fog = new THREE.Fog(0xa9c9d8, 22, 115);
  const camera = new THREE.PerspectiveCamera(Number(cameraConfig.fov ?? 48), 1, .08, 180);
  const baseDistance = Math.max(3.8, Number(cameraConfig.distance ?? 5.4));
  const baseHeight = Math.max(1.5, Number(cameraConfig.height ?? 2.2));

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xf3fbff, 0x5d675f, 2.7));
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
  world = addStreetWorld(scene);

  avatarRuntime = await loadSkinnedAvatar({
    modelUrl: resolveAvatarModelUrl(snap as Record<string, any>, gender),
    targetHeight: gender === 'girl' ? 1.72 : 1.82,
    signal: abort.signal
  });
  if (!isCurrent()) { disposeSkinnedAvatar(avatarRuntime); return; }
  avatarRuntime.root.position.set(0, 0, 1.6);
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
  joystick.onpointercancel = release;

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
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  const targetCamera = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  let activeMotion: AvatarMotion = 'idle';
  let sampleTime = 0;
  let sampleFrames = 0;
  let pixelRatio = quality.dpr;

  const loop = () => {
    if (disposed || !avatarRuntime || !renderer) return;
    const dt = Math.min(clock.getDelta(), .04);
    const inputMagnitude = Math.min(1, Math.hypot(joyX, joyY));
    const moving = inputMagnitude > .05;
    const topSpeed = sprint ? sprintSpeed : moveSpeed;

    if (moving) {
      desiredVelocity.set(joyX, 0, -joyY).normalize().multiplyScalar(topSpeed * inputMagnitude);
      const blend = Math.min(1, acceleration * dt);
      velocity.lerp(desiredVelocity, blend);
    } else {
      const blend = Math.min(1, deceleration * dt);
      velocity.lerp(new THREE.Vector3(), blend);
    }

    avatarRuntime.root.position.x = THREE.MathUtils.clamp(avatarRuntime.root.position.x + velocity.x * dt, -5.8, 5.8);
    avatarRuntime.root.position.z = THREE.MathUtils.clamp(avatarRuntime.root.position.z + velocity.z * dt, -78, 5.5);
    if (velocity.lengthSq() > .03) {
      const targetYaw = Math.atan2(velocity.x, velocity.z);
      const turnBlend = Math.min(1, turnSpeed * dt);
      avatarRuntime.root.rotation.y = THREE.MathUtils.lerp(avatarRuntime.root.rotation.y, targetYaw, turnBlend);
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
    }
    updateSkinnedAvatar(avatarRuntime, dt);

    targetCamera.set(
      avatarRuntime.root.position.x,
      avatarRuntime.root.position.y + baseHeight,
      avatarRuntime.root.position.z + baseDistance
    );
    camera.position.lerp(targetCamera, 1 - Math.exp(-6.5 * dt));
    cameraLook.set(
      avatarRuntime.root.position.x,
      avatarRuntime.root.position.y + avatarRuntime.height * .57,
      avatarRuntime.root.position.z - .3
    );
    camera.lookAt(cameraLook);

    sampleTime += dt;
    sampleFrames += 1;
    if (sampleTime >= 2.2) {
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

    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();
}
