type QualityMode = 'ultra' | 'high' | 'performance';
type CameraMode = 'orbit' | 'street' | 'portrait';
type CharacterLane = 'all' | 'street' | 'boss' | 'female' | 'fighter' | 'future';

const storageKey = 'rb.avatar.elite.settings.v2';

type EliteSettings = {
  quality: QualityMode;
  camera: CameraMode;
  cinematic: boolean;
  lane: CharacterLane;
};

function readSettings(): EliteSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<EliteSettings>;
    return {
      quality: saved.quality === 'performance' || saved.quality === 'high' ? saved.quality : 'ultra',
      camera: saved.camera === 'street' || saved.camera === 'portrait' ? saved.camera : 'orbit',
      cinematic: saved.cinematic !== false,
      lane: ['street', 'boss', 'female', 'fighter', 'future'].includes(String(saved.lane)) ? saved.lane as CharacterLane : 'all',
    };
  } catch {
    return { quality: 'ultra', camera: 'orbit', cinematic: true, lane: 'all' };
  }
}

const laneMatchers: Record<CharacterLane, RegExp> = {
  all: /.*/i,
  street: /street|hustler|runner|creator|king|queen/i,
  boss: /boss|lord|enforcer|legend/i,
  female: /queen|vixen|female/i,
  fighter: /samurai|ronin|hero|villain|combat|guardian/i,
  future: /cyber|meta|neon|portal|anime/i,
};

export function mountEliteAvatarLayer(): () => void {
  const shell = document.querySelector<HTMLElement>('.avatar-shell');
  const stage = document.querySelector<HTMLElement>('.avatar-stage');
  const canvas = document.querySelector<HTMLCanvasElement>('#avatarCanvas');
  if (!shell || !stage || !canvas) return () => undefined;

  stage.querySelector('.avatar-elite-layer')?.remove();
  const settings = readSettings();
  const layer = document.createElement('section');
  layer.className = 'avatar-elite-layer';
  layer.setAttribute('aria-label', 'Elite avatar controls');
  layer.innerHTML = `
    <div class="avatar-elite-badge"><i></i><span>RICH GTA-STYLE CHARACTER ENGINE</span><b>ULTRA 3D MOTION</b></div>
    <div class="avatar-elite-toolbar">
      <div class="avatar-elite-group" aria-label="Camera mode">
        <button type="button" data-camera="orbit">ORBIT</button>
        <button type="button" data-camera="street">STREET CAM</button>
        <button type="button" data-camera="portrait">PORTRAIT</button>
      </div>
      <div class="avatar-elite-group" aria-label="Render quality">
        <button type="button" data-quality="ultra">ULTRA HD</button>
        <button type="button" data-quality="high">HIGH</button>
        <button type="button" data-quality="performance">PERFORMANCE</button>
      </div>
      <button type="button" data-elite-action="cinematic">CINEMATIC</button>
      <button type="button" data-elite-action="fullscreen">FULLSCREEN</button>
    </div>
    <div class="avatar-character-rail" aria-label="Character style filters">
      <span>CHARACTER CLASS</span>
      ${(['all','street','boss','female','fighter','future'] as CharacterLane[]).map((lane) => `<button type="button" data-lane="${lane}">${lane.toUpperCase()}</button>`).join('')}
    </div>
    <div class="avatar-elite-motion-rail" aria-label="Motion shortcuts">
      <button type="button" data-motion="idle">BOSS IDLE</button>
      <button type="button" data-motion="walk">STREET WALK</button>
      <button type="button" data-motion="run">POWER RUN</button>
      <button type="button" data-motion="combat">COMBAT FLOW</button>
      <button type="button" data-motion="smoke">HEAVY SMOKE</button>
      <button type="button" data-motion="power">AURA SURGE</button>
      <button type="button" data-motion="dance">VICTORY FLEX</button>
    </div>
    <div class="avatar-render-readout" aria-live="polite"><span>REALTIME RIG</span><b id="eliteRenderReadout">ULTRA · ORBIT · 60 FPS TARGET</b></div>`;
  stage.append(layer);

  const save = () => localStorage.setItem(storageKey, JSON.stringify(settings));
  const filterCharacters = () => {
    const matcher = laneMatchers[settings.lane];
    document.querySelectorAll<HTMLButtonElement>('#presetOptions [data-preset]').forEach((button) => {
      const text = `${button.dataset.preset ?? ''} ${button.textContent ?? ''}`;
      const visible = matcher.test(text);
      button.hidden = !visible;
      button.setAttribute('aria-hidden', String(!visible));
    });
  };
  const apply = () => {
    shell.dataset.quality = settings.quality;
    shell.dataset.camera = settings.camera;
    shell.dataset.characterLane = settings.lane;
    shell.classList.toggle('avatar-cinematic', settings.cinematic);
    layer.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => button.classList.toggle('active', button.dataset.quality === settings.quality));
    layer.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => button.classList.toggle('active', button.dataset.camera === settings.camera));
    layer.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => button.classList.toggle('active', button.dataset.lane === settings.lane));
    layer.querySelector<HTMLButtonElement>('[data-elite-action="cinematic"]')?.classList.toggle('active', settings.cinematic);
    const readout = layer.querySelector<HTMLElement>('#eliteRenderReadout');
    if (readout) readout.textContent = `${settings.quality.toUpperCase()} · ${settings.camera.toUpperCase()} · ${settings.quality === 'performance' ? '90' : '60'} FPS TARGET`;
    filterCharacters();
  };

  const triggerMotion = (motion: string) => {
    const matchingButton = document.querySelector<HTMLButtonElement>(`[data-emote="${motion}"]`);
    if (matchingButton) { matchingButton.click(); return; }
    const motionSelect = document.querySelector<HTMLSelectElement>('#motionSelect');
    if (!motionSelect) return;
    const option = [...motionSelect.options].find((entry) => entry.text.toLowerCase().includes(motion));
    if (option) {
      motionSelect.value = option.value;
      motionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const onClick = async (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.quality) { settings.quality = button.dataset.quality as QualityMode; apply(); save(); return; }
    if (button.dataset.camera) {
      settings.camera = button.dataset.camera as CameraMode;
      apply(); save();
      if (settings.camera === 'portrait') canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -420 }));
      if (settings.camera === 'street') canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 220 }));
      return;
    }
    if (button.dataset.lane) { settings.lane = button.dataset.lane as CharacterLane; apply(); save(); return; }
    if (button.dataset.motion) {
      triggerMotion(button.dataset.motion);
      layer.querySelectorAll('[data-motion]').forEach((item) => item.classList.toggle('active', item === button));
      return;
    }
    if (button.dataset.eliteAction === 'cinematic') { settings.cinematic = !settings.cinematic; apply(); save(); return; }
    if (button.dataset.eliteAction === 'fullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.repeat || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName ?? '')) return;
    if (event.code === 'KeyC') {
      settings.camera = settings.camera === 'orbit' ? 'street' : settings.camera === 'street' ? 'portrait' : 'orbit';
      apply(); save();
    }
    if (event.code === 'KeyV') { settings.cinematic = !settings.cinematic; apply(); save(); }
    if (event.code === 'KeyF') void (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen());
  };

  layer.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  queueMicrotask(apply);

  return () => {
    layer.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    layer.remove();
    delete shell.dataset.quality;
    delete shell.dataset.camera;
    delete shell.dataset.characterLane;
    shell.classList.remove('avatar-cinematic');
    document.querySelectorAll<HTMLButtonElement>('#presetOptions [data-preset]').forEach((button) => {
      button.hidden = false;
      button.removeAttribute('aria-hidden');
    });
  };
}