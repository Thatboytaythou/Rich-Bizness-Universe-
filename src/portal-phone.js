import { routeFor } from './rb-schema-map.js';

const title = document.getElementById('phoneTitle');
const hint = document.getElementById('phoneHint');
const status = document.getElementById('phoneStatus');
let index = 0;

function towers() {
  return [...document.querySelectorAll('.district[data-route]')];
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function paint() {
  const list = towers();
  if (!list.length) {
    setText(title, 'PORTAL HUB');
    setText(hint, 'Tap a lane or use controls.');
    setText(status, 'READY');
    return;
  }
  index = Math.max(0, Math.min(index, list.length - 1));
  list.forEach((t, i) => t.classList.toggle('active', i === index));
  const tower = list[index];
  setText(title, tower.querySelector('b')?.textContent || 'PORTAL HUB');
  setText(hint, tower.querySelector('small')?.textContent || 'ENTER');
  setText(status, (tower.dataset.route || 'READY').toUpperCase());
}

function move(delta) {
  const list = towers();
  if (!list.length) return;
  index = (index + delta + list.length) % list.length;
  paint();
}

function enter() {
  const list = towers();
  const tower = list[index];
  if (!tower) return;
  const key = tower.dataset.route;
  setText(status, 'OPENING');
  window.setTimeout(() => { location.href = routeFor(key); }, 160);
}

document.querySelectorAll('[data-phone]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.phone;
    if (action === 'left') move(-1);
    if (action === 'right') move(1);
    if (action === 'enter') enter();
  });
});

document.addEventListener('click', (event) => {
  const tower = event.target.closest('.district[data-route]');
  if (!tower) return;
  const list = towers();
  const next = list.indexOf(tower);
  if (next >= 0) index = next;
  paint();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') move(-1);
  if (e.key === 'ArrowRight') move(1);
  if (e.key === 'Enter') enter();
});

requestAnimationFrame(paint);
setTimeout(paint, 300);
setTimeout(paint, 900);
