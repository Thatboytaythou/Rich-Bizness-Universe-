import { pageCopy } from './rb-personality.js?v=brand-wide-2';

const key = String(document.body?.dataset?.section || document.documentElement?.dataset?.section || 'index').replace(/\.html$/,'');
const labels = { auth:'TAP IN', profile:'PROFILE LOCK', avatar:'AVATAR', 'avatar-characters':'CHARACTERS', feed:'RICH FEED', upload:'DROP ZONE', live:'WE LIT🔥', watch:'We 🔥📺', music:'MUSIC', podcast:'PODCAST', radio:'RADIO', gaming:'GAMING', games:'GAMES', gallery:'GALLERY', sports:'SPORTS', store:'STORE', meta:'META', messages:'RICH-DM’s', notifications:'RICH ALERTS', search:'RICH SEARCH', settings:'SETTINGS', edit:'EDIT EVERYTHING', creator:'CREATOR', admin:'CONTROL', 'rb-secret':'RB VAULT' };
const clean = (v='') => String(v).trim().replace(/^\//,'').replace(/\.html$/,'').replace(/\?.*/,'').replace(/\/$/,'').replace(/_/g,'-') || 'home';
const dockOrder = ['home','feed','upload','live','watch','music','store','profile'];
function label(id){ return labels[id] || labels[clean(id)] || String(id || 'OPEN').toUpperCase(); }
function href(id){ if(id==='home') return '/'; if(id==='profile') return '/profile.html'; return `/${id}.html`; }
function active(id){ return id === key || (id === 'home' && (key === 'index' || key === 'home')); }
function killMedia(){
  if(key === 'live') return;
  try { window.__RB_LIVE_ROOM__?.disconnect?.(); } catch(_) {}
  window.__RB_LIVE_ROOM__ = null;
  try { (window.__RB_LIVE_TRACKS__ || []).forEach(t=>{ try{t.stop?.()}catch(_){} try{t.mediaStreamTrack?.stop?.()}catch(_){} try{t.detach?.().forEach(el=>el.remove())}catch(_){} }); } catch(_) {}
  window.__RB_LIVE_TRACKS__ = [];
  document.querySelectorAll('video,audio').forEach(el=>{ try{el.pause()}catch(_){} try{el.srcObject?.getTracks?.().forEach(t=>t.stop())}catch(_){} try{el.srcObject=null}catch(_){} if(!el.closest('#holoScreen')) el.remove(); });
  document.querySelectorAll('.floating-video,.floating-camera,.camera-preview,.video-preview,.local-preview,.pip-preview,[data-floating-video]').forEach(el=>el.remove());
}
function calm(){ killMedia(); document.querySelectorAll('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep])').forEach(el=>{ el.style.pointerEvents='none'; el.setAttribute('aria-hidden','true'); }); document.body.style.overflowY='auto'; document.body.style.touchAction='manipulation'; document.documentElement.dataset.rbLanguageFoundation='ready'; }
function normalizeDock(dock){ if(!dock) return; dock.dataset.rbDockUnified='true'; dock.classList.add('dock'); dock.setAttribute('aria-label','Rich Bizness navigation'); dock.style.setProperty('--rb-dock-count', String(dockOrder.length)); dock.innerHTML = dockOrder.map(id=>`<a href="${href(id)}" data-route="${id}"${active(id)?' class="active"':''}><span>${label(id)}</span></a>`).join(''); }
function normalizeVisibleLabels(){ document.querySelectorAll('.dock,.profile-dock,.avatar-dock').forEach(normalizeDock); document.querySelectorAll('.top-actions a,[data-route]').forEach(el=>{ const hrefValue=el.getAttribute('href')||''; const id=clean(el.dataset.route || hrefValue || el.textContent); const span=el.querySelector('span'); if(span && labels[id]) span.textContent=label(id); if(!span && el.classList.contains('pill') && labels[id]) el.textContent=label(id); }); }
function paintLanguage(){ const copy=pageCopy(key); if(copy){ document.querySelectorAll('.hero h1,#sectionTitle').forEach(el=>{ if(!el.dataset.locked) el.textContent=copy[0]; }); document.querySelectorAll('.hero p,#sectionSubtitle').forEach(el=>{ if(!el.dataset.locked) el.textContent=copy[1]; }); } document.querySelectorAll('h1,h2,h3,b,small,span,button,a').forEach(el=>{ if(el.children.length) return; const t=(el.textContent||'').trim(); if(t==='SIGN OUT') el.textContent='IM OUT ✌🏽'; if(t==='SIGN IN'||t==='SIGN IN / JOIN') el.textContent='TAP IN'; if(t==='WE LIT🔥 WATCH'||t==='WE FIRE TV') el.textContent='We 🔥📺'; if(t==='SYNC'||t==='SYNCED') el.textContent='READY'; if(t==='FEED') el.textContent='RICH FEED'; if(t==='DROP') el.textContent='DROP ZONE'; if(t==='LIVE') el.textContent='WE LIT🔥'; if(t==='WE LIT') el.textContent='WE LIT🔥'; if(t==='WATCH') el.textContent='We 🔥📺'; if(t==='ME') el.textContent='PROFILE LOCK'; }); }
function boot(){ calm(); paintLanguage(); normalizeVisibleLabels(); window.dispatchEvent(new CustomEvent('rb-language-foundation-ready',{detail:{key}})); }
boot(); setTimeout(boot,200); setTimeout(boot,700); setTimeout(boot,1400); setTimeout(boot,2400);
new MutationObserver(()=>boot()).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pagehide', killMedia);
window.addEventListener('beforeunload', killMedia);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) killMedia(); });
