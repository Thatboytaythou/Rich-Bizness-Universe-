import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './meta.css';

type World = { id: string; slug: string; title: string; description: string | null; world_type: string; access_type: string; cover_url: string | null; background_url: string | null; visit_count: number | null; like_count: number | null; room_count: number | null; voice_enabled: boolean | null; avatar_required: boolean | null };
type Portal = { id: string; world_id: string | null; title: string; destination_type: string; destination_url: string | null; destination_world_id: string | null; icon: string | null; portal_style: string | null; sort_order: number | null };
type Room = { id: string; world_id: string | null; title: string; room_type: string; status: string; max_members: number | null; active_members: number | null; cover_url: string | null };
type Message = { id: string; room_id: string | null; user_id: string | null; display_name: string | null; username: string | null; body: string; created_at: string };
type Avatar = { display_name: string | null; avatar_url: string | null; aura: string | null; rank: string | null; level: number | null };
type Profile = { username: string | null; display_name: string | null };
type Inventory = { id: string; equipped: boolean | null; meta_items: { title: string | null; item_type: string | null; rarity: string | null; image_url: string | null } | null };

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character));
const routeFor = (portal: Portal) => portal.destination_url || ({ live: ROUTES.live, game: ROUTES.gaming, music: ROUTES.music, store: ROUTES.store, gallery: ROUTES.gallery, world: ROUTES.meta }[portal.destination_type] ?? ROUTES.portal);

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.metaOwner === 'mounted') return;
  root.dataset.metaOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(ROUTES.meta)}`);
    return;
  }

  const [
    { data: worldRows },
    { data: portalRows },
    { data: avatarRow },
    { data: profileRow },
    { data: inventoryRows },
    { data: likedRows },
    { data: membershipRows }
  ] = await Promise.all([
    supabase.from('meta_worlds').select('id,slug,title,description,world_type,access_type,cover_url,background_url,visit_count,like_count,room_count,voice_enabled,avatar_required').eq('status', 'active').order('is_featured', { ascending: false }).order('created_at'),
    supabase.from('meta_portals').select('id,world_id,title,destination_type,destination_url,destination_world_id,icon,portal_style,sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('meta_avatars').select('display_name,avatar_url,aura,rank,level').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('username,display_name').eq('id', user.id).maybeSingle(),
    supabase.from('meta_inventory').select('id,equipped,meta_items(title,item_type,rarity,image_url)').eq('user_id', user.id).order('unlocked_at', { ascending: false }).limit(12),
    supabase.from('meta_world_likes').select('world_id').eq('user_id', user.id),
    supabase.from('meta_room_members').select('room_id,status').eq('user_id', user.id)
  ]);

  const worlds = (worldRows ?? []) as World[];
  const portals = (portalRows ?? []) as Portal[];
  const avatar = (avatarRow ?? {}) as Avatar;
  const profile = (profileRow ?? {}) as Profile;
  const inventory = (inventoryRows ?? []) as unknown as Inventory[];
  const liked = new Set((likedRows ?? []).map((row: any) => String(row.world_id)));
  const joined = new Set((membershipRows ?? []).filter((row: any) => row.status === 'active').map((row: any) => String(row.room_id)));

  let activeWorld = worlds[0] ?? null;
  let activeRoom: Room | null = null;
  let rooms: Room[] = [];
  let chatChannel: ReturnType<typeof supabase.channel> | null = null;
  let roomChannel: ReturnType<typeof supabase.channel> | null = null;
  let destroyed = false;

  root.innerHTML = `<main class="meta-shell"><div class="meta-wrap"><header class="meta-head"><a href="${ROUTES.portal}" aria-label="Back to Portal">←</a><div><p>RICH BIZNESS UNIVERSE</p><h1>Meta</h1></div><span class="meta-live">WORLD SYNC LIVE</span></header><div class="meta-layout"><section id="stage" class="meta-stage"><div class="meta-scene"><div class="meta-world-ring"></div><div class="meta-world-core"></div><div id="portalNodes" class="meta-portals"></div></div><div class="meta-stage-copy"><div><h2 id="worldTitle">Loading world…</h2><p id="worldDescription"></p><div id="worldBadges" class="meta-badges"></div><div class="meta-actions"><button id="enterWorld" class="meta-btn primary">ENTER WORLD</button><button id="likeWorld" class="meta-btn">♡ LIKE</button><a class="meta-btn" href="${ROUTES.avatar}">AVATAR SELECTOR</a><a class="meta-btn" href="${ROUTES.avatarCharacters}">CHARACTER LOBBY</a></div></div></div></section><aside class="meta-side"><section class="meta-panel"><h3>YOUR META IDENTITY</h3><div class="meta-avatar-chip"><img src="${esc(avatar.avatar_url || '/images/brand/Avatar-hero-Banner.png.jpeg')}" alt=""><div><strong>${esc(avatar.display_name || profile.display_name || profile.username || 'Rich Traveler')}</strong><span>${esc(avatar.rank || 'Traveler')} · Level ${avatar.level ?? 1} · ${esc(avatar.aura || 'Green Gold')}</span></div></div></section><section class="meta-panel"><h3>WORLDS</h3><div id="worldList" class="meta-list"></div></section><section class="meta-panel"><h3>ROOMS</h3><div id="roomList" class="meta-list"></div></section><section class="meta-panel chat-panel"><h3 id="chatTitle">ROOM CHAT</h3><div id="chat" class="meta-chat"><div class="meta-card"><p>Join a room to activate chat.</p></div></div><form id="chatForm" class="meta-chat-form"><input id="chatInput" maxlength="1000" placeholder="Send to the room…" disabled><button class="meta-btn primary" disabled>SEND</button></form></section><section class="meta-panel inventory-panel"><h3>INVENTORY</h3><div id="inventory" class="meta-inventory"></div></section><p id="status" class="meta-status"></p></aside></div></div></main>`;

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const worldTitle = root.querySelector<HTMLElement>('#worldTitle')!;
  const worldDescription = root.querySelector<HTMLElement>('#worldDescription')!;
  const worldBadges = root.querySelector<HTMLElement>('#worldBadges')!;
  const worldList = root.querySelector<HTMLElement>('#worldList')!;
  const portalNodes = root.querySelector<HTMLElement>('#portalNodes')!;
  const roomList = root.querySelector<HTMLElement>('#roomList')!;
  const chat = root.querySelector<HTMLElement>('#chat')!;
  const chatTitle = root.querySelector<HTMLElement>('#chatTitle')!;
  const chatForm = root.querySelector<HTMLFormElement>('#chatForm')!;
  const chatInput = root.querySelector<HTMLInputElement>('#chatInput')!;
  const status = root.querySelector<HTMLElement>('#status')!;
  const sendButton = chatForm.querySelector<HTMLButtonElement>('button')!;

  const setStatus = (value: string) => {
    if (destroyed) return;
    status.textContent = value;
    window.setTimeout(() => {
      if (!destroyed && status.textContent === value) status.textContent = '';
    }, 2500);
  };

  const renderInventory = () => {
    root.querySelector<HTMLElement>('#inventory')!.innerHTML = inventory.length
      ? inventory.map((item) => `<div class="meta-item"><strong>${esc(item.meta_items?.title || 'Meta Item')}</strong><small>${esc(item.meta_items?.item_type || 'collectible')} · ${esc(item.meta_items?.rarity || 'common')}${item.equipped ? ' · EQUIPPED' : ''}</small></div>`).join('')
      : '<div class="meta-item"><strong>Inventory ready</strong><small>Unlock items across Meta and Store.</small></div>';
  };

  const renderWorlds = () => {
    worldList.innerHTML = worlds.map((world) => `<button class="meta-card ${activeWorld?.id === world.id ? 'active' : ''}" data-world="${world.id}"><div class="meta-row"><h4>${esc(world.title)}</h4><span>${world.visit_count ?? 0}</span></div><p>${esc(world.world_type)} · ${esc(world.access_type)} · ${world.room_count ?? 0} rooms</p></button>`).join('');
    worldList.querySelectorAll<HTMLButtonElement>('[data-world]').forEach((button) => {
      button.onclick = () => {
        const world = worlds.find((item) => item.id === button.dataset.world);
        if (world) void selectWorld(world);
      };
    });
  };

  const renderPortals = () => {
    if (!activeWorld) {
      portalNodes.innerHTML = '';
      return;
    }
    const rows = portals.filter((portal) => !portal.world_id || portal.world_id === activeWorld!.id);
    const positions = [[8, 18], [72, 12], [4, 62], [76, 60], [38, 4], [39, 67]];
    portalNodes.innerHTML = rows.slice(0, 6).map((portal, index) => `<button class="meta-portal-node" data-portal="${portal.id}" style="left:${positions[index][0]}%;top:${positions[index][1]}%"><div><strong>${esc(portal.icon || '◎')}</strong><span>${esc(portal.title)}</span></div></button>`).join('');
    portalNodes.querySelectorAll<HTMLButtonElement>('[data-portal]').forEach((button) => {
      button.onclick = () => {
        const portal = rows.find((item) => item.id === button.dataset.portal);
        if (portal) location.href = routeFor(portal);
      };
    });
  };

  const renderRooms = () => {
    roomList.innerHTML = rooms.length
      ? rooms.map((room) => `<div class="meta-card ${activeRoom?.id === room.id ? 'active' : ''}"><div class="meta-row"><h4>${esc(room.title)}</h4><span>${room.active_members ?? 0}/${room.max_members ?? 50}</span></div><p>${esc(room.room_type)} room</p><div class="meta-room-actions"><button class="meta-btn ${joined.has(room.id) ? 'primary' : ''}" data-room="${room.id}">${joined.has(room.id) ? 'OPEN' : 'JOIN'}</button>${joined.has(room.id) ? `<button class="meta-btn" data-leave="${room.id}">LEAVE</button>` : ''}</div></div>`).join('')
      : '<div class="meta-card"><p>No active rooms.</p></div>';
    roomList.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((button) => {
      button.onclick = () => {
        const room = rooms.find((item) => item.id === button.dataset.room);
        if (room) void joinRoom(room);
      };
    });
    roomList.querySelectorAll<HTMLButtonElement>('[data-leave]').forEach((button) => {
      button.onclick = () => void leaveRoom(String(button.dataset.leave));
    });
  };

  const renderWorld = () => {
    if (!activeWorld) return;
    const artwork = activeWorld.background_url || activeWorld.cover_url;
    stage.style.setProperty('--meta-bg', artwork ? `linear-gradient(180deg,rgba(4,12,7,.18),rgba(0,0,0,.9)),url("${artwork}")` : 'radial-gradient(circle at 50% 36%,rgba(49,255,99,.25),transparent 20%),#061007');
    worldTitle.textContent = activeWorld.title;
    worldDescription.textContent = activeWorld.description || 'A connected cinematic world inside Rich Bizness.';
    worldBadges.innerHTML = `<span class="meta-badge">${esc(activeWorld.world_type)}</span><span class="meta-badge">${activeWorld.voice_enabled ? 'VOICE ON' : 'VOICE OFF'}</span><span class="meta-badge">${activeWorld.avatar_required ? 'AVATAR REQUIRED' : 'OPEN ACCESS'}</span><span class="meta-badge">${activeWorld.visit_count ?? 0} VISITS</span>`;
    root.querySelector<HTMLButtonElement>('#likeWorld')!.textContent = liked.has(activeWorld.id) ? '♥ LIKED' : '♡ LIKE';
    renderPortals();
    renderWorlds();
  };

  const loadRooms = async () => {
    if (!activeWorld || destroyed) return;
    const { data } = await supabase.from('meta_rooms').select('id,world_id,title,room_type,status,max_members,active_members,cover_url').eq('world_id', activeWorld.id).eq('status', 'open').order('active_members', { ascending: false }).order('created_at');
    if (destroyed) return;
    rooms = (data ?? []) as Room[];
    renderRooms();
  };

  const selectWorld = async (world: World) => {
    activeWorld = world;
    activeRoom = null;
    chatInput.disabled = true;
    sendButton.disabled = true;
    chatTitle.textContent = 'ROOM CHAT';
    chat.innerHTML = '<div class="meta-card"><p>Join a room to activate chat.</p></div>';
    if (chatChannel) {
      await supabase.removeChannel(chatChannel);
      chatChannel = null;
    }
    renderWorld();
    await loadRooms();
  };

  const loadChat = async () => {
    if (!activeRoom || destroyed) return;
    const { data } = await supabase.from('meta_chat_messages').select('id,room_id,user_id,display_name,username,body,created_at').eq('room_id', activeRoom.id).order('created_at', { ascending: true }).limit(100);
    if (destroyed) return;
    const rows = (data ?? []) as Message[];
    chat.innerHTML = rows.length ? rows.map((message) => `<div class="meta-message"><strong>${esc(message.display_name || message.username || 'Rich Traveler')}</strong><p>${esc(message.body)}</p></div>`).join('') : '<div class="meta-card"><p>No messages yet.</p></div>';
    chat.scrollTop = chat.scrollHeight;
  };

  const joinRoom = async (room: Room) => {
    const { error } = await supabase.rpc('rb_join_meta_room', { p_room_id: room.id });
    if (error) {
      setStatus(error.message);
      return;
    }
    joined.add(room.id);
    activeRoom = room;
    chatTitle.textContent = room.title.toUpperCase();
    chatInput.disabled = false;
    sendButton.disabled = false;
    renderRooms();
    await loadChat();
    if (chatChannel) await supabase.removeChannel(chatChannel);
    chatChannel = supabase.channel(`meta-chat:${room.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'meta_chat_messages', filter: `room_id=eq.${room.id}` }, () => void loadChat()).subscribe();
    setStatus(`Entered ${room.title}`);
  };

  const leaveRoom = async (id: string) => {
    const { error } = await supabase.rpc('rb_leave_meta_room', { p_room_id: id });
    if (error) {
      setStatus(error.message);
      return;
    }
    joined.delete(id);
    if (activeRoom?.id === id) {
      activeRoom = null;
      chatInput.disabled = true;
      sendButton.disabled = true;
      chatTitle.textContent = 'ROOM CHAT';
      chat.innerHTML = '<div class="meta-card"><p>Join a room to activate chat.</p></div>';
      if (chatChannel) {
        await supabase.removeChannel(chatChannel);
        chatChannel = null;
      }
    }
    renderRooms();
    setStatus('Left room');
  };

  root.querySelector<HTMLButtonElement>('#enterWorld')!.onclick = async () => {
    if (!activeWorld) return;
    const { error } = await supabase.rpc('rb_enter_meta_world', { p_world_id: activeWorld.id });
    if (error) {
      setStatus(error.message);
      return;
    }
    activeWorld.visit_count = (activeWorld.visit_count ?? 0) + 1;
    renderWorld();
    setStatus('World entered and selected avatar synced');
  };

  root.querySelector<HTMLButtonElement>('#likeWorld')!.onclick = async () => {
    if (!activeWorld) return;
    if (liked.has(activeWorld.id)) {
      await supabase.from('meta_world_likes').delete().eq('world_id', activeWorld.id).eq('user_id', user.id);
      liked.delete(activeWorld.id);
    } else {
      const { error } = await supabase.from('meta_world_likes').insert({ world_id: activeWorld.id, user_id: user.id });
      if (error) {
        setStatus(error.message);
        return;
      }
      liked.add(activeWorld.id);
    }
    renderWorld();
  };

  chatForm.onsubmit = async (event) => {
    event.preventDefault();
    if (!activeRoom) return;
    const body = chatInput.value.trim();
    if (!body) return;
    sendButton.disabled = true;
    const { error } = await supabase.from('meta_chat_messages').insert({ room_id: activeRoom.id, world_id: activeRoom.world_id, user_id: user.id, username: profile.username, display_name: profile.display_name, body, message_type: 'chat' });
    sendButton.disabled = false;
    if (error) {
      setStatus(error.message);
      return;
    }
    chatInput.value = '';
    await loadChat();
  };

  roomChannel = supabase.channel(`meta-room-presence:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'meta_rooms' }, () => void loadRooms()).on('postgres_changes', { event: '*', schema: 'public', table: 'meta_room_members' }, () => void loadRooms()).subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    if (chatChannel) void supabase.removeChannel(chatChannel);
    if (roomChannel) void supabase.removeChannel(roomChannel);
    chatChannel = null;
    roomChannel = null;
    root.dataset.metaOwner = '';
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  renderInventory();
  renderWorlds();
  if (activeWorld) {
    renderWorld();
    await loadRooms();
  }
}