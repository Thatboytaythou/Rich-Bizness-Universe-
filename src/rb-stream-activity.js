import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity } from './rb-identity.js?v=profile-avatar-separate-1';

const $ = (s) => document.querySelector(s);
let user = null;
let profile = null;
let stream = null;
let viewSession = null;
let joinedAt = null;

async function bootUser() {
  const state = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  user = state.user || null;
  profile = state.profile || null;
}

function mount() {
  if ($('#rbStreamActivity')) return;
  const side = document.querySelector('.stream-side-card');
  if (!side) return;
  side.insertAdjacentHTML('beforeend', `<section id="rbStreamActivity" class="stream-panel compact-room-list" style="margin-top:12px"><div class="stream-panel-head"><b>Room Activity</b><small id="rbVipState">PUBLIC</small></div><div id="rbStreamChat" class="stream-grid"><div class="stream-card"><b>Loading activity...</b></div></div><form id="rbStreamForm" style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;margin-top:8px"><input id="rbStreamBody" placeholder="Say it live..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" /><button class="identity-pill primary">SEND</button><button type="button" id="rbStreamReact" class="identity-pill">FIRE</button><button type="button" id="rbStreamTip" class="identity-pill">TIP</button></form><div class="identity-stats" style="margin-top:10px"><span><b id="rbMemberCount">0</b><small>Members</small></span><span><b id="rbReactionCount">0</b><small>Reactions</small></span><span><b id="rbTipTotal">$0.00</b><small>Tips</small></span></div></section>`);
}

async function findStream() {
  const roomName = $('#tvRoom')?.textContent?.trim();
  let query = supabase.from('live_streams').select('*').order('created_at', { ascending: false }).limit(1);
  if (roomName && roomName !== 'Bizness Party') query = supabase.from('live_streams').select('*').eq('display_room_name', roomName).order('created_at', { ascending: false }).limit(1);
  const { data } = await query;
  stream = data?.[0] || null;
  return stream;
}

async function ensureMember() {
  if (!stream || !user) return;
  await supabase.from('live_stream_members').upsert({ stream_id: stream.id, user_id: user.id, role: document.body.dataset.section === 'live' ? 'host' : 'viewer', status: 'active', joined_at: new Date().toISOString(), metadata: { source: location.pathname } }, { onConflict: 'stream_id,user_id' }).then(() => {}, () => {});
}

async function ensureViewSession() {
  if (!stream || !user || document.body.dataset.section !== 'watch' || viewSession) return;
  joinedAt = new Date();
  const { data } = await supabase.from('live_view_sessions').insert({ stream_id: stream.id, user_id: user.id, username: profile?.username, display_name: profile?.display_name, joined_at: joinedAt.toISOString(), device_info: { section: 'watch' }, metadata: { source: location.pathname } }).select('*').maybeSingle();
  viewSession = data || null;
}

async function closeViewSession() {
  if (!viewSession?.id || !joinedAt) return;
  const leftAt = new Date();
  const watchSeconds = Math.max(0, Math.round((leftAt - joinedAt) / 1000));
  await supabase.from('live_view_sessions').update({ left_at: leftAt.toISOString(), watch_seconds: watchSeconds }).eq('id', viewSession.id).then(() => {}, () => {});
  viewSession = null;
  joinedAt = null;
}

async function loadChat() {
  if (!stream) await findStream();
  const box = $('#rbStreamChat');
  if (!box || !stream) return;
  const [chatResult, membersResult, reactionsResult, tipsResult, vipResult] = await Promise.all([
    supabase.from('live_chat_messages').select('*').eq('stream_id', stream.id).eq('is_deleted', false).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(40),
    supabase.from('live_stream_members').select('*').eq('stream_id', stream.id).eq('status', 'active').limit(100),
    supabase.from('live_reactions').select('id', { count: 'exact', head: true }).eq('stream_id', stream.id),
    supabase.from('live_tips').select('amount_cents,status').eq('stream_id', stream.id),
    user ? supabase.from('vip_live_access').select('*').eq('stream_id', stream.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const rows = chatResult.data || [];
  if ($('#tvChat')) $('#tvChat').textContent = String(rows.length);
  if ($('#rbMemberCount')) $('#rbMemberCount').textContent = String((membersResult.data || []).length);
  if ($('#rbReactionCount')) $('#rbReactionCount').textContent = String(reactionsResult.count || 0);
  const total = (tipsResult.data || []).filter((tip) => tip.status === 'paid' || tip.status === 'completed').reduce((sum, tip) => sum + Number(tip.amount_cents || 0), 0);
  if ($('#rbTipTotal')) $('#rbTipTotal').textContent = '$' + (total / 100).toFixed(2);
  if ($('#rbVipState')) $('#rbVipState').textContent = vipResult.data?.access_status === 'active' ? 'VIP' : 'PUBLIC';
  box.innerHTML = chatResult.error ? `<div class="stream-card"><b>${chatResult.error.message}</b></div>` : rows.length ? rows.map((message) => `<div class="stream-card"><b>${message.is_pinned ? 'PINNED • ' : ''}${message.display_name || message.username || 'Viewer'}</b><small>${message.body || message.message || ''}</small></div>`).join('') : '<div class="stream-card"><b>No chat yet.</b><small>Start room activity.</small></div>';
}

async function sendChat(text) {
  if (!stream || !user || !text) return;
  await supabase.from('live_chat_messages').insert({ stream_id: stream.id, user_id: user.id, username: profile?.username, display_name: profile?.display_name, body: text, message: text, is_pinned: false, is_deleted: false, metadata: { source: location.pathname } }).then(() => {}, () => {});
  await loadChat();
}

async function react() {
  if (!stream || !user) return;
  await supabase.from('live_reactions').insert({ stream_id: stream.id, user_id: user.id, reaction: 'FIRE', metadata: { source: location.pathname } }).then(() => {}, () => {});
  await loadChat();
}

async function tip() {
  if (!stream || !user) return;
  await supabase.from('live_tips').insert({ stream_id: stream.id, from_user_id: user.id, to_user_id: stream.creator_id, username: profile?.username, display_name: profile?.display_name, amount_cents: 100, platform_fee_cents: 0, creator_amount_cents: 100, currency: 'usd', status: 'pending', message: 'Rich tip', metadata: { source: location.pathname } }).then(() => {}, () => {});
  await loadChat();
}

mount();
bootUser().then(findStream).then(async () => {
  await ensureMember();
  await ensureViewSession();
  await loadChat();
});
$('#rbStreamForm')?.addEventListener('submit', (event) => { event.preventDefault(); const input = $('#rbStreamBody'); const text = input?.value?.trim(); if (input) input.value = ''; sendChat(text); });
$('#rbStreamReact')?.addEventListener('click', react);
$('#rbStreamTip')?.addEventListener('click', tip);
window.addEventListener('pagehide', closeViewSession);
supabase.channel('rb-stream-activity').on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadChat).on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactions' }, loadChat).on('postgres_changes', { event: '*', schema: 'public', table: 'live_tips' }, loadChat).on('postgres_changes', { event: '*', schema: 'public', table: 'live_stream_members' }, loadChat).subscribe();
