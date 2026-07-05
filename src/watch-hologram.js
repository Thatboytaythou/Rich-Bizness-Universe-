import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=no-floating-badge-1';
import { getAuthoritativeIdentity } from './rb-identity.js?v=identity-public-1';

const LIVEKIT_URL = 'wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud';
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
let streams = [];
let active = null;
let awarded = false;

function mediaUrl(row) { return row?.recording_url || row?.stream_url || row?.metadata?.stream_url || row?.metadata?.embed_url || ''; }
function screenFor(row) { const url = mediaUrl(row); if (url && /youtube\.com|youtu\.be|vimeo\.com|player\./i.test(url)) return `<iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; if (url && /\.mp4|\.webm|\.m3u8/i.test(url)) return `<video controls playsinline src="${url}" poster="${row.thumbnail_url || row.cover_url || ''}"></video>`; return `<div class="holo-empty"><div class="holo-orb"></div><b>${row ? 'LIVEKIT ROOM READY' : 'NO STREAM SELECTED'}</b><p>${row ? `Room: ${row.livekit_room_name || row.display_room_name || 'Bizness Party'} — ${LIVEKIT_URL}` : 'The watch room is connected to live_streams, chat, reactions, recordings, and LiveKit rooms.'}</p></div>`; }
function card(row, i) { const thumb = row.thumbnail_url || row.cover_url; return `<article class="stream-card ${active?.id === row.id ? 'active' : ''}" data-i="${i}"><div class="stream-thumb">${thumb ? `<img src="${thumb}" alt="">` : '📺'}</div><b>${row.title || row.display_room_name || 'WE LIT🔥'}</b><small>${(row.status || 'draft').toUpperCase()} • ${fmt(row.viewer_count)} watching</small></article>`; }
function render() { active ||= streams[0] || null; if ($('#holoScreen')) $('#holoScreen').innerHTML = screenFor(active); if ($('#tvTitle')) $('#tvTitle').textContent = active?.title || 'WE LIT🔥'; if ($('#tvRoom')) $('#tvRoom').textContent = active?.livekit_room_name || active?.display_room_name || 'Bizness Party'; if ($('#tvStatus')) $('#tvStatus').textContent = (active?.status || 'standby').toUpperCase(); if ($('#tvViewers')) $('#tvViewers').textContent = fmt(active?.viewer_count || 0); if ($('#tvState')) $('#tvState').textContent = active?.status === 'live' ? 'LIVE' : 'READY'; if ($('#tvChat')) $('#tvChat').textContent = fmt(active?.total_chat_messages || 0); if ($('#streamGrid')) $('#streamGrid').innerHTML = streams.length ? streams.map(card).join('') : '<div class="stream-card"><b>No live streams yet</b><small>Create a live room and it appears here.</small></div>'; document.querySelectorAll('.stream-card[data-i]').forEach((el) => el.addEventListener('click', () => { active = streams[Number(el.dataset.i)]; render(); })); }
async function loadStreams() { const { data, error } = await supabase.from('live_streams').select('id,title,description,status,display_room_name,livekit_room_name,thumbnail_url,cover_url,recording_url,viewer_count,total_chat_messages,total_reactions,metadata,created_at').order('created_at', { ascending: false }).limit(16); if (error && $('#tvStatus')) $('#tvStatus').textContent = error.message; streams = data || []; render(); }
async function logWatch() { if (!active || awarded) return; const { user } = await getAuthoritativeIdentity(); if (!user) { location.href = '/auth.html'; return; } awarded = true; await awardXp('live_watch', { section: 'watch', sourceTable: 'live_streams', sourceId: active.id }); await supabase.from('live_view_sessions').insert({ stream_id: active.id, user_id: user.id, metadata: { screen: 'watch', livekit_url: LIVEKIT_URL } }); }

$('#refreshTv')?.addEventListener('click', loadStreams);
$('#watchXp')?.addEventListener('click', logWatch);
loadStreams();
supabase.channel('watch-hologram-tv').on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, loadStreams).on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadStreams).on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactions' }, loadStreams).subscribe();