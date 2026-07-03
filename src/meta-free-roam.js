import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js';

let x = 50;
let y = 50;
let userId = null;
let avatarId = null;
let timer = null;

function style() {
  if (document.getElementById('freeRoamCss')) return;
  const l = document.createElement('link');
  l.id = 'freeRoamCss';
  l.rel = 'stylesheet';
  l.href = '/src/meta-free-roam.css?v=roam-1';
  document.head.appendChild(l);
}

function mount() {
  if (document.getElementById('freeRoamStage')) return;
  const root = document.createElement('section');
  root.id = 'freeRoamStage';
  root.className = 'free-roam-stage';
  root.innerHTML = '<div class="free-roam-head"><div><small>AVATAR FREE ROAM</small><b>MOVE AROUND THE RICH WORLD</b></div><small id="roamCoords">X 50 Y 50</small></div><div class="free-roam-world" id="roamWorld"><div class="free-roam-grid"></div><div class="portal-node">LIVE</div><div class="portal-node">GAME</div><div class="portal-node">STORE</div><div class="portal-node">MUSIC</div><div class="free-roam-avatar" id="roamAvatar"></div></div><div class="free-roam-pad"><button data-move="up">↑</button><button data-move="left">←</button><button data-move="down">↓</button><button data-move="right">→</button></div><p class="free-roam-status" id="roamStatus">Use the pad or keyboard arrows. Position syncs to meta_avatars.position.</p>';
  document.querySelector('main')?.appendChild(root);
  root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => move(b.dataset.move)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') move('up');
    if (e.key === 'ArrowDown') move('down');
    if (e.key === 'ArrowLeft') move('left');
    if (e.key === 'ArrowRight') move('right');
  });
}

function paint() {
  const avatar = document.getElementById('roamAvatar');
  if (!avatar) return;
  avatar.style.left = x + '%';
  avatar.style.top = y + '%';
  const c = document.getElementById('roamCoords');
  if (c) c.textContent = `X ${Math.round(x)} Y ${Math.round(y)}`;
}

async function save() {
  if (!userId) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await supabase.from('meta_avatars').update({ position: { x, y, z: 0 } }).eq('user_id', userId);
  }, 250);
}

async function move(dir) {
  const step = 4;
  if (dir === 'up') y = Math.max(12, y - step);
  if (dir === 'down') y = Math.min(86, y + step);
  if (dir === 'left') x = Math.max(8, x - step);
  if (dir === 'right') x = Math.min(92, x + step);
  paint();
  save();
  awardXp('meta_enter', { section: 'meta', sourceTable: 'meta_avatars', sourceId: avatarId }).catch(() => {});
}

async function boot() {
  style();
  mount();
  const { data } = await supabase.auth.getUser();
  userId = data?.user?.id || null;
  if (userId) {
    const { data: avatar } = await supabase.from('meta_avatars').select('id,position').eq('user_id', userId).maybeSingle();
    avatarId = avatar?.id || null;
    x = Number(avatar?.position?.x ?? 50);
    y = Number(avatar?.position?.y ?? 50);
  }
  paint();
}

boot();
