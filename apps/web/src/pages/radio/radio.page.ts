import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';
import '../../styles/radio-universe.css';

type Row = Record<string, any>;
type Snapshot = { stations?: Row[]; active_id?: string | null; liked?: boolean; comments?: Row[]; metrics?: Row };
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.radioOwner === 'mounted') return;
  root.dataset.radioOwner = 'mounted';

  const user = getAuthSnapshot().user;
  const userId = user?.id ?? null;
  const anonymousId = sessionStorage.getItem('rb_radio_anon') || crypto.randomUUID();
  sessionStorage.setItem('rb_radio_anon', anonymousId);

  root.innerHTML = `<main class="sound-universe radio-universe"><div class="sound-wrap">
    <header class="sound-head"><a href="/portal.html">←</a><div class="sound-brand"><small>RICH BIZNESS LIVE AUDIO</small><h1>RADIO UNIVERSE</h1></div><nav class="sound-nav"><a href="/music.html">MUSIC</a><a href="/podcast.html">PODCAST</a><a class="active" href="/radio.html">RADIO</a></nav></header>
    <section class="radio-command-banner"><span>24/7 AUDIO SIGNAL</span><strong>LIVE STATIONS · DJ SETS · CREATOR TAKEOVERS · GLOBAL LISTENERS</strong><i></i></section>
    <section class="sound-hero"><article id="radioHero" class="sound-now radio-now"></article><aside class="sound-panel"><section id="radioMetrics" class="sound-metrics"></section><div id="radioList" class="sound-list"></div></aside></section>
    <section class="sound-lower"><article class="sound-panel radio-network-panel"><h3>ON AIR NETWORK</h3><p>Continuous Rich Bizness radio, interviews, DJ sets and creator broadcasts. Radio remains a pure live-audio system connected to Music and Podcast without duplicating their media ownership.</p><div class="radio-network-badges"><span>24/7 SIGNAL</span><span>LIVE AUDIO</span><span>CREATOR TAKEOVERS</span><span>GLOBAL NETWORK</span></div><div class="sound-actions"><a class="sound-btn primary" href="/upload.html?route=radio">BUILD STATION</a><a class="sound-btn" href="/creator.html">CREATOR HUB</a><a class="sound-btn" href="/live.html?category=radio">GO LIVE</a></div></article><article class="sound-panel"><h3>STATION STATUS</h3><div id="radioStatus" class="sound-empty">Select a station to connect.</div></article></section>
    <section class="sound-panel radio-conversation-panel"><div class="radio-conversation-head"><div><small>LIVE LISTENER ROOM</small><h3>STATION CONVERSATION</h3></div><span id="radioConversationSignal">OFF AIR</span></div><div id="radioComments" class="sound-comments"></div><form id="radioCommentForm" class="sound-form"><input id="radioCommentInput" maxlength="2000" placeholder="Talk inside the station..."><button class="sound-btn primary">POST</button></form></section>
    <aside id="radioPlayer" class="sound-player radio-player" hidden><img id="radioPlayerCover" alt=""><div><strong id="radioPlayerTitle"></strong><small id="radioPlayerMeta"></small></div><audio id="radioAudio" controls preload="none"></audio></aside>
    <p id="radioMessage" class="sound-empty" role="status"></p>
  </div></main>`;

  const list = root.querySelector<HTMLElement>('#radioList')!;
  const hero = root.querySelector<HTMLElement>('#radioHero')!;
  const metrics = root.querySelector<HTMLElement>('#radioMetrics')!;
  const status = root.querySelector<HTMLElement>('#radioStatus')!;
  const comments = root.querySelector<HTMLElement>('#radioComments')!;
  const commentForm = root.querySelector<HTMLFormElement>('#radioCommentForm')!;
  const commentInput = root.querySelector<HTMLInputElement>('#radioCommentInput')!;
  const conversationSignal = root.querySelector<HTMLElement>('#radioConversationSignal')!;
  const message = root.querySelector<HTMLElement>('#radioMessage')!;
  const player = root.querySelector<HTMLElement>('#radioPlayer')!;
  const audio = root.querySelector<HTMLAudioElement>('#radioAudio')!;

  let snapshot: Snapshot = {};
  let stations: Row[] = [];
  let active: Row | null = null;
  let sessionId: string | null = null;
  let sessionStartedAt = 0;
  let stationChannel: Channel | null = null;
  let commentChannel: Channel | null = null;
  let loading = false;
  let queued = false;
  let destroyed = false;
  let refreshTimer: number | undefined;

  const setMessage = (text: string, error = false) => { message.textContent = text; message.dataset.error = String(error); window.setTimeout(() => { if (message.textContent === text) message.textContent = ''; }, 3200); };
  const requireUser = () => { if (userId) return true; location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`); return false; };
  const action = async (name: string, payload: Row) => { const { data, error } = await supabase.rpc('rb_radio_action', { p_action: name, p_payload: payload }); if (error) throw error; return (data ?? {}) as Row; };

  const renderMetrics = () => {
    const m = snapshot.metrics ?? {};
    metrics.innerHTML = `<article><small>STATIONS</small><strong>${fmt(m.stations ?? stations.length)}</strong></article><article><small>LIVE NOW</small><strong>${fmt(m.live_now ?? stations.filter((station) => station.is_live).length)}</strong></article><article><small>LISTENERS</small><strong>${fmt(m.listeners)}</strong></article><article><small>LIKES</small><strong>${fmt(m.likes)}</strong></article>`;
  };

  const renderComments = () => {
    const rows = snapshot.comments ?? [];
    conversationSignal.textContent = active?.is_live ? 'LIVE ROOM' : active ? 'STATION ROOM' : 'OFF AIR';
    comments.innerHTML = active ? rows.map((row) => `<article class="sound-comment"><b>${esc(row.display_name || row.username || 'Rich Listener')}</b><p>${esc(row.comment)}</p></article>`).join('') || '<div class="sound-empty">Start the station conversation.</div>' : '<div class="sound-empty">Select a station to open its listener room.</div>';
  };

  const renderList = () => {
    list.innerHTML = stations.map((station, index) => `<button class="sound-card ${active && String(active.id) === String(station.id) ? 'active' : ''}" data-id="${esc(station.id)}"><span class="radio-station-index">${String(index + 1).padStart(2, '0')}</span><img src="${esc(safeMedia(station.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(station.station_name || 'Rich Radio')}</b><small>${station.is_live ? '● LIVE' : 'RADIO'} · ${esc(station.station_tag || station.genre || 'Global')}</small></span><strong>${fmt(station.listener_count)} ◉</strong></button>`).join('') || '<div class="sound-empty">The Radio Universe is ready for its first station.</div>';
    list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => { node.onclick = () => { const station = stations.find((item) => String(item.id) === node.dataset.id); if (station) void selectStation(station); }; });
  };

  const closeSession = async () => {
    if (!sessionId || !active) return;
    const id = sessionId;
    sessionId = null;
    const listenSeconds = Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000));
    try { await action('end_session', { station_id: active.id, session_id: id, anonymous_id: anonymousId, listen_seconds: listenSeconds }); } catch { /* best-effort close */ }
  };

  const startSession = async () => {
    if (!active || sessionId) return;
    const result = await action('start_session', { station_id: active.id, anonymous_id: anonymousId, device_info: { language: navigator.language, platform: navigator.platform } });
    sessionId = result.session_id ?? null;
    sessionStartedAt = Date.now();
  };

  const bindActive = () => {
    if (!active) return;
    const source = safeMedia(active.stream_url);
    const cover = safeMedia(active.cover_url) || '/images/brand/IMG_5997.png';
    const liked = Boolean(snapshot.liked);
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="radio-spectrum" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--bar:${i}"></i>`).join('')}</div><div class="sound-copy"><span>${active.is_live ? '● LIVE NOW' : 'RICH RADIO'} · ${esc(active.station_tag || active.genre || 'GLOBAL')}</span><h2>${esc(active.station_name || 'Rich Radio')}</h2><p>${esc(active.description || 'Streaming the Rich Bizness universe live and worldwide.')}</p><div class="sound-actions"><button id="radioPlayBtn" class="sound-btn primary" ${source ? '' : 'disabled'}>▶ LISTEN LIVE</button><button id="radioLikeBtn" class="sound-btn">${liked ? '♥ LIKED' : '♡ LIKE'}</button><a class="sound-btn" href="/profile.html?id=${encodeURIComponent(String(active.user_id || ''))}">STATION PROFILE</a><a class="sound-btn" href="/music.html">MUSIC</a><a class="sound-btn" href="/podcast.html">PODCAST</a></div></div>`;
    player.hidden = false;
    root.querySelector<HTMLImageElement>('#radioPlayerCover')!.src = cover;
    root.querySelector<HTMLElement>('#radioPlayerTitle')!.textContent = active.station_name || 'Rich Radio';
    root.querySelector<HTMLElement>('#radioPlayerMeta')!.textContent = `${active.is_live ? 'LIVE' : 'RADIO'} · ${active.station_tag || active.genre || 'Rich Bizness'}`;
    if (audio.src !== source) audio.src = source;
    status.innerHTML = source ? `<strong>${active.is_live ? 'LIVE SIGNAL' : 'STREAM READY'}</strong><br>${fmt(active.listener_count)} listeners · ${fmt(active.peak_listeners)} peak · ${fmt(active.play_count)} total connects` : 'STREAM URL NOT AVAILABLE';
    root.querySelector<HTMLButtonElement>('#radioPlayBtn')!.onclick = async () => { try { await audio.play(); await startSession(); } catch { setMessage('The station signal could not start on this device.', true); } };
    root.querySelector<HTMLButtonElement>('#radioLikeBtn')!.onclick = async () => { if (!requireUser()) return; try { await action('toggle_like', { station_id: active!.id }); await load(active!.id); } catch (error) { setMessage(error instanceof Error ? error.message : 'Favorite failed.', true); } };
  };

  const selectStation = async (station: Row) => {
    if (active && String(active.id) !== String(station.id)) { audio.pause(); await closeSession(); }
    active = station;
    history.replaceState({}, '', `/radio.html?id=${encodeURIComponent(station.id)}`);
    await load(station.id);
    if (commentChannel) await supabase.removeChannel(commentChannel);
    commentChannel = supabase.channel(`radio-comments:${station.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'radio_comments', filter: `station_id=eq.${station.id}` }, () => scheduleLoad(station.id)).subscribe();
  };

  const load = async (stationId?: string) => {
    if (loading) { queued = true; return; }
    loading = true;
    try {
      const requested = stationId || active?.id || new URLSearchParams(location.search).get('id');
      const { data, error } = await supabase.rpc('rb_radio_snapshot', { p_station_id: requested || null, p_limit: 100 });
      if (error) throw error;
      snapshot = (data ?? {}) as Snapshot;
      stations = snapshot.stations ?? [];
      active = stations.find((station) => String(station.id) === String(snapshot.active_id)) ?? stations[0] ?? null;
      renderMetrics(); renderList(); renderComments();
      if (active) bindActive(); else { hero.innerHTML = '<div class="sound-empty">No radio stations are public yet.</div>'; player.hidden = true; }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Radio network failed to load.', true); }
    finally { loading = false; if (queued && !destroyed) { queued = false; void load(active?.id); } }
  };

  const scheduleLoad = (stationId?: string) => { window.clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => void load(stationId || active?.id), 180); };

  commentForm.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || !requireUser()) return;
    const value = commentInput.value.trim();
    if (!value) return;
    const button = commentForm.querySelector<HTMLButtonElement>('button')!;
    button.disabled = true;
    try { await action('comment', { station_id: active.id, comment: value }); commentInput.value = ''; await load(active.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Comment failed.', true); }
    finally { button.disabled = false; }
  };

  const onPlay = () => { void startSession(); };
  const onPause = () => { if (!audio.ended) void closeSession(); };
  audio.addEventListener('play', onPlay);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', onPause);

  await load();
  stationChannel = supabase.channel('rich-radio-stations').on('postgres_changes', { event: '*', schema: 'public', table: 'radio_stations' }, () => scheduleLoad()).subscribe();
  if (active) commentChannel = supabase.channel(`radio-comments:${active.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'radio_comments', filter: `station_id=eq.${active.id}` }, () => scheduleLoad(active?.id)).subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    window.clearTimeout(refreshTimer);
    void closeSession();
    audio.pause();
    audio.removeEventListener('play', onPlay);
    audio.removeEventListener('pause', onPause);
    audio.removeEventListener('ended', onPause);
    audio.removeAttribute('src');
    audio.load();
    if (stationChannel) void supabase.removeChannel(stationChannel);
    if (commentChannel) void supabase.removeChannel(commentChannel);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}