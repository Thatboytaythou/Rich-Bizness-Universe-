import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { createGtaAvatar, disposeGtaAvatar, poseGtaAvatar, qualityProfile, type AvatarMotion, type GtaAvatarRig } from './avatar.gta.rig';
import './avatar.lobby.css';

type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
type Snapshot = { profile?: Record<string, any>; avatar?: Record<string, any> };
const OWNER = 'rich-bizness-avatar-lobby-v1';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
const accentFromAura = (aura: string) => aura === 'Neon Phantom' ? 0x7d59ff : aura === 'Diamond Mist' ? 0x86dcff : 0x22e981;

function addStreetWorld(scene: THREE.Scene, quality: ReturnType<typeof qualityProfile>) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x252a2c, roughness: .94 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x929b96, roughness: .92 });
  const curb = new THREE.MeshStandardMaterial({ color: 0xb8c0bb, roughness: .9 });
  const wallMats = [0x45515a, 0x56616a, 0x625f5a, 0x3f4b46].map(color => new THREE.MeshStandardMaterial({ color, roughness: .84 }));
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7eb7cb, roughness: .2, metalness: .05, transparent: true, opacity: .62 });

  const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 120), concrete);
  cityFloor.rotation.x = -Math.PI / 2;
  cityFloor.position.set(0, -.035, -38);
  cityFloor.receiveShadow = true;
  scene.add(cityFloor);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(17, 112), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -36);
  road.receiveShadow = true;
  scene.add(road);

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe5c94f });
  for (const laneX of [-2.15, 2.15]) {
    for (let z = -86; z < -1; z += 7.2) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.105, 2.3), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(laneX, .018, z);
      scene.add(stripe);
    }
  }

  for (const x of [-10.1, 10.1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(4, .18, 110), curb);
    walk.position.set(x, .09, -36);
    walk.receiveShadow = true;
    scene.add(walk);
  }

  const city = new THREE.Group();
  for (let i = 0; i < (quality.high ? 24 : 16); i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const w = 3 + Math.random() * 4;
    const h = 6.5 + Math.random() * 12;
    const d = 3.8 + Math.random() * 4.5;
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[i % wallMats.length]);
    building.position.set(side * (14.5 + Math.random() * 13), h / 2, -10 - Math.random() * 78);
    building.castShadow = true;
    building.receiveShadow = true;
    city.add(building);

    if (quality.high) {
      for (let row = 0; row < 4; row++) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1.2, w * .5), .34), glass);
        panel.position.set(building.position.x - side * (w / 2 + .012), 1.8 + row * 1.6, building.position.z);
        panel.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        city.add(panel);
      }
    }
  }
  scene.add(city);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x272c2d, roughness: .5, metalness: .45 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe4a0 });
  for (let z = -64; z < -4; z += 15) {
    for (const x of [-7.4, 7.4]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .055, 4.1, 10), poleMat);
      pole.position.set(x, 2.05, z);
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.62, .045, .045), poleMat);
      arm.position.set(x + (x < 0 ? .28 : -.28), 3.95, z);
      scene.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), glowMat);
      bulb.position.set(x + (x < 0 ? .56 : -.56), 3.92, z);
      scene.add(bulb);
    }
  }

  const carBodyMats = [0x15191a, 0x641f22, 0x1f4964, 0x31563b].map(color => new THREE.MeshPhysicalMaterial({ color, roughness: .38, metalness: .22, clearcoat: .32 }));
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x090a0a, roughness: .86 });
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, .45, 3.35), carBodyMats[i % carBodyMats.length]);
    body.position.y = .46;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.38, .44, 1.55), glass);
    cabin.position.set(0, .84, -.12);
    car.add(cabin);
    for (const sx of [-.75, .75]) for (const sz of [-1.08, 1.08]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .17, 18), tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, .26, sz);
      car.add(wheel);
    }
    car.position.set(i % 2 === 0 ? -5.7 : 5.7, 0, -13 - i * 14);
    scene.add(car);
  }
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let rig: GtaAvatarRig | null = null;
  let raf = 0;
  let resize: () => void = () => {};
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (rig) disposeGtaAvatar(rig);
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
  const name = String(avatar.display_name ?? snap.profile?.display_name ?? snap.profile?.username ?? 'Rich Avatar');
  const kind = String(avatar.character_type ?? 'male');
  const gender = kind === 'female' ? 'girl' : 'boy';
  const aura = String(avatar.aura ?? 'Emerald Gold');
  const outfit = avatar.outfit ?? {};
  const build = String(outfit.build ?? 'athletic');
  const style = String(outfit.style ?? 'street');

  root.innerHTML = `<main class="al-shell"><header><h1>Avatar Lobby</h1><nav><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>STREET MODE</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">SPRINT</button><button data-action="power">POWER</button><button data-action="idle">RESET</button></div></section></main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  const quality = qualityProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x86a8bb);
  scene.fog = new THREE.FogExp2(0x86a8bb, .014);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 180);
  camera.position.set(0, 2.55, 6.15);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x394239, 2.25));
  const sun = new THREE.DirectionalLight(0xffefd2, 3.7);
  sun.position.set(7, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 42;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa7d7ff, 1.05);
  fill.position.set(-5, 4, 4);
  scene.add(fill);
  const auraLight = new THREE.PointLight(accentFromAura(aura), 7, 10, 2);
  auraLight.position.set(-2.3, 1.8, 2.2);
  scene.add(auraLight);
  addStreetWorld(scene, quality);

  rig = createGtaAvatar({ gender, accent: accentFromAura(aura), build, style });
  rig.root.position.set(0, 0, 1.8);
  scene.add(rig.root);

  const joystick = root.querySelector<HTMLElement>('#joystick')!;
  const stick = root.querySelector<HTMLElement>('#stick')!;
  let joyX = 0, joyY = 0, run = false, jumpVel = 0, power = 0, dragging = false;
  const setJoy = (clientX: number, clientY: number) => {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let x = (clientX - cx) / (rect.width * .35), y = (clientY - cy) / (rect.height * .35);
    const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
    joyX = x; joyY = y; stick.style.transform = `translate(${x * 27}px,${y * 27}px)`;
  };
  joystick.onpointerdown = e => { dragging = true; joystick.setPointerCapture(e.pointerId); setJoy(e.clientX, e.clientY); };
  joystick.onpointermove = e => { if (dragging) setJoy(e.clientX, e.clientY); };
  const release = () => { dragging = false; joyX = joyY = 0; stick.style.transform = 'translate(0,0)'; };
  joystick.onpointerup = release;
  joystick.onpointercancel = release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn => btn.onclick = () => {
    const action = btn.dataset.action;
    if (action === 'jump' && rig && rig.root.position.y <= .01) jumpVel = .13;
    if (action === 'run') run = !run;
    if (action === 'power') power = 1;
    if (action === 'idle') { joyX = joyY = 0; run = false; power = 0; }
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
  const targetCam = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const loop = () => {
    if (disposed || !rig || !renderer) return;
    const dt = Math.min(clock.getDelta(), .033);
    const time = clock.elapsedTime;
    const moving = Math.hypot(joyX, joyY) > .05;
    const speed = (run ? 4.2 : 2.25) * dt;
    if (moving) {
      const angle = Math.atan2(joyX, -joyY);
      rig.root.rotation.y = THREE.MathUtils.lerp(rig.root.rotation.y, angle, .2);
      rig.root.position.x += Math.sin(angle) * speed;
      rig.root.position.z += Math.cos(angle) * speed;
      rig.root.position.x = THREE.MathUtils.clamp(rig.root.position.x, -6.4, 6.4);
      rig.root.position.z = THREE.MathUtils.clamp(rig.root.position.z, -52, 6);
    }
    jumpVel -= .0067;
    rig.root.position.y += jumpVel;
    if (rig.root.position.y < 0) { rig.root.position.y = 0; jumpVel = 0; }
    power = Math.max(0, power - dt * 1.4);
    const motion: AvatarMotion = power > .05 ? 'power' : rig.root.position.y > .02 ? 'jump' : moving ? (run ? 'run' : 'walk') : 'idle';
    poseGtaAvatar(rig, time, motion, power);

    targetCam.set(rig.root.position.x, rig.root.position.y + 2.25, rig.root.position.z + 5.8);
    camera.position.lerp(targetCam, .10);
    lookAt.set(rig.root.position.x, rig.root.position.y + 1.25, rig.root.position.z - .2);
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();
}