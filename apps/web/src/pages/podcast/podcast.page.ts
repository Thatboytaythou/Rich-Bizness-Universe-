import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import './podcast-universe.css';

type Row = Record<string, any>;
type Snapshot = { shows?: Row[]; episodes?: Row[]; comments?: Row[]; liked?: boolean; metrics?: Row };
type Channel = ReturnType<typeof supabase.channel>;
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const safe = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const runtime = (value: unknown) => Number(value ?? 0) > 0 ? `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, '0')}` : 'EPISODE';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app');
  const host = window as CleanupHost;
  const mountEpoch = root.dataset.pageEpoch ?? '';
  let destroyed = false;
  const isCurrent = () => !destroyed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === 'rich-bizness-podcast-v4';

  const user = getAuthSnapshot().user;
  const userId = user?.id ?? null;

  root.innerHTML = `<main class="media-ultimate podcast-universe"><div class="media-ultimate__wrap"><header class="media-ultimate__head"><a href="/music.html">←</a><div><p>RICH BIZNESS ORIGINAL PODCAST NETWORK</p><h1>PODCAST UNIVERSE</h1></div><nav class="media-ultimate__tabs"><a href="/music.html">MUSIC</a><a class="active" href="/podcast.html">PODCAST</a><a href="/radio.html">RADIO</a></nav></header><nav class="podcast-network-rail" aria-label="Podcast network connections"><a href="/live.html?category=podcast"><b>🔴</b><span>WE LIT 🔥 LIVE</span></a><a href="/watch.html?lane=podcast"><b>📺</b><span>WE 🔥 📺 REPLAYS</span></a><a href="/upload.html?route=podcast"><b>⬆</b><span>DROP EPISODE</span></a><a href="/creator.html"><b>♛</b><span>CREATOR</span></a></nav><section class="podcast-command"><article id="podcastStage" class="podcast-video-stage"></article><aside class="podcast-queue"><section id="podcastMetrics" class="media-ultimate__metrics"></section><nav class="media-ultimate__tabs" id="showTabs"></nav><div id="episodeQueue"></div></aside></section><section class="media-ultimate__split"><article class="media-ultimate__panel"><header><h4>EPISODE INTELLIGENCE</h4></header><div id="episodeDetail" class="media-ultimate__list"></div></article><article class="media-ultimate__panel"><header><h4>LISTENER CONVERSATION</h4></header><div id="podcastComments" class="media-ultimate__chat"></div><form id="podcastCommentForm" class="media-ultimate__form"><input id="podcastCommentInput" maxlength="2000" placeholder="Join the episode discussion..."><button class="media-ultimate__btn primary">POST</button></form></article></section><section class="media-ultimate__panel podcast-launchpad"><div><small>PODCAST CREATOR COMMAND</small><h2>Publish the episode. Build the show. Send live moments to WE LIT 🔥 and finished video to WE 🔥 📺.</h2></div><div class="media-ultimate__actions"><a class="media-ultimate__btn primary" href="/upload.html?route=podcast">DROP EPISODE</a><a class="media-ultimate__btn" href="/live.html?category=podcast">GO LIVE ON WE LIT 🔥</a><a class="media-ultimate__btn" href="/watch.html?lane=podcast">WATCH ON WE 🔥 📺</a><a class="media-ultimate__btn" href="/creator.html">CREATOR HUB</a><a class="media-ultimate__btn" href="/portal.html">PORTAL</a></div></section><aside id="podcastPlayer" class="podcast-player" hidden><img id="podcastPlayerCover" alt=""><div class="podcast-player-copy"><strong id="podcastPlayerTitle"></strong><small id="podcastPlayerMeta"></small></div><div class="podcast-player-controls"><button id="podcastPrev" type="button" aria-label="Previous episode">⏮</button><button id="podcastToggle" type="button" aria-label="Play or pause">▶</button><button id="podcastNext" type="button" aria-label="Next episode">⏭</button></div></aside><p id="podcastStatus" class="media-ultimate__empty" role="status"></p></div></main>`;

  const stage = root.querySelector<HTMLElement>('#podcastStage')!;
  const metrics = root.querySelector<HTMLElement>('#podcastMetrics')!;
  const tabs = root.querySelector<HTMLElement>('#showTabs')!;
  const queue = root.querySelector<HTMLElement>('#episodeQueue')!;
  const detail = root.querySelector<HTMLElement>('#episodeDetail')!;
  const comments = root.querySelector<HTMLElement>('#podcastComments')!;
  const form = root.querySelector<HTMLFormElement>('#podcastCommentForm')!;
  const input = root.querySelector<HTMLInputElement>('#podcastCommentInput')!;
  const status = root.querySelector<HTMLElement>('#podcastStatus')!;
  const player = root.querySelector<HTMLElement>('#podcastPlayer')!;

  let snapshot: Snapshot = {};
  let active: Row | null = null;
  let showId = 'all';
  let networkChannel: Channel | null = null;
  let commentChannel: Channel | null = null;
  let listenerChannel: Channel | null = null;
  let loading = false;
  let queued = false;
  let refreshTimer: number | undefined;
  let statusTimer: number | undefined;
  let lastHistory = 0;
  let playCounted = false;
  let autoplayAfterOpen = false;
  let requestEpoch = 0;

  const setStatus = (message: string, error = false) => {
    if (!isCurrent()) return;
    status.textContent = message;
    status.dataset.error = String(error);
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { if (isCurrent() && status.textContent === message) status.textContent = ''; }, 3200);
  };

  const requireUser = () => { if (userId) return true; location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`); return false; };
  const action = async (name: string, payload: Row) => { const { data, error } = await supabase.rpc('rb_podcast_action', { p_action: name, p_payload: payload }); if (error) throw error; return (data ?? {}) as Row; };
  const visible = () => showId === 'all' ? snapshot.episodes ?? [] : (snapshot.episodes ?? []).filter((episode) => String(episode.show_id) === showId);
  const activeIndex = () => visible().findIndex((episode) => String(episode.id) === String(active?.id ?? ''));

  const renderComments = () => {
    if (!isCurrent()) return;
    comments.innerHTML = (snapshot.comments ?? []).map((comment) => `<article><p>${esc(comment.body)}</p><small>${esc(comment.display_name || comment.username || 'Rich Listener')}</small></article>`).join('') || '<div class="media-ultimate__empty">Start the conversation.</div>';
    comments.scrollTop = comments.scrollHeight;
  };

  const renderQueue = () => {
    if (!isCurrent()) return;
    queue.innerHTML = visible().map((episode, index) => `<button class="podcast-episode ${String(active?.id) === String(episode.id) ? 'active' : ''}" data-id="${esc(episode.id)}"><span class="podcast-episode-index">${String(index + 1).padStart(2, '0')}</span><img src="${esc(safe(episode.thumbnail_url || episode.cover_url || episode.show_cover_url) || '/images/brand/IMG_5997.png')}" alt=""><div><h4>${esc(episode.title || 'Rich Podcast')}</h4><p>${esc(episode.show_title || episode.display_name || 'Rich Original')} · ${runtime(episode.duration_seconds)} · ${esc((episode.media_type || 'audio').toUpperCase())}</p></div><strong>${fmt(episode.play_count)} ▶</strong></button>`).join('') || '<div class="media-ultimate__empty">No episodes in this show.</div>';
    queue.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((button) => { button.onclick = () => { const episode = (snapshot.episodes ?? []).find((candidate) => String(candidate.id) === button.dataset.id); if (episode) void openEpisode(episode, false, true); }; });
  };

  const renderTabs = () => {
    if (!isCurrent()) return;
    tabs.innerHTML = `<button class="${showId === 'all' ? 'active' : ''}" data-show="all">ALL SHOWS</button>${(snapshot.shows ?? []).map((show) => `<button class="${showId === String(show.id) ? 'active' : ''}" data-show="${esc(show.id)}">${esc(show.title)}</button>`).join('')}`;
    tabs.querySelectorAll<HTMLButtonElement>('[data-show]').forEach((button) => { button.onclick = () => { showId = button.dataset.show || 'all'; renderTabs(); renderQueue(); const first = visible()[0]; if (first) void openEpisode(first, false, true); }; });
  };

  const render = () => {
    if (!isCurrent()) return;
    const values = snapshot.metrics ?? {};
    metrics.innerHTML = `<article><small>SHOWS</small><strong>${fmt(values.shows)}</strong></article><article><small>EPISODES</small><strong>${fmt(values.episodes)}</strong></article><article><small>AUDIO</small><strong>${fmt(values.audio_episodes)}</strong></article><article><small>VIDEO</small><strong>${fmt(values.video_episodes)}</strong></article>`;
    renderTabs(); renderQueue(); renderComments();
  };

  const persist = async (media: HTMLMediaElement, completed = false) => {
    if (!userId || !active || !isCurrent()) return;
    const now = Date.now();
    if (!completed && now - lastHistory < 15000) return;
    lastHistory = now;
    try { await action('history', { episode_id: active.id, progress_seconds: Math.floor(completed ? media.duration || 0 : media.currentTime), completed, media_type: active.media_type || 'audio', started: !playCounted }); playCounted = true; } catch {}
  };

  const getMedia = () => root.querySelector<HTMLMediaElement>('#podcastMedia');
  const playActive = async () => { const media = getMedia(); if (!media) return setStatus('This episode has no playable media source.', true); try { await media.play(); await persist(media, false); } catch { setStatus('Episode playback could not start.', true); } };

  const subscribeComments = async (episodeId: string | null) => {
    if (commentChannel) { await supabase.removeChannel(commentChannel); commentChannel = null; }
    if (!episodeId || !isCurrent()) return;
    commentChannel = supabase.channel(`podcast-comments:${mountEpoch}:${episodeId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_comments', filter: `episode_id=eq.${episodeId}` }, () => scheduleLoad(episodeId)).subscribe();
  };

  const syncUrl = (episodeId: string) => { if (!isCurrent()) return; const url = new URL(location.href); url.searchParams.set('id', episodeId); url.searchParams.delete('episode'); history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`); };

  const openEpisode = async (episode: Row, shouldPlay = false, refresh = false) => {
    if (!isCurrent()) return;
    active = episode;
    playCounted = false;
    autoplayAfterOpen = shouldPlay;
    if (refresh) await load(String(episode.id), false);
    if (!isCurrent()) return;
    const current = (snapshot.episodes ?? []).find((candidate) => String(candidate.id) === String(episode.id)) ?? episode;
    active = current;
    const video = safe(current.video_url || (current.media_type === 'video' ? current.file_url : ''));
    const audio = safe(current.audio_url || (current.media_type !== 'video' ? current.file_url : ''));
    const poster = safe(current.thumbnail_url || current.cover_url || current.show_cover_url) || '/images/brand/IMG_5997.png';
    const mediaType = video ? 'video' : audio ? 'audio' : 'processing';
    stage.innerHTML = `<div class="podcast-screen">${video ? `<video id="podcastMedia" src="${esc(video)}" poster="${esc(poster)}" controls playsinline preload="metadata"></video>` : audio ? `<img src="${esc(poster)}" alt=""><audio id="podcastMedia" src="${esc(audio)}" controls preload="metadata"></audio>` : `<img src="${esc(poster)}" alt=""><div class="podcast-unavailable">EPISODE PROCESSING</div>`}</div><div class="podcast-video-copy"><span>RICH ORIGINAL · ${esc(current.show_category || 'PODCAST')}</span><h2>${esc(current.title || 'Rich Podcast')}</h2><p>${esc(current.description || 'Long-form conversation, culture, business and creator stories from the Rich Bizness universe.')}</p><div class="media-ultimate__actions"><button id="podcastPlayBtn" class="media-ultimate__btn primary" ${mediaType === 'processing' ? 'disabled' : ''}>▶ PLAY EPISODE</button><button id="podcastLikeBtn" class="media-ultimate__btn">${snapshot.liked ? '♥ LIKED' : '♡ LIKE'}</button><a class="media-ultimate__btn" href="/profile.html?id=${encodeURIComponent(String(current.creator_id || current.user_id || ''))}">HOST PROFILE</a><a class="media-ultimate__btn" href="/live.html?category=podcast">WE LIT 🔥</a><a class="media-ultimate__btn" href="/watch.html?lane=podcast&type=podcast&id=${encodeURIComponent(String(current.id))}">WE 🔥 📺</a></div></div>`;
    detail.innerHTML = [['FORMAT', `${mediaType.toUpperCase()} · ${runtime(current.duration_seconds)}`], ['SHOW', `${current.show_title || 'Rich Original'} · ${current.show_category || 'Podcast'}`], ['AUDIENCE', `${fmt(current.play_count)} plays · ${fmt(current.like_count)} likes · ${fmt(current.comment_count)} comments`], ['OWNERSHIP', 'Podcast owns shows and episodes · WE LIT 🔥 owns live rooms · WE 🔥 📺 owns replay viewing']].map(([name, value]) => `<div class="media-ultimate__row"><div><h5>${name}</h5><p>${esc(value)}</p></div></div>`).join('');
    player.hidden = false;
    root.querySelector<HTMLImageElement>('#podcastPlayerCover')!.src = poster;
    root.querySelector<HTMLElement>('#podcastPlayerTitle')!.textContent = current.title || 'Rich Podcast';
    root.querySelector<HTMLElement>('#podcastPlayerMeta')!.textContent = `${current.show_title || current.display_name || 'Rich Original'} · ${runtime(current.duration_seconds)}`;
    renderQueue(); syncUrl(String(current.id)); await subscribeComments(String(current.id));
    const media = getMedia();
    if (media) {
      media.onplay = () => { if (!isCurrent()) return; const toggle = root.querySelector<HTMLButtonElement>('#podcastToggle'); if (toggle) toggle.textContent = 'Ⅱ'; void persist(media, false); };
      media.onpause = () => { if (!isCurrent()) return; const toggle = root.querySelector<HTMLButtonElement>('#podcastToggle'); if (toggle) toggle.textContent = '▶'; };
      media.ontimeupdate = () => { if (isCurrent()) void persist(media, false); };
      media.onended = () => { if (isCurrent()) { void persist(media, true); void moveQueue(1); } };
    }
    root.querySelector<HTMLButtonElement>('#podcastPlayBtn')!.onclick = () => void playActive();
    root.querySelector<HTMLButtonElement>('#podcastLikeBtn')!.onclick = async () => { if (!requireUser()) return; try { const result = await action('toggle_like', { episode_id: current.id }); if (!isCurrent()) return; snapshot.liked = Boolean(result.liked); await load(String(current.id), false); if (isCurrent()) await openEpisode(current, false, false); } catch (error) { setStatus(error instanceof Error ? error.message : 'Like failed', true); } };
    if (autoplayAfterOpen) { autoplayAfterOpen = false; await playActive(); }
  };

  const moveQueue = async (direction: number) => { const list = visible(); if (!list.length || !isCurrent()) return; const media = getMedia(); if (media) await persist(media, false); const current = activeIndex(); const next = current < 0 ? 0 : (current + direction + list.length) % list.length; await openEpisode(list[next], true, true); };

  const load = async (episodeId?: string, open = true) => {
    if (!isCurrent()) return;
    if (loading) { queued = true; return; }
    const epoch = ++requestEpoch;
    loading = true;
    try {
      const { data, error } = await supabase.rpc('rb_podcast_snapshot', { p_episode_id: episodeId || active?.id || null, p_limit: 100 });
      if (error) throw error;
      if (!isCurrent() || epoch !== requestEpoch) return;
      snapshot = (data ?? {}) as Snapshot;
      const params = new URLSearchParams(location.search);
      const requested = episodeId || params.get('id') || params.get('episode');
      active = (snapshot.episodes ?? []).find((episode) => String(episode.id) === String(requested)) ?? (active ? (snapshot.episodes ?? []).find((episode) => String(episode.id) === String(active?.id)) : null) ?? (snapshot.episodes ?? [])[0] ?? null;
      render();
      if (open && active) await openEpisode(active, false, false);
      if (!active && isCurrent()) { stage.innerHTML = '<div class="media-ultimate__empty">No podcast episodes are public yet.</div>'; detail.innerHTML = ''; player.hidden = true; await subscribeComments(null); }
    } catch (error) {
      if (!isCurrent() || epoch !== requestEpoch) return;
      snapshot = {}; active = null;
      const media = getMedia(); if (media) { media.pause(); media.removeAttribute('src'); media.load(); }
      player.hidden = true; render(); stage.innerHTML = '<div class="media-ultimate__empty">Podcast network is temporarily unavailable.</div>'; detail.innerHTML = ''; await subscribeComments(null); setStatus(error instanceof Error ? error.message : 'Podcast sync failed', true);
    } finally { loading = false; if (queued && isCurrent()) { queued = false; void load(active?.id ? String(active.id) : undefined, false); } }
  };

  const scheduleLoad = (episodeId?: string) => { if (!isCurrent()) return; window.clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => { if (isCurrent()) void load(episodeId || (active?.id ? String(active.id) : undefined), false); }, 180); };

  form.onsubmit = async (event) => { event.preventDefault(); if (!active || !requireUser() || !isCurrent()) return; const body = input.value.trim(); if (!body) return; const button = form.querySelector<HTMLButtonElement>('button')!; button.disabled = true; try { await action('comment', { episode_id: active.id, body }); if (!isCurrent()) return; input.value = ''; await load(String(active.id), false); } catch (error) { setStatus(error instanceof Error ? error.message : 'Comment failed', true); } finally { if (isCurrent()) button.disabled = false; } };

  root.querySelector<HTMLButtonElement>('#podcastPrev')!.onclick = () => void moveQueue(-1);
  root.querySelector<HTMLButtonElement>('#podcastNext')!.onclick = () => void moveQueue(1);
  root.querySelector<HTMLButtonElement>('#podcastToggle')!.onclick = () => { const media = getMedia(); if (!media) return setStatus('This episode has no playable media source.', true); if (media.paused) void playActive(); else media.pause(); };

  const cleanup = async () => {
    if (destroyed) return;
    destroyed = true;
    requestEpoch++;
    window.clearTimeout(refreshTimer);
    window.clearTimeout(statusTimer);
    const media = getMedia();
    if (media) { media.pause(); media.onplay = null; media.onpause = null; media.ontimeupdate = null; media.onended = null; media.removeAttribute('src'); media.load(); }
    const removals = [networkChannel, commentChannel, listenerChannel].filter(Boolean).map((channel) => supabase.removeChannel(channel as Channel));
    await Promise.allSettled(removals);
    networkChannel = null; commentChannel = null; listenerChannel = null;
    if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null;
    window.removeEventListener('pagehide', onPageExit);
    window.removeEventListener('beforeunload', onPageExit);
  };
  const onPageExit = () => { void cleanup(); };
  host.__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', onPageExit, { once: true });
  window.addEventListener('beforeunload', onPageExit, { once: true });

  await load(undefined, true);
  if (!isCurrent()) return;
  networkChannel = supabase.channel(`podcast-network-owner:${mountEpoch}`).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_shows' }, () => scheduleLoad()).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_episodes' }, () => scheduleLoad()).subscribe();
  if (userId && isCurrent()) {
    listenerChannel = supabase.channel(`podcast-listener:${mountEpoch}:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_likes', filter: `user_id=eq.${userId}` }, () => scheduleLoad()).on('postgres_changes', { event: '*', schema: 'public', table: 'audio_listening_history', filter: `user_id=eq.${userId}` }, () => scheduleLoad()).subscribe();
  }
}
