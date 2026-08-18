import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { createGtaAvatar, disposeGtaAvatar, poseGtaAvatar, qualityProfile, type AvatarGender, type AvatarMotion, type GtaAvatarRig } from './avatar.gta.rig';
import './avatar.characters.css';

type Snapshot = { profile?: Record<string, any>; avatar?: Record<string, any> };
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let rig: GtaAvatarRig | null = null;
  let raf = 0;
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const resize = () => {
    const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas');
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
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
  if (!user) { location.replace('/tap-in.html?next=%2Favatar-characters.html'); return; }
  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {});
  if (error) throw error;
  if (!isCurrent()) return;

  const snap = (data ?? {}) as Snapshot;
  const current = snap.avatar ?? {};
  const display = String(current.display_name ?? snap.profile?.display_name ?? snap.profile?.username ?? 'Rich Avatar');
  const currentKind = String(current.character_type ?? 'male');
  let gender: AvatarGender = currentKind === 'female' ? 'girl' : 'boy';
  const outfit = current.outfit ?? {};
  const initialBuild = String(outfit.build ?? 'athletic');
  const initialStyle = String(outfit.style ?? 'street');
  const initialAura = String(current.aura ?? 'Emerald Gold');

  root.innerHTML = `<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS CHARACTER GARAGE</small><h1>Character Select</h1></div><a href="/avatar.html" class="enter">ENTER LOBBY</a></header><section class="ac-layout"><div class="ac-stage"><div class="ac-stage-top"><span>GTA-STYLE FULL BODY</span><b id="previewGender">${gender.toUpperCase()}</b></div><canvas id="characterCanvas"></canvas><div class="ac-stage-copy"><strong id="previewName">${esc(display)}</strong><em id="previewStyle">${esc(initialBuild.toUpperCase())} · ${esc(initialStyle.toUpperCase())}</em></div><div class="ac-motion"><button data-motion="idle" class="active">IDLE</button><button data-motion="walk">WALK</button><button data-motion="run">RUN</button><button data-motion="power">POSE</button></div></div><aside class="ac-editor"><div class="section-title"><span>CHARACTER</span></div><div class="seg"><button data-gender="boy" class="${gender === 'boy' ? 'active' : ''}">BOY</button><button data-gender="girl" class="${gender === 'girl' ? 'active' : ''}">GIRL</button></div><label>NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">Saved character becomes the playable lobby character.</p></aside></section></main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7f9eac);
  scene.fog = new THREE.Fog(0x7f9eac, 18, 42);
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
  camera.position.set(0, 2.15, 7.35);
  const quality = qualityProfile();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x303b34, 2.1));
  const sun = new THREE.DirectionalLight(0xfff1d4, 3.4); sun.position.set(5, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x5bb8ff, 1.25); rim.position.set(-5, 4, -4); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 72), new THREE.MeshStandardMaterial({ color: 0x262b29, roughness: .88 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; floor.receiveShadow = true; scene.add(floor);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.11, 7), new THREE.MeshBasicMaterial({ color: 0xe9cf58 })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, .01, -1.4); scene.add(stripe);
  for (const x of [-3.2, 3.2]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(1.5, .16, 8), new THREE.MeshStandardMaterial({ color: 0x707a73, roughness: .9 })); curb.position.set(x, .08, -1.2); scene.add(curb);
  }

  const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!;
  const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!;
  const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  buildInput.value = ['athletic','lean','heroic'].includes(initialBuild) ? initialBuild : 'athletic';
  styleInput.value = ['street','boss','tactical','cyber'].includes(initialStyle) ? initialStyle : 'street';
  auraInput.value = ['Emerald Gold','Neon Phantom','Diamond Mist'].includes(initialAura) ? initialAura : 'Emerald Gold';
  const accent = () => auraInput.value === 'Neon Phantom' ? 0x7d59ff : auraInput.value === 'Diamond Mist' ? 0x86dcff : 0x22e981;
  let motion: AvatarMotion = 'idle';

  const rebuild = () => {
    if (rig) { scene.remove(rig.root); disposeGtaAvatar(rig); }
    rig = createGtaAvatar({ gender, accent: accent(), build: buildInput.value, style: styleInput.value });
    rig.root.position.set(0, 0, 0);
    scene.add(rig.root);
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
  };
  rebuild();

  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(btn => btn.onclick = () => {
    gender = btn.dataset.gender === 'girl' ? 'girl' : 'boy';
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(x => x.classList.toggle('active', x === btn));
    root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase();
    rebuild();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(btn => btn.onclick = () => {
    motion = (btn.dataset.motion ?? 'idle') as AvatarMotion;
    root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(x => x.classList.toggle('active', x === btn));
  });
  buildInput.onchange = rebuild;
  styleInput.onchange = rebuild;
  auraInput.onchange = rebuild;

  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!;
  nameInput.oninput = () => { root.querySelector<HTMLElement>('#previewName')!.textContent = nameInput.value || 'Rich Avatar'; };
  root.querySelector<HTMLButtonElement>('#randomize')!.onclick = () => {
    gender = Math.random() > .5 ? 'girl' : 'boy';
    buildInput.selectedIndex = Math.floor(Math.random() * buildInput.options.length);
    styleInput.selectedIndex = Math.floor(Math.random() * styleInput.options.length);
    auraInput.selectedIndex = Math.floor(Math.random() * auraInput.options.length);
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(x => x.classList.toggle('active', x.dataset.gender === gender));
    root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase();
    rebuild();
  };
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick = async () => {
    const status = root.querySelector<HTMLElement>('#saveStatus')!;
    status.textContent = 'Saving character…';
    const { error: saveError } = await supabase.rpc('rb_save_avatar_studio', {
      p_display_name: nameInput.value || display,
      p_preset_key: `gta-${gender}`,
      p_aura: auraInput.value,
      p_outfit: { build: buildInput.value, style: styleInput.value, rig: 'gta-articulated-v3' },
      p_accessories: {},
      p_smoke: { mode: 'off' },
      p_emotes: { idle: true, walk: true, run: true, jump: true, power: true },
      p_character_type: gender === 'girl' ? 'female' : 'male'
    });
    status.textContent = saveError ? saveError.message : 'Saved. Your lobby now uses this character.';
  };

  window.addEventListener('resize', resize);
  const clock = new THREE.Clock();
  const loop = () => {
    if (disposed || !rig || !renderer) return;
    const t = clock.getElapsedTime();
    poseGtaAvatar(rig, t, motion, motion === 'power' ? 1 : 0);
    rig.root.rotation.y = motion === 'idle' ? Math.sin(t * .32) * .14 : 0;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  resize();
  loop();
}
