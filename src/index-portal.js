const routes = ['meta','gallery','gaming','podcast','sports','music','store','live','upload'];
let x = 50;
let y = 50;
let active = 'meta';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function routeLabel(key){ return ({meta:'META',gallery:'GALLERY',gaming:'GAMES',podcast:'PODCAST',sports:'SPORTS',music:'MUSIC',store:'STORE',live:'LIVE',upload:'UPLOAD'})[key] || key.toUpperCase(); }
function mount(){
  if(!$('.stage') || $('#rbRunner')) return;
  $('.stage').insertAdjacentHTML('beforeend','<div id="rbRunner" class="rb-runner" aria-hidden="true"></div>');
  document.body.insertAdjacentHTML('beforeend',`<section class="rb-phone" id="rbPhone"><button class="rb-phone-tab" type="button" id="phoneTab">APP</button><div class="rb-phone-inner"><div class="rb-phone-head"><b>RB PHONE</b><small id="phoneStatus">META</small></div><div class="rb-phone-grid">${routes.map(r=>`<button type="button" data-phone-route="${r}">${routeLabel(r)}</button>`).join('')}</div><div class="rb-pad-index"><button data-move="up">↑</button><button data-move="left">←</button><button data-move="down">↓</button><button data-move="right">→</button><button data-launch="true">ENTER</button></div></div></section>`);
  $('#phoneTab').onclick = () => $('#rbPhone').classList.toggle('open');
  $$('[data-move]').forEach(b => b.onclick = () => move(b.dataset.move));
  $$('[data-launch]').forEach(b => b.onclick = launch);
  $$('[data-phone-route]').forEach(b => b.onclick = () => focusRoute(b.dataset.phoneRoute));
  window.addEventListener('keydown',(e)=>{ if(e.key==='ArrowUp')move('up'); if(e.key==='ArrowDown')move('down'); if(e.key==='ArrowLeft')move('left'); if(e.key==='ArrowRight')move('right'); if(e.key==='Enter') launch(); });
  focusRoute(active);
  draw();
}
function draw(){ const r=$('#rbRunner'); if(!r)return; r.style.left=x+'%'; r.style.top=y+'%'; }
function nearest(){ let best=active,dist=9999; routes.forEach(k=>{ const el=$(`.district[data-route="${k}"]`); if(!el)return; const box=el.getBoundingClientRect(); const s=$('.stage').getBoundingClientRect(); const cx=((box.left+box.width/2)-s.left)/s.width*100; const cy=((box.top+box.height/2)-s.top)/s.height*100; const d=Math.hypot(cx-x,cy-y); if(d<dist){dist=d;best=k;} }); return best; }
function move(dir){ if(dir==='up')y=Math.max(5,y-8); if(dir==='down')y=Math.min(93,y+8); if(dir==='left')x=Math.max(5,x-8); if(dir==='right')x=Math.min(95,x+8); draw(); focusRoute(nearest(), false); }
function focusRoute(key, jump=true){ active=key; if(jump){ const el=$(`.district[data-route="${key}"]`); if(el){ const box=el.getBoundingClientRect(); const s=$('.stage').getBoundingClientRect(); x=((box.left+box.width/2)-s.left)/s.width*100; y=((box.top+box.height/2)-s.top)/s.height*100; draw(); } }
  $$('.district').forEach(el=>el.classList.toggle('focused',el.dataset.route===key));
  $$('[data-phone-route]').forEach(el=>el.classList.toggle('active',el.dataset.phoneRoute===key));
  const status=$('#phoneStatus'); if(status) status.textContent=routeLabel(key);
}
function launch(){ const el=$(`.district[data-route="${active}"]`); if(el) el.click(); }
mount();
