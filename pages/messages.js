import { getAuthoritativeIdentity, ensureProfile } from '../src/rb-identity.js?v=profile-avatar-separate-1';
import { listThreadIds, listThreads, listMessages, createMessage, markThreadRead, reactToMessage, setTyping, startCall, watchMessages } from '../features/messages/api.js';
import { installMessagesLayout, renderThreads, renderMessages, setDmStatus } from '../features/messages/ui.js';

let user = null;
let profile = null;
let threads = [];
let active = null;
let messages = [];
let typingTimer = null;

const $ = (selector) => document.querySelector(selector);

async function requireUser() {
  const state = await getAuthoritativeIdentity({ fresh: true });
  user = state.user;
  profile = state.profile || (user ? await ensureProfile(user) : null);
  if (!user) {
    location.href = '/auth.html?next=/messages.html';
    return false;
  }
  return true;
}

async function openThread(threadId) {
  active = threads.find((thread) => thread.id === threadId) || active;
  renderThreads({ threads, activeId: active?.id });
  if (!active) return;
  messages = await listMessages(active.id);
  renderMessages({ thread: active, messages, userId: user.id });
  const last = messages[messages.length - 1];
  if (last) await markThreadRead({ threadId: active.id, messageId: last.id, userId: user.id });
}

async function sendCurrentMessage() {
  const input = $('#dmBody');
  const body = input?.value?.trim();
  if (!active || !body) return;
  input.value = '';
  await setTyping({ threadId: active.id, userId: user.id, isTyping: false });
  const msg = await createMessage({ thread: active, user, profile, body });
  messages.push(msg);
  renderMessages({ thread: active, messages, userId: user.id });
  await markThreadRead({ threadId: active.id, messageId: msg.id, userId: user.id });
}

function wire() {
  document.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-thread-id]');
    if (card) openThread(card.dataset.threadId);
    if (event.target.closest('#dmReact')) {
      const last = messages[messages.length - 1];
      if (last) {
        await reactToMessage({ messageId: last.id, userId: user.id, emoji: active?.default_reaction || 'SMOKE' });
        setDmStatus('Reaction sent.');
      }
    }
    if (event.target.closest('#dmCall')) {
      const call = await startCall({ thread: active, user });
      if (call) setDmStatus('Rich Call started: ' + call.livekit_room_name);
    }
  });
  $('#dmForm')?.addEventListener('submit', async (event) => { event.preventDefault(); await sendCurrentMessage(); });
  $('#dmBody')?.addEventListener('input', () => {
    if (!active || !user) return;
    setTyping({ threadId: active.id, userId: user.id, isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping({ threadId: active.id, userId: user.id, isTyping: false }), 1200);
  });
}

async function load() {
  if (!await requireUser()) return;
  const ids = await listThreadIds(user.id);
  if ($('#memberCount')) $('#memberCount').textContent = ids.length.toLocaleString();
  threads = await listThreads(ids);
  if (!active && threads[0]) active = threads[0];
  renderThreads({ threads, activeId: active?.id });
  if (active) await openThread(active.id);
}

installMessagesLayout($('#messagesMount'));
wire();
load();
watchMessages({
  onThreads: load,
  onMessages: () => active ? openThread(active.id) : load(),
  onTyping: (payload) => {
    if (payload.new?.thread_id === active?.id && payload.new?.user_id !== user?.id) setDmStatus(payload.new?.is_typing ? 'They typing...' : 'Rich-DM ready.');
  }
});
