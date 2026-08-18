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
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x232729, roughness: .92 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x858c88, roughness: .9 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xa6aba7, roughness: .88 });
  const wallMats = [0x4d5860, 0x5c6468, 0x6a6259, 0x48514a].map(color => new THREE.MeshStandardMaterial({ color, roughness: .82 }));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x8bc5d8, roughness: .16, metalness: .08, transparent: true, opacity: .72 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(18, 110), asphalt); road.rotation.x = -Math.PI / 2; road.position.z = -36; road.receiveShadow = true; scene.add(road);
  const block = new THREE.Mesh(new THREE.PlaneGeometry(90, 110), concrete); block.rotation.x = -Math.PI / 2; block.position.set(0, -.012, -36); block.receiveShadow = true; scene.add(block);
  scene.add(road);

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe7c94d });
  for (let z = -86; z < 14; z += 6) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.12, 2.6), stripeMat); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, .012, z); scene.add(stripe);
  }
  for (const x of [-10.2, 10.2]) {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(4.0, .18, 108), curbMat); sidewalk.position.set(x, .09, -36); sidewalk.receiveShadow = true; scene.add(sidewalk);
  }

  const city = new THREE.Group();
  for (let i = 0; i < (quality.high ? 30 : 20); i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const w = 3.2 + Math.random() * 4.2;
    const h = 7 + Math.random() * 14;
    const d = 4 + Math.random() * 5;
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[i % wallMats.length]);
    building.position.set(side * (14 + Math.random() * 15), h / 2, -8 - Math.random() * 80);
    building.castShadow = true; building.receiveShadow = true; city.add(building);
    const windowRows = quality.high ? 5 : 3;
    for (let row = 0; row < windowRows; row++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1.4, w * .55), .42), glassMat);
      panel.position.set(building.position.x - side * (w / 2 + .011), 1.8 + row * 1.7, building.position.z);
      panel.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      city.add(panel);
    }
  }
  scene.add(city);

  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x303536, roughness: .45, metalness: .5 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe5a0 });
  for (let z = -70; z < 8; z += 13) {
    for (const x of [-7.7, 7.7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .065, 4.4, 12), lampPoleMat); pole.position.set(x, 2.2, z); scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.75, .05, .05), lampPoleMat); arm.position.set(x + (x < 0 ? .33 : -.33), 4.25, z); scene.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), lampGlowMat); bulb.position.set(x + (x < 0 ? .68 : -.68), 4.2, z); scene.add(bulb);
      if (quality.high && z > -35) { const light = new THREE.PointLight(0xffd98a, 4, 7, 2); light.position.copy(bulb.position); scene.add(light); }
    }
  }

  const carBodyMats = [0x151a1c, 0x5a1717, 0x173758, 0x2a4d30].map(color => new THREE.MeshPhysicalMaterial({ color, roughness: .34, metalness: .28, clearcoat: .45 }));
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x090a0a, roughness: .84 });
  for (let i = 0; i < 6; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, .48, 3.6), carBodyMats[i % carBodyMats.length]); body.position.y = .48; body.castShadow = true; car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, .48, 1.7), glassMat); cabin.position.set(0, .88, -.15); car.add(cabin);
    for (const sx of [-.78, .78]) for (const sz of [-1.2, 1.2]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.30, .30, .18, 20), tireMat); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx, .28, sz); car.add(wheel); }
    car.position.set(i % 2 === 0 ? -5.7 : 5.7, 0, -8 - i * 10); car.rotation.y = i % 2 === 0 ? 0 : Math.PI; scene.add(car);
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

  root.innerHTML = `<main class="al-shell"><header><div><small>RICH BIZNESS · STREET MODE</small><h1>Avatar Lobby</h1></div><nav><a href="/avatar-characters.html">CUSTOMIZE</a><a href="/profile.html">PROFILE</a><a href="/meta.html">META</a></nav></header><section class="al-stage"><div class="al-stagebar"><span>GTA-STYLE FULL BODY</span><b>${esc(aura)}</b></div><canvas id="lobbyCanvas"></canvas><div class="al-id"><strong>${esc(name)}</strong><em>${esc(build.toUpperCase())} · ${esc(style.toUpperCase())}</em></div></section><section class="al-controls"><div class="joystick" id="joystick"><div id="stick"></div></div><div class="actions"><button data-action="jump">JUMP</button><button data-action="run">SPRINT</button><button data-action="power">POWER</button><button data-action="idle">RESET</button></div></section></main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#lobbyCanvas')!;
  const quality = qualityProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7899ad);
  scene.fog = new THREE.FogExp2(0x7899ad, .018);
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 180);
  camera.position.set(0, 3.15, 7.2);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xd7edff, 0x283128, 2.0));
  const sun = new THREE.DirectionalLight(0xffefd2, 3.9); sun.position.set(7, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize); sun.shadow.camera.near = .5; sun.shadow.camera.far = 45; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x73b9ff, 1.25); rim.position.set(-6, 5, -6); scene.add(rim);
  const auraLight = new THREE.PointLight(accentFromAura(aura), 11, 13, 2); auraLight.position.set(-2.5, 2.2, 2.8); scene.add(auraLight);
  addStreetWorld(scene, quality);

  rig = createGtaAvatar({ gender, accent: accentFromAura(aura), build, style });
  rig.root.position.set(0, 0, 1.5);
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
  joystick.onpointerup = release; joystick.onpointercancel = release;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn => btn.onclick = () => {
    const action = btn.dataset.action;
    if (action === 'jump' && rig && rig.root.position.y <= .01) jumpVel = .145;
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
    const speed = (run ? 4.5 : 2.4) * dt;
    if (moving) {
      const angle = Math.atan2(joyX, -joyY);
      rig.root.rotation.y = THREE.MathUtils.lerp(rig.root.rotation.y, angle, .18);
      rig.root.position.x += Math.sin(angle) * speed;
      rig.root.position.z += Math.cos(angle) * speed;
      rig.root.position.x = THREE.MathUtils.clamp(rig.root.position.x, -7.3, 7.3);
      rig.root.position.z = THREE.MathUtils.clamp(rig.root.position.z, -55, 7);
    }
    jumpVel -= .0072;
    rig.root.position.y += jumpVel;
    if (rig.root.position.y < 0) { rig.root.position.y = 0; jumpVel = 0; }
    power = Math.max(0, power - dt * 1.35);
    const motion: AvatarMotion = power > .05 ? 'power' : rig.root.position.y > .02 ? 'jump' : moving ? (run ? 'run' : 'walk') : 'idle';
    poseGtaAvatar(rig, time, motion, power);

    targetCam.set(rig.root.position.x, rig.root.position.y + 2.85, rig.root.position.z + 6.9);
    camera.position.lerp(targetCam, .085);
    lookAt.set(rig.root.position.x, rig.root.position.y + 1.85, rig.root.position.z - .15);
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();
}
