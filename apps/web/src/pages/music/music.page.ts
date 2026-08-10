import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;
type Snapshot = { tracks?: Row[]; playlists?: Row[]; active_state?: { liked?: boolean; in_rotation?: boolean }; comments?: Row[]; metrics?: Row };
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const host = window as CleanupHost;
  const mountEpoch = root.dataset.pageEpoch ?? '';
  let destroyed = false;
  const isCurrent = () => !destroyed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === 'rich-bizness-music-v4';

  const user = getAuthSnapshot().user;
  const userId = user?.id ?? null;
  const params = new URLSearchParams(location.search);
  const requestedTrack = params.get('track') || params.get('id');

  root.innerHTML = `<main class="sound-universe music-command"><div class="sound-wrap">
    <header class="sound-head"><a href="/portal.html" aria-label="Back to portal">←</a><div class="sound-brand"><small>RICH BIZNESS ORIGINAL AUDIO</small><h1>MUSIC UNIVERSE</h1></div><nav class="sound-nav" aria-label="Rich Sound sections"><a class="active" href="/music.html">MUSIC</a><a href="/radio.html">RADIO</a><a href="/podcast.html">PODCAST</a></nav></header>
    <section class="sound-hero"><article id="musicHero" class="sound-now"></article><aside class="sound-panel"><section id="musicMetrics" class="sound-metrics"></section><div id="musicList" class="sound-list"></div></aside></section>
    <section class="sound-lower"><article class="sound-panel"><h3>MY ROTATION</h3><div id="playlistList" class="sound-list"></div></article><article class="sound-panel"><h3>CONVERSATION</h3><div id="musicComments" class="sound-comments"></div><form id="musicCommentForm" class="sound-form"><input id="musicCommentInput" maxlength="2000" placeholder="Talk your talk..." autocomplete="off"><button class="sound-btn primary">POST</button></form></article></section>
    <section class="sound-panel"><div class="sound-actions"><a class="sound-btn primary" href="/upload.html?route=music">DROP MUSIC</a><a class="sound-btn" href="/creator.html">CREATOR HUB</a><a class="sound-btn" href="/profile.html${userId ? `?id=${encodeURIComponent(userId)}` : ''}">PROFILE</a></div></section>
    <aside id="musicPlayer" class="sound-player" hidden><img id="musicPlayerCover" alt=""><div><strong id="musicPlayerTitle"></strong><small id="musicPlayerMeta"></small></div><div><button id="musicPrev" type="button">⏮</button><button id="musicToggle" type="button">▶</button><button id="musicNext" type="button">⏭</button></div><audio id="musicAudio" controls preload="metadata"></audio></aside>
    <p id="musicStatus" class="music-status" role="status"></p>
  </div></main>`;

  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const list = q<HTMLElement>('#musicList');
  const hero = q<HTMLElement>('#musicHero');
  const metrics = q<HTMLElement>('#musicMetrics');
  const playlistList = q<HTMLElement>('#playlistList');
  const comments = q<HTMLElement>('#musicComments');
  const commentForm = q<HTMLFormElement>('#musicCommentForm');
  const commentInput = q<HTMLInputElement>('#musicCommentInput');
  const player = q<HTMLElement>('#musicPlayer');
  const audio = q<HTMLAudioElement>('#musicAudio');
  const status = q<HTMLElement>('#musicStatus');

  let snapshot: Snapshot = {};
  let active: Row | null = null;
  let catalogChannel: Channel | null = null;
  let commentChannel: Channel | null = null;
  let listenerChannel: Channel | null = null;
  let loading = false;
  let queued = false;
  let refreshTimer = 0;
  let statusTimer = 0;
  let countedTrack: string | null = null;

  const setStatus = (message: string, error = false) => { if (!isCurrent()) return; status.textContent = message; status.dataset.error = String(error); clearTimeout(statusTimer); statusTimer = window.setTimeout(() => { if (isCurrent() && status.textContent === message) status.textContent = ''; }, 2800); };
  const requireUser = () => { if (userId) return true; location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`); return false; };
  const action = async (name: string, payload: Row) => { const { data, error } = await supabase.rpc('rb_music_action', { p_action: name, p_payload: payload }); if (error) throw error; return data as Row; };
  const tracks = () => snapshot.tracks ?? [];
  const activeIndex = () => tracks().findIndex((row) => String(row.id) === String(active?.id ?? ''));
  const syncUrl = (trackId: string | null) => { if (!isCurrent()) return; const url = new URL(location.href); url.searchParams.delete('id'); if (trackId) url.searchParams.set('track', trackId); else url.searchParams.delete('track'); history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`); };
  const scheduleLoad = () => { clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => { if (isCurrent()) void load(active?.id ?? null); }, 160); };

  const renderCatalog = () => {
    if (!isCurrent()) return;
    const catalog = tracks();
    const playlists = snapshot.playlists ?? [];
    const m = snapshot.metrics ?? {};
    metrics.innerHTML = `<article><small>TRACKS</small><strong>${fmt(m.tracks ?? catalog.length)}</strong></article><article><small>PLAYLISTS</small><strong>${fmt(playlists.length)}</strong></article><article><small>PLAYS</small><strong>${fmt(m.total_plays)}</strong></article><article><small>LIKES</small><strong>${fmt(m.likes)}</strong></article>`;
    list.innerHTML = catalog.map((track) => `<button class="sound-card ${active?.id === track.id ? 'active' : ''}" data-id="${esc(track.id)}"><img src="${esc(safeMedia(track.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(track.title || 'Untitled Track')}</b><small>${esc(track.display_name || track.username || 'Rich Bizness Artist')} · ${esc(track.genre || 'Music')}</small></span><strong>${fmt(track.play_count)} ▶</strong></button>`).join('') || '<div class="sound-empty">No music published yet.</div>';
    list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => { node.onclick = () => { const track = catalog.find((row) => String(row.id) === node.dataset.id); if (track) void openTrack(track, false); }; });
    playlistList.innerHTML = userId ? playlists.map((playlist) => `<button class="sound-card" data-playlist="${esc(playlist.id)}"><span class="sound-fallback">PL</span><span><b>${esc(playlist.title)}</b><small>${fmt(playlist.track_count)} tracks</small></span><strong>OPEN</strong></button>`).join('') || '<div class="sound-empty">No private rotations yet.</div>' : '<div class="sound-empty">Tap In to build rotations.</div>';
  };

  const renderComments = () => { if (!isCurrent()) return; comments.innerHTML = (snapshot.comments ?? []).map((comment) => `<article class="sound-comment"><b>${esc(comment.display_name || comment.username || 'Rich Listener')}</b><p>${esc(comment.comment)}</p></article>`).join('') || '<div class="sound-empty">No comments yet.</div>'; };

  const load = async (trackId: string | null = active?.id ?? null) => {
    if (!isCurrent()) return;
    if (loading) { queued = true; return; }
    loading = true;
    try {
      const { data, error } = await supabase.rpc('rb_music_snapshot', { p_track_id: trackId, p_limit: 120 });
      if (error) throw error;
      if (!isCurrent()) return;
      snapshot = (data ?? {}) as Snapshot;
      if (active) active = tracks().find((row) => String(row.id) === String(active?.id)) ?? active;
      renderCatalog(); renderComments();
    } catch (error) {
      if (!isCurrent()) return;
      setStatus(error instanceof Error ? error.message : 'Music sync failed.', true);
    } finally { loading = false; if (queued && isCurrent()) { queued = false; void load(); } }
  };

  const registerPlay = async (track: Row) => { if (!userId || countedTrack === String(track.id) || !isCurrent()) return; countedTrack = String(track.id); try { await action('history', { track_id: track.id, progress_seconds: 0, completed: false, count_play: true, title: track.title }); } catch {} };
  const playActive = async () => { if (!active || !isCurrent()) return; const src = safeMedia(active.audio_url || active.file_url); if (!src) return setStatus('Track source unavailable.', true); try { await audio.play(); await registerPlay(active); } catch { setStatus('Playback could not start.', true); } };

  const openTrack = async (track: Row, shouldPlay = false) => {
    if (!isCurrent()) return;
    active = track;
    await load(track.id);
    if (!isCurrent()) return;
    const state = snapshot.active_state ?? {};
    const cover = safeMedia(track.cover_url) || '/images/brand/IMG_5997.png';
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="sound-copy"><span>RICH SOUND · ${esc(track.genre || 'MUSIC')}</span><h2>${esc(track.title || 'Untitled Track')}</h2><p>${esc(track.description || track.display_name || track.username || 'Rich Bizness Artist')}</p><div class="sound-actions"><button id="musicPlayBtn" class="sound-btn primary">▶ PLAY</button><button id="musicLikeBtn" class="sound-btn">${state.liked ? '♥ LIKED' : '♡ LIKE'}</button><button id="musicRotationBtn" class="sound-btn">${state.in_rotation ? 'REMOVE ROTATION' : 'ADD ROTATION'}</button></div></div>`;
    player.hidden = false;
    q<HTMLImageElement>('#musicPlayerCover').src = cover;
    q<HTMLElement>('#musicPlayerTitle').textContent = track.title || 'Untitled Track';
    q<HTMLElement>('#musicPlayerMeta').textContent = `${track.display_name || track.username || 'Rich Bizness Artist'} · ${track.genre || 'Music'}`;
    audio.src = safeMedia(track.audio_url || track.file_url);
    q<HTMLButtonElement>('#musicPlayBtn').onclick = () => void playActive();
    q<HTMLButtonElement>('#musicLikeBtn').onclick = async () => { if (!requireUser()) return; try { await action('toggle_like', { track_id: track.id }); await openTrack(track, false); } catch (error) { setStatus(error instanceof Error ? error.message : 'Like failed.', true); } };
    q<HTMLButtonElement>('#musicRotationBtn').onclick = async () => { if (!requireUser()) return; try { await action('toggle_rotation', { track_id: track.id }); await openTrack(track, false); } catch (error) { setStatus(error instanceof Error ? error.message : 'Rotation failed.', true); } };
    syncUrl(String(track.id));
    if (commentChannel) await supabase.removeChannel(commentChannel);
    if (!isCurrent()) return;
    commentChannel = supabase.channel(`music-comments:${mountEpoch}:${track.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'music_comments', filter: `track_id=eq.${track.id}` }, scheduleLoad).subscribe();
    if (shouldPlay) await playActive();
  };

  const moveQueue = async (direction: number) => { const catalog = tracks(); if (!catalog.length || !isCurrent()) return; const current = activeIndex(); const next = current < 0 ? 0 : (current + direction + catalog.length) % catalog.length; countedTrack = null; await openTrack(catalog[next], true); };

  commentForm.onsubmit = async (event) => { event.preventDefault(); if (!active || !requireUser() || !isCurrent()) return; const value = commentInput.value.trim(); if (!value) return; try { await action('comment', { track_id: active.id, comment: value }); commentInput.value = ''; await load(active.id); } catch (error) { setStatus(error instanceof Error ? error.message : 'Comment failed.', true); } };
  q<HTMLButtonElement>('#musicPrev').onclick = () => void moveQueue(-1);
  q<HTMLButtonElement>('#musicNext').onclick = () => void moveQueue(1);
  q<HTMLButtonElement>('#musicToggle').onclick = () => { if (audio.paused) void playActive(); else audio.pause(); };

  catalogChannel = supabase.channel(`music-catalog:${mountEpoch}`).on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, scheduleLoad).subscribe();
  if (userId) listenerChannel = supabase.channel(`music-listener:${mountEpoch}:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'music_playlists', filter: `user_id=eq.${userId}` }, scheduleLoad).subscribe();

  const cleanup = async () => { if (destroyed) return; destroyed = true; clearTimeout(refreshTimer); clearTimeout(statusTimer); audio.pause(); audio.removeAttribute('src'); if (catalogChannel) await supabase.removeChannel(catalogChannel); if (commentChannel) await supabase.removeChannel(commentChannel); if (listenerChannel) await supabase.removeChannel(listenerChannel); if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null; };
  host.__rbPageCleanup = cleanup;

  await load(requestedTrack);
  if (!isCurrent()) return;
  const initial = requestedTrack ? tracks().find((row) => String(row.id) === String(requestedTrack)) : tracks()[0];
  if (initial) await openTrack(initial, false); else hero.innerHTML = '<div class="sound-empty">No music published yet.</div>';
}
