import './core/features/navigation.js?v=universal-nav-4';
import './core/features/app-safe.css?v=universal-safe-4';
import { RB_SECTIONS, routeFor } from './rb-schema-map.js';
import './section-language-foundation.js?v=language-foundation-4';

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

  const APP_DOCK = ['home','feed','upload','live','watch','music','store','profile'];
  const DISTRICTS = ['meta','gallery','gaming','games','sports','live','watch','music','podcast','radio','store','upload','messages','notifications','search','settings','creator','admin','rb-secret'];
  const LABELS = { home:'HOME', feed:'RICH FEED', upload:'DROP ZONE', live:'WE LIT🔥', watch:'We 🔥📺', music:'MUSIC', store:'STORE', profile:'PROFILE LOCK', messages:'RICH-DM’s', notifications:'RICH ALERTS', search:'RICH SEARCH', settings:'SETTINGS', creator:'CREATOR', admin:'CONTROL', 'rb-secret':'RB VAULT' };

  const section = (key) => RB_SECTIONS.find((item) => item.key === key) || { key, title: LABELS[key] || key.toUpperCase(), subtitle: 'OPEN', route: routeFor(key) };
  const label = (key) => LABELS[key] || section(key).title || key.toUpperCase();
  const href = (key) => key === 'home' ? '/' : key === 'profile' ? '/profile.html' : routeFor(key) || `/${key}.html`;

  function calmBlockers() {
    document.querySelectorAll('.rb-overlay:not([data-rb-keep]), .rb-blocker:not([data-rb-keep])').forEach((el) => {
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.dataset.rbCalmed = 'true';
    });
    document.body?.removeAttribute('data-rich-money');
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';
    document.documentElement.dataset.rbUniversalApp = 'ready';
    document.body.dataset.rbUniversalApp = 'ready';
  }

  function killStuckMedia() {
    try { window.__RB_LIVE_ROOM__?.disconnect?.(); } catch (_) {}
    window.__RB_LIVE_ROOM__ = null;
    try { (window.__RB_LIVE_TRACKS__ || []).forEach((t) => { try { t.stop?.(); } catch (_) {} try { t.mediaStreamTrack?.stop?.(); } catch (_) {} try { t.detach?.().forEach((el) => el.remove()); } catch (_) {} }); } catch (_) {}
    window.__RB_LIVE_TRACKS__ = [];
    document.querySelectorAll('video,audio').forEach((el) => {
      try { el.pause(); } catch (_) {}
      try { el.srcObject?.getTracks?.().forEach((track) => track.stop()); } catch (_) {}
      try { el.srcObject = null; } catch (_) {}
      if (!el.closest('#holoScreen')) el.remove();
    });
    document.querySelectorAll('.floating-video,.floating-camera,.camera-preview,.video-preview,.local-preview,.pip-preview,[data-floating-video]').forEach((el) => el.remove());
  }

  function wireIndexRoutes() {
    const grid = document.querySelector('.district-grid');
    if (grid && grid.dataset.rbIndexMapped !== 'true') {
      grid.dataset.rbIndexMapped = 'true';
      grid.innerHTML = DISTRICTS.map((key) => {
        const s = section(key);
        return `<a class="district ${key}" data-route="${key}" href="${href(key)}"><b>${label(key)}</b><small>${s.subtitle || 'OPEN'}</small></a>`;
      }).join('');
    }

    const dock = document.querySelector('.dock');
    if (dock) {
      dock.dataset.rbIndexDock = 'one-app-dock';
      dock.innerHTML = APP_DOCK.map((key) => `<a href="${href(key)}" data-route="${key}"${key === 'home' ? ' class="active"' : ''}><span>${label(key)}</span></a>`).join('');
    }
  }

  function forceLayout() {
    calmBlockers();
    killStuckMedia();
    wireIndexRoutes();

    const universe = document.querySelector('.rb-universe');
    const stage = document.querySelector('.stage');
    const portalZone = document.querySelector('.portal-zone');
    const portal = document.querySelector('.portal');
    const grid = document.querySelector('.district-grid');
    const dock = document.querySelector('.dock');

    if (universe) {
      universe.style.height = 'auto';
      universe.style.minHeight = '100svh';
      universe.style.overflow = 'visible';
      universe.style.paddingBottom = 'calc(168px + env(safe-area-inset-bottom))';
      universe.style.backgroundImage = "linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.68)),url('/images/19FB5229-30DD-40B0-9404-5136C27FEF6A.png')";
      universe.style.backgroundSize = 'cover';
      universe.style.backgroundPosition = 'center';
    }
    if (stage) {
      stage.style.height = 'auto';
      stage.style.minHeight = '0';
      stage.style.overflow = 'visible';
      stage.style.display = 'grid';
      stage.style.gap = '14px';
    }
    if (portalZone) {
      portalZone.style.position = 'relative';
      portalZone.style.inset = 'auto';
      portalZone.style.minHeight = '260px';
      portalZone.style.display = 'grid';
      portalZone.style.placeItems = 'center';
      portalZone.style.pointerEvents = 'none';
    }
    if (portal) {
      portal.style.position = 'relative';
      portal.style.left = 'auto';
      portal.style.top = 'auto';
      portal.style.transform = 'none';
      portal.style.width = 'min(70vw, 310px)';
      portal.style.pointerEvents = 'none';
    }
    if (grid) {
      grid.style.position = 'relative';
      grid.style.inset = 'auto';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr 1fr';
      grid.style.gap = '10px';
      grid.style.zIndex = '50';
      grid.style.pointerEvents = 'auto';
    }
    document.querySelectorAll('.district').forEach((el) => {
      el.style.position = 'relative';
      el.style.left = 'auto';
      el.style.right = 'auto';
      el.style.top = 'auto';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
      el.style.width = 'auto';
      el.style.maxWidth = 'none';
      el.style.pointerEvents = 'auto';
    });
    if (dock) {
      dock.style.position = 'fixed';
      dock.style.zIndex = '140';
      dock.style.left = '8px';
      dock.style.right = '8px';
      dock.style.bottom = 'calc(78px + env(safe-area-inset-bottom))';
      dock.style.pointerEvents = 'auto';
      dock.style.display = 'grid';
      dock.style.gridTemplateColumns = 'repeat(8,minmax(0,1fr))';
      dock.style.overflow = 'visible';
    }
  }

  const toast = document.getElementById('toast');
  function show(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(window.__rbToastTimer);
    window.__rbToastTimer = setTimeout(() => toast.classList.remove('show'), 700);
  }

  requestAnimationFrame(forceLayout);
  setTimeout(forceLayout, 250);
  setTimeout(forceLayout, 900);
  setTimeout(forceLayout, 1800);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-route]');
    if (!link || link.dataset.rbNative === 'true') return;
    const key = link.dataset.route || 'home';
    document.querySelectorAll('.dock a,.dock button').forEach((item) => item.classList.remove('active'));
    if (link.closest('.dock')) link.classList.add('active');
    if (key === 'home') {
      event.preventDefault();
      show('HOME ONLINE');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    show(`${label(key)} OPENING`);
  });
})();
