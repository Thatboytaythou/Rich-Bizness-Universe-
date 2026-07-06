import { RB_FEATURES, RB_UNIVERSAL_INDEX, getFeatureRoute } from './index.js';
import { routeFor } from '../../rb-schema-map.js';

const KEY = '__rbNavigationReady';

function cleanKey(value = '') {
  return String(value || '')
    .trim()
    .replace(/^#/, '')
    .replace(/^\//, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '')
    .replace(/_/g, '-')
    .toLowerCase();
}

export function appRoute(value) {
  const key = cleanKey(value);
  if (!key || key === 'home' || key === 'index') return '/';
  return getFeatureRoute(key) || routeFor(key) || '/';
}

function currentPageKey() {
  return cleanKey(
    document.body?.dataset.section ||
    document.body?.dataset.rbPage ||
    document.documentElement?.dataset.section ||
    document.documentElement?.dataset.rbPage ||
    location.pathname ||
    'index'
  ) || 'index';
}

export function syncNavigation(root = document) {
  root.querySelectorAll?.('[data-route],[data-rb-route]').forEach((el) => {
    const key = el.getAttribute('data-route') || el.getAttribute('data-rb-route');
    const clean = cleanKey(key);
    el.setAttribute('data-rb-route', clean);
    if (el.tagName === 'A') el.setAttribute('href', appRoute(clean));
    if (el.tagName === 'BUTTON' && !el.getAttribute('type')) el.setAttribute('type', 'button');
  });
}

function markActiveRoutes() {
  const page = currentPageKey();
  document.querySelectorAll('.dock a,.dock button,.top-actions a,.top-actions button,[data-rb-route]').forEach((el) => {
    const key = cleanKey(el.getAttribute('data-rb-route') || el.getAttribute('data-route'));
    if (!key) return;
    const active = key === page || (page === 'index' && key === 'home');
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

function dedupeChrome() {
  // Keep one bottom dock per page. Do not touch content panels or visual art.
  const docks = [...document.querySelectorAll('.dock:not([data-rb-keep]), .profile-dock:not([data-rb-keep])')];
  if (docks.length > 1) {
    const page = currentPageKey();
    const scored = docks
      .map((dock, index) => {
        const hasActivePage = Boolean(dock.querySelector(`[data-route="${page}"], [data-rb-route="${page}"], .active`));
        const routeCount = dock.querySelectorAll('a,button,[data-route],[data-rb-route]').length;
        return { dock, index, score: (hasActivePage ? 100 : 0) + routeCount };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const keep = scored[0]?.dock;
    scored.forEach(({ dock }) => {
      if (dock !== keep) {
        dock.dataset.rbDuplicateDock = 'true';
        dock.remove();
      }
    });
  }
}

function shouldSkipRoute(event, el) {
  if (!el || el.dataset.rbNative === 'true' || event.defaultPrevented) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  if (el.getAttribute('target') && el.getAttribute('target') !== '_self') return true;
  return false;
}

export function bootNavigation() {
  if (window[KEY]) return;
  window[KEY] = true;

  const page = currentPageKey();
  document.documentElement.dataset.rbUniversalApp = 'ready';
  document.body.dataset.rbUniversalApp = 'ready';
  document.body.dataset.rbFeature = page;
  window.RichBiznessApp = Object.freeze({
    source: RB_UNIVERSAL_INDEX.source,
    sections: RB_UNIVERSAL_INDEX.sections,
    systems: RB_UNIVERSAL_INDEX.systems,
    features: RB_FEATURES,
    routeFor: appRoute,
  });

  syncNavigation();
  dedupeChrome();
  markActiveRoutes();

  document.addEventListener('click', (event) => {
    const el = event.target.closest?.('[data-route],[data-rb-route]');
    if (shouldSkipRoute(event, el)) return;
    const key = el.getAttribute('data-route') || el.getAttribute('data-rb-route');
    const href = appRoute(key);
    if (!href) return;
    if (href === location.pathname || (href === '/' && ['/', '/index.html'].includes(location.pathname))) {
      markActiveRoutes();
      return;
    }
    event.preventDefault();
    window.location.href = href;
  }, true);

  const resync = () => {
    syncNavigation();
    dedupeChrome();
    markActiveRoutes();
  };

  window.setTimeout(resync, 300);
  window.setTimeout(resync, 1000);
  window.addEventListener('rb-page-rendered', resync);
}

bootNavigation();
