import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity } from './rb-identity.js?v=profile-avatar-separate-1';

export const liveSocial = { key: 'live-social', status: 'active' };

const $ = (s) => document.querySelector(s);
let user = null;
let profile = null;
let stream = null;

function mount() {
  if ($('#liveSocialPanel')) return;
  const host = document.querySelector('.stream-side-card');
  if (!host) return;
  host.insertAdjacentHTML('beforeend', `
    <section id="liveSocialPanel" class="stream-panel compact-room-list" style="margin-top:12px">
      <div class="stream-panel-head"><b>Live Activity</b><small>chat / reactions / tips</small></div>
      <div id="liveSocialList" class="stream-grid"><div class="stream-card"><b>Loading activity...</b></div></div>
      <form id="liveSocialForm" style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;margin-top:8px">
        <input id="liveSocialBody" placeholder="Say it live..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <button class="identity-pill primary">SEND</button>
        <button id="liveSocialReact" type="button" class="identity-pill">FIRE</button>
        <button id="liveSocialTip" type="button" class="identity-pill">TIP</button>
      </form>
    </section>`);
}

async function loadIdentity() {
  const state = await getAuthoritativeIdentity({ fresh: true });
  user = state.user;
  profile = state.profile;
}

async function findStream() {
  const roomName = $('#tvRoom')?.textContent?.trim();
  let query = supabase.from('live_streams').select('*').order('created_at', { ascending: false }).limit(1);
  if (roomName && roomName !== 'Bizness Party') query = supabase.from('live_streams').select('*').eq('display_room_name', roomName).order('created_at', { ascending: false }).limit(1);
  const { data } = await query;
  stream = data?.[0] || null;
}

async function loadActivity() {
  if (!stream) await findStream();
  const box = $('#liveSocialList');
  if (!box || !stream) return;
  const { data, error } = await supabase.from('live_chat_messages').select('*').eq('stream_id', stream.id).eq('is_deleted', false).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20);
  if (error) {
    box.innerHTML = `<div class="stream-card"><b>${error.message}</b></div>`;
    return;
  }
  box.innerHTML = (data || []).length ? data.map((row) => `<div class="stream-card"><b>${row.is_pinned ? 'PINNED • ' : ''}${row.display_name || row.username || 'Viewer'}</b><small>${row.body || row.message || ''}</small></div>`).join('') : '<div class="stream-card"><b>No activity yet.</b><small>Start the room.</small></div>';
  if ($('#tvChat')) $('#tvChat').textContent = String((data || []).length);
}

async function sendChat(text) {
  if (!user || !stream || !text) return;
  await supabase.from('live_chat_messages').insert({ stream_id: stream.id, user_id: user.id, username: profile?.username, display_name: profile?.display_name, body: text, message: text, is_pinned: false, metadata: { source: location.pathname } });
  await loadActivity();
}

async function sendReaction() {
  if (!user || !stream) return;
  await supabase.from('live_reactions').insert({ stream_id: stream.id, user_id: user.id, reaction: 'FIRE', metadata: { source: location.pathname } });
}

async function sendTip() {
  if (!user || !stream) return;
  await supabase.from('live_tips').insert({ stream_id: stream.id, from_user_id: user.id, to_user_id: stream.creator_id, username: profile?.username, display_name: profile?.display_name, amount_cents: 100, platform_fee_cents: 0, creator_amount_cents: 100, currency: 'usd', status: 'pending', message: 'Rich tip', metadata: { source: location.pathname } });
}

mount();
loadIdentity().then(findStream).then(loadActivity);
$('#liveSocialForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#liveSocialBody');
  const text = input?.value?.trim();
  if (input) input.value = '';
  sendChat(text);
});
$('#liveSocialReact')?.addEventListener('click', sendReaction);
$('#liveSocialTip')?.addEventListener('click', sendTip);
supabase.channel('live-social-shared').on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadActivity).subscribe();
