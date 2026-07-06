import './identity-runtime-clean.js?v=identity-clean-1';
const body = document.getElementById('avatarBody');
const nameInput = document.getElementById('displayName');
const auraInput = document.getElementById('aura');
const motionInput = document.getElementById('motion');
const status = document.getElementById('status');
const pick = (id) => document.getElementById(id)?.value || '';
const colors = { 'Emerald Gold':['#63ff5d','#f7c948'], 'Galaxy Smoke':['#54e7ff','#b25cff'], 'Royal Flame':['#ff9d2e','#f7c948'], 'Diamond Mist':['#d8ffe5','#9dff63'], 'Neon Phantom':['#9dff63','#54e7ff'] };
function initials(v){return String(v||'RB').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'RB'}
function svg(){
  const name = nameInput?.value || 'RB';
  const [g,o] = colors[auraInput?.value] || colors['Emerald Gold'];
  const hat = pick('glasses') === 'Neon Visor' ? `<rect x="187" y="151" width="138" height="30" rx="12" fill="#020402" stroke="${g}" stroke-width="7"/>` : '';
  const chain = pick('chain') === 'None' ? '' : `<path d="M211 224c23 19 67 19 90 0" stroke="${o}" stroke-width="8" fill="none"/><circle cx="256" cy="250" r="18" fill="#020402" stroke="${o}" stroke-width="5"/>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640"><circle cx="256" cy="156" r="54" fill="#7a3d18" stroke="${o}" stroke-width="8"/><path d="M205 116c28-34 76-34 102 0" stroke="#090603" stroke-width="26" stroke-linecap="round"/>${hat}<path d="M256 214v168" stroke="${g}" stroke-width="24" stroke-linecap="round"/><path d="M158 268l98 56 98-56" stroke="${g}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M256 382l-72 150M256 382l72 150" stroke="${g}" stroke-width="24" stroke-linecap="round"/><path d="M148 550h86M278 550h86" stroke="${o}" stroke-width="17" stroke-linecap="round"/>${chain}<text x="256" y="341" text-anchor="middle" fill="${o}" font-family="Impact,Arial Black" font-size="48">${initials(name)}</text></svg>`)}`;
}
function render(){ if (!body) return; let img = body.querySelector('img'); if (!img) { body.textContent=''; img=document.createElement('img'); img.className='avatar-preview-img'; body.appendChild(img); } img.src = svg(); body.dataset.motion = motionInput?.value || 'Boss Idle'; if (status) status.textContent = 'Clean avatar layer active.'; }
['input','change','click'].forEach(evt => document.addEventListener(evt, () => setTimeout(render, 40), true));
setTimeout(render, 200);
setTimeout(render, 800);
