import { getAuthoritativeIdentity, ensureProfile } from '../src/rb-identity.js?v=profile-avatar-separate-1';
import { listThreadIds, listThreads, listMessages, createMessage, watchMessages } from '../features/messages/api.js';
import { installMessagesLayout, renderThreads, renderMessages } from '../features/messages/ui.js';

let user = null;
let profile = null;
let threads = [];
let active = null;
let messages = [];

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
}

function wire() {
  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-thread-id]');
    if (card) openThread(card.dataset.threadId);
  });
  $('#dmForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#dmBody');
    const body = input?.value?.trim();
    if (!active || !body) return;
    input.value = '';
    const msg = await createMessage({ thread: active, user, profile, body });
    messages.push(msg);
    renderMessages({ thread: active, messages, userId: user.id });
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
});
