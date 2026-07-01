(() => {
  const addCss = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  addCss('/src/portrait.css?v=portrait-lock-1');
  addCss('/src/cinema-base.css?v=cinema-lock-1');
  addCss('/src/cinema-motion.css?v=cinema-lock-1');
  addCss('/src/height-fix.css?v=height-lock-1');
  addCss('/src/scroll-safe.css?v=mobile-lock-1');
  addCss('/src/xp-gauge.css?v=xp-lock-1');

  const script = document.createElement('script');
  script.src = '/src/cinematic.js?v=cinema-lock-1';
  script.defer = true;
  document.head.appendChild(script);

  const live = document.createElement('script');
  live.type = 'module';
  live.src = '/src/realtime-data.js?v=realtime-lock-1';
  document.head.appendChild(live);

  const toast = document.getElementById('toast');
  const show = (text) => {
    if (!toast) return;
    toast.textContent = text + ' coming online';
    toast.classList.add('show');
    clearTimeout(window.__rbToastTimer);
    window.__rbToastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
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
