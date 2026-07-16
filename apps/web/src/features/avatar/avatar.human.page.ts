import * as THREE from 'three';
import { mountHumanUi } from './avatar.human.ui';
import { createHumanRig, animateHumanRig, HumanRig } from './avatar.human.rig';
import { supabase } from '../../core/supabase/client';
import './avatar.css';

type Row = Record<string, any>;
type Preset = {
  preset_key: string;
  title: string;
  aura: string;
  outfit: string;
  motion: string;
  config: Record<string, string>;
};

const palettes: Record<string, { primary: number; secondary: number; skin: number }> = {
  'Emerald Gold': { primary: 0x31ff63, secondary: 0xf7c948, skin: 0x70442f },
  'Diamond Mist': { primary: 0x8fe8ff, secondary: 0xd99cff, skin: 0x9a6248 },
  'Neon Phantom': { primary: 0x56ffde, secondary: 0x7740ff, skin: 0x4f2d21 }
};

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace('/tap-in.html?next=%2Favatar.html');
    return;
  }

  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {});
  if (error) throw error;

  const snapshot = (data ?? {}) as Row;
  const profile = snapshot.profile ?? {};
  const avatar = snapshot.avatar ?? {};
  const presets = (snapshot.presets ?? []) as Preset[];
  let preset = presets.find((item) => item.preset_key === avatar.metadata?.preset_key) ?? presets[0];
  let aura = String(avatar.aura ?? preset?.aura ?? 'Emerald Gold');

  const ui = mountHumanUi(root, {
    name: String(avatar.display_name ?? profile.display_name ?? profile.username ?? 'Rich Avatar'),
    level: Number(avatar.level ?? profile.rich_level ?? 1),
    xp: Number(avatar.xp ?? 0),
    rank: String(avatar.rank ?? profile.rank_title ?? 'Rookie Rich'),
    presets,
    aura
  });

  const renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020402, .022);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 120);
  const actor = new THREE.Group();
  actor.rotation.y = -.12;
  scene.add(actor);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x071008, 2.35));
  const key = new THREE.DirectionalLight(0xffffff, 4.8);
  key.position.set(5, 10, 7);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.PointLight(0xf7c948, 20, 15);
  fill.position.set(4, 3.5, 4);
  scene.add(fill);
  const rim = new THREE.PointLight(0x31ff63, 34, 18);
  rim.position.set(-4, 4.5, -2);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(5.3, 5.8, .3, 80),
    new THREE.MeshStandardMaterial({ color: 0x071108, metalness: .82, roughness: .24 })
  );
  floor.position.y = -.16;
  floor.receiveShadow = true;
  scene.add(floor);

  const streetRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.1, .035, 10, 96),
    new THREE.MeshBasicMaterial({ color: 0x31ff63, transparent: true, opacity: .8 })
  );
  streetRing.rotation.x = Math.PI / 2;
  streetRing.position.y = .03;
  scene.add(streetRing);

  let rig = {} as HumanRig;
  function rebuild() {
    actor.clear();
    const colors = palettes[aura] ?? palettes['Emerald Gold'];
    rig = createHumanRig(colors, preset?.config.body_type === 'female');
    actor.add(rig.root);
    rim.color.setHex(colors.primary);
    streetRing.material.color.setHex(colors.primary);
    document.documentElement.style.setProperty('--avatar-accent', `#${colors.primary.toString(16).padStart(6, '0')}`);
  }
  rebuild();

  let yaw = -.12;
  let pitch = .02;
  let zoom = 10.4;
  let focusY = 2.18;
  let drag = false;
  let lastX = 0;
  let lastY = 0;
  let jump = 0;
  let grounded = true;
  let action = 'none';
  let until = 0;
  let touch = { x: 0, y: 0 };
  let raf = 0;
  const keys = new Set<string>();
  const clock = new THREE.Clock();
  const velocity = new THREE.Vector3();

  const trigger = (next: string) => {
    action = next;
    until = performance.now() + 1500;
    ui.state.textContent = next.toUpperCase();
  };

  const resize = () => {
    const width = Math.max(1, ui.stage.clientWidth);
    const height = Math.max(1, ui.stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 700 ? 37 : 34;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(ui.stage);
  resize();

  const keyDown = (event: KeyboardEvent) => {
    keys.add(event.code);
    if (event.code === 'Space' && grounded) {
      jump = 6.7;
      grounded = false;
    }
  };
  const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  ui.canvas.onpointerdown = (event) => {
    drag = true;
    lastX = event.clientX;
    lastY = event.clientY;
    ui.canvas.setPointerCapture(event.pointerId);
  };
  ui.canvas.onpointermove = (event) => {
    if (!drag) return;
    yaw -= (event.clientX - lastX) * .008;
    pitch = Math.max(-.10, Math.min(.20, pitch + (event.clientY - lastY) * .003));
    lastX = event.clientX;
    lastY = event.clientY;
  };
  ui.canvas.onpointerup = () => { drag = false; };

  ui.onCamera = (mode) => {
    if (mode === 'portrait') {
      zoom = 6.4;
      focusY = 3.02;
      pitch = .015;
    } else if (mode === 'street') {
      zoom = 11.8;
      focusY = 2.05;
      pitch = .015;
    } else {
      zoom = 10.4;
      focusY = 2.18;
      pitch = .02;
    }
  };
  ui.onMotion = trigger;
  ui.onAction = (next) => {
    if (next === 'jump' && grounded) {
      jump = 6.7;
      grounded = false;
    } else if (next === 'sprint') {
      keys.add('ShiftLeft');
    } else {
      trigger(next);
    }
  };
  ui.onActionEnd = (next) => {
    if (next === 'sprint') keys.delete('ShiftLeft');
  };
  ui.onJoystick = (value) => { touch = value; };
  ui.onAura = (value) => {
    aura = value;
    rebuild();
    ui.refresh(preset, aura);
  };
  ui.onPreset = (value) => {
    preset = presets.find((item) => item.preset_key === value) ?? preset;
    aura = preset?.aura ?? aura;
    rebuild();
    ui.refresh(preset, aura);
  };
  ui.onReset = () => {
    yaw = -.12;
    pitch = .02;
    zoom = 10.4;
    focusY = 2.18;
    actor.position.set(0, 0, 0);
  };
  ui.onSave = async () => {
    ui.status.textContent = 'Saving GTA-style human character…';
    const { error: saveError } = await supabase.rpc('rb_save_avatar_studio', {
      p_display_name: ui.nameInput.value.trim(),
      p_preset_key: preset?.preset_key ?? 'boss',
      p_aura: aura,
      p_outfit: {
        preset: preset?.outfit ?? 'Rich Street',
        character: preset?.config ?? {},
        rig: 'human-v4-street-proportioned'
      },
      p_accessories: {},
      p_smoke: { mode: 'cinematic', intensity: 'elite' },
      p_emotes: { idle: true, power_up: true, combat_pose: true },
      p_character_type: preset?.preset_key ?? 'custom'
    });
    ui.status.textContent = saveError ? saveError.message : 'GTA-style human character synced everywhere.';
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const delta = Math.min(clock.getDelta(), .033);
    const time = clock.elapsedTime;
    const x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touch.x;
    const z = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + touch.y;
    const moving = Math.abs(x) + Math.abs(z) > .08;
    const sprinting = keys.has('ShiftLeft');
    const locomotion = !grounded ? 'jump' : moving ? (sprinting ? 'run' : 'walk') : 'idle';

    if (performance.now() > until) action = 'none';
    velocity.lerp(new THREE.Vector3(x * (sprinting ? 5.5 : 3.1), 0, z * (sprinting ? 5.5 : 3.1)), Math.min(1, delta * 8));
    actor.position.addScaledVector(velocity, delta);
    jump -= 18 * delta;
    actor.position.y = Math.max(0, actor.position.y + jump * delta);
    if (actor.position.y <= 0) {
      actor.position.y = 0;
      jump = 0;
      grounded = true;
    }

    animateHumanRig(rig, time, moving, sprinting, action);
    ui.state.textContent = (action === 'none' ? locomotion : action).toUpperCase();

    camera.position.set(
      actor.position.x + Math.sin(yaw) * Math.cos(pitch) * zoom,
      focusY + actor.position.y + Math.sin(pitch) * zoom,
      actor.position.z + Math.cos(yaw) * Math.cos(pitch) * zoom
    );
    camera.lookAt(actor.position.x, focusY + actor.position.y, actor.position.z);
    renderer.render(scene, camera);
  };
  loop();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    renderer.dispose();
    ui.cleanup();
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}