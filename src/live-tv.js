import { Room, RoomEvent, createLocalTracks } from 'livekit-client';
import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js';

const LIVEKIT_URL = 'wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud';
const LIVE_TITLE = 'WE LIT🔥';
const LIVE_ROOM = 'Bizness Party';
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
let stream = null;
let user = null;
let room = null;
let localTracks = [];
let previewing = false;
let live = false;

function safeRoomName(value = LIVE_ROOM) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'Bizness-Party'; }
function roomName() { return stream?.livekit_room_name || 'bizness-party'; }
function setStatus(text) { const el = $('#liveStudioStatus') || $('#tvStatus'); if (el) el.textContent = text; }
function bindStudioControls() {
  $('#previewCam')?.addEventListener('click', previewCamera);
  $('#goLiveBtn')?.addEventListener('click', goLive);
  $('#endLiveBtn')?.addEventListener('click', endLive);
}
function studioOverlay() {
  if ($('#previewCam') || $('#goLiveBtn') || $('#endLiveBtn')) { bindStudioControls(); return; }
  if ($('#liveStudioPanel')) return;
  $('.watch-holo')?.insertAdjacentHTML('beforeend', `<section id="liveStudioPanel" class="tv-controls"><div class="tv-meta"><small>LIVE STUDIO</small><b id="liveStudioStatus">Camera ready</b><small>Camera, mic, LiveKit, Supabase stream row</small></div><div class="tv-buttons"><button id="previewCam" type="button">PREVIEW CAM</button><button id="goLiveBtn" type="button">GO LIVE 🔴</button><button id="endLiveBtn" type="button">END LIVE</button></div></section>`);
  bindStudioControls();
}
function attachVideo(track) {
  const screen = $('#holoScreen');
  if (!screen || !track) return;
  screen.innerHTML = '';
  const el = track.attach();
  el.autoplay = true; el.muted = true; el.playsInline = true;
  el.style.width = '100%'; el.style.height = '100%'; el.style.objectFit = 'cover'; el.style.borderRadius = '24px';
  screen.appendChild(el);
}
function idleScreen() { return `<div class="holo-empty"><div class="holo-orb"></div><b>${LIVE_TITLE}</b><p>${LIVE_ROOM} • ${LIVEKIT_URL}</p></div>`; }
function paint() {
  if (!previewing && !live && $('#holoScreen')) $('#holoScreen').innerHTML = idleScreen();
  if ($('#tvTitle')) $('#tvTitle').textContent = stream?.title || LIVE_TITLE;
  if ($('#tvRoom')) $('#tvRoom').textContent = stream?.display_room_name || stream?.livekit_room_name || LIVE_ROOM;
  if ($('#tvStatus')) $('#tvStatus').textContent = (stream?.status || 'standby').toUpperCase();
  if ($('#tvViewers')) $('#tvViewers').textContent = fmt(stream?.viewer_count || 0);
  if ($('#tvChat')) $('#tvChat').textContent = fmt(stream?.total_chat_messages || 0);
  if ($('#tvRevenue')) $('#tvRevenue').textContent = '$' + (Number(stream?.total_revenue_cents || 0) / 100).toFixed(2);
}
async function getUser() { const { data } = await supabase.auth.getUser(); user = data?.user || null; return user; }
async function load() {
  const { data } = await supabase.from('live_streams').select('id,title,status,display_slug,display_room_name,livekit_room_name,thumbnail_url,cover_url,recording_url,viewer_count,total_chat_messages,total_reactions,total_revenue_cents,metadata,created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
  stream = data || null; paint();
}
async function previewCamera() {
  await getUser();
  if (!user) { location.href = '/auth.html'; return; }
  try {
    setStatus('Opening camera...');
    localTracks.forEach((t) => t.stop());
    localTracks = await createLocalTracks({ audio: true, video: true });
    const video = localTracks.find((t) => t.kind === 'video');
    previewing = true;
    attachVideo(video);
    setStatus('Camera preview ready');
  } catch (err) { setStatus('Camera blocked: allow camera and mic'); console.warn(err); }
}
async function tokenFor(role, lkRoom) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch('https://xfsrqomsiulswbalgknx.supabase.co/functions/v1/livekit-token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ room: lkRoom, role, identity: user.id, name: user.email || 'Rich Bizness Host' }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'LiveKit token failed');
  return json;
}
async function ensureStream() {
  await getUser();
  if (!user) { location.href = '/auth.html'; return null; }
  if (stream?.id && stream.status === 'live' && stream.creator_id === user.id) return stream;
  const lkRoom = safeRoomName('we-lit-' + user.id.slice(0, 8));
  const row = { creator_id: user.id, slug: lkRoom, title: LIVE_TITLE, display_slug: LIVE_TITLE, display_room_name: LIVE_ROOM, livekit_room_name: lkRoom, status: 'live', status_label: 'Get Right', category: 'we-lit', started_at: new Date().toISOString(), last_activity_at: new Date().toISOString(), is_chat_enabled: true, is_cohost_enabled: true, metadata: { livekit_url: LIVEKIT_URL, studio: 'we_lit' } };
  const { data, error } = await supabase.from('live_streams').insert(row).select('*').single();
  if (error) throw error;
  stream = data;
  return stream;
}
async function goLive() {
  try {
    await getUser();
    if (!user) { location.href = '/auth.html'; return; }
    if (!localTracks.length) await previewCamera();
    setStatus('Creating WE LIT room...');
    const row = await ensureStream();
    const lk = await tokenFor('host', row.livekit_room_name);
    room = new Room({ adaptiveStream: true, dynacast: true });
    room.on(RoomEvent.ParticipantConnected, () => load());
    room.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === 'video') attachVideo(track); });
    setStatus('Connecting LiveKit...');
    await room.connect(lk.livekitUrl || LIVEKIT_URL, lk.token);
    for (const track of localTracks) await room.localParticipant.publishTrack(track);
    live = true; previewing = false;
    setStatus('WE LIT LIVE 🔴');
    await supabase.from('live_stream_members').insert({ stream_id: row.id, user_id: user.id, role: 'host', status: 'active', metadata: { studio: 'we_lit' } });
    await awardXp('live_watch', { section: 'live', sourceTable: 'live_streams', sourceId: row.id });
    paint();
  } catch (err) { setStatus(String(err.message || err)); console.warn(err); }
}
async function endLive() {
  try {
    setStatus('Ending live...');
    if (room) room.disconnect();
    localTracks.forEach((t) => t.stop());
    localTracks = []; live = false; previewing = false;
    if (stream?.id) await supabase.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }).eq('id', stream.id);
    setStatus('Live ended');
    await load();
  } catch (err) { setStatus(String(err.message || err)); }
}
async function watching() {
  if (!stream?.id) return;
  await getUser();
  await supabase.from('live_view_sessions').insert({ stream_id: stream.id, user_id: user?.id || null, metadata: { screen: 'we_lit', livekit_url: LIVEKIT_URL } });
  await awardXp('live_watch', { section: 'live', sourceTable: 'live_streams', sourceId: stream.id });
}
studioOverlay();
$('#watchXp')?.addEventListener('click', watching);
$('#refreshTv')?.addEventListener('click', load);
$('#imOut')?.addEventListener('click', () => { location.href = '/'; });
load();
supabase.channel('we-lit-live').on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactions' }, load).subscribe();
