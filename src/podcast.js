import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=xp-idempotent-1';
import { getAuthoritativeIdentity } from './rb-identity.js?v=identity-owner-2';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

let episodes = [];
let current = null;
let user = null;
let profile = null;
let awarded = new Set();
let channel = null;
let refreshTimer = null;
let loadingEpisodes = false;
let loadingSocial = false;

function titleOf(row) { return row.title || 'Rich Bizness Episode'; }
function subOf(row) { return [row.display_name || row.username || 'Rich Bizness', row.episode_number ? `Episode ${row.episode_number}` : 'Podcast'].filter(Boolean).join(' • '); }
function audioOf(row) { return row.audio_url || row.file_url || row.media_url || row.recording_url || row.stream_url || ''; }
function coverOf(row) { return row.cover_url || row.thumbnail_url || row.image_url || ''; }

async function loadIdentity() {
  const state = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  user = state.user || null;
  profile = state.profile || null;
}

function mountSocial() {
  if ($('#podcastSocialPanel')) return;
  const side = document.querySelector('.stream-side-card');
  if (!side) return;
  side.insertAdjacentHTML('beforeend', `
    <section id="podcastSocialPanel" class="stream-panel compact-room-list" style="margin-top:12px">
      <div class="stream-panel-head"><b>Episode Social</b><small id="podcastShowState">NO SHOW</small></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button id="podcastLikeBtn" class="identity-pill" type="button">LIKE</button>
        <a id="podcastShowLink" class="identity-pill primary" href="#">SHOW</a>
      </div>
      <form id="podcastCommentForm" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px">
        <input id="podcastCommentBody" placeholder="Comment on episode..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <button class="identity-pill primary">DROP</button>
      </form>
      <div id="podcastComments" class="stream-grid" style="margin-top:8px"><div class="stream-card"><b>Select an episode.</b></div></div>
    </section>`);
}

function card(row, index) {
  const cover = coverOf(row);
  return `<article class="card podcast-episode ${current?.id === row.id ? 'active' : ''}" data-episode="${index}">${cover ? `<img src="${esc(cover)}" alt="">` : ''}<b>${esc(titleOf(row))}</b><p>${esc(row.description || row.caption || 'Podcast episode ready.')}</p><small>${esc(subOf(row))} • ${fmt(row.play_count)} plays • ${fmt(row.like_count)} likes</small></article>`;
}

function paint() {
  const list = $('#sectionCards');
  if (list) list.innerHTML = episodes.length ? episodes.map(card).join('') : '<div class="empty">No podcast episodes yet. Drop one from Upload.</div>';
  const count = $('#recordCount');
  if (count) count.textContent = fmt(episodes.length) + ' EPISODES';
  document.querySelectorAll('[data-episode]').forEach((el) => el.addEventListener('click', () => selectEpisode(Number(el.dataset.episode))));
}

async function selectEpisode(index) {
  current = episodes[index] || null;
  document.querySelectorAll('[data-episode]').forEach((el) => el.classList.toggle('active', Number(el.dataset.episode) === index));
  const audio = $('#podcastAudio');
  const title = $('.podcast-player h2');
  const note = $('.podcast-player p');
  const cover = $('.podcast-cover');
  if (title) title.textContent = current ? titleOf(current) : 'Rich Bizness Podcast';
  if (note) note.textContent = current ? subOf(current) : 'Pick an episode from live records or drop a new one through Upload.';
  if (cover) {
    const url = current ? coverOf(current) : '';
    cover.innerHTML = url ? `<img src="${esc(url)}" alt="">` : 'RB';
  }
  if (audio) {
    const src = current ? audioOf(current) : '';
    if (src) {
      audio.src = src;
      audio.load?.();
    }
  }
  await loadSocial();
  await startRealtime();
}

async function loadEpisodes() {
  if (loadingEpisodes) return;
  loadingEpisodes = true;
  try {
    const { data, error } = await supabase.from('podcast_episodes').select('*').or('is_published.is.true,is_published.is.null').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(36);
    if (error) throw error;
    const selectedId = current?.id || null;
    episodes = data || [];
    current = selectedId ? episodes.find((episode) => episode.id === selectedId) || null : null;
    paint();
    if (!current && episodes.length) await selectEpisode(0);
  } catch (error) {
    const list = $('#sectionCards');
    if (list) list.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  } finally {
    loadingEpisodes = false;
  }
}

async function loadSocial() {
  if (!current?.id || loadingSocial) return;
  loadingSocial = true;
  try {
    const [commentsResult, likesResult, myLikeResult, showResult] = await Promise.all([
      supabase.from('podcast_comments').select('*').eq('episode_id', current.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('podcast_likes').select('id', { count: 'exact', head: true }).eq('episode_id', current.id),
      user ? supabase.from('podcast_likes').select('id').eq('episode_id', current.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      current.show_id ? supabase.from('podcast_shows').select('*').eq('id', current.show_id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    const comments = commentsResult.data || [];
    if ($('#podcastComments')) $('#podcastComments').innerHTML = comments.length ? comments.map((comment) => `<div class="stream-card"><b>${esc(comment.display_name || comment.username || 'Listener')}</b><small>${esc(comment.body || '')}</small></div>`).join('') : '<div class="stream-card"><b>No comments yet.</b></div>';
    if ($('#podcastLikeBtn')) $('#podcastLikeBtn').textContent = myLikeResult.data ? `LIKED • ${fmt(likesResult.count)}` : `LIKE • ${fmt(likesResult.count)}`;
    const show = showResult.data || null;
    if ($('#podcastShowState')) $('#podcastShowState').textContent = show?.title || 'NO SHOW';
    if ($('#podcastShowLink')) {
      $('#podcastShowLink').textContent = show ? `${show.episode_count || 0} EPISODES` : 'SHOW';
      $('#podcastShowLink').href = show ? `/search.html?q=${encodeURIComponent(show.title)}` : '#';
    }
  } finally {
    loadingSocial = false;
  }
}

async function likeCurrent() {
  if (!user || !current?.id) return;
  const existing = await supabase.from('podcast_likes').select('id').eq('episode_id', current.id).eq('user_id', user.id).maybeSingle();
  if (!existing.data) {
    await supabase.from('podcast_likes').insert({ episode_id: current.id, user_id: user.id });
    await supabase.from('podcast_episodes').update({ like_count: Number(current.like_count || 0) + 1 }).eq('id', current.id).then(() => {}, () => {});
  }
  await loadSocial();
}

async function commentCurrent(body) {
  const text = String(body || '').trim();
  if (!user || !current?.id || !text) return;
  await supabase.from('podcast_comments').insert({ episode_id: current.id, user_id: user.id, username: profile?.username, display_name: profile?.display_name, body: text });
  await supabase.from('podcast_episodes').update({ comment_count: Number(current.comment_count || 0) + 1 }).eq('id', current.id).then(() => {}, () => {});
  await loadSocial();
}

function scheduleEpisodes() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(loadEpisodes, 180);
}

async function startRealtime() {
  if (channel) {
    await supabase.removeChannel(channel).catch(() => {});
    channel = null;
  }
  const episodeId = current?.id;
  channel = supabase.channel(`podcast-owner:${episodeId || 'list'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_episodes' }, scheduleEpisodes);
  if (episodeId) {
    const filter = `episode_id=eq.${episodeId}`;
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_comments', filter }, loadSocial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_likes', filter }, loadSocial);
  }
  channel.subscribe();
}

async function cleanup() {
  clearTimeout(refreshTimer);
  if (channel) {
    await supabase.removeChannel(channel).catch(() => {});
    channel = null;
  }
}

mountSocial();
loadIdentity().then(loadEpisodes).then(startRealtime);
$('#podcastLikeBtn')?.addEventListener('click', likeCurrent);
$('#podcastCommentForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#podcastCommentBody');
  const body = input?.value || '';
  if (input) input.value = '';
  commentCurrent(body);
});
$('#podcastAudio')?.addEventListener('play', async () => {
  if (!current?.id || awarded.has(current.id)) return;
  awarded.add(current.id);
  await supabase.from('podcast_episodes').update({ play_count: Number(current.play_count || 0) + 1 }).eq('id', current.id).then(() => {}, () => {});
  await awardXp('podcast_play', { section: 'podcast', sourceTable: 'podcast_episodes', sourceId: current.id }).catch(() => {});
});
window.addEventListener('pagehide', cleanup, { once: true });