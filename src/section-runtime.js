import { supabase } from './supabase-client.js';
import { RB_SECTIONS, sectionFor, routeFor } from './rb-schema-map.js';
import { requireTapIn, signOutAndGoHome } from './rb-identity.js?v=tap-in-foundation-2';
import './rb-personality.js?v=brand-wide-1';
import './identity-runtime-clean.js?v=identity-clean-1';
import './section-language-foundation.js?v=language-foundation-1';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n) => Number(n || 0).toLocaleString();
const cleanKey = (v = '') => String(v || '').replace(/^\//, '').replace(/\.html$/, '').replace(/\?.*$/, '').replace(/\/$/, '').replace(/_/g, '-') || 'home';
const key = cleanKey(document.body?.dataset?.section || document.documentElement?.dataset?.section || location.pathname.split('/').pop() || 'home');
const sections = new Map(RB_SECTIONS.map((s) => [s.key, s]));
const publicRoutes = new Set(['auth']);
const dedicated = new Set(['gaming','games','avatar-characters','meta','live','watch','avatar','profile','auth','admin','creator','rb-secret','feed','upload']);
const dockKeys = ['profile','feed','upload','live','watch','music','podcast','radio','gaming','games','gallery','sports','store','meta','messages','notifications','search','edit','settings','creator','admin','rb-secret'];
const icons = { profile:'♙', feed:'▤', upload:'⬆', live:'◉', watch:'▶', music:'♪', podcast:'🎙', radio:'◌', gaming:'🎮', games:'♟', gallery:'▣', sports:'◎', store:'🛒', meta:'◇', messages:'✉', notifications:'🔔', search:'⌕', edit:'✎', settings:'⚙', creator:'♕', admin:'◆', 'rb-secret':'▣' };
const labelMap = { profile:'PROFILE LOCK', feed:'RICH FEED', upload:'DROP ZONE', live:'WE LIT🔥', watch:'We 🔥📺', notifications:'RICH ALERTS', messages:'RICH-DM’s', 'rb-secret':'RB VAULT', 'avatar-characters':'CHARACTERS' };
let currentProfile = null;

function cleanBlockers() {
  $$('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep]),.motion-rings:not([data-rb-keep])').forEach((el) => {
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden', 'true');
  });
  document.body.style.overflowY = 'auto';
  document.body.style.overflowX = 'hidden';
  document.documentElement.dataset.rbUniversalApp = 'ready';
  document.body.dataset.rbUniversalApp = 'ready';
}

function label(id) {
  const section = sections.get(id);
  return labelMap[id] || String(section?.title || id || 'OPEN').toUpperCase();
}

function route(id) {
  return sections.get(id)?.route || routeFor(id) || '/';
}

function profileChip() {
  const p = currentProfile || {};
  const name = p.display_name || p.username || 'Profile Lock';
  const face = p.avatar_url ? `<img src="${p.avatar_url}" alt="">` : 'RB';
  return `<a class="profile-chip" href="/profile.html"><span>${face}</span><b>${name}</b><small>${p.rank_title || 'BIZ LEGEND'}</small></a>`;
}

function dockMarkup() {
  return `<nav class="dock"><a href="/">⌂<span>HOME</span></a>${dockKeys.map((id) => `<a href="${route(id)}">${icons[id] || '•'}<span>${label(id)}</span></a>`).join('')}</nav>`;
}

function rebuildDock(main) {
  const docks = $$('.dock');
  if (docks.length > 1) {
    const keep = docks.find((el) => el.querySelector('.active')) || docks[0];
    docks.forEach((el) => { if (el !== keep) el.remove(); });
  }
  if (!$('.dock')) main.insertAdjacentHTML('beforeend', dockMarkup());
  $$('.dock a').forEach((a) => a.classList.toggle('active', a.pathname === location.pathname));
}

function wireSignOut() {
  $$('[data-local-signout],[data-rb-signout]').forEach((btn) => {
    btn.textContent = 'IM OUT ✌🏽';
    btn.addEventListener('click', signOutAndGoHome);
  });
}

async function guard() {
  if (publicRoutes.has(key)) return { profile: null };
  const state = await requireTapIn({ next: `${location.pathname}${location.search}` });
  if (!state) return null;
  currentProfile = state.profile;
  return state;
}

async function count(table) {
  try {
    const res = await supabase.from(table).select('*', { count: 'exact', head: true });
    return res.count || 0;
  } catch (_) { return 0; }
}

async function rows(table) {
  try {
    return (await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(12)).data || [];
  } catch (_) {
    try { return (await supabase.from(table).select('*').limit(12)).data || []; } catch (_) { return []; }
  }
}

function card(row, title) {
  const name = row.title || row.name || row.display_name || row.username || row.station_name || row.seller_name || 'Rich Bizness Record';
  const note = row.description || row.bio || row.caption || row.body || row.status_label || row.created_at || 'Live record';
  const media = row.cover_url || row.thumbnail_url || row.avatar_url || row.image_url || row.media_url || '';
  return `<article class="card real-record">${media ? `<img src="${media}" alt="">` : ''}<b>${name}</b><p>${note}</p><small>${title}</small></article>`;
}

function ensureShell(mapped, title) {
  cleanBlockers();
  const main = $('main') || document.body;
  const topLabel = label(key);
  if (!$('.top')) {
    main.insertAdjacentHTML('afterbegin', `<header class="top"><a class="brand" href="/"><span class="crest">RB</span><span><b>RICH BIZNESS</b><small>${topLabel}</small></span></a><nav class="top-actions">${profileChip()}<button class="pill" type="button" data-local-signout>IM OUT ✌🏽</button></nav></header>`);
  } else {
    $$('.brand small').forEach((el) => { if (!el.dataset.locked) el.textContent = topLabel; });
    const actions = $('.top-actions');
    if (actions && !$('.profile-chip')) actions.insertAdjacentHTML('afterbegin', profileChip());
  }
  if (!$('.hero') && !dedicated.has(key)) {
    main.insertAdjacentHTML('beforeend', `<section class="hero"><div class="kicker">${topLabel}</div><h1>${title}</h1><p>${mapped.subtitle || 'Connected Rich Bizness route.'}</p><div class="hero-grid"><div class="metric"><b id="recordCount">0</b><small>LIVE RECORDS</small></div><div class="metric"><b id="primaryTable">${topLabel}</b><small>SECTION</small></div><div class="metric"><b id="tableCount">READY</b><small>STATUS</small></div></div></section>`);
  }
  if (!$('#sectionCards') && !dedicated.has(key)) {
    ($('.hero') || main).insertAdjacentHTML('afterend', `<section class="layout"><section class="panel"><h2>${title}</h2><div id="sectionCards" class="cards"><div class="empty">Checking live records...</div></div></section><aside class="panel" id="schemaPanel"><h2>Next Action</h2><div class="card"><b>${title}</b><p>${mapped.subtitle || 'Connected Rich Bizness route.'}</p><a class="pill" href="${mapped.route || '/'}">OPEN</a></div></aside></section>`);
  }
  rebuildDock(main);
  wireSignOut();
}

async function refresh() {
  if (key === 'index' || key === 'home') {
    cleanBlockers();
    window.RB_SECTION_RUNTIME = { disabledOnIndex: true };
    return;
  }
  const state = await guard();
  if (!state && !publicRoutes.has(key)) return;
  const mapped = sectionFor(key) || sections.get(key) || { key, title: key.toUpperCase(), subtitle: 'Connected Rich Bizness route.', route: routeFor(key), primaryTable: 'profiles', tables: ['profiles'] };
  const title = mapped.title || key.toUpperCase();
  const primary = mapped.primaryTable || 'profiles';
  ensureShell(mapped, title);
  const total = await count(primary);
  $$('#recordCount').forEach((el) => { el.textContent = fmt(total); });
  $$('#tableCount').forEach((el) => { el.textContent = total ? 'LIVE' : 'READY'; });
  if (!dedicated.has(key) && $('#sectionCards')) {
    const data = await rows(primary);
    $('#sectionCards').innerHTML = data.length ? data.map((item) => card(item, title)).join('') : `<div class="empty"><b>${title}</b><p>${mapped.subtitle || 'Connected route.'}</p><a class="pill" href="${mapped.route || '/'}">OPEN</a></div>`;
  }
  cleanBlockers();
  document.body.classList.add('rb-real-section');
  window.RB_SECTION_RUNTIME = { refresh, key, primary, tables: mapped.tables || [primary], cleanBlockers, guard };
}

refresh();
supabase.auth.onAuthStateChange(() => refresh());
