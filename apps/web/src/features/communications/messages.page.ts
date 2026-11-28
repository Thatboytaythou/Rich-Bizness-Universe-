import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './communications.css';
import './messages-universe.css';

type Thread = { id: string; title: string | null; thread_type: string | null; last_message: string | null; last_message_at: string | null; typing_label: string | null; default_reaction?: string | null; bubble_theme?: string | null; is_pinned?: boolean | null; is_muted?: boolean | null; unread_count?: number | null };
type Message = { id: string; thread_id: string; sender_id: string | null; display_name: string | null; username: string | null; body: string | null; message_type: string | null; media_url: string | null; media_type?: string | null; created_at: string | null; reply_to_message_id?: string | null; is_edited?: boolean | null };
type Attachment = { id?: string; message_id: string; file_url?: string | null; media_url?: string | null; file_name?: string | null; mime_type?: string | null; file_size?: number | null };
type CallSession = { id: string; call_type?: string | null; call_status?: string | null; started_at?: string | null; ended_at?: string | null; started_by?: string | null };
type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; online_status: string | null };
type ThreadSnapshot = { thread?: Record<string, unknown> | null; members?: Array<Record<string, unknown>>; messages?: Message[]; attachments?: Attachment[]; reactions?: Array<{ message_id: string; emoji: string; user_id: string }>; typing?: Array<{ user_id: string; typing_label: string }>; calls?: CallSession[]; call_sessions?: CallSession[] };
type Channel = ReturnType<typeof supabase.channel>;
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>'\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[character] ?? character);
const stamp = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';
const isUuid = (value: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
const bytes = (value: number | null | undefined) => {
  const amount = Number(value ?? 0);
  if (!amount) return '';
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)} KB`;
  return `${(amount / 1024 / 1024).toFixed(1)} MB`;
};
const safeHref = (value: string | null | undefined) => {
  try {
    if(!value?.trim())return '';
    const url = new URL(value, location.origin);
    // Legacy DM attachments used a public bucket; do not redisplay public object links.
    if(url.pathname.includes('/storage/v1/object/public/'))return '';
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const mountEpoch = root.dataset.pageEpoch ?? '';
  let destroyed = false;
  const isCurrent = () => !destroyed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === 'rich-bizness-messages-v3';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }

  root.innerHTML = `<main class="comm-shell messages-shell"><div class="comm-wrap">
    <header class="comm-head"><a href="${ROUTES.portal}" aria-label="Back to Portal">←</a><div><p>RICH-DM’S • PRIVATE REALTIME</p><h1>Messages</h1></div><div class="message-head-actions"><a href="${ROUTES.notifications}" class="comm-button">ALERTS</a><a href="${ROUTES.settings}" class="comm-button">SETTINGS</a><span class="comm-pill">LIVE</span></div></header>
    <section class="dm-command-summary"><article><small>CONVERSATIONS</small><strong id="threadCount">0</strong><span>Synced private rooms</span></article><article><small>UNREAD</small><strong id="unreadCount">0</strong><span>Messages waiting</span></article><article><small>ACTIVE THREAD</small><strong id="activeState">NONE</strong><span>Realtime room state</span></article><article><small>ATTACHMENTS</small><strong id="attachmentState">READY</strong><span>Images, video, audio, files</span></article></section>
    <p id="messageStatus" class="status-line" role="status"></p>
    <section class="message-layout"><aside class="comm-card thread-list-shell"><div class="thread-toolbar"><input id="threadSearch" placeholder="Search conversations" autocomplete="off"/><button id="newThread" class="comm-button primary" type="button" aria-label="New conversation">＋</button></div><div id="threadList" class="comm-list thread-list"></div></aside><section id="threadPanel" class="comm-card thread-panel"><div class="comm-empty rich-dm-empty"><span>💨</span><h2>Choose a Rich-DM</h2><p>Open a private realtime room or start a new conversation.</p></div></section></section>
  </div></main>`;

  const threadList = root.querySelector<HTMLElement>('#threadList')!;
  const panel = root.querySelector<HTMLElement>('#threadPanel')!;
  const search = root.querySelector<HTMLInputElement>('#threadSearch')!;
  const status = root.querySelector<HTMLElement>('#messageStatus')!;
  const threadCount = root.querySelector<HTMLElement>('#threadCount')!;
  const unreadCount = root.querySelector<HTMLElement>('#unreadCount')!;
  const activeState = root.querySelector<HTMLElement>('#activeState')!;
  const attachmentState = root.querySelector<HTMLElement>('#attachmentState')!;

  const params = new URLSearchParams(location.search);
  let activeThread = isUuid(params.get('thread'))?params.get('thread'):null;
  const requestedUser = params.get('to');
  const sharedPostId = isUuid(params.get('share')) ? params.get('share') : null;
  let sharedPostPending = sharedPostId;
  let threadChannel: Channel | null = null;
  let listChannel: Channel | null = null;
  let typingTimer: number | undefined;
  let refreshTimer: number | undefined;
  let statusTimer: number | undefined;
  let threads: Thread[] = [];
  let loadingThreads = false;
  let loadingThread = false;
  let threadQueued=false,listQueued=false,opening=false,sending=false,sharing=false;
  let threadRevision=0,threadRefreshTimer:number|undefined,queuedOpen:string|null=null;
  let verifiedThread:string|null=null;
  let typingThread:string|null=null;
  const lastRead=new Map<string,string>();
  const reactionPending=new Set<string>();
  let directPending=false;
  const drafts=new Map<string,string>();
  const currentThread=(id:string)=>isCurrent()&&getAuthSnapshot().user?.id===user.id&&activeThread===id;
  const scheduleThread=(id:string)=>{if(!currentThread(id))return;if(threadRefreshTimer)clearTimeout(threadRefreshTimer);threadRefreshTimer=window.setTimeout(()=>void refreshThread(id),160);};

  const setStatus = (message: string) => {
    if (!isCurrent()) return;
    status.textContent = message;
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { if (isCurrent() && status.textContent === message) status.textContent = ''; }, 3200);
  };

  const updateSummary = () => {
    if (!isCurrent()) return;
    threadCount.textContent = String(threads.length);
    unreadCount.textContent = String(threads.reduce((total, thread) => total + Number(thread.unread_count ?? 0), 0));
    activeState.textContent = activeThread ? (verifiedThread===activeThread?'OPEN':'VERIFYING') : 'NONE';
  };

  const scheduleThreads = () => {
    if (!isCurrent()) return;
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void loadThreads(), 180);
  };

  const setTyping = async (threadId: string, value: boolean) => {
    if (!isCurrent()||getAuthSnapshot().user?.id!==user.id) return;
    try{await supabase.rpc('rb_dm_set_typing', { p_thread_id: threadId, p_is_typing: value });}catch{/* typing is transient; never interrupt delivery */}
  };

  const drawThreads = () => {
    if (!isCurrent()) return;
    const query = search.value.trim().toLowerCase();
    const rows = threads.filter((thread) => !query || `${thread.title ?? ''} ${thread.last_message ?? ''}`.toLowerCase().includes(query));
    threadList.innerHTML = rows.length ? rows.map((thread) => `<button class="comm-item ${activeThread === thread.id ? 'active' : ''}" data-thread="${thread.id}"><span class="comm-icon">${thread.thread_type === 'group' ? '👥' : '💨'}</span><div><h3>${esc(thread.title || 'Rich Conversation')}</h3><p>${esc(thread.last_message || thread.typing_label || 'Start the smoke...')}</p></div><span class="thread-side"><time>${stamp(thread.last_message_at)}</time>${Number(thread.unread_count ?? 0) > 0 ? `<b>${Number(thread.unread_count)}</b>` : ''}${thread.is_pinned ? '<i>PIN</i>' : ''}</span></button>`).join('') : '<div class="comm-empty">No conversations found.</div>';
    threadList.querySelectorAll<HTMLButtonElement>('[data-thread]').forEach((button) => button.onclick = () => void openThread(button.dataset.thread!));
    updateSummary();
  };

  const sendSharedPost = async (threadId: string) => {
    if (!sharedPostPending || !currentThread(threadId)||sharing) return;
    sharing=true;
    try {
    const postId = sharedPostPending;
    const { data, error } = await supabase.rpc('rb_feed_snapshot', { p_section: 'all', p_limit: 1, p_post_id: postId });
    if (!isCurrent()) return;
    if (error) throw error;
    const post = (((data as any)?.posts ?? []) as Array<Record<string, unknown>>).find((row) => String(row.id) === postId);
    if (!post) throw new Error('Shared post is unavailable.');
    const title = String(post.title || post.body || 'Rich Bizness post').trim().slice(0, 180);
    const body = `Shared from Rich Feed: ${title}\n${location.origin}/feed.html?post=${encodeURIComponent(postId)}`;
    const { error: sendError } = await supabase.rpc('rb_dm_send_message', { p_thread_id: threadId, p_body: body, p_reply_to: null });
    if (!isCurrent()) return;
    if (sendError) throw sendError;
    sharedPostPending = null;
    params.delete('share');
    params.set('thread', threadId);
    history.replaceState({}, '', `${ROUTES.messages}?${params.toString()}`);
    setStatus('Post shared to Rich-DM.');
    } finally {sharing=false;}
  };

  const drawThread = async (threadId: string, snapshot: ThreadSnapshot) => {
    if (!currentThread(threadId)) return;
    const thread = snapshot.thread ?? {};
    verifiedThread=threadId;activeState.textContent='OPEN';
    const messages = [...new Map((snapshot.messages??[]).filter(m=>m.thread_id===threadId).map(m=>[m.id,m])).values()];
    const attachments = snapshot.attachments ?? [];
    const reactions = snapshot.reactions ?? [];
    const typing = snapshot.typing ?? [];
    const calls = snapshot.calls ?? snapshot.call_sessions ?? [];
    const activeCall = calls.find((call) => ['ringing', 'active'].includes(String(call.call_status ?? '').toLowerCase())) ?? null;
    const defaultReaction = String((thread as any).default_reaction || '💨');
    attachmentState.textContent = 'PRIVATE STORAGE REQUIRED';
    const priorInput=panel.querySelector<HTMLInputElement>('#messageInput');
    const priorFeed=panel.querySelector<HTMLElement>('#messageFeed');
    const keepFocus=priorInput===document.activeElement;
    const keepScroll=priorFeed&&priorFeed.scrollHeight-priorFeed.scrollTop-priorFeed.clientHeight>80;
    const previousScroll=priorFeed?.scrollTop??0;

    panel.innerHTML = `<header class="thread-title"><div><strong>${esc(String((thread as any).title || 'Rich Conversation'))}</strong><p>${esc(String((thread as any).typing_label || 'Private member room'))}</p></div><div class="thread-actions"><button id="audioCall" title="Audio call">☎</button><button id="videoCall" title="Video call">◉</button><button id="threadInfo" title="Conversation settings">⋯</button></div></header>${activeCall ? `<section class="active-call-strip"><div><small>${esc(String(activeCall.call_type || 'rich call').toUpperCase())}</small><strong>${esc(String(activeCall.call_status || 'ACTIVE').toUpperCase())}</strong></div><a href="${ROUTES.messages}?thread=${encodeURIComponent(threadId)}&call=${encodeURIComponent(activeCall.id)}">REJOIN CALL</a></section>` : ''}${sharedPostPending?'<button id="confirmSharedPost" class="comm-button" type="button">Share selected post to this conversation</button>':''}<div id="messageFeed" class="message-feed"></div><div id="typingRow" class="typing-row">${esc(typing[0]?.typing_label || '')}</div><form id="composer" class="composer"><button id="attachButton" class="icon-button" type="button" aria-label="Private attachments unavailable" title="Private attachment storage is not verified" disabled>＋</button><input id="messageInput" maxlength="2000" autocomplete="off" placeholder="Send a Rich-DM..."/><button class="comm-button primary">SEND</button><input id="attachmentInput" type="file" disabled hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx"/></form>`;

    const feed = panel.querySelector<HTMLElement>('#messageFeed')!;
    feed.innerHTML = messages.length ? messages.map((message) => {
      const counts = reactions.filter((reaction) => reaction.message_id === message.id).reduce((all: Record<string, number>, reaction) => { all[reaction.emoji] = (all[reaction.emoji] || 0) + 1; return all; }, {});
      const linkedAttachments = attachments.filter((item) => item.message_id === message.id);
      const legacyMedia: Attachment[] = message.media_url ? [{ message_id: message.id, file_url: message.media_url, file_name: message.message_type || 'attachment', mime_type: message.media_type || message.message_type || '' }] : [];
      const mediaRows = linkedAttachments.length ? linkedAttachments : legacyMedia;
      const media = mediaRows.map((item) => {
        const href = safeHref(item.file_url || item.media_url);
        if (!href) return '<span class="message-attachment">Attachment unavailable until private storage is verified.</span>';
        const mime = String(item.mime_type || '').toLowerCase();
        const name = item.file_name || 'Rich attachment';
        if (mime.startsWith('image/')) return `<a class="message-media-preview image" href="${esc(href)}" target="_blank" rel="noopener"><img src="${esc(href)}" alt="${esc(name)}" loading="lazy"><span>${esc(name)}</span></a>`;
        if (mime.startsWith('video/')) return `<video class="message-media-player" controls preload="metadata" src="${esc(href)}"></video>`;
        if (mime.startsWith('audio/')) return `<audio class="message-media-player" controls preload="metadata" src="${esc(href)}"></audio>`;
        return `<a class="message-attachment" href="${esc(href)}" target="_blank" rel="noopener"><span>OPEN FILE</span><strong>${esc(name)}</strong><small>${esc(bytes(item.file_size))}</small></a>`;
      }).join('');
      return `<article class="bubble ${message.sender_id === user.id ? 'mine' : ''}" data-message="${message.id}"><p>${esc(message.body || '')}</p>${media}<small>${esc(message.display_name || message.username || 'Rich Member')} · ${stamp(message.created_at)}${message.is_edited ? ' · edited' : ''}</small><div class="bubble-tools"><button type="button" data-react="${esc(defaultReaction)}">${esc(defaultReaction)} ${counts[defaultReaction] || ''}</button><button type="button" data-react="🔥">🔥 ${counts['🔥'] || ''}</button><button type="button" data-react="💯">💯 ${counts['💯'] || ''}</button></div></article>`;
    }).join('') : '<div class="comm-empty rich-dm-empty"><span>💨</span><h2>Start the conversation</h2><p>Send a message, attachment, reaction or Rich Call.</p></div>';
    feed.scrollTop = keepScroll?previousScroll:feed.scrollHeight;

    feed.querySelectorAll<HTMLButtonElement>('[data-react]').forEach((button) => button.onclick = async () => {
      const message = button.closest<HTMLElement>('[data-message]')?.dataset.message;
      const emoji=button.dataset.react;if (!message||!emoji||!currentThread(threadId)) return;
      const key=message+':'+emoji;if(reactionPending.has(key))return;reactionPending.add(key);button.disabled=true;
      try{const {error}=await supabase.rpc('rb_dm_toggle_reaction',{p_message_id:message,p_emoji:emoji});if(currentThread(threadId)){if(error)setStatus('Reaction not confirmed.');else scheduleThread(threadId);}}catch{setStatus('Reaction not confirmed.');}finally{reactionPending.delete(key);if(button.isConnected)button.disabled=false;}
    });

    const input = panel.querySelector<HTMLInputElement>('#messageInput')!;
    input.value=drafts.get(threadId)??'';
    input.disabled=sending;
    if(keepFocus&&!sending){input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);}
    panel.querySelector<HTMLButtonElement>('#threadInfo')!.onclick=()=>location.assign(ROUTES.settings+'#privacy');
    const shareButton=panel.querySelector<HTMLButtonElement>('#confirmSharedPost');if(shareButton)shareButton.onclick=async()=>{if(!currentThread(threadId)||sharing||sending||verifiedThread!==threadId)return;shareButton.disabled=true;try{await sendSharedPost(threadId);scheduleThread(threadId);}catch{setStatus('Share not confirmed. Check the conversation before retrying.');}finally{if(shareButton.isConnected)shareButton.disabled=false;}};
    panel.querySelector<HTMLFormElement>('#composer')!.onsubmit = async (event) => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body || input.disabled || sending || !currentThread(threadId)) return;
      sending=true;input.disabled = true;
      try {
        const { data,error } = await supabase.rpc('rb_dm_send_message', { p_thread_id: threadId, p_body: body, p_reply_to: null });
        if (!currentThread(threadId)) return;
        if (error||!data) throw Error('Delivery not confirmed. Check the conversation before retrying.');
        drafts.delete(threadId);input.value = '';
        await setTyping(threadId, false);
      } catch (caught) {
        setStatus(caught instanceof Error ? caught.message : 'Unable to send message.');
      } finally {
        sending=false;if(currentThread(threadId)){input.disabled=false;input.focus({preventScroll:true});scheduleThread(threadId);}
      }
    };

    input.oninput = () => {
      if(!currentThread(threadId))return;drafts.set(threadId,input.value);
      if(typingThread!==threadId){typingThread=threadId;void setTyping(threadId,true);}
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => {typingThread=null;void setTyping(threadId,false);}, 1400);
    };

    // Upload disabled until a member-scoped private bucket and authorized delivery exist.

    const startCall = async (type: 'audio' | 'video') => {
      if (!currentThread(threadId)||verifiedThread!==threadId) return;
      // A server call record is not proof of a connected audio/video transport.
      setStatus(type==='audio'?'Audio transport is not verified in this build.':'Video transport is not verified in this build.');
    };
    panel.querySelector<HTMLButtonElement>('#audioCall')!.onclick = () => void startCall('audio');
    panel.querySelector<HTMLButtonElement>('#videoCall')!.onclick = () => void startCall('video');

    const last=messages.at(-1)?.id??'empty';
    if(lastRead.get(threadId)===last)return;
    const { error: readError } = await supabase.rpc('rb_dm_mark_thread_read', { p_thread_id: threadId });
    if (!currentThread(threadId)) return;
    if (!readError) {lastRead.set(threadId,last);
      const cached = threads.find((item) => item.id === threadId);
      if (cached) cached.unread_count = 0;
      drawThreads();
    }
  };

  const refreshThread = async (threadId: string) => {
    if (!currentThread(threadId)) return;
    if(loadingThread||sending||sharing){threadQueued=true;return;}
    loadingThread = true;const revision=threadRevision;
    try {
      const { data, error } = await supabase.rpc('rb_dm_thread_snapshot', { p_thread_id: threadId, p_limit: 350 });
      if (!currentThread(threadId)||revision!==threadRevision) return;
      if (error||!data||String((data as ThreadSnapshot).thread?.id??'')!==threadId) throw Error('Conversation could not be verified.');
      if(sending||sharing){threadQueued=true;return;}
      await drawThread(threadId, data as ThreadSnapshot);
    } catch (caught) {
      if(currentThread(threadId)){verifiedThread=null;panel.innerHTML='<div class="comm-empty" role="status">Conversation unavailable. Reopen the thread to retry.</div>';activeState.textContent='UNVERIFIED';setStatus('Conversation could not be verified.');}
    } finally { loadingThread = false;if(queuedOpen&&!opening){const next=queuedOpen;queuedOpen=null;void openThread(next);}else if(threadQueued&&activeThread){threadQueued=false;scheduleThread(activeThread);} }
  };

  const openThread = async (threadId: string) => {
    if (!isCurrent() || sending||sharing||!isUuid(threadId)) return;
    if(opening||loadingThread){queuedOpen=threadId;return;}
    opening=true;
    try{
    if (activeThread && activeThread !== threadId) {if(typingTimer)clearTimeout(typingTimer);typingThread=null;void setTyping(activeThread,false);}
    if (!isCurrent()) return;
    threadRevision++;verifiedThread=null;activeThread = threadId;
    panel.innerHTML='<div class="comm-empty" role="status">Verifying conversation…</div>';
    activeState.textContent = 'VERIFYING';
    drawThreads();
    params.set('thread', threadId);
    history.replaceState({}, '', `${ROUTES.messages}?${params.toString()}`);
    if (threadChannel) await supabase.removeChannel(threadChannel);
    if (!isCurrent()) return;
    threadChannel = supabase.channel(`rich-dm:${mountEpoch}:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` }, () => scheduleThread(threadId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_attachments' }, () => scheduleThread(threadId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_reactions' }, () => scheduleThread(threadId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_status', filter: `thread_id=eq.${threadId}` }, () => scheduleThread(threadId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_call_sessions', filter: `thread_id=eq.${threadId}` }, () => scheduleThread(threadId))
      .subscribe(state=>{if(state==='SUBSCRIBED')scheduleThread(threadId);});
    await refreshThread(threadId);
    }finally{opening=false;if(queuedOpen){const next=queuedOpen;queuedOpen=null;void openThread(next);}}
  };

  const loadThreads = async () => {
    if (!isCurrent()) return;
    if(loadingThreads){listQueued=true;return;}
    loadingThreads = true;
    try {
      const { data, error } = await supabase.rpc('rb_dm_threads_snapshot', { p_limit: 150 });
      if (!isCurrent()) return;
      if (error) throw error;
      threads = [...new Map((((data as any)?.threads ?? []) as Thread[]).map(t=>[t.id,t])).values()];
      drawThreads();
      if (activeThread && threads.some((thread) => thread.id === activeThread) && !threadChannel && !loadingThread) await openThread(activeThread);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Unable to load conversations.');
    } finally { loadingThreads = false;if(listQueued){listQueued=false;scheduleThreads();} }
  };

  const openDirectFor = async (profileId: string) => {
    if (!isCurrent()||directPending||sending||sharing) return;
    if (!isUuid(profileId) || profileId === user.id) { setStatus('Invalid message recipient.'); return; }
    directPending=true;
    try{const { data: threadId, error } = await supabase.rpc('rb_create_direct_thread', { p_other_user: profileId });
    if (!isCurrent()) return;
    if (error) { setStatus(error.message); return; }
    const id = String(threadId || '');
    if (!isUuid(id)) { setStatus('Unable to open conversation.'); return; }
    await openThread(id);
    await loadThreads();
    }catch{setStatus('Conversation creation not confirmed.');}finally{directPending=false;}
  };

  const openNewThread = () => {
    if (!isCurrent() || document.querySelector('.new-thread-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'new-thread-modal';
    modal.innerHTML = `<section class="comm-card new-thread-card"><header class="thread-title"><div><strong>${sharedPostPending ? 'Share Rich Feed post' : 'New Rich-DM'}</strong><p>${sharedPostPending ? 'Choose who receives this post.' : 'Search people by name or username.'}</p></div><button id="closeNew" class="comm-button">✕</button></header><input id="profileSearch" placeholder="Search Rich Bizness members" autocomplete="off"/><div id="profileResults" class="profile-results"></div></section>`;
    document.body.append(modal);
    const box = modal.querySelector<HTMLInputElement>('#profileSearch')!;
    const results = modal.querySelector<HTMLElement>('#profileResults')!;
    modal.querySelector<HTMLButtonElement>('#closeNew')!.onclick = () => modal.remove();
    let searchRevision=0;
    box.oninput = async () => {
      const revision=++searchRevision;
      const query = box.value.trim();
      if (query.length < 2) { results.innerHTML = ''; return; }
      const { data, error } = await supabase.rpc('rb_dm_search_profiles', { p_query: query, p_limit: 20 });
      if (!isCurrent() || !document.body.contains(modal)||revision!==searchRevision) return;
      if (error) { results.innerHTML = `<div class="comm-empty">${esc(error.message)}</div>`; return; }
      results.innerHTML = ((data ?? []) as Profile[]).map((profile) => `<article class="profile-result"><a href="/profile.html?id=${encodeURIComponent(profile.id)}"><img src="${esc(profile.avatar_url || '/brand/icons/profile-placeholder.svg')}" alt=""><div><strong>${esc(profile.display_name || profile.username || 'Rich Member')}</strong><p>@${esc(profile.username || 'member')} · ${esc(profile.online_status || 'offline')}</p></div></a><button class="comm-button primary" data-user="${profile.id}">${sharedPostPending ? 'SHARE' : 'MESSAGE'}</button></article>`).join('') || '<div class="comm-empty">No message-ready members found.</div>';
      results.querySelectorAll<HTMLButtonElement>('[data-user]').forEach((button) => button.onclick = async () => { modal.remove(); await openDirectFor(String(button.dataset.user || '')); });
    };
    box.focus();
  };

  search.oninput = drawThreads;
  root.querySelector<HTMLButtonElement>('#newThread')!.onclick = openNewThread;
  await loadThreads();
  if (!isCurrent()) return;
  if (requestedUser) await openDirectFor(requestedUser);
  else if (sharedPostPending) openNewThread();

  if (!isCurrent()) return;
  listChannel = supabase.channel(`rich-dm-list:${mountEpoch}:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members', filter: `user_id=eq.${user.id}` }, scheduleThreads)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, scheduleThreads)
    .subscribe();

  const reconnect=()=>{if(document.visibilityState==='visible'){scheduleThreads();if(activeThread)scheduleThread(activeThread);}};
  document.addEventListener('visibilitychange',reconnect);window.addEventListener('online',reconnect);
  const cleanup = async () => {
    if (destroyed) return;
    destroyed = true;drafts.clear();document.removeEventListener('visibilitychange',reconnect);window.removeEventListener('online',reconnect);if(threadRefreshTimer)clearTimeout(threadRefreshTimer);
    if (typingTimer) window.clearTimeout(typingTimer);
    if (refreshTimer) window.clearTimeout(refreshTimer);
    if (statusTimer) window.clearTimeout(statusTimer);
    if (activeThread&&getAuthSnapshot().user?.id===user.id) void supabase.rpc('rb_dm_set_typing', { p_thread_id: activeThread, p_is_typing: false });
    if (threadChannel) { await supabase.removeChannel(threadChannel); threadChannel = null; }
    if (listChannel) { await supabase.removeChannel(listChannel); listChannel = null; }
    document.querySelector('.new-thread-modal')?.remove();
    panel.querySelectorAll<HTMLMediaElement>('audio,video').forEach((media) => { media.pause(); media.removeAttribute('src'); media.load(); });
  };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide',()=>void cleanup(),{once:true});
}
