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

function setText(sel, value) { $$(sel).forEach((el) => { el.textContent = value; }); }
function ensure() {
  const main = $('main') || document.body;
  if (!$('.hero')) main.insertAdjacentHTML('afterbegin', `<section class="hero"><div class="kicker">${key.toUpperCase()}</div><h1>${title}</h1><p>Connected to Supabase.</p><div class="hero-grid"><div class="metric"><b id="recordCount">SYNC</b><small>RECORDS</small></div><div class="metric"><b id="primaryTable">${primary}</b><small>PRIMARY</small></div><div class="metric"><b id="tableCount">${tables.length}</b><small>TABLES</small></div></div></section>`);
  if (!$('#sectionCards')) ($('.hero') || main).insertAdjacentHTML('afterend', `<section class="layout"><section class="panel"><h2>${title}</h2><div id="sectionCards" class="cards"><div class="empty">Loading...</div></div></section><aside class="panel" id="schemaPanel"><h2>Schema Sync</h2></aside></section>`);
}
async function count(table) { try { const res = await supabase.from(table).select('*', { count: 'exact', head: true }); return res.count || 0; } catch (_) { return 0; } }
async function rows(table) { try { const res = await supabase.from(table).select('*').limit(10); return res.data || []; } catch (_) { return []; } }
function card(row) { const name = row.title || row.name || row.display_name || row.username || row.status || 'Rich Bizness Record'; const note = row.description || row.bio || row.caption || row.created_at || 'Synced record'; return `<article class="card"><b>${name}</b><p>${note}</p><small>${primary}</small></article>`; }
async function refresh() {
  ensure();
  const total = await count(primary);
  setText('#recordCount', fmt(total));
  setText('#primaryTable', primary);
  setText('#tableCount', tables.length);
  const data = await rows(primary);
  $('#sectionCards').innerHTML = data.length ? data.map(card).join('') : `<div class="empty">${title} is connected. No records yet.</div>`;
  const counts = await Promise.all(tables.map(async (t) => [t, await count(t)]));
  $('#schemaPanel').innerHTML = '<h2>Schema Sync</h2>' + counts.map(([t, c]) => `<div class="card"><b>${t}</b><small>${fmt(c)} RECORDS</small></div>`).join('');
  document.body.classList.add('rb-section-powered');
}
refresh();
window.RB_SECTION_RUNTIME = { refresh, key, primary, tables };
