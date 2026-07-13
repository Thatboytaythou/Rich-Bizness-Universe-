import { supabase } from './supabase-client.js';

const status = document.querySelector('#contentStatus');
const say = (message, tone = 'ready') => {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
};

let user = null;
let profile = null;
let busy = false;
const viewed = new Set();
const sessionId = (() => {
  const key = 'rb_content_session';
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(key, value);
  }
  return value;
})();

async function identity() {
  const { data } = await supabase.auth.getUser();
  user = data?.user || null;
  if (!user) return;
  const result = await supabase.from('profiles').select('username,display_name').eq('id', user.id).maybeSingle();
  profile = result.data || null;
}

async function toggleLike(postId, button) {
  if (!user) return say('TAP IN TO LIKE DROPS', 'error');
  if (busy) return;
  busy = true;
  button.disabled = true;
  try {
    const existing = await supabase.from('feed_post_likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const removed = await supabase.from('feed_post_likes').delete().eq('id', existing.data.id);
      if (removed.error) throw removed.error;
      button.textContent = 'LIKE';
      say('LIKE REMOVED');
    } else {
      const added = await supabase.from('feed_post_likes').insert({ post_id: postId, user_id: user.id });
      if (added.error) throw added.error;
      button.textContent = 'LIKED';
      say('DROP LIKED');
    }
  } catch (error) {
    say(`LIKE FAILED • ${error.message}`, 'error');
  } finally {
    busy = false;
    button.disabled = false;
  }
}

async function addComment(postId) {
  if (!user) return say('TAP IN TO COMMENT', 'error');
  if (busy) return;
  const body = String(prompt('Add your Rich Bizness comment') || '').trim();
  if (!body) return;
  if (body.length > 500) return say('COMMENT LIMIT IS 500 CHARACTERS', 'error');
  busy = true;
  try {
    const result = await supabase.from('feed_comments').insert({
      post_id: postId,
      user_id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'member',
      display_name: profile?.display_name || user.user_metadata?.display_name || 'Rich Bizness Member',
      body
    });
    if (result.error) throw result.error;
    say('COMMENT POSTED');
  } catch (error) {
    say(`COMMENT FAILED • ${error.message}`, 'error');
  } finally {
    busy = false;
  }
}

async function registerView(postId) {
  if (!postId || viewed.has(postId)) return;
  viewed.add(postId);
  const row = { post_id: postId, user_id: user?.id || null, session_id: sessionId };
  const result = await supabase.from('feed_post_views').insert(row);
  if (result.error) viewed.delete(postId);
}

function observePosts() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
      const id = entry.target.dataset.id;
      registerView(id);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.6 });

  const scan = () => document.querySelectorAll('.post[data-id]').forEach((post) => {
    if (!post.dataset.viewObserved) {
      post.dataset.viewObserved = 'true';
      observer.observe(post);
    }
  });
  scan();
  const mutation = new MutationObserver(scan);
  const feed = document.querySelector('#contentFeed');
  if (feed) mutation.observe(feed, { childList: true });
  window.addEventListener('pagehide', () => { observer.disconnect(); mutation.disconnect(); }, { once: true });
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  const post = action?.closest('.post[data-id]');
  if (!action || !post?.dataset.id) return;
  if (action.dataset.action === 'like') toggleLike(post.dataset.id, action);
  if (action.dataset.action === 'comment') addComment(post.dataset.id);
});

async function boot() {
  if (!supabase) return;
  await identity();
  observePosts();
}

boot();