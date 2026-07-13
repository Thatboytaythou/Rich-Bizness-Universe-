import { supabase } from './supabase-client.js';
import './content-social.js';
import { bindRetry, focusRequestedCard, setRegionState, watchConnection } from './ui-state.js';

const feed = document.querySelector('#contentFeed');
const status = document.querySelector('#contentStatus');
let currentUser = null;
let currentProfile = null;
let focused = false;
let stopRetry = null;
let stopConnection = null;
let observer = null;

function say(message, tone = 'ready') {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function retry() {
  const active = document.querySelector('[data-filter][aria-pressed="true"]');
  active?.click();
}

function ensureDialog() {
  let dialog = document.querySelector('#rbCommentDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'rbCommentDialog';
  dialog.className = 'rb-comment-dialog';
  dialog.innerHTML = `<form method="dialog"><header><div><span>RICH RESPONSE</span><strong>ADD A COMMENT</strong></div><button value="cancel" aria-label="Close comment form">×</button></header><textarea id="rbCommentBody" maxlength="500" placeholder="Say something real..." required></textarea><footer><small id="rbCommentCount">0 / 500</small><button type="submit" value="post">POST COMMENT</button></footer></form>`;
  document.body.append(dialog);
  const body = dialog.querySelector('#rbCommentBody');
  body.addEventListener('input', () => { dialog.querySelector('#rbCommentCount').textContent = `${body.value.length} / 500`; });
  return dialog;
}

async function openComment(postId) {
  if (!currentUser) {
    say('TAP IN TO COMMENT', 'error');
    location.href = `/auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  const dialog = ensureDialog();
  const body = dialog.querySelector('#rbCommentBody');
  body.value = '';
  dialog.querySelector('#rbCommentCount').textContent = '0 / 500';
  dialog.showModal();
  body.focus();
  const result = await new Promise((resolve) => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (result !== 'post') return;
  const text = body.value.trim();
  if (!text) return;
  say('POSTING COMMENT');
  const { error } = await supabase.from('feed_comments').insert({
    post_id: postId,
    user_id: currentUser.id,
    username: currentProfile?.username || currentUser.email?.split('@')[0] || 'member',
    display_name: currentProfile?.display_name || currentUser.user_metadata?.display_name || 'Rich Bizness Member',
    body: text
  });
  if (error) say(`COMMENT FAILED • ${error.message}`, 'error');
  else say('COMMENT POSTED');
}

async function resolveIdentity() {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user || null;
  if (!currentUser) return;
  const result = await supabase.from('profiles').select('username,display_name').eq('id', currentUser.id).maybeSingle();
  currentProfile = result.data || null;
}

function watchFeed() {
  if (!feed) return;
  observer = new MutationObserver(() => {
    const state = feed.querySelector('.empty');
    if (state && /loading/i.test(state.textContent || '')) {
      setRegionState(feed, { title: 'SYNCING DROPS', message: 'Pulling the newest Rich Bizness content.', tone: 'loading' });
    }
    if (!focused && feed.querySelector('.post')) focused = focusRequestedCard(feed);
  });
  observer.observe(feed, { childList: true });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="comment"]');
  const card = button?.closest('.post[data-id]');
  if (!button || !card?.dataset.id) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openComment(card.dataset.id);
}, true);

async function boot() {
  await resolveIdentity();
  stopRetry = bindRetry(retry);
  stopConnection = watchConnection((online) => {
    document.body.dataset.network = online ? 'online' : 'offline';
    if (!online && feed) setRegionState(feed, { title: 'YOU ARE OFFLINE', message: 'Reconnect to load realtime drops.', action: 'TRY AGAIN', tone: 'error' });
    if (online) retry();
  });
  watchFeed();
  if (feed?.querySelector('.post')) focused = focusRequestedCard(feed);
}

window.addEventListener('pagehide', () => {
  stopRetry?.();
  stopConnection?.();
  observer?.disconnect();
}, { once: true });

boot();
