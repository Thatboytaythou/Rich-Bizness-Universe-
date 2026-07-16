import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './communications.css';
import './messages-universe.css';

type Thread = { id: string; title: string | null; thread_type: string | null; last_message: string | null; last_message_at: string | null; typing_label: string | null; default_reaction?: string | null; bubble_theme?: string | null };
type Message = { id: string; thread_id: string; sender_id: string | null; display_name: string | null; username: string | null; body: string | null; message_type: string | null; media_url: string | null; created_at: string | null; reply_to_message_id?: string | null; is_edited?: boolean | null };
type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; online_status: string | null };
type Identity = { username: string | null; display_name: string | null; avatar_url: string | null };
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
const stamp = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.messagesOwner === 'mounted') return;
  root.dataset.messagesOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(ROUTES.messages)}`);
    return;
  }

  const { data: identityData } = await supabase.from('profiles').select('username,display_name,avatar_url').eq('id', user.id).maybeSingle();
  const identity = (identityData ?? {}) as Identity;

  root.innerHTML = `<main class="comm-shell messages-shell"><div class="comm-wrap"><header class="comm-head"><a href="${ROUTES.portal}" aria-label="Back to Portal">←</a><div><p>RICH-DM’S • PRIVATE REALTIME</p><h1>Messages</h1></div><div class="message-head-actions"><a href="${ROUTES.notifications}" class="comm-button">ALERTS</a><a href="${ROUTES.settings}" class="comm-button">SETTINGS</a><span class="comm-pill">LIVE</span></div></header><p id="messageStatus" class="status-line" role="status"></p><section class="message-layout"><aside class="comm-card thread-list-shell"><div class="thread-toolbar"><input id="threadSearch" placeholder="Search conversations" autocomplete="off"/><button id="newThread" class="comm-button primary" type="button" aria-label="New conversation">＋</button></div><div id="threadList" class="comm-list thread-list"></div></aside><section id="threadPanel" class="comm-card thread-panel"><div class="comm-empty">Choose a conversation or start a new one.</div></section></section></div></main>`;

  const threadList = root.querySelector<HTMLElement>('#threadList')!;
  const panel = root.querySelector<HTMLElement>('#threadPanel')!;
  const search = root.querySelector<HTMLInputElement>('#threadSearch')!;
  const status = root.querySelector<HTMLElement>('#messageStatus')!;

  let activeThread: string | null = new URLSearchParams(location.search).get('thread');
  let threadChannel: Channel | null = null;
  let threadListChannel: Channel | null = null;
  let typingTimer: number | undefined;
  let cachedThreads: Thread[] = [];
  let destroyed = false;
  let threadLoadPromise: Promise<void> | null = null;
  let messageLoadPromise: Promise<void> | null = null;
  let queuedMessageRefresh = false;

  const setStatus = (message: string) => {
    if (destroyed) return;
    status.textContent = message;
    window.setTimeout(() => { if (!destroyed && status.textContent === message) status.textContent = ''; }, 3200);
  };

  const stopTyping = async (threadId: string) => {
    if (typingTimer) window.clearTimeout(typingTimer);
    await supabase.from('dm_typing_status').upsert({ thread_id: threadId, user_id: user.id, is_typing: false, typing_label: 'rolling smoke...', updated_at: new Date().toISOString() }, { onConflict: 'thread_id,user_id' });
  };

  const drawThreads = () => {
    const query = search.value.trim().toLowerCase();
    const rows = cachedThreads.filter((thread) => !query || (thread.title ?? '').toLowerCase().includes(query) || (thread.last_message ?? '').toLowerCase().includes(query));
    threadList.innerHTML = rows.length ? rows.map((thread) => `<button class="comm-item ${activeThread === thread.id ? 'active' : ''}" data-thread="${thread.id}"><span class="comm-icon">${thread.thread_type === 'group' ? '👥' : '💨'}</span><div><h3>${esc(thread.title || 'Rich Conversation')}</h3><p>${esc(thread.last_message || thread.typing_label || 'Start the smoke...')}</p></div><time>${stamp(thread.last_message_at)}</time></button>`).join('') : '<div class="comm-empty">No conversations found.</div>';
    threadList.querySelectorAll<HTMLButtonElement>('[data-thread]').forEach((button) => button.addEventListener('click', () => void openThread(button.dataset.thread!)));
  };

  const fetchMessages = async (threadId: string): Promise<Message[]> => {
    const { data, error } = await supabase.from('dm_messages').select('id,thread_id,sender_id,display_name,username,body,message_type,media_url,created_at,reply_to_message_id,is_edited').eq('thread_id', threadId).eq('is_deleted', false).order('created_at', { ascending: true }).limit(250);
    if (error) throw error;
    return (data ?? []) as Message[];
  };

  const markThreadRead = async (threadId: string, rows: Message[]) => {
    const unread = rows.filter((message) => message.sender_id && message.sender_id !== user.id);
    const now = new Date().toISOString();
    await supabase.from('dm_thread_members').update({ last_read_at: now }).eq('thread_id', threadId).eq('user_id', user.id);
    if (unread.length) {
      await supabase.from('dm_message_reads').upsert(unread.map((message) => ({ message_id: message.id, thread_id: threadId, user_id: user.id, read_at: now })), { onConflict: 'message_id,user_id' });
    }
  };

  const loadThreads = async () => {
    if (threadLoadPromise) return threadLoadPromise;
    threadLoadPromise = (async () => {
      const { data: members, error } = await supabase.from('dm_thread_members').select('thread_id,is_pinned,last_read_at').eq('user_id', user.id).eq('status', 'active');
      if (error) throw error;
      const ids = (members ?? []).map((member: any) => String(member.thread_id));
      if (!ids.length) {
        cachedThreads = [];
        drawThreads();
        return;
      }
      const { data, error: threadError } = await supabase.from('dm_threads').select('id,title,thread_type,last_message,last_message_at,typing_label,default_reaction,bubble_theme').in('id', ids).eq('is_archived', false).order('last_message_at', { ascending: false, nullsFirst: false });
      if (threadError) throw threadError;
      cachedThreads = (data ?? []) as Thread[];
      drawThreads();
      if (activeThread && ids.includes(activeThread) && !threadChannel) await openThread(activeThread);
    })().finally(() => { threadLoadPromise = null; });
    return threadLoadPromise;
  };

  const openThread = async (threadId: string) => {
    if (destroyed) return;
    if (activeThread && activeThread !== threadId) await stopTyping(activeThread);
    activeThread = threadId;
    drawThreads();
    history.replaceState({}, '', `${ROUTES.messages}?thread=${encodeURIComponent(threadId)}`);
    if (threadChannel) {
      await supabase.removeChannel(threadChannel);
      threadChannel = null;
    }

    const [{ data: thread, error: threadError }, { data: members, error: memberError }, messages] = await Promise.all([
      supabase.from('dm_threads').select('id,title,typing_label,call_theme,default_reaction,bubble_theme').eq('id', threadId).single(),
      supabase.from('dm_thread_members').select('user_id,role,status').eq('thread_id', threadId).eq('status', 'active'),
      fetchMessages(threadId)
    ]);
    if (threadError) throw threadError;
    if (memberError) throw memberError;

    const defaultReaction = String((thread as any)?.default_reaction || '💨');
    panel.innerHTML = `<header class="thread-title"><div><strong>${esc((thread as any)?.title || 'Rich Conversation')}</strong><p id="typingText">${esc((thread as any)?.typing_label || 'encrypted realtime room')}</p></div><div class="thread-actions"><button id="audioCall" title="Audio call">☎</button><button id="videoCall" title="Video call">◉</button><button id="threadInfo" title="Thread info">⋯</button></div></header><div id="messageFeed" class="message-feed"></div><div id="typingRow" class="typing-row"></div><form id="composer" class="composer"><button id="attachButton" class="icon-button" type="button">＋</button><input id="messageInput" maxlength="2000" autocomplete="off" placeholder="Send a Rich-DM..."/><button class="comm-button primary">SEND</button><input id="attachmentInput" type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx"/></form>`;

    const feed = panel.querySelector<HTMLElement>('#messageFeed')!;
    const input = panel.querySelector<HTMLInputElement>('#messageInput')!;
    const attachmentInput = panel.querySelector<HTMLInputElement>('#attachmentInput')!;

    const draw = async (rows: Message[]) => {
      if (destroyed || activeThread !== threadId) return;
      const ids = rows.map((message) => message.id);
      let reactions: any[] = [];
      if (ids.length) {
        const { data } = await supabase.from('dm_message_reactions').select('message_id,emoji,user_id').in('message_id', ids);
        reactions = data ?? [];
      }
      feed.innerHTML = rows.length ? rows.map((message) => {
        const counts = reactions.filter((reaction) => reaction.message_id === message.id).reduce((accumulator: Record<string, number>, reaction: any) => { accumulator[reaction.emoji] = (accumulator[reaction.emoji] || 0) + 1; return accumulator; }, {});
        const media = message.media_url ? `<a class="message-attachment" href="${esc(message.media_url)}" target="_blank" rel="noopener">OPEN ${esc((message.message_type || 'attachment').toUpperCase())}</a>` : '';
        return `<article class="bubble ${message.sender_id === user.id ? 'mine' : ''}" data-message="${message.id}"><p>${esc(message.body || '')}</p>${media}<small>${esc(message.display_name || message.username || 'Rich Member')} · ${stamp(message.created_at)}${message.is_edited ? ' · edited' : ''}</small><div class="bubble-tools"><button type="button" data-react="${esc(defaultReaction)}">${esc(defaultReaction)} ${counts[defaultReaction] || ''}</button><button type="button" data-react="🔥">🔥 ${counts['🔥'] || ''}</button><button type="button" data-react="💯">💯 ${counts['💯'] || ''}</button></div></article>`;
      }).join('') : '<div class="comm-empty">Start the conversation.</div>';
      feed.scrollTop = feed.scrollHeight;
      feed.querySelectorAll<HTMLButtonElement>('[data-react]').forEach((button) => button.addEventListener('click', async () => {
        const article = button.closest<HTMLElement>('[data-message]');
        if (!article) return;
        const { error } = await supabase.from('dm_message_reactions').upsert({ message_id: article.dataset.message!, user_id: user.id, emoji: button.dataset.react!, reaction_style: 'smoke-cloud' }, { onConflict: 'message_id,user_id,emoji' });
        if (error) { setStatus(error.message); return; }
        await refreshMessages();
      }));
      await markThreadRead(threadId, rows);
    };

    const refreshMessages = async () => {
      if (messageLoadPromise) {
        queuedMessageRefresh = true;
        return messageLoadPromise;
      }
      messageLoadPromise = (async () => { await draw(await fetchMessages(threadId)); })().finally(async () => {
        messageLoadPromise = null;
        if (queuedMessageRefresh && !destroyed && activeThread === threadId) {
          queuedMessageRefresh = false;
          await refreshMessages();
        }
      });
      return messageLoadPromise;
    };

    await draw(messages);

    panel.querySelector<HTMLFormElement>('#composer')!.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      input.disabled = true;
      try {
        const { error } = await supabase.from('dm_messages').insert({ thread_id: threadId, sender_id: user.id, username: identity.username, display_name: identity.display_name, body, message_type: 'text', bubble_style: 'smoke-cloud' });
        if (error) throw error;
        input.value = '';
        await stopTyping(threadId);
      } catch (caught) {
        setStatus(caught instanceof Error ? caught.message : 'Unable to send message.');
      } finally {
        input.disabled = false;
        input.focus();
      }
    });

    input.addEventListener('input', () => {
      void supabase.from('dm_typing_status').upsert({ thread_id: threadId, user_id: user.id, is_typing: true, typing_label: 'rolling smoke...', updated_at: new Date().toISOString() }, { onConflict: 'thread_id,user_id' });
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => void stopTyping(threadId), 1400);
    });

    panel.querySelector('#attachButton')?.addEventListener('click', () => attachmentInput.click());
    attachmentInput.addEventListener('change', async () => {
      const file = attachmentInput.files?.[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) { setStatus('Attachment must be 25 MB or smaller.'); return; }
      const path = `${user.id}/${threadId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      try {
        const { error: uploadError } = await supabase.storage.from('general-uploads').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
        if (uploadError) throw uploadError;
        const url = supabase.storage.from('general-uploads').getPublicUrl(path).data.publicUrl;
        const messageType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file';
        const { data: inserted, error: insertError } = await supabase.from('dm_messages').insert({ thread_id: threadId, sender_id: user.id, username: identity.username, display_name: identity.display_name, body: file.name, media_url: url, media_type: file.type, message_type: messageType, bubble_style: 'smoke-cloud' }).select('id').single();
        if (insertError) throw insertError;
        const { error: attachmentError } = await supabase.from('dm_message_attachments').insert({ message_id: (inserted as any).id, user_id: user.id, file_url: url, file_name: file.name, file_type: messageType, mime_type: file.type, file_size: file.size, metadata: { storage_bucket: 'general-uploads', storage_path: path } });
        if (attachmentError) throw attachmentError;
        attachmentInput.value = '';
      } catch (caught) {
        setStatus(caught instanceof Error ? caught.message : 'Unable to upload attachment.');
      }
    });

    const startCall = async (type: 'audio' | 'video') => {
      const room = `rich-call-${crypto.randomUUID().slice(0, 8)}`;
      const { data, error } = await supabase.from('dm_call_sessions').insert({ thread_id: threadId, started_by: user.id, call_type: type, call_status: 'ringing', livekit_room_name: room, call_theme: 'Rich Call', visual_style: 'smoke-cloud' }).select('id').single();
      if (error) { setStatus(error.message); return; }
      const participants = (members ?? []).map((member: any) => ({ call_id: (data as any).id, user_id: member.user_id, role: member.user_id === user.id ? 'host' : 'participant', status: member.user_id === user.id ? 'joined' : 'invited', audio_enabled: true, video_enabled: type === 'video' }));
      const { error: participantError } = await supabase.from('dm_call_participants').insert(participants);
      if (participantError) { setStatus(participantError.message); return; }
      location.href = `${ROUTES.messages}?thread=${encodeURIComponent(threadId)}&call=${encodeURIComponent((data as any).id)}`;
    };

    panel.querySelector('#audioCall')?.addEventListener('click', () => void startCall('audio'));
    panel.querySelector('#videoCall')?.addEventListener('click', () => void startCall('video'));

    threadChannel = supabase.channel(`dm-premium:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` }, () => void refreshMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_reactions' }, () => void refreshMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_status', filter: `thread_id=eq.${threadId}` }, async () => {
        const { data } = await supabase.from('dm_typing_status').select('user_id,is_typing,typing_label').eq('thread_id', threadId).eq('is_typing', true).neq('user_id', user.id);
        const row = (data ?? [])[0] as any;
        const typingRow = panel.querySelector<HTMLElement>('#typingRow');
        if (typingRow) typingRow.textContent = row?.typing_label || '';
      }).subscribe();
  };

  const openNewThread = () => {
    if (document.querySelector('.new-thread-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'new-thread-modal';
    modal.innerHTML = `<section class="comm-card new-thread-card"><header class="thread-title"><div><strong>New Rich-DM</strong><p>Search people by name or username.</p></div><button id="closeNew" class="comm-button">✕</button></header><input id="profileSearch" placeholder="Search Rich Bizness members" autocomplete="off"/><div id="profileResults" class="profile-results"></div></section>`;
    document.body.append(modal);
    const box = modal.querySelector<HTMLInputElement>('#profileSearch')!;
    const results = modal.querySelector<HTMLElement>('#profileResults')!;
    modal.querySelector('#closeNew')?.addEventListener('click', () => modal.remove());
    box.addEventListener('input', async () => {
      const query = box.value.trim();
      if (query.length < 2) { results.innerHTML = ''; return; }
      const { data, error } = await supabase.rpc('rb_dm_search_profiles', { p_query: query, p_limit: 20 });
      if (error) { results.innerHTML = `<div class="comm-empty">${esc(error.message)}</div>`; return; }
      results.innerHTML = ((data ?? []) as Profile[]).map((profile) => `<article class="profile-result"><img src="${esc(profile.avatar_url || '/brand/icons/profile-placeholder.svg')}" alt=""><div><strong>${esc(profile.display_name || profile.username || 'Rich Member')}</strong><p>@${esc(profile.username || 'member')} · ${esc(profile.online_status || 'offline')}</p></div><button class="comm-button primary" data-user="${profile.id}">MESSAGE</button></article>`).join('') || '<div class="comm-empty">No message-ready members found.</div>';
      results.querySelectorAll<HTMLButtonElement>('[data-user]').forEach((button) => button.addEventListener('click', async () => {
        const { data: threadId, error: createError } = await supabase.rpc('rb_create_direct_thread', { p_other_user: button.dataset.user });
        if (createError) { results.innerHTML = `<div class="comm-empty">${esc(createError.message)}</div>`; return; }
        modal.remove();
        activeThread = String(threadId);
        await loadThreads();
        await openThread(activeThread);
      }));
    });
  };

  search.addEventListener('input', drawThreads);
  root.querySelector('#newThread')?.addEventListener('click', openNewThread);
  await loadThreads();

  threadListChannel = supabase.channel(`thread-list:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members', filter: `user_id=eq.${user.id}` }, () => void loadThreads())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_threads' }, () => void loadThreads())
    .subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    if (typingTimer) window.clearTimeout(typingTimer);
    if (activeThread) void stopTyping(activeThread);
    if (threadChannel) void supabase.removeChannel(threadChannel);
    if (threadListChannel) void supabase.removeChannel(threadListChannel);
    document.querySelector('.new-thread-modal')?.remove();
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
