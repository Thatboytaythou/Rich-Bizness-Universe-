export type MobileControlState = {
  forward: number;
  strafe: number;
  sprint: boolean;
  jump: boolean;
};

export function mountMobileControls(root: HTMLElement): () => MobileControlState {
  const state: MobileControlState = { forward: 0, strafe: 0, sprint: false, jump: false };
  const controls = document.createElement('div');
  controls.className = 'mobile-controls';
  controls.innerHTML = `
    <div class="mobile-stick" aria-label="Movement control">
      <button data-move="forward">▲</button>
      <div><button data-move="left">◀</button><button data-move="right">▶</button></div>
      <button data-move="back">▼</button>
    </div>
    <div class="mobile-actions">
      <button data-action="sprint">SPRINT</button>
      <button data-action="jump">JUMP</button>
    </div>`;
  root.appendChild(controls);

  const active = new Set<string>();
  const update = () => {
    state.forward = Number(active.has('forward')) - Number(active.has('back'));
    state.strafe = Number(active.has('right')) - Number(active.has('left'));
    state.sprint = active.has('sprint');
    state.jump = active.has('jump');
  };

  controls.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const key = button.dataset.move ?? button.dataset.action;
    if (!key) return;
    const start = (event: Event) => { event.preventDefault(); active.add(key); update(); };
    const end = (event: Event) => { event.preventDefault(); active.delete(key); update(); };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('pointerleave', end);
  });

  return () => ({ ...state });
}
