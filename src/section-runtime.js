import { supabase } from './supabase-client.js';
import { sectionFor } from './rb-schema-map.js';
import './rb-xp-boot.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n) => Number(n || 0).toLocaleString();
const key = document.body?.dataset?.section || location.pathname.split('/').pop().replace('.html', '') || 'home';
const fallback = { auth: ['Tap In', 'profiles'], avatar: ['Avatar', 'meta_avatars'], edit: ['Edit Profile', 'profiles'], settings: ['Settings', 'user_settings'], search: ['Search', 'profiles'], watch: ['Watch', 'live_streams'], secret: ['Secret Door', 'profiles'] };
const mapped = sectionFor(key);
const title = mapped?.title || fallback[key]?.[0] || key.toUpperCase();
const primary = mapped?.primaryTable || fallback[key]?.[1] || 'profiles';
const tables = mapped?.tables || [primary];

const labels = {
  feed: ['Latest Drops', 'Community activity'],
  gallery: ['Gallery Wall', 'Visual drops'],
  music: ['Music Feed', 'Tracks and playlists'],
  podcast: ['Podcast Feed', 'Episodes and shows'],
  radio: ['Radio Booth', 'Stations and listeners'],
  gaming: ['Game Hub', 'Games, rooms, scores'],
  sports: ['Sports Feed', 'Picks and broadcasts'],
  store: ['Market Floor', 'Products and unlocks'],
  meta: ['World Gate', 'Portals and rooms'],
  messages: ['Inbox', 'Threads and calls'],
  notifications: ['Alert Center', 'Rich alerts'],
  upload: ['Drop Center', 'Uploads and routing'],
  creator: ['Creator Hub', 'Creator systems'],
  admin: ['Control Room', 'Ops systems'],
  settings: ['Settings Hub', 'Preferences'],
  edit: ['Edit Center', 'Profile controls'],
  search: ['Search Universe', 'Find everything']
};

function setText(sel, value) { $$(sel).forEach((el) => { el.textContent = value; }); }
function label() { return labels[key] || [title, 'Universe systems']; }
function ensure() {
  const main = $('main') || document.body;
  if (!$('.hero')) main.insertAdjacentHTML('afterbegin', `<section class="hero"><div class="kicker">${key.toUpperCase()}</div><h1>${title}</h1><p>${label()[1]}.</p><div class="hero-grid"><div class="metric"><b id="recordCount">SYNC</b><small>LIVE DATA</small></div><div class="metric"><b id="primaryTable">${title}</b><small>AREA</small></div><div class="metric"><b id="tableCount">${tables.length}</b><small>SYSTEMS</small></div></div></section>`);
  if (!$('#sectionCards')) ($('.hero') || main).insertAdjacentHTML('afterend', `<section class="layout"><section class="panel"><h2>${label()[0]}</h2><div id="sectionCards" class="cards"><div class="empty">Loading...</div></div></section><aside class="panel" id="schemaPanel"><h2>Universe Systems</h2></aside></section>`);
}
async function count(table) { try { const res = await supabase.from(table).select('*', { count: 'exact', head: true }); return res.count || 0; } catch (_) { return 0; } }
async function rows(table) { try { const res = await supabase.from(table).select('*').limit(10); return res.data || []; } catch (_) { return []; } }
function card(row) { const name = row.title || row.name || row.display_name || row.username || row.status || row.station_name || row.seller_name || 'Rich Bizness Record'; const note = row.description || row.bio || row.caption || row.body || row.created_at || 'Synced record'; return `<article class="card"><b>${name}</b><p>${note}</p><small>${title}</small></article>`; }
function systemCard(table, countValue) { const pretty = table.replace(/^live_/, '').replace(/^dm_/, '').replace(/^game_/, '').replace(/^meta_/, '').replace(/^store_/, '').replace(/^sports_/, '').replace(/^music_/, '').replace(/^podcast_/, '').replace(/_/g, ' ').toUpperCase(); return `<div class="card"><b>${pretty}</b><small>${fmt(countValue)} ACTIVE</small></div>`; }
async function refresh() {
  ensure();
  const total = await count(primary);
  setText('#recordCount', fmt(total));
  setText('#primaryTable', title);
  setText('#tableCount', tables.length);
  const data = await rows(primary);
  $('#sectionCards').innerHTML = data.length ? data.map(card).join('') : `<div class="empty">${title} is connected. No records yet.</div>`;
  const counts = await Promise.all(tables.slice(0, 8).map(async (t) => [t, await count(t)]));
  $('#schemaPanel').innerHTML = '<h2>Universe Systems</h2>' + counts.map(([t, c]) => systemCard(t, c)).join('');
  document.body.classList.add('rb-section-powered');
}
refresh();
window.RB_SECTION_RUNTIME = { refresh, key, primary, tables };
