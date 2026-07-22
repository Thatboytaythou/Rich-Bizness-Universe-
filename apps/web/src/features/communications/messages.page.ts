import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './communications.css';
import './messages-universe.css';

type Thread = { id: string; title: string | null; thread_type: string | null; last_message: string | null; last_message_at: string | null; typing_label: string | null; default_reaction?: string | null; bubble_theme?: string | null; is_pinned?: boolean | null; is_muted?: boolean | null; unread_count?: number | null };
type Message = { id: string; thread_id: string; sender_id: string | null; display_name: string | null; username: string | null; body: string | null; message_type: string | null; media_url: string | null; media_type?: string | null; created_at: string | null; reply_to_message_id?: string | null; is_edited?: boolean | null };
type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; online_status: string | null };
type ThreadSnapshot = { thread?: Record<string, unknown> | null; members?: Array<Record<string, unknown>>; messages?: Message[]; reactions?: Array<{ message_id: string; emoji: string; user_id: string }>; typing?: Array<{ user_id: string; typing_label: string }> };
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
const stamp = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';
const isUuid = (value: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.messagesOwner === 'mounted') return;
  root.dataset.messagesOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }

  root.innerHTML = `<main class="comm-shell messages-shell"><div class="comm-wrap">
    <header class="comm-head"><a href="${ROUTES.portal}" aria-label="Back to Portal">←</a><div><p>RICH-DM’S • PRIVATE REALTIME</p><h1>Messages</h1></div><div class="message-head-actions"><a href="${ROUTES.notifications}" class="comm-button">ALERTS</a><a href="${ROUTES.settings}" class="comm-button">SETTINGS</a><span class="comm-pill">LIVE</span></div></header>
    <p id="messageStatus" class="status-line" role="status"></p>
    <section class="message-layout"><aside class="comm-card thread-list-shell"><div class="thread-toolbar"><input id="threadSearch" placeholder="Search conversations" autocomplete="off"/><button id="newThread" class="comm-button primary" type="button" aria-label="New conversation">＋</button></div><div id="threadList" class="comm-list thread-list"></div></aside><section id="threadPanel" class="comm-card thread-panel"><div class="comm-empty">Choose a conversation or start a new one.</div></section></section>
  </div></main>`;

  const threadList = root.querySelector<HTMLElement>('#threadList')!;
  const panel = root.querySelector<HTMLElement>('#threadPanel')!;
  const search = root.querySelector<HTMLInputElement>('#threadSearch')!;
  const status = root.querySelector<HTMLElement>('#messageStatus')!;

  const params = new URLSearchParams(location.search);
  let activeThread = params.get('thread');
  const requestedUser = params.get('to');
  let threadChannel: Channel | null = null;
  let listChannel: Channel | null = null;
  let typingTimer: number | undefined;
  let refreshTimer: number | undefined;
  let threads: Thread[] = [];
  let destroyed = false;
  let loadingThreads = false;
  let loadingThread = false;

  const setStatus = (message: string) => {
    if (destroyed) return;
    status.textContent = message;
    window.setTimeout(() => { if (!destroyed && status.textContent === message) status.textContent = ''; }, 3200);
  };

  const scheduleThreads = () => {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void loadThreads(), 180);
  };

  const setTyping = async (threadId: string, value: boolean) => {
    await supabase.rpc('rb_dm_set_typing', { p_thread_id: threadId, p_is_typing: value });
  };

  const drawThreads = () => {
    const query = search.value.trim().toLowerCase();
    const rows = threads.filter((thread) => !query || `${thread.title ?? ''} ${thread.last_message ?? ''}`.toLowerCase().includes(query));
    threadList.innerHTML = rows.length ? rows.map((thread) => `<button class="comm-item ${activeThread === thread.id ? 'active' : ''}" data-thread="${thread.id}"><span class="comm-icon">${thread.thread_type === 'group' ? '👥' : '💨'}</span><div><h3>${esc(thread.title || 'Rich Conversation')}</h3><p>${esc(thread.last_message || thread.typing_label || 'Start the smoke...')}</p></div><span class="thread-side"><time>${stamp(thread.last_message_at)}</time>${Number(thread.unread_count ?? 0) > 0 ? `<b>${Number(thread.unread_count)}</b>` : ''}${thread.is_pinned ? '<i>PIN</i>' : ''}</span></button>`).join('') : '<div class="comm-empty">No conversations found.</div>';
    threadList.querySelectorAll<HTMLButtonElement>('[data-thread]').forEach((button) => button.onclick = () => void openThread(button.dataset.thread!));
  };

  const loadThreads = async () => {
    if (destroyed || loadingThreads) return;
    loadingThreads = true;
    try {
      const { data, error } = await supabase.rpc('rb_dm_threads_snapshot', { p_limit: 150 });
      if (error) throw error;
      threads = (((data as any)?.threads ?? []) as Thread[]);
      drawThreads();
      if (activeThread && threads.some((thread) => thread.id === activeThread) && !threadChannel && !loadingThread) await openThread(activeThread);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Unable to load conversations.');
    } finally {
      loadingThreads = false;
    }
  };

  const drawThread = async (threadId: string, snapshot: ThreadSnapshot) => {
    if (destroyed || activeThread !== threadId) return;
    const thread = snapshot.thread ?? {};
    const messages = snapshot.messages ?? [];
    const reactions = snapshot.reactions ?? [];
    const typing = snapshot.typing ?? [];
    const defaultReaction = String((thread as any).default_reaction || '💨');

    panel.innerHTML = `<header class="thread-title"><div><strong>${esc(String((thread as any).title || 'Rich Conversation'))}</strong><p>${esc(String((thread as any).typing_label || 'encrypted realtime room'))}</p></div><div class="thread-actions"><button id="audioCall" title="Audio call">☎</button><button id="videoCall" title="Video call">◉</button><button id="threadInfo" title="Thread info">⋯</button></div></header><div id="messageFeed" class="message-feed"></div><div id="typingRow" class="typing-row">${esc(typing[0]?.typing_label || '')}</div><form id="composer" class="composer"><button id="attachButton" class="icon-button" type="button">＋</button><input id="messageInput" maxlength="2000" autocomplete="off" placeholder="Send a Rich-DM..."/><button class="comm-button primary">SEND</button><input id="attachmentInput" type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx"/></form>`;

    const feed = panel.querySelector<HTMLElement>('#messageFeed')!;
    feed.innerHTML = messages.length ? messages.map((message) => {
      const counts = reactions.filter((reaction) => reaction.message_id === message.id).reduce((all: Record<string, number>, reaction) => { all[reaction.emoji] = (all[reaction.emoji] || 0) + 1; return all; }, {});
      const media = message.media_url ? `<a class="message-attachment" href="${esc(message.media_url)}" target="_blank" rel="noopener">OPEN ${esc((message.message_type || 'attachment').toUpperCase())}</a>` : '';
      return `<article class="bubble ${message.sender_id === user.id ? 'mine' : ''}" data-message="${message.id}"><p>${esc(message.body || '')}</p>${media}<small>${esc(message.display_name || message.username || 'Rich Member')} · ${stamp(message.created_at)}${message.is_edited ? ' · edited' : ''}</small><div class="bubble-tools"><button type="button" data-react="${esc(defaultReaction)}">${esc(defaultReaction)} ${counts[defaultReaction] || ''}</button><button type="button" data-react="🔥">🔥 ${counts['🔥'] || ''}</button><button type="button" data-react="💯">💯 ${counts['💯'] || ''}</button></div></article>`;
    }).join('') : '<div class="comm-empty">Start the conversation.</div>';
    feed.scrollTop = feed.scrollHeight;

    feed.querySelectorAll<HTMLButtonElement>('[data-react]').forEach((button) => button.onclick = async () => {
      const message = button.closest<HTMLElement>('[data-message]')?.dataset.message;
      if (!message) return;
      const { error } = await supabase.rpc('rb_dm_toggle_reaction', { p_message_id: message, p_emoji: button.dataset.react });
      if (error) setStatus(error.message); else await refreshThread(threadId);
    });

    const input = panel.querySelector<HTMLInputElement>('#messageInput')!;
    const attachmentInput = panel.querySelector<HTMLInputElement>('#attachmentInput')!;
    panel.querySelector<HTMLFormElement>('#composer')!.onsubmit = async (event) => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body || input.disabled) return;
      input.disabled = true;
      try {
        const { error } = await supabase.rpc('rb_dm_send_message', { p_thread_id: threadId, p_body: body, p_reply_to: null });
        if (error) throw error;
        input.value = '';
        await setTyping(threadId, false);
      } catch (caught) {
        setStatus(caught instanceof Error ? caught.message : 'Unable to send message.');
      } finally {
        input.disabled = false;
        input.focus();
      }
    };

    input.oninput = () => {
      void setTyping(threadId, true);
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => void setTyping(threadId, false), 1400);
    };

    panel.querySelector<HTMLButtonElement>('#attachButton')!.onclick = () => attachmentInput.click();
    attachmentInput.onchange = async () => {
      const file = attachmentInput.files?.[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) { setStatus('Attachment must be 25 MB or smaller.'); return; }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user.id}/dm/${threadId}/${crypto.randomUUID()}-${safeName}`;
      try {
        const { error: uploadError } = await supabase.storage.from('general-uploads').upload(path, file, { contentType: file.type || 'application/octet-stream', cacheControl: '31536000', upsert: false });
        if (uploadError) throw uploadError;
        const url = supabase.storage.from('general-uploads').getPublicUrl(path).data.publicUrl;
        const { error } = await supabase.rpc('rb_dm_finalize_attachment', { p_thread_id: threadId, p_file_url: url, p_file_name: file.name, p_mime_type: file.type || 'application/octet-stream', p_file_size: file.size, p_storage_path: path });
        if (error) throw error;
        attachmentInput.value = '';
      } catch (caught) {
        setStatus(caught instanceof Error ? caught.message : 'Unable to upload attachment.');
      }
    };

    const startCall = async (type: 'audio' | 'video') => {
      const { data, error } = await supabase.rpc('rb_dm_start_call', { p_thread_id: threadId, p_call_type: type });
      if (error) { setStatus(error.message); return; }
      const callId = String((data as any)?.call_id || '');
      if (callId) location.href = `${ROUTES.messages}?thread=${encodeURIComponent(threadId)}&call=${encodeURIComponent(callId)}`;
    };
    panel.querySelector<HTMLButtonElement>('#audioCall')!.onclick = () => void startCall('audio');
    panel.querySelector<HTMLButtonElement>('#videoCall')!.onclick = () => void startCall('video');

    const { error: readError } = await supabase.rpc('rb_dm_mark_thread_read', { p_thread_id: threadId });
    if (!readError) {
      const cached = threads.find((item) => item.id === threadId);
      if (cached) cached.unread_count = 0;
      drawThreads();
    }
  };

  const refreshThread = async (threadId: string) => {
    if (destroyed || activeThread !== threadId || loadingThread) return;
    loadingThread = true;
    try {
      const { data, error } = await supabase.rpc('rb_dm_thread_snapshot', { p_thread_id: threadId, p_limit: 350 });
      if (error) throw error;
      await drawThread(threadId, (data ?? {}) as ThreadSnapshot);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Unable to open conversation.');
    } finally {
      loadingThread = false;
    }
  };

  const openThread = async (threadId: string) => {
    if (destroyed || loadingThread) return;
    if (activeThread && activeThread !== threadId) await setTyping(activeThread, false);
    activeThread = threadId;
    drawThreads();
    history.replaceState({}, '', `${ROUTES.messages}?thread=${encodeURIComponent(threadId)}`);
    if (threadChannel) await supabase.removeChannel(threadChannel);
    threadChannel = supabase.channel(`rich-dm:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` }, () => void refreshThread(threadId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_status', filter: `thread_id=eq.${threadId}` }, () => void refreshThread(threadId))
      .subscribe();
    await refreshThread(threadId);
  };

  const openDirectFor = async (profileId: string) => {
    if (!isUuid(profileId) || profileId === user.id) {
      setStatus('Invalid message recipient.');
      return;
    }
    const { data: threadId, error } = await supabase.rpc('rb_create_direct_thread', { p_other_user: profileId });
    if (error) {
      setStatus(error.message);
      return;
    }
    const id = String(threadId || '');
    if (!isUuid(id)) {
      setStatus('Unable to open conversation.');
      return;
    }
    activeThread = id;
    history.replaceState({}, '', `${ROUTES.messages}?thread=${encodeURIComponent(id)}`);
    await loadThreads();
    await openThread(id);
  };

  const openNewThread = () => {
    if (document.querySelector('.new-thread-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'new-thread-modal';
    modal.innerHTML = `<section class="comm-card new-thread-card"><header class="thread-title"><div><strong>New Rich-DM</strong><p>Search people by name or username.</p></div><button id="closeNew" class="comm-button">✕</button></header><input id="profileSearch" placeholder="Search Rich Bizness members" autocomplete="off"/><div id="profileResults" class="profile-results"></div></section>`;
    document.body.append(modal);
    const box = modal.querySelector<HTMLInputElement>('#profileSearch')!;
    const results = modal.querySelector<HTMLElement>('#profileResults')!;
    modal.querySelector<HTMLButtonElement>('#closeNew')!.onclick = () => modal.remove();
    box.oninput = async () => {
      const query = box.value.trim();
      if (query.length < 2) { results.innerHTML = ''; return; }
      const { data, error } = await supabase.rpc('rb_dm_search_profiles', { p_query: query, p_limit: 20 });
      if (error) { results.innerHTML = `<div class="comm-empty">${esc(error.message)}</div>`; return; }
      results.innerHTML = ((data ?? []) as Profile[]).map((profile) => `<article class="profile-result"><a href="/profile.html?id=${encodeURIComponent(profile.id)}"><img src="${esc(profile.avatar_url || '/brand/icons/profile-placeholder.svg')}" alt=""><div><strong>${esc(profile.display_name || profile.username || 'Rich Member')}</strong><p>@${esc(profile.username || 'member')} · ${esc(profile.online_status || 'offline')}</p></div></a><button class="comm-button primary" data-user="${profile.id}">MESSAGE</button></article>`).join('') || '<div class="comm-empty">No message-ready members found.</div>';
      results.querySelectorAll<HTMLButtonElement>('[data-user]').forEach((button) => button.onclick = async () => {
        modal.remove();
        await openDirectFor(String(button.dataset.user || ''));
      });
    };
  };

  search.oninput = drawThreads;
  root.querySelector<HTMLButtonElement>('#newThread')!.onclick = openNewThread;
  await loadThreads();
  if (requestedUser) await openDirectFor(requestedUser);

  listChannel = supabase.channel(`rich-dm-list:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members', filter: `user_id=eq.${user.id}` }, scheduleThreads)
    .subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    if (typingTimer) window.clearTimeout(typingTimer);
    if (refreshTimer) window.clearTimeout(refreshTimer);
    if (activeThread) void setTyping(activeThread, false);
    if (threadChannel) void supabase.removeChannel(threadChannel);
    if (listChannel) void supabase.removeChannel(listChannel);
    document.querySelector('.new-thread-modal')?.remove();
    delete root.dataset.messagesOwner;
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
