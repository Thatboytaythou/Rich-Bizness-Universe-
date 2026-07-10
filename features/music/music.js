import { supabase } from '../../src/supabase-client.js';
import { awardXp } from '../../src/rb-xp.js?v=xp-idempotent-1';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number(value || 0).toLocaleString();
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

let rows = [];
let current = null;
let sourceTable = 'music_tracks';
let user = null;
let profile = null;
let playEvent = null;
let playStartedAt = null;
let sessionId = sessionStorage.getItem('rb_music_session') || crypto.randomUUID();
sessionStorage.setItem('rb_music_session', sessionId);

const sourceOf = (row) => row.audio_url || row.file_url || row.media_url || row.stream_url || '';
const imageOf = (row) => row.cover_url || row.thumbnail_url || row.image_url || '';

async function loadIdentity() {
  const identity = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  user = identity.user || null;
  profile = identity.profile || null;
}

function mountSocial() {
  if ($('#musicSocialPanel')) return;
  const tools = document.querySelector('.rb-content-grid .rb-panel:last-child');
  if (!tools) return;
  tools.insertAdjacentHTML('beforeend', `
    <section id="musicSocialPanel" style="margin-top:14px">
      <div class="rb-panel-head"><h2>Track Social</h2><small id="musicSocialStatus">SELECT TRACK</small></div>
      <div class="rb-vibe-grid">
        <button id="musicLikeBtn" class="rb-vibe" type="button"><b>Like Track</b><small id="musicLikeState">Tap to like</small></button>
        <button id="musicPlaylistBtn" class="rb-vibe" type="button"><b>Add Playlist</b><small>My Rich Playlist</small></button>
      </div>
      <form id="musicCommentForm" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px">
        <input id="musicCommentBody" placeholder="Comment on this track..." style="min-height:44px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <button class="identity-pill primary">DROP</button>
      </form>
      <div id="musicComments" style="display:grid;gap:8px;margin-top:10px;max-height:260px;overflow:auto"><div class="empty">No track selected.</div></div>
    </section>`);
}

function card(row, index) {
  const cover = imageOf(row);
  const playable = Boolean(sourceOf(row));
  return `<article class="rb-track ${playable ? '' : 'locked'} ${current?.id === row.id ? 'active' : ''}" data-track="${index}"><div class="rb-thumb">${cover ? `<img src="${cover}" alt="">` : '♪'}</div><div><b>${esc(row.title || 'Music Track')}</b><p>${esc(row.description || row.mood || 'Rich Bizness track.')}</p><small>${esc(row.display_name || row.username || 'artist')} • ${esc(row.genre || 'music')} • ${fmt(row.play_count)} plays • ${fmt(row.like_count)} likes</small></div><em>${playable ? 'PLAY' : 'LOCKED'}</em></article>`;
}

function paintList() {
  const list = $('#sectionCards');
  if ($('#recordCount')) $('#recordCount').textContent = fmt(rows.length);
  if ($('#sourceLabel')) $('#sourceLabel').textContent = sourceTable;
  if (list) list.innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty">No tracks yet.</div>';
  document.querySelectorAll('[data-track]').forEach((node) => node.addEventListener('click', () => selectTrack(Number(node.dataset.track))));
}

async function selectTrack(index) {
  current = rows[index] || null;
  document.querySelectorAll('[data-track]').forEach((node) => node.classList.toggle('active', Number(node.dataset.track) === index));
  if ($('#nowTitle')) $('#nowTitle').textContent = current?.title || 'Music District';
  if ($('#nowNote')) $('#nowNote').textContent = current ? [current.display_name || current.username || 'Rich Bizness Artist', current.genre || 'music', current.mood || 'rich vibe'].filter(Boolean).join(' • ') : 'Pick a track.';
  if ($('#nowMeta')) $('#nowMeta').textContent = current?.is_featured ? 'FEATURED TRACK' : 'NOW PLAYING';
  if ($('#nowPlays')) $('#nowPlays').textContent = fmt(current?.play_count);
  if ($('#nowLikes')) $('#nowLikes').textContent = fmt(current?.like_count);
  const cover = imageOf(current || {});
  if ($('#nowCover')) $('#nowCover').innerHTML = cover ? `<img src="${cover}" alt="">` : '♪';
  const audioSource = sourceOf(current || {});
  const audio = $('#musicAudio');
  if (audio && audioSource) {
    audio.src = audioSource;
    audio.load?.();
  }
  await loadSocial();
}

async function readTable(table) {
  return supabase.from(table).select('*').or('is_published.is.true,is_published.is.null').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(36);
}

async function loadTracks() {
  let result = await readTable('music_tracks');
  sourceTable = 'music_tracks';
  if (result.error || !(result.data || []).length) {
    result = await readTable('tracks');
    sourceTable = 'tracks';
  }
  rows = result.data || [];
  if (result.error && $('#sectionCards')) $('#sectionCards').innerHTML = `<div class="empty">${result.error.message}</div>`;
  paintList();
  if (!current && rows.length) await selectTrack(0);
}

async function loadSocial() {
  const box = $('#musicComments');
  if (!current?.id || sourceTable !== 'music_tracks') {
    if (box) box.innerHTML = '<div class="empty">Social actions require a music_tracks record.</div>';
    if ($('#musicSocialStatus')) $('#musicSocialStatus').textContent = 'TRACK FALLBACK';
    return;
  }
  const [commentsResult, likesResult, myLikeResult] = await Promise.all([
    supabase.from('music_comments').select('*').eq('track_id', current.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('music_likes').select('id', { count: 'exact', head: true }).eq('track_id', current.id),
    user ? supabase.from('music_likes').select('id').eq('track_id', current.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const comments = commentsResult.data || [];
  if (box) box.innerHTML = comments.length ? comments.map((comment) => `<article style="border:1px solid rgba(157,255,99,.12);border-radius:16px;padding:10px;background:rgba(0,0,0,.26)"><b>${esc(comment.display_name || comment.username || 'Listener')}</b><p>${esc(comment.comment || '')}</p><small>${new Date(comment.created_at).toLocaleString()}</small></article>`).join('') : '<div class="empty">No comments yet.</div>';
  if ($('#nowLikes')) $('#nowLikes').textContent = fmt(likesResult.count);
  if ($('#musicLikeState')) $('#musicLikeState').textContent = myLikeResult.data ? 'Liked' : 'Tap to like';
  if ($('#musicSocialStatus')) $('#musicSocialStatus').textContent = `${comments.length} COMMENTS`;
}

async function likeCurrent() {
  if (!user || !current?.id || sourceTable !== 'music_tracks') return;
  const existing = await supabase.from('music_likes').select('id').eq('track_id', current.id).eq('user_id', user.id).maybeSingle();
  if (!existing.data) await supabase.from('music_likes').insert({ track_id: current.id, user_id: user.id });
  await loadSocial();
}

async function commentCurrent(body) {
  const text = String(body || '').trim();
  if (!user || !current?.id || !text || sourceTable !== 'music_tracks') return;
  await supabase.from('music_comments').insert({ track_id: current.id, user_id: user.id, username: profile?.username, display_name: profile?.display_name, comment: text });
  await loadSocial();
}

async function addCurrentToPlaylist() {
  if (!user || !current?.id || sourceTable !== 'music_tracks') return;
  let playlist = await supabase.from('playlists').select('*').eq('user_id', user.id).eq('title', 'My Rich Playlist').maybeSingle();
  if (!playlist.data) {
    playlist = await supabase.from('playlists').insert({ user_id: user.id, username: profile?.username, display_name: profile?.display_name, title: 'My Rich Playlist', description: 'Saved from Music District', visibility: 'private', color_theme: 'green-gold', track_count: 0, like_count: 0, play_count: 0, is_featured: false, metadata: { source: 'music-page' } }).select('*').maybeSingle();
  }
  const playlistId = playlist.data?.id;
  if (!playlistId) return;
  const existing = await supabase.from('playlist_tracks').select('id').eq('playlist_id', playlistId).eq('track_id', current.id).maybeSingle();
  if (!existing.data) {
    const countResult = await supabase.from('playlist_tracks').select('id', { count: 'exact', head: true }).eq('playlist_id', playlistId);
    await supabase.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: current.id, position: Number(countResult.count || 0), added_at: new Date().toISOString() });
    await supabase.from('playlists').update({ track_count: Number(countResult.count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', playlistId);
  }
  if ($('#musicSocialStatus')) $('#musicSocialStatus').textContent = 'SAVED TO PLAYLIST';
}

async function beginPlayEvent() {
  if (!current?.id || sourceTable !== 'music_tracks') return;
  playStartedAt = Date.now();
  const result = await supabase.from('music_play_events').insert({ track_id: current.id, user_id: user?.id || null, session_id: sessionId, seconds_played: 0, completed: false, device_info: { mobile: innerWidth < 768, platform: navigator.platform || 'web' }, metadata: { source: 'music-page' } }).select('*').maybeSingle();
  playEvent = result.data || null;
  await supabase.from('music_tracks').update({ play_count: Number(current.play_count || 0) + 1 }).eq('id', current.id).then(() => {}, () => {});
  await awardXp('music_play', { section: 'music', sourceTable: 'music_tracks', sourceId: current.id }).catch(() => {});
}

async function finishPlayEvent(completed = false) {
  if (!playEvent?.id || !playStartedAt) return;
  const seconds = Math.max(0, Math.round((Date.now() - playStartedAt) / 1000));
  await supabase.from('music_play_events').update({ seconds_played: seconds, completed }).eq('id', playEvent.id).then(() => {}, () => {});
  playEvent = null;
  playStartedAt = null;
}

mountSocial();
loadIdentity().then(loadTracks);
$('#musicLikeBtn')?.addEventListener('click', likeCurrent);
$('#musicPlaylistBtn')?.addEventListener('click', addCurrentToPlaylist);
$('#musicCommentForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#musicCommentBody');
  const body = input?.value || '';
  if (input) input.value = '';
  commentCurrent(body);
});
$('#musicAudio')?.addEventListener('play', beginPlayEvent);
$('#musicAudio')?.addEventListener('pause', () => finishPlayEvent(false));
$('#musicAudio')?.addEventListener('ended', () => finishPlayEvent(true));
window.addEventListener('pagehide', () => finishPlayEvent(false));

supabase.channel('music-feature-owner')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, loadTracks)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'music_comments' }, loadSocial)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'music_likes' }, loadSocial)
  .subscribe();
