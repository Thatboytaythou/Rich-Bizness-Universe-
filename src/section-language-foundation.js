import { pageCopy } from './rb-personality.js?v=brand-wide-2';

const key = String(document.body?.dataset?.section || document.documentElement?.dataset?.section || 'index').replace(/\.html$/,'');

function paintLanguage(){
  const copy = pageCopy(key);
  if(copy){
    document.querySelectorAll('.hero h1,#sectionTitle').forEach(el=>{ if(!el.dataset.locked) el.textContent = copy[0]; });
    document.querySelectorAll('.hero p,#sectionSubtitle').forEach(el=>{ if(!el.dataset.locked) el.textContent = copy[1]; });
  }

  document.querySelectorAll('button,a,span,b,small').forEach(el=>{
    if(el.children.length) return;
    const text = (el.textContent || '').trim();
    if(text === 'SIGN OUT') el.textContent = 'IM OUT ✌🏽';
    if(text === 'SIGN IN' || text === 'SIGN IN / JOIN') el.textContent = 'TAP IN';
    if(text === 'WATCH') el.textContent = 'We 🔥📺';
    if(text === 'LIVE' || text === 'WE LIT') el.textContent = 'WE LIT🔥';
    if(text === 'FEED') el.textContent = 'RICH FEED';
    if(text === 'DROP') el.textContent = 'DROP ZONE';
    if(text === 'ME') el.textContent = 'PROFILE LOCK';
  });

  document.documentElement.dataset.rbLanguageFoundation = 'copy-only';
  window.dispatchEvent(new CustomEvent('rb-language-foundation-ready',{detail:{key,mode:'copy-only'}}));
}

paintLanguage();
setTimeout(paintLanguage, 200);
setTimeout(paintLanguage, 700);

export {};
