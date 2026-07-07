import { supabase } from './supabase-client.js';
import { RB_SECTIONS, sectionFor, routeFor } from './rb-schema-map.js';
import { ensureProfile, getAuthoritativeIdentity, profileRoute, signOutAndGoHome, requireTapIn } from './rb-identity.js?v=tap-in-foundation-1';
import './rb-personality.js?v=brand-wide-1';
import './identity-runtime-clean.js?v=identity-clean-1';
import './section-language-foundation.js?v=language-foundation-1';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n) => Number(n || 0).toLocaleString();
const cleanKey = (v = '') => String(v || '').replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '').replace(/_/g, '-');
const key = cleanKey(document.body?.dataset?.section || document.documentElement?.dataset?.section || location.pathname.split('/').pop() || 'home');
const map = new Map(RB_SECTIONS.map((s) => [s.key, s]));
const dockKeys = ['profile','avatar','avatar-characters','feed','live','watch','music','podcast','radio','gaming','games','gallery','sports','store','meta','upload','search','messages','notifications','edit','settings','creator','admin','rb-secret'];
const icons = { profile:'♙', avatar:'☻', 'avatar-characters':'☻', feed:'▤', live:'◉', watch:'▶', music:'♪', podcast:'🎙', radio:'◌', gaming:'🎮', games:'♟', gallery:'▣', sports:'◎', store:'🛒', meta:'◇', upload:'⬆', search:'⌕', messages:'✉', notifications:'🔔', edit:'✎', settings:'⚙', creator:'♕', admin:'◆', 'rb-secret':'▣' };
const publicRoutes = new Set(['auth']);
const onboardingRoutes = new Set(['avatar','edit','settings']);
const dedicated = new Set(['gaming','games','avatar-characters','meta','live','watch','avatar','profile','auth','admin','creator','rb-secret']);
let currentProfile = null;

function cleanBlockers() {
  document.querySelectorAll('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep]),.motion-rings:not([data-rb-keep])').forEach((el) => { el.style.pointerEvents = 'none'; el.setAttribute('aria-hidden', 'true'); });
  document.body.style.overflowY = 'auto';
  document.body.style.overflowX = 'hidden';
  document.documentElement.dataset.rbUniversalApp = 'ready';
  document.body.dataset.rbUniversalApp = 'ready';
}

if (key === 'index' || key === 'home') {
  cleanBlockers();
  document.querySelectorAll('.top:not(.topbar),.layout,#schemaPanel,#sectionCards').forEach((el) => el.remove());
  window.RB_SECTION_RUNTIME = { disabledOnIndex: true };
} else {
  const mapped = sectionFor(key) || map.get(key) || { key, title: key.toUpperCase(), subtitle: 'Connected Rich Bizness route.', route: routeFor(key), primaryTable: 'profiles', tables: ['profiles'] };
  const title = mapped.title || key.toUpperCase();
  const primary = mapped.primaryTable || 'profiles';
  const tables = mapped.tables || [primary];
  const setText = (sel, value) => $$(sel).forEach((el) => { el.textContent = value; });
  const label = (s) => !s ? 'OPEN' : s.key === 'live' ? 'WE LIT🔥' : s.key === 'rb-secret' ? 'VAULT' : s.key === 'notifications' ? 'ALERTS' : s.key === 'avatar-characters' ? 'AVATARS' : String(s.title || s.key).split(' ')[0].toUpperCase();
  const dock = () => `<nav class="dock"><a href="/">⌂<span>HOME</span></a>${dockKeys.map((id) => { const s = map.get(id); return s ? `<a href="${s.route}">${icons[id] || '•'}<span>${label(s)}</span></a>` : ''; }).join('')}</nav>`;
  const profileChip = () => { const p = currentProfile || {}; const name = (p.display_name || p.username || 'Profile').toString(); const img = p.avatar_url ? `<img src="${p.avatar_url}" alt="">` : 'RB'; return `<a class="profile-chip" href="/profile.html"><span>${img}</span><b>${name}</b><small>${p.rank_title || 'BIZ LEGEND'}</small></a>`; };
  function rebuildDock(main) { document.querySelectorAll('.dock').forEach((el) => el.remove()); main.insertAdjacentHTML('beforeend', dock()); document.querySelectorAll('.dock a').forEach((a) => { if (a.pathname === location.pathname) a.classList.add('active'); }); }
  function specialPanel() {
    if (key === 'games' || key === 'gaming') return `<section class="layout unit-panel"><section class="panel"><h2>Playable Game Rooms</h2><div class="cards"><article class="card"><b>Money Road Runner</b><p>Runner lane connected to score and XP records.</p><a class="pill" href="/gaming.html?game=money-road-runner">PLAY</a></article><article class="card"><b>Rich Chess</b><p>Strategy board room for game_moves and rooms.</p><a class="pill" href="/games/?game=rich-chess">PLAY</a></article><article class="card"><b>Studio Showdown</b><p>Creator battle room tied to game sessions.</p><a class="pill" href="/games/?game=studio-showdown">PLAY</a></article></div></section><aside class="panel"><h2>Game System</h2><div class="card"><b>Scores + Rooms</b><p>Games connect to sessions, moves, scores, rewards, clips, tournaments, and XP.</p></div></aside></section>`;
    if (key === 'avatar-characters' || key === 'avatar') return `<section class="layout unit-panel"><section class="panel"><h2>Avatar Characters</h2><div class="cards"><article class="card"><b>Boss Walk</b><p>Street avatar with smoke-cloud aura and RB chain.</p><a class="pill" href="/avatar.html?preset=boss-walk">BUILD</a></article><article class="card"><b>Creator Mode</b><p>Avatar for live, music, podcast, store, and creator pages.</p><a class="pill" href="/avatar.html?preset=creator">BUILD</a></article><article class="card"><b>Meta Runner</b><p>World/game avatar for rooms and private worlds.</p><a class="pill" href="/avatar.html?preset=meta-runner">BUILD</a></article></div></section><aside class="panel"><h2>One Avatar Lock</h2><div class="card"><b>Profile + Characters</b><p>Avatar and Avatar Characters use the same meta_avatars record, with presets and inventory for multiple looks.</p></div></aside></section>`;
    if (key === 'settings') return `<section class="layout unit-panel"><section class="panel"><h2>Background Control</h2><div class="cards"><button class="pill" type="button" data-bg="smoke">Smoke Cloud</button><button class="pill" type="button" data-bg="portal">Portal Glow</button><button class="pill" type="button" data-bg="cinema">Cinematic Dark</button></div></section><aside class="panel"><h2>Account Controls</h2><div class="card"><b>Profile Lock</b><p>Background preference saves locally now and stays ready for profile settings sync.</p></div></aside></section>`;
    if (key === 'edit') return `<section class="layout unit-panel"><section class="panel"><h2>Edit Everything</h2><div class="cards"><a class="pill" href="/profile.html">Profile</a><a class="pill" href="/avatar.html">Avatar</a><a class="pill" href="/upload.html">Uploads</a><a class="pill" href="/settings.html">Background</a></div></section><aside class="panel"><h2>Identity Sync</h2><div class="card"><b>Profile + Avatar + Sections</b><p>Edits feed the same profile identity used across every section.</p></div></aside></section>`;
    return '';
  }
  function wireBg() { document.querySelectorAll('[data-bg]').forEach((b) => b.addEventListener('click', () => { localStorage.setItem('rb_background', b.dataset.bg); document.body.dataset.rbBackground = b.dataset.bg; })); }
  function ensureShell() {
    cleanBlockers();
    document.body.classList.add('rb-connected-shell');
    document.body.dataset.rbBackground = localStorage.getItem('rb_background') || 'smoke';
    const main = $('main') || document.body;
    if (!$('.top')) main.insertAdjacentHTML('afterbegin', `<header class="top"><a class="brand" href="/"><span class="crest">RB</span><span><b>RICH BIZNESS</b><small>${key === 'live' ? 'WE LIT🔥' : title}</small></span></a><nav class="top-actions">${profileChip()}<button class="pill" type="button" data-local-signout>SIGN OUT</button></nav></header>`);
    else { document.querySelectorAll('.brand small').forEach((el) => { if (el.textContent && !el.dataset.locked) el.textContent = key === 'live' ? 'WE LIT🔥' : title; }); const actions = $('.top-actions'); if (actions && !$('.profile-chip')) actions.insertAdjacentHTML('afterbegin', profileChip()); }
    if (!$('.hero')) main.insertAdjacentHTML('beforeend', `<section class="hero"><div class="kicker">${key.toUpperCase()}</div><h1>${title}</h1><p>${mapped.subtitle || 'Connected Rich Bizness route.'}</p><div class="hero-grid"><div class="metric"><b id="recordCount">0</b><small>LIVE RECORDS</small></div><div class="metric"><b id="primaryTable">${title}</b><small>SECTION</small></div><div class="metric"><b id="tableCount">READY</b><small>STATUS</small></div></div></section>`);
    if (!$('.unit-panel') && !$('.layout')) { const sp = specialPanel(); if (sp) ($('.hero') || main).insertAdjacentHTML('afterend', sp); }
    if (!$('#sectionCards') && !dedicated.has(key)) ($('.hero') || main).insertAdjacentHTML('afterend', `<section class="layout"><section class="panel"><h2>${title}</h2><div id="sectionCards" class="cards"><div class="empty">Checking live records...</div></div></section><aside class="panel" id="schemaPanel"><h2>Next Action</h2><div class="card"><b>${title}</b><p>${mapped.subtitle || 'Connected Rich Bizness route.'}</p><a class="pill" href="${mapped.route || '/'}">OPEN</a></div></aside></section>`);
    rebuildDock(main); wireBg(); document.querySelectorAll('[data-local-signout]').forEach((b) => b.addEventListener('click', signOutAndGoHome));
  }
  async function guard() { if (publicRoutes.has(key)) return null; const { session, user } = await getAuthoritativeIdentity(); if (!session || !user) { location.replace(`/auth.html?next=${encodeURIComponent(location.pathname)}`); return null; } currentProfile = await ensureProfile(user); const route = profileRoute(currentProfile); if (!onboardingRoutes.has(key) && route === '/avatar.html') { location.replace('/avatar.html'); return null; } return { user, profile: currentProfile }; }
  async function count(table) { try { const res = await supabase.from(table).select('*', { count: 'exact', head: true }); return res.count || 0; } catch (_) { return 0; } }
  async function rows(table) { try { const res = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(12); return res.data || []; } catch (_) { try { return (await supabase.from(table).select('*').limit(12)).data || []; } catch (_) { return []; } } }
  function card(row) { const name = row.title || row.name || row.display_name || row.username || row.status || row.station_name || row.seller_name || row.subject || 'Rich Bizness Record'; const note = row.description || row.bio || row.caption || row.body || row.status_label || row.created_at || 'Live record'; const media = row.cover_url || row.thumbnail_url || row.avatar_url || row.image_url || row.media_url || ''; return `<article class="card real-record">${media ? `<img src="${media}" alt="">` : ''}<b>${name}</b><p>${note}</p><small>${title}</small></article>`; }
  async function refresh() { const state = await guard(); if (!state && !publicRoutes.has(key)) return; ensureShell(); const total = await count(primary); setText('#recordCount', fmt(total)); setText('#primaryTable', title); setText('#tableCount', total ? 'LIVE' : 'READY'); if (!dedicated.has(key) && $('#sectionCards')) { const data = await rows(primary); $('#sectionCards').innerHTML = data.length ? data.map(card).join('') : `<div class="empty"><b>${title}</b><p>${mapped.subtitle || 'Connected route.'}</p><a class="pill" href="${mapped.route || '/'}">OPEN</a></div>`; } cleanBlockers(); document.body.classList.add('rb-real-section'); document.body.classList.remove('rb-section-powered'); }
  refresh();
  supabase.auth.onAuthStateChange(() => refresh());
  window.RB_SECTION_RUNTIME = { refresh, key, primary, tables, cleanBlockers, guard };
}