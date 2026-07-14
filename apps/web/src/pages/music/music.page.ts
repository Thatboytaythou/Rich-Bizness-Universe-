import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';
import '../../styles/music-universe-redesign.css';

type Row = Record<string, any>;
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const fmt = (n: any) => Number(n ?? 0).toLocaleString();
const safe = (v: any) => { try { const u = new URL(String(v || ''), location.origin); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace('/tap-in.html?next=%2Fmusic.html'); return; }

  const [{ data: profile }, { data: tracks, error }, { data: playlists }] = await Promise.all([
    supabase.from('profiles').select('id,username,display_name,avatar_url').eq('id', session.user.id).maybeSingle(),
    supabase.from('music_tracks').select('*').eq('is_published', true).eq('visibility', 'public').order('created_at', { ascending: false }).limit(100),
    supabase.from('playlists').select('id,title,track_count,visibility').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20)
  ]);
  if (error) throw error;

  const rows = (tracks ?? []) as Row[];
  let active: Row | null = rows[0] ?? null;
  let liked = false;
  let inRotation = false;
  let channel: any = null;

  root.innerHTML = `<main class="sound-universe"><div class="sound-wrap"><header class="sound-head"><a href="/portal.html">←</a><div class="sound-brand"><small>RICH BIZNESS ORIGINAL AUDIO</small><h1>MUSIC UNIVERSE</h1></div><nav class="sound-nav"><a class="active" href="/music.html">MUSIC</a><a href="/podcast.html">PODCAST</a><a href="/radio.html">RADIO</a></nav></header><section class="sound-hero"><article id="musicHero" class="sound-now"></article><aside class="sound-panel"><section class="sound-metrics"><article><small>TRACKS</small><strong>${fmt(rows.length)}</strong></article><article><small>PLAYLISTS</small><strong>${fmt((playlists ?? []).length)}</strong></article><article><small>TOTAL PLAYS</small><strong>${fmt(rows.reduce((n, x) => n + Number(x.play_count ?? 0), 0))}</strong></article><article><small>LIKES</small><strong>${fmt(rows.reduce((n, x) => n + Number(x.like_count ?? 0), 0))}</strong></article></section><div id="musicList" class="sound-list"></div></aside></section><section class="sound-lower"><article class="sound-panel"><h3>MY ROTATION</h3><div id="playlistList" class="sound-list">${(playlists ?? []).map((p: any) => `<article class="sound-card"><span class="sound-fallback">PL</span><span><b>${esc(p.title)}</b><small>${fmt(p.track_count)} tracks · ${esc(p.visibility)}</small></span><strong>›</strong></article>`).join('') || '<div class="sound-empty">Build your first rotation from any track.</div>'}</div></article><article class="sound-panel"><h3>LISTENER CONVERSATION</h3><div id="musicComments" class="sound-comments"></div><form id="musicCommentForm" class="sound-form"><input id="musicCommentInput" maxlength="2000" placeholder="Talk your talk..."><button class="sound-btn primary">POST</button></form></article></section><aside id="musicPlayer" class="sound-player" hidden><img id="musicPlayerCover" alt=""><div><strong id="musicPlayerTitle"></strong><small id="musicPlayerMeta"></small></div><audio id="musicAudio" controls preload="metadata"></audio></aside></div></main>`;

  const list = document.querySelector<HTMLElement>('#musicList')!;
  const hero = document.querySelector<HTMLElement>('#musicHero')!;
  const comments = document.querySelector<HTMLElement>('#musicComments')!;
  const player = document.querySelector<HTMLElement>('#musicPlayer')!;
  const audio = document.querySelector<HTMLAudioElement>('#musicAudio')!;

  const refreshState = async () => {
    liked = false; inRotation = false;
    if (!active) return;
    const [{ data: like }, { data: rotation }] = await Promise.all([
      supabase.from('music_likes').select('id').eq('user_id', session.user.id).eq('track_id', active.id).maybeSingle(),
      supabase.from('playlists').select('id').eq('user_id', session.user.id).eq('title', 'My Rotation').maybeSingle()
    ]);
    liked = !!like;
    if (rotation) {
      const { data } = await supabase.from('playlist_tracks').select('id').eq('playlist_id', rotation.id).eq('track_id', active.id).maybeSingle();
      inRotation = !!data;
    }
  };

  const loadComments = async () => {
    if (!active) { comments.innerHTML = '<div class="sound-empty">Select a track.</div>'; return; }
    const { data } = await supabase.from('music_comments').select('id,comment,display_name,username,created_at').eq('track_id', active.id).order('created_at', { ascending: false }).limit(80);
    comments.innerHTML = (data ?? []).map((c: any) => `<article class="sound-comment"><b>${esc(c.display_name || c.username || 'Rich Listener')}</b><p>${esc(c.comment)}</p></article>`).join('') || '<div class="sound-empty">Be the first to talk your talk.</div>';
  };

  const ensureRotation = async () => {
    let { data: rotation } = await supabase.from('playlists').select('id').eq('user_id', session.user.id).eq('title', 'My Rotation').maybeSingle();
    if (!rotation) {
      const created = await supabase.from('playlists').insert({ user_id: session.user.id, username: profile?.username ?? 'member', display_name: profile?.display_name ?? 'Rich Bizness Member', title: 'My Rotation', description: 'Saved from Rich Sound', visibility: 'private', track_count: 0, like_count: 0, play_count: 0, is_featured: false, metadata: { source: 'music-universe' } }).select('id').single();
      if (created.error) throw created.error;
      rotation = created.data;
    }
    return rotation;
  };

  const openTrack = async (track: Row) => {
    active = track;
    await refreshState();
    const cover = safe(track.cover_url) || '/images/brand/IMG_5997.png';
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="sound-copy"><span>RICH SOUND · ${esc(track.genre || 'MUSIC')}</span><h2>${esc(track.title || 'Untitled Track')}</h2><p>${esc(track.description || `${track.display_name || track.username || 'Rich Bizness Artist'} just dropped a new sound.`)}</p><div class="sound-actions"><button id="musicPlayBtn" class="sound-btn primary">▶ PLAY</button><button id="musicLikeBtn" class="sound-btn">${liked ? '♥ LIKED' : '♡ LIKE'}</button><button id="musicRotationBtn" class="sound-btn">${inRotation ? 'REMOVE FROM ROTATION' : 'ADD TO ROTATION'}</button><a class="sound-btn" href="/profile.html?id=${esc(track.artist_user_id || track.user_id)}">ARTIST PROFILE</a></div></div>`;
    player.hidden = false;
    document.querySelector<HTMLImageElement>('#musicPlayerCover')!.src = cover;
    document.querySelector<HTMLElement>('#musicPlayerTitle')!.textContent = track.title || 'Untitled Track';
    document.querySelector<HTMLElement>('#musicPlayerMeta')!.textContent = `${track.display_name || track.username || 'Rich Bizness Artist'} · ${track.genre || 'Music'}`;
    const src = safe(track.audio_url || track.file_url);
    audio.src = src;
    document.querySelector<HTMLButtonElement>('#musicPlayBtn')!.onclick = () => void audio.play();
    document.querySelector<HTMLButtonElement>('#musicLikeBtn')!.onclick = async () => {
      const result = liked ? await supabase.from('music_likes').delete().eq('user_id', session.user.id).eq('track_id', track.id) : await supabase.from('music_likes').insert({ user_id: session.user.id, track_id: track.id });
      if (!result.error) await openTrack(track);
    };
    document.querySelector<HTMLButtonElement>('#musicRotationBtn')!.onclick = async () => {
      const rotation = await ensureRotation();
      const result = inRotation ? await supabase.from('playlist_tracks').delete().eq('playlist_id', rotation.id).eq('track_id', track.id) : await supabase.from('playlist_tracks').upsert({ playlist_id: rotation.id, track_id: track.id, position: 0 }, { onConflict: 'playlist_id,track_id', ignoreDuplicates: true });
      if (!result.error) await openTrack(track);
    };
    list.querySelectorAll('.sound-card').forEach((node) => node.classList.toggle('active', (node as HTMLElement).dataset.id === String(track.id)));
    if (channel) await supabase.removeChannel(channel);
    await loadComments();
    channel = supabase.channel(`music-comments:${track.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'music_comments', filter: `track_id=eq.${track.id}` }, () => void loadComments()).subscribe();
    history.replaceState({}, '', `/music.html?id=${encodeURIComponent(track.id)}`);
  };

  list.innerHTML = rows.map((track) => `<button class="sound-card" data-id="${track.id}"><img src="${esc(safe(track.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(track.title || 'Untitled Track')}</b><small>${esc(track.display_name || track.username || 'Rich Bizness Artist')} · ${esc(track.genre || 'Music')}</small></span><strong>${fmt(track.play_count)} ▶</strong></button>`).join('') || '<div class="sound-empty">The Music Universe is ready for its first release.</div>';
  list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => { node.onclick = () => { const track = rows.find((x) => String(x.id) === node.dataset.id); if (track) void openTrack(track); }; });
  document.querySelector<HTMLFormElement>('#musicCommentForm')!.onsubmit = async (event) => {
    event.preventDefault();
    if (!active) return;
    const input = document.querySelector<HTMLInputElement>('#musicCommentInput')!;
    const comment = input.value.trim();
    if (!comment) return;
    const { error } = await supabase.from('music_comments').insert({ track_id: active.id, user_id: session.user.id, username: profile?.username ?? 'member', display_name: profile?.display_name ?? 'Rich Bizness Member', comment });
    if (!error) { input.value = ''; await loadComments(); }
  };
  audio.addEventListener('timeupdate', () => { if (!active || !Number.isFinite(audio.duration)) return; void supabase.from('audio_listening_history').upsert({ user_id: session.user.id, source_type: 'track', source_id: active.id, progress_seconds: Math.floor(audio.currentTime), completed: false, last_played_at: new Date().toISOString(), metadata: { title: active.title } }, { onConflict: 'user_id,source_type,source_id' }); });
  audio.addEventListener('ended', () => { if (!active) return; void supabase.from('audio_listening_history').upsert({ user_id: session.user.id, source_type: 'track', source_id: active.id, progress_seconds: Math.floor(audio.duration || 0), completed: true, last_played_at: new Date().toISOString(), metadata: { title: active.title } }, { onConflict: 'user_id,source_type,source_id' }); });
  const requested = new URLSearchParams(location.search).get('id');
  const initial = rows.find((x) => String(x.id) === requested) ?? rows[0];
  if (initial) await openTrack(initial); else hero.innerHTML = '<div class="sound-empty">No music releases yet.</div>';
  window.addEventListener('pagehide', () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (channel) void supabase.removeChannel(channel);
  }, { once: true });
}
