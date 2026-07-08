import { Room, createLocalTracks } from 'livekit-client';
import { awardXp } from './rb-xp.js?v=xp-idempotent-1';
import { getAuthoritativeIdentity } from './rb-identity.js?v=tap-in-foundation-3';
import './rb-personality.js?v=personality-copy-1';
import './section-language-foundation.js?v=copy-only-1';

const LIVE_TITLE = 'WE LIT🔥';
const LIVE_ROOM = 'Bizness Party';
const $ = (s) => document.querySelector(s);
let stream = null, user = null, profile = null, room = null, localTracks = [], previewing = false, live = false;

function roomName() { return user ? 'we-lit-' + user.id.slice(0, 8) : 'bizness-party'; }
function setStatus(text) { const el = $('#liveStudioStatus') || $('#tvStatus'); if (el) el.textContent = text; const state = $('#tvState'); if (state) state.textContent = text.includes('WE LIT') ? LIVE_TITLE : text.includes('READY') || text.includes('GET RIGHT') || text.includes('CAMERA') ? 'READY' : 'WORKING'; }
function fail(step, err) { const msg = err?.message || String(err || 'Unknown error'); setStatus(`${step}: ${msg}`); console.error('[RB LIVE]', step, err); }
async function auth() { const state = await getAuthoritativeIdentity(); user = state.user; profile = state.profile || null; return state; }
async function postJson(url, payload) { const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) }); const data = await res.json().catch(() => ({})); if (!res.ok || data?.ok === false) throw new Error(data?.error || `${url} ${res.status}`); return data; }
async function getLiveKitToken(payload) { const data = await postJson('/api/livekit-token', payload); if (!data?.token || !data?.livekitUrl) throw new Error(data?.error || 'Vercel LiveKit token failed'); return data; }
function registerMedia(){ window.__RB_LIVE_ROOM__ = room; window.__RB_LIVE_TRACKS__ = localTracks; }
function forceStopMedia() { try { window.__RB_LIVE_ROOM__?.disconnect?.(); } catch (_) {} try { room?.disconnect(); } catch (_) {} room = null; window.__RB_LIVE_ROOM__ = null; live = false; previewing = false; const allTracks = [...localTracks, ...(window.__RB_LIVE_TRACKS__ || [])]; allTracks.forEach((t) => { try { t.stop?.(); } catch (_) {} try { t.mediaStreamTrack?.stop?.(); } catch (_) {} try { t.detach?.().forEach((el) => el.remove()); } catch (_) {} }); localTracks = []; window.__RB_LIVE_TRACKS__ = []; document.querySelectorAll('video,audio').forEach((el) => { try { el.pause(); } catch (_) {} try { el.srcObject?.getTracks?.().forEach((track) => track.stop()); } catch (_) {} try { el.srcObject = null; } catch (_) {} try { el.removeAttribute('src'); el.load?.(); } catch (_) {} if (el.closest('#holoScreen')) el.remove(); }); const screen = $('#holoScreen'); if (screen) screen.innerHTML = idleScreen(); }
function attachVideo(track) { const screen = $('#holoScreen'); if (!screen || !track) return; screen.innerHTML = ''; const el = track.attach(); el.autoplay = true; el.muted = true; el.playsInline = true; el.setAttribute('data-rb-live-preview','true'); el.style.width = '100%'; el.style.height = '100%'; el.style.objectFit = 'cover'; el.style.borderRadius = '24px'; screen.appendChild(el); registerMedia(); }
function idleScreen() { return `<div class="holo-empty"><div class="holo-orb">RB</div><b>${LIVE_TITLE} READY</b><p>${LIVE_ROOM} • Get Right • camera + mic ready</p></div>`; }
function paint() { if (!previewing && !live && $('#holoScreen')) $('#holoScreen').innerHTML = idleScreen(); if ($('#tvTitle')) $('#tvTitle').textContent = stream?.title || LIVE_TITLE; if ($('#tvRoom')) $('#tvRoom').textContent = stream?.display_room_name || LIVE_ROOM; }
async function preview() { try { setStatus('CHECKING SIGN IN'); await auth(); if (!user) { location.href = '/auth.html?next=' + encodeURIComponent('/live.html'); return; } if (!stream) paint(); if (localTracks.length) return; setStatus('ASKING CAMERA PERMISSION'); localTracks = await createLocalTracks({ audio: true, video: true }); if (!localTracks.length) throw new Error('No camera or mic tracks returned'); registerMedia(); previewing = true; attachVideo(localTracks.find((t) => t.kind === 'video')); setStatus('CAMERA READY'); } catch (err) { fail('CAMERA FAILED', err); } }
async function goLive() { try { setStatus('CHECKING SIGN IN'); const state = await auth(); if (!state.session || !user) { location.href = '/auth.html?next=' + encodeURIComponent('/live.html'); return; } if (!localTracks.length) await preview(); if (!localTracks.length) throw new Error('Camera preview did not start'); const lkRoom = roomName(); setStatus('GETTING VERCEL LIVEKIT TOKEN'); const lk = await getLiveKitToken({ room: lkRoom, role: 'host', identity: user.id, name: profile?.display_name || user.email || 'Rich Bizness Host' }); setStatus('CONNECTING LIVEKIT ROOM'); room = new Room({ adaptiveStream: true, dynacast: true }); registerMedia(); await room.connect(lk.livekitUrl, lk.token); setStatus('PUBLISHING CAMERA'); for (const track of localTracks) await room.localParticipant.publishTrack(track); registerMedia(); setStatus('SAVING LIVE STREAM'); const saved = await postJson('/api/live-stream-create', { userId: user.id, room: lkRoom, title: LIVE_TITLE, display_room_name: LIVE_ROOM, metadata: { screen: 'live', livekit_url_source: 'vercel_env' } }); stream = saved.stream; live = true; setStatus(LIVE_TITLE); paint(); await awardXp('live_started', { section: 'live', sourceTable: 'live_streams', sourceId: stream?.id }).catch(() => {}); } catch (err) { fail('GO LIVE FAILED', err); } }
async function endLive() { try { if (stream?.id || user?.id) await postJson('/api/live-stream-end', { id: stream?.id, userId: user?.id, room: stream?.livekit_room_name || roomName() }).catch(() => {}); forceStopMedia(); setStatus('READY'); paint(); } catch (err) { fail('END LIVE FAILED', err); } }
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
