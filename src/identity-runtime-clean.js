const sections = new Set(['profile','avatar','avatar-characters']);
const section = document.body?.dataset?.section || document.documentElement?.dataset?.section || document.body?.dataset?.rbPage;
const kill = [
  '#globalXpBadge','#xpToast','.xp-gauge','[data-rich-money]','[data-balance-cents]','[data-wallet-money]',
  '.miniProfile','.composerPanel','.hero-art','.avatar-stand','.rb-phone','.rb-pad-index','#rbRunner','#rbMotionLayer',
  '.motion-rings','.motion-rings i'
];
function clean(){
  if(!sections.has(section)) return;
  document.querySelectorAll(kill.join(',')).forEach((el)=>el.remove());
  document.querySelectorAll('.portal-ring,.avatar,.avatar-body').forEach((el)=>{el.style.animation='none';el.style.transform='none';el.style.filter='none';});
  document.querySelectorAll('.hero,.avatar-preview,.avatar-panel,.panel,.card').forEach((el)=>{el.style.boxShadow='0 20px 60px rgba(0,0,0,.42), inset 0 0 28px rgba(99,255,93,.04)';});
  document.body?.removeAttribute('data-rich-money');
}
clean(); requestAnimationFrame(clean); setTimeout(clean,120); setTimeout(clean,600); setTimeout(clean,1400);
export {};
