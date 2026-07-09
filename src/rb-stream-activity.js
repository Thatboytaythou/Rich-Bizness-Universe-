import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity } from './rb-identity.js?v=profile-avatar-separate-1';

const $ = (s) => document.querySelector(s);
let user = null;
let profile = null;
let stream = null;

async function bootUser() {
  const state = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  user = state.user || null;
  profile = state.profile || null;
}

function mount() {
  if ($('#rbStreamActivity')) return;
  const side = document.querySelector('.stream-side-card');
  if (!side) return;
  side.insertAdjacentHTML('beforeend', `<section id="rbStreamActivity" class="stream-panel compact-room-list" style="margin-top:12px"><div class="stream-panel-head"><b>Room Activity</b><small>chat / reactions / tips</small></div><div id="rbStreamChat" class="stream-grid"><div class="stream-card"><b>Loading activity...</b></div></div><form id="rbStreamForm" style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;margin-top:8px"><input id="rbStreamBody" placeholder="Say it live..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" /><button class="identity-pill primary">SEND</button><button type="button" id="rbStreamReact" class="identity-pill">FIRE</button><button type="button" id="rbStreamTip" class="identity-pill">TIP</button></form></section>`);
}

async function findStream() {
  const { data } = await supabase.from('live_streams').select('*').order('created_at', { ascending: false }).limit(1);
  stream = data?.[0] || null;
  return stream;
}

async function loadChat() {
  if (!stream) await findStream();
  const box = $('#rbStreamChat');
  if (!box || !stream) return;
  const { data, error } = await supabase.from('live_chat_messages').select('*').eq('stream_id', stream.id).order('created_at', { ascending: false }).limit(12);
  const rows = data || [];
  if ($('#tvChat')) $('#tvChat').textContent = String(rows.length);
  box.innerHTML = error ? `<div class="stream-card"><b>${error.message}</b></div>` : rows.length ? rows.map((m) => `<div class="stream-card"><b>${m.display_name || m.username || 'Viewer'}</b><small>${m.body || m.message || ''}</small></div>`).join('') : '<div class="stream-card"><b>No chat yet.</b><small>Start room activity.</small></div>';
}

async function sendChat(text) {
  if (!stream || !user || !text) return;
  await supabase.from('live_chat_messages').insert({ stream_id: stream.id, user_id: user.id, username: profile?.username, display_name: profile?.display_name, body: text, message_type: 'text' }).then(() => {}, () => {});
  await loadChat();
}

async function react() {
  if (!stream || !user) return;
  await supabase.from('live_reactions').insert({ stream_id: stream.id, user_id: user.id, emoji: '🔥', reaction_type: 'fire' }).then(() => {}, () => {});
}

async function tip() {
  if (!stream || !user) return;
  await supabase.from('live_tips').insert({ stream_id: stream.id, user_id: user.id, amount_cents: 100, currency: 'usd', message: 'Rich tip' }).then(() => {}, () => {});
}

mount();
bootUser().then(findStream).then(loadChat);
$('#rbStreamForm')?.addEventListener('submit', (event) => { event.preventDefault(); const input = $('#rbStreamBody'); const text = input?.value?.trim(); if (input) input.value = ''; sendChat(text); });
$('#rbStreamReact')?.addEventListener('click', react);
$('#rbStreamTip')?.addEventListener('click', tip);
supabase.channel('rb-stream-activity').on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadChat).subscribe();
