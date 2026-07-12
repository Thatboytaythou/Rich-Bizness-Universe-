import { supabase } from './supabase-client.js';
import { awardXp } from './rb-xp.js?v=identity-owner-3';
import { getAuthoritativeIdentity } from './rb-identity.js?v=identity-owner-2';

const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

let user = null;
let profile = null;
let identityFlight = null;
let feedFlight = null;
let feedTimer = null;
let channel = null;
let submitting = false;

function say(text) {
  const el = $('#dropStatus');
  if (el) el.textContent = text;
}

function identityRow() {
  return {
    user_id: user.id,
    username: profile?.username || user.email?.split('@')[0] || 'rich_user',
    display_name: profile?.display_name || user.email?.split('@')[0] || 'Rich Bizness',
  };
}

function metadata(extra = {}) {
  return {
    username: profile?.username || '',
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
    route: 'feed',
    ...extra,
  };
}

async function ensureIdentity() {
  if (user) return { user, profile };
  if (identityFlight) return identityFlight;
  identityFlight = getAuthoritativeIdentity()
    .then((state) => {
      user = state.user || null;
      profile = state.profile || null;
      return { user, profile };
    })
    .finally(() => { identityFlight = null; });
  return identityFlight;
}

function mount() {
  if ($('#dropFeedShell')) return;
  const target = $('#sectionCards') || $('.cards');
  if (!target) return;
  target.innerHTML = `<div id="dropFeedShell" class="drop-feed-shell"><form class="df-form" id="feedForm"><input id="feedTitle" placeholder="Title"><textarea id="feedBody" placeholder="Say it Rich..."></textarea><input id="feedMedia" placeholder="Optional media URL"><div class="df-actions"><button class="primary" type="submit">DROP POST</button><a href="/upload.html?section=feed">UPLOAD FILE</a></div><small class="df-status" id="dropStatus">Feed ready.</small></form><div class="df-feed-list" id="dfFeedList"></div></div>`;
  $('#feedForm')?.addEventListener('submit', submitFeed);
}

async function insert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function submitFeed(event) {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    await ensureIdentity();
    if (!user) {
      location.href = '/auth.html?next=' + encodeURIComponent('/feed.html');
      return;
    }
    const title = $('#feedTitle')?.value?.trim() || 'Rich Bizness Post';
    const body = $('#feedBody')?.value?.trim() || '';
    const media = $('#feedMedia')?.value?.trim() || '';
    const post = await insert('feed_posts', {
      ...identityRow(),
      title,
      body,
      media_url: media || null,
      section: 'feed',
      post_type: media ? 'media' : 'text',
      visibility: 'public',
      metadata: metadata({ source: 'feed-composer' }),
    });
    await awardXp('feed_post_create', { section:'feed', sourceTable:'feed_posts', sourceId:post.id }).catch(() => {});
    event.target.reset();
    say('Posted.');
    await loadFeed(true);
  } catch (error) {
    say(error.message || String(error));
  } finally {
    submitting = false;
    if (button) button.disabled = false;
  }
}

function profileUrl(row) {
  if (row.user_id) return `/profile.html?id=${encodeURIComponent(row.user_id)}`;
  if (row.username) return `/profile.html?u=${encodeURIComponent(row.username)}`;
  return '/profile.html';
}

function postCard(post) {
  const author = esc(post.display_name || post.username || 'Rich Bizness');
  const handle = esc(post.username ? `@${post.username}` : 'profile');
  const media = post.media_url ? `<div class="df-post-media"><img src="${esc(post.media_url)}" alt="" loading="lazy" decoding="async"></div>` : '';
  return `<article class="df-post"><a class="df-author" href="${profileUrl(post)}"><span>${author.slice(0,2).toUpperCase()}</span><b>${author}</b><small>${handle}</small></a><h3>${esc(post.title || 'Rich Bizness Post')}</h3><p>${esc(post.body || '')}</p>${media}</article>`;
}

async function loadFeed(force = false) {
  if (feedFlight && !force) return feedFlight;
  feedFlight = supabase
    .from('feed_posts')
    .select('*')
    .order('created_at', { ascending:false })
    .limit(24)
    .then(({ data, error }) => {
      if (error) throw error;
      const rows = data || [];
      if ($('#recordCount')) $('#recordCount').textContent = String(rows.length);
      const list = $('#dfFeedList');
      if (list) list.innerHTML = rows.length ? rows.map(postCard).join('') : '<div class="df-status">No feed posts yet.</div>';
    })
    .catch((error) => say(error.message || String(error)))
    .finally(() => { feedFlight = null; });
  return feedFlight;
}

function scheduleFeed() {
  clearTimeout(feedTimer);
  feedTimer = setTimeout(() => loadFeed(true), 180);
}

async function boot() {
  mount();
  await loadFeed();
  channel = supabase.channel('feed-owner')
    .on('postgres_changes', { event:'*', schema:'public', table:'feed_posts' }, scheduleFeed)
    .subscribe();
}

function cleanup() {
  clearTimeout(feedTimer);
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

window.addEventListener('pagehide', cleanup, { once:true });
boot().catch((error) => say(error.message || String(error)));