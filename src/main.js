import { RB_SECTIONS, routeFor } from './rb-schema-map.js';

(() => {
  if (window.__rbIndexBooted) return;
  window.__rbIndexBooted = true;
  const CANONICAL_HOST = 'rich-bizness.com';
  const APPROVED_HOSTS = ['rich-bizness.com', 'www.rich-bizness.com', 'rich-bizness-mobile-app.vercel.app'];
  const host = window.location.hostname;
  if (host.endsWith('.vercel.app') && !APPROVED_HOSTS.includes(host)) { window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`); return; }
  const VERSION = 'universe-map-1';
  const HOME_LANES = ['meta','feed','live','watch','music','podcast','radio','gaming','games','sports','store','upload','search','messages','notifications','avatar-characters','creator','admin','rb-secret','profile'];
  const DISTRICT_LANES = ['meta','feed','live','watch','music','podcast','radio','gaming','games','sports','store','upload','avatar-characters','creator','admin','rb-secret'];
  const icon = { home:'⌂', feed:'▤', live:'◉', watch:'▶', music:'♪', podcast:'🎙', radio:'◌', gaming:'🎮', games:'♟', sports:'◎', store:'🛒', meta:'◇', upload:'⬆', search:'⌕', messages:'✉', notifications:'🔔', creator:'♕', admin:'⚙', 'rb-secret':'◆', profile:'♙', 'avatar-characters':'☻' };
  const addCss = (href, id) => { let link = id ? document.getElementById(id) : null; if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; if (id) link.id = id; document.head.appendChild(link); } link.href = href; };
  const addModule = (src, key) => { if (document.querySelector(`script[data-rb-${key}]`)) return; const s = document.createElement('script'); s.type = 'module'; s.src = src; s.dataset[`rb${key[0].toUpperCase()}${key.slice(1)}`] = 'true'; document.head.appendChild(s); };
  const section = (key) => RB_SECTIONS.find((item) => item.key === key) || { key, title: key.toUpperCase(), subtitle: 'Rich Bizness route', route: routeFor(key) };
  const label = (s) => s.key === 'rb-secret' ? 'RB VAULT' : s.key === 'live' ? 'WE LIT🔥' : s.title;
  const removeBlockers = () => { document.querySelectorAll('#globalXpBadge,.hero-art,.rb-overlay,.rb-blocker,.rb-personal-strip,.miniProfile,.composerPanel,.top:not(.topbar),.layout,#schemaPanel,#sectionCards').forEach((el) => el.remove()); };
  const wireIndexRoutes = () => {
    const grid = document.querySelector('.district-grid');
    if (grid && grid.dataset.mapped !== 'true') {
      grid.dataset.mapped = 'true';
      grid.innerHTML = DISTRICT_LANES.map((key) => { const s = section(key); return `<button class="district ${key}" data-route="${key}"><b>${label(s)}</b><small>${s.subtitle || 'OPEN'}</small></button>`; }).join('');
    }
    const dock = document.querySelector('.dock');
    if (dock && dock.dataset.mapped !== 'true') {
      dock.dataset.mapped = 'true';
      dock.innerHTML = `<button type="button" data-route="home" class="active">${icon.home}<span>HOME</span></button>` + HOME_LANES.map((key) => { const s = section(key); return `<button type="button" data-route="${key}">${icon[key] || '•'}<span>${s.key === 'rb-secret' ? 'VAULT' : s.key === 'avatar-characters' ? 'AVATARS' : s.key === 'notifications' ? 'ALERTS' : label(s).split(' ')[0]}</span></button>`; }).join('');
    }
  };
  const forceLayout = () => {
    removeBlockers(); wireIndexRoutes();
    const body = document.body, universe = document.querySelector('.rb-universe'), stage = document.querySelector('.stage'), portalZone = document.querySelector('.portal-zone'), portal = document.querySelector('.portal'), grid = document.querySelector('.district-grid'), dock = document.querySelector('.dock');
    if (body) { body.style.overflowY = 'auto'; body.style.background = '#020402'; }
    if (universe) { universe.style.height = 'auto'; universe.style.minHeight = '100svh'; universe.style.overflow = 'visible'; universe.style.paddingBottom = '124px'; universe.style.backgroundImage = "linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.68)),url('/images/19FB5229-30DD-40B0-9404-5136C27FEF6A.png')"; universe.style.backgroundSize = 'cover'; universe.style.backgroundPosition = 'center'; }
    if (stage) { stage.style.height = 'auto'; stage.style.minHeight = '0'; stage.style.overflow = 'visible'; stage.style.display = 'grid'; stage.style.gap = '14px'; }
    if (portalZone) { portalZone.style.position = 'relative'; portalZone.style.inset = 'auto'; portalZone.style.minHeight = '260px'; portalZone.style.display = 'grid'; portalZone.style.placeItems = 'center'; }
    if (portal) { portal.style.position = 'relative'; portal.style.left = 'auto'; portal.style.top = 'auto'; portal.style.transform = 'none'; portal.style.width = 'min(70vw, 310px)'; }
    if (grid) { grid.style.position = 'relative'; grid.style.inset = 'auto'; grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr 1fr'; grid.style.gap = '10px'; }
    document.querySelectorAll('.district').forEach((el) => { el.style.position = 'relative'; el.style.left = 'auto'; el.style.right = 'auto'; el.style.top = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; el.style.width = 'auto'; el.style.maxWidth = 'none'; });
    if (dock) { dock.style.position = 'fixed'; dock.style.zIndex = '90'; dock.style.left = '14px'; dock.style.right = '14px'; dock.style.bottom = '14px'; }
  };
  addCss(`/src/index-hard-reset.css?v=${VERSION}`, 'rbHardReset'); addModule(`/src/realtime-data.js?v=${VERSION}`, 'realtime');
  requestAnimationFrame(forceLayout); setTimeout(forceLayout, 250); setTimeout(forceLayout, 900);
  const toast = document.getElementById('toast');
  const show = (text) => { if (!toast) return; toast.textContent = text; toast.classList.add('show'); clearTimeout(window.__rbToastTimer); window.__rbToastTimer = setTimeout(() => toast.classList.remove('show'), 900); };
  document.addEventListener('click', (event) => { const button = event.target.closest('[data-route]'); if (!button) return; const key = button.dataset.route || 'home'; document.querySelectorAll('.dock button').forEach((item) => item.classList.remove('active')); if (button.closest('.dock')) button.classList.add('active'); if (key === 'home') { show('HOME ONLINE'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; } show(`${key.toUpperCase()} OPENING`); window.setTimeout(() => { window.location.href = routeFor(key); }, 160); });
})();
