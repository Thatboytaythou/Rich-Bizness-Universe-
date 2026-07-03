import { routeFor } from './rb-schema-map.js';

(() => {
  if (window.__rbIndexBooted) return;
  window.__rbIndexBooted = true;

  const CANONICAL_HOST = 'rich-bizness.com';
  const APPROVED_HOSTS = ['rich-bizness.com', 'www.rich-bizness.com', 'rich-bizness-mobile-app.vercel.app'];
  const host = window.location.hostname;
  if (host.endsWith('.vercel.app') && !APPROVED_HOSTS.includes(host)) {
    window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`);
    return;
  }

  const VERSION = 'portal-phone-2';
  const addCss = (href, id) => {
    if (id && document.getElementById(id)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    if (id) link.id = id;
    link.href = href;
    document.head.appendChild(link);
  };
  const addModule = (src, key) => {
    if (document.querySelector(`script[data-rb-${key}]`)) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.dataset[`rb${key[0].toUpperCase()}${key.slice(1)}`] = 'true';
    document.head.appendChild(s);
  };

  addCss(`/src/index-clean.css?v=${VERSION}`, 'rbIndexClean');
  addCss(`/src/index-portal.css?v=${VERSION}`, 'rbPortalPhoneCss');
  addModule(`/src/realtime-data.js?v=${VERSION}`, 'realtime');
  addModule(`/src/index-portal.js?v=${VERSION}`, 'portal');

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