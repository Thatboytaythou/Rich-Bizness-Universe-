import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

export const liveActivityFeature = {
  key: 'live-activity',
  status: 'activity-ready'
};

const state = {
  user: null,
  profile: null,
  stream: null,
  chats: [],
  members: [],
  vip: null,
  viewSession: null,
  joinedAt: null
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

async function identity() {
  const result = await getAuthoritativeIdentity({ fresh: true });
  state.user = result.user;
  state.profile = result.profile;
  return result;
}

function mount() {
  if ($('#liveActivityPanel')) return;
  const side = document.querySelector('.stream-side-card') || document.querySelector('.identity-shell');
  if (!side) return;
  side.insertAdjacentHTML('beforeend', `
    <section id="liveActivityPanel" class="stream-panel compact-room-list" style="margin-top:12px">
      <div class="stream-panel-head"><b>Live Activity</b><small id="liveVipState">PUBLIC</small></div>
      <div id="liveChatList" class="stream-grid"><div class="stream-card"><b>Loading activity...</b></div></div>
      <form id="liveChatForm" style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;margin-top:8px">
        <input id="liveChatBody" placeholder="Say it live..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <button class="identity-pill primary">SEND</button>
        <button id="liveReactBtn" type="button" class="identity-pill">FIRE</button>
        <button id="liveTipBtn" type="button" class="identity-pill">TIP</button>
      </form>
      <div class="identity-stats" style="margin-top:10px">
        <span><b id="liveMemberCount">0</b><small>Members</small></span>
        <span><b id="liveReactionCount">0</b><small>Reactions</small></span>
        <span><b id="liveTipTotal">$0.00</b><small>Tips</small></span>
      </div>
    </section>`);
}

async function selectStream() {
  const query = supabase.from('live_streams').select('*').order('created_at', { ascending: false }).limit(1);
  const { data } = await query;
  state.stream = data?.[0] || null;
  return state.stream;
}

function renderChat() {
  const list = $('#liveChatList');
  if (!list) return;
  const pinned = state.chats.filter((item) => item.is_pinned);
  const rest = state.chats.filter((item) => !item.is_pinned);
  list.innerHTML = [...pinned, ...rest].length ? [...pinned, ...rest].map((item) => `<div class="stream-card"><b>${item.is_pinned ? 'PINNED • ' : ''}${esc(item.display_name || item.username || 'Viewer')}</b><small>${esc(item.body || item.message || '')}</small></div>`).join('') : '<div class="stream-card"><b>No chat yet.</b><small>Start the room activity.</small></div>';
  if ($('#tvChat')) $('#tvChat').textContent = String(state.chats.length);
}

async function loadActivity() {
  if (!state.stream) await selectStream();
  if (!state.stream) return;
  const [chatResult, membersResult, reactionsResult, tipsResult, vipResult] = await Promise.all([
    supabase.from('live_chat_messages').select('*').eq('stream_id', state.stream.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(40),
    supabase.from('live_stream_members').select('*').eq('stream_id', state.stream.id).eq('status', 'active').limit(100),
    supabase.from('live_reactions').select('id', { count: 'exact' }).eq('stream_id', state.stream.id),
    supabase.from('live_tips').select('amount_cents,status').eq('stream_id', state.stream.id),
    state.user ? supabase.from('vip_live_access').select('*').eq('stream_id', state.stream.id).eq('user_id', state.user.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  state.chats = chatResult.data || [];
  state.members = membersResult.data || [];
  state.vip = vipResult.data || null;
  renderChat();
  if ($('#liveMemberCount')) $('#liveMemberCount').textContent = String(state.members.length);
  if ($('#liveReactionCount')) $('#liveReactionCount').textContent = String(reactionsResult.count || 0);
  const tipTotal = (tipsResult.data || []).filter((item) => item.status === 'paid' || item.status === 'completed').reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  if ($('#liveTipTotal')) $('#liveTipTotal').textContent = '$' + (tipTotal / 100).toFixed(2);
  if ($('#liveVipState')) $('#liveVipState').textContent = state.vip?.access_status === 'active' ? 'VIP' : 'PUBLIC';
}

async function joinMember() {
  if (!state.stream || !state.user) return;
  await supabase.from('live_stream_members').upsert({ stream_id: state.stream.id, user_id: state.user.id, role: document.body.dataset.section === 'live' ? 'host' : 'viewer', status: 'active', joined_at: new Date().toISOString(), metadata: { source: document.body.dataset.section } }, { onConflict: 'stream_id,user_id' }).then(() => {}, () => {});
}

async function startViewSession() {
  if (!state.stream || !state.user || document.body.dataset.section !== 'watch') return;
  state.joinedAt = new Date();
  const { data } = await supabase.from('live_view_sessions').insert({ stream_id: state.stream.id, user_id: state.user.id, username: state.profile?.username, display_name: state.profile?.display_name, joined_at: state.joinedAt.toISOString(), device_info: { section: 'watch' }, metadata: { source: 'watch-page' } }).select('*').maybeSingle();
  state.viewSession = data || null;
}

async function closeViewSession() {
  if (!state.viewSession?.id || !state.joinedAt) return;
  const leftAt = new Date();
  const seconds = Math.max(0, Math.round((leftAt - state.joinedAt) / 1000));
  await supabase.from('live_view_sessions').update({ left_at: leftAt.toISOString(), watch_seconds: seconds }).eq('id', state.viewSession.id).then(() => {}, () => {});
  state.viewSession = null;
  state.joinedAt = null;
}

async function sendChat(body) {
  const text = String(body || '').trim();
  if (!text || !state.stream || !state.user) return;
  await supabase.from('live_chat_messages').insert({ stream_id: state.stream.id, user_id: state.user.id, username: state.profile?.username, display_name: state.profile?.display_name, message: text, body: text, is_pinned: false, is_deleted: false, metadata: { source: document.body.dataset.section } });
  await loadActivity();
}

async function react() {
  if (!state.stream || !state.user) return;
  await supabase.from('live_reactions').insert({ stream_id: state.stream.id, user_id: state.user.id, reaction: 'FIRE', metadata: { source: document.body.dataset.section } });
  await loadActivity();
}

async function tip() {
  if (!state.stream || !state.user) return;
  const amount = 100;
  await supabase.from('live_tips').insert({ stream_id: state.stream.id, from_user_id: state.user.id, to_user_id: state.stream.creator_id, username: state.profile?.username, display_name: state.profile?.display_name, amount_cents: amount, platform_fee_cents: 0, creator_amount_cents: amount, currency: 'usd', status: 'pending', message: 'Rich tip', metadata: { source: document.body.dataset.section } });
  await loadActivity();
}

mount();
identity().then(selectStream).then(async () => {
  await joinMember();
  await startViewSession();
  await loadActivity();
});

$('#liveChatForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#liveChatBody');
  const body = input?.value || '';
  if (input) input.value = '';
  sendChat(body);
});
$('#liveReactBtn')?.addEventListener('click', react);
$('#liveTipBtn')?.addEventListener('click', tip);
window.addEventListener('pagehide', closeViewSession);

supabase.channel('live-activity-owner')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadActivity)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactions' }, loadActivity)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_tips' }, loadActivity)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'live_stream_members' }, loadActivity)
  .subscribe();
