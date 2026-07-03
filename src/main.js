import { routeFor } from './rb-schema-map.js';
import './rb-xp-boot.js';
import './rb-personality.js';
import './rb-personal-build.js';

(() => {
  if (window.__rbIndexBooted) return;
  window.__rbIndexBooted = true;

  const CANONICAL_HOST = 'rich-bizness.com';
  const LEGACY_HOSTS = [
    'rich-bizness-mobile-app.vercel.app',
    'rich-bizness-mobile.vercel.app',
    'rich-bizness-llc-rich-bizness-llc.vercel.app',
    'rich-bizness-llc-git-main-rich-bizness-llc.vercel.app'
  ];
  const host = window.location.hostname;
  if (LEGACY_HOSTS.includes(host)) {
    window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`);
    return;
  }

  const VERSION = 'legacy-domain-fix-1';

  const addCss = (href, id) => {
    if (id && document.getElementById(id)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    if (id) link.id = id;
    link.href = href;
    document.head.appendChild(link);
  };

  addCss(`/src/cinema-base.css?v=${VERSION}`, 'rbCinemaBase');
  addCss(`/src/cinema-motion.css?v=${VERSION}`, 'rbCinemaMotion');
  addCss(`/src/scroll-safe.css?v=${VERSION}`, 'rbMobilePortrait');
  addCss(`/src/xp-gauge.css?v=${VERSION}`, 'rbXpGauge');
  addCss(`/src/index-iphone-fix.css?v=${VERSION}`, 'rbIndexIphoneFix');
  addCss(`/src/index-real.css?v=${VERSION}`, 'rbIndexReal');
  addCss(`/src/index-stack-fix.css?v=${VERSION}`, 'rbIndexStackFix');

  if (!document.querySelector('script[data-rb-cinema]')) {
    const script = document.createElement('script');
    script.src = `/src/cinematic.js?v=${VERSION}`;
    script.defer = true;
    script.dataset.rbCinema = 'true';
    document.head.appendChild(script);
  }

  if (!document.querySelector('script[data-rb-realtime]')) {
    const live = document.createElement('script');
    live.type = 'module';
    live.src = `/src/realtime-data.js?v=${VERSION}`;
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
      show(`${key.toUpperCase()} OPENING`);
      window.setTimeout(() => { window.location.href = route; }, 180);
    });
  });
})();