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
  const VERSION = 'layout-recovery-1';
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
  const forceLayout = () => {
    const body = document.body;
    const universe = document.querySelector('.rb-universe');
    const stage = document.querySelector('.stage');
    const portalZone = document.querySelector('.portal-zone');
    const portal = document.querySelector('.portal');
    const grid = document.querySelector('.district-grid');
    const dock = document.querySelector('.dock');
    if (body) { body.style.overflowY = 'auto'; body.style.background = '#020402'; }
    if (universe) { universe.style.height = 'auto'; universe.style.minHeight = '100svh'; universe.style.overflow = 'visible'; universe.style.paddingBottom = '120px'; }
    if (stage) { stage.style.height = 'auto'; stage.style.minHeight = '0'; stage.style.overflow = 'visible'; stage.style.display = 'grid'; stage.style.gap = '14px'; }
    if (portalZone) { portalZone.style.position = 'relative'; portalZone.style.inset = 'auto'; portalZone.style.minHeight = '280px'; portalZone.style.display = 'grid'; portalZone.style.placeItems = 'center'; }
    if (portal) { portal.style.position = 'relative'; portal.style.left = 'auto'; portal.style.top = 'auto'; portal.style.transform = 'none'; portal.style.width = 'min(72vw, 320px)'; }
    if (grid) { grid.style.position = 'relative'; grid.style.inset = 'auto'; grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr 1fr'; grid.style.gap = '10px'; }
    document.querySelectorAll('.district').forEach((el) => { el.style.position = 'relative'; el.style.left = 'auto'; el.style.right = 'auto'; el.style.top = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; el.style.width = 'auto'; el.style.maxWidth = 'none'; });
    const meta = document.querySelector('.district.meta');
    if (meta) meta.style.gridColumn = '1 / -1';
    if (dock) { dock.style.position = 'fixed'; dock.style.zIndex = '90'; dock.style.left = '14px'; dock.style.right = '14px'; dock.style.bottom = '14px'; }
    document.querySelectorAll('.live b').forEach((el) => { el.textContent = 'WE LIT🔥'; });
  };
  addCss(`/src/index-clean.css?v=${VERSION}`, 'rbIndexClean');
  addCss(`/src/index-portal.css?v=${VERSION}`, 'rbPortalPhoneCss');
  addModule(`/src/realtime-data.js?v=${VERSION}`, 'realtime');
  requestAnimationFrame(forceLayout);
  setTimeout(forceLayout, 250);
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
      if (key === 'home') { show('HOME ONLINE'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const route = routeFor(key);
      show(`${key.toUpperCase()} OPENING`);
      window.setTimeout(() => { window.location.href = route; }, 180);
    });
  });
})();