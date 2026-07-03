import { routeFor } from './rb-schema-map.js';

const towers = [...document.querySelectorAll('.district[data-route]')];
const title = document.getElementById('phoneTitle');
const hint = document.getElementById('phoneHint');
const status = document.getElementById('phoneStatus');
let index = Math.max(0, towers.findIndex((t) => t.dataset.route === 'meta'));

function paint() {
  towers.forEach((t, i) => t.classList.toggle('active', i === index));
  const tower = towers[index];
  if (!tower) return;
  title.textContent = tower.querySelector('b')?.textContent || 'PORTAL HUB';
  hint.textContent = tower.querySelector('small')?.textContent || 'ENTER';
  status.textContent = (tower.dataset.route || 'READY').toUpperCase();
}
function move(delta) {
  if (!towers.length) return;
  index = (index + delta + towers.length) % towers.length;
  paint();
}
function enter() {
  const tower = towers[index];
  if (!tower) return;
  const key = tower.dataset.route;
  status.textContent = 'OPENING';
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
towers.forEach((tower, i) => tower.addEventListener('click', () => { index = i; paint(); }));
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') move(-1);
  if (e.key === 'ArrowRight') move(1);
  if (e.key === 'Enter') enter();
});
paint();
