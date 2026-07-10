import { supabase } from './supabase-client.js';
import { getSessionUser } from './rb-identity.js?v=identity-owner-2';

const $ = (s) => document.querySelector(s);
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
const cleanTerm = (v) => String(v || '').trim().replace(/[,%]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
const initials = (v = 'RB') => String(v || 'RB').split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'RB';
const fmt = (n) => Number(n || 0).toLocaleString();

let user = null;
let activeQuery = '';
let searchFlight = 0;
let inputTimer = null;

const lanes = [
  { table:'profiles', label:'PEOPLE', prefix:'/profile.html?id=', select:'id,username,display_name,avatar_url,bio,rank_title,rich_level,rich_points,created_at', cols:'username,display_name,bio', title:(r)=>r.display_name||r.username||'Rich Bizness User', sub:(r)=>`@${r.username||'rich_user'} • ${r.rank_title||'Member'} • LVL ${r.rich_level||1}`, image:(r)=>r.avatar_url },
  { table:'feed_posts', label:'POST', prefix:'/feed.html?id=', select:'id,title,body,username,display_name,media_url,thumbnail_url,cover_url,section,like_count,view_count,created_at', cols:'title,body,username,display_name,section', title:(r)=>r.title||r.body||'Feed Post', sub:(r)=>`${r.section||'feed'} • ${fmt(r.view_count)} views • @${r.username||'rich_user'}`, image:(r)=>r.thumbnail_url||r.cover_url||r.media_url },
  { table:'products', label:'STORE', prefix:'/store.html?id=', select:'id,title,description,category,product_type,image_url,cover_url,media_url,location_label,city,state,price_cents,created_at', cols:'title,description,category,product_type,location_label,city,state', title:(r)=>r.title||'Store Product', sub:(r)=>`${r.category||r.product_type||'product'} • $${(Number(r.price_cents||0)/100).toFixed(2)}`, image:(r)=>r.image_url||r.cover_url||r.media_url },
  { table:'music_tracks', label:'MUSIC', prefix:'/music.html?id=', select:'id,title,description,username,display_name,genre,cover_url,audio_url,file_url,play_count,is_featured,created_at', cols:'title,description,username,display_name,genre', title:(r)=>r.title||'Music Track', sub:(r)=>`${r.genre||'track'} • ${fmt(r.play_count)} plays • @${r.username||r.display_name||'artist'}`, image:(r)=>r.cover_url },
  { table:'podcast_episodes', label:'PODCAST', prefix:'/podcast.html?id=', select:'id,title,description,username,display_name,cover_url,episode_number,play_count,created_at', cols:'title,description,username,display_name', title:(r)=>r.title||'Podcast Episode', sub:(r)=>`episode ${r.episode_number||'new'} • ${fmt(r.play_count)} plays`, image:(r)=>r.cover_url },
  { table:'games', label:'GAMES', prefix:'/games/?game=', select:'id,slug,title,description,game_type,cover_url,thumbnail_url,logo_url,developer_name,total_plays,active_players,created_at', cols:'title,description,game_type,developer_name,slug', title:(r)=>r.title||'Rich Game', sub:(r)=>`${r.game_type||'game'} • ${fmt(r.total_plays)} plays • ${fmt(r.active_players)} active`, image:(r)=>r.cover_url||r.thumbnail_url||r.logo_url },
  { table:'sports_posts', label:'SPORTS', prefix:'/sports.html?id=', select:'id,title,body,sport,league,team_name,username,display_name,media_url,cover_url,thumbnail_url,view_count,created_at', cols:'title,body,sport,league,team_name,username,display_name', title:(r)=>r.title||r.team_name||'Sports Post', sub:(r)=>`${r.sport||'sports'} • ${r.league||'arena'} • ${fmt(r.view_count)} views`, image:(r)=>r.thumbnail_url||r.cover_url||r.media_url },
  { table:'meta_worlds', label:'META', prefix:'/meta.html?world=', select:'id,slug,title,description,world_type,theme,cover_url,background_url,entry_route,visit_count,created_at', cols:'title,description,world_type,theme,slug', title:(r)=>r.title||'Meta World', sub:(r)=>`${r.world_type||'world'} • ${r.theme||'smoke-cloud'} • ${fmt(r.visit_count)} visits`, image:(r)=>r.cover_url||r.background_url },
  { table:'live_streams', label:'LIVE', prefix:'/watch.html?room=', select:'id,slug,title,description,category,status,status_label,display_room_name,livekit_room_name,thumbnail_url,cover_url,viewer_count,total_chat_messages,created_at', cols:'title,description,category,status_label,display_room_name,slug', title:(r)=>r.title||r.display_room_name||'WE LIT', sub:(r)=>`${r.status||'live'} • ${fmt(r.viewer_count)} watching • ${fmt(r.total_chat_messages)} chats`, image:(r)=>r.thumbnail_url||r.cover_url }
];

function image(row, lane) {
  return lane.image?.(row) || row.avatar_url || row.thumbnail_url || row.cover_url || row.image_url || row.media_url || row.background_url || row.logo_url || '';
}

function urlFor(lane, row) {
  if (row.entry_route) return row.entry_route;
  if (row.play_url) return row.play_url;
  return lane.prefix + encodeURIComponent(row.slug || row.livekit_room_name || row.id);
}

function card(item) {
  const media = item.image
    ? `<img src="${esc(item.image)}" alt="" loading="lazy" decoding="async">`
    : `<span class="rb-result-avatar">${esc(initials(item.title))}</span>`;
  return `<a class="rb-result-card" href="${esc(item.url)}" data-result-type="${esc(item.label)}" data-result-title="${esc(item.title)}">${media}<span><b>${esc(item.title)}</b><small>${esc(item.sub)}</small></span><em>${esc(item.label)}</em></a>`;
}

function setCount(n) {
  const count = $('#recordCount');
  if (count) count.textContent = fmt(n);
}

function historyMarkup(rows) {
  if (!rows.length) return '<span>Rich Bizness content cards</span>';
  return `<span>Recent:</span>${rows.map((row) => `<button type="button" class="identity-pill" data-search-history="${esc(row.query)}">${esc(row.query)}</button>`).join('')}<button type="button" class="identity-pill" data-clear-history>CLEAR</button>`;
}

async function loadHistory() {
  const box = $('#rbWebLinks');
  if (!box) return;
  if (!user) {
    box.innerHTML = '<span>Rich Bizness content cards</span>';
    return;
  }
  const { data } = await supabase.from('search_queries').select('query,created_at').eq('user_id', user.id).order('created_at', { ascending:false }).limit(8);
  const unique = [];
  const seen = new Set();
  for (const row of data || []) {
    const key = row.query.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }
  box.innerHTML = historyMarkup(unique.slice(0, 5));
}

async function saveQuery(query, resultCount) {
  if (!user || !query) return;
  await supabase.from('search_queries').insert({ user_id:user.id, query, result_count:resultCount }).then(() => {}, () => {});
  loadHistory();
}

async function saveClick(anchor) {
  if (!user) return;
  await supabase.from('search_clicks').insert({
    user_id:user.id,
    query:activeQuery || null,
    result_type:anchor.dataset.resultType || 'UNKNOWN',
    target_url:anchor.getAttribute('href') || '/',
    target_title:anchor.dataset.resultTitle || ''
  }).then(() => {}, () => {});
}

async function laneSearch(lane, term) {
  try {
    const or = lane.cols.split(',').map((column) => `${column}.ilike.${term}`).join(',');
    const { data, error } = await supabase.from(lane.table).select(lane.select).or(or).limit(lane.label === 'PEOPLE' ? 18 : 8);
    if (error) return [];
    return (data || []).map((row) => ({ label:lane.label, title:lane.title(row), sub:lane.sub(row), image:image(row, lane), url:urlFor(lane, row) }));
  } catch {
    return [];
  }
}

async function laneLatest(lane) {
  try {
    let query = supabase.from(lane.table).select(lane.select);
    if (lane.table === 'music_tracks' || lane.table === 'podcast_episodes') query = query.or('is_published.is.true,is_published.is.null');
    if (lane.table === 'products') query = query.or('is_public.is.true,is_public.is.null');
    if (lane.table === 'games') query = query.or('is_active.is.true,is_active.is.null');
    query = query.order('created_at', { ascending:false }).limit(lane.label === 'PEOPLE' ? 8 : 5);
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map((row) => ({ label:lane.label, title:lane.title(row), sub:lane.sub(row), image:image(row, lane), url:urlFor(lane, row) }));
  } catch {
    return [];
  }
}

async function runSearch() {
  const query = cleanTerm($('#rbSearchInput')?.value);
  if (!query) return loadDefault();
  const runId = ++searchFlight;
  activeQuery = query;
  const out = $('#rbResults');
  if (!out) return;
  out.innerHTML = '<div class="rb-search-empty">Searching Rich Bizness lanes...</div>';
  const rows = (await Promise.all(lanes.map((lane) => laneSearch(lane, `%${query}%`)))).flat();
  if (runId !== searchFlight) return;
  out.innerHTML = rows.length ? rows.map(card).join('') : '<div class="rb-search-empty">No Rich Bizness results yet.</div>';
  setCount(rows.length);
  saveQuery(query, rows.length);
}

async function loadDefault() {
  const runId = ++searchFlight;
  activeQuery = '';
  const out = $('#rbResults');
  if (!out) return;
  out.innerHTML = '<div class="rb-search-empty">Loading Rich Bizness content...</div>';
  const rows = (await Promise.all(lanes.map(laneLatest))).flat();
  if (runId !== searchFlight) return;
  out.innerHTML = rows.length ? rows.map(card).join('') : '<div class="rb-search-empty">No Rich Bizness content yet.</div>';
  setCount(rows.length);
}

async function clearHistory() {
  if (!user) return;
  await supabase.from('search_queries').delete().eq('user_id', user.id);
  loadHistory();
}

async function boot() {
  if (window.RB_SEARCH_UNIVERSE_BOOTED) return;
  window.RB_SEARCH_UNIVERSE_BOOTED = true;
  user = await getSessionUser().catch(() => null);
  await loadHistory();
  $('#rbSearchButton')?.addEventListener('click', runSearch);
  $('#rbSearchInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });
  $('#rbSearchInput')?.addEventListener('input', (event) => {
    clearTimeout(inputTimer);
    const query = cleanTerm(event.target.value);
    inputTimer = setTimeout(() => query ? runSearch() : loadDefault(), query ? 350 : 0);
  });
  document.addEventListener('click', (event) => {
    const history = event.target.closest('[data-search-history]');
    if (history) {
      const input = $('#rbSearchInput');
      if (input) input.value = history.dataset.searchHistory;
      runSearch();
      return;
    }
    if (event.target.closest('[data-clear-history]')) {
      clearHistory();
      return;
    }
    const result = event.target.closest('.rb-result-card');
    if (result) saveClick(result);
  });
  loadDefault();
}

boot();
