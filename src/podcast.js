import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=xp-idempotent-1';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
let episodes = [];
let current = null;
let awarded = new Set();

function titleOf(row) { return row.title || 'Rich Bizness Episode'; }
function subOf(row) { return [row.display_name || row.username || 'Rich Bizness', row.episode_number ? `Episode ${row.episode_number}` : 'Podcast'].filter(Boolean).join(' • '); }
function audioOf(row) { return row.audio_url || row.file_url || row.media_url || row.recording_url || row.stream_url || ''; }
function coverOf(row) { return row.cover_url || row.thumbnail_url || row.image_url || ''; }
function card(row, i) {
  const cover = coverOf(row);
  return `<article class="card podcast-episode ${current?.id === row.id ? 'active' : ''}" data-episode="${i}">${cover ? `<img src="${cover}" alt="">` : ''}<b>${titleOf(row)}</b><p>${row.description || row.caption || 'Podcast episode ready.'}</p><small>${subOf(row)}</small></article>`;
}
function paint() {
  const list = $('#sectionCards');
  if (list) list.innerHTML = episodes.length ? episodes.map(card).join('') : '<div class="empty">No podcast episodes yet. Drop one from Upload.</div>';
  const count = $('#recordCount');
  if (count) count.textContent = fmt(episodes.length);
  document.querySelectorAll('[data-episode]').forEach((el) => el.addEventListener('click', () => selectEpisode(Number(el.dataset.episode))));
}
function selectEpisode(index) {
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
    cover.innerHTML = url ? `<img src="${url}" alt="">` : 'RB';
  }
  if (audio) {
    const src = current ? audioOf(current) : '';
    if (src) audio.src = src;
  }
}
async function loadEpisodes() {
  const { data, error } = await supabase.from('podcast_episodes').select('*').order('created_at', { ascending: false }).limit(24);
  if (error) {
    const list = $('#sectionCards');
    if (list) list.innerHTML = `<div class="empty">${error.message}</div>`;
    return;
  }
  episodes = data || [];
  paint();
  if (!current && episodes.length) selectEpisode(0);
}
$('#podcastAudio')?.addEventListener('play', async () => {
  if (!current?.id || awarded.has(current.id)) return;
  awarded.add(current.id);
  await awardXp('podcast_play', { section: 'podcast', sourceTable: 'podcast_episodes', sourceId: current.id }).catch(() => {});
});
loadEpisodes();
supabase.channel('podcast-episodes-live').on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_episodes' }, loadEpisodes).subscribe();
