import { supabase } from './supabase-client.js';
import { sectionFor } from './rb-schema-map.js';
import './rb-xp-boot.js';
import './rb-personality.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n) => Number(n || 0).toLocaleString();
const key = document.body?.dataset?.section || location.pathname.split('/').pop().replace('.html', '') || 'home';
const fallback = { auth: ['Tap In', 'profiles'], avatar: ['Avatar', 'meta_avatars'], edit: ['Edit Profile', 'profiles'], settings: ['Settings', 'user_settings'], search: ['Search', 'profiles'], watch: ['Watch', 'live_streams'], secret: ['Secret Door', 'profiles'] };
const mapped = sectionFor(key);
const title = mapped?.title || fallback[key]?.[0] || key.toUpperCase();
const primary = mapped?.primaryTable || fallback[key]?.[1] || 'profiles';
const tables = mapped?.tables || [primary];

const copy = {
  feed: ['Latest Drops', 'Post something or follow creators to fill the feed.', '/upload.html', 'DROP CONTENT'],
  gallery: ['Gallery Drops', 'Visual drops appear here after uploads route into gallery-media.', '/upload.html', 'UPLOAD VISUAL'],
  music: ['Music Library', 'Tracks appear here after music uploads are saved.', '/upload.html', 'DROP MUSIC'],
  podcast: ['Podcast Episodes', 'Podcast episodes appear here after audio drops are saved.', '/upload.html', 'DROP EPISODE'],
  radio: ['Radio Stations', 'Stations appear here when radio_stations has active records.', '/upload.html', 'ADD STATION'],
  gaming: ['Game Catalog', 'Playable games are powered by the Gaming runtime below.', '/gaming.html', 'PLAY GAMES'],
  sports: ['Sports Arena', 'Sports posts, picks, and broadcasts appear from real records.', '/upload.html', 'DROP SPORTS'],
  store: ['Store Market', 'Products appear here after seller/product records are created.', '/upload.html', 'ADD PRODUCT'],
  meta: ['Meta Worlds', 'Worlds, rooms, and avatar movement appear from Meta records.', '/meta.html', 'ENTER META'],
  messages: ['Rich-DMs', 'Your threads and calls appear after conversations are created.', '/messages.html', 'OPEN DMS'],
  notifications: ['Rich Alerts', 'Notifications appear when real events are created.', '/notifications.html', 'CHECK ALERTS'],
  upload: ['Drop Router', 'Use the upload form to send content to the right section.', '/upload.html', 'START UPLOAD'],
  creator: ['Creator Hub', 'Creator balances, alerts, and page settings appear from real records.', '/creator.html', 'OPEN CREATOR'],
  admin: ['Control Room', 'Admin tools stay gated by roles and audit logs.', '/admin.html', 'OPEN ADMIN'],
  settings: ['Settings', 'Preferences load from your user settings records.', '/settings.html', 'OPEN SETTINGS'],
  edit: ['Edit Profile', 'Profile edits sync to profiles and avatar records.', '/edit.html', 'EDIT PROFILE'],
  search: ['Search', 'Search reads real records across the universe.', '/search.html', 'SEARCH']
};

function setText(sel, value) { $$(sel).forEach((el) => { el.textContent = value; }); }
function getCopy() { return copy[key] || [title, 'This section is connected to real Rich Bizness data.', mapped?.route || '/', 'OPEN']; }
function ensure() {
  const main = $('main') || document.body;
  if (!$('.hero')) main.insertAdjacentHTML('afterbegin', `<section class="hero"><div class="kicker">${key.toUpperCase()}</div><h1>${title}</h1><p>${getCopy()[1]}</p><div class="hero-grid"><div class="metric"><b id="recordCount">0</b><small>LIVE RECORDS</small></div><div class="metric"><b id="primaryTable">${title}</b><small>SECTION</small></div><div class="metric"><b id="tableCount">READY</b><small>STATUS</small></div></div></section>`);
  if (!$('#sectionCards')) ($('.hero') || main).insertAdjacentHTML('afterend', `<section class="layout"><section class="panel"><h2>${getCopy()[0]}</h2><div id="sectionCards" class="cards"><div class="empty">Checking live records...</div></div></section><aside class="panel" id="schemaPanel"><h2>Next Action</h2><div class="card"><b>${getCopy()[3]}</b><p>${getCopy()[1]}</p><a class="pill" href="${getCopy()[2]}">${getCopy()[3]}</a></div></aside></section>`);
}
async function count(table) { try { const res = await supabase.from(table).select('*', { count: 'exact', head: true }); return res.count || 0; } catch (_) { return 0; } }
async function rows(table) { try { const res = await supabase.from(table).select('*').limit(12); return res.data || []; } catch (_) { return []; } }
function card(row) { const name = row.title || row.name || row.display_name || row.username || row.status || row.station_name || row.seller_name || row.subject || 'Rich Bizness Record'; const note = row.description || row.bio || row.caption || row.body || row.status_label || row.created_at || 'Live record'; const media = row.cover_url || row.thumbnail_url || row.avatar_url || row.image_url || row.media_url || ''; return `<article class="card real-record">${media ? `<img src="${media}" alt="">` : ''}<b>${name}</b><p>${note}</p><small>${title}</small></article>`; }
function actionPanel(total) { const [heading, body, href, cta] = getCopy(); return `<h2>${total ? 'Live State' : 'Empty State'}</h2><div class="card"><b>${total ? `${fmt(total)} real records` : heading}</b><p>${total ? 'Showing real records from Supabase. No demo cards are being injected.' : body}</p><a class="pill" href="${href}">${cta}</a></div>`; }
async function refresh() {
  ensure();
  const total = await count(primary);
  setText('#recordCount', fmt(total));
  setText('#primaryTable', title);
  setText('#tableCount', total ? 'LIVE' : 'EMPTY');
  const data = await rows(primary);
  $('#sectionCards').innerHTML = data.length ? data.map(card).join('') : `<div class="empty"><b>${getCopy()[0]}</b><p>${getCopy()[1]}</p><a class="pill" href="${getCopy()[2]}">${getCopy()[3]}</a></div>`;
  const panel = $('#schemaPanel');
  if (panel) panel.innerHTML = actionPanel(total);
  document.body.classList.add('rb-real-section');
  document.body.classList.remove('rb-section-powered');
}
refresh();
window.RB_SECTION_RUNTIME = { refresh, key, primary, tables };
