import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';

type Row = Record<string, any>;
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const fmt = (n: any) => Number(n ?? 0).toLocaleString();
const duration = (n: any) => n ? `${Math.floor(Number(n) / 60)}:${String(Number(n) % 60).padStart(2, '0')}` : 'LIVE';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace('/tap-in.html?next=%2Fpodcast.html'); return; }

  const { data, error } = await supabase.rpc('rb_live_watch_podcast_snapshot', {});
  if (error) throw error;
  const snap = (data ?? {}) as Row;
  const shows = (snap.podcast_shows ?? []) as Row[];
  const episodes = (snap.podcast_episodes ?? []) as Row[];
  const liked = new Set(((snap.podcast_likes ?? []) as Row[]).map((x) => String(x.episode_id)));
  let active = episodes[0] ?? null;
  let showId: any = active?.show_id ?? shows[0]?.id ?? 'all';
  let channel: any = null;

  root.innerHTML = `<main class="media-ultimate"><div class="media-ultimate__wrap"><header class="media-ultimate__head"><a href="/music.html">←</a><div><p>RICH BIZNESS ORIGINAL AUDIO</p><h1>PODCAST UNIVERSE</h1></div><nav class="media-ultimate__tabs"><a href="/music.html">MUSIC</a><a class="active" href="/podcast.html">PODCAST</a><a href="/radio.html">RADIO</a></nav></header><section class="podcast-stage"><article id="podcastCover" class="podcast-cover">${active ? cover(active) : '<div class="media-ultimate__empty">No podcast episode released.</div>'}</article><aside class="podcast-queue"><section class="media-ultimate__metrics"><article><small>SHOWS</small><strong>${shows.length}</strong></article><article><small>EPISODES</small><strong>${episodes.length}</strong></article><article><small>TOTAL PLAYS</small><strong>${fmt(episodes.reduce((n, e) => n + Number(e.play_count ?? 0), 0))}</strong></article><article><small>COMMUNITY</small><strong>${fmt(episodes.reduce((n, e) => n + Number(e.comment_count ?? 0), 0))}</strong></article></section><nav class="media-ultimate__tabs" id="showTabs"><button class="active" data-show="all">ALL SHOWS</button>${shows.map((s) => `<button data-show="${s.id}">${esc(s.title)}</button>`).join('')}</nav><div id="episodeQueue"></div></aside></section><section class="media-ultimate__split"><article class="media-ultimate__panel"><header><h4>EPISODE NOTES & PERFORMANCE</h4></header><div id="episodeDetail" class="media-ultimate__list"></div></article><article class="media-ultimate__panel"><header><h4>LISTENER CONVERSATION</h4></header><div id="podcastComments" class="media-ultimate__chat"></div><form id="podcastCommentForm" class="media-ultimate__form"><input id="podcastCommentInput" maxlength="2000" placeholder="Join the episode discussion..."><button class="media-ultimate__btn primary">POST</button></form></article></section><aside class="universe-player" id="podcastPlayer" hidden><img id="podcastPlayerCover" alt=""><div><h3 id="podcastPlayerTitle"></h3><p id="podcastPlayerMeta"></p></div><audio id="podcastAudio" controls preload="metadata"></audio></aside></div></main>`;

  const queue = document.querySelector<HTMLElement>('#episodeQueue')!;
  const detail = document.querySelector<HTMLElement>('#episodeDetail')!;
  const comments = document.querySelector<HTMLElement>('#podcastComments')!;
  const audio = document.querySelector<HTMLAudioElement>('#podcastAudio')!;
  const player = document.querySelector<HTMLElement>('#podcastPlayer')!;
  const visible = () => showId && showId !== 'all' ? episodes.filter((e) => String(e.show_id) === String(showId)) : episodes;

  const loadComments = async () => {
    if (!active) return;
    const { data } = await supabase.from('podcast_comments').select('id,body,display_name,username,created_at').eq('episode_id', active.id).order('created_at', { ascending: true }).limit(100);
    comments.innerHTML = (data ?? []).map((c: any) => `<article><p>${esc(c.body)}</p><small>${esc(c.display_name || c.username || 'Rich Listener')}</small></article>`).join('') || '<div class="media-ultimate__empty">Start the discussion.</div>';
  };

  const openEpisode = async (episode: Row) => {
    active = episode;
    document.querySelector<HTMLElement>('#podcastCover')!.innerHTML = cover(episode);
    detail.innerHTML = [['Show', `${episode.show_title || 'Rich Original'} · ${episode.show_category || 'Podcast'}`], ['Episode', `Season ${episode.season_number ?? 1} · Episode ${episode.episode_number ?? '—'} · ${duration(episode.duration_seconds)}`], ['Audience', `${fmt(episode.play_count)} plays · ${fmt(episode.like_count)} likes · ${fmt(episode.comment_count)} comments`], ['Content', `${episode.is_explicit ? 'Explicit' : 'Clean'} · ${episode.is_featured ? 'Featured' : 'Original'}`]].map(([a, b]) => `<div class="media-ultimate__row"><div><h5>${a}</h5><p>${esc(b)}</p></div></div>`).join('');
    const src = episode.audio_url || episode.file_url;
    if (src) {
      player.hidden = false;
      document.querySelector<HTMLImageElement>('#podcastPlayerCover')!.src = episode.cover_url || episode.show_cover_url || '/images/brand/IMG_5997.png';
      document.querySelector<HTMLElement>('#podcastPlayerTitle')!.textContent = episode.title || 'Rich Podcast';
      document.querySelector<HTMLElement>('#podcastPlayerMeta')!.textContent = episode.show_title || episode.display_name || 'Rich Original';
      audio.src = src;
    }
    if (channel) await supabase.removeChannel(channel);
    await loadComments();
    channel = supabase.channel(`podcast-comments:${episode.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_comments', filter: `episode_id=eq.${episode.id}` }, () => void loadComments()).subscribe();
    document.querySelector<HTMLButtonElement>('#podcastPlayBtn')?.addEventListener('click', () => void audio.play());
    document.querySelector<HTMLButtonElement>('#podcastLikeBtn')?.addEventListener('click', async () => {
      if (liked.has(String(episode.id))) {
        await supabase.from('podcast_likes').delete().eq('user_id', session.user.id).eq('episode_id', episode.id);
        liked.delete(String(episode.id));
      } else {
        await supabase.from('podcast_likes').insert({ user_id: session.user.id, episode_id: episode.id });
        liked.add(String(episode.id));
      }
      await openEpisode(episode);
    });
  };

  const renderQueue = () => {
    queue.innerHTML = visible().map((e) => `<article class="podcast-episode" data-id="${e.id}"><img src="${esc(e.cover_url || e.show_cover_url || '/images/brand/IMG_5997.png')}" alt=""><div><h4>${esc(e.title || 'Rich Podcast')}</h4><p>${esc(e.show_title || e.display_name || 'Rich Original')} · S${e.season_number ?? 1} E${e.episode_number ?? '—'} · ${duration(e.duration_seconds)}</p></div><strong>${fmt(e.play_count)} ▶</strong></article>`).join('') || '<div class="media-ultimate__empty">No episodes in this show.</div>';
    queue.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => { el.onclick = () => { const episode = episodes.find((x) => String(x.id) === el.dataset.id); if (episode) void openEpisode(episode); }; });
  };

  document.querySelectorAll<HTMLButtonElement>('[data-show]').forEach((button) => { button.onclick = () => { showId = button.dataset.show!; document.querySelectorAll('[data-show]').forEach((x) => x.classList.toggle('active', x === button)); renderQueue(); const first = visible()[0]; if (first) void openEpisode(first); }; });
  document.querySelector<HTMLFormElement>('#podcastCommentForm')!.onsubmit = async (event) => {
    event.preventDefault();
    if (!active) return;
    const input = document.querySelector<HTMLInputElement>('#podcastCommentInput')!;
    const body = input.value.trim();
    if (!body) return;
    const profile = snap.profile ?? {};
    const { error } = await supabase.from('podcast_comments').insert({ episode_id: active.id, user_id: session.user.id, body, username: profile.username, display_name: profile.display_name });
    if (!error) { input.value = ''; await loadComments(); }
  };
  audio.addEventListener('ended', async () => { if (active) await supabase.from('audio_listening_history').upsert({ user_id: session.user.id, source_type: 'podcast', source_id: active.id, progress_seconds: Math.floor(audio.duration || 0), completed: true, last_played_at: new Date().toISOString(), metadata: { duration_seconds: Math.floor(audio.duration || 0) } }, { onConflict: 'user_id,source_type,source_id' }); });
  renderQueue();
  if (active) await openEpisode(active);
}

function cover(e: Row) {
  return `<img src="${esc(e.cover_url || e.show_cover_url || '/images/brand/IMG_5997.png')}" alt=""><div class="podcast-cover__copy"><span class="media-ultimate__eyebrow">RICH ORIGINAL · ${esc(e.show_category || 'PODCAST')}</span><h2>${esc(e.title || 'Rich Podcast')}</h2><p>${esc(e.description || 'Long-form conversation, culture and creator stories from the Rich Bizness universe.')}</p><div class="media-ultimate__actions"><button id="podcastPlayBtn" class="media-ultimate__btn primary">▶ PLAY EPISODE</button><button id="podcastLikeBtn" class="media-ultimate__btn">♡ LIKE</button><a class="media-ultimate__btn" href="/profile.html?id=${esc(e.creator_id || e.user_id)}">HOST PROFILE</a></div></div>`;
}