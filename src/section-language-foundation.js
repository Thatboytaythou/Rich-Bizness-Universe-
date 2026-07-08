import { pageCopy } from './rb-personality.js?v=brand-wide-2';

const key = String(document.body?.dataset?.section || document.documentElement?.dataset?.section || 'index').replace(/\.html$/,'');
const swaps = new Map([
  ['SIGN OUT','IM OUT ✌🏽'],
  ['SIGN IN','TAP IN'],
  ['SIGN IN / JOIN','TAP IN'],
  ['WE LIT🔥 WATCH','We 🔥📺'],
  ['WE FIRE TV','We 🔥📺'],
  ['WE LIT WATCH','We 🔥📺'],
  ['LIVE','WE LIT🔥'],
  ['WATCH','We 🔥📺'],
  ['FEED','RICH FEED'],
  ['DROP','DROP ZONE'],
  ['ME','PROFILE LOCK'],
  ['SYNC','READY'],
  ['SYNCED','READY'],
]);

function paintCopy(){
  const copy = pageCopy(key);
  if (!copy) return;
  document.querySelectorAll('.hero h1,#sectionTitle').forEach(el=>{ if(!el.dataset.locked) el.textContent = copy[0]; });
  document.querySelectorAll('.hero p,#sectionSubtitle').forEach(el=>{ if(!el.dataset.locked) el.textContent = copy[1]; });
}
function paintLabels(){
  document.querySelectorAll('h1,h2,h3,b,small,span,button,a').forEach(el=>{
    if(el.children.length) return;
    const text = (el.textContent || '').trim();
    if(swaps.has(text)) el.textContent = swaps.get(text);
  });
}
function boot(){
  paintCopy();
  paintLabels();
  window.dispatchEvent(new CustomEvent('rb-language-foundation-ready',{detail:{key}}));
}
boot();
setTimeout(boot,250);
setTimeout(boot,900);
export {};
