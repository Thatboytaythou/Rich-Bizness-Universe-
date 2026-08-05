import { Room, RoomEvent, Track, createLocalAudioTrack, createLocalVideoTrack, type LocalAudioTrack, type LocalVideoTrack } from 'livekit-client';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import '../../styles/live-studio.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0) / 100);
const liveNow = (row: Row) => String(row.status ?? '').toLowerCase() === 'live';
const safeMedia = (value: unknown) => { try { const url = new URL(String(value ?? ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

function lockMedia(element: HTMLMediaElement, className: string) {
  element.className = className;
  element.setAttribute('playsinline', 'true');
  element.setAttribute('webkit-playsinline', 'true');
  element.setAttribute('controlsList', 'nodownload noremoteplayback');
  element.disableRemotePlayback = true;
  if (element instanceof HTMLVideoElement) element.disablePictureInPicture = true;
  return element;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const mountEpoch = root.dataset.pageEpoch ?? '';
  const isCurrent = () => !disposed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === 'rich-bizness-live-v5';

  const auth = await getAuthSnapshot();
  if (root.dataset.pageEpoch !== mountEpoch) return;
  const user = auth.session?.user ?? null;
  const requireUser = () => {
    if (user) return true;
    location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  };

  let disposed = false;
  let snapshotBusy = false;
  let snapshotQueued = false;
  let snapshotEpoch = 0;
  let actionBusy = false;
  let active: Row | null = null;
  let lane = 'live';
  let profile: Row = {};
  let metrics: Row = {};
  let streams: Row[] = [];
  let recordings: Row[] = [];
  let chatRows: Row[] = [];
  let activityRows: Row[] = [];
  let memberRows: Row[] = [];
  let tipRows: Row[] = [];
  let purchaseRows: Row[] = [];
  let alerts = new Set<string>();
  let categories: Row[] = [];
  let selectedCategory = 'family-bizness';
  let activeHostStream: Row | null = null;
  let catalogChannel: Channel | null = null;
  let roomChannel: Channel | null = null;
  let viewerRoom: Room | null = null;
  let viewerJoinedStreamId: string | null = null;
  let viewerDisconnecting = false;
  let hostRoom: Room | null = null;
  let hostVideo: LocalVideoTrack | null = null;
  let hostAudio: LocalAudioTrack | null = null;
  let heartbeat = 0;
  let hostStarting = false;
  const viewerElements = new Set<HTMLMediaElement>();

  const setStreamUrl = (stream: Row | null) => {
    if (!isCurrent()) return;
    const url = new URL(location.href);
    if (stream?.id) url.searchParams.set('stream', String(stream.id));
    else url.searchParams.delete('stream');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const recordViewerLeave = async (streamId: string | null, source: string) => {
    if (!user || !streamId) return;
    const { error } = await supabase.rpc('rb_live_action', { p_action: 'leave', p_stream_id: streamId, p_payload: { source } });
    if (error) console.error('Live leave action failed', error);
  };

  const disconnectViewer = async (record = true, source = 'livekit-viewer') => {
    if (viewerDisconnecting) return;
    viewerDisconnecting = true;
    const room = viewerRoom;
    const joinedStreamId = viewerJoinedStreamId;
    viewerRoom = null;
    viewerJoinedStreamId = null;
    try {
      if (record) await recordViewerLeave(joinedStreamId, source);
      viewerElements.forEach((element) => { element.pause(); element.srcObject = null; element.remove(); });
      viewerElements.clear();
      if (room) await room.disconnect().catch(() => undefined);
    } finally {
      viewerDisconnecting = false;
    }
  };

  const stopHost = async () => {
    if (heartbeat) window.clearInterval(heartbeat);
    heartbeat = 0;
    hostVideo?.detach().forEach((element) => element.remove());
    hostAudio?.detach().forEach((element) => element.remove());
    hostVideo?.stop();
    hostAudio?.stop();
    hostVideo = null;
    hostAudio = null;
    if (hostRoom) await hostRoom.disconnect().catch(() => undefined);
    hostRoom = null;
  };

  const initialStudio = user ? await supabase.rpc('rb_go_live_bootstrap', {}) : { data: {}, error: null };
  if (initialStudio.error) throw initialStudio.error;
  if (root.dataset.pageEpoch !== mountEpoch) return;
  categories = ((initialStudio.data as Row)?.categories ?? []) as Row[];
  activeHostStream = (initialStudio.data as Row)?.active_stream ?? null;
  selectedCategory = String(activeHostStream?.category ?? categories[0]?.slug ?? selectedCategory);

  root.innerHTML = `<main class="media-ultimate live-mobile-safe live-command-v4"><div class="media-ultimate__wrap">
    <header class="media-ultimate__head"><a href="/portal.html" aria-label="Back to Portal">←</a><div><p>RICH BIZNESS LLC • GLOBAL LIVE NETWORK</p><h1>WE LIT🔥</h1></div><span class="media-ultimate__status">${user ? '● RICH ID CONNECTED' : 'PUBLIC SIGNAL'}</span></header>
    <nav class="live-network-rail" aria-label="Live universe connections"><a href="/feed.html"><b>◫</b><span>FEED</span></a><a href="/watch.html"><b>📺</b><span>WATCH</span></a><a href="/podcast.html"><b>◌</b><span>PODCAST</span></a><a href="/radio.html"><b>◉</b><span>RADIO</span></a><a href="/music.html"><b>♪</b><span>MUSIC</span></a><a href="/sports.html"><b>🏆</b><span>SPORTS</span></a></nav>
    <section id="liveHero" class="media-ultimate__hero live-hero-clean"></section>
    <section id="liveMetrics" class="media-ultimate__metrics"></section>
    <nav class="media-ultimate__tabs">${[['live','WE LIT🔥'],['upcoming','GET RIGHT'],['vip','VIP RICH ROOMS']].map(([value,label],index)=>`<button class="${index===0?'active':''}" data-lane="${value}">${label}</button>`).join('')}<a class="media-ultimate__btn" href="/watch.html?lane=live">PARTY’S OVER → WE 🔥📺</a></nav>
    <section class="media-ultimate__section"><header><div><h3 id="laneTitle">WE LIT🔥</h3><p>LiveKit rooms, reactions, chat, member activity, VIP access and creator earnings—one live broadcast owner.</p></div><div class="live-command-actions"><a class="media-ultimate__btn" href="/upload.html?route=live-thumbnail">THUMBNAIL</a><a class="media-ultimate__btn" href="/creator.html">CREATOR</a><button id="goLiveButton" class="live-studio-launch" type="button">GO LIVE 🔴</button></div></header><div id="liveGrid" class="media-ultimate__grid"></div></section>
    <section class="media-ultimate__split live-command-split"><article class="media-ultimate__panel"><header><h4>ROOM INTELLIGENCE</h4></header><div id="liveDetail" class="media-ultimate__list"></div><div id="liveActivity" class="live-activity-rail"></div></article><article class="media-ultimate__panel"><header><h4>RICH LIVE CHAT</h4></header><div id="liveChat" class="media-ultimate__chat"><div class="media-ultimate__empty">Pop in a room.</div></div><form id="chatForm" class="media-ultimate__form"><input id="chatInput" maxlength="800" placeholder="Say that shyt..." ${user?'':'disabled'}><button class="media-ultimate__btn primary">${user?'DROP IT':'TAP IN'}</button></form></article></section>
  </div>
  <dialog id="goLiveStudio" class="live-studio"><div class="live-studio__shell"><section id="studioPreview" class="live-studio__preview"><div class="live-studio__preview-empty"><strong>PREVIEW CAM</strong><p>Pick your lane, check the camera, then light this shyt up.</p></div><div class="live-studio__preview-overlay"><small id="previewCategory">${esc(categories.find((category)=>category.slug===selectedCategory)?.slang_label ?? 'FAMILY BIZNESS')}</small><h3 id="previewTitle">${esc(activeHostStream?.title ?? 'Your Live Title')}</h3></div></section><aside class="live-studio__panel"><header class="live-studio__top"><div><p>RICH BIZNESS LLC</p><h2>GO LIVE 🔴</h2></div><button id="closeStudio" class="live-studio__close" type="button">×</button></header><form id="goLiveForm" class="live-studio__form"><label>WHAT WE CALLIN’ THIS LIVE?<input id="liveTitle" maxlength="120" required value="${esc(activeHostStream?.title ?? 'Family Bizness')}"></label><label>WHAT’S THE MOVE?<textarea id="liveDescription" maxlength="1200">${esc(activeHostStream?.description ?? '')}</textarea></label><label>PICK YOUR LIVE LANE<div class="live-category-grid">${categories.map((category)=>`<button class="live-category ${category.slug===selectedCategory?'active':''}" type="button" data-category="${esc(category.slug)}" style="background-image:url('${esc(safeMedia(category.hero_asset_url))}')"><span>${esc(category.icon)}</span><strong>${esc(category.slang_label)}</strong><small>${esc(category.label)}</small></button>`).join('')}</div></label><div class="live-studio__toggles"><label>ROOM ACCESS<select id="liveAccess"><option value="free">FREE ROOM</option><option value="vip">VIP ROOM</option><option value="paid">PAID ROOM</option><option value="private">PRIVATE</option></select></label><label>PRICE<input id="livePrice" type="number" min="0" step="1" value="0"></label></div><div class="live-studio__toggles"><label class="live-studio__toggle"><input id="liveChatEnabled" type="checkbox" checked> LIVE CHAT</label><label class="live-studio__toggle"><input id="liveCohostEnabled" type="checkbox" checked> CO-HOST</label><label class="live-studio__toggle"><input id="liveRecordingEnabled" type="checkbox" checked> SAVE REPLAY</label><label class="live-studio__toggle"><input id="liveCaptionsEnabled" type="checkbox"> CAPTIONS</label></div><button id="startLiveButton" class="live-studio__submit">LIGHT THIS SHYT UP</button><p id="studioStatus" class="live-studio__status">CAMERA + MIC ASK WHEN YOU START</p></form></aside></div></dialog></main>`;

  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const heroEl = q<HTMLElement>('#liveHero');
  const metricsEl = q<HTMLElement>('#liveMetrics');
  const gridEl = q<HTMLElement>('#liveGrid');
  const detailEl = q<HTMLElement>('#liveDetail');
  const chatEl = q<HTMLElement>('#liveChat');
  const activityEl = q<HTMLElement>('#liveActivity');
  const laneTitle = q<HTMLElement>('#laneTitle');
  const studio = q<HTMLDialogElement>('#goLiveStudio');
  const studioPreview = q<HTMLElement>('#studioPreview');
  const studioStatus = q<HTMLElement>('#studioStatus');
  const startButton = q<HTMLButtonElement>('#startLiveButton');

  const showActionError = (message: string) => {
    if (!isCurrent()) return;
    detailEl.innerHTML = `<div class="media-ultimate__empty">${esc(message)}</div>`;
  };

  const runLiveAction = async (action: string, payload: Row = {}) => {
    if (!active?.id || !requireUser() || !isCurrent()) return null;
    if (actionBusy) return null;
    actionBusy = true;
    try {
      const { data, error } = await supabase.rpc('rb_live_action', { p_action: action, p_stream_id: active.id, p_payload: payload });
      if (error) {
        showActionError(error.message || 'Live action failed.');
        return null;
      }
      return isCurrent() ? ((data ?? {}) as Row) : null;
    } finally {
      actionBusy = false;
    }
  };

  const rows = () => streams.filter((stream)=> lane === 'live' ? liveNow(stream) : lane === 'upcoming' ? ['draft','scheduled','upcoming','ready'].includes(String(stream.status).toLowerCase()) : Boolean(stream.is_vip_enabled) || ['vip','paid','private'].includes(String(stream.access_type)));
  const renderCard = (row: Row) => `<article class="media-ultimate__card" data-id="${esc(row.id)}"><img src="${esc(safeMedia(row.thumbnail_url || row.cover_url) || '/images/live/categories/family-bizness.svg')}" alt=""><div class="media-ultimate__card-body"><h4>${esc(row.title || 'Family Bizness')}</h4><p>${esc(row.description || row.display_room_name || row.category || 'Bizness Party')}</p><div class="media-ultimate__meta"><span>${liveNow(row)?'● LIVE':lane.toUpperCase()}</span><span>${Number(row.viewer_count ?? row.view_count ?? 0).toLocaleString()} watching</span></div></div></article>`;
  const hero = (row: Row) => {
    const poster=safeMedia(row.cover_url||row.thumbnail_url)||'/images/live/categories/family-bizness.svg';
    const gated=['vip','paid','private'].includes(String(row.access_type));
    const host=user&&String(row.creator_id)===String(user.id);
    return `<img class="media-ultimate__hero-media" src="${esc(poster)}" alt=""><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">● WE LIT🔥 · ${esc(row.display_room_name||row.category||'FAMILY BIZNESS')}</span><h2>${esc(row.title||'Family Bizness')}</h2><p>${esc(row.description||'Pop in and see what type time the Rich Bizness universe on.')}</p><div class="media-ultimate__actions"><button id="popInBtn" class="media-ultimate__btn primary">${user?'POP IN':'TAP IN TO POP IN'}</button>${gated&&!host?`<button id="buyAccessBtn" class="media-ultimate__btn">UNLOCK ${money(row.price_cents??0)}</button>`:''}${!host?'<button id="tipBtn" class="media-ultimate__btn">💰 TIP</button>':''}<button id="reactBtn" class="media-ultimate__btn">💨 REACT</button><button id="alertBtn" class="media-ultimate__btn">${alerts.has(String(row.creator_id))?'🔔 LOCKED IN':'🔔 STAY LOCKED'}</button><button id="shareBtn" class="media-ultimate__btn">↗ SHARE</button><a class="media-ultimate__btn" href="/watch.html?lane=live">WE 🔥📺 REPLAYS</a></div></div>`;
  };

  const renderRoom = () => {
    if (!isCurrent()) return;
    metricsEl.innerHTML = `<article><small>WE LIT🔥</small><strong>${Number(metrics.live_count??0)}</strong></article><article><small>NOW WATCHING</small><strong>${Number(metrics.viewer_count??0).toLocaleString()}</strong></article><article><small>ROOM ENERGY</small><strong>${Number(metrics.reaction_count??0).toLocaleString()}</strong></article><article><small>CREATOR BAG</small><strong>${money(metrics.revenue_cents??0)}</strong></article>`;
    const list=rows();
    gridEl.innerHTML=list.length?list.map(renderCard).join(''):'<div class="media-ultimate__empty">Ain’t nothing in this lane yet.</div>';
    gridEl.querySelectorAll<HTMLElement>('[data-id]').forEach((card)=>card.onclick=()=>{const row=list.find((item)=>String(item.id)===card.dataset.id);if(row)void open(row);});
    if (!active || !liveNow(active)) { heroEl.innerHTML='<div class="media-ultimate__empty">Ain’t nobody live yet. Light this shyt up.</div>'; detailEl.innerHTML=''; return; }
    heroEl.innerHTML=hero(active);
    detailEl.innerHTML=[['BIZNESS PARTY',`${active.display_room_name||active.category||'Family Bizness'} · ${active.access_type||'free'}`],['STREAM QUALITY',`${active.stream_protocol||'LiveKit'} · ${active.latency_mode||'interactive'} · ${active.recording_enabled?'replay on':'replay off'}`],['NOW WATCHING',`${Number(metrics.member_count??active.viewer_count??active.view_count??0).toLocaleString()} active · ${Number(active.peak_viewers??0).toLocaleString()} peak`],['ROOM MONEY',`${money(metrics.tip_cents??0)} tips · ${money(metrics.purchase_cents??0)} access`]].map(([label,value])=>`<article><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`).join('');
    const isHost=Boolean(user&&String(active.creator_id)===String(user.id));
    chatEl.innerHTML=chatRows.length?chatRows.map((item)=>`<article class="${item.is_pinned?'is-pinned':''}"><strong>${esc(item.display_name||item.username||'RICH MEMBER')}</strong><p>${esc(item.message||item.body||'')}</p>${isHost?`<button type="button" data-pin-message="${esc(item.id)}">${item.is_pinned?'PINNED':'PIN'}</button>`:''}</article>`).join(''):'<div class="media-ultimate__empty">No chat yet.</div>';
    activityEl.innerHTML=activityRows.length?`<h4>MEMBER ACTIVITY</h4>${activityRows.slice(0,12).map((item)=>`<span><b>${esc(String(item.activity_type||'activity').toUpperCase())}</b><small>${new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></span>`).join('')}<div class="live-room-ledger"><small>${memberRows.filter((item)=>item.status==='active').length} ACTIVE</small><small>${tipRows.length} TIPS</small><small>${purchaseRows.length} ACCESS PASSES</small></div>`:'<div class="media-ultimate__empty">Room activity appears here.</div>';
    q<HTMLButtonElement>('#popInBtn')?.addEventListener('click',()=>{if(requireUser())void popIn(active!);});
    q<HTMLButtonElement>('#buyAccessBtn')?.addEventListener('click',async()=>{const result=await runLiveAction('purchase_access',{});if(result){await refresh();void popIn(active!);}});
    q<HTMLButtonElement>('#tipBtn')?.addEventListener('click',async()=>{const amount=Number(prompt('Tip amount in dollars','5')||0);if(!Number.isFinite(amount)||amount<=0)return;const result=await runLiveAction('tip',{amount_cents:Math.round(amount*100)});if(result){burst('💰');await refresh();}});
    q<HTMLButtonElement>('#reactBtn')?.addEventListener('click',async()=>{const result=await runLiveAction('reaction',{reaction:'💨'});if(result)burst('💨');});
    q<HTMLButtonElement>('#alertBtn')?.addEventListener('click',async()=>{const result=await runLiveAction('toggle_alert',{});if(result){const creator=String(active!.creator_id);if(result.active)alerts.add(creator);else alerts.delete(creator);renderRoom();}});
    q<HTMLButtonElement>('#shareBtn')?.addEventListener('click',async()=>{const url=`${location.origin}/live.html?stream=${active!.id}`;if(user)await runLiveAction('share',{target:'system-share'});if(navigator.share)await navigator.share({title:active!.title||'Rich Bizness Live',url}).catch(()=>undefined);else await navigator.clipboard?.writeText(url);});
    chatEl.querySelectorAll<HTMLButtonElement>('[data-pin-message]').forEach((button)=>button.onclick=async()=>{const result=await runLiveAction('pin_chat',{message_id:button.dataset.pinMessage});if(result)await refresh();});
  };

  const applySnapshot = (value: unknown) => {
    if (!isCurrent()) return;
    const snap=(value??{}) as Row;
    streams=(snap.live??[]) as Row[];
    recordings=(snap.recordings??[]) as Row[];
    profile=snap.profile??profile;
    metrics=snap.metrics??{};
    alerts=new Set(((snap.alerts??[]) as Row[]).map((row)=>String(row.creator_id)));
    chatRows=(snap.chat??[]) as Row[];
    activityRows=(snap.activity??[]) as Row[];
    memberRows=(snap.members??[]) as Row[];
    tipRows=(snap.tips??[]) as Row[];
    purchaseRows=(snap.purchases??[]) as Row[];
    if(!active||!streams.some((row)=>String(row.id)===String(active?.id)))active=streams.find(liveNow)??streams[0]??null;
  };
  const refresh = async () => {
    if (!isCurrent()) return;
    if(snapshotBusy){snapshotQueued=true;return;}
    snapshotBusy=true;
    const epoch=++snapshotEpoch;
    do{
      snapshotQueued=false;
      const {data,error}=await supabase.rpc('rb_live_snapshot',{p_stream_id:active?.id??null});
      if(!isCurrent()||epoch!==snapshotEpoch)break;
      if(error){showActionError(error.message);}else{applySnapshot(data);renderRoom();}
    }while(snapshotQueued&&isCurrent());
    snapshotBusy=false;
  };

  const open = async (row: Row) => {
    if (!isCurrent() || !liveNow(row)) return;
    active=row;
    setStreamUrl(row);
    await disconnectViewer(true, 'switch-room');
    if(roomChannel)await supabase.removeChannel(roomChannel);
    roomChannel=null;
    if (!isCurrent()) return;
    await refresh();
    if(!isCurrent())return;
    roomChannel=supabase.channel(`live-room:${row.id}:${mountEpoch}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'live_chat_messages',filter:`stream_id=eq.${row.id}`},()=>void refresh())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'live_reactions',filter:`stream_id=eq.${row.id}`},(payload)=>{if(isCurrent())burst(String((payload.new as Row).reaction??'💨'));})
      .on('postgres_changes',{event:'*',schema:'public',table:'live_member_activity',filter:`stream_id=eq.${row.id}`},()=>void refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'live_stream_members',filter:`stream_id=eq.${row.id}`},()=>void refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'live_view_sessions',filter:`stream_id=eq.${row.id}`},()=>void refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'live_tips',filter:`stream_id=eq.${row.id}`},()=>void refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'live_stream_purchases',filter:`stream_id=eq.${row.id}`},()=>void refresh())
      .subscribe();
  };

  const tokenFor = async (stream: Row, role: 'host'|'viewer') => { if(!requireUser())throw new Error('Tap in to enter Live rooms.');const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Your Rich ID session expired.');const response=await fetch('/api/live/token',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({roomName:stream.livekit_room_name,streamId:stream.id,role})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Live room token failed.');return payload; };
  const popIn = async (stream: Row) => {
    let joined = false;
    try {
      await disconnectViewer(true, 'replace-viewer');
      if (!isCurrent()) return;
      active=stream;
      const joinResult=await runLiveAction('join',{source:'livekit-viewer',device_info:{platform:navigator.platform,user_agent:navigator.userAgent}});
      if(!joinResult)throw new Error('Could not register this Live room session.');
      joined=true;
      viewerJoinedStreamId=String(stream.id);
      const payload=await tokenFor(stream,'viewer');
      if (!isCurrent()) return;
      const room=new Room({adaptiveStream:true,dynacast:true});
      viewerRoom=room;
      room.on(RoomEvent.TrackSubscribed,(track)=>{if(!isCurrent())return;const stage=root.querySelector<HTMLElement>('#viewerStage');if(!stage)return;const element=lockMedia(track.attach(),track.kind===Track.Kind.Video?'live-inline-video':'live-inline-audio');viewerElements.add(element);stage.append(element);});
      room.on(RoomEvent.TrackUnsubscribed,(track)=>track.detach().forEach((element)=>{viewerElements.delete(element);element.remove();}));
      room.on(RoomEvent.Disconnected,()=>{if(!isCurrent()||viewerDisconnecting)return;const streamId=viewerJoinedStreamId;viewerRoom=null;viewerJoinedStreamId=null;void recordViewerLeave(streamId,'livekit-disconnected').finally(()=>{if(isCurrent())renderRoom();});});
      await room.connect(payload.url,payload.token);
      if (!isCurrent()) return;
      heroEl.innerHTML=`<div id="viewerStage" class="live-viewer-stage"></div><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">NOW WATCHING · ${esc(stream.display_room_name||stream.category||'BIZNESS PARTY')}</span><h2>${esc(stream.title)}</h2><p>You popped in. WE LIT🔥</p><div class="media-ultimate__actions"><button id="leaveRoomBtn" class="media-ultimate__btn">LEAVE ROOM</button><a class="media-ultimate__btn" href="/watch.html?lane=live">WE 🔥📺 REPLAYS</a></div></div>`;
      q<HTMLButtonElement>('#leaveRoomBtn').onclick=async()=>{await disconnectViewer(true,'viewer-left');renderRoom();};
    } catch(error){
      if(joined)await disconnectViewer(true,'viewer-connect-failed');
      else await disconnectViewer(false);
      showActionError(error instanceof Error?error.message:'Could not pop in.');
    }
  };

  const connectHost = async (stream: Row) => { studioStatus.textContent='CHECKING CAMERA + MIC...';await stopHost();const payload=await tokenFor(stream,'host');if(!isCurrent())return;const room=new Room({adaptiveStream:true,dynacast:true});hostRoom=room;room.on(RoomEvent.Disconnected,()=>{if(isCurrent()&&hostRoom){studioStatus.textContent='LIVE ROOM DISCONNECTED';}});await room.connect(payload.url,payload.token);if(!isCurrent())return;hostVideo=await createLocalVideoTrack({facingMode:'user',resolution:{width:1280,height:720}});hostAudio=await createLocalAudioTrack({echoCancellation:true,noiseSuppression:true,autoGainControl:true});await room.localParticipant.publishTrack(hostVideo,{simulcast:true});await room.localParticipant.publishTrack(hostAudio);studioPreview.innerHTML=`<div id="hostVideoMount" class="live-host-stage"></div><span class="live-host-badge">● WE LIT🔥</span><div class="live-host-controls"><button id="toggleMic">🎙️</button><button id="toggleCam">📹</button><button id="endLive" class="danger">■</button></div><div class="live-studio__preview-overlay"><small>${esc(stream.display_room_name||'BIZNESS PARTY')}</small><h3>${esc(stream.title)}</h3></div>`;const element=lockMedia(hostVideo.attach(),'live-inline-video live-host-video');element.muted=true;element.autoplay=true;q<HTMLElement>('#hostVideoMount').append(element);heartbeat=window.setInterval(()=>{if(isCurrent())void supabase.rpc('rb_live_heartbeat',{p_stream_id:stream.id});},30000);studioStatus.textContent=`WE LIT🔥 — YOU LIVE AS ${String(profile.display_name||profile.username||'RICH CREATOR').toUpperCase()}`;q<HTMLButtonElement>('#toggleMic').onclick=async()=>{if(hostAudio){await hostAudio.setMuted(!hostAudio.isMuted);q<HTMLButtonElement>('#toggleMic').textContent=hostAudio.isMuted?'🔇':'🎙️';}};q<HTMLButtonElement>('#toggleCam').onclick=async()=>{if(hostVideo){await hostVideo.setMuted(!hostVideo.isMuted);q<HTMLButtonElement>('#toggleCam').textContent=hostVideo.isMuted?'🚫':'📹';}};q<HTMLButtonElement>('#endLive').onclick=()=>void endLive(stream); };
  const endLive = async (stream: Row) => { studioStatus.textContent='WRAPPIN’ THE PARTY UP...';await stopHost();const {error}=await supabase.rpc('rb_end_live_stream',{p_stream_id:stream.id});if(error){studioStatus.textContent=error.message;studioStatus.dataset.error='true';return;}activeHostStream=null;startButton.disabled=false;studioStatus.textContent='PARTY’S OVER — REPLAY GETTIN’ RIGHT ON WE 🔥📺';await refresh();window.setTimeout(()=>{if(isCurrent())studio.close();},600); };

  root.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button)=>button.onclick=()=>{if(!isCurrent())return;lane=button.dataset.lane||'live';root.querySelectorAll('[data-lane]').forEach((node)=>node.classList.toggle('active',node===button));laneTitle.textContent=button.textContent||'WE LIT🔥';const first=rows()[0];if(first)void open(first);else{active=null;setStreamUrl(null);renderRoom();}});
  q<HTMLFormElement>('#chatForm').onsubmit=async(event)=>{event.preventDefault();if(!active||!requireUser()||!isCurrent())return;const input=q<HTMLInputElement>('#chatInput');const message=input.value.trim();if(!message)return;const submit=event.submitter as HTMLButtonElement|null;if(submit)submit.disabled=true;const result=await runLiveAction('chat',{message});if(result){input.value='';await refresh();}if(submit)submit.disabled=false;};
  q<HTMLButtonElement>('#goLiveButton').onclick=()=>{if(requireUser()&&isCurrent())studio.showModal();};
  q<HTMLButtonElement>('#closeStudio').onclick=()=>{if(!hostRoom)studio.close();};
  studio.addEventListener('cancel',(event)=>{if(hostRoom)event.preventDefault();});
  root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button)=>button.onclick=()=>{selectedCategory=button.dataset.category||selectedCategory;root.querySelectorAll('[data-category]').forEach((node)=>node.classList.toggle('active',node===button));q<HTMLElement>('#previewCategory').textContent=categories.find((item)=>item.slug===selectedCategory)?.slang_label??'BIZNESS PARTY';});
  q<HTMLInputElement>('#liveTitle').addEventListener('input',(event)=>{q<HTMLElement>('#previewTitle').textContent=(event.target as HTMLInputElement).value||'Your Live Title';});
  q<HTMLFormElement>('#goLiveForm').onsubmit=async(event)=>{event.preventDefault();if(hostStarting||hostRoom||!requireUser()||!isCurrent())return;hostStarting=true;startButton.disabled=true;studioStatus.textContent='GETTIN’ THE BIZNESS PARTY RIGHT...';const title=q<HTMLInputElement>('#liveTitle').value.trim();if(!title){hostStarting=false;startButton.disabled=false;studioStatus.textContent='NAME THE LIVE FIRST.';return;}const {data,error}=await supabase.rpc('rb_start_live_stream',{p_title:title,p_description:q<HTMLTextAreaElement>('#liveDescription').value.trim()||null,p_category:selectedCategory,p_access_type:q<HTMLSelectElement>('#liveAccess').value,p_price_cents:Math.round(Number(q<HTMLInputElement>('#livePrice').value||0)*100),p_thumbnail_url:null,p_cover_url:null,p_is_chat_enabled:q<HTMLInputElement>('#liveChatEnabled').checked,p_is_cohost_enabled:q<HTMLInputElement>('#liveCohostEnabled').checked,p_recording_enabled:q<HTMLInputElement>('#liveRecordingEnabled').checked,p_transcription_enabled:q<HTMLInputElement>('#liveCaptionsEnabled').checked});if(error){hostStarting=false;startButton.disabled=false;studioStatus.textContent=error.message;studioStatus.dataset.error='true';return;}if(!isCurrent())return;activeHostStream=(data as Row).stream;try{await connectHost(activeHostStream);await refresh();}catch(connectError){await stopHost();if(activeHostStream?.id)await supabase.rpc('rb_end_live_stream',{p_stream_id:activeHostStream.id});activeHostStream=null;startButton.disabled=false;studioStatus.textContent=connectError instanceof Error?connectError.message:'Camera or live room failed.';}finally{hostStarting=false;}};

  const cleanup=async()=>{
    if(disposed)return;
    disposed=true;
    snapshotEpoch++;
    snapshotQueued=false;
    if (heartbeat) window.clearInterval(heartbeat);
    await stopHost();
    await disconnectViewer(true,'page-exit');
    if(roomChannel)await supabase.removeChannel(roomChannel);
    if(catalogChannel)await supabase.removeChannel(catalogChannel);
    root.querySelectorAll<HTMLMediaElement>('video,audio').forEach((media)=>{media.pause();media.removeAttribute('src');media.load();});
    const host=window as CleanupHost;
    if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null;
    window.removeEventListener('pagehide',onPageExit);
    window.removeEventListener('beforeunload',onPageExit);
  };
  const onPageExit=()=>{void cleanup();};
  (window as CleanupHost).__rbPageCleanup=cleanup;
  window.addEventListener('pagehide',onPageExit,{once:true});
  window.addEventListener('beforeunload',onPageExit,{once:true});

  await refresh();
  if(!isCurrent())return;
  const requested=new URLSearchParams(location.search).get('stream');if(requested){const row=streams.find((item)=>String(item.id)===requested&&liveNow(item));if(row)await open(row);}else if(active&&liveNow(active))await open(active);
  if(!isCurrent())return;
  catalogChannel=supabase.channel(`rich-live-owner:${mountEpoch}`).on('postgres_changes',{event:'*',schema:'public',table:'live_streams'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'live_recordings'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'live_alert_subscriptions'},()=>void refresh()).subscribe();
}

function burst(value: string) {
  const element=document.createElement('span');
  element.textContent=value;
  element.className='live-reaction-burst';
  document.body.append(element);
  window.setTimeout(()=>element.remove(),2000);
}
