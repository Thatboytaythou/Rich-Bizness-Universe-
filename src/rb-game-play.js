import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js';

const $ = (s) => document.querySelector(s);
let games = [];
let current = null;
let user = null;
let score = 0;
let lives = 3;
let running = false;
let timer = null;
let mode = 'arcade';

const fmt = (n) => Number(n || 0).toLocaleString();
const modeFor = (g) => {
  const slug = g?.slug || '';
  if (/racer|drift|ride/.test(slug)) return 'racing';
  if (/court|bat|golf|gym/.test(slug)) return 'sports';
  if (/chess|empire|market|vault/.test(slug)) return 'strategy';
  if (/battle|arena|showdown/.test(slug)) return 'fighting';
  if (/free-roam|portal-room/.test(slug)) return 'roam';
  if (/beat|dj|radio/.test(slug)) return 'music';
  if (/party|cards/.test(slug)) return 'party';
  return 'arcade';
};

function addCss() {
  if (document.getElementById('rbGamePlayCss')) return;
  const l = document.createElement('style');
  l.id = 'rbGamePlayCss';
  l.textContent = `.rb-play{margin-top:12px;border:1px solid rgba(99,255,93,.25);border-radius:24px;background:radial-gradient(circle at 50% 0,rgba(99,255,93,.14),transparent 42%),rgba(0,0,0,.42);padding:12px}.rb-play-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.rb-play-top b{color:white;font-size:20px}.rb-play-top small{color:rgba(255,255,255,.6);font-weight:900;letter-spacing:.12em}.rb-play-canvas{position:relative;height:280px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(2,20,7,.8),rgba(0,0,0,.9));touch-action:none}.rb-target,.rb-player,.rb-obstacle,.rb-beat{position:absolute;display:grid;place-items:center;user-select:none}.rb-target{width:54px;height:54px;border-radius:999px;background:radial-gradient(circle,#f7c948,#63ff5d 62%,transparent 65%);box-shadow:0 0 28px rgba(99,255,93,.7);font-weight:1000;color:#041107}.rb-player{width:58px;height:58px;border-radius:20px;background:radial-gradient(circle,#f7c948,#63ff5d 60%,#020402 62%);left:calc(50% - 29px);bottom:20px;color:#031109;font-weight:1000}.rb-obstacle{width:48px;height:48px;border-radius:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);color:#fff}.rb-beat{width:62px;height:62px;border-radius:18px;background:rgba(99,255,93,.14);border:1px solid rgba(99,255,93,.35);color:#f7c948;font-weight:1000}.rb-play-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;margin-top:10px}.rb-play-controls button,.rb-play-controls a{border:1px solid rgba(99,255,93,.28);border-radius:14px;background:rgba(99,255,93,.1);color:white;font-weight:900;text-decoration:none;text-align:center;padding:10px}.rb-pad{display:grid;grid-template-columns:repeat(3,56px);gap:7px;justify-content:center;margin-top:10px}.rb-pad button{height:44px;border-radius:14px;border:1px solid rgba(99,255,93,.3);background:rgba(99,255,93,.12);color:white;font-weight:900}.rb-pad button:first-child{grid-column:2}.rb-pad button:nth-child(2){grid-column:1}.rb-pad button:nth-child(3){grid-column:2}.rb-pad button:nth-child(4){grid-column:3}`;
  document.head.appendChild(l);
}

function mount() {
  if ($('#rbPlay')) return;
  const root = document.createElement('section');
  root.id = 'rbPlay';
  root.className = 'rb-play';
  root.innerHTML = `<div class="rb-play-top"><div><small id="playMode">PLAY MODE</small><b id="playTitle">Select a game</b></div><div><small>SCORE</small><b id="playScore">0</b></div><div><small>LIVES</small><b id="playLives">3</b></div></div><div id="playCanvas" class="rb-play-canvas"></div><div class="rb-play-controls"><button id="startGame" type="button">START GAME</button><button id="actionGame" type="button">ACTION</button><button id="submitPlayScore" type="button">SAVE SCORE</button><a id="gameStreamLink" href="/watch.html">STREAM TV</a></div><div class="rb-pad"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div>`;
  ($('#gameRoom') || document.querySelector('main'))?.appendChild(root);
  $('#startGame').addEventListener('click', startGame);
  $('#actionGame').addEventListener('click', action);
  $('#submitPlayScore').addEventListener('click', saveScore);
  document.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => move(b.dataset.dir)));
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') action();
    if (e.key === 'ArrowUp') move('up');
    if (e.key === 'ArrowDown') move('down');
    if (e.key === 'ArrowLeft') move('left');
    if (e.key === 'ArrowRight') move('right');
  });
}

function paintHud() {
  $('#playTitle').textContent = current?.title || 'Select a game';
  $('#playMode').textContent = (mode || 'arcade').toUpperCase();
  $('#playScore').textContent = fmt(score);
  $('#playLives').textContent = lives;
  $('#gameStreamLink').href = current?.stream_url || '/watch.html';
}

function selectGame(slug) {
  current = games.find((g) => g.slug === slug) || current || games[0] || null;
  mode = modeFor(current);
  score = 0;
  lives = 3;
  running = false;
  clearInterval(timer);
  renderScene();
  paintHud();
}

function renderScene() {
  const c = $('#playCanvas');
  if (!c) return;
  c.innerHTML = '<div class="rb-player" id="rbPlayer">RB</div>';
  if (mode === 'music') addBeats();
  else if (mode === 'strategy') addPuzzle();
  else if (mode === 'party') addCards();
  else spawnTarget();
}

function rand(max) { return Math.floor(Math.random() * max); }
function spawnTarget() {
  const c = $('#playCanvas');
  const t = document.createElement('button');
  t.type = 'button';
  t.className = 'rb-target';
  t.textContent = mode === 'sports' ? '🏆' : mode === 'racing' ? '💨' : mode === 'fighting' ? '⚡' : 'RB';
  t.style.left = rand(Math.max(1, c.clientWidth - 70)) + 'px';
  t.style.top = rand(Math.max(1, c.clientHeight - 85)) + 'px';
  t.addEventListener('click', () => hitTarget(t));
  c.appendChild(t);
}
function hitTarget(t) {
  if (!running) return;
  score += mode === 'fighting' ? 150 : mode === 'sports' ? 120 : mode === 'racing' ? 110 : 100;
  t.remove();
  spawnTarget();
  paintHud();
  awardXp('game_move', { section: 'gaming', sourceTable: 'games', sourceId: current?.id }).catch(() => {});
}
function addBeats() {
  ['808','KICK','SNARE','DROP'].forEach((x, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rb-beat'; b.textContent = x;
    b.style.left = (16 + i * 22) + '%'; b.style.top = (35 + (i % 2) * 24) + '%';
    b.addEventListener('click', () => { if (running) { score += 90; paintHud(); } });
    $('#playCanvas').appendChild(b);
  });
}
function addPuzzle() { for (let i = 0; i < 6; i++) spawnTarget(); }
function addCards() { for (let i = 0; i < 4; i++) spawnTarget(); }

function startGame() {
  if (!current) return;
  score = 0; lives = 3; running = true; renderScene(); paintHud();
  clearInterval(timer);
  timer = setInterval(() => { if (!running) return; if (mode === 'racing' || mode === 'arcade') { lives -= 1; if (lives <= 0) endGame(); paintHud(); } }, 9000);
}
function endGame() { running = false; clearInterval(timer); $('#playMode').textContent = 'GAME OVER'; }
function action() { if (!running) startGame(); else { score += mode === 'strategy' ? 75 : 50; paintHud(); awardXp('game_move', { section: 'gaming', sourceTable: 'games', sourceId: current?.id }).catch(() => {}); } }
function move(dir) {
  const p = $('#rbPlayer'); if (!p || !running) return;
  const x = p.offsetLeft; const y = p.offsetTop; const step = 18;
  if (dir === 'left') p.style.left = Math.max(0, x - step) + 'px';
  if (dir === 'right') p.style.left = Math.min($('#playCanvas').clientWidth - 58, x + step) + 'px';
  if (dir === 'up') p.style.top = Math.max(0, y - step) + 'px';
  if (dir === 'down') p.style.top = Math.min($('#playCanvas').clientHeight - 58, y + step) + 'px';
  score += 5; paintHud();
}

async function getUser() { const { data } = await supabase.auth.getUser(); user = data?.user || null; return user; }
async function saveScore() {
  await getUser();
  if (!user) { location.href = '/auth.html'; return; }
  if (!current) return;
  await supabase.from('game_scores').insert({ game_id: current.id, game_slug: current.slug, user_id: user.id, score, mode, platform_type: 'web', metadata: { source: 'rb-game-play' } });
  await supabase.from('game_sessions').insert({ game_id: current.id, game_slug: current.slug, user_id: user.id, score, result: 'completed', metadata: { source: 'rb-game-play', mode } });
  await awardXp('game_score_submit', { section: 'gaming', sourceTable: 'games', sourceId: current.id });
  $('#playMode').textContent = 'SCORE SAVED';
}

async function loadGames() {
  const { data } = await supabase.from('games').select('id,slug,title,description,game_type,play_url,stream_url,is_active').eq('is_active', true).limit(80);
  games = data || [];
  const initial = new URL(location.href).searchParams.get('game') || games[0]?.slug;
  selectGame(initial);
  document.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-slug]');
    if (tile) selectGame(tile.dataset.slug);
  });
}

addCss();
mount();
loadGames();
