import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity } from './rb-identity.js?v=profile-avatar-separate-1';

const page = document.body?.dataset?.section || 'music';
const tableMap = {
  music: { item: 'music_tracks', comments: 'music_comments', likes: 'music_likes', events: 'music_play_events', key: 'track_id' },
  podcast: { item: 'podcast_episodes', comments: 'podcast_comments', likes: 'podcast_likes', events: 'podcast_likes', key: 'episode_id' },
  radio: { item: 'radio_stations', comments: '', likes: 'radio_likes', events: 'radio_sessions', key: 'station_id' }
};
const cfg = tableMap[page] || tableMap.music;
const $ = (s) => document.querySelector(s);
let user = null;
let itemId = null;

async function identity() {
  const state = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  user = state.user || null;
}

function findItemId() {
  const active = document.querySelector('[data-track].active,[data-episode].active,[data-station].active');
  itemId = active?.dataset?.id || active?.dataset?.trackId || active?.dataset?.episodeId || active?.dataset?.stationId || null;
  return itemId;
}

function mount() {
  if ($('#audioSocialPanel')) return;
  const host = document.querySelector('.rb-panel:last-child') || document.querySelector('.identity-shell');
  if (!host) return;
  host.insertAdjacentHTML('beforeend', `<section id="audioSocialPanel" style="margin-top:14px;border:1px solid rgba(157,255,99,.14);border-radius:20px;padding:12px;background:rgba(0,0,0,.26)"><h3>Social Audio</h3><p id="audioSocialStatus">Likes, comments, and sessions ready.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button id="audioLike" class="identity-pill primary">LIKE</button><button id="audioSession" class="identity-pill">SESSION</button></div><form id="audioCommentForm" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px"><input id="audioComment" placeholder="Comment..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" /><button class="identity-pill">POST</button></form></section>`);
}

async function like() {
  await identity();
  const id = findItemId();
  if (!user || !id || !cfg.likes) return;
  await supabase.from(cfg.likes).upsert({ [cfg.key]: id, user_id: user.id }, { onConflict: cfg.key + ',user_id' }).then(() => {}, () => {});
  $('#audioSocialStatus').textContent = 'Liked.';
}

async function comment(text) {
  await identity();
  const id = findItemId();
  if (!user || !id || !cfg.comments || !text) return;
  await supabase.from(cfg.comments).insert({ [cfg.key]: id, user_id: user.id, body: text }).then(() => {}, () => {});
  $('#audioSocialStatus').textContent = 'Comment saved.';
}

async function session() {
  await identity();
  const id = findItemId();
  if (!user || !id || !cfg.events) return;
  await supabase.from(cfg.events).insert({ [cfg.key]: id, user_id: user.id, event_type: 'session', metadata: { page } }).then(() => {}, () => {});
  $('#audioSocialStatus').textContent = 'Session saved.';
}

mount();
$('#audioLike')?.addEventListener('click', like);
$('#audioSession')?.addEventListener('click', session);
$('#audioCommentForm')?.addEventListener('submit', (e) => { e.preventDefault(); const input = $('#audioComment'); const text = input?.value?.trim(); if (input) input.value = ''; comment(text); });
