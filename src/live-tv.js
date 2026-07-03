import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js';

const LIVEKIT_URL = 'wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud';
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
let stream = null;

function roomName() {
  return stream?.livekit_room_name || stream?.display_room_name || 'Bizness Party';
}

function screenHtml() {
  const url = stream?.recording_url || stream?.metadata?.stream_url || stream?.metadata?.embed_url || '';
  if (/youtube\.com|youtu\.be|vimeo\.com|player\./i.test(url)) return `<iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  if (/\.mp4|\.webm|\.m3u8/i.test(url)) return `<video controls playsinline src="${url}" poster="${stream?.thumbnail_url || stream?.cover_url || ''}"></video>`;
  return `<div class="holo-empty"><div class="holo-orb"></div><b>WE 🔥 📺</b><p>${roomName()} • ${LIVEKIT_URL}</p></div>`;
}

function paint() {
  $('#holoScreen').innerHTML = screenHtml();
  $('#tvTitle').textContent = stream?.title || 'We 🔥 📺';
  $('#tvRoom').textContent = roomName();
  $('#tvStatus').textContent = (stream?.status || 'standby').toUpperCase();
  $('#tvViewers').textContent = fmt(stream?.viewer_count || 0);
  $('#tvChat').textContent = fmt(stream?.total_chat_messages || 0);
  $('#tvRevenue').textContent = '$' + (Number(stream?.total_revenue_cents || 0) / 100).toFixed(2);
}

async function load() {
  const { data } = await supabase.from('live_streams').select('id,title,status,display_slug,display_room_name,livekit_room_name,thumbnail_url,cover_url,recording_url,viewer_count,total_chat_messages,total_reactions,total_revenue_cents,metadata,created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
  stream = data || null;
  paint();
}

async function watching() {
  if (!stream?.id) return;
  const { data } = await supabase.auth.getUser();
  await supabase.from('live_view_sessions').insert({ stream_id: stream.id, user_id: data?.user?.id || null, metadata: { screen: 'we_fire_tv', livekit_url: LIVEKIT_URL } });
  await awardXp('live_watch', { section: 'live', sourceTable: 'live_streams', sourceId: stream.id });
}

$('#watchXp')?.addEventListener('click', watching);
$('#refreshTv')?.addEventListener('click', load);
$('#imOut')?.addEventListener('click', () => { location.href = '/'; });
load();
supabase.channel('we-fire-tv-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, load)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, load)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactions' }, load)
  .subscribe();
