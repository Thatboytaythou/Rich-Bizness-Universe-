import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';
import '../../styles/music-universe-redesign.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;
type Snapshot = { tracks?: Row[]; playlists?: Row[]; active_state?: { liked?: boolean; in_rotation?: boolean }; comments?: Row[]; metrics?: Row };

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.musicOwner === 'mounted') return;
  root.dataset.musicOwner = 'mounted';

  const user = getAuthSnapshot().user;
  const userId = user?.id ?? null;

  root.innerHTML = `<main class="sound-universe music-command"><div class="sound-wrap">
    <header class="sound-head"><a href="/portal.html" aria-label="Back to portal">←</a><div class="sound-brand"><small>RICH BIZNESS ORIGINAL AUDIO</small><h1>MUSIC UNIVERSE</h1></div><nav class="sound-nav" aria-label="Rich Sound sections"><a class="active" href="/music.html">MUSIC</a><a href="/radio.html">RADIO</a><a href="/podcast.html">PODCAST</a></nav></header>
    <section class="music-signal"><span>LOSSLESS AUDIO</span><i></i><span>REALTIME CATALOG</span><i></i><span>CREATOR OWNED</span></section>
    <section class="sound-hero"><article id="musicHero" class="sound-now"></article><aside class="sound-panel music-catalog-panel"><section id="musicMetrics" class="sound-metrics"></section><div class="music-catalog-head"><div><small>GLOBAL ROTATION</small><h2>Fresh releases</h2></div><span id="catalogCount">0 TRACKS</span></div><div id="musicList" class="sound-list"></div></aside></section>
    <section class="sound-lower"><article class="sound-panel"><div class="music-panel-title"><div><small>PRIVATE AUDIO</small><h3>MY ROTATION</h3></div><span>SYNCED</span></div><div id="playlistList" class="sound-list"></div></article><article class="sound-panel"><div class="music-panel-title"><div><small>LISTENER NETWORK</small><h3>CONVERSATION</h3></div><span>LIVE</span></div><div id="musicComments" class="sound-comments"></div><form id="musicCommentForm" class="sound-form"><input id="musicCommentInput" maxlength="2000" placeholder="Talk your talk..." autocomplete="off"><button class="sound-btn primary">POST</button></form></article></section>
    <section class="sound-panel music-launchpad"><div><small>CREATOR AUDIO COMMAND</small><h2>Drop sound. Build rotation. Own the signal.</h2></div><div class="sound-actions"><a class="sound-btn primary" href="/upload.html?route=music">DROP MUSIC</a><a class="sound-btn" href="/creator.html">CREATOR HUB</a><a class="sound-btn" href="/profile.html${userId ? `?id=${encodeURIComponent(userId)}` : ''}">PROFILE</a><a class="sound-btn" href="/watch.html?source=music">WATCH</a></div></section>
    <aside id="musicPlayer" class="sound-player" hidden><img id="musicPlayerCover" alt=""><div><strong id="musicPlayerTitle"></strong><small id="musicPlayerMeta"></small></div><audio id="musicAudio" controls preload="metadata"></audio></aside>
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
  let loading = false;
  let queued = false;
  let destroyed = false;
  let refreshTimer: number | undefined;
  let lastHistoryWrite = 0;
  let countedTrack: string | null = null;

  const setStatus = (message: string, error = false) => { status.textContent = message; status.dataset.error = String(error); window.setTimeout(() => { if (status.textContent === message) status.textContent = ''; }, 3200); };
  const requireUser = () => { if (userId) return true; location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`); return false; };
  const action = async (name: string, payload: Row) => { const { data, error } = await supabase.rpc('rb_music_action', { p_action: name, p_payload: payload }); if (error) throw error; return data as Row; };

  const renderCatalog = () => {
    const tracks = snapshot.tracks ?? [];
    const playlists = snapshot.playlists ?? [];
    const m = snapshot.metrics ?? {};
    metrics.innerHTML = `<article><small>TRACKS</small><strong>${fmt(m.tracks ?? tracks.length)}</strong></article><article><small>PLAYLISTS</small><strong>${fmt(playlists.length)}</strong></article><article><small>TOTAL PLAYS</small><strong>${fmt(m.total_plays)}</strong></article><article><small>LIKES</small><strong>${fmt(m.likes)}</strong></article>`;
    q<HTMLElement>('#catalogCount').textContent = `${fmt(tracks.length)} TRACKS`;
    list.innerHTML = tracks.map((track, index) => `<button class="sound-card ${active?.id === track.id ? 'active' : ''}" data-id="${esc(track.id)}"><span class="music-track-index">${String(index + 1).padStart(2, '0')}</span><img src="${esc(safeMedia(track.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(track.title || 'Untitled Track')}</b><small>${esc(track.display_name || track.username || 'Rich Bizness Artist')} · ${esc(track.genre || 'Music')}</small></span><strong>${fmt(track.play_count)} ▶</strong></button>`).join('') || '<div class="sound-empty">The Music Universe is ready for its first audio release.</div>';
    list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => { node.onclick = () => { const track = tracks.find((row) => String(row.id) === node.dataset.id); if (track) void openTrack(track); }; });
    playlistList.innerHTML = userId ? playlists.map((playlist) => `<article class="sound-card rotation-card"><span class="sound-fallback">PL</span><span><b>${esc(playlist.title)}</b><small>${fmt(playlist.track_count)} tracks · ${esc(playlist.visibility)}</small></span><strong>›</strong></article>`).join('') || '<div class="sound-empty">Build your first private rotation from any track.</div>' : '<div class="sound-empty">Tap In to build private rotations.</div>';
  };

  const renderComments = () => {
    comments.innerHTML = (snapshot.comments ?? []).map((comment) => `<article class="sound-comment"><b>${esc(comment.display_name || comment.username || 'Rich Listener')}</b><p>${esc(comment.comment)}</p></article>`).join('') || '<div class="sound-empty">Be the first to talk your talk.</div>';
  };

  const load = async (trackId: string | null = active?.id ?? null) => {
    if (destroyed) return;
    if (loading) { queued = true; return; }
    loading = true;
    try {
      const { data, error } = await supabase.rpc('rb_music_snapshot', { p_track_id: trackId, p_limit: 120 });
      if (error) throw error;
      snapshot = (data ?? {}) as Snapshot;
      if (active) active = (snapshot.tracks ?? []).find((row) => row.id === active?.id) ?? active;
      renderCatalog();
      renderComments();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Music sync failed.', true); }
    finally { loading = false; if (queued && !destroyed) { queued = false; void load(); } }
  };

  const openTrack = async (track: Row) => {
    active = track;
    await load(track.id);
    const state = snapshot.active_state ?? {};
    const cover = safeMedia(track.cover_url) || '/images/brand/IMG_5997.png';
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="music-visualizer" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--bar:${index}"></i>`).join('')}</div><div class="sound-copy"><span>RICH SOUND · ${esc(track.genre || 'MUSIC')}</span><h2>${esc(track.title || 'Untitled Track')}</h2><p>${esc(track.description || `${track.display_name || track.username || 'Rich Bizness Artist'} just dropped a new sound.`)}</p><div class="sound-actions"><button id="musicPlayBtn" class="sound-btn primary">▶ PLAY</button><button id="musicLikeBtn" class="sound-btn">${state.liked ? '♥ LIKED' : '♡ LIKE'}</button><button id="musicRotationBtn" class="sound-btn">${state.in_rotation ? 'REMOVE FROM ROTATION' : 'ADD TO ROTATION'}</button><a class="sound-btn" href="/profile.html?id=${encodeURIComponent(track.artist_user_id || track.user_id || '')}">ARTIST PROFILE</a></div></div>`;
    player.hidden = false;
    q<HTMLImageElement>('#musicPlayerCover').src = cover;
    q<HTMLElement>('#musicPlayerTitle').textContent = track.title || 'Untitled Track';
    q<HTMLElement>('#musicPlayerMeta').textContent = `${track.display_name || track.username || 'Rich Bizness Artist'} · ${track.genre || 'Music'}`;
    audio.src = safeMedia(track.audio_url || track.file_url);
    q<HTMLButtonElement>('#musicPlayBtn').onclick = async () => { try { await audio.play(); if (userId && countedTrack !== String(track.id)) { countedTrack = String(track.id); await action('history', { track_id: track.id, progress_seconds: 0, completed: false, count_play: true, title: track.title }); void load(track.id); } } catch { setStatus('Playback could not start.', true); } };
    q<HTMLButtonElement>('#musicLikeBtn').onclick = async () => { if (!requireUser()) return; try { await action('toggle_like', { track_id: track.id }); await openTrack(track); } catch (error) { setStatus(error instanceof Error ? error.message : 'Like failed.', true); } };
    q<HTMLButtonElement>('#musicRotationBtn').onclick = async () => { if (!requireUser()) return; try { await action('toggle_rotation', { track_id: track.id }); await openTrack(track); } catch (error) { setStatus(error instanceof Error ? error.message : 'Rotation update failed.', true); } };
    history.replaceState({}, '', `/music.html?id=${encodeURIComponent(track.id)}`);
    if (commentChannel) await supabase.removeChannel(commentChannel);
    commentChannel = supabase.channel(`music-comments:${track.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'music_comments', filter: `track_id=eq.${track.id}` }, () => scheduleLoad()).subscribe();
  };

  commentForm.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || !requireUser()) return;
    const value = commentInput.value.trim();
    if (!value) return;
    const button = commentForm.querySelector<HTMLButtonElement>('button')!;
    button.disabled = true;
    try { await action('comment', { track_id: active.id, comment: value }); commentInput.value = ''; await load(active.id); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Comment failed.', true); }
    finally { button.disabled = false; }
  };

  const writeHistory = async (completed: boolean) => { if (!userId || !active) return; try { await action('history', { track_id: active.id, progress_seconds: Math.floor(completed ? audio.duration || 0 : audio.currentTime), completed, count_play: false, title: active.title }); } catch { /* passive history must not interrupt playback */ } };
  const onTimeUpdate = () => { if (!userId || !active || !Number.isFinite(audio.duration)) return; const now = Date.now(); if (now - lastHistoryWrite < 15000) return; lastHistoryWrite = now; void writeHistory(false); };
  const onEnded = () => void writeHistory(true);
  const scheduleLoad = () => { window.clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => void load(), 180); };
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);

  await load(null);
  const requested = new URLSearchParams(location.search).get('id');
  const initial = (snapshot.tracks ?? []).find((row) => String(row.id) === requested) ?? snapshot.tracks?.[0];
  if (initial) await openTrack(initial); else hero.innerHTML = '<div class="sound-empty">No music releases yet.</div>';

  catalogChannel = supabase.channel('music-catalog').on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, scheduleLoad).subscribe();
  const cleanup = () => { if (destroyed) return; destroyed = true; window.clearTimeout(refreshTimer); audio.pause(); audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded); audio.removeAttribute('src'); audio.load(); if (catalogChannel) void supabase.removeChannel(catalogChannel); if (commentChannel) void supabase.removeChannel(commentChannel); };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
