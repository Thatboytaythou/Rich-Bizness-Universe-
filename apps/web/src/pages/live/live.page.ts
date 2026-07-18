import { Room, RoomEvent, Track, createLocalAudioTrack, createLocalVideoTrack, type LocalAudioTrack, type LocalVideoTrack } from 'livekit-client';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import '../../styles/live-studio.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

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
  if (root.dataset.liveOwner === 'active') return;
  root.dataset.liveOwner = 'active';

  const auth = await getAuthSnapshot();
  const user = auth.session?.user ?? null;
  const requireUser = () => {
    if (user) return true;
    location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  };

  let disposed = false;
  let snapshotBusy = false;
  let snapshotQueued = false;
  let active: Row | null = null;
  let lane = 'live';
  let profile: Row = {};
  let metrics: Row = {};
  let streams: Row[] = [];
  let recordings: Row[] = [];
  let chatRows: Row[] = [];
  let activityRows: Row[] = [];
  let alerts = new Set<string>();
  let categories: Row[] = [];
  let selectedCategory = 'family-bizness';
  let activeHostStream: Row | null = null;
  let catalogChannel: Channel | null = null;
  let roomChannel: Channel | null = null;
  let viewerRoom: Room | null = null;
  let hostRoom: Room | null = null;
  let hostVideo: LocalVideoTrack | null = null;
  let hostAudio: LocalAudioTrack | null = null;
  let heartbeat = 0;
  let hostStarting = false;
  const viewerElements = new Set<HTMLMediaElement>();

  const disconnectViewer = async (record = true) => {
    if (record && user && active?.id && viewerRoom) void supabase.rpc('rb_live_action', { p_action: 'leave', p_stream_id: active.id, p_payload: { source: 'livekit-viewer' } });
    viewerElements.forEach((element) => { element.pause(); element.srcObject = null; element.remove(); });
    viewerElements.clear();
    if (viewerRoom) await viewerRoom.disconnect().catch(() => undefined);
    viewerRoom = null;
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
  categories = ((initialStudio.data as Row)?.categories ?? []) as Row[];
  activeHostStream = (initialStudio.data as Row)?.active_stream ?? null;
  selectedCategory = String(activeHostStream?.category ?? categories[0]?.slug ?? selectedCategory);

  root.innerHTML = `<main class="media-ultimate live-mobile-safe live-command-v4"><div class="media-ultimate__wrap">
    <header class="media-ultimate__head"><a href="/portal.html" aria-label="Back to Portal">←</a><div><p>RICH BIZNESS LLC • GLOBAL LIVE NETWORK</p><h1>WE LIT🔥</h1></div><span class="media-ultimate__status">${user ? '● RICH ID CONNECTED' : 'PUBLIC SIGNAL'}</span></header>
    <nav class="live-network-rail" aria-label="Live universe connections"><a href="/feed.html"><b>◫</b><span>FEED</span></a><a href="/watch.html"><b>📺</b><span>WATCH</span></a><a href="/podcast.html"><b>◌</b><span>PODCAST</span></a><a href="/radio.html"><b>◉</b><span>RADIO</span></a><a href="/music.html"><b>♪</b><span>MUSIC</span></a><a href="/sports.html"><b>🏆</b><span>SPORTS</span></a></nav>
    <section id="liveHero" class="media-ultimate__hero live-hero-clean"></section>
    <section id="liveMetrics" class="media-ultimate__metrics"></section>
    <nav class="media-ultimate__tabs">${[['live','WE LIT🔥'],['upcoming','GET RIGHT'],['vip','VIP RICH ROOMS'],['replays','PARTY’S OVER']].map(([value,label],index)=>`<button class="${index===0?'active':''}" data-lane="${value}">${label}</button>`).join('')}</nav>
    <section class="media-ultimate__section"><header><div><h3 id="laneTitle">WE LIT🔥</h3><p>LiveKit rooms, reactions, chat, member activity, VIP access, replay capture and creator earnings—one broadcast owner.</p></div><div class="live-command-actions"><a class="media-ultimate__btn" href="/upload.html?route=live-thumbnail">THUMBNAIL</a><a class="media-ultimate__btn" href="/creator.html">CREATOR</a><button id="goLiveButton" class="live-studio-launch" type="button">GO LIVE 🔴</button></div></header><div id="liveGrid" class="media-ultimate__grid"></div></section>
    <section class="media-ultimate__split live-command-split"><article class="media-ultimate__panel"><header><h4>ROOM INTELLIGENCE</h4></header><div id="liveDetail" class="media-ultimate__list"></div><div id="liveActivity" class="live-activity-rail"></div></article><article class="media-ultimate__panel"><header><h4>RICH LIVE CHAT</h4></header><div id="liveChat" class="media-ultimate__chat"><div class="media-ultimate__empty">Pop in a room.</div></div><form id="chatForm" class="media-ultimate__form"><input id="chatInput" maxlength="800" placeholder="Say that shyt..." ${user?'':'disabled'}><button class="media-ultimate__btn primary">${user?'DROP IT':'TAP IN'}</button></form></article></section>
  </div>
  <dialog id="goLiveStudio" class="live-studio"><div class="live-studio__shell"><section id="studioPreview" class="live-studio__preview"><div class="live-studio__preview-empty"><strong>PREVIEW CAM</strong><p>Pick your lane, check the camera, then light this shyt up.</p></div><div class="live-studio__preview-overlay"><small id="previewCategory">${esc(categories.find((category)=>category.slug===selectedCategory)?.slang_label ?? 'FAMILY BIZNESS')}</small><h3 id="previewTitle">${esc(activeHostStream?.title ?? 'Your Live Title')}</h3></div></section><aside class="live-studio__panel"><header class="live-studio__top"><div><p>RICH BIZNESS LLC</p><h2>GO LIVE 🔴</h2></div><button id="closeStudio" class="live-studio__close" type="button">×</button></header><form id="goLiveForm" class="live-studio__form"><label>WHAT WE CALLIN’ THIS LIVE?<input id="liveTitle" maxlength="120" required value="${esc(activeHostStream?.title ?? 'Family Bizness')}"></label><label>WHAT’S THE MOVE?<textarea id="liveDescription" maxlength="1200">${esc(activeHostStream?.description ?? '')}</textarea></label><label>PICK YOUR LIVE LANE<div class="live-category-grid">${categories.map((category)=>`<button class="live-category ${category.slug===selectedCategory?'active':''}" type="button" data-category="${esc(category.slug)}" style="background-image:url('${esc(safeMedia(category.hero_asset_url))}')"><span>${esc(category.icon)}</span><strong>${esc(category.slang_label)}</strong><small>${esc(category.label)}</small></button>`).join('')}</div></label><div class="live-studio__toggles"><label>ROOM ACCESS<select id="liveAccess"><option value="free">FREE ROOM</option><option value="vip">VIP ROOM</option><option value="paid">PAID ROOM</option><option value="private">PRIVATE</option></select></label><label>PRICE<input id="livePrice" type="number" min="0" step="1" value="0"></label></div><div class="live-studio__toggles"><label class="live-studio__toggle"><input id="liveChatEnabled" type="checkbox" checked> LIVE CHAT</label><label class="live-studio__toggle"><input id="liveCohostEnabled" type="checkbox" checked> CO-HOST</label><label class="live-studio__toggle"><input id="liveRecordingEnabled" type="checkbox" checked> SAVE REPLAY</label><label class="live-studio__toggle"><input id="liveCaptionsEnabled" type="checkbox"> CAPTIONS</label></div><button id="startLiveButton" class="live-studio__submit">LIGHT THIS SHYT UP</button><p id="studioStatus" class="live-studio__status">CAMERA + MIC ASK WHEN YOU START</p></form></aside></div></dialog></main>`;

  const heroEl = document.querySelector<HTMLElement>('#liveHero')!;
  const metricsEl = document.querySelector<HTMLElement>('#liveMetrics')!;
  const gridEl = document.querySelector<HTMLElement>('#liveGrid')!;
  const detailEl = document.querySelector<HTMLElement>('#liveDetail')!;
  const chatEl = document.querySelector<HTMLElement>('#liveChat')!;
  const activityEl = document.querySelector<HTMLElement>('#liveActivity')!;
  const laneTitle = document.querySelector<HTMLElement>('#laneTitle')!;
  const studio = document.querySelector<HTMLDialogElement>('#goLiveStudio')!;
  const studioPreview = document.querySelector<HTMLElement>('#studioPreview')!;
  const studioStatus = document.querySelector<HTMLElement>('#studioStatus')!;
  const startButton = document.querySelector<HTMLButtonElement>('#startLiveButton')!;

  const rows = () => lane === 'replays' ? recordings : streams.filter((stream)=> lane === 'live' ? liveNow(stream) : lane === 'upcoming' ? ['draft','scheduled','upcoming','ready'].includes(String(stream.status).toLowerCase()) : Boolean(stream.is_vip_enabled) || ['vip','paid','private'].includes(String(stream.access_type)));
  const renderCard = (row: Row) => `<article class="media-ultimate__card" data-id="${esc(row.id)}"><img src="${esc(safeMedia(row.thumbnail_url || row.cover_url) || '/images/live/categories/family-bizness.svg')}" alt=""><div class="media-ultimate__card-body"><h4>${esc(row.title || 'Family Bizness')}</h4><p>${esc(row.description || row.display_room_name || row.category || 'Bizness Party')}</p><div class="media-ultimate__meta"><span>${liveNow(row)?'● LIVE':lane.toUpperCase()}</span><span>${Number(row.viewer_count ?? row.view_count ?? 0).toLocaleString()} watching</span></div></div></article>`;
  const hero = (row: Row) => { const poster=safeMedia(row.cover_url||row.thumbnail_url)||'/images/live/categories/family-bizness.svg'; const playback=!liveNow(row)&&safeMedia(row.recording_url)?`<video class="media-ultimate__hero-media live-inline-video" controls playsinline poster="${esc(poster)}" src="${esc(safeMedia(row.recording_url))}"></video>`:`<img class="media-ultimate__hero-media" src="${esc(poster)}" alt="">`; return `${playback}<div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">${liveNow(row)?'● WE LIT🔥':'WE 🔥📺'} · ${esc(row.display_room_name||row.category||'FAMILY BIZNESS')}</span><h2>${esc(row.title||'Family Bizness')}</h2><p>${esc(row.description||'Pop in and see what type time the Rich Bizness universe on.')}</p><div class="media-ultimate__actions">${liveNow(row)?`<button id="popInBtn" class="media-ultimate__btn primary">${user?'POP IN':'TAP IN TO POP IN'}</button>`:'<a class="media-ultimate__btn primary" href="/watch.html">WATCH REPLAY</a>'}<button id="reactBtn" class="media-ultimate__btn">💨 REACT</button><button id="alertBtn" class="media-ultimate__btn">${alerts.has(String(row.creator_id))?'🔔 LOCKED IN':'🔔 STAY LOCKED'}</button><button id="shareBtn" class="media-ultimate__btn">↗ SHARE</button></div></div>`; };

  const renderRoom = () => {
    metricsEl.innerHTML = `<article><small>WE LIT🔥</small><strong>${Number(metrics.live_count??0)}</strong></article><article><small>NOW WATCHING</small><strong>${Number(metrics.viewer_count??0).toLocaleString()}</strong></article><article><small>ROOM ENERGY</small><strong>${Number(metrics.reaction_count??0).toLocaleString()}</strong></article><article><small>CREATOR BAG</small><strong>${money(metrics.revenue_cents??0)}</strong></article>`;
    const list=rows();
    gridEl.innerHTML=list.length?list.map(renderCard).join(''):'<div class="media-ultimate__empty">Ain’t nothing in this lane yet.</div>';
    gridEl.querySelectorAll<HTMLElement>('[data-id]').forEach((card)=>card.onclick=()=>{const row=list.find((item)=>String(item.id)===card.dataset.id);if(row)void open(row);});
    if (!active) { heroEl.innerHTML='<div class="media-ultimate__empty">Ain’t nobody live yet. Light this shyt up.</div>'; detailEl.innerHTML=''; return; }
    heroEl.innerHTML=hero(active);
    detailEl.innerHTML=[['BIZNESS PARTY',`${active.display_room_name||active.category||'Family Bizness'} · ${active.access_type||'free'}`],['STREAM QUALITY',`${active.stream_protocol||'LiveKit'} · ${active.latency_mode||'interactive'} · ${active.recording_enabled?'replay on':'replay off'}`],['NOW WATCHING',`${Number(active.viewer_count??active.view_count??0).toLocaleString()} watching · ${Number(active.peak_viewers??0).toLocaleString()} peak`],['CREATOR BAG',`${money(active.price_cents??0)} entry · ${money(active.total_revenue_cents??0)} earned`],['ROOM ENERGY',`${active.is_chat_enabled?'chat lit':'chat off'} · ${active.is_cohost_enabled?'co-host ready':'solo'} · ${active.is_vip_enabled?'VIP':'open room'}`]].map(([label,value])=>`<div class="media-ultimate__row"><div><h5>${label}</h5><p>${esc(value)}</p></div></div>`).join('');
    chatEl.innerHTML=chatRows.length?chatRows.map((message)=>`<article class="${message.is_pinned?'pinned':''}"><p>${esc(message.message||message.body)}</p><small>${esc(message.display_name||message.username||'Rich Member')}${message.is_pinned?' · PINNED':''}</small></article>`).join(''):'<div class="media-ultimate__empty">Start talkin’ that shyt.</div>';
    chatEl.scrollTop=chatEl.scrollHeight;
    activityEl.innerHTML=activityRows.length?`<h4>MEMBER ACTIVITY</h4>${activityRows.slice(0,12).map((item)=>`<span><b>${esc(String(item.activity_type||'activity').toUpperCase())}</b><small>${new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></span>`).join('')}`:'<div class="media-ultimate__empty">Room activity appears here.</div>';
    document.querySelector<HTMLButtonElement>('#popInBtn')?.addEventListener('click',()=>{if(requireUser())void popIn(active!);});
    document.querySelector<HTMLButtonElement>('#reactBtn')?.addEventListener('click',async()=>{if(!requireUser())return;await supabase.rpc('rb_live_action',{p_action:'reaction',p_stream_id:active!.id,p_payload:{reaction:'💨'}});burst('💨');});
    document.querySelector<HTMLButtonElement>('#alertBtn')?.addEventListener('click',async()=>{if(!requireUser())return;const {data,error}=await supabase.rpc('rb_live_action',{p_action:'toggle_alert',p_stream_id:active!.id,p_payload:{}});if(!error){const creator=String(active!.creator_id);if((data as Row)?.active)alerts.add(creator);else alerts.delete(creator);renderRoom();}});
    document.querySelector<HTMLButtonElement>('#shareBtn')?.addEventListener('click',async()=>{if(user)void supabase.rpc('rb_live_action',{p_action:'share',p_stream_id:active!.id,p_payload:{target:'system-share'}});const url=`${location.origin}/live.html?stream=${active!.id}`;if(navigator.share)await navigator.share({title:active!.title||'Rich Bizness Live',url}).catch(()=>undefined);else await navigator.clipboard?.writeText(url);});
  };

  const applySnapshot = (value: unknown) => { const snap=(value??{}) as Row; streams=(snap.live??[]) as Row[]; recordings=(snap.recordings??[]) as Row[]; profile=snap.profile??profile; metrics=snap.metrics??{}; alerts=new Set(((snap.alerts??[]) as Row[]).map((row)=>String(row.creator_id))); chatRows=(snap.chat??[]) as Row[]; activityRows=(snap.activity??[]) as Row[]; if(!active||![...streams,...recordings].some((row)=>String(row.id)===String(active?.id)))active=streams.find(liveNow)??streams[0]??recordings[0]??null; };
  const refresh = async () => { if(snapshotBusy){snapshotQueued=true;return;}snapshotBusy=true;do{snapshotQueued=false;const {data,error}=await supabase.rpc('rb_live_snapshot',{p_stream_id:active?.id??null});if(!error&&!disposed){applySnapshot(data);renderRoom();}}while(snapshotQueued&&!disposed);snapshotBusy=false; };

  const open = async (row: Row) => { active=row;await disconnectViewer(false);if(roomChannel)await supabase.removeChannel(roomChannel);roomChannel=null;await refresh();if(liveNow(row)){roomChannel=supabase.channel(`live-room:${row.id}`).on('postgres_changes',{event:'*',schema:'public',table:'live_chat_messages',filter:`stream_id=eq.${row.id}`},()=>void refresh()).on('postgres_changes',{event:'INSERT',schema:'public',table:'live_reactions',filter:`stream_id=eq.${row.id}`},(payload)=>burst(String((payload.new as Row).reaction??'💨'))).on('postgres_changes',{event:'INSERT',schema:'public',table:'live_member_activity',filter:`stream_id=eq.${row.id}`},()=>void refresh()).subscribe();} };

  const tokenFor = async (stream: Row, role: 'host'|'viewer') => { if(!requireUser())throw new Error('Tap in to enter Live rooms.');const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Your Rich ID session expired.');const response=await fetch('/api/live/token',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({roomName:stream.livekit_room_name,streamId:stream.id,role})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Live room token failed.');return payload; };
  const popIn = async (stream: Row) => { try { const payload=await tokenFor(stream,'viewer');await disconnectViewer(false);const room=new Room({adaptiveStream:true,dynacast:true});viewerRoom=room;room.on(RoomEvent.TrackSubscribed,(track)=>{const stage=document.querySelector<HTMLElement>('#viewerStage');if(!stage)return;const element=lockMedia(track.attach(),track.kind===Track.Kind.Video?'live-inline-video':'live-inline-audio');viewerElements.add(element);stage.append(element);});room.on(RoomEvent.TrackUnsubscribed,(track)=>track.detach().forEach((element)=>{viewerElements.delete(element);element.remove();}));await room.connect(payload.url,payload.token);await supabase.rpc('rb_live_action',{p_action:'join',p_stream_id:stream.id,p_payload:{source:'livekit-viewer'}});heroEl.innerHTML=`<div id="viewerStage" class="live-viewer-stage"></div><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">NOW WATCHING · ${esc(stream.display_room_name||stream.category||'BIZNESS PARTY')}</span><h2>${esc(stream.title)}</h2><p>You popped in. WE LIT🔥</p><div class="media-ultimate__actions"><button id="leaveRoomBtn" class="media-ultimate__btn">LEAVE ROOM</button><a class="media-ultimate__btn" href="/watch.html">WE 🔥📺</a></div></div>`;document.querySelector<HTMLButtonElement>('#leaveRoomBtn')!.onclick=async()=>{await disconnectViewer();renderRoom();}; } catch(error){detailEl.innerHTML=`<div class="media-ultimate__empty">${esc(error instanceof Error?error.message:'Could not pop in.')}</div>`;} };

  const connectHost = async (stream: Row) => { studioStatus.textContent='CHECKING CAMERA + MIC...';await stopHost();const payload=await tokenFor(stream,'host');const room=new Room({adaptiveStream:true,dynacast:true});hostRoom=room;await room.connect(payload.url,payload.token);hostVideo=await createLocalVideoTrack({facingMode:'user',resolution:{width:1280,height:720}});hostAudio=await createLocalAudioTrack({echoCancellation:true,noiseSuppression:true,autoGainControl:true});await room.localParticipant.publishTrack(hostVideo,{simulcast:true});await room.localParticipant.publishTrack(hostAudio);studioPreview.innerHTML=`<div id="hostVideoMount" class="live-host-stage"></div><span class="live-host-badge">● WE LIT🔥</span><div class="live-host-controls"><button id="toggleMic">🎙️</button><button id="toggleCam">📹</button><button id="endLive" class="danger">■</button></div><div class="live-studio__preview-overlay"><small>${esc(stream.display_room_name||'BIZNESS PARTY')}</small><h3>${esc(stream.title)}</h3></div>`;const element=lockMedia(hostVideo.attach(),'live-inline-video live-host-video');element.muted=true;element.autoplay=true;document.querySelector<HTMLElement>('#hostVideoMount')!.append(element);heartbeat=window.setInterval(()=>void supabase.rpc('rb_live_heartbeat',{p_stream_id:stream.id}),30000);studioStatus.textContent=`WE LIT🔥 — YOU LIVE AS ${String(profile.display_name||profile.username||'RICH CREATOR').toUpperCase()}`;document.querySelector<HTMLButtonElement>('#toggleMic')!.onclick=async()=>{if(hostAudio){await hostAudio.setMuted(!hostAudio.isMuted);document.querySelector<HTMLButtonElement>('#toggleMic')!.textContent=hostAudio.isMuted?'🔇':'🎙️';}};document.querySelector<HTMLButtonElement>('#toggleCam')!.onclick=async()=>{if(hostVideo){await hostVideo.setMuted(!hostVideo.isMuted);document.querySelector<HTMLButtonElement>('#toggleCam')!.textContent=hostVideo.isMuted?'🚫':'📹';}};document.querySelector<HTMLButtonElement>('#endLive')!.onclick=()=>void endLive(stream); };
  const endLive = async (stream: Row) => { studioStatus.textContent='WRAPPIN’ THE PARTY UP...';await stopHost();const {error}=await supabase.rpc('rb_end_live_stream',{p_stream_id:stream.id});if(error){studioStatus.textContent=error.message;studioStatus.dataset.error='true';return;}activeHostStream=null;startButton.disabled=false;studioStatus.textContent='PARTY’S OVER — REPLAY GETTIN’ RIGHT';await refresh();window.setTimeout(()=>studio.close(),600); };

  document.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button)=>button.onclick=()=>{lane=button.dataset.lane||'live';document.querySelectorAll('[data-lane]').forEach((node)=>node.classList.toggle('active',node===button));laneTitle.textContent=button.textContent||'WE LIT🔥';const first=rows()[0];if(first)void open(first);else{active=null;renderRoom();}});
  document.querySelector<HTMLFormElement>('#chatForm')!.onsubmit=async(event)=>{event.preventDefault();if(!active||!requireUser())return;const input=document.querySelector<HTMLInputElement>('#chatInput')!;const message=input.value.trim();if(!message)return;const submit=event.submitter as HTMLButtonElement|null;if(submit)submit.disabled=true;const {error}=await supabase.rpc('rb_live_action',{p_action:'chat',p_stream_id:active.id,p_payload:{message}});if(!error)input.value='';if(submit)submit.disabled=false;};
  document.querySelector<HTMLButtonElement>('#goLiveButton')!.onclick=()=>{if(requireUser())studio.showModal();};
  document.querySelector<HTMLButtonElement>('#closeStudio')!.onclick=()=>{if(!hostRoom)studio.close();};
  studio.addEventListener('cancel',(event)=>{if(hostRoom)event.preventDefault();});
  document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button)=>button.onclick=()=>{selectedCategory=button.dataset.category||selectedCategory;document.querySelectorAll('[data-category]').forEach((node)=>node.classList.toggle('active',node===button));document.querySelector<HTMLElement>('#previewCategory')!.textContent=categories.find((item)=>item.slug===selectedCategory)?.slang_label??'BIZNESS PARTY';});
  document.querySelector<HTMLInputElement>('#liveTitle')!.addEventListener('input',(event)=>{document.querySelector<HTMLElement>('#previewTitle')!.textContent=(event.target as HTMLInputElement).value||'Your Live Title';});
  document.querySelector<HTMLFormElement>('#goLiveForm')!.onsubmit=async(event)=>{event.preventDefault();if(hostStarting||hostRoom||!requireUser())return;hostStarting=true;startButton.disabled=true;studioStatus.textContent='GETTIN’ THE BIZNESS PARTY RIGHT...';const title=document.querySelector<HTMLInputElement>('#liveTitle')!.value.trim();if(!title){hostStarting=false;startButton.disabled=false;studioStatus.textContent='NAME THE LIVE FIRST.';return;}const {data,error}=await supabase.rpc('rb_start_live_stream',{p_title:title,p_description:document.querySelector<HTMLTextAreaElement>('#liveDescription')!.value.trim()||null,p_category:selectedCategory,p_access_type:document.querySelector<HTMLSelectElement>('#liveAccess')!.value,p_price_cents:Math.round(Number(document.querySelector<HTMLInputElement>('#livePrice')!.value||0)*100),p_thumbnail_url:null,p_cover_url:null,p_is_chat_enabled:document.querySelector<HTMLInputElement>('#liveChatEnabled')!.checked,p_is_cohost_enabled:document.querySelector<HTMLInputElement>('#liveCohostEnabled')!.checked,p_recording_enabled:document.querySelector<HTMLInputElement>('#liveRecordingEnabled')!.checked,p_transcription_enabled:document.querySelector<HTMLInputElement>('#liveCaptionsEnabled')!.checked});if(error){hostStarting=false;startButton.disabled=false;studioStatus.textContent=error.message;studioStatus.dataset.error='true';return;}activeHostStream=(data as Row).stream;try{await connectHost(activeHostStream);await refresh();}catch(connectError){await stopHost();if(activeHostStream?.id)await supabase.rpc('rb_end_live_stream',{p_stream_id:activeHostStream.id});activeHostStream=null;startButton.disabled=false;studioStatus.textContent=connectError instanceof Error?connectError.message:'Camera or live room failed.';}finally{hostStarting=false;}};

  await refresh();
  const requested=new URLSearchParams(location.search).get('stream');if(requested){const row=[...streams,...recordings].find((item)=>String(item.id)===requested);if(row)await open(row);}else if(active)await open(active);
  catalogChannel=supabase.channel('rich-live-owner').on('postgres_changes',{event:'*',schema:'public',table:'live_streams'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'live_recordings'},()=>void refresh()).subscribe();

  const cleanup=async()=>{if(disposed)return;disposed=true;await stopHost();await disconnectViewer();if(roomChannel)await supabase.removeChannel(roomChannel);if(catalogChannel)await supabase.removeChannel(catalogChannel);root.querySelectorAll<HTMLMediaElement>('video,audio').forEach((media)=>{media.pause();media.removeAttribute('src');media.load();});};
  window.addEventListener('pagehide',()=>void cleanup(),{once:true});
  window.addEventListener('beforeunload',()=>void cleanup(),{once:true});
}

function burst(value: string) {
  const element=document.createElement('span');
  element.textContent=value;
  element.className='live-reaction-burst';
  document.body.append(element);
  window.setTimeout(()=>element.remove(),2000);
}
