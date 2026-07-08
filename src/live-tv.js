import { Room, createLocalTracks } from 'livekit-client';
import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=realtime-2';
import { getAuthoritativeIdentity } from './rb-identity.js?v=tap-in-foundation-3';
import './rb-personality.js?v=rb-live-owner-2';
import './section-language-foundation.js?v=copy-only-1';

const LIVEKIT_URL = 'wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud';
const LIVE_TITLE = 'WE LIT🔥';
const LIVE_ROOM = 'Bizness Party';
const $ = (s) => document.querySelector(s);
let stream = null, user = null, room = null, localTracks = [], previewing = false, live = false;

function roomName() { return user ? 'we-lit-' + user.id.slice(0, 8) : 'we-lit-room'; }
function setStatus(text) { const el = $('#liveStudioStatus') || $('#tvStatus'); if (el) el.textContent = text; const state = $('#tvState'); if (state) state.textContent = text.includes('LIVE') ? 'LIVE' : text.includes('ready') || text.includes('Ready') || text.includes('Get Right') ? 'READY' : 'WORKING'; }
async function auth() { const state = await getAuthoritativeIdentity(); user = state.user; return state; }
function registerMedia(){ window.__RB_LIVE_ROOM__ = room; window.__RB_LIVE_TRACKS__ = localTracks; }
function forceStopMedia() {
  try { window.__RB_LIVE_ROOM__?.disconnect?.(); } catch (_) {}
  try { room?.disconnect(); } catch (_) {}
  room = null; window.__RB_LIVE_ROOM__ = null;
  live = false; previewing = false;
  const allTracks = [...localTracks, ...(window.__RB_LIVE_TRACKS__ || [])];
  allTracks.forEach((t) => { try { t.stop?.(); } catch (_) {} try { t.mediaStreamTrack?.stop?.(); } catch (_) {} try { t.detach?.().forEach((el) => el.remove()); } catch (_) {} });
  localTracks = []; window.__RB_LIVE_TRACKS__ = [];
  document.querySelectorAll('video,audio').forEach((el) => {
    try { el.pause(); } catch (_) {}
    try { el.srcObject?.getTracks?.().forEach((track) => track.stop()); } catch (_) {}
    try { el.srcObject = null; } catch (_) {}
    try { el.removeAttribute('src'); el.load?.(); } catch (_) {}
    if (el.closest('#holoScreen')) el.remove();
  });
  const screen = $('#holoScreen');
  if (screen) screen.innerHTML = idleScreen();
}
function attachVideo(track) { const screen = $('#holoScreen'); if (!screen || !track) return; screen.innerHTML = ''; const el = track.attach(); el.autoplay = true; el.muted = true; el.playsInline = true; el.setAttribute('data-rb-live-preview','true'); el.style.width = '100%'; el.style.height = '100%'; el.style.objectFit = 'cover'; el.style.borderRadius = '24px'; screen.appendChild(el); registerMedia(); }
function idleScreen() { return `<div class="holo-empty"><b>${LIVE_TITLE}</b><p>${LIVE_ROOM} • Get Right • camera + mic ready</p></div>`; }
function paint() { if (!previewing && !live && $('#holoScreen')) $('#holoScreen').innerHTML = idleScreen(); if ($('#tvTitle')) $('#tvTitle').textContent = stream?.title || LIVE_TITLE; if ($('#tvRoom')) $('#tvRoom').textContent = stream?.display_room_name || LIVE_ROOM; }
async function preview() { try { await auth(); if (!user) { location.href = '/auth.html?next=' + encodeURIComponent('/live.html'); return; } if (!stream) paint(); if (localTracks.length) return; setStatus('Camera ready'); localTracks = await createLocalTracks({ audio: true, video: true }); registerMedia(); previewing = true; attachVideo(localTracks.find((t) => t.kind === 'video')); } catch (err) { setStatus(String(err.message || err)); console.warn(err); } }
async function goLive() { try { const state = await auth(); if (!state.session || !user) { location.href = '/auth.html?next=' + encodeURIComponent('/live.html'); return; } if (!localTracks.length) await preview(); setStatus('Going LIVE...'); const lkRoom = roomName(); const { data, error } = await supabase.functions.invoke('livekit-token', { body: { room: lkRoom, role: 'host', identity: user.id, name: user.email || 'Rich Bizness Host' } }); if (error) throw error; if (!data?.token) throw new Error(data?.error || 'LiveKit token missing'); room = new Room({ adaptiveStream: true, dynacast: true }); registerMedia(); await room.connect(data.livekitUrl || LIVEKIT_URL, data.token); for (const track of localTracks) await room.localParticipant.publishTrack(track); registerMedia(); const row = { host_id: user.id, title: LIVE_TITLE, display_room_name: LIVE_ROOM, livekit_room_name: lkRoom, status: 'live', viewer_count: 0, total_chat_messages: 0, metadata: { brand: 'Rich Bizness', screen: 'live' } }; const upsert = await supabase.from('live_streams').upsert(row, { onConflict: 'host_id' }).select().maybeSingle(); if (upsert.error) throw upsert.error; stream = upsert.data; live = true; setStatus('LIVE'); paint(); await awardXp('live_started', { section: 'live', sourceTable: 'live_streams', sourceId: stream?.id }).catch(() => {}); } catch (err) { setStatus(String(err.message || err)); console.warn(err); } }
async function endLive() { try { if (stream?.id) await supabase.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', stream.id); forceStopMedia(); setStatus('READY'); paint(); } catch (err) { setStatus(String(err.message || err)); } }
$('#previewCam')?.addEventListener('click', preview);
$('#goLiveBtn')?.addEventListener('click', goLive);
$('#endLiveBtn')?.addEventListener('click', endLive);
$('#watchXp')?.addEventListener('click', () => { forceStopMedia(); location.href = '/watch.html'; });
$('#imOut')?.addEventListener('click', () => { forceStopMedia(); location.href = '/'; });
document.addEventListener('click', (event) => { const link = event.target.closest?.('a[href]'); if (link && !link.href.includes('/live.html')) forceStopMedia(); }, true);
window.addEventListener('pagehide', forceStopMedia);
window.addEventListener('beforeunload', forceStopMedia);
window.addEventListener('popstate', forceStopMedia);
document.addEventListener('visibilitychange', () => { if (document.hidden) forceStopMedia(); });
paint();
