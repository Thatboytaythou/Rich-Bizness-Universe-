import { Room, RoomEvent, Track, createLocalAudioTrack, createLocalVideoTrack, type LocalAudioTrack, type LocalVideoTrack } from 'livekit-client';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import '../../styles/live-studio.css';

type Row = Record<string, any>;
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const money = (v: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v ?? 0) / 100);

async function requireRichSession() {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }
  if (!session) {
    location.replace('/tap-in.html?next=%2Flive.html');
    return null;
  }
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    await supabase.auth.signOut({ scope: 'local' });
    location.replace('/tap-in.html?next=%2Flive.html&reason=session');
    return null;
  }
  return session;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const session = await requireRichSession();
  if (!session) return;

  const [{ data: universe, error: universeError }, { data: studio, error: studioError }] = await Promise.all([
    supabase.rpc('rb_live_watch_podcast_snapshot', {}),
    supabase.rpc('rb_go_live_bootstrap', {})
  ]);
  if (universeError) throw universeError;
  if (studioError) throw studioError;

  const snap = (universe ?? {}) as Row;
  const setup = (studio ?? {}) as Row;
  const streams = (snap.live ?? []) as Row[];
  const recordings = (snap.recordings ?? []) as Row[];
  const cards = (snap.live_cards ?? []) as Row[];
  const purchases = (snap.live_purchases ?? []) as Row[];
  const categories = (setup.categories ?? []) as Row[];
  const vip = new Set(((snap.vip_access ?? []) as Row[]).map((v) => String(v.stream_id)));
  const alerts = new Set(((snap.live_alerts ?? []) as Row[]).map((v) => String(v.creator_id ?? v.stream_id)));
  const profile = setup.profile ?? snap.profile ?? {};

  let lane = 'live';
  let active: Row | null = streams.find((s) => String(s.status).toLowerCase() === 'live') ?? streams[0] ?? recordings[0] ?? null;
  let channel: any = null;
  let hostRoom: Room | null = null;
  let hostVideo: LocalVideoTrack | null = null;
  let hostAudio: LocalAudioTrack | null = null;
  let selectedCategory = String(categories[0]?.slug ?? 'family-bizness');
  let activeHostStream: Row | null = setup.active_stream ?? null;

  root.innerHTML = `<main class="media-ultimate"><div class="media-ultimate__wrap">
    <header class="media-ultimate__head">
      <a href="/portal.html">←</a>
      <div><p>RICH BIZNESS LLC • GLOBAL LIVE</p><h1>WE LIT🔥</h1></div>
      <span class="media-ultimate__status">● TAPPED IN</span>
    </header>

    <section id="liveHero" class="media-ultimate__hero">${active ? hero(active) : '<div class="media-ultimate__empty">Ain’t nobody live yet. Light this bitch up.</div>'}</section>

    <section class="media-ultimate__metrics">
      <article><small>WE LIT🔥</small><strong>${streams.filter((s) => String(s.status).toLowerCase() === 'live').length}</strong></article>
      <article><small>NOW WATCHING</small><strong>${streams.reduce((n, s) => n + Number(s.viewer_count ?? 0), 0).toLocaleString()}</strong></article>
      <article><small>VIP RICH ROOMS</small><strong>${vip.size}</strong></article>
      <article><small>CREATOR BAG</small><strong>${money(streams.reduce((n, s) => n + Number(s.total_revenue_cents ?? 0), 0))}</strong></article>
    </section>

    <nav class="media-ultimate__tabs">
      ${[['live', 'WE LIT🔥'], ['upcoming', 'GET RIGHT'], ['vip', 'VIP RICH ROOMS'], ['replays', 'PARTY’S OVER'], ['network', 'WE 🔥📺']]
        .map(([v, l], i) => `<button class="${i === 0 ? 'active' : ''}" data-lane="${v}">${l}</button>`).join('')}
    </nav>

    <section class="media-ultimate__section">
      <header>
        <div><h3 id="laneTitle">WE LIT🔥</h3><p>Pop in, build the room, call the madness, co-host, react, chat, record and get paid.</p></div>
        <button id="goLiveButton" class="live-studio-launch" type="button">GO LIVE 🔴</button>
      </header>
      <div id="liveGrid" class="media-ultimate__grid"></div>
    </section>

    <section class="media-ultimate__split">
      <article class="media-ultimate__panel"><header><h4>LIVE CONTROLS</h4></header><div id="liveDetail" class="media-ultimate__list"></div></article>
      <article class="media-ultimate__panel"><header><h4>RICH LIVE CHAT</h4></header><div id="liveChat" class="media-ultimate__chat"><div class="media-ultimate__empty">Pop in a room.</div></div><form id="chatForm" class="media-ultimate__form"><input id="chatInput" maxlength="800" placeholder="Say that shyt..."><button class="media-ultimate__btn primary">DROP IT</button></form></article>
    </section>

    <section class="media-ultimate__section"><header><div><h3>YOUR RICH ACCESS</h3><p>Unlocked rooms, VIP passes and alerts tied to your Rich ID.</p></div></header><div class="media-ultimate__grid">${[...purchases.slice(0, 4), ...((snap.vip_access ?? []) as Row[]).slice(0, 4)].map((r) => card(r, 'UNLOCKED')).join('') || '<div class="media-ultimate__empty">No premium rooms unlocked yet.</div>'}</div></section>
  </div>

  <dialog id="goLiveStudio" class="live-studio">
    <div class="live-studio__shell">
      <section id="studioPreview" class="live-studio__preview">
        <div class="live-studio__preview-empty"><strong>PREVIEW CAM</strong><p>Pick your lane, check the camera, then light this bitch up.</p></div>
        <div class="live-studio__preview-overlay"><small id="previewCategory">${esc(categories[0]?.slang_label ?? 'FAMILY BIZNESS')}</small><h3 id="previewTitle">Your Live Title</h3></div>
      </section>
      <aside class="live-studio__panel">
        <header class="live-studio__top"><div><p>RICH BIZNESS LLC</p><h2>GO LIVE 🔴</h2></div><button id="closeStudio" class="live-studio__close" type="button">×</button></header>
        <form id="goLiveForm" class="live-studio__form">
          <label>WHAT WE CALLIN’ THIS LIVE?<input id="liveTitle" maxlength="120" required value="${esc(activeHostStream?.title ?? 'Family Bizness')}" placeholder="Family Bizness"></label>
          <label>WHAT’S THE MOVE?<textarea id="liveDescription" maxlength="1200" placeholder="Tell everybody what type time we on...">${esc(activeHostStream?.description ?? '')}</textarea></label>
          <label>PICK YOUR LIVE LANE<div id="categoryGrid" class="live-category-grid">${categories.map((c, i) => `<button class="live-category ${i === 0 ? 'active' : ''}" type="button" data-category="${esc(c.slug)}" style="background-image:url('${esc(c.hero_asset_url)}')"><span>${esc(c.icon)}</span><strong>${esc(c.slang_label)}</strong><small>${esc(c.label)}</small></button>`).join('')}</div></label>
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
          <button id="startLiveButton" class="live-studio__submit" type="submit">LIGHT THIS BITCH UP</button>
          <p id="studioStatus" class="live-studio__status">TAP IN READY • CAMERA AND MIC ASK WHEN YOU START</p>
        </form>
      </aside>
    </div>
  </dialog>
  </main>`;

  const grid = document.querySelector<HTMLElement>('#liveGrid')!;
  const title = document.querySelector<HTMLElement>('#laneTitle')!;
  const detail = document.querySelector<HTMLElement>('#liveDetail')!;
  const chat = document.querySelector<HTMLElement>('#liveChat')!;
  const studioDialog = document.querySelector<HTMLDialogElement>('#goLiveStudio')!;
  const studioPreview = document.querySelector<HTMLElement>('#studioPreview')!;
  const studioStatus = document.querySelector<HTMLElement>('#studioStatus')!;

  const setStudioStatus = (message: string, error = false) => {
    studioStatus.textContent = message;
    studioStatus.dataset.error = String(error);
  };

  const rows = () => lane === 'replays' ? recordings : lane === 'network' ? cards : streams.filter((s) => lane === 'live' ? String(s.status).toLowerCase() === 'live' : lane === 'upcoming' ? ['draft', 'scheduled', 'upcoming', 'ready'].includes(String(s.status).toLowerCase()) : s.is_vip_enabled || vip.has(String(s.id)));

  const render = () => {
    const list = rows();
    grid.innerHTML = list.length ? list.map((r) => card(r, lane.toUpperCase())).join('') : '<div class="media-ultimate__empty">Ain’t nothing in this lane yet.</div>';
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => el.onclick = () => {
      const row = list.find((x) => String(x.id) === el.dataset.id);
      if (row) void open(row);
    });
  };

  const loadChat = async () => {
    if (!active || lane === 'replays' || lane === 'network') {
      chat.innerHTML = '<div class="media-ultimate__empty">Chat opens when you pop in a live room.</div>';
      return;
    }
    const { data } = await supabase.from('live_chat_messages').select('id,display_name,username,message,body,is_pinned,created_at').eq('stream_id', active.id).eq('is_deleted', false).order('created_at', { ascending: true }).limit(120);
    chat.innerHTML = (data ?? []).map((m: any) => `<article><p>${esc(m.message || m.body)}</p><small>${esc(m.display_name || m.username || 'Rich Member')}${m.is_pinned ? ' · PINNED' : ''}</small></article>`).join('') || '<div class="media-ultimate__empty">Start talkin’ that shyt.</div>';
    chat.scrollTop = chat.scrollHeight;
  };

  const open = async (r: Row) => {
    active = r;
    document.querySelector<HTMLElement>('#liveHero')!.innerHTML = hero(r);
    detail.innerHTML = [
      ['BIZNESS PARTY', `${r.metadata?.slang_label || r.display_room_name || r.category || 'Family Bizness'} · ${r.access_type || 'free'}`],
      ['STREAM QUALITY', `${r.stream_protocol || 'LiveKit'} · ${r.latency_mode || 'interactive'} · ${r.recording_enabled ? 'replay on' : 'replay off'}`],
      ['NOW WATCHING', `${Number(r.viewer_count ?? r.view_count ?? 0).toLocaleString()} watching · ${Number(r.peak_viewers ?? 0).toLocaleString()} peak`],
      ['CREATOR BAG', `${money(r.price_cents ?? 0)} entry · ${money(r.total_revenue_cents ?? 0)} earned`],
      ['ROOM ENERGY', `${r.is_chat_enabled ? 'chat lit' : 'chat off'} · ${r.is_cohost_enabled ? 'co-host ready' : 'solo'} · ${r.is_vip_enabled ? 'VIP' : 'open room'}`]
    ].map(([a, b]) => `<div class="media-ultimate__row"><div><h5>${a}</h5><p>${esc(b)}</p></div></div>`).join('');
    if (channel) await supabase.removeChannel(channel);
    await loadChat();
    if (lane !== 'replays' && lane !== 'network') channel = supabase.channel(`ultimate-live:${r.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${r.id}` }, () => void loadChat()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_reactions', filter: `stream_id=eq.${r.id}` }, (p) => burst(String((p.new as any).reaction ?? '💨'))).subscribe();
    bindHero(r);
  };

  const bindHero = (r: Row) => {
    document.querySelector<HTMLButtonElement>('#alertBtn')?.addEventListener('click', async () => {
      if (alerts.has(String(r.creator_id))) {
        await supabase.from('live_alert_subscriptions').delete().eq('user_id', session.user.id).eq('creator_id', r.creator_id);
        alerts.delete(String(r.creator_id));
      } else {
        await supabase.from('live_alert_subscriptions').insert({ user_id: session.user.id, creator_id: r.creator_id, alert_level: 'all' });
        alerts.add(String(r.creator_id));
      }
      await open(r);
    });
    document.querySelector<HTMLButtonElement>('#reactBtn')?.addEventListener('click', async () => {
      await supabase.from('live_reactions').insert({ stream_id: r.id, user_id: session.user.id, reaction: '💨' });
      burst('💨');
    });
    document.querySelector<HTMLButtonElement>('#popInBtn')?.addEventListener('click', () => void popIn(r));
  };

  const tokenFor = async (stream: Row, role: 'host' | 'viewer') => {
    const current = (await supabase.auth.getSession()).data.session;
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
      const room = new Room({ adaptiveStream: true, dynacast: true });
      await room.connect(payload.url, payload.token);
      document.querySelector<HTMLElement>('#liveHero')!.innerHTML = `<div id="viewerStage" class="media-ultimate__hero-media"></div><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">NOW WATCHING · ${esc(stream.display_room_name || stream.category || 'BIZNESS PARTY')}</span><h2>${esc(stream.title)}</h2><p>You popped in. WE LIT🔥</p></div>`;
      const stage = document.querySelector<HTMLElement>('#viewerStage')!;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) stage.append(track.attach());
      });
    } catch (error) {
      detail.innerHTML = `<div class="media-ultimate__empty">${esc(error instanceof Error ? error.message : 'Could not pop in.')}</div>`;
    }
  };

  const connectHost = async (stream: Row) => {
    setStudioStatus('CHECKING CAMERA + MIC...');
    const payload = await tokenFor(stream, 'host');
    hostRoom = new Room({ adaptiveStream: true, dynacast: true });
    await hostRoom.connect(payload.url, payload.token);
    hostVideo = await createLocalVideoTrack({ facingMode: 'user', resolution: { width: 1280, height: 720 } });
    hostAudio = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    await hostRoom.localParticipant.publishTrack(hostVideo, { simulcast: true });
    await hostRoom.localParticipant.publishTrack(hostAudio);
    studioPreview.innerHTML = `<div id="hostVideoMount"></div><span class="live-host-badge">● WE LIT🔥</span><div class="live-host-controls"><button id="toggleMic" type="button">🎙️</button><button id="toggleCam" type="button">📹</button><button id="endLive" class="danger" type="button">■</button></div><div class="live-studio__preview-overlay"><small>${esc(stream.display_room_name || stream.metadata?.slang_label || 'BIZNESS PARTY')}</small><h3>${esc(stream.title)}</h3></div>`;
    document.querySelector<HTMLElement>('#hostVideoMount')!.append(hostVideo.attach());
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
    hostVideo?.stop();
    hostAudio?.stop();
    await hostRoom?.disconnect();
    hostRoom = null;
    hostVideo = null;
    hostAudio = null;
    const { error } = await supabase.rpc('rb_end_live_stream', { p_stream_id: stream.id });
    if (error) return setStudioStatus(error.message, true);
    setStudioStatus('PARTY’S OVER — REPLAY GETTIN’ RIGHT');
    window.setTimeout(() => location.reload(), 900);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => button.onclick = () => {
    lane = button.dataset.lane!;
    document.querySelectorAll('[data-lane]').forEach((node) => node.classList.toggle('active', node === button));
    title.textContent = button.textContent ?? 'WE LIT🔥';
    render();
    const first = rows()[0];
    if (first) void open(first);
  });

  document.querySelector<HTMLFormElement>('#chatForm')!.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || lane === 'replays' || lane === 'network') return;
    const input = document.querySelector<HTMLInputElement>('#chatInput')!;
    const body = input.value.trim();
    if (!body) return;
    const { error } = await supabase.from('live_chat_messages').insert({ stream_id: active.id, user_id: session.user.id, username: profile.username, display_name: profile.display_name, message: body, body });
    if (!error) input.value = '';
  };

  document.querySelector<HTMLButtonElement>('#goLiveButton')!.onclick = () => studioDialog.showModal();
  document.querySelector<HTMLButtonElement>('#closeStudio')!.onclick = () => {
    if (!hostRoom) studioDialog.close();
  };
  studioDialog.addEventListener('cancel', (event) => {
    if (hostRoom) event.preventDefault();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => button.onclick = () => {
    selectedCategory = button.dataset.category!;
    document.querySelectorAll('[data-category]').forEach((node) => node.classList.toggle('active', node === button));
    const category = categories.find((c) => c.slug === selectedCategory);
    document.querySelector<HTMLElement>('#previewCategory')!.textContent = category?.slang_label ?? 'BIZNESS PARTY';
    if (!hostRoom) studioPreview.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.8)),url('${category?.hero_asset_url ?? ''}')`;
  });

  document.querySelector<HTMLInputElement>('#liveTitle')!.addEventListener('input', (event) => {
    document.querySelector<HTMLElement>('#previewTitle')!.textContent = (event.target as HTMLInputElement).value || 'Your Live Title';
  });

  document.querySelector<HTMLFormElement>('#goLiveForm')!.onsubmit = async (event) => {
    event.preventDefault();
    const startButton = document.querySelector<HTMLButtonElement>('#startLiveButton')!;
    startButton.disabled = true;
    setStudioStatus('GETTIN’ THE BIZNESS PARTY RIGHT...');
    const price = Math.round(Number(document.querySelector<HTMLInputElement>('#livePrice')!.value || 0) * 100);
    const { data, error } = await supabase.rpc('rb_start_live_stream', {
      p_title: document.querySelector<HTMLInputElement>('#liveTitle')!.value.trim(),
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
      startButton.disabled = false;
      setStudioStatus(error.message, true);
      return;
    }
    activeHostStream = (data as Row).stream;
    try {
      await connectHost(activeHostStream);
    } catch (connectError) {
      startButton.disabled = false;
      setStudioStatus(connectError instanceof Error ? connectError.message : 'Camera or live room failed.', true);
    }
  };

  render();
  if (active) await open(active);
}

function hero(r: Row) {
  const media = r.recording_url ? `<video class="media-ultimate__hero-media" controls playsinline poster="${esc(r.thumbnail_url || r.cover_url)}" src="${esc(r.recording_url)}"></video>` : `<img class="media-ultimate__hero-media" src="${esc(r.cover_url || r.thumbnail_url || '/images/live/family-bizness.svg')}" alt="">`;
  const isLive = String(r.status).toLowerCase() === 'live';
  return `${media}<div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">${isLive ? '● WE LIT🔥' : 'WE 🔥📺'} · ${esc(r.metadata?.slang_label || r.display_room_name || r.category || 'FAMILY BIZNESS')}</span><h2>${esc(r.title || 'Family Bizness')}</h2><p>${esc(r.description || 'Pop in and see what type time the Rich Bizness universe on.')}</p><div class="media-ultimate__actions">${isLive ? '<button id="popInBtn" class="media-ultimate__btn primary" type="button">POP IN</button>' : '<button class="media-ultimate__btn primary" type="button">WATCH REPLAY</button>'}<a class="media-ultimate__btn" href="/profile.html?id=${esc(r.creator_id)}">CREATOR</a><button id="reactBtn" class="media-ultimate__btn">💨 REACT</button><button id="alertBtn" class="media-ultimate__btn">🔔 STAY LOCKED</button></div></div>`;
}

function card(r: Row, badge: string) {
  return `<article class="media-ultimate__card" data-id="${esc(r.id)}"><img src="${esc(r.thumbnail_url || r.cover_url || '/images/live/family-bizness.svg')}" alt=""><div class="media-ultimate__card-body"><h4>${esc(r.title || r.subtitle || 'Family Bizness')}</h4><p>${esc(r.description || r.metadata?.slang_label || r.category || r.card_type || 'Bizness Party')}</p><div class="media-ultimate__meta"><span>${badge}</span><span>${Number(r.viewer_count ?? r.view_count ?? 0).toLocaleString()} watching</span></div></div></article>`;
}

function burst(value: string) {
  const element = document.createElement('span');
  element.textContent = value;
  element.style.cssText = 'position:fixed;right:8vw;bottom:15vh;z-index:999;font-size:2.4rem;animation:portalSpark 2s ease-out forwards';
  document.body.append(element);
  setTimeout(() => element.remove(), 2000);
}
