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
import './avatar.characters.css';

type Snapshot = {
  profile?: Record<string, any>;
  avatar?: Record<string, any>;
  loadout?: Record<string, any>;
  model?: Record<string, any>;
};
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
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
  const abort = new AbortController();
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (runtime) disposeSkinnedAvatar(runtime);
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
  const loadout = snap.loadout ?? {};
  const outfit = loadout.outfit_config ?? current.metadata?.outfit ?? {};
  const display = String(current.display_name ?? loadout.display_name ?? snap.profile?.display_name ?? snap.profile?.username ?? 'Rich Avatar');
  const currentKind = String(current.character_type ?? 'male');
  let gender: AvatarGender = currentKind === 'female' ? 'girl' : 'boy';
  const initialBuild = String(outfit.build ?? 'athletic');
  const initialStyle = String(outfit.style ?? 'street');
  const initialAura = String(current.aura ?? loadout.aura_config?.name ?? 'Emerald Gold');

  root.innerHTML = `<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS CHARACTER GARAGE</small><h1>Choose Your Character</h1></div><a href="/avatar.html" class="enter">ENTER LOBBY</a></header><section class="ac-layout"><div class="ac-stage"><canvas id="characterCanvas"></canvas><div class="ac-stage-top"><span>SKINNED FULL BODY</span><b id="previewGender">${gender.toUpperCase()}</b></div><div class="ac-stage-copy"><strong id="previewName">${esc(display)}</strong><em id="previewStyle">${esc(initialBuild.toUpperCase())} · ${esc(initialStyle.toUpperCase())}</em></div><div class="ac-motion"><button data-motion="idle" class="active">IDLE</button><button data-motion="walk">WALK</button><button data-motion="run">RUN</button><button data-motion="power">POSE</button></div><div class="ac-loading" id="characterLoading">LOADING CHARACTER…</div></div><aside class="ac-editor"><div class="section-title"><span>CHARACTER</span></div><div class="seg"><button data-gender="boy" class="${gender === 'boy' ? 'active' : ''}">BOY</button><button data-gender="girl" class="${gender === 'girl' ? 'active' : ''}">GIRL</button></div><label>NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">Save once the character, motion and proportions look right.</p></aside></section></main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!;
  const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!;
  const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!;
  const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!;
  buildInput.value = ['athletic','lean','heroic'].includes(initialBuild) ? initialBuild : 'athletic';
  styleInput.value = ['street','boss','tactical','cyber'].includes(initialStyle) ? initialStyle : 'street';
  auraInput.value = ['Emerald Gold','Neon Phantom','Diamond Mist'].includes(initialAura) ? initialAura : 'Emerald Gold';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9d4df);
  scene.fog = new THREE.Fog(0xb9d4df, 16, 42);
  const camera = new THREE.PerspectiveCamera(34, 1, .08, 70);
  camera.position.set(0, 1.55, 4.8);
  const quality = qualityProfile();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xf5fcff, 0x5a655d, 2.7));
  const key = new THREE.DirectionalLight(0xfff0d3, 3.1);
  key.position.set(5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fd7ff, 1.35);
  fill.position.set(-5, 4, 3);
  scene.add(fill);
  const auraLight = new THREE.PointLight(auraColor(auraInput.value), 2.2, 7, 2);
  auraLight.position.set(-2, 1.4, 2.2);
  scene.add(auraLight);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 72), new THREE.MeshStandardMaterial({ color: 0x52605a, roughness: .82 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.02;
  floor.receiveShadow = true;
  scene.add(floor);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0x8aa9b3, roughness: .86 }));
  backWall.position.set(0, 2.15, -2.2);
  scene.add(backWall);

  let motion: AvatarMotion = 'idle';
  let loadGeneration = 0;
  let userYaw = 0;
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
    runtime.root.scale.x = xScale;
    runtime.root.updateMatrixWorld(true);
  };

  const loadCharacter = async () => {
    const generation = ++loadGeneration;
    const loading = root.querySelector<HTMLElement>('#characterLoading');
    if (loading) loading.textContent = 'LOADING CHARACTER…';
    if (runtime) {
      scene.remove(runtime.root);
      disposeSkinnedAvatar(runtime);
      runtime = null;
    }
    try {
      const next = await loadSkinnedAvatar({
        modelUrl: resolveAvatarModelUrl(modelSnapshotFor(gender), gender),
        targetHeight: gender === 'girl' ? 1.72 : 1.82,
        signal: abort.signal
      });
      if (!isCurrent() || generation !== loadGeneration) { disposeSkinnedAvatar(next); return; }
      runtime = next;
      runtime.root.position.set(0, 0, 0);
      runtime.root.rotation.y = userYaw;
      applyBuildScale();
      scene.add(runtime.root);
      setAvatarMotion(runtime, motion, 0);
      root.querySelector<HTMLElement>('#characterLoading')?.remove();
    } catch (loadError) {
      if (!isCurrent()) return;
      const target = root.querySelector<HTMLElement>('#characterLoading');
      if (target) target.textContent = `CHARACTER LOAD FAILED: ${loadError instanceof Error ? loadError.message : 'UNKNOWN ERROR'}`;
    }
  };

  await loadCharacter();

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
      if (runtime) setAvatarMotion(runtime, motion);
    };
  });

  buildInput.onchange = () => {
    applyBuildScale();
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
  };
  styleInput.onchange = () => {
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
  };
  auraInput.onchange = () => {
    auraLight.color.setHex(auraColor(auraInput.value));
  };
  nameInput.oninput = () => {
    root.querySelector<HTMLElement>('#previewName')!.textContent = nameInput.value || 'Rich Avatar';
  };

  root.querySelector<HTMLButtonElement>('#randomize')!.onclick = async () => {
    gender = Math.random() > .5 ? 'girl' : 'boy';
    buildInput.selectedIndex = Math.floor(Math.random() * buildInput.options.length);
    styleInput.selectedIndex = Math.floor(Math.random() * styleInput.options.length);
    auraInput.selectedIndex = Math.floor(Math.random() * auraInput.options.length);
    auraLight.color.setHex(auraColor(auraInput.value));
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((item) => item.classList.toggle('active', item.dataset.gender === gender));
    root.querySelector<HTMLElement>('#previewGender')!.textContent = gender.toUpperCase();
    root.querySelector<HTMLElement>('#previewStyle')!.textContent = `${buildInput.value.toUpperCase()} · ${styleInput.value.toUpperCase()}`;
    await loadCharacter();
  };

  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick = async () => {
    const status = root.querySelector<HTMLElement>('#saveStatus')!;
    status.textContent = 'Saving character…';
    const presetKey = gender === 'girl' ? 'street_queen_hd' : 'street_king_hd';
    const { error: saveError } = await supabase.rpc('rb_save_avatar_studio', {
      p_display_name: nameInput.value || display,
      p_preset_key: presetKey,
      p_aura: auraInput.value,
      p_outfit: { build: buildInput.value, style: styleInput.value, rig: 'skinned-humanoid-v1' },
      p_accessories: {},
      p_smoke: { mode: 'off' },
      p_emotes: { idle: true, walk: true, run: true, jump: true, power: true },
      p_character_type: gender === 'girl' ? 'female' : 'male'
    });
    status.textContent = saveError ? saveError.message : 'Saved. This character is now linked to your lobby loadout.';
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
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  const loop = () => {
    if (disposed || !renderer) return;
    const dt = Math.min(clock.getDelta(), .04);
    if (runtime) {
      updateSkinnedAvatar(runtime, dt);
      const target = new THREE.Vector3(0, runtime.height * .52, 0);
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();
}
