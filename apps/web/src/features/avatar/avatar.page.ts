import * as THREE from 'three';
import { supabase } from '../../core/supabase/client';
import './avatar.css';

type JsonMap = Record<string, unknown>;
type Preset = {
  preset_key: string;
  title: string;
  aura: string;
  outfit: string;
  motion: string;
  config: Record<string, string>;
};
type Item = {
  item_key: string;
  item_type: string;
  title: string;
  rarity: string;
};
type Clip = { clip_key: string; title: string; state_group: string };
type Snapshot = {
  profile?: JsonMap;
  avatar?: JsonMap;
  model?: JsonMap;
  controller?: JsonMap;
  motion?: JsonMap;
  presets?: Preset[];
  items?: Item[];
  clips?: Clip[];
  inventory?: Array<{ item: Item; equipped: boolean }>;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>'"]/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character,
  );

const palettes = {
  'Emerald Gold': { primary: 0x31ff63, secondary: 0xf7c948, smoke: 0x8dffad, skin: 0x6f3e27 },
  'Diamond Mist': { primary: 0xc5e9ff, secondary: 0xb574ff, smoke: 0xe2f7ff, skin: 0x9a5b3e },
  'Neon Phantom': { primary: 0x56ffde, secondary: 0x7740ff, smoke: 0x9f8cff, skin: 0x4a281c },
} as const;

type PaletteName = keyof typeof palettes;

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace('/tap-in.html?next=%2Favatar.html');
    return;
  }

  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {});
  if (error) throw error;

  const snapshot = (data ?? {}) as unknown as Snapshot;
  const profile = snapshot.profile ?? {};
  const avatar = snapshot.avatar ?? {};
  const presets = snapshot.presets ?? [];
  const items = snapshot.items ?? [];
  const clips = snapshot.clips ?? [];
  const equipped = new Map<string, string>();

  for (const inventoryRow of snapshot.inventory ?? []) {
    if (inventoryRow.equipped) equipped.set(inventoryRow.item.item_type, inventoryRow.item.item_key);
  }

  const savedPresetKey = String((avatar.metadata as JsonMap | undefined)?.preset_key ?? '');
  let selectedPreset = presets.find((preset) => preset.preset_key === savedPresetKey) ?? presets[0];
  let selectedAura = String(avatar.aura ?? selectedPreset?.aura ?? 'Emerald Gold') as PaletteName;
  let selectedMotion = selectedPreset?.motion ?? clips[0]?.title ?? 'Boss Idle';

  root.innerHTML = `
    <main class="avatar-shell">
      <header class="avatar-top">
        <a href="/portal.html" aria-label="Back to portal">←</a>
        <div><p>RICH BIZNESS CHARACTER UNIVERSE</p><h1>Avatar Command Center</h1></div>
        <div class="avatar-live"><i></i> REALTIME 3D</div>
      </header>

      <section class="avatar-workspace">
        <div class="avatar-stage">
          <canvas id="avatarCanvas"></canvas>
          <div class="avatar-hud">
            <div>
              <span id="motionState">IDLE</span>
              <b id="stageName">${escapeHtml(avatar.display_name ?? profile.display_name ?? profile.username ?? 'Rich Avatar')}</b>
              <small id="stagePreset"></small>
            </div>
            <div class="avatar-meter">
              <span>LEVEL ${escapeHtml(avatar.level ?? profile.rich_level ?? 1)}</span>
              <span>${escapeHtml(avatar.xp ?? 0)} XP</span>
              <span>${escapeHtml(avatar.rank ?? profile.rank_title ?? 'Traveler')}</span>
            </div>
          </div>
          <div class="avatar-mobile-controls">
            <div id="joystick" class="avatar-joystick"><i></i></div>
            <div>
              <button data-action="jump">JUMP</button>
              <button data-action="sprint">RUN</button>
              <button data-action="power">POWER</button>
              <button data-action="combat">COMBAT</button>
            </div>
          </div>
        </div>

        <aside class="avatar-console">
          <section>
            <h3>CHARACTER IDENTITY</h3>
            <label>DISPLAY NAME
              <input id="displayName" maxlength="80" value="${escapeHtml(avatar.display_name ?? profile.display_name ?? profile.username ?? '')}">
            </label>
            <div id="identityTags" class="avatar-runtime-strip"></div>
          </section>

          <section><h3>CHARACTER UNIVERSE</h3><div id="presetOptions" class="avatar-grid"></div></section>

          <section>
            <h3>AURA + MOTION ENGINE</h3>
            <label>AURA
              <select id="auraSelect">${Object.keys(palettes).map((name) => `<option>${name}</option>`).join('')}</select>
            </label>
            <label>MOTION
              <select id="motionSelect">${clips.map((clip) => `<option value="${escapeHtml(clip.title)}">${escapeHtml(clip.title)} · ${escapeHtml(clip.state_group)}</option>`).join('')}</select>
            </label>
            <div class="avatar-command-row">
              <button data-emote="power">POWER UP</button>
              <button data-emote="dance">DANCE FLEX</button>
              <button data-emote="smoke">SMOKE BURST</button>
              <button data-emote="combat">COMBAT POSE</button>
            </div>
          </section>

          <section><h3>UNIVERSAL GEAR LOADOUT</h3><div id="gearOptions" class="avatar-grid"></div></section>

          <section>
            <h3>CONTROLLER + WORLD STATE</h3>
            <div class="avatar-runtime-grid">
              <article><small>CONTROL</small><b>${escapeHtml(snapshot.controller?.input_scheme ?? 'dual-stick')}</b></article>
              <article><small>CAMERA</small><b>${escapeHtml(snapshot.controller?.camera_mode ?? 'third-person')}</b></article>
              <article><small>MODEL</small><b>${escapeHtml(snapshot.model?.title ?? 'Procedural Elite')}</b></article>
              <article><small>SYNC</small><b>Realtime</b></article>
            </div>
          </section>

          <div class="avatar-save-row">
            <button id="resetBtn">RESET WORLD</button>
            <button id="saveBtn" class="primary">SAVE CHARACTER UNIVERSE</button>
          </div>
          <p id="status"></p>
        </aside>
      </section>
    </main>`;

  const canvas = document.querySelector<HTMLCanvasElement>('#avatarCanvas')!;
  const stage = canvas.parentElement!;
  const status = document.querySelector<HTMLElement>('#status')!;
  const motionState = document.querySelector<HTMLElement>('#motionState')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020402, 0.045);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  const world = new THREE.Group();
  const avatarRoot = new THREE.Group();
  const body = new THREE.Group();
  const gear = new THREE.Group();
  const smoke = new THREE.Group();
  scene.add(world);
  world.add(avatarRoot);
  avatarRoot.add(body, gear, smoke);

  scene.add(new THREE.HemisphereLight(0xdfffe6, 0x071008, 2.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
  keyLight.position.set(4, 8, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x31ff63, 30, 16);
  rimLight.position.set(-4, 3, -2);
  scene.add(rimLight);
  const goldLight = new THREE.PointLight(0xf7c948, 24, 14);
  goldLight.position.set(4, 2, 3);
  scene.add(goldLight);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 5.5, 0.36, 96),
    new THREE.MeshStandardMaterial({ color: 0x071108, metalness: 0.82, roughness: 0.22 }),
  );
  floor.position.y = -0.22;
  floor.receiveShadow = true;
  world.add(floor);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x31ff63 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.045, 12, 120), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  world.add(ring);

  for (let index = 0; index < 110; index += 1) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 5, 5),
      new THREE.MeshBasicMaterial({ color: index % 5 ? 0xffffff : 0xf7c948 }),
    );
    star.position.set((Math.random() - 0.5) * 25, Math.random() * 12 + 1, (Math.random() - 0.5) * 22 - 3);
    scene.add(star);
  }

  for (let index = 0; index < 32; index += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.random() * 0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x8dffad, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    puff.userData = { baseY: Math.random() * 2.8, time: Math.random() * 8, speed: 0.22 + Math.random() * 0.38 };
    smoke.add(puff);
  }

  let limbs = { leftArm: new THREE.Group(), rightArm: new THREE.Group(), leftLeg: new THREE.Group(), rightLeg: new THREE.Group() };

  function rebuildCharacter(): void {
    body.clear();
    gear.clear();
    const palette = palettes[selectedAura] ?? palettes['Emerald Gold'];
    const config = selectedPreset?.config ?? {};
    const heroic = config.build === 'heroic';
    const stylized = config.build === 'stylized';
    const feminine = config.body_type === 'female';
    const scale = heroic ? 1.12 : stylized ? 0.95 : 1;
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: selectedPreset?.preset_key === 'anime_villain' ? 0x12091b : 0x171b18,
      metalness: 0.28,
      roughness: 0.42,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.68 });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: palette.secondary,
      metalness: 0.88,
      roughness: 0.14,
      emissive: palette.secondary,
      emissiveIntensity: 0.08,
    });

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(feminine ? 0.64 : 0.74, heroic ? 1.45 : 1.25, 8, 18),
      bodyMaterial,
    );
    torso.position.y = 2.55;
    torso.scale.set((feminine ? 0.92 : 1.05) * scale, 1, 0.72);
    torso.castShadow = true;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(stylized ? 0.56 : 0.48, 32, 24), skinMaterial);
    head.position.y = 4.05;
    head.scale.set(0.92, 1.08, 0.92);
    head.castShadow = true;
    body.add(head);

    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.62, 8), bodyMaterial);
    hair.position.y = 4.52;
    if (config.hair === 'long-wave') hair.scale.set(1.12, 1.4, 1.12);
    body.add(hair);

    const makeLimb = (x: number, y: number, length: number, radius: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), bodyMaterial);
      mesh.position.y = -length / 2;
      mesh.castShadow = true;
      pivot.add(mesh);
      body.add(pivot);
      return pivot;
    };
    limbs = {
      leftArm: makeLimb(-0.82 * scale, 3.05, 1.45, 0.18),
      rightArm: makeLimb(0.82 * scale, 3.05, 1.45, 0.18),
      leftLeg: makeLimb(-0.37, 1.95, 1.85, 0.24),
      rightLeg: makeLimb(0.37, 1.95, 1.85, 0.24),
    };

    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 10, 55), accentMaterial);
    chain.position.set(0, 3.3, 0.63);
    chain.rotation.x = Math.PI / 2;
    gear.add(chain);

    for (const [type, itemKey] of equipped.entries()) {
      if (!items.some((item) => item.item_key === itemKey)) continue;
      if (type === 'head') {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.58, 6), accentMaterial);
        crown.position.y = 4.65;
        gear.add(crown);
      }
      if (type === 'face') {
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.14), new THREE.MeshBasicMaterial({ color: palette.primary }));
        visor.position.set(0, 4.08, 0.46);
        gear.add(visor);
      }
      if (type === 'weapon') {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.8, 0.08), new THREE.MeshBasicMaterial({ color: palette.primary }));
        blade.position.set(0.95, 2.45, 0.2);
        blade.rotation.z = -0.35;
        gear.add(blade);
      }
      if (type === 'back') {
        const wingGeometry = new THREE.ConeGeometry(0.5, 2, 3);
        const wingMaterial = new THREE.MeshBasicMaterial({ color: palette.primary, transparent: true, opacity: 0.55 });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-0.75, 2.8, -0.35);
        leftWing.rotation.z = 0.55;
        const rightWing = leftWing.clone();
        rightWing.position.x = 0.75;
        rightWing.rotation.z = -0.55;
        gear.add(leftWing, rightWing);
      }
    }

    rimLight.color.setHex(palette.primary);
    goldLight.color.setHex(palette.secondary);
    ringMaterial.color.setHex(palette.primary);
    document.documentElement.style.setProperty('--avatar-accent', `#${palette.primary.toString(16).padStart(6, '0')}`);
  }

  let locomotion = 'idle';
  let action = 'none';
  let sequence = Number(snapshot.motion?.sequence ?? 0);
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let yaw = 0;
  let pitch = 0.08;
  let zoom = 8;
  let jumpVelocity = 0;
  let grounded = true;
  let emoteUntil = 0;
  let touchInput = { x: 0, y: 0 };
  const keys = new Set<string>();
  const velocity = new THREE.Vector3();
  const clock = new THREE.Clock();

  const syncMotion = async () => {
    await supabase.rpc('rb_sync_avatar_motion', {
      p_position: { x: +avatarRoot.position.x.toFixed(3), y: +avatarRoot.position.y.toFixed(3), z: +avatarRoot.position.z.toFixed(3) },
      p_rotation: { x: 0, y: +avatarRoot.rotation.y.toFixed(3), z: 0, w: 1 },
      p_velocity: { x: +velocity.x.toFixed(3), y: +jumpVelocity.toFixed(3), z: +velocity.z.toFixed(3) },
      p_locomotion_state: locomotion,
      p_action_state: action,
      p_active_clip_key: action !== 'none' ? action : locomotion,
      p_input_state: { keys: [...keys], touchInput },
      p_sequence: ++sequence,
    });
  };

  const triggerAction = (nextAction: string) => {
    action = nextAction;
    emoteUntil = performance.now() + 1600;
    motionState.textContent = nextAction.toUpperCase();
    if (nextAction === 'smoke') {
      smoke.children.forEach((child) => child.scale.setScalar(2.1));
    }
  };

  const resize = () => {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'Space' && grounded) { jumpVelocity = 6.8; grounded = false; }
    if (event.code === 'Digit1') triggerAction('power');
    if (event.code === 'Digit2') triggerAction('dance');
    if (event.code === 'Digit3') triggerAction('smoke');
    if (event.code === 'Digit4') triggerAction('combat');
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * 0.008;
    pitch = Math.max(-0.1, Math.min(0.42, pitch + (event.clientY - lastY) * 0.004));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (event) => { zoom = Math.max(4.8, Math.min(11, zoom + event.deltaY * 0.006)); }, { passive: true });

  document.querySelectorAll<HTMLButtonElement>('[data-emote]').forEach((button) => {
    button.onclick = () => triggerAction(button.dataset.emote ?? 'none');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    const buttonAction = button.dataset.action ?? '';
    button.onpointerdown = () => {
      if (buttonAction === 'jump' && grounded) { jumpVelocity = 6.8; grounded = false; }
      else if (buttonAction === 'sprint') keys.add('ShiftLeft');
      else triggerAction(buttonAction);
    };
    button.onpointerup = () => { if (buttonAction === 'sprint') keys.delete('ShiftLeft'); };
  });

  const joystick = document.querySelector<HTMLElement>('#joystick')!;
  const stick = joystick.querySelector<HTMLElement>('i')!;
  const moveStick = (event: PointerEvent) => {
    const rect = joystick.getBoundingClientRect();
    touchInput = {
      x: Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.34))),
      y: Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.34))),
    };
    stick.style.transform = `translate(${touchInput.x * 34}px, ${touchInput.y * 34}px)`;
  };
  joystick.onpointerdown = (event) => { joystick.setPointerCapture(event.pointerId); moveStick(event); };
  joystick.onpointermove = (event) => { if (joystick.hasPointerCapture(event.pointerId)) moveStick(event); };
  joystick.onpointerup = () => { touchInput = { x: 0, y: 0 }; stick.style.transform = 'translate(0, 0)'; };

  const animate = () => {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.033);
    const elapsed = clock.elapsedTime;
    const inputX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touchInput.x;
    const inputZ = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + touchInput.y;
    const moving = Math.abs(inputX) + Math.abs(inputZ) > 0.08;
    const sprinting = keys.has('ShiftLeft');
    locomotion = !grounded ? 'jump' : moving ? (sprinting ? 'run' : 'walk') : 'idle';
    if (performance.now() > emoteUntil) action = 'none';

    const speed = sprinting ? 5.8 : 3.2;
    velocity.lerp(new THREE.Vector3(inputX * speed, 0, inputZ * speed), Math.min(1, delta * 8));
    avatarRoot.position.addScaledVector(velocity, delta);
    jumpVelocity -= 18 * delta;
    avatarRoot.position.y = Math.max(0, avatarRoot.position.y + jumpVelocity * delta);
    if (avatarRoot.position.y <= 0) { avatarRoot.position.y = 0; jumpVelocity = 0; grounded = true; }

    const stride = moving ? Math.sin(elapsed * (sprinting ? 12 : 7)) * (sprinting ? 0.72 : 0.42) : Math.sin(elapsed * 1.7) * 0.04;
    limbs.leftArm.rotation.x = stride;
    limbs.rightArm.rotation.x = -stride;
    limbs.leftLeg.rotation.x = -stride;
    limbs.rightLeg.rotation.x = stride;
    limbs.leftArm.rotation.z = action === 'combat' ? -1 : 0;
    limbs.rightArm.rotation.z = action === 'combat' ? 1 : 0;
    body.scale.setScalar(action === 'power' ? 1 + Math.sin(elapsed * 18) * 0.025 : 1);
    body.rotation.z = action === 'dance' ? Math.sin(elapsed * 8) * 0.13 : 0;
    motionState.textContent = (action === 'none' ? locomotion : action).toUpperCase();

    smoke.children.forEach((child, index) => {
      const puff = child as THREE.Mesh;
      puff.userData.time += delta * puff.userData.speed;
      puff.position.set(
        Math.sin(puff.userData.time * 1.8 + index) * 0.82,
        puff.userData.baseY + (puff.userData.time % 3.2),
        Math.cos(puff.userData.time + index) * 0.62,
      );
      const fade = 1 - (puff.userData.time % 3.2) / 3.2;
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.04 + fade * (action === 'smoke' ? 0.32 : 0.11);
      puff.scale.setScalar(0.7 + fade * 0.9);
    });

    camera.position.set(
      avatarRoot.position.x + Math.sin(yaw) * Math.cos(pitch) * zoom,
      2.5 + Math.sin(pitch) * zoom,
      avatarRoot.position.z + Math.cos(yaw) * Math.cos(pitch) * zoom,
    );
    camera.lookAt(avatarRoot.position.x, 2.25 + avatarRoot.position.y, avatarRoot.position.z);
    renderer.render(scene, camera);
  };
  animate();
  window.setInterval(() => { if (locomotion !== 'idle' || action !== 'none') void syncMotion(); }, 3500);

  const displayName = document.querySelector<HTMLInputElement>('#displayName')!;
  const auraSelect = document.querySelector<HTMLSelectElement>('#auraSelect')!;
  const motionSelect = document.querySelector<HTMLSelectElement>('#motionSelect')!;
  const presetOptions = document.querySelector<HTMLElement>('#presetOptions')!;
  const gearOptions = document.querySelector<HTMLElement>('#gearOptions')!;
  const identityTags = document.querySelector<HTMLElement>('#identityTags')!;
  auraSelect.value = selectedAura;
  motionSelect.value = selectedMotion;

  const refreshIdentity = () => {
    document.querySelector('#stageName')!.textContent = displayName.value.trim() || 'Rich Avatar';
    document.querySelector('#stagePreset')!.textContent = `${selectedPreset?.title ?? 'Custom'} · ${selectedAura} · ${selectedPreset?.outfit ?? 'Universal Fit'}`;
    identityTags.innerHTML = [selectedPreset?.config.body_type ?? 'custom', selectedPreset?.config.build ?? 'athletic', selectedPreset?.config.voice ?? 'boss']
      .map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
    rebuildCharacter();
  };

  const renderPresets = () => {
    presetOptions.innerHTML = presets.map((preset) => `
      <button class="${preset.preset_key === selectedPreset?.preset_key ? 'active' : ''}" data-preset="${escapeHtml(preset.preset_key)}">
        <b>${escapeHtml(preset.title)}</b>
        <small>${escapeHtml(preset.outfit)} · ${escapeHtml(preset.motion)}<br>${escapeHtml(preset.config.body_type)} / ${escapeHtml(preset.config.build)}</small>
      </button>`).join('');
    presetOptions.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
      button.onclick = async () => {
        selectedPreset = presets.find((preset) => preset.preset_key === button.dataset.preset) ?? selectedPreset;
        if (!selectedPreset) return;
        selectedAura = selectedPreset.aura as PaletteName;
        selectedMotion = selectedPreset.motion;
        auraSelect.value = selectedAura;
        motionSelect.value = selectedMotion;
        renderPresets();
        refreshIdentity();
        triggerAction(selectedPreset.preset_key.includes('villain') ? 'combat' : selectedPreset.preset_key.includes('hero') ? 'power' : selectedPreset.preset_key === 'classic_cartoon' ? 'dance' : 'smoke');
        await supabase.rpc('rb_award_xp', { p_event_key: 'avatar_character_changed', p_section: 'avatar', p_source_table: 'avatar_character_presets' });
      };
    });
  };

  const renderGear = () => {
    gearOptions.innerHTML = items.map((item) => `
      <button class="${equipped.get(item.item_type) === item.item_key ? 'active' : ''}" data-item="${escapeHtml(item.item_key)}">
        <b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.item_type)} · ${escapeHtml(item.rarity)}</small>
      </button>`).join('');
    gearOptions.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((button) => {
      button.onclick = async () => {
        const item = items.find((candidate) => candidate.item_key === button.dataset.item);
        if (!item) return;
        const active = equipped.get(item.item_type) === item.item_key;
        status.textContent = active ? 'Unequipping gear…' : 'Equipping gear…';
        const { error: equipError } = await supabase.rpc('rb_avatar_set_item', { p_item_key: item.item_key, p_equipped: !active });
        if (equipError) { status.textContent = equipError.message; return; }
        if (active) equipped.delete(item.item_type); else equipped.set(item.item_type, item.item_key);
        renderGear();
        rebuildCharacter();
        if (!active) await supabase.rpc('rb_award_xp', { p_event_key: 'avatar_item_equipped', p_section: 'avatar', p_source_table: 'avatar_inventory' });
        status.textContent = 'Loadout synced across Avatar, Profile, Gaming, Meta, Live, and Rich-DM.';
      };
    });
  };

  auraSelect.onchange = () => { selectedAura = auraSelect.value as PaletteName; refreshIdentity(); };
  motionSelect.onchange = () => {
    selectedMotion = motionSelect.value;
    const normalized = selectedMotion.toLowerCase();
    triggerAction(normalized.includes('dance') ? 'dance' : normalized.includes('power') || normalized.includes('hero') ? 'power' : normalized.includes('combat') || normalized.includes('villain') ? 'combat' : normalized.includes('smoke') ? 'smoke' : 'none');
  };
  displayName.oninput = refreshIdentity;
  document.querySelector<HTMLButtonElement>('#resetBtn')!.onclick = () => { yaw = 0; pitch = 0.08; zoom = 8; avatarRoot.position.set(0, 0, 0); };
  document.querySelector<HTMLButtonElement>('#saveBtn')!.onclick = async () => {
    status.textContent = 'Saving character, loadout, animation, movement, combat, vehicle, voice, and universe identity…';
    const { error: saveError } = await supabase.rpc('rb_save_avatar_studio', {
      p_display_name: displayName.value.trim(),
      p_preset_key: selectedPreset?.preset_key ?? 'boss',
      p_aura: selectedAura,
      p_outfit: { preset: selectedPreset?.outfit ?? 'Rich Default', motion: selectedMotion, character: selectedPreset?.config ?? {} },
      p_accessories: Object.fromEntries(equipped),
      p_smoke: { mode: selectedPreset?.config.smoke ?? 'cinematic', intensity: 'elite', realtime: true },
      p_emotes: { idle: selectedMotion, smoke_burst: true, power_up: true, dance_flex: true, combat_pose: true },
      p_character_type: selectedPreset?.preset_key ?? 'custom',
    });
    if (saveError) { status.textContent = saveError.message; return; }
    await syncMotion();
    status.textContent = 'Advanced character universe synced everywhere.';
  };

  renderPresets();
  renderGear();
  refreshIdentity();
}