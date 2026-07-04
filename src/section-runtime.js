import { supabase } from './supabase-client.js';
import { sectionFor } from './rb-schema-map.js';
import { ensureProfile, getSessionUser, profileRoute, signOutAndGoHome } from './rb-identity.js?v=connected-identity-2';
import './rb-xp-boot.js?v=universe-shell-1';
import './rb-personality.js?v=universe-shell-1';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n) => Number(n || 0).toLocaleString();
const key = document.body?.dataset?.section || document.documentElement?.dataset?.section || location.pathname.split('/').pop().replace('.html', '') || 'home';
const publicRoutes = new Set(['auth']);
const onboardingRoutes = new Set(['avatar', 'edit']);
const fallback = { auth: ['Rich Access', 'profiles'], avatar: ['Rich Avatar', 'meta_avatars'], edit: ['Edit Profile', 'profiles'], settings: ['Settings', 'user_settings'], search: ['Search', 'profiles'], watch: ['Watch', 'live_streams'], secret: ['Secret Door', 'profiles'] };
const mapped = sectionFor(key);
const title = mapped?.title || fallback[key]?.[0] || key.toUpperCase();
const primary = mapped?.primaryTable || fallback[key]?.[1] || 'profiles';
const tables = mapped?.tables || [primary];

const copy = {
  feed: ['Latest Drops', 'Real creator posts, likes, comments, follows, and media drops.', '/upload.html', 'DROP CONTENT'],
  gallery: ['Gallery District', 'Visual drops appear from real gallery uploads.', '/upload.html', 'UPLOAD VISUAL'],
  music: ['Music District', 'Tracks, playlists, plays, likes, and creator audio.', '/upload.html', 'DROP MUSIC'],
  podcast: ['Podcast Arena', 'Shows, episodes, covers, audio, likes, and comments.', '/upload.html', 'DROP EPISODE'],
  radio: ['RB Radio', 'Stations, sessions, and listener records.', '/radio.html', 'OPEN RADIO'],
  gaming: ['Elite Game Hub', 'Games are handled by the dedicated Rich Bizness game engines.', '/gaming.html', 'PLAY GAMES'],
  sports: ['Sports Arena', 'Posts, picks, brackets, uploads, and broadcasts.', '/upload.html', 'DROP SPORTS'],
  store: ['Store Market', 'Products, seller profiles, carts, orders, and unlocks.', '/upload.html', 'ADD PRODUCT'],
  meta: ['Meta World', 'Worlds, rooms, portals, avatars, chat, and stream links.', '/meta.html', 'ENTER META'],
  messages: ['Rich-DMs', 'Threads, calls, reactions, reads, and typing.', '/messages.html', 'OPEN DMS'],
  notifications: ['Rich Alerts', 'Notifications, reads, devices, and alert subscriptions.', '/notifications.html', 'CHECK ALERTS'],
  upload: ['Upload Zone', 'Route every file to the right Rich Bizness section.', '/upload.html', 'START UPLOAD'],
  creator: ['Creator Hub', 'Balances, alerts, page settings, store, music, live, and meta.', '/creator.html', 'OPEN CREATOR'],
  admin: ['Control Room', 'Roles, audit logs, review queue, flags, jobs, and health checks.', '/admin.html', 'OPEN ADMIN'],
  settings: ['Settings Hub', 'Preferences, theme, privacy, and app controls.', '/settings.html', 'OPEN SETTINGS'],
  edit: ['Edit Profile', 'Identity, avatar, banner, socials, rank, and presence.', '/edit.html', 'EDIT PROFILE'],
  search: ['Search', 'Search real records across Rich Bizness.', '/search.html', 'SEARCH'],
  secret: ['Secret Door', 'Private Rich Bizness access route.', '/', 'GO HOME']
};

const dedicated = new Set(['gaming','meta','live','watch','avatar','profile','auth']);
function setText(sel, value) { $$(sel).forEach((el) => { el.textContent = value; }); }
function getCopy() { return copy[key] || [title, 'This section is connected to real Rich Bizness data.', mapped?.route || '/', 'OPEN']; }
function cleanBlockers() {
  document.querySelectorAll('#globalXpBadge,.rb-personal-strip,#miniProfile,#composerPanel,.hero-art,.rb-phone,.rb-pad-index,#rbRunner').forEach((el) => el.remove());
  document.querySelectorAll('[style*="display: none"],[style*="visibility: hidden"],[style*="opacity: 0"]').forEach((el) => { if (!el.matches('script,style,template,[hidden]')) el.removeAttribute('style'); });
  document.body.style.overflowY = 'auto';
  document.body.style.overflowX = 'hidden';
}
function dock() {
  return `<nav class="dock"><a href="/">⌂<span>HOME</span></a><a href="/feed.html">▤<span>FEED</span></a><a href="/live.html">◉<span>LIVE</span></a><a href="/music.html">♪<span>MUSIC</span></a><a href="/radio.html">◌<span>RADIO</span></a><a href="/gaming.html">🎮<span>GAMING</span></a><a href="/sports.html">◎<span>SPORTS</span></a><a href="/store.html">🛒<span>STORE</span></a><a href="/meta.html">◇<span>META</span></a><a href="/profile.html">♙<span>ME</span></a></nav>`;
}
function ensureShell() {
  cleanBlockers();
  document.body.classList.add('rb-connected-shell');
  const main = $('main') || document.body;
  if (!$('.top')) main.insertAdjacentHTML('afterbegin', `<header class="top"><a class="brand" href="/"><span class="crest">RB</span><span><b>RICH BIZNESS</b><small>${key.toUpperCase()}</small></span></a><nav class="top-actions"><a class="pill" href="/profile.html">PROFILE</a><button class="pill" type="button" data-local-signout>SIGN OUT</button></nav></header>`);
  if (!$('.hero')) main.insertAdjacentHTML('beforeend', `<section class="hero"><div class="kicker">${key.toUpperCase()}</div><h1>${title}</h1><p>${getCopy()[1]}</p><div class="hero-grid"><div class="metric"><b id="recordCount">0</b><small>LIVE RECORDS</small></div><div class="metric"><b id="primaryTable">${title}</b><small>SECTION</small></div><div class="metric"><b id="tableCount">READY</b><small>STATUS</small></div></div></section>`);
  if (!$('#sectionCards') && !dedicated.has(key)) ($('.hero') || main).insertAdjacentHTML('afterend', `<section class="layout"><section class="panel"><h2>${getCopy()[0]}</h2><div id="sectionCards" class="cards"><div class="empty">Checking live records...</div></div></section><aside class="panel" id="schemaPanel"><h2>Next Action</h2><div class="card"><b>${getCopy()[3]}</b><p>${getCopy()[1]}</p><a class="pill" href="${getCopy()[2]}">${getCopy()[3]}</a></div></aside></section>`);
  if (!$('.dock')) main.insertAdjacentHTML('beforeend', dock());
  document.querySelectorAll('.dock a').forEach((a) => { if (a.getAttribute('href') === location.pathname) a.classList.add('active'); });
  document.querySelectorAll('[data-local-signout]').forEach((b) => b.addEventListener('click', signOutAndGoHome));
}
async function guard() {
  if (publicRoutes.has(key)) return null;
  const user = await getSessionUser();
  if (!user) {
    location.replace(`/auth.html?next=${encodeURIComponent(location.pathname)}`);
    return null;
  }
  const profile = await ensureProfile(user);
  const route = profileRoute(profile);
  if (!onboardingRoutes.has(key) && route === '/avatar.html') {
    location.replace('/avatar.html');
    return null;
  }
  return { user, profile };
}
async function count(table) { try { const res = await supabase.from(table).select('*', { count: 'exact', head: true }); return res.count || 0; } catch (_) { return 0; } }
async function rows(table) { try { const res = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(12); return res.data || []; } catch (_) { try { const res = await supabase.from(table).select('*').limit(12); return res.data || []; } catch (_) { return []; } } }
function card(row) { const name = row.title || row.name || row.display_name || row.username || row.status || row.station_name || row.seller_name || row.subject || 'Rich Bizness Record'; const note = row.description || row.bio || row.caption || row.body || row.status_label || row.created_at || 'Live record'; const media = row.cover_url || row.thumbnail_url || row.avatar_url || row.image_url || row.media_url || ''; return `<article class="card real-record">${media ? `<img src="${media}" alt="">` : ''}<b>${name}</b><p>${note}</p><small>${title}</small></article>`; }
function actionPanel(total) { const [heading, body, href, cta] = getCopy(); return `<h2>${total ? 'Live State' : 'Next Action'}</h2><div class="card"><b>${total ? `${fmt(total)} live records` : heading}</b><p>${body}</p><a class="pill" href="${href}">${cta}</a></div>`; }
async function refresh() {
  const state = await guard();
  if (!state && !publicRoutes.has(key)) return;
  ensureShell();
  const total = await count(primary);
  setText('#recordCount', fmt(total));
  setText('#primaryTable', title);
  setText('#tableCount', total ? 'LIVE' : 'READY');
  document.querySelectorAll('.brand small').forEach((el) => { if (el.textContent === 'LIVE') el.textContent = 'WE LIT🔥'; });
  if (!dedicated.has(key) && $('#sectionCards')) {
    const data = await rows(primary);
    $('#sectionCards').innerHTML = data.length ? data.map(card).join('') : `<div class="empty"><b>${getCopy()[0]}</b><p>${getCopy()[1]}</p><a class="pill" href="${getCopy()[2]}">${getCopy()[3]}</a></div>`;
  }
  const panel = $('#schemaPanel');
  if (panel) panel.innerHTML = actionPanel(total);
  cleanBlockers();
  document.body.classList.add('rb-real-section');
  document.body.classList.remove('rb-section-powered');
}
refresh();
supabase.auth.onAuthStateChange(() => refresh());
window.RB_SECTION_RUNTIME = { refresh, key, primary, tables, cleanBlockers, guard };
