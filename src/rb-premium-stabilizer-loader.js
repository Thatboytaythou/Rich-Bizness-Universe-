(() => {
  const cssId = 'rbPremiumStabilizer';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = '/src/rb-premium-stabilizer.css?v=premium-1';
    document.head.appendChild(link);
  }

  const kill = '#globalXpBadge,#xpToast,.xp-gauge,[data-rich-money],[data-balance-cents],[data-wallet-money],.rb-blocker,.rb-overlay,.hero-art,.miniProfile,.composerPanel,.rb-personal-strip,.rb-phone:not(.rb-phone-hub),.rb-pad-index,#rbRunner,#rbMotionLayer';
  function stabilize() {
    document.querySelectorAll(kill).forEach((el) => el.remove());
    document.querySelectorAll('.layout:empty,#schemaPanel:empty,#sectionCards:empty').forEach((el) => el.remove());
    document.querySelectorAll('.dock').forEach((dock, i, list) => { if (i < list.length - 1) dock.remove(); });
    if (document.body) {
      document.body.removeAttribute('data-rich-money');
      document.body.style.overflowX = 'hidden';
      document.body.style.overflowY = 'auto';
    }
  }
  stabilize();
  requestAnimationFrame(stabilize);
  setTimeout(stabilize, 400);
  setTimeout(stabilize, 1200);
})();
