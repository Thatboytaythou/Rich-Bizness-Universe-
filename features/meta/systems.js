import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

export const metaSystemsFeature = {
  key: 'meta-systems',
  status: 'world-systems-ready'
};

const state = {
  user: null,
  profile: null,
  world: null,
  room: null,
  rooms: [],
  portals: [],
  messages: [],
  inventory: []
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
  if ($('#metaSystemsPanel')) return;
  const shell = document.querySelector('.identity-shell');
  if (!shell) return;
  shell.insertAdjacentHTML('beforeend', `
    <section id="metaSystemsPanel" class="identity-panel-grid" style="margin-top:14px">
      <section class="identity-panel">
        <h2>Rooms + Portals</h2>
        <div id="metaSystemsList" class="cards"><div class="empty">Select a world.</div></div>
      </section>
      <aside class="identity-panel">
        <h2>World Chat</h2>
        <div id="metaChatList" style="max-height:240px;overflow:auto;display:grid;gap:8px"><div class="empty">No chat yet.</div></div>
        <form id="metaChatForm" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px">
          <input id="metaChatBody" placeholder="Say it in Meta..." style="min-height:44px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
          <button class="identity-pill primary">DROP</button>
        </form>
        <div class="identity-stats" style="margin-top:10px">
          <span><b id="metaRoomCount">0</b><small>Rooms</small></span>
          <span><b id="metaPortalCount">0</b><small>Portals</small></span>
          <span><b id="metaInventoryCount">0</b><small>Inventory</small></span>
        </div>
      </aside>
    </section>`);
}

function renderSystems() {
  const list = $('#metaSystemsList');
  if (!list) return;
  const roomCards = state.rooms.map((room) => `<article class="card" data-meta-room="${room.id}"><b>${esc(room.title || 'Meta Room')}</b><p>${esc(room.room_type || 'room')} • ${Number(room.active_members || 0).toLocaleString()} active</p><small>${esc(room.status || 'ready')}</small></article>`);
  const portalCards = state.portals.map((portal) => `<article class="card"><b>${esc(portal.icon || '◎')} ${esc(portal.title || 'Portal')}</b><p>${esc(portal.destination_type || 'route')}</p><small>${esc(portal.portal_style || 'portal')}</small>${portal.destination_url ? `<p><a class="identity-pill" href="${esc(portal.destination_url)}">ENTER</a></p>` : ''}</article>`);
  list.innerHTML = [...roomCards, ...portalCards].join('') || '<div class="empty">No rooms or portals yet.</div>';
  document.querySelectorAll('[data-meta-room]').forEach((node) => node.addEventListener('click', () => joinRoom(node.dataset.metaRoom)));
}

function renderChat() {
  const list = $('#metaChatList');
  if (!list) return;
  list.innerHTML = state.messages.length ? state.messages.map((message) => `<article style="border:1px solid rgba(157,255,99,.12);border-radius:16px;padding:10px;background:rgba(0,0,0,.26)"><b>${esc(message.display_name || message.username || 'Meta User')}</b><p>${esc(message.body || '')}</p><small>${new Date(message.created_at).toLocaleString()}</small></article>`).join('') : '<div class="empty">No world chat yet.</div>';
}

async function loadForWorld(world) {
  if (!world?.id || !state.user?.id) return;
  state.world = world;
  const [roomsResult, portalsResult, chatResult, inventoryResult] = await Promise.all([
    supabase.from('meta_rooms').select('*').eq('world_id', world.id).limit(24),
    supabase.from('meta_portals').select('*').eq('world_id', world.id).eq('is_active', true).order('sort_order', { ascending: true }).limit(24),
    supabase.from('meta_chat_messages').select('*').eq('world_id', world.id).order('created_at', { ascending: false }).limit(32),
    supabase.from('meta_inventory').select('*,item:meta_items(*)').eq('user_id', state.user.id).limit(48)
  ]);
  state.rooms = roomsResult.data || [];
  state.portals = portalsResult.data || [];
  state.messages = chatResult.data || [];
  state.inventory = inventoryResult.data || [];
  if ($('#metaRoomCount')) $('#metaRoomCount').textContent = String(state.rooms.length);
  if ($('#metaPortalCount')) $('#metaPortalCount').textContent = String(state.portals.length);
  if ($('#metaInventoryCount')) $('#metaInventoryCount').textContent = String(state.inventory.length);
  renderSystems();
  renderChat();
  await supabase.from('meta_visits').insert({ world_id: world.id, user_id: state.user.id, username: state.profile?.username, display_name: state.profile?.display_name, metadata: { source: 'meta-systems' } }).then(() => {}, () => {});
}

async function joinRoom(roomId) {
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room || !state.user) return;
  state.room = room;
  await supabase.from('meta_room_members').upsert({ room_id: room.id, user_id: state.user.id, role: 'member', status: 'active', joined_at: new Date().toISOString(), metadata: { source: 'meta-page' } }, { onConflict: 'room_id,user_id' }).then(() => {}, () => {});
  const status = $('#metaStatus');
  if (status) status.textContent = `Joined ${room.title || 'Meta Room'}.`;
}

async function sendChat(body) {
  const text = String(body || '').trim();
  if (!text || !state.world || !state.user) return;
  await supabase.from('meta_chat_messages').insert({ room_id: state.room?.id || null, world_id: state.world.id, user_id: state.user.id, username: state.profile?.username, display_name: state.profile?.display_name, body: text, message_type: 'text', metadata: { source: 'meta-page' } });
  await loadForWorld(state.world);
}

mount();
identity();
window.addEventListener('rb:meta-world-selected', (event) => loadForWorld(event.detail?.world));
$('#metaChatForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#metaChatBody');
  const body = input?.value || '';
  if (input) input.value = '';
  sendChat(body);
});

supabase.channel('meta-systems-owner')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_rooms' }, () => state.world && loadForWorld(state.world))
  .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_portals' }, () => state.world && loadForWorld(state.world))
  .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_chat_messages' }, () => state.world && loadForWorld(state.world))
  .subscribe();
