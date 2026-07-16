import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';
import '../../styles/radio-universe.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.mounted === 'radio') return;
  root.dataset.mounted = 'radio';

  const auth = getAuthSnapshot();
  const user = auth.user;
  const userId = user?.id ?? null;

  root.innerHTML = `<main class="sound-universe radio-universe"><div class="sound-wrap">
    <header class="sound-head"><a href="/portal.html">←</a><div class="sound-brand"><small>RICH BIZNESS LIVE AUDIO</small><h1>RADIO UNIVERSE</h1></div><nav class="sound-nav"><a href="/music.html">MUSIC</a><a href="/podcast.html">PODCAST</a><a class="active" href="/radio.html">RADIO</a></nav></header>
    <section class="sound-hero"><article id="radioHero" class="sound-now"></article><aside class="sound-panel"><section id="radioMetrics" class="sound-metrics"></section><div id="radioList" class="sound-list"></div></aside></section>
    <section class="sound-lower"><article class="sound-panel"><h3>ON AIR NETWORK</h3><div class="radio-network-copy"><p>Continuous Rich Bizness radio, creator takeovers, interviews, DJ sets and live community broadcasts connected to every Rich ID.</p><div class="radio-network-badges"><span>24/7 SIGNAL</span><span>CREATOR TAKEOVERS</span><span>LIVE DJ SETS</span><span>GLOBAL AUDIO</span></div><div class="sound-actions"><a class="sound-btn primary" href="/upload.html?route=radio">BUILD STATION</a><a class="sound-btn" href="/creator.html">CREATOR HUB</a><a class="sound-btn" href="/live.html?category=radio">GO LIVE</a><a class="sound-btn" href="/profile.html${userId ? `?id=${encodeURIComponent(userId)}` : ''}">PROFILE</a></div></div></article><article class="sound-panel"><h3>STATION STATUS</h3><div id="radioStatus" class="sound-empty">Select a station to connect.</div></article></section>
    <aside id="radioPlayer" class="sound-player" hidden><img id="radioPlayerCover" alt=""><div><strong id="radioPlayerTitle"></strong><small id="radioPlayerMeta"></small></div><audio id="radioAudio" controls preload="none"></audio></aside>
    <p id="radioMessage" class="sound-empty" role="status"></p>
  </div></main>`;

  const list = document.querySelector<HTMLElement>('#radioList')!;
  const hero = document.querySelector<HTMLElement>('#radioHero')!;
  const metrics = document.querySelector<HTMLElement>('#radioMetrics')!;
  const status = document.querySelector<HTMLElement>('#radioStatus')!;
  const message = document.querySelector<HTMLElement>('#radioMessage')!;
  const player = document.querySelector<HTMLElement>('#radioPlayer')!;
  const audio = document.querySelector<HTMLAudioElement>('#radioAudio')!;

  let stations: Row[] = [];
  let active: Row | null = null;
  let liked = false;
  let stationChannel: Channel | null = null;
  let sessionId: string | null = null;
  let sessionStartedAt = 0;
  let loadingStations = false;
  let stationsQueued = false;
  let disposed = false;

  const setMessage = (text: string, error = false) => {
    message.textContent = text;
    message.dataset.error = String(error);
    window.setTimeout(() => { if (message.textContent === text) message.textContent = ''; }, 3200);
  };

  const requireUser = (): string | null => {
    if (userId) return userId;
    location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return null;
  };

  const renderMetrics = () => {
    metrics.innerHTML = `<article><small>STATIONS</small><strong>${fmt(stations.length)}</strong></article><article><small>LIVE NOW</small><strong>${fmt(stations.filter((station) => station.is_live).length)}</strong></article><article><small>LISTENERS</small><strong>${fmt(stations.reduce((sum, station) => sum + Number(station.listener_count ?? 0), 0))}</strong></article><article><small>LIKES</small><strong>${fmt(stations.reduce((sum, station) => sum + Number(station.like_count ?? 0), 0))}</strong></article>`;
  };

  const refreshLike = async () => {
    liked = false;
    if (!active || !userId) return;
    const { data } = await supabase.from('radio_likes').select('id').eq('user_id', userId).eq('station_id', active.id).maybeSingle();
    liked = Boolean(data);
  };

  const renderList = () => {
    list.innerHTML = stations.map((station) => `<button class="sound-card ${active && String(active.id) === String(station.id) ? 'active' : ''}" data-id="${esc(station.id)}"><img src="${esc(safeMedia(station.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(station.station_name || station.title || 'Rich Radio')}</b><small>${station.is_live ? '● LIVE' : 'RADIO'} · ${esc(station.station_tag || station.genre || 'Global')}</small></span><strong>${fmt(station.listener_count)} ◉</strong></button>`).join('') || '<div class="sound-empty">The Radio Universe is ready for its first station.</div>';
    list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      node.onclick = () => {
        const station = stations.find((item) => String(item.id) === node.dataset.id);
        if (station) void openStation(station);
      };
    });
  };

  const closeListeningSession = async () => {
    if (!sessionId) return;
    const currentId = sessionId;
    sessionId = null;
    const listenSeconds = Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000));
    await supabase.from('radio_sessions').update({ left_at: new Date().toISOString(), listen_seconds: listenSeconds }).eq('id', currentId);
  };

  const startListeningSession = async () => {
    if (!active || sessionId) return;
    const payload = {
      station_id: active.id,
      user_id: userId,
      anonymous_id: userId ? null : crypto.randomUUID(),
      joined_at: new Date().toISOString(),
      device_info: { userAgent: navigator.userAgent, language: navigator.language },
      metadata: { source: 'radio-universe', station_name: active.station_name || active.title || 'Rich Radio' }
    };
    const { data, error } = await supabase.from('radio_sessions').insert(payload).select('id').single();
    if (!error && data) {
      sessionId = data.id;
      sessionStartedAt = Date.now();
    }
  };

  const openStation = async (station: Row) => {
    if (active && String(active.id) !== String(station.id)) {
      audio.pause();
      await closeListeningSession();
    }
    active = station;
    await refreshLike();
    const cover = safeMedia(station.cover_url) || '/images/brand/IMG_5997.png';
    const source = safeMedia(station.stream_url || station.audio_url);
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="sound-copy"><span>${station.is_live ? '● LIVE NOW' : 'RICH RADIO'} · ${esc(station.station_tag || station.genre || 'GLOBAL')}</span><h2>${esc(station.station_name || station.title || 'Rich Radio')}</h2><p>${esc(station.description || 'Streaming the Rich Bizness universe live and worldwide.')}</p><div class="sound-actions"><button id="radioPlayBtn" class="sound-btn primary" ${source ? '' : 'disabled'}>▶ LISTEN LIVE</button><button id="radioLikeBtn" class="sound-btn">${liked ? '♥ LIKED' : '♡ LIKE'}</button><a class="sound-btn" href="/profile.html?id=${encodeURIComponent(String(station.creator_id || station.user_id || ''))}">STATION PROFILE</a><a class="sound-btn" href="/music.html">MUSIC</a><a class="sound-btn" href="/podcast.html">PODCAST</a></div></div>`;
    player.hidden = false;
    document.querySelector<HTMLImageElement>('#radioPlayerCover')!.src = cover;
    document.querySelector<HTMLElement>('#radioPlayerTitle')!.textContent = station.station_name || station.title || 'Rich Radio';
    document.querySelector<HTMLElement>('#radioPlayerMeta')!.textContent = `${station.is_live ? 'LIVE' : 'RADIO'} · ${station.station_tag || station.genre || 'Rich Bizness'}`;
    audio.src = source;
    status.innerHTML = source ? `<strong>${station.is_live ? 'LIVE SIGNAL' : 'STREAM READY'}</strong><br>${fmt(station.listener_count)} listeners · ${fmt(station.peak_listeners)} peak · ${esc(station.mood || station.genre || 'Global audio')}` : 'STREAM URL NOT AVAILABLE';
    document.querySelector<HTMLButtonElement>('#radioPlayBtn')!.onclick = async () => {
      try {
        await audio.play();
        await startListeningSession();
      } catch {
        setMessage('The station signal could not start on this device.', true);
      }
    };
    document.querySelector<HTMLButtonElement>('#radioLikeBtn')!.onclick = async () => {
      const id = requireUser();
      if (!id) return;
      const result = liked
        ? await supabase.from('radio_likes').delete().eq('user_id', id).eq('station_id', station.id)
        : await supabase.from('radio_likes').upsert({ user_id: id, station_id: station.id }, { onConflict: 'user_id,station_id', ignoreDuplicates: true });
      if (result.error) return setMessage(result.error.message, true);
      await refreshLike();
      await renderActive();
    };
    renderList();
    history.replaceState({}, '', `/radio.html?id=${encodeURIComponent(station.id)}`);
  };

  const renderActive = async () => {
    if (!active) return;
    const current = stations.find((station) => String(station.id) === String(active?.id)) ?? active;
    await openStation(current);
  };

  const loadStations = async () => {
    if (loadingStations) { stationsQueued = true; return; }
    loadingStations = true;
    try {
      const { data, error } = await supabase.from('radio_stations').select('*').eq('is_public', true).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(100);
      if (error) return setMessage(error.message, true);
      stations = (data ?? []) as Row[];
      renderMetrics();
      const requested = new URLSearchParams(location.search).get('id');
      const current = active ? stations.find((station) => String(station.id) === String(active?.id)) : null;
      active = current ?? stations.find((station) => String(station.id) === requested) ?? stations[0] ?? null;
      renderList();
      if (active) await renderActive(); else hero.innerHTML = '<div class="sound-empty">No radio stations are public yet.</div>';
    } finally {
      loadingStations = false;
      if (stationsQueued && !disposed) { stationsQueued = false; void loadStations(); }
    }
  };

  const onPlay = () => { void startListeningSession(); };
  const onPause = () => { if (!audio.ended) void closeListeningSession(); };
  const onEnded = () => { void closeListeningSession(); };
  audio.addEventListener('play', onPlay);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', onEnded);

  await loadStations();
  stationChannel = supabase.channel('rich-radio-runtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_stations' }, () => void loadStations())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_likes' }, () => { if (active) void refreshLike().then(() => renderActive()); })
    .subscribe();

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    void closeListeningSession();
    audio.pause();
    audio.removeEventListener('play', onPlay);
    audio.removeEventListener('pause', onPause);
    audio.removeEventListener('ended', onEnded);
    audio.removeAttribute('src');
    audio.load();
    if (stationChannel) void supabase.removeChannel(stationChannel);
    stationChannel = null;
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}