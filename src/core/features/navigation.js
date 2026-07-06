import { RB_FEATURES, RB_UNIVERSAL_INDEX, getFeatureRoute } from './index.js';
import { routeFor } from '../../rb-schema-map.js';

const KEY = '__rbNavigationReady';

function cleanKey(value = '') {
  return String(value || '').trim().replace(/^#/, '').replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '').replace(/_/g, '-');
}

export function appRoute(value) {
  const key = cleanKey(value);
  if (!key || key === 'home' || key === 'index') return '/';
  return getFeatureRoute(key) || routeFor(key) || '/';
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

function shouldSkipRoute(event, el) {
  if (!el || el.dataset.rbNative === 'true' || event.defaultPrevented) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  const page = cleanKey(document.body?.dataset.section || document.body?.dataset.rbPage || document.documentElement?.dataset.section || document.documentElement?.dataset.rbPage || 'index');
  if ((page === 'index' || page === 'home') && window.__rbIndexBooted) return true;
  return false;
}

export function bootNavigation() {
  if (window[KEY]) return;
  window[KEY] = true;
  const page = document.body?.dataset.section || document.body?.dataset.rbPage || document.documentElement?.dataset.section || document.documentElement?.dataset.rbPage || 'index';
  document.documentElement.dataset.rbUniversalApp = 'ready';
  document.body.dataset.rbUniversalApp = 'ready';
  document.body.dataset.rbFeature = cleanKey(page) || 'index';
  window.RichBiznessApp = Object.freeze({ source: RB_UNIVERSAL_INDEX.source, sections: RB_UNIVERSAL_INDEX.sections, systems: RB_UNIVERSAL_INDEX.systems, features: RB_FEATURES, routeFor: appRoute });
  syncNavigation();
  document.addEventListener('click', (event) => {
    const el = event.target.closest?.('[data-route],[data-rb-route]');
    if (shouldSkipRoute(event, el)) return;
    const key = el.getAttribute('data-route') || el.getAttribute('data-rb-route');
    const href = appRoute(key);
    if (!href) return;
    event.preventDefault();
    window.location.href = href;
  }, true);
  window.setTimeout(syncNavigation, 300);
  window.setTimeout(syncNavigation, 1000);
}

bootNavigation();
