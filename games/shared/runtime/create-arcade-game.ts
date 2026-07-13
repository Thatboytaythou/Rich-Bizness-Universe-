export type ArcadeGameConfig = Readonly<{
  slug: string;
  title: string;
  instruction: string;
  actionLabel: string;
  targetScore: number;
  timeLimitSeconds: number;
  pointsPerAction: number;
}>;

type GameState = {
  score: number;
  secondsLeft: number;
  running: boolean;
  timer: number | null;
};

export function createArcadeGame(config: ArcadeGameConfig): void {
  const root = document.querySelector<HTMLElement>('#game-root');
  if (!root) throw new Error(`Missing #game-root for ${config.slug}`);

  const storageKey = `rb.game.${config.slug}.best.v1`;
  const best = Number(localStorage.getItem(storageKey) ?? 0);
  const state: GameState = { score: 0, secondsLeft: config.timeLimitSeconds, running: false, timer: null };

  root.innerHTML = `
    <main class="rb-mini-game" data-game="${config.slug}">
      <header><p>RICH BIZNESS GAMES</p><h1>${config.title}</h1></header>
      <section class="rb-game-stats" aria-live="polite">
        <span>SCORE <strong id="rb-score">0</strong></span>
        <span>TIME <strong id="rb-time">${config.timeLimitSeconds}</strong></span>
        <span>BEST <strong id="rb-best">${best}</strong></span>
      </section>
      <p id="rb-status">${config.instruction}</p>
      <button id="rb-action" type="button">${config.actionLabel}</button>
      <button id="rb-start" type="button">START RUN</button>
    </main>`;

  const scoreEl = root.querySelector<HTMLElement>('#rb-score');
  const timeEl = root.querySelector<HTMLElement>('#rb-time');
  const bestEl = root.querySelector<HTMLElement>('#rb-best');
  const statusEl = root.querySelector<HTMLElement>('#rb-status');
  const action = root.querySelector<HTMLButtonElement>('#rb-action');
  const start = root.querySelector<HTMLButtonElement>('#rb-start');
  if (!scoreEl || !timeEl || !bestEl || !statusEl || !action || !start) throw new Error('Game UI failed to mount');

  const render = () => {
    scoreEl.textContent = state.score.toLocaleString();
    timeEl.textContent = String(state.secondsLeft);
    action.disabled = !state.running;
  };

  const finish = () => {
    state.running = false;
    if (state.timer !== null) window.clearInterval(state.timer);
    state.timer = null;
    const previousBest = Number(localStorage.getItem(storageKey) ?? 0);
    const nextBest = Math.max(previousBest, state.score);
    localStorage.setItem(storageKey, String(nextBest));
    bestEl.textContent = nextBest.toLocaleString();
    statusEl.textContent = state.score >= config.targetScore
      ? `MISSION COMPLETE · ${state.score.toLocaleString()} POINTS`
      : `RUN COMPLETE · TARGET ${config.targetScore.toLocaleString()}`;
    start.textContent = 'PLAY AGAIN';
    render();
  };

  const begin = () => {
    if (state.timer !== null) window.clearInterval(state.timer);
    state.score = 0;
    state.secondsLeft = config.timeLimitSeconds;
    state.running = true;
    statusEl.textContent = config.instruction;
    start.textContent = 'RESTART';
    state.timer = window.setInterval(() => {
      state.secondsLeft -= 1;
      if (state.secondsLeft <= 0) finish();
      render();
    }, 1000);
    render();
  };

  action.addEventListener('click', () => {
    if (!state.running) return;
    state.score += config.pointsPerAction;
    if (state.score >= config.targetScore) statusEl.textContent = 'TARGET HIT · KEEP BUILDING THE SCORE';
    render();
  });
  start.addEventListener('click', begin);
  addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      action.click();
    }
  });
  render();
}
