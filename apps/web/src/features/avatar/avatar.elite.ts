type QualityMode = 'ultra' | 'high' | 'performance';
type CameraMode = 'orbit' | 'street' | 'portrait';

const storageKey = 'rb.avatar.elite.settings.v1';

function readSettings(): { quality: QualityMode; camera: CameraMode; cinematic: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<{ quality: QualityMode; camera: CameraMode; cinematic: boolean }>;
    return {
      quality: saved.quality === 'performance' || saved.quality === 'high' ? saved.quality : 'ultra',
      camera: saved.camera === 'street' || saved.camera === 'portrait' ? saved.camera : 'orbit',
      cinematic: saved.cinematic !== false,
    };
  } catch {
    return { quality: 'ultra', camera: 'orbit', cinematic: true };
  }
}

export function mountEliteAvatarLayer(): () => void {
  const shell = document.querySelector<HTMLElement>('.avatar-shell');
  const stage = document.querySelector<HTMLElement>('.avatar-stage');
  const canvas = document.querySelector<HTMLCanvasElement>('#avatarCanvas');
  if (!shell || !stage || !canvas) return () => undefined;

  const settings = readSettings();
  const layer = document.createElement('section');
  layer.className = 'avatar-elite-layer';
  layer.setAttribute('aria-label', 'Elite avatar controls');
  layer.innerHTML = `
    <div class="avatar-elite-badge"><i></i><span>GTA-STYLE CHARACTER ENGINE</span><b>HD MOTION</b></div>
    <div class="avatar-elite-toolbar">
      <div class="avatar-elite-group" aria-label="Camera mode">
        <button type="button" data-camera="orbit">ORBIT</button>
        <button type="button" data-camera="street">STREET</button>
        <button type="button" data-camera="portrait">PORTRAIT</button>
      </div>
      <div class="avatar-elite-group" aria-label="Render quality">
        <button type="button" data-quality="ultra">ULTRA</button>
        <button type="button" data-quality="high">HIGH</button>
        <button type="button" data-quality="performance">PERFORMANCE</button>
      </div>
      <button type="button" data-elite-action="cinematic">CINEMATIC</button>
      <button type="button" data-elite-action="fullscreen">FULLSCREEN</button>
    </div>
    <div class="avatar-elite-motion-rail" aria-label="Motion shortcuts">
      <button type="button" data-motion="idle">BOSS IDLE</button>
      <button type="button" data-motion="walk">STREET WALK</button>
      <button type="button" data-motion="run">POWER RUN</button>
      <button type="button" data-motion="combat">COMBAT</button>
      <button type="button" data-motion="smoke">SMOKE</button>
      <button type="button" data-motion="power">AURA</button>
      <button type="button" data-motion="dance">FLEX</button>
    </div>`;
  stage.append(layer);

  const save = () => localStorage.setItem(storageKey, JSON.stringify(settings));
  const apply = () => {
    shell.dataset.quality = settings.quality;
    shell.dataset.camera = settings.camera;
    shell.classList.toggle('avatar-cinematic', settings.cinematic);
    layer.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => button.classList.toggle('active', button.dataset.quality === settings.quality));
    layer.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => button.classList.toggle('active', button.dataset.camera === settings.camera));
    layer.querySelector<HTMLButtonElement>('[data-elite-action="cinematic"]')?.classList.toggle('active', settings.cinematic);
  };

  const triggerMotion = (motion: string) => {
    const matchingButton = document.querySelector<HTMLButtonElement>(`[data-emote="${motion}"]`);
    if (matchingButton) {
      matchingButton.click();
      return;
    }
    const motionSelect = document.querySelector<HTMLSelectElement>('#motionSelect');
    if (!motionSelect) return;
    const option = [...motionSelect.options].find((entry) => entry.text.toLowerCase().includes(motion));
    if (option) {
      motionSelect.value = option.value;
      motionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  layer.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.quality) {
      settings.quality = button.dataset.quality as QualityMode;
      apply(); save(); return;
    }
    if (button.dataset.camera) {
      settings.camera = button.dataset.camera as CameraMode;
      apply(); save();
      if (settings.camera === 'portrait') canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -420 }));
      if (settings.camera === 'street') canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 220 }));
      return;
    }
    if (button.dataset.motion) {
      triggerMotion(button.dataset.motion);
      layer.querySelectorAll('[data-motion]').forEach((item) => item.classList.toggle('active', item === button));
      return;
    }
    if (button.dataset.eliteAction === 'cinematic') {
      settings.cinematic = !settings.cinematic;
      apply(); save(); return;
    }
    if (button.dataset.eliteAction === 'fullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    }
  });

  const onKey = (event: KeyboardEvent) => {
    if (event.repeat || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName ?? '')) return;
    if (event.code === 'KeyC') {
      settings.camera = settings.camera === 'orbit' ? 'street' : settings.camera === 'street' ? 'portrait' : 'orbit';
      apply(); save();
    }
    if (event.code === 'KeyV') { settings.cinematic = !settings.cinematic; apply(); save(); }
    if (event.code === 'KeyF') void (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen());
  };
  window.addEventListener('keydown', onKey);
  apply();

  return () => {
    window.removeEventListener('keydown', onKey);
    layer.remove();
    delete shell.dataset.quality;
    delete shell.dataset.camera;
    shell.classList.remove('avatar-cinematic');
  };
}
