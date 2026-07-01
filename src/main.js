import { routeFor } from './rb-schema-map.js';

(() => {
  if (window.__rbIndexBooted) return;
  window.__rbIndexBooted = true;

  const addCss = (href, id) => {
    if (id && document.getElementById(id)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    if (id) link.id = id;
    link.href = href;
    document.head.appendChild(link);
  };

  addCss('/src/cinema-base.css?v=index-lock-4', 'rbCinemaBase');
  addCss('/src/cinema-motion.css?v=index-lock-4', 'rbCinemaMotion');
  addCss('/src/scroll-safe.css?v=index-lock-4', 'rbMobilePortrait');
  addCss('/src/xp-gauge.css?v=index-lock-4', 'rbXpGauge');

  if (!document.querySelector('script[data-rb-cinema]')) {
    const script = document.createElement('script');
    script.src = '/src/cinematic.js?v=index-lock-4';
    script.defer = true;
    script.dataset.rbCinema = 'true';
    document.head.appendChild(script);
  }

  if (!document.querySelector('script[data-rb-realtime]')) {
    const live = document.createElement('script');
    live.type = 'module';
    live.src = '/src/realtime-data.js?v=index-lock-4';
    live.dataset.rbRealtime = 'true';
    document.head.appendChild(live);
  }

  const toast = document.getElementById('toast');
  const show = (text) => {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(window.__rbToastTimer);
    window.__rbToastTimer = setTimeout(() => toast.classList.remove('show'), 900);
  };

  document.querySelectorAll('[data-route]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const key = button.dataset.route || 'home';
      document.querySelectorAll('.dock button').forEach((item) => item.classList.remove('active'));
      if (button.closest('.dock')) button.classList.add('active');

      if (key === 'home') {
        show('HOME ONLINE');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const route = routeFor(key);
      show(`${key.toUpperCase()} PORTAL OPENING`);
      window.setTimeout(() => { window.location.href = route; }, 220);
    });
  });
})();
