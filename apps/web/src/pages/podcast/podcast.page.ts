import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import './podcast-universe.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const duration = (value: unknown) => Number(value ?? 0) > 0 ? `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, '0')}` : 'LIVE';
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.mounted === 'podcast') return;
  root.dataset.mounted = 'podcast';

  const auth = getAuthSnapshot();
  const user = auth.user;
  const userId = user?.id ?? null;
  const profileResult = userId
    ? await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('id', userId).maybeSingle()
    : { data: null, error: null };
  const profile = profileResult.data;

  root.innerHTML = `<main class="media-ultimate podcast-universe"><div class="media-ultimate__wrap">
    <header class="media-ultimate__head"><a href="/music.html">←</a><div><p>RICH BIZNESS ORIGINAL AUDIO</p><h1>PODCAST UNIVERSE</h1></div><nav class="media-ultimate__tabs"><a href="/music.html">MUSIC</a><a class="active" href="/podcast.html">PODCAST</a><a href="/radio.html">RADIO</a></nav></header>
    <section class="podcast-stage"><article id="podcastCover" class="podcast-cover"></article><aside class="podcast-queue"><section id="podcastMetrics" class="media-ultimate__metrics"></section><nav class="media-ultimate__tabs" id="showTabs"></nav><div id="episodeQueue"></div></aside></section>
    <section class="media-ultimate__split"><article class="media-ultimate__panel"><header><h4>EPISODE NOTES & PERFORMANCE</h4></header><div id="episodeDetail" class="media-ultimate__list"></div></article><article class="media-ultimate__panel"><header><h4>LISTENER CONVERSATION</h4></header><div id="podcastComments" class="media-ultimate__chat"></div><form id="podcastCommentForm" class="media-ultimate__form"><input id="podcastCommentInput" maxlength="2000" placeholder="Join the episode discussion..."><button class="media-ultimate__btn primary">POST</button></form></article></section>
    <section class="media-ultimate__panel"><div class="media-ultimate__actions"><a class="media-ultimate__btn primary" href="/upload.html?route=podcast">DROP EPISODE</a><a class="media-ultimate__btn" href="/creator.html">CREATOR HUB</a><a class="media-ultimate__btn" href="/profile.html${userId ? `?id=${encodeURIComponent(userId)}` : ''}">PROFILE</a><a class="media-ultimate__btn" href="/watch.html?source=podcast">WATCH</a><a class="media-ultimate__btn" href="/portal.html">PORTAL</a></div></section>
    <aside class="universe-player" id="podcastPlayer" hidden><img id="podcastPlayerCover" alt=""><div><h3 id="podcastPlayerTitle"></h3><p id="podcastPlayerMeta"></p></div><audio id="podcastAudio" controls preload="metadata"></audio></aside><p id="podcastStatus" class="media-ultimate__empty" role="status"></p>
  </div></main>`;

  const coverRoot = document.querySelector<HTMLElement>('#podcastCover')!;
  const metrics = document.querySelector<HTMLElement>('#podcastMetrics')!;
  const tabs = document.querySelector<HTMLElement>('#showTabs')!;
  const queue = document.querySelector<HTMLElement>('#episodeQueue')!;
  const detail = document.querySelector<HTMLElement>('#episodeDetail')!;
  const comments = document.querySelector<HTMLElement>('#podcastComments')!;
  const form = document.querySelector<HTMLFormElement>('#podcastCommentForm')!;
  const input = document.querySelector<HTMLInputElement>('#podcastCommentInput')!;
  const audio = document.querySelector<HTMLAudioElement>('#podcastAudio')!;
  const player = document.querySelector<HTMLElement>('#podcastPlayer')!;
  const status = document.querySelector<HTMLElement>('#podcastStatus')!;

  let shows: Row[] = [];
  let episodes: Row[] = [];
  let liked = new Set<string>();
  let active: Row | null = null;
  let showId = 'all';
  let catalogChannel: Channel | null = null;
  let commentChannel: Channel | null = null;
  let catalogLoading = false;
  let catalogQueued = false;
  let commentsLoading = false;
  let commentsQueued = false;
  let historyTimer = 0;
  let destroyed = false;

  const setStatus = (message = '') => { status.textContent = message; };
  const requireUser = () => { if (userId) return true; location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`); return false; };
  const visibleEpisodes = () => showId !== 'all' ? episodes.filter((episode) => String(episode.show_id) === showId) : episodes;

  const renderMetrics = () => {
    metrics.innerHTML = `<article><small>SHOWS</small><strong>${fmt(shows.length)}</strong></article><article><small>EPISODES</small><strong>${fmt(episodes.length)}</strong></article><article><small>TOTAL PLAYS</small><strong>${fmt(episodes.reduce((sum, episode) => sum + Number(episode.play_count ?? 0), 0))}</strong></article><article><small>COMMUNITY</small><strong>${fmt(episodes.reduce((sum, episode) => sum + Number(episode.comment_count ?? 0), 0))}</strong></article>`;
  };

  const renderTabs = () => {
    tabs.innerHTML = `<button class="${showId === 'all' ? 'active' : ''}" data-show="all">ALL SHOWS</button>${shows.map((show) => `<button class="${showId === String(show.id) ? 'active' : ''}" data-show="${esc(show.id)}">${esc(show.title)}</button>`).join('')}`;
    tabs.querySelectorAll<HTMLButtonElement>('[data-show]').forEach((button) => {
      button.onclick = () => {
        showId = button.dataset.show || 'all';
        renderTabs();
        renderQueue();
        const first = visibleEpisodes()[0];
        if (first && String(first.id) !== String(active?.id)) void openEpisode(first);
      };
    });
  };

  const renderQueue = () => {
    queue.innerHTML = visibleEpisodes().map((episode) => `<button class="podcast-episode ${String(active?.id) === String(episode.id) ? 'active' : ''}" data-id="${esc(episode.id)}"><img src="${esc(safeMedia(episode.cover_url || episode.show_cover_url) || '/images/brand/IMG_5997.png')}" alt=""><div><h4>${esc(episode.title || 'Rich Podcast')}</h4><p>${esc(episode.show_title || episode.display_name || 'Rich Original')} · S${episode.season_number ?? 1} E${episode.episode_number ?? '—'} · ${duration(episode.duration_seconds)}</p></div><strong>${fmt(episode.play_count)} ▶</strong></button>`).join('') || '<div class="media-ultimate__empty">No episodes in this show.</div>';
    queue.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((button) => { button.onclick = () => { const episode = episodes.find((row) => String(row.id) === button.dataset.id); if (episode) void openEpisode(episode); }; });
  };

  const loadComments = async () => {
    if (commentsLoading) { commentsQueued = true; return; }
    commentsLoading = true;
    try {
      if (!active) { comments.innerHTML = '<div class="media-ultimate__empty">Select an episode.</div>'; return; }
      const { data, error } = await supabase.from('podcast_comments').select('id,body,display_name,username,created_at').eq('episode_id', active.id).order('created_at', { ascending: true }).limit(100);
      if (destroyed) return;
      comments.innerHTML = error ? `<div class="media-ultimate__empty">${esc(error.message)}</div>` : (data ?? []).map((comment) => `<article><p>${esc(comment.body)}</p><small>${esc(comment.display_name || comment.username || 'Rich Listener')}</small></article>`).join('') || '<div class="media-ultimate__empty">Start the discussion.</div>';
      comments.scrollTop = comments.scrollHeight;
    } finally {
      commentsLoading = false;
      if (commentsQueued && !destroyed) { commentsQueued = false; void loadComments(); }
    }
  };

  const openEpisode = async (episode: Row) => {
    active = episode;
    coverRoot.innerHTML = episodeCover(episode, liked.has(String(episode.id)));
    detail.innerHTML = [['Show', `${episode.show_title || 'Rich Original'} · ${episode.show_category || 'Podcast'}`], ['Episode', `Season ${episode.season_number ?? 1} · Episode ${episode.episode_number ?? '—'} · ${duration(episode.duration_seconds)}`], ['Audience', `${fmt(episode.play_count)} plays · ${fmt(episode.like_count)} likes · ${fmt(episode.comment_count)} comments`], ['Content', `${episode.is_explicit ? 'Explicit' : 'Clean'} · ${episode.is_featured ? 'Featured' : 'Original'}`]].map(([label, value]) => `<div class="media-ultimate__row"><div><h5>${label}</h5><p>${esc(value)}</p></div></div>`).join('');
    const source = safeMedia(episode.audio_url || episode.file_url);
    if (source) {
      player.hidden = false;
      document.querySelector<HTMLImageElement>('#podcastPlayerCover')!.src = safeMedia(episode.cover_url || episode.show_cover_url) || '/images/brand/IMG_5997.png';
      document.querySelector<HTMLElement>('#podcastPlayerTitle')!.textContent = episode.title || 'Rich Podcast';
      document.querySelector<HTMLElement>('#podcastPlayerMeta')!.textContent = episode.show_title || episode.display_name || 'Rich Original';
      if (audio.src !== source) { audio.pause(); audio.src = source; historyTimer = 0; }
    } else { player.hidden = true; audio.pause(); audio.removeAttribute('src'); audio.load(); }
    renderQueue();
    if (commentChannel) await supabase.removeChannel(commentChannel);
    await loadComments();
    commentChannel = supabase.channel(`podcast-comments:${episode.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_comments', filter: `episode_id=eq.${episode.id}` }, () => void loadComments()).subscribe();
    document.querySelector<HTMLButtonElement>('#podcastPlayBtn')!.onclick = () => { if (!source) { setStatus('Episode audio is unavailable.'); return; } void audio.play().catch(() => setStatus('Playback could not start.')); };
    document.querySelector<HTMLButtonElement>('#podcastLikeBtn')!.onclick = async () => {
      if (!requireUser()) return;
      const isLiked = liked.has(String(episode.id));
      const result = isLiked ? await supabase.from('podcast_likes').delete().eq('user_id', userId!).eq('episode_id', episode.id) : await supabase.from('podcast_likes').upsert({ user_id: userId!, episode_id: episode.id }, { onConflict: 'user_id,episode_id', ignoreDuplicates: true });
      if (result.error) { setStatus(result.error.message); return; }
      if (isLiked) liked.delete(String(episode.id)); else liked.add(String(episode.id));
      await openEpisode(episode);
    };
    history.replaceState({}, '', `/podcast.html?id=${encodeURIComponent(episode.id)}`);
  };

  const loadCatalog = async () => {
    if (catalogLoading) { catalogQueued = true; return; }
    catalogLoading = true;
    try {
      const { data, error } = await supabase.rpc('rb_live_watch_podcast_snapshot', {});
      if (error) { setStatus(error.message); return; }
      const snapshot = (data ?? {}) as Row;
      shows = (snapshot.podcast_shows ?? []) as Row[];
      episodes = (snapshot.podcast_episodes ?? []) as Row[];
      liked = userId ? new Set(((snapshot.podcast_likes ?? []) as Row[]).map((row) => String(row.episode_id))) : new Set();
      const requested = new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('episode');
      const current = active ? episodes.find((episode) => String(episode.id) === String(active?.id)) : null;
      active = current ?? episodes.find((episode) => String(episode.id) === requested) ?? episodes[0] ?? null;
      if (showId !== 'all' && !shows.some((show) => String(show.id) === showId)) showId = 'all';
      renderMetrics(); renderTabs(); renderQueue();
      if (active) await openEpisode(active); else { coverRoot.innerHTML = '<div class="media-ultimate__empty">No podcast episode released.</div>'; detail.innerHTML = ''; comments.innerHTML = '<div class="media-ultimate__empty">No episode selected.</div>'; }
    } finally {
      catalogLoading = false;
      if (catalogQueued && !destroyed) { catalogQueued = false; void loadCatalog(); }
    }
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || !requireUser()) return;
    const body = input.value.trim();
    if (!body) return;
    const submit = form.querySelector<HTMLButtonElement>('button')!; submit.disabled = true;
    const { error } = await supabase.from('podcast_comments').insert({ episode_id: active.id, user_id: userId!, body, username: profile?.username ?? user?.user_metadata?.username ?? 'member', display_name: profile?.display_name ?? user?.user_metadata?.display_name ?? 'Rich Bizness Member' });
    submit.disabled = false;
    if (error) { setStatus(error.message); return; }
    input.value = ''; await loadComments();
  };

  const saveHistory = (completed: boolean) => {
    if (!userId || !active || !Number.isFinite(audio.duration)) return;
    void supabase.from('audio_listening_history').upsert({ user_id: userId, source_type: 'podcast', source_id: active.id, progress_seconds: Math.floor(completed ? audio.duration : audio.currentTime), completed, last_played_at: new Date().toISOString(), metadata: { duration_seconds: Math.floor(audio.duration || 0), title: active.title, show_title: active.show_title } }, { onConflict: 'user_id,source_type,source_id' });
  };
  const onTimeUpdate = () => { if (Date.now() - historyTimer < 15000) return; historyTimer = Date.now(); saveHistory(false); };
  const onEnded = () => saveHistory(true);
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);

  catalogChannel = supabase.channel('rich-podcast-catalog').on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_shows' }, () => void loadCatalog()).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_episodes' }, () => void loadCatalog()).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_likes' }, () => void loadCatalog()).subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    saveHistory(false);
    audio.pause(); audio.removeAttribute('src'); audio.load();
    audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded);
    if (commentChannel) void supabase.removeChannel(commentChannel);
    if (catalogChannel) void supabase.removeChannel(catalogChannel);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  await loadCatalog();
}

function episodeCover(episode: Row, isLiked: boolean) {
  return `<img src="${esc(safeMedia(episode.cover_url || episode.show_cover_url) || '/images/brand/IMG_5997.png')}" alt=""><div class="podcast-cover__copy"><span class="media-ultimate__eyebrow">RICH ORIGINAL · ${esc(episode.show_category || 'PODCAST')}</span><h2>${esc(episode.title || 'Rich Podcast')}</h2><p>${esc(episode.description || 'Long-form conversation, culture and creator stories from the Rich Bizness universe.')}</p><div class="media-ultimate__actions"><button id="podcastPlayBtn" class="media-ultimate__btn primary">▶ PLAY EPISODE</button><button id="podcastLikeBtn" class="media-ultimate__btn">${isLiked ? '♥ LIKED' : '♡ LIKE'}</button><a class="media-ultimate__btn" href="/profile.html?id=${esc(episode.creator_id || episode.user_id)}">HOST PROFILE</a></div></div>`;
}
