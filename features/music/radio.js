import { supabase } from '../../src/supabase-client.js';
import { awardXp } from '../../src/rb-xp.js?v=xp-idempotent-1';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=identity-owner-2';

const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number(value || 0).toLocaleString();
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

let rows = [];
let current = null;
let user = null;
let profile = null;
let session = null;
let joinedAt = null;
let played = new Set();
let stationChannel = null;
let likeChannel = null;
let reloadTimer = null;
let loadingStations = false;
let loadingLikes = false;

const sourceOf = (row) => row.stream_url || row.audio_url || row.file_url || row.media_url || '';
const imageOf = (row) => row.cover_url || row.thumbnail_url || row.image_url || '';

async function loadIdentity() {
  const identity = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  user = identity.user || null;
  profile = identity.profile || null;
}

function mountSocial() {
  if ($('#radioSocialPanel')) return;
  const tools = document.querySelector('.rb-content-grid .rb-panel:last-child');
  if (!tools) return;
  tools.insertAdjacentHTML('beforeend', `
    <section id="radioSocialPanel" style="margin-top:14px">
      <div class="rb-panel-head"><h2>Station Social</h2><small id="radioSessionState">IDLE</small></div>
      <div class="rb-live-grid">
        <button id="radioLikeBtn" class="rb-live-card" type="button"><b>Like Station</b><small id="radioLikeState">Tap to like</small></button>
        <div class="rb-live-card"><b id="radioSessionTime">0s</b><small>Current listen session</small></div>
      </div>
    </section>`);
}

function card(row, index) {
  const cover = imageOf(row);
  const playable = Boolean(sourceOf(row));
  return `<article class="rb-station ${playable ? '' : 'locked'} ${current?.id === row.id ? 'active' : ''}" data-station="${index}"><div class="rb-thumb">${cover ? `<img src="${cover}" alt="">` : '📡'}</div><div><b>${esc(row.station_name || row.title || 'RB Radio Station')}</b><p>${esc(row.description || row.station_tag || 'Rich Bizness radio station.')}</p><small>${esc(row.genre || 'radio')} • ${row.is_live ? 'LIVE' : 'READY'} • ${fmt(row.listener_count)} listening • ${fmt(row.play_count)} plays • ${fmt(row.like_count)} likes</small></div><em>${playable ? 'TUNE' : 'LOCKED'}</em></article>`;
}

function paintList() {
  if ($('#recordCount')) $('#recordCount').textContent = fmt(rows.length);
  if ($('#sectionCards')) $('#sectionCards').innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty">No radio stations yet.</div>';
  document.querySelectorAll('[data-station]').forEach((node) => node.addEventListener('click', () => selectStation(Number(node.dataset.station))));
}

async function selectStation(index) {
  const next = rows[index] || null;
  if (current?.id !== next?.id) await finishSession(false);
  current = next;
  document.querySelectorAll('[data-station]').forEach((node) => node.classList.toggle('active', Number(node.dataset.station) === index));
  if ($('#nowTitle')) $('#nowTitle').textContent = current?.station_name || current?.title || 'RB Radio';
  if ($('#nowNote')) $('#nowNote').textContent = current ? [current.station_tag || current.description || 'Rich Bizness station', current.genre || 'radio', current.mood || 'live vibe'].filter(Boolean).join(' • ') : 'Pick a station.';
  if ($('#nowMeta')) $('#nowMeta').textContent = current?.is_live ? 'LIVE STATION' : 'STATION READY';
  if ($('#nowListeners')) $('#nowListeners').textContent = fmt(current?.listener_count);
  if ($('#nowPlays')) $('#nowPlays').textContent = fmt(current?.play_count);
  const cover = imageOf(current || {});
  if ($('#nowCover')) $('#nowCover').innerHTML = cover ? `<img src="${cover}" alt="">` : '📡';
  const source = sourceOf(current || {});
  const audio = $('#radioAudio');
  if (audio) {
    audio.removeAttribute('src');
    if (source) audio.src = source;
    audio.load?.();
  }
  startLikeRealtime();
  await loadLikeState();
}

function scheduleStations() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => loadStations(true), 180);
}

async function loadStations(force = false) {
  if (loadingStations && !force) return;
  loadingStations = true;
  const selectedId = current?.id || null;
  try {
    const { data, error } = await supabase.from('radio_stations').select('*').or('is_public.is.true,is_public.is.null').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(36);
    if (error) throw error;
    rows = data || [];
    if (selectedId) current = rows.find((row) => row.id === selectedId) || null;
    paintList();
    if (!current && rows.length) await selectStation(0);
  } catch (error) {
    if ($('#sectionCards')) $('#sectionCards').innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  } finally {
    loadingStations = false;
  }
}

async function loadLikeState() {
  if (!current?.id || loadingLikes) return;
  loadingLikes = true;
  try {
    const [countResult, mineResult] = await Promise.all([
      supabase.from('radio_likes').select('id', { count: 'exact', head: true }).eq('station_id', current.id),
      user ? supabase.from('radio_likes').select('id').eq('station_id', current.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    if ($('#radioLikeState')) $('#radioLikeState').textContent = mineResult.data ? `Liked • ${fmt(countResult.count)}` : `Tap to like • ${fmt(countResult.count)}`;
  } finally {
    loadingLikes = false;
  }
}

async function likeCurrent() {
  if (!user || !current?.id) return;
  const existing = await supabase.from('radio_likes').select('id').eq('station_id', current.id).eq('user_id', user.id).maybeSingle();
  if (!existing.data) await supabase.from('radio_likes').insert({ station_id: current.id, user_id: user.id });
  await loadLikeState();
}

async function beginSession() {
  if (!current?.id || session) return;
  joinedAt = new Date();
  const result = await supabase.from('radio_sessions').insert({
    station_id: current.id,
    user_id: user?.id || null,
    anonymous_id: user ? null : crypto.randomUUID(),
    joined_at: joinedAt.toISOString(),
    listen_seconds: 0,
    device_info: { mobile: innerWidth < 768, platform: navigator.platform || 'web' },
    metadata: { source: 'radio-page', display_name: profile?.display_name || null }
  }).select('*').maybeSingle();
  session = result.data || null;
  if ($('#radioSessionState')) $('#radioSessionState').textContent = 'LISTENING';
  if (!played.has(current.id)) {
    played.add(current.id);
    await awardXp('radio_listen', { section: 'radio', sourceTable: 'radio_stations', sourceId: current.id }).catch(() => {});
  }
}

async function finishSession(leaving = true) {
  if (!session?.id || !joinedAt) return;
  const leftAt = new Date();
  const seconds = Math.max(0, Math.round((leftAt - joinedAt) / 1000));
  await supabase.from('radio_sessions').update({ left_at: leftAt.toISOString(), listen_seconds: seconds }).eq('id', session.id).then(() => {}, () => {});
  if ($('#radioSessionTime')) $('#radioSessionTime').textContent = `${seconds}s`;
  if ($('#radioSessionState')) $('#radioSessionState').textContent = leaving ? 'ENDED' : 'PAUSED';
  session = null;
  joinedAt = null;
}

function startLikeRealtime() {
  if (likeChannel) { supabase.removeChannel(likeChannel); likeChannel = null; }
  if (!current?.id) return;
  likeChannel = supabase.channel(`radio-likes:${current.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_likes', filter: `station_id=eq.${current.id}` }, loadLikeState)
    .subscribe();
}

async function cleanup() {
  clearTimeout(reloadTimer);
  await finishSession(true);
  if (stationChannel) { await supabase.removeChannel(stationChannel).catch(() => {}); stationChannel = null; }
  if (likeChannel) { await supabase.removeChannel(likeChannel).catch(() => {}); likeChannel = null; }
}

async function boot() {
  mountSocial();
  await loadIdentity();
  await loadStations();
  stationChannel = supabase.channel('radio-stations-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_stations' }, scheduleStations)
    .subscribe();
  $('#radioLikeBtn')?.addEventListener('click', likeCurrent);
  $('#radioAudio')?.addEventListener('play', beginSession);
  $('#radioAudio')?.addEventListener('pause', () => finishSession(false));
  $('#radioAudio')?.addEventListener('ended', () => finishSession(true));
  window.addEventListener('pagehide', cleanup, { once: true });
}

boot().catch((error) => {
  if ($('#sectionCards')) $('#sectionCards').innerHTML = `<div class="empty">${esc(error.message || error)}</div>`;
});