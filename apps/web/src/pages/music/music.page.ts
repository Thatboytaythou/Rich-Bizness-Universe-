import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';
import '../../styles/music-universe-redesign.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.mounted === 'music') return;
  root.dataset.mounted = 'music';

  const auth = getAuthSnapshot();
  const user = auth.user;
  const userId = user?.id ?? null;
  const profileResult = userId
    ? await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('id', userId).maybeSingle()
    : { data: null, error: null };
  const profile = profileResult.data;

  root.innerHTML = `<main class="sound-universe"><div class="sound-wrap">
    <header class="sound-head"><a href="/portal.html">←</a><div class="sound-brand"><small>RICH BIZNESS ORIGINAL AUDIO</small><h1>MUSIC UNIVERSE</h1></div><nav class="sound-nav"><a class="active" href="/music.html">MUSIC</a><a href="/podcast.html">PODCAST</a><a href="/radio.html">RADIO</a></nav></header>
    <section class="sound-hero"><article id="musicHero" class="sound-now"></article><aside class="sound-panel"><section id="musicMetrics" class="sound-metrics"></section><div id="musicList" class="sound-list"></div></aside></section>
    <section class="sound-lower"><article class="sound-panel"><h3>MY ROTATION</h3><div id="playlistList" class="sound-list"></div></article><article class="sound-panel"><h3>LISTENER CONVERSATION</h3><div id="musicComments" class="sound-comments"></div><form id="musicCommentForm" class="sound-form"><input id="musicCommentInput" maxlength="2000" placeholder="Talk your talk..."><button class="sound-btn primary">POST</button></form></article></section>
    <section class="sound-panel"><div class="sound-actions"><a class="sound-btn primary" href="/upload.html?route=music">DROP MUSIC</a><a class="sound-btn" href="/creator.html">CREATOR HUB</a><a class="sound-btn" href="/profile.html${userId ? `?id=${encodeURIComponent(userId)}` : ''}">PROFILE</a><a class="sound-btn" href="/watch.html?source=music">WATCH</a></div></section>
    <aside id="musicPlayer" class="sound-player" hidden><img id="musicPlayerCover" alt=""><div><strong id="musicPlayerTitle"></strong><small id="musicPlayerMeta"></small></div><audio id="musicAudio" controls preload="metadata"></audio></aside>
    <p id="musicStatus" class="sound-empty" role="status"></p>
  </div></main>`;

  const list = document.querySelector<HTMLElement>('#musicList')!;
  const hero = document.querySelector<HTMLElement>('#musicHero')!;
  const metrics = document.querySelector<HTMLElement>('#musicMetrics')!;
  const playlistList = document.querySelector<HTMLElement>('#playlistList')!;
  const comments = document.querySelector<HTMLElement>('#musicComments')!;
  const commentForm = document.querySelector<HTMLFormElement>('#musicCommentForm')!;
  const commentInput = document.querySelector<HTMLInputElement>('#musicCommentInput')!;
  const player = document.querySelector<HTMLElement>('#musicPlayer')!;
  const audio = document.querySelector<HTMLAudioElement>('#musicAudio')!;
  const status = document.querySelector<HTMLElement>('#musicStatus')!;

  let tracks: Row[] = [];
  let playlists: Row[] = [];
  let active: Row | null = null;
  let liked = false;
  let inRotation = false;
  let catalogChannel: Channel | null = null;
  let commentChannel: Channel | null = null;
  let catalogLoading = false;
  let catalogQueued = false;
  let commentsLoading = false;
  let commentsQueued = false;
  let destroyed = false;
  let lastHistoryWrite = 0;
  let commentSubmitting = false;

  const setStatus = (message: string, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
    window.setTimeout(() => { if (status.textContent === message) status.textContent = ''; }, 3200);
  };
  const requireUser = () => {
    if (userId) return true;
    location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  };

  const renderCatalog = () => {
    metrics.innerHTML = `<article><small>TRACKS</small><strong>${fmt(tracks.length)}</strong></article><article><small>PLAYLISTS</small><strong>${fmt(playlists.length)}</strong></article><article><small>TOTAL PLAYS</small><strong>${fmt(tracks.reduce((total, track) => total + Number(track.play_count ?? 0), 0))}</strong></article><article><small>LIKES</small><strong>${fmt(tracks.reduce((total, track) => total + Number(track.like_count ?? 0), 0))}</strong></article>`;
    list.innerHTML = tracks.map((track) => `<button class="sound-card ${active?.id === track.id ? 'active' : ''}" data-id="${esc(track.id)}"><img src="${esc(safeMedia(track.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(track.title || 'Untitled Track')}</b><small>${esc(track.display_name || track.username || 'Rich Bizness Artist')} · ${esc(track.genre || 'Music')}</small></span><strong>${fmt(track.play_count)} ▶</strong></button>`).join('') || '<div class="sound-empty">The Music Universe is ready for its first release.</div>';
    list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      node.onclick = () => { const track = tracks.find((row) => String(row.id) === node.dataset.id); if (track) void openTrack(track); };
    });
    playlistList.innerHTML = userId
      ? playlists.map((playlist) => `<article class="sound-card"><span class="sound-fallback">PL</span><span><b>${esc(playlist.title)}</b><small>${fmt(playlist.track_count)} tracks · ${esc(playlist.visibility)}</small></span><strong>›</strong></article>`).join('') || '<div class="sound-empty">Build your first rotation from any track.</div>'
      : '<div class="sound-empty">Tap In to build private rotations.</div>';
  };

  const loadCatalog = async () => {
    if (destroyed) return;
    if (catalogLoading) { catalogQueued = true; return; }
    catalogLoading = true;
    try {
      const [tracksResult, playlistsResult] = await Promise.all([
        supabase.from('music_tracks').select('*').eq('is_published', true).eq('visibility', 'public').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(100),
        userId ? supabase.from('playlists').select('id,title,track_count,visibility').eq('user_id', userId).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null })
      ]);
      if (tracksResult.error) throw tracksResult.error;
      if (playlistsResult.error) throw playlistsResult.error;
      tracks = (tracksResult.data ?? []) as Row[];
      playlists = (playlistsResult.data ?? []) as Row[];
      if (active) active = tracks.find((row) => row.id === active?.id) ?? active;
      renderCatalog();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Music catalog failed to load.', true);
    } finally {
      catalogLoading = false;
      if (catalogQueued) { catalogQueued = false; void loadCatalog(); }
    }
  };

  const refreshState = async () => {
    liked = false;
    inRotation = false;
    if (!active || !userId) return;
    const [{ data: like }, { data: rotation }] = await Promise.all([
      supabase.from('music_likes').select('id').eq('user_id', userId).eq('track_id', active.id).maybeSingle(),
      supabase.from('playlists').select('id').eq('user_id', userId).eq('title', 'My Rotation').maybeSingle()
    ]);
    liked = Boolean(like);
    if (rotation) {
      const { data } = await supabase.from('playlist_tracks').select('id').eq('playlist_id', rotation.id).eq('track_id', active.id).maybeSingle();
      inRotation = Boolean(data);
    }
  };

  const loadComments = async () => {
    if (destroyed || !active) { comments.innerHTML = '<div class="sound-empty">Select a track.</div>'; return; }
    if (commentsLoading) { commentsQueued = true; return; }
    commentsLoading = true;
    try {
      const { data, error } = await supabase.from('music_comments').select('id,comment,display_name,username,created_at').eq('track_id', active.id).order('created_at', { ascending: false }).limit(80);
      if (error) throw error;
      comments.innerHTML = (data ?? []).map((comment) => `<article class="sound-comment"><b>${esc(comment.display_name || comment.username || 'Rich Listener')}</b><p>${esc(comment.comment)}</p></article>`).join('') || '<div class="sound-empty">Be the first to talk your talk.</div>';
    } catch (error) {
      comments.innerHTML = '<div class="sound-empty">Conversation is temporarily unavailable.</div>';
      setStatus(error instanceof Error ? error.message : 'Comments failed to load.', true);
    } finally {
      commentsLoading = false;
      if (commentsQueued) { commentsQueued = false; void loadComments(); }
    }
  };

  const ensureRotation = async () => {
    if (!userId) throw new Error('Tap In to manage rotations.');
    let { data: rotation } = await supabase.from('playlists').select('id').eq('user_id', userId).eq('title', 'My Rotation').maybeSingle();
    if (!rotation) {
      const created = await supabase.from('playlists').insert({ user_id: userId, username: profile?.username ?? 'member', display_name: profile?.display_name ?? 'Rich Bizness Member', title: 'My Rotation', description: 'Saved from Rich Sound', visibility: 'private', track_count: 0, like_count: 0, play_count: 0, is_featured: false, metadata: { source: 'music-universe' } }).select('id').single();
      if (created.error) throw created.error;
      rotation = created.data;
    }
    return rotation;
  };

  const openTrack = async (track: Row) => {
    active = track;
    await refreshState();
    const cover = safeMedia(track.cover_url) || '/images/brand/IMG_5997.png';
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="sound-copy"><span>RICH SOUND · ${esc(track.genre || 'MUSIC')}</span><h2>${esc(track.title || 'Untitled Track')}</h2><p>${esc(track.description || `${track.display_name || track.username || 'Rich Bizness Artist'} just dropped a new sound.`)}</p><div class="sound-actions"><button id="musicPlayBtn" class="sound-btn primary">▶ PLAY</button><button id="musicLikeBtn" class="sound-btn">${liked ? '♥ LIKED' : '♡ LIKE'}</button><button id="musicRotationBtn" class="sound-btn">${inRotation ? 'REMOVE FROM ROTATION' : 'ADD TO ROTATION'}</button><a class="sound-btn" href="/profile.html?id=${encodeURIComponent(track.artist_user_id || track.user_id || '')}">ARTIST PROFILE</a></div></div>`;
    player.hidden = false;
    document.querySelector<HTMLImageElement>('#musicPlayerCover')!.src = cover;
    document.querySelector<HTMLElement>('#musicPlayerTitle')!.textContent = track.title || 'Untitled Track';
    document.querySelector<HTMLElement>('#musicPlayerMeta')!.textContent = `${track.display_name || track.username || 'Rich Bizness Artist'} · ${track.genre || 'Music'}`;
    audio.src = safeMedia(track.audio_url || track.file_url);
    document.querySelector<HTMLButtonElement>('#musicPlayBtn')!.onclick = () => void audio.play().catch(() => setStatus('Playback could not start.', true));
    document.querySelector<HTMLButtonElement>('#musicLikeBtn')!.onclick = async () => {
      if (!requireUser() || !userId) return;
      const result = liked ? await supabase.from('music_likes').delete().eq('user_id', userId).eq('track_id', track.id) : await supabase.from('music_likes').insert({ user_id: userId, track_id: track.id });
      if (result.error) return setStatus(result.error.message, true);
      await openTrack(track);
      void loadCatalog();
    };
    document.querySelector<HTMLButtonElement>('#musicRotationBtn')!.onclick = async () => {
      if (!requireUser()) return;
      try {
        const rotation = await ensureRotation();
        const result = inRotation ? await supabase.from('playlist_tracks').delete().eq('playlist_id', rotation.id).eq('track_id', track.id) : await supabase.from('playlist_tracks').upsert({ playlist_id: rotation.id, track_id: track.id, position: 0 }, { onConflict: 'playlist_id,track_id', ignoreDuplicates: true });
        if (result.error) throw result.error;
        await openTrack(track);
        void loadCatalog();
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Rotation update failed.', true); }
    };
    renderCatalog();
    if (commentChannel) await supabase.removeChannel(commentChannel);
    await loadComments();
    commentChannel = supabase.channel(`music-comments:${track.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'music_comments', filter: `track_id=eq.${track.id}` }, () => void loadComments()).subscribe();
    history.replaceState({}, '', `/music.html?id=${encodeURIComponent(track.id)}`);
  };

  commentForm.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || !requireUser() || !userId || commentSubmitting) return;
    const comment = commentInput.value.trim();
    if (!comment) return;
    commentSubmitting = true;
    const button = commentForm.querySelector<HTMLButtonElement>('button')!;
    button.disabled = true;
    try {
      const { error } = await supabase.from('music_comments').insert({ track_id: active.id, user_id: userId, username: profile?.username ?? 'member', display_name: profile?.display_name ?? 'Rich Bizness Member', comment });
      if (error) throw error;
      commentInput.value = '';
      await loadComments();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Comment failed.', true); }
    finally { commentSubmitting = false; button.disabled = false; }
  };

  const writeHistory = async (completed: boolean) => {
    if (!userId || !active) return;
    await supabase.from('audio_listening_history').upsert({ user_id: userId, source_type: 'track', source_id: active.id, progress_seconds: Math.floor(completed ? audio.duration || 0 : audio.currentTime), completed, last_played_at: new Date().toISOString(), metadata: { title: active.title } }, { onConflict: 'user_id,source_type,source_id' });
  };
  const onTimeUpdate = () => {
    if (!userId || !active || !Number.isFinite(audio.duration)) return;
    const now = Date.now();
    if (now - lastHistoryWrite < 15000) return;
    lastHistoryWrite = now;
    void writeHistory(false);
  };
  const onEnded = () => void writeHistory(true);
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);

  await loadCatalog();
  const requested = new URLSearchParams(location.search).get('id');
  const initial = tracks.find((row) => String(row.id) === requested) ?? tracks[0];
  if (initial) await openTrack(initial); else hero.innerHTML = '<div class="sound-empty">No music releases yet.</div>';

  catalogChannel = supabase.channel('music-catalog').on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, () => void loadCatalog()).on('postgres_changes', { event: '*', schema: 'public', table: 'music_likes' }, () => void loadCatalog()).on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, () => void loadCatalog()).on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_tracks' }, () => void loadCatalog()).subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    audio.pause();
    audio.removeEventListener('timeupdate', onTimeUpdate);
    audio.removeEventListener('ended', onEnded);
    audio.removeAttribute('src');
    audio.load();
    if (catalogChannel) void supabase.removeChannel(catalogChannel);
    if (commentChannel) void supabase.removeChannel(commentChannel);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
