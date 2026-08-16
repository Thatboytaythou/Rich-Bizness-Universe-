import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.characters.css';

type Snapshot = { profile?: Record<string, any>; avatar?: Record<string, any> };
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));

type Rig = {
  root: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
};

function capsule(radius: number, length: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 10, 24), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRig(gender: 'boy' | 'girl', accent: number, build: string, style: string): Rig {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  const chest = new THREE.Group();
  const head = new THREE.Group();
  const leftShoulder = new THREE.Group();
  const rightShoulder = new THREE.Group();
  const leftElbow = new THREE.Group();
  const rightElbow = new THREE.Group();
  const leftHip = new THREE.Group();
  const rightHip = new THREE.Group();
  const leftKnee = new THREE.Group();
  const rightKnee = new THREE.Group();

  const skin = new THREE.MeshPhysicalMaterial({ color: gender === 'girl' ? 0xa06c50 : 0x8f6045, roughness: .42, metalness: .01, clearcoat: .18, clearcoatRoughness: .5 });
  const cloth = new THREE.MeshPhysicalMaterial({ color: accent, roughness: .26, metalness: style === 'cyber' ? .28 : .08, clearcoat: .3, clearcoatRoughness: .36 });
  const pants = new THREE.MeshPhysicalMaterial({ color: style === 'boss' ? 0x17191a : 0x151a18, roughness: .48, metalness: .06, clearcoat: .08 });
  const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0x0e1110, roughness: .32, metalness: .18, clearcoat: .38 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: .5 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: .45 });
  const eyeDark = new THREE.MeshStandardMaterial({ color: 0x16110f, roughness: .4 });

  const bodyScale = build === 'lean' ? .94 : build === 'heroic' ? 1.04 : 1;
  const shoulderWidth = (gender === 'girl' ? .44 : .5) * bodyScale;
  const hipWidth = gender === 'girl' ? .235 : .215;

  root.add(hips);
  hips.position.y = .72;

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(.33, 28, 22), pants);
  pelvis.scale.set(gender === 'girl' ? 1.08 : .98, .58, .72);
  pelvis.position.y = 0;
  hips.add(pelvis);

  chest.position.y = .72;
  hips.add(chest);
  const torso = capsule(gender === 'girl' ? .34 : .38, .9, cloth);
  torso.scale.set(bodyScale, 1, .58);
  torso.position.y = .42;
  chest.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.11, .135, .28, 20), skin);
  neck.position.y = 1.05;
  chest.add(neck);

  head.position.y = 1.33;
  chest.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.31, 40, 30), skin);
  skull.scale.set(.9, 1.07, .93);
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.24, 30, 22), skin);
  jaw.scale.set(.9, .56, .82);
  jaw.position.set(0, -.17, .02);
  head.add(jaw);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.32, 30, 18, 0, Math.PI * 2, 0, Math.PI * .5), hairMat);
  hair.position.y = .17;
  hair.scale.set(1.02, .58, 1.01);
  head.add(hair);
  for (const x of [-.105, .105]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.036, 14, 10), eyeWhite);
    eye.position.set(x, .02, .287);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), eyeDark);
    pupil.position.set(x, .02, .318);
    head.add(pupil);
  }
  const nose = capsule(.019, .075, skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -.055, .305); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.105, .014, .018), new THREE.MeshStandardMaterial({ color: 0x5a2e28, roughness: .55 }));
  mouth.position.set(0, -.16, .292); head.add(mouth);

  const addArm = (side: -1 | 1, shoulderJoint: THREE.Group, elbowJoint: THREE.Group) => {
    shoulderJoint.position.set(side * shoulderWidth, .72, 0);
    chest.add(shoulderJoint);
    const upper = capsule(.09, .55, skin); upper.position.y = -.3; shoulderJoint.add(upper);
    elbowJoint.position.y = -.62; shoulderJoint.add(elbowJoint);
    const forearm = capsule(.082, .5, skin); forearm.position.y = -.28; elbowJoint.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.095, 18, 14), skin); hand.scale.set(.78, 1.05, .78); hand.position.y = -.58; elbowJoint.add(hand);
  };
  addArm(-1, leftShoulder, leftElbow);
  addArm(1, rightShoulder, rightElbow);

  const addLeg = (side: -1 | 1, hipJoint: THREE.Group, kneeJoint: THREE.Group) => {
    hipJoint.position.set(side * hipWidth, -.08, 0);
    hips.add(hipJoint);
    const thigh = capsule(.115, .78, pants); thigh.position.y = -.43; hipJoint.add(thigh);
    kneeJoint.position.y = -.84; hipJoint.add(kneeJoint);
    const shin = capsule(.102, .74, pants); shin.position.y = -.4; kneeJoint.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(.24, .16, .46), shoeMat); shoe.position.set(0, -.84, .11); kneeJoint.add(shoe);
  };
  addLeg(-1, leftHip, leftKnee);
  addLeg(1, rightHip, rightKnee);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return { root, hips, chest, head, leftShoulder, rightShoulder, leftElbow, rightElbow, leftHip, rightHip, leftKnee, rightKnee };
}

function animateRig(rig: Rig, t: number) {
  const breathe = Math.sin(t * 1.8) * .018;
  rig.chest.rotation.z = Math.sin(t * .9) * .018;
  rig.chest.position.y = .72 + breathe;
  rig.head.rotation.y = Math.sin(t * .45) * .16;
  rig.head.rotation.x = Math.sin(t * .8) * .025;
  rig.leftShoulder.rotation.z = .06 + Math.sin(t * .9) * .035;
  rig.rightShoulder.rotation.z = -.06 - Math.sin(t * .9) * .035;
  rig.leftElbow.rotation.x = -.08 + Math.sin(t * .7) * .025;
  rig.rightElbow.rotation.x = -.08 - Math.sin(t * .7) * .025;
  rig.leftHip.rotation.x = Math.sin(t * .95) * .035;
  rig.rightHip.rotation.x = -Math.sin(t * .95) * .035;
  rig.leftKnee.rotation.x = Math.max(0, -Math.sin(t * .95)) * .035;
  rig.rightKnee.rotation.x = Math.max(0, Math.sin(t * .95)) * .035;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app'); if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? ''; let disposed = false; let renderer: THREE.WebGLRenderer | null = null; let raf = 0;
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const cleanup = () => { if (disposed) return; disposed = true; cancelAnimationFrame(raf); renderer?.dispose(); window.removeEventListener('resize', resize); const host = window as CleanupHost; if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null; };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true }); window.addEventListener('beforeunload', cleanup, { once: true });

  const user = getAuthSnapshot().user; if (!user) { location.replace('/tap-in.html?next=%2Favatar-characters.html'); return; }
  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {}); if (error) throw error; if (!isCurrent()) return;
  const snapshot = (data ?? {}) as Snapshot; const current = snapshot.avatar ?? {};
  const display = String(current.display_name ?? snapshot.profile?.display_name ?? snapshot.profile?.username ?? 'Rich Avatar');
  root.innerHTML = `<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS AVATAR STUDIO</small><h1>Build Your Character</h1></div><a href="/avatar.html" class="enter">OPEN LOBBY</a></header><section class="ac-layout"><div class="ac-stage"><div class="ac-stage-top"><span>FULL BODY 3D</span><b id="previewGender">BOY</b></div><canvas id="characterCanvas"></canvas><div class="ac-stage-copy"><strong id="previewName">${esc(display)}</strong><em id="previewStyle">ATHLETIC · STREET LUXE</em></div></div><aside class="ac-editor"><div class="section-title"><span>CHARACTER</span></div><div class="seg"><button data-gender="boy" class="active">BOY</button><button data-gender="girl">GIRL</button></div><label>NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET LUXE</option><option value="boss">RICH BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">Full-body rig saves into the lobby.</p></aside></section></main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfe5d6); scene.fog = new THREE.Fog(0xcfe5d6, 18, 38);
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 100); camera.position.set(0, 1.72, 8.7);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5f7564, 2.8));
  const key = new THREE.DirectionalLight(0xffffff, 3.4); key.position.set(4, 8, 5); key.castShadow = true; scene.add(key);
  const fill = new THREE.PointLight(0x78ffaf, 24, 14, 2); fill.position.set(-3, 2, 3); scene.add(fill);
  const gold = new THREE.PointLight(0xffd86a, 18, 12, 2); gold.position.set(3, 1.4, 3); scene.add(gold);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: 0xe7f1ea, roughness: .75 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.42; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), new THREE.MeshStandardMaterial({ color: 0xb8d7c1, roughness: .88 })); wall.position.set(0, 2.2, -5.5); scene.add(wall);

  let gender: 'boy' | 'girl' = 'boy';
  const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!;
  const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!;
  const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  const accent = () => auraInput.value === 'Neon Phantom' ? 0x8058ff : auraInput.value === 'Diamond Mist' ? 0x8fe8ff : 0x21ff82;
  let rig = createRig(gender, accent(), buildInput.value, styleInput.value); rig.root.position.y = .1; scene.add(rig.root);
  const rebuild = () => { scene.remove(rig.root); rig = createRig(gender, accent(), buildInput.value, styleInput.value); rig.root.position.y = .1; scene.add(rig.root); root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.options[styleInput.selectedIndex].text}`; };

  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((btn) => btn.onclick = () => { gender = btn.dataset.gender === 'girl' ? 'girl' : 'boy'; root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((x) => x.classList.toggle('active', x === btn)); root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase(); rebuild(); });
  buildInput.onchange = rebuild; styleInput.onchange = rebuild; auraInput.onchange = rebuild;
  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!; nameInput.oninput = () => { root.querySelector<HTMLElement>('#previewName')!.textContent = nameInput.value || 'Rich Avatar'; };
  root.querySelector<HTMLButtonElement>('#randomize')!.onclick = () => { gender = Math.random() > .5 ? 'girl' : 'boy'; buildInput.selectedIndex = Math.floor(Math.random() * buildInput.options.length); styleInput.selectedIndex = Math.floor(Math.random() * styleInput.options.length); auraInput.selectedIndex = Math.floor(Math.random() * auraInput.options.length); root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((x) => x.classList.toggle('active', x.dataset.gender === gender)); root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase(); rebuild(); };
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick = async () => { const status = root.querySelector<HTMLElement>('#saveStatus')!; status.textContent = 'Saving character…'; const { error: saveError } = await supabase.rpc('rb_save_avatar_studio', { p_display_name: nameInput.value || display, p_preset_key: `gta-${gender}`, p_aura: auraInput.value, p_outfit: { build: buildInput.value, style: styleInput.value, rig: 'gta-articulated-v1' }, p_accessories: {}, p_smoke: { mode: 'off' }, p_emotes: { idle: true, walk: true, run: true, jump: true, power: true }, p_character_type: gender === 'girl' ? 'female' : 'male' }); status.textContent = saveError ? saveError.message : 'Saved. Open the lobby to use the full-body character.'; };

  const clock = new THREE.Clock();
  const resize = () => { const r = canvas.getBoundingClientRect(); renderer!.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  const loop = () => { if (disposed) return; const t = clock.getElapsedTime(); animateRig(rig, t); rig.root.rotation.y = Math.sin(t * .35) * .12; renderer!.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
}
