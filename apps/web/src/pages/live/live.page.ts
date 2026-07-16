import { Room, RoomEvent, Track, createLocalAudioTrack, createLocalVideoTrack, type LocalAudioTrack, type LocalVideoTrack } from 'livekit-client';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import '../../styles/live-studio.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const money = (v: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v ?? 0) / 100);
const isLive = (row: Row) => String(row.status ?? '').toLowerCase() === 'live';

function lockMediaElement(element: HTMLMediaElement, className: string) {
  element.className = className;
  element.setAttribute('playsinline', 'true');
  element.setAttribute('webkit-playsinline', 'true');
  element.setAttribute('controlsList', 'nodownload noremoteplayback nofullscreen');
  element.disableRemotePlayback = true;
  if (element instanceof HTMLVideoElement) element.disablePictureInPicture = true;
  return element;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.liveMounted === 'true') return;
  root.dataset.liveMounted = 'true';

  const auth = await getAuthSnapshot();
  const session = auth.session;
  const user = session?.user ?? null;
  const requireUser = () => {
    if (user) return true;
    location.href = `/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return false;
  };

  let disposed = false;
  let universeLoading: Promise<void> | null = null;
  let universeQueued = false;
  let chatLoading: Promise<void> | null = null;
  let chatQueued = false;
  let catalogChannel: Channel | null = null;
  let roomChannel: Channel | null = null;
  let viewerRoom: Room | null = null;
  let hostRoom: Room | null = null;
  let hostVideo: LocalVideoTrack | null = null;
  let hostAudio: LocalAudioTrack | null = null;
  let heartbeat: number | null = null;
  let hostStarting = false;
  let chatSending = false;
  let lane = 'live';
  let active: Row | null = null;
  let activeHostStream: Row | null = null;
  let selectedCategory = 'family-bizness';
  let streams: Row[] = [];
  let recordings: Row[] = [];
  let cards: Row[] = [];
  let purchases: Row[] = [];
  let categories: Row[] = [];
  let profile: Row = {};
  let vip = new Set<string>();
  let alerts = new Set<string>();
  const viewerElements = new Set<HTMLMediaElement>();

  const disconnectViewer = async () => {
    viewerElements.forEach((element) => {
      element.pause();
      element.srcObject = null;
      element.remove();
    });
    viewerElements.clear();
    if (viewerRoom) {
      await viewerRoom.disconnect().catch(() => undefined);
      viewerRoom = null;
    }
  };

  const stopHostMedia = async () => {
    if (heartbeat) window.clearInterval(heartbeat);
    heartbeat = null;
    hostVideo?.detach().forEach((element) => element.remove());
    hostAudio?.detach().forEach((element) => element.remove());
    hostVideo?.stop();
    hostAudio?.stop();
    hostVideo = null;
    hostAudio = null;
    if (hostRoom) {
      await hostRoom.disconnect().catch(() => undefined);
      hostRoom = null;
    }
  };

  const [{ data: universe, error: universeError }, studioResult] = await Promise.all([
    supabase.rpc('rb_live_watch_podcast_snapshot', {}),
    user ? supabase.rpc('rb_go_live_bootstrap', {}) : Promise.resolve({ data: {}, error: null })
  ]);
  if (universeError) throw universeError;
  if (studioResult.error) throw studioResult.error;

  const applySnapshots = (universeValue: unknown, studioValue: unknown) => {
    const snap = (universeValue ?? {}) as Row;
    const setup = (studioValue ?? {}) as Row;
    const now = Date.now();
    streams = ((snap.live ?? []) as Row[]).filter((stream) => {
      if (!isLive(stream)) return true;
      const activity = Date.parse(String(stream.last_activity_at ?? stream.updated_at ?? stream.started_at ?? 0));
      return Number.isFinite(activity) && now - activity < 2 * 60 * 60 * 1000;
    });
    recordings = (snap.recordings ?? []) as Row[];
    cards = (snap.live_cards ?? []) as Row[];
    purchases = (snap.live_purchases ?? []) as Row[];
    categories = (setup.categories ?? categories ?? []) as Row[];
    vip = new Set(((snap.vip_access ?? []) as Row[]).map((row) => String(row.stream_id)));
    alerts = new Set(((snap.live_alerts ?? []) as Row[]).map((row) => String(row.creator_id ?? row.stream_id)));
    profile = setup.profile ?? snap.profile ?? profile ?? {};
    activeHostStream = setup.active_stream ?? activeHostStream;
    selectedCategory = String(activeHostStream?.category ?? selectedCategory ?? categories[0]?.slug ?? 'family-bizness');
    if (!active || ![...streams, ...recordings, ...cards].some((row) => String(row.id) === String(active?.id))) {
      active = streams.find(isLive) ?? streams[0] ?? recordings[0] ?? cards[0] ?? null;
    }
  };
  applySnapshots(universe, studioResult.data);

  root.innerHTML = `<main class="media-ultimate live-mobile-safe"><div class="media-ultimate__wrap">
    <header class="media-ultimate__head">
      <a href="/portal.html" aria-label="Back to Portal">←</a>
      <div><p>RICH BIZNESS LLC • GLOBAL LIVE</p><h1>WE LIT🔥</h1></div>
      <span class="media-ultimate__status">${user ? '● TAPPED IN' : 'PUBLIC VIEW'}</span>
    </header>

    <nav class="live-network-rail" aria-label="Live universe connections">
      <a href="/feed.html"><b>◫</b><span>FEED</span></a>
      <a href="/watch.html"><b>📺</b><span>WATCH</span></a>
      <a href="/podcast.html"><b>◌</b><span>PODCAST</span></a>
      <a href="/radio.html"><b>◉</b><span>RADIO</span></a>
      <a href="/music.html"><b>♪</b><span>MUSIC</span></a>
      <a href="/sports.html"><b>🏆</b><span>SPORTS</span></a>
    </nav>

    <section id="liveHero" class="media-ultimate__hero live-hero-clean">${active ? hero(active, user !== null) : '<div class="media-ultimate__empty">Ain’t nobody live yet. Light this shyt up.</div>'}</section>

    <section id="liveMetrics" class="media-ultimate__metrics"></section>

    <nav class="media-ultimate__tabs">
      ${[['live', 'WE LIT🔥'], ['upcoming', 'GET RIGHT'], ['vip', 'VIP RICH ROOMS'], ['replays', 'PARTY’S OVER'], ['network', 'WE 🔥📺']]
        .map(([value, label], index) => `<button class="${index === 0 ? 'active' : ''}" data-lane="${value}">${label}</button>`).join('')}
    </nav>

    <section class="media-ultimate__section">
      <header>
        <div><h3 id="laneTitle">WE LIT🔥</h3><p>Pop in, build the room, call the madness, co-host, react, chat, record and get paid.</p></div>
        <div class="live-command-actions"><a class="media-ultimate__btn" href="/upload.html?route=live-thumbnail">THUMBNAIL</a><a class="media-ultimate__btn" href="/creator.html">CREATOR</a><button id="goLiveButton" class="live-studio-launch" type="button">GO LIVE 🔴</button></div>
      </header>
      <div id="liveGrid" class="media-ultimate__grid"></div>
    </section>

    <section class="media-ultimate__split">
      <article class="media-ultimate__panel"><header><h4>LIVE CONTROLS</h4></header><div id="liveDetail" class="media-ultimate__list"></div></article>
      <article class="media-ultimate__panel"><header><h4>RICH LIVE CHAT</h4></header><div id="liveChat" class="media-ultimate__chat"><div class="media-ultimate__empty">Pop in a room.</div></div><form id="chatForm" class="media-ultimate__form"><input id="chatInput" maxlength="800" placeholder="Say that shyt..."><button class="media-ultimate__btn primary">DROP IT</button></form></article>
    </section>

    <section class="media-ultimate__section"><header><div><h3>YOUR RICH ACCESS</h3><p>Unlocked rooms, VIP passes and alerts tied to your Rich ID.</p></div></header><div id="liveAccessGrid" class="media-ultimate__grid"></div></section>
  </div>

  <dialog id="goLiveStudio" class="live-studio">
    <div class="live-studio__shell">
      <section id="studioPreview" class="live-studio__preview">
        <div class="live-studio__preview-empty"><strong>PREVIEW CAM</strong><p>Pick your lane, check the camera, then light this shyt up.</p></div>
        <div class="live-studio__preview-overlay"><small id="previewCategory">${esc(categories.find((category) => category.slug === selectedCategory)?.slang_label ?? 'FAMILY BIZNESS')}</small><h3 id="previewTitle">${esc(activeHostStream?.title ?? 'Your Live Title')}</h3></div>
      </section>
      <aside class="live-studio__panel">
        <header class="live-studio__top"><div><p>RICH BIZNESS LLC</p><h2>GO LIVE 🔴</h2></div><button id="closeStudio" class="live-studio__close" type="button">×</button></header>
        <form id="goLiveForm" class="live-studio__form">
          <label>WHAT WE CALLIN’ THIS LIVE?<input id="liveTitle" maxlength="120" required value="${esc(activeHostStream?.title ?? 'Family Bizness')}" placeholder="Family Bizness"></label>
          <label>WHAT’S THE MOVE?<textarea id="liveDescription" maxlength="1200" placeholder="Tell everybody what type time we on...">${esc(activeHostStream?.description ?? '')}</textarea></label>
          <label>PICK YOUR LIVE LANE<div id="categoryGrid" class="live-category-grid">${categories.map((category) => `<button class="live-category ${category.slug === selectedCategory ? 'active' : ''}" type="button" data-category="${esc(category.slug)}" style="background-image:url('${esc(category.hero_asset_url)}')"><span>${esc(category.icon)}</span><strong>${esc(category.slang_label)}</strong><small>${esc(category.label)}</small></button>`).join('')}</div></label>
          <div class="live-studio__toggles">
            <label>ROOM ACCESS<select id="liveAccess"><option value="free">FREE ROOM ACCESS</option><option value="vip">VIP RICH ROOM</option><option value="paid">PAID ROOM</option><option value="private">PRIVATE BIZNESS</option></select></label>
            <label>PRICE<input id="livePrice" type="number" min="0" step="1" value="0" inputmode="decimal"></label>
          </div>
          <div class="live-studio__toggles">
            <label class="live-studio__toggle"><input id="liveChatEnabled" type="checkbox" checked> LIVE CHAT</label>
            <label class="live-studio__toggle"><input id="liveCohostEnabled" type="checkbox" checked> CO-HOST ROOM</label>
            <label class="live-studio__toggle"><input id="liveRecordingEnabled" type="checkbox" checked> SAVE REPLAY</label>
            <label class="live-studio__toggle"><input id="liveCaptionsEnabled" type="checkbox"> LIVE CAPTIONS</label>
          </div>
          <button id="startLiveButton" class="live-studio__submit" type="submit">LIGHT THIS SHYT UP</button>
          <p id="studioStatus" class="live-studio__status">TAP IN READY • CAMERA AND MIC ASK WHEN YOU START</p>
        </form>
      </aside>
    </div>
  </dialog>
  </main>`;

  const grid = document.querySelector<HTMLElement>('#liveGrid')!;
  const laneTitle = document.querySelector<HTMLElement>('#laneTitle')!;
  const detail = document.querySelector<HTMLElement>('#liveDetail')!;
  const chat = document.querySelector<HTMLElement>('#liveChat')!;
  const studioDialog = document.querySelector<HTMLDialogElement>('#goLiveStudio')!;
  const studioPreview = document.querySelector<HTMLElement>('#studioPreview')!;
  const studioStatus = document.querySelector<HTMLElement>('#studioStatus')!;
  const startButton = document.querySelector<HTMLButtonElement>('#startLiveButton')!;

  const setStudioStatus = (message: string, error = false) => {
    studioStatus.textContent = message;
    studioStatus.dataset.error = String(error);
  };

  const rows = () => lane === 'replays'
    ? recordings
    : lane === 'network'
      ? cards
      : streams.filter((stream) => lane === 'live'
        ? isLive(stream)
        : lane === 'upcoming'
          ? ['draft', 'scheduled', 'upcoming', 'ready'].includes(String(stream.status).toLowerCase())
          : stream.is_vip_enabled || vip.has(String(stream.id)));

  const renderMetrics = () => {
    document.querySelector<HTMLElement>('#liveMetrics')!.innerHTML = `
      <article><small>WE LIT🔥</small><strong>${streams.filter(isLive).length}</strong></article>
      <article><small>NOW WATCHING</small><strong>${streams.reduce((total, stream) => total + Number(stream.viewer_count ?? 0), 0).toLocaleString()}</strong></article>
      <article><small>VIP RICH ROOMS</small><strong>${vip.size}</strong></article>
      <article><small>CREATOR BAG</small><strong>${money(streams.reduce((total, stream) => total + Number(stream.total_revenue_cents ?? 0), 0))}</strong></article>`;
    document.querySelector<HTMLElement>('#liveAccessGrid')!.innerHTML = user
      ? [...purchases.slice(0, 4), ...[...vip].slice(0, 4).map((streamId) => ({ id: streamId, title: 'VIP ROOM', description: 'Rich access unlocked' }))].map((row) => card(row, 'UNLOCKED')).join('') || '<div class="media-ultimate__empty">No premium rooms unlocked yet.</div>'
      : '<div class="media-ultimate__empty"><a class="media-ultimate__btn primary" href="/tap-in.html?next=%2Flive.html">TAP IN FOR VIP ACCESS</a></div>';
  };

  const render = () => {
    const list = rows();
    grid.innerHTML = list.length ? list.map((row) => card(row, lane.toUpperCase())).join('') : '<div class="media-ultimate__empty">Ain’t nothing in this lane yet.</div>';
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach((element) => {
      element.onclick = () => {
        const row = list.find((item) => String(item.id) === element.dataset.id);
        if (row) void open(row);
      };
    });
    renderMetrics();
  };

  const loadChat = async (): Promise<void> => {
    if (chatLoading) {
      chatQueued = true;
      return chatLoading;
    }
    chatLoading = (async () => {
      if (!active || lane === 'replays' || lane === 'network') {
        chat.innerHTML = '<div class="media-ultimate__empty">Chat opens when you pop in a live room.</div>';
        return;
      }
      const activeId = String(active.id);
      const { data, error } = await supabase.from('live_chat_messages').select('id,display_name,username,message,body,is_pinned,created_at').eq('stream_id', activeId).eq('is_deleted', false).order('created_at', { ascending: true }).limit(120);
      if (disposed || String(active?.id) !== activeId) return;
      if (error) {
        chat.innerHTML = `<div class="media-ultimate__empty">${esc(error.message)}</div>`;
        return;
      }
      chat.innerHTML = (data ?? []).map((message: Row) => `<article><p>${esc(message.message || message.body)}</p><small>${esc(message.display_name || message.username || 'Rich Member')}${message.is_pinned ? ' · PINNED' : ''}</small></article>`).join('') || '<div class="media-ultimate__empty">Start talkin’ that shyt.</div>';
      chat.scrollTop = chat.scrollHeight;
    })().finally(async () => {
      chatLoading = null;
      if (chatQueued && !disposed) {
        chatQueued = false;
        await loadChat();
      }
    });
    return chatLoading;
  };

  const bindHero = (row: Row) => {
    document.querySelector<HTMLButtonElement>('#alertBtn')?.addEventListener('click', async () => {
      if (!requireUser()) return;
      const creatorId = String(row.creator_id ?? row.user_id ?? '');
      if (!creatorId) return;
      if (alerts.has(creatorId)) {
        await supabase.from('live_alert_subscriptions').delete().eq('user_id', user!.id).eq('creator_id', creatorId);
        alerts.delete(creatorId);
      } else {
        await supabase.from('live_alert_subscriptions').upsert({ user_id: user!.id, creator_id: creatorId, alert_level: 'all' }, { onConflict: 'user_id,creator_id' });
        alerts.add(creatorId);
      }
      document.querySelector<HTMLButtonElement>('#alertBtn')!.textContent = alerts.has(creatorId) ? '🔔 LOCKED IN' : '🔔 STAY LOCKED';
    });
    document.querySelector<HTMLButtonElement>('#reactBtn')?.addEventListener('click', async () => {
      if (!requireUser()) return;
      await supabase.from('live_reactions').insert({ stream_id: row.id, user_id: user!.id, reaction: '💨' });
      burst('💨');
    });
    document.querySelector<HTMLButtonElement>('#popInBtn')?.addEventListener('click', () => {
      if (!requireUser()) return;
      void popIn(row);
    });
  };

  const open = async (row: Row) => {
    active = row;
    await disconnectViewer();
    document.querySelector<HTMLElement>('#liveHero')!.innerHTML = hero(row, user !== null);
    detail.innerHTML = [
      ['BIZNESS PARTY', `${row.metadata?.slang_label || row.display_room_name || row.category || 'Family Bizness'} · ${row.access_type || 'free'}`],
      ['STREAM QUALITY', `${row.stream_protocol || 'LiveKit'} · ${row.latency_mode || 'interactive'} · ${row.recording_enabled ? 'replay on' : 'replay off'}`],
      ['NOW WATCHING', `${Number(row.viewer_count ?? row.view_count ?? 0).toLocaleString()} watching · ${Number(row.peak_viewers ?? 0).toLocaleString()} peak`],
      ['CREATOR BAG', `${money(row.price_cents ?? 0)} entry · ${money(row.total_revenue_cents ?? 0)} earned`],
      ['ROOM ENERGY', `${row.is_chat_enabled ? 'chat lit' : 'chat off'} · ${row.is_cohost_enabled ? 'co-host ready' : 'solo'} · ${row.is_vip_enabled ? 'VIP' : 'open room'}`]
    ].map(([label, value]) => `<div class="media-ultimate__row"><div><h5>${label}</h5><p>${esc(value)}</p></div></div>`).join('');
    if (roomChannel) {
      await supabase.removeChannel(roomChannel);
      roomChannel = null;
    }
    await loadChat();
    if (lane !== 'replays' && lane !== 'network') {
      roomChannel = supabase.channel(`ultimate-live:${row.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${row.id}` }, () => void loadChat())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_reactions', filter: `stream_id=eq.${row.id}` }, (payload) => burst(String((payload.new as Row).reaction ?? '💨')))
        .subscribe();
    }
    bindHero(row);
  };

  const refreshUniverse = async (): Promise<void> => {
    if (universeLoading) {
      universeQueued = true;
      return universeLoading;
    }
    universeLoading = (async () => {
      const [{ data: nextUniverse, error }, nextStudio] = await Promise.all([
        supabase.rpc('rb_live_watch_podcast_snapshot', {}),
        user ? supabase.rpc('rb_go_live_bootstrap', {}) : Promise.resolve({ data: {}, error: null })
      ]);
      if (error || nextStudio.error || disposed) return;
      applySnapshots(nextUniverse, nextStudio.data);
      render();
    })().finally(async () => {
      universeLoading = null;
      if (universeQueued && !disposed) {
        universeQueued = false;
        await refreshUniverse();
      }
    });
    return universeLoading;
  };

  const tokenFor = async (stream: Row, role: 'host' | 'viewer') => {
    if (!requireUser()) throw new Error('Tap in to enter Live rooms.');
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!current) throw new Error('Your Rich ID session expired. Tap in again.');
    const response = await fetch('/api/live/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.access_token}` },
      body: JSON.stringify({ roomName: stream.livekit_room_name, streamId: stream.id, role })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Live room token failed.');
    return payload;
  };

  const popIn = async (stream: Row) => {
    try {
      const payload = await tokenFor(stream, 'viewer');
      await disconnectViewer();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      viewerRoom = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        const stage = document.querySelector<HTMLElement>('#viewerStage');
        if (!stage) return;
        const element = lockMediaElement(track.attach(), track.kind === Track.Kind.Video ? 'live-inline-video' : 'live-inline-audio');
        viewerElements.add(element);
        stage.append(element);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => {
          viewerElements.delete(element);
          element.remove();
        });
      });
      room.on(RoomEvent.Disconnected, () => {
        viewerElements.forEach((element) => element.remove());
        viewerElements.clear();
      });
      await room.connect(payload.url, payload.token);
      document.querySelector<HTMLElement>('#liveHero')!.innerHTML = `<div id="viewerStage" class="live-viewer-stage"></div><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">NOW WATCHING · ${esc(stream.display_room_name || stream.category || 'BIZNESS PARTY')}</span><h2>${esc(stream.title)}</h2><p>You popped in. WE LIT🔥</p><div class="media-ultimate__actions"><button id="leaveRoomBtn" class="media-ultimate__btn" type="button">LEAVE ROOM</button><a class="media-ultimate__btn" href="/watch.html">WE 🔥📺</a></div></div>`;
      document.querySelector<HTMLButtonElement>('#leaveRoomBtn')!.onclick = async () => {
        await disconnectViewer();
        if (active) await open(active);
      };
    } catch (error) {
      detail.innerHTML = `<div class="media-ultimate__empty">${esc(error instanceof Error ? error.message : 'Could not pop in.')}</div>`;
    }
  };

  const connectHost = async (stream: Row) => {
    setStudioStatus('CHECKING CAMERA + MIC...');
    await stopHostMedia();
    const payload = await tokenFor(stream, 'host');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    hostRoom = room;
    await room.connect(payload.url, payload.token);
    hostVideo = await createLocalVideoTrack({ facingMode: 'user', resolution: { width: 1280, height: 720 } });
    hostAudio = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    await room.localParticipant.publishTrack(hostVideo, { simulcast: true });
    await room.localParticipant.publishTrack(hostAudio);
    studioPreview.innerHTML = `<div id="hostVideoMount" class="live-host-stage"></div><span class="live-host-badge">● WE LIT🔥</span><div class="live-host-controls"><button id="toggleMic" type="button">🎙️</button><button id="toggleCam" type="button">📹</button><button id="endLive" class="danger" type="button">■</button></div><div class="live-studio__preview-overlay"><small>${esc(stream.display_room_name || stream.metadata?.slang_label || 'BIZNESS PARTY')}</small><h3>${esc(stream.title)}</h3></div>`;
    const hostElement = lockMediaElement(hostVideo.attach(), 'live-inline-video live-host-video');
    hostElement.muted = true;
    hostElement.autoplay = true;
    document.querySelector<HTMLElement>('#hostVideoMount')!.append(hostElement);
    heartbeat = window.setInterval(() => void supabase.rpc('rb_live_heartbeat', { p_stream_id: stream.id }), 30_000);
    setStudioStatus('WE LIT🔥 — YOU LIVE AS ' + String(profile.display_name || profile.username || 'RICH CREATOR').toUpperCase());
    document.querySelector<HTMLButtonElement>('#toggleMic')!.onclick = async () => {
      if (!hostAudio) return;
      await hostAudio.setMuted(!hostAudio.isMuted);
      document.querySelector<HTMLButtonElement>('#toggleMic')!.textContent = hostAudio.isMuted ? '🔇' : '🎙️';
    };
    document.querySelector<HTMLButtonElement>('#toggleCam')!.onclick = async () => {
      if (!hostVideo) return;
      await hostVideo.setMuted(!hostVideo.isMuted);
      document.querySelector<HTMLButtonElement>('#toggleCam')!.textContent = hostVideo.isMuted ? '🚫' : '📹';
    };
    document.querySelector<HTMLButtonElement>('#endLive')!.onclick = () => void endHostLive(stream);
  };

  const endHostLive = async (stream: Row) => {
    setStudioStatus('WRAPPIN’ THE PARTY UP...');
    await stopHostMedia();
    const { error } = await supabase.rpc('rb_end_live_stream', { p_stream_id: stream.id });
    if (error) {
      setStudioStatus(error.message, true);
      return;
    }
    activeHostStream = null;
    startButton.disabled = false;
    setStudioStatus('PARTY’S OVER — REPLAY GETTIN’ RIGHT');
    await refreshUniverse();
    window.setTimeout(() => studioDialog.close(), 600);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => {
    button.onclick = () => {
      lane = button.dataset.lane!;
      document.querySelectorAll('[data-lane]').forEach((node) => node.classList.toggle('active', node === button));
      laneTitle.textContent = button.textContent ?? 'WE LIT🔥';
      render();
      const first = rows()[0];
      if (first) void open(first);
      else {
        active = null;
        document.querySelector<HTMLElement>('#liveHero')!.innerHTML = '<div class="media-ultimate__empty">Ain’t nothing in this lane yet.</div>';
      }
    };
  });

  document.querySelector<HTMLFormElement>('#chatForm')!.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || lane === 'replays' || lane === 'network' || chatSending || !requireUser()) return;
    const input = document.querySelector<HTMLInputElement>('#chatInput')!;
    const body = input.value.trim();
    if (!body) return;
    chatSending = true;
    const submit = event.submitter as HTMLButtonElement | null;
    if (submit) submit.disabled = true;
    const { error } = await supabase.from('live_chat_messages').insert({ stream_id: active.id, user_id: user!.id, username: profile.username, display_name: profile.display_name, message: body, body });
    if (!error) input.value = '';
    chatSending = false;
    if (submit) submit.disabled = false;
  };

  document.querySelector<HTMLButtonElement>('#goLiveButton')!.onclick = () => {
    if (!requireUser()) return;
    studioDialog.showModal();
  };
  document.querySelector<HTMLButtonElement>('#closeStudio')!.onclick = () => {
    if (!hostRoom) studioDialog.close();
  };
  studioDialog.addEventListener('cancel', (event) => {
    if (hostRoom) event.preventDefault();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => {
    button.onclick = () => {
      selectedCategory = button.dataset.category!;
      document.querySelectorAll('[data-category]').forEach((node) => node.classList.toggle('active', node === button));
      const category = categories.find((item) => item.slug === selectedCategory);
      document.querySelector<HTMLElement>('#previewCategory')!.textContent = category?.slang_label ?? 'BIZNESS PARTY';
      if (!hostRoom) studioPreview.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.82)),url('${category?.hero_asset_url ?? ''}')`;
    };
  });

  document.querySelector<HTMLInputElement>('#liveTitle')!.addEventListener('input', (event) => {
    document.querySelector<HTMLElement>('#previewTitle')!.textContent = (event.target as HTMLInputElement).value || 'Your Live Title';
  });

  document.querySelector<HTMLFormElement>('#goLiveForm')!.onsubmit = async (event) => {
    event.preventDefault();
    if (hostStarting || hostRoom || !requireUser()) return;
    hostStarting = true;
    startButton.disabled = true;
    setStudioStatus('GETTIN’ THE BIZNESS PARTY RIGHT...');
    const price = Math.round(Number(document.querySelector<HTMLInputElement>('#livePrice')!.value || 0) * 100);
    const titleValue = document.querySelector<HTMLInputElement>('#liveTitle')!.value.trim();
    if (!titleValue) {
      hostStarting = false;
      startButton.disabled = false;
      setStudioStatus('NAME THE LIVE FIRST.', true);
      return;
    }
    const { data, error } = await supabase.rpc('rb_start_live_stream', {
      p_title: titleValue,
      p_description: document.querySelector<HTMLTextAreaElement>('#liveDescription')!.value.trim() || null,
      p_category: selectedCategory,
      p_access_type: document.querySelector<HTMLSelectElement>('#liveAccess')!.value,
      p_price_cents: price,
      p_thumbnail_url: null,
      p_cover_url: null,
      p_is_chat_enabled: document.querySelector<HTMLInputElement>('#liveChatEnabled')!.checked,
      p_is_cohost_enabled: document.querySelector<HTMLInputElement>('#liveCohostEnabled')!.checked,
      p_recording_enabled: document.querySelector<HTMLInputElement>('#liveRecordingEnabled')!.checked,
      p_transcription_enabled: document.querySelector<HTMLInputElement>('#liveCaptionsEnabled')!.checked
    });
    if (error) {
      hostStarting = false;
      startButton.disabled = false;
      setStudioStatus(error.message, true);
      return;
    }
    activeHostStream = (data as Row).stream;
    try {
      await connectHost(activeHostStream);
      await refreshUniverse();
    } catch (connectError) {
      await stopHostMedia();
      if (activeHostStream?.id) await supabase.rpc('rb_end_live_stream', { p_stream_id: activeHostStream.id });
      activeHostStream = null;
      startButton.disabled = false;
      setStudioStatus(connectError instanceof Error ? connectError.message : 'Camera or live room failed.', true);
    } finally {
      hostStarting = false;
    }
  };

  catalogChannel = supabase.channel('rich-live-catalog')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => void refreshUniverse())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_recordings' }, () => void refreshUniverse())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_purchases' }, () => void refreshUniverse())
    .subscribe();

  const cleanup = async () => {
    if (disposed) return;
    disposed = true;
    await stopHostMedia();
    await disconnectViewer();
    if (roomChannel) await supabase.removeChannel(roomChannel);
    if (catalogChannel) await supabase.removeChannel(catalogChannel);
    roomChannel = null;
    catalogChannel = null;
    document.querySelectorAll<HTMLMediaElement>('video,audio').forEach((media) => {
      media.pause();
      media.removeAttribute('src');
      media.load();
    });
  };
  window.addEventListener('pagehide', () => void cleanup(), { once: true });
  window.addEventListener('beforeunload', () => void cleanup(), { once: true });

  render();
  if (active) await open(active);
}

function hero(row: Row, signedIn: boolean) {
  const source = row.cover_url || row.thumbnail_url || '/images/live/categories/family-bizness.svg';
  const media = row.recording_url
    ? `<video class="media-ultimate__hero-media live-inline-video" controls playsinline disablepictureinpicture poster="${esc(source)}" src="${esc(row.recording_url)}"></video>`
    : `<img class="media-ultimate__hero-media" src="${esc(source)}" alt="">`;
  const currentlyLive = isLive(row);
  const creatorId = row.creator_id || row.user_id || '';
  return `${media}<div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">${currentlyLive ? '● WE LIT🔥' : 'WE 🔥📺'} · ${esc(row.metadata?.slang_label || row.display_room_name || row.category || 'FAMILY BIZNESS')}</span><h2>${esc(row.title || 'Family Bizness')}</h2><p>${esc(row.description || 'Pop in and see what type time the Rich Bizness universe on.')}</p><div class="media-ultimate__actions">${currentlyLive ? `<button id="popInBtn" class="media-ultimate__btn primary" type="button">${signedIn ? 'POP IN' : 'TAP IN TO POP IN'}</button>` : '<a class="media-ultimate__btn primary" href="/watch.html">WATCH REPLAY</a>'}${creatorId ? `<a class="media-ultimate__btn" href="/profile.html?id=${esc(creatorId)}">CREATOR</a>` : ''}<button id="reactBtn" class="media-ultimate__btn">💨 REACT</button><button id="alertBtn" class="media-ultimate__btn">🔔 STAY LOCKED</button></div></div>`;
}

function card(row: Row, badge: string) {
  return `<article class="media-ultimate__card" data-id="${esc(row.id)}"><img src="${esc(row.thumbnail_url || row.cover_url || '/images/live/categories/family-bizness.svg')}" alt=""><div class="media-ultimate__card-body"><h4>${esc(row.title || row.subtitle || 'Family Bizness')}</h4><p>${esc(row.description || row.metadata?.slang_label || row.category || row.card_type || 'Bizness Party')}</p><div class="media-ultimate__meta"><span>${esc(badge)}</span><span>${Number(row.viewer_count ?? row.view_count ?? 0).toLocaleString()} watching</span></div></div></article>`;
}

function burst(value: string) {
  const element = document.createElement('span');
  element.textContent = value;
  element.style.cssText = 'position:fixed;right:8vw;bottom:15vh;z-index:999;font-size:2.4rem;animation:portalSpark 2s ease-out forwards';
  document.body.append(element);
  window.setTimeout(() => element.remove(), 2000);
}
