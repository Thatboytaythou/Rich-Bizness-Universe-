(() => {
  const addCss = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  addCss('/src/portrait.css?v=portrait-fix-3');
  addCss('/src/avatar-body.css?v=avatar-body-1');
  addCss('/src/cinema-base.css?v=cinema-1');
  addCss('/src/cinema-motion.css?v=cinema-1');
  addCss('/src/height-fix.css?v=height-fix-1');
  addCss('/src/scroll-safe.css?v=scroll-safe-1');

  window.import('/src/cinematic.js?v=cinema-1').catch(() => {});
  window.import('/src/realtime-data.js?v=realtime-1').catch(() => {});

  const toast = document.getElementById('toast');
  const show = (text) => {
    if (!toast) return;
    toast.textContent = text + ' coming online';
    toast.classList.add('show');
    clearTimeout(window.__rbToastTimer);
    window.__rbToastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
  };

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => {
      const route = button.dataset.route || 'home';
      document.querySelectorAll('.dock button').forEach((item) => item.classList.remove('active'));
      if (button.closest('.dock')) button.classList.add('active');
      show(route.toUpperCase());
    });
  });
})();
