const sections = new Set(['profile','avatar','avatar-characters']);
const section = document.body?.dataset?.section || document.documentElement?.dataset?.section || document.body?.dataset?.rbPage;

const removeOnly = [
  '#globalXpBadge',
  '#xpToast',
  '.xp-gauge',
  '[data-rich-money]',
  '[data-balance-cents]',
  '[data-wallet-money]',
  '.miniProfile',
  '.composerPanel',
  '.rb-blocker:not([data-rb-keep])',
  '.rb-overlay:not([data-rb-keep])'
];

const makeSafeOnly = [
  '.portal-ring',
  '.avatar-preview',
  '.avatar-panel',
  '.panel',
  '.card'
];

function clean(){
  if(!sections.has(section)) return;

  document.querySelectorAll(removeOnly.join(',')).forEach((el)=>el.remove());

  document.querySelectorAll(makeSafeOnly.join(',')).forEach((el)=>{
    if (el.dataset.rbKeepVisual === 'true') return;
    el.style.pointerEvents = 'auto';
  });

  document.querySelectorAll('a,button,input,select,textarea,[role="button"],[data-route],[data-rb-route]').forEach((el)=>{
    el.style.pointerEvents = 'auto';
  });

  document.body?.removeAttribute('data-rich-money');
  document.body?.setAttribute('data-rb-identity-clean','ready');
}

clean();
requestAnimationFrame(clean);
setTimeout(clean,120);
setTimeout(clean,600);

export {};
