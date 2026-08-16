import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.characters.css';

type Snapshot = { profile?: Record<string, any>; avatar?: Record<string, any>; presets?: Array<Record<string, any>> };
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));

function makeCharacter(gender: 'boy' | 'girl', accent: number, build: string, style: string) {
  const root = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: gender === 'girl' ? 0x9a664c : 0x8d5d42, roughness: .46, metalness: .01, clearcoat: .12, clearcoatRoughness: .55 });
  const outfit = new THREE.MeshPhysicalMaterial({ color: accent, roughness: .22, metalness: .18, clearcoat: .6, clearcoatRoughness: .18 });
  const dark = new THREE.MeshPhysicalMaterial({ color: style === 'boss' ? 0x141717 : 0x0f1513, roughness: .34, metalness: .2, clearcoat: .25 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .26, metalness: .02 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
  const eyeDark = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: .45 });

  const scaleX = build === 'lean' ? .91 : build === 'heroic' ? 1.035 : 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.355, 40, 30), skin); head.scale.set(.92, 1.05, .94); head.position.y = 2.92; root.add(head);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.29, 32, 24), skin); jaw.scale.set(.9, .62, .82); jaw.position.set(0, 2.73, .03); root.add(jaw);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.125, .15, .34, 24), skin); neck.position.y = 2.46; root.add(neck);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(gender === 'girl' ? .39 : .44, 1.06, 12, 28), outfit); torso.position.y = 1.72; torso.scale.set(scaleX, 1, .56); root.add(torso);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(.33, .38, .42, 28), dark); waist.position.y = .95; waist.scale.x = gender === 'girl' ? 1.04 : .94; root.add(waist);
  const shoulder = (gender === 'girl' ? .48 : .54) * scaleX;
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.105, .7, 10, 20), skin); upper.position.set(side * shoulder, 1.74, 0); upper.rotation.z = side * .02; root.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(.095, .64, 10, 20), skin); lower.position.set(side * shoulder, 1.08, .015); root.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.115, 20, 16), skin); hand.scale.set(.82, 1.1, .82); hand.position.set(side * shoulder, .69, .02); root.add(hand);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.135, .94, 10, 20), dark); thigh.position.set(side * .205, .22, 0); root.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .9, 10, 20), dark); shin.position.set(side * .205, -.66, 0); root.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(.27, .16, .49), dark); shoe.position.set(side * .205, -1.15, .13); shoe.scale.y = .88; root.add(shoe);
  }
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.365, 32, 20, 0, Math.PI * 2, 0, Math.PI * .48), hair); hairCap.position.set(0, 3.125, -.01); hairCap.scale.set(1.03, .58, 1.02); root.add(hairCap);
  for (const x of [-.125, .125]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.043, 16, 12), eyeWhite); eye.position.set(x, 2.93, .325); root.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.019, 12, 10), eyeDark); pupil.position.set(x, 2.93, .361); root.add(pupil);
  }
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: .6 });
  for (const x of [-.125, .125]) { const brow = new THREE.Mesh(new THREE.BoxGeometry(.12, .018, .025), browMat); brow.position.set(x, 3.015, .34); brow.rotation.z = x < 0 ? -.06 : .06; root.add(brow); }
  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(.025, .09, 6, 12), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.86, .37); root.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.13, .018, .02), new THREE.MeshStandardMaterial({ color: 0x4a211d, roughness: .55 })); mouth.position.set(0, 2.72, .355); root.add(mouth);
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { const m = o as THREE.Mesh; m.castShadow = true; m.receiveShadow = true; } });
  return root;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app'); if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? ''; let disposed = false; let renderer: THREE.WebGLRenderer | null = null; let raf = 0;
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const cleanup = () => { if (disposed) return; disposed = true; cancelAnimationFrame(raf); renderer?.dispose(); window.removeEventListener('resize', resize); const host = window as CleanupHost; if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null; };
  (window as CleanupHost).__rbPageCleanup = cleanup; window.addEventListener('pagehide', cleanup, { once: true }); window.addEventListener('beforeunload', cleanup, { once: true });
  const user = getAuthSnapshot().user; if (!user) { location.replace('/tap-in.html?next=%2Favatar-characters.html'); return; }
  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {}); if (error) throw error; if (!isCurrent()) return;
  const snapshot = (data ?? {}) as Snapshot; const current = snapshot.avatar ?? {}; const display = String(current.display_name ?? snapshot.profile?.display_name ?? snapshot.profile?.username ?? 'Rich Avatar');
  root.innerHTML = `<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS AVATAR STUDIO</small><h1>Build Your Character</h1><p>GTA-inspired character creator with a clean Snap-style workflow.</p></div><a href="/avatar.html" class="enter">OPEN LOBBY</a></header><section class="ac-layout"><div class="ac-stage"><div class="ac-stage-top"><span>LIVE 3D PREVIEW</span><b id="previewGender">BOY</b></div><canvas id="characterCanvas"></canvas><div class="ac-stage-copy"><strong id="previewName">${esc(display)}</strong><em id="previewStyle">ATHLETIC · STREET LUXE</em></div></div><aside class="ac-editor"><div class="section-title"><span>IDENTITY</span><small>01</small></div><div class="seg"><button data-gender="boy" class="active">BOY</button><button data-gender="girl">GIRL</button></div><label>NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET LUXE</option><option value="boss">RICH BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">Save once and the same character loads inside the lobby.</p></aside></section></main>`;
  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!; const scene = new THREE.Scene(); scene.background = new THREE.Color(0x7aa98a); scene.fog = new THREE.Fog(0x7aa98a, 14, 30);
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 100); camera.position.set(0, 2.0, 8.35);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.65; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xf4fff7, 0x36533d, 3.1)); const key = new THREE.DirectionalLight(0xffffff, 4.2); key.position.set(4.5, 8, 6); key.castShadow = true; scene.add(key); const fill = new THREE.PointLight(0xb8ffd0, 48, 16, 2); fill.position.set(-3, 3, 4); scene.add(fill); const gold = new THREE.PointLight(0xffdd72, 30, 12, 2); gold.position.set(3, 1.6, 4); scene.add(gold);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.4, 72), new THREE.MeshStandardMaterial({ color: 0xc8e6cf, roughness: .6, metalness: .05 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.25; floor.receiveShadow = true; scene.add(floor);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x5c8e68, roughness: .9 })); backdrop.position.set(0, 2.3, -5.5); scene.add(backdrop);
  const skyline = new THREE.Group(); for (let i = 0; i < 10; i++) { const h = 2.6 + Math.random() * 3; const b = new THREE.Mesh(new THREE.BoxGeometry(.8 + Math.random() * .8, h, .7), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x6f9e78 : 0x84af8c, roughness: .78 })); b.position.set((i - 4.5) * 1.2, h / 2 - 1.2, -4.8 - Math.random() * .5); skyline.add(b); } scene.add(skyline);
  let gender: 'boy' | 'girl' = 'boy'; const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!; const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!; const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  let character = makeCharacter(gender, 0x21ff82, buildInput.value, styleInput.value); character.position.y = .15; scene.add(character);
  const accent = () => auraInput.value === 'Neon Phantom' ? 0x8058ff : auraInput.value === 'Diamond Mist' ? 0x8fe8ff : 0x21ff82;
  const rebuild = () => { scene.remove(character); character = makeCharacter(gender, accent(), buildInput.value, styleInput.value); character.position.y = .15; scene.add(character); root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.options[styleInput.selectedIndex].text}`; };
  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((btn) => btn.onclick = () => { gender = btn.dataset.gender === 'girl' ? 'girl' : 'boy'; root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((x) => x.classList.toggle('active', x === btn)); root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase(); rebuild(); });
  buildInput.onchange = rebuild; styleInput.onchange = rebuild; auraInput.onchange = rebuild;
  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!; nameInput.oninput = () => { root.querySelector<HTMLElement>('#previewName')!.textContent = nameInput.value || 'Rich Avatar'; };
  root.querySelector<HTMLButtonElement>('#randomize')!.onclick = () => { gender = Math.random() > .5 ? 'girl' : 'boy'; root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((x) => x.classList.toggle('active', x.dataset.gender === gender)); root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase(); buildInput.selectedIndex = Math.floor(Math.random() * buildInput.options.length); styleInput.selectedIndex = Math.floor(Math.random() * styleInput.options.length); auraInput.selectedIndex = Math.floor(Math.random() * auraInput.options.length); rebuild(); };
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick = async () => { const status = root.querySelector<HTMLElement>('#saveStatus')!; status.textContent = 'Saving character…'; const { error: saveError } = await supabase.rpc('rb_save_avatar_studio', { p_display_name: nameInput.value || display, p_preset_key: `gta-${gender}`, p_aura: auraInput.value, p_outfit: { build: buildInput.value, style: styleInput.value, rig: 'gta-avatar-v2' }, p_accessories: {}, p_smoke: { mode: 'off' }, p_emotes: { idle: true, walk: true, run: true, jump: true, power: true }, p_character_type: gender === 'girl' ? 'female' : 'male' }); status.textContent = saveError ? saveError.message : 'Saved. Open the lobby to use this character.'; };
  const clock = new THREE.Clock(); const animate = () => { if (disposed) return; const t = clock.getElapsedTime(); character.rotation.y = Math.sin(t * .45) * .18; character.position.y = .15 + Math.sin(t * 1.7) * .012; renderer!.render(scene, camera); raf = requestAnimationFrame(animate); };
  const resize = () => { const r = canvas.getBoundingClientRect(); renderer!.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }; window.addEventListener('resize', resize); resize(); animate();
}
