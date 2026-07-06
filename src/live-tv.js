import { Room, RoomEvent, createLocalTracks } from 'livekit-client';
import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=realtime-2';
import { getAuthoritativeIdentity } from './rb-identity.js?v=identity-public-2';
import './rb-personality.js?v=rb-live-owner-2';
import './live-owner.js?v=live-owner-1';

const LIVEKIT_URL = 'wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud';
const LIVE_TITLE = 'WE LIT🔥';
const LIVE_ROOM = 'Bizness Party';
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
let stream = null, user = null, room = null, localTracks = [], previewing = false, live = false;

function roomName() { return user ? 'we-lit-' + user.id.slice(0, 8) : 'we-lit-room'; }
function setStatus(text) {
  const el = $('#liveStudioStatus') || $('#tvStatus');
  if (el) el.textContent = text;
  const state = $('#tvState');
  if (state) state.textContent = text.includes('LIVE') ? 'LIVE' : text.includes('ready') || text.includes('Ready') || text.includes('Get Right') ? 'READY' : 'WORKING';
}
async function auth() { const state = await getAuthoritativeIdentity(); user = state.user; return state; }
function attachVideo(track) {
  const screen = $('#holoScreen');
  if (!screen || !track) return;
  screen.innerHTML = '';
  const el = track.attach();
  el.autoplay = true;
  el.muted = true;
  el.playsInline = true;
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.objectFit = 'cover';
  el.style.borderRadius = '24px';
  screen.appendChild(el);
}
function idleScreen() { return `<div class="holo-empty"><b>${LIVE_TITLE}</b><p>${LIVE_ROOM} • Get Right • camera + mic ready</p></div>`; }
function paint() {
  if (!previewing && !live && $('#holoScreen')) $('#holoScreen').innerHTML = idleScreen();
  if ($('#tvTitle')) $('#tvTitle').textContent = stream?.title || LIVE_TITLE;
  if ($('#tvRoom')) $('#tvRoom').textContent = stream?.display_room_name || stream?.livekit_room_name || LIVE_ROOM;
  if ($('#tvStatus')) $('#tvStatus').textContent = stream?.status_label || (stream?.status || 'Get Right').toUpperCase();
  if ($('#tvViewers')) $('#tvViewers').textContent = fmt(stream?.viewer_count || 0);
  if ($('#tvChat')) $('#tvChat').textContent = fmt(stream?.total_chat_messages || 0);
  if ($('#tvState')) $('#tvState').textContent = live ? 'LIVE' : 'READY';
}
async function load() {
  const { data, error } = await supabase.from('live_streams').select('id,creator_id,title,status,status_label,display_slug,display_room_name,livekit_room_name,viewer_count,total_chat_messages,total_reactions,metadata,created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) setStatus(error.message);
  stream = data || null;
  paint();
}
async function previewCamera() {
  await auth();
  if (!user) { location.href = '/auth.html'; return false; }
  try {
    setStatus('Opening camera...');
    localTracks.forEach((t) => t.stop());
    localTracks = await createLocalTracks({ audio: true, video: true });
    const video = localTracks.find((t) => t.kind === 'video');
    previewing = true;
    attachVideo(video);
    setStatus('Get Right');
    return true;
  } catch (err) {
    setStatus('Camera or mic needs permission');
    console.warn(err);
    return false;
  }
}
async function tokenFor(role, lkRoom) {
  const { session, user: signed } = await auth();
  if (!session || !signed) throw new Error('Sign in required');
  const { data, error } = await supabase.functions.invoke('livekit-token', { body: { room: lkRoom, role, identity: signed.id, name: signed.email || 'Rich Bizness User' } });
  if (error) throw error;
  if (!data?.token) throw new Error(data?.error || 'LiveKit token failed');
  return data;
}
async function syncLiveRow(lkRoom) {
  const row = {
    creator_id: user.id,
    slug: lkRoom,
    title: LIVE_TITLE,
    display_slug: LIVE_TITLE,
    display_room_name: LIVE_ROOM,
    livekit_room_name: lkRoom,
    status: 'live',
    status_label: 'Get Right',
    category: 'we-lit',
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    is_chat_enabled: true,
    is_cohost_enabled: true,
    metadata: { livekit_url: LIVEKIT_URL, studio: 'we_lit', rb_language: 'Bizness Party' }
  };
  let found = null;
  try { found = (await supabase.from('live_streams').select('id').eq('slug', lkRoom).maybeSingle()).data; } catch (_) {}
  const query = found?.id ? supabase.from('live_streams').update(row).eq('id', found.id).select('*').maybeSingle() : supabase.from('live_streams').insert(row).select('*').maybeSingle();
  const { data, error } = await query;
  if (error) { setStatus('LIVE connected, sync needs policy'); console.warn(error); return null; }
  stream = data;
  await supabase.from('live_stream_members').insert({ stream_id: data.id, user_id: user.id, role: 'host', status: 'active', metadata: { room: lkRoom, source: 'we_lit' } }).then(() => {}, () => {});
  return data;
}
async function goLive() {
  try {
    await auth();
    if (!user) { location.href = '/auth.html'; return; }
    if (!localTracks.length) { const ok = await previewCamera(); if (!ok) return; }
    const lkRoom = roomName();
    setStatus('Getting live key...');
    const lk = await tokenFor('host', lkRoom);
    room = new Room({ adaptiveStream: true, dynacast: true });
    room.on(RoomEvent.ParticipantConnected, () => load());
    setStatus('Connecting...');
    await room.connect(lk.livekitUrl || LIVEKIT_URL, lk.token);
    for (const track of localTracks) await room.localParticipant.publishTrack(track);
    live = true;
    previewing = false;
    setStatus('WE LIT LIVE 🔴');
    const row = await syncLiveRow(lkRoom);
    if (row?.id) awardXp('live_started', { section: 'live', sourceTable: 'live_streams', sourceId: row.id }).catch(() => {});
    paint();
  } catch (err) { setStatus(String(err.message || err)); console.warn(err); }
}
async function endLive() {
  try {
    setStatus('Ending live...');
    if (room) room.disconnect();
    localTracks.forEach((t) => t.stop());
    localTracks = [];
    live = false;
    previewing = false;
    if (stream?.id) await supabase.from('live_streams').update({ status: 'ended', status_label: 'Party closed', ended_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }).eq('id', stream.id);
    setStatus('Live ended');
    await load();
  } catch (err) { setStatus(String(err.message || err)); }
}
async function watching() {
  if (!stream?.id) return;
  await auth();
  if (!user) { location.href = '/auth.html'; return; }
  await supabase.from('live_view_sessions').insert({ stream_id: stream.id, user_id: user.id, metadata: { screen: 'we_lit', livekit_url: LIVEKIT_URL } }).then(() => {}, () => {});
  await awardXp('watch_joined', { section: 'watch', sourceTable: 'live_streams', sourceId: stream.id });
}

$('#previewCam')?.addEventListener('click', previewCamera);
$('#goLiveBtn')?.addEventListener('click', goLive);
$('#endLiveBtn')?.addEventListener('click', endLive);
$('#watchXp')?.addEventListener('click', watching);
$('#refreshTv')?.addEventListener('click', load);
$('#imOut')?.addEventListener('click', () => { location.href = '/'; });
load();
supabase.channel('we-lit-live').on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, load).subscribe();
