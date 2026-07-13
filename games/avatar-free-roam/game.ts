import { createControls } from './controls';

const root = document.querySelector<HTMLElement>('#game-root');
if (!root) throw new Error('Missing game root');

root.innerHTML = `
  <section class="hud">
    <p>AVATAR FREE ROAM</p>
    <strong id="speed">0.0</strong>
    <span>WASD / ARROWS · SHIFT SPRINT · SPACE JUMP</span>
  </section>
  <div class="world" id="world">
    <div class="portal"></div>
    <div class="player" id="player" aria-label="Player avatar"></div>
  </div>`;

const player = document.querySelector<HTMLElement>('#player');
const speedLabel = document.querySelector<HTMLElement>('#speed');
if (!player || !speedLabel) throw new Error('Game HUD failed to mount');

const readControls = createControls();
const state = { x: 0, z: 0, y: 0, velocityY: 0, grounded: true, last: performance.now() };

function frame(now: number): void {
  const dt = Math.min((now - state.last) / 1000, 0.05);
  state.last = now;
  const input = readControls();
  const speed = input.sprint ? 10 : 5;

  state.x += input.strafe * speed * dt;
  state.z += input.forward * speed * dt;

  if (input.jump && state.grounded) {
    state.velocityY = 7;
    state.grounded = false;
  }

  state.velocityY -= 18 * dt;
  state.y += state.velocityY * dt;
  if (state.y <= 0) {
    state.y = 0;
    state.velocityY = 0;
    state.grounded = true;
  }

  player.style.transform = `translate3d(${state.x * 18}px, ${-state.y * 22}px, 0) scale(${1 + state.z * 0.001})`;
  speedLabel.textContent = `${Math.hypot(input.forward, input.strafe) * speed}.0`;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
