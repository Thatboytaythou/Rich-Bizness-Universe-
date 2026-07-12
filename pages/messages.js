import { getAuthoritativeIdentity, ensureProfile } from '../src/rb-identity.js?v=identity-owner-2';
import { listThreadIds, listThreads, listProfiles, createDirectThread, listMessages, createMessage, markThreadRead, reactToMessage, setTyping, startCall, listActiveCalls } from '../features/messages/api.js';
import { addDmAttachment, uploadDmAttachment } from '../features/messages/attachments.js';
import { installMessagesLayout, renderThreads, renderProfiles, renderMessages, renderCallParticipants, openAttachmentViewer, setComposerEnabled, setConversationView, setDmStatus } from '../features/messages/ui.js';

const $ = (selector) => document.querySelector(selector);

let user = null;
let profile = null;
let threads = [];
let active = null;
let messages = [];
let profiles = [];
let typingTimer = null;
let searchTimer = null;
let refreshTimer = null;
let threadChannel = null;
let activeChannel = null;
let loading = false;

async function requireUser() {
  const state = await getAuthoritativeIdentity({ fresh: true });
  user = state.user || null;
  profile = state.profile || (user ? await ensureProfile(user) : null);
  if (!user) {
    location.href = '/auth.html?next=/messages.html';
    return false;
  }
  return true;
}

async function refreshCalls() {
  renderCallParticipants(active ? await listActiveCalls(active.id) : []);
}

function scheduleLoad() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => load(active?.id).catch((error) => setDmStatus(error.message || 'Messages failed')), 140);
}

function scheduleActive() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => active ? openThread(active.id).catch((error) => setDmStatus(error.message || 'Conversation failed')) : scheduleLoad(), 120);
}

async function replaceActiveChannel() {
  if (activeChannel) {
    await supabase.removeChannel(activeChannel).catch(() => {});
    activeChannel = null;
  }
  if (!active?.id) return;

  const filter = `thread_id=eq.${active.id}`;
  activeChannel = supabase.channel(`rich-dm-thread:${active.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter }, scheduleActive)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_status', filter }, (payload) => {
      if (payload.new?.user_id !== user?.id) setDmStatus(payload.new?.is_typing ? 'Typing…' : 'Rich-DM ready');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_call_sessions', filter }, refreshCalls)
    .subscribe();
}

async function openThread(threadId) {
  active = threads.find((thread) => thread.id === threadId) || active;
  renderThreads({ threads, activeId: active?.id });
  setComposerEnabled(Boolean(active));
  setConversationView(Boolean(active));
  if (!active) return;

  messages = await listMessages(active.id);
  renderMessages({ thread: active, messages, userId: user.id });
  const last = messages[messages.length - 1];
  if (last && last.sender_id !== user.id) await markThreadRead({ threadId: active.id, messageId: last.id, userId: user.id });
  await refreshCalls();
  await replaceActiveChannel();
}

async function loadProfiles(search = '') {
  profiles = await listProfiles({ userId: user.id, search });
  renderProfiles(profiles);
}

async function openNewConversation() {
  await loadProfiles('');
  $('#dmNewDialog')?.showModal();
  $('#dmProfileSearch')?.focus();
}

async function createConversation(profileId) {
  const target = profiles.find((item) => item.id === profileId);
  if (!target) return;
  setDmStatus('Creating conversation…');
  const thread = await createDirectThread({ userId: user.id, profile: target });
  $('#dmNewDialog')?.close();
  await load(thread.id);
  setDmStatus('Rich-DM ready');
}

async function sendCurrentMessage() {
  const input = $('#dmBody');
  const urlInput = $('#dmAttachment');
  const fileInput = $('#dmAttachmentFile');
  const body = input?.value?.trim();
  const url = urlInput?.value?.trim();
  const file = fileInput?.files?.[0];
  if (!active || (!body && !url && !file)) return;

  setDmStatus(file ? 'Uploading attachment…' : 'Sending…');
  const uploaded = file ? await uploadDmAttachment({ threadId: active.id, userId: user.id, file }) : null;
  const messageType = uploaded?.file_type || 'text';
  const message = await createMessage({
    thread: active,
    user,
    profile,
    body: body || uploaded?.file_name || 'Attachment',
    messageType: uploaded || url ? messageType : 'text',
    mediaUrl: uploaded?.file_url || url || null,
    mediaType: uploaded?.mime_type || null,
  });

  const attachment = uploaded || url ? await addDmAttachment({ messageId: message.id, userId: user.id, attachment: uploaded, url }) : null;
  if (attachment) message.attachments = [attachment];
  if (input) input.value = '';
  if (urlInput) urlInput.value = '';
  if (fileInput) fileInput.value = '';
  await setTyping({ threadId: active.id, userId: user.id, isTyping: false });
  messages.push(message);
  renderMessages({ thread: active, messages, userId: user.id });
  setDmStatus('Rich-DM ready');
}

function wire() {
  document.addEventListener('click', async (event) => {
    const thread = event.target.closest('[data-thread-id]');
    if (thread) await openThread(thread.dataset.threadId);

    const profileButton = event.target.closest('[data-profile-id]');
    if (profileButton) await createConversation(profileButton.dataset.profileId);

    if (event.target.closest('#dmNew')) await openNewConversation();
    if (event.target.closest('#dmBack')) {
      active = null;
      await replaceActiveChannel();
      setConversationView(false);
      setComposerEnabled(false);
      renderThreads({ threads, activeId: null });
      renderMessages({ thread: null, messages: [], userId: user?.id });
    }
    if (event.target.closest('[data-close-new]')) $('#dmNewDialog')?.close();

    const react = event.target.closest('[data-react]');
    if (react) {
      const message = react.closest('[data-message-id]');
      if (message) {
        await reactToMessage({ messageId: message.dataset.messageId, userId: user.id, emoji: react.dataset.react });
        await openThread(active.id);
      }
    }

    const attachment = event.target.closest('[data-view-attachment]');
    if (attachment) openAttachmentViewer({ url: attachment.dataset.url, type: attachment.dataset.type, name: attachment.dataset.name });
    if (event.target.closest('[data-close-viewer]')) $('#dmAttachmentViewer')?.close();

    if (event.target.closest('#dmCall') && active) {
      const call = await startCall({ thread: active, user });
      if (call) {
        setDmStatus('Rich Call started');
        await refreshCalls();
      }
    }
  });

  $('#dmForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await sendCurrentMessage(); }
    catch (error) { setDmStatus(error.message || 'Message failed'); }
  });

  $('#dmBody')?.addEventListener('input', () => {
    if (!active || !user) return;
    setTyping({ threadId: active.id, userId: user.id, isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping({ threadId: active.id, userId: user.id, isTyping: false }), 1200);
  });

  $('#dmProfileSearch')?.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProfiles(event.target.value).catch(() => {}), 250);
  });
}

async function load(preferredId = null) {
  if (loading) return;
  loading = true;
  try {
    if (!user && !await requireUser()) return;
    const ids = await listThreadIds(user.id);
    if ($('#memberCount')) $('#memberCount').textContent = ids.length.toLocaleString();
    threads = await listThreads(ids);
    if (preferredId) active = threads.find((thread) => thread.id === preferredId) || active;
    if (active && !threads.some((thread) => thread.id === active.id)) active = null;
    renderThreads({ threads, activeId: active?.id });
    setComposerEnabled(Boolean(active));
    setConversationView(Boolean(active));
    if (active) await openThread(active.id);
    else {
      messages = [];
      renderMessages({ thread: null, messages: [], userId: user.id });
    }
  } finally {
    loading = false;
  }
}

async function boot() {
  if (!await requireUser()) return;
  installMessagesLayout($('#messagesMount'));
  wire();
  await load();
  threadChannel = supabase.channel(`rich-dm-members:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members', filter: `user_id=eq.${user.id}` }, scheduleLoad)
    .subscribe();
}

async function cleanup() {
  clearTimeout(typingTimer);
  clearTimeout(searchTimer);
  clearTimeout(refreshTimer);
  if (active?.id && user?.id) await setTyping({ threadId: active.id, userId: user.id, isTyping: false }).catch(() => {});
  if (activeChannel) await supabase.removeChannel(activeChannel).catch(() => {});
  if (threadChannel) await supabase.removeChannel(threadChannel).catch(() => {});
  activeChannel = null;
  threadChannel = null;
}

window.addEventListener('pagehide', cleanup, { once: true });
boot().catch((error) => setDmStatus(error.message || 'Messages failed'));
