import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity, getProfile, getMetaAvatar } from './rb-identity.js?v=identity-owner-2';
import { bootXp, loadXp } from './rb-xp.js?v=realtime-1';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString();
const money = (n) => '$' + (Number(n || 0) / 100).toFixed(2);
const safe = (v, fallback = '') => String(v ?? fallback);
const set = (s, v) => { const el = $(s); if (el) el.textContent = v; };
const params = new URLSearchParams(location.search);
const requestedId = params.get('id') || params.get('user_id') || '';
const requestedUsername = params.get('u') || params.get('user') || params.get('username') || '';

let ownerUser = null;
let viewedProfile = null;
let isOwner = false;
let paintFlight = null;
let refreshTimer = null;
let profileChannel = null;
let loggedViewId = '';

function say(text) { set('#profileStatus', text); }
function calmProfileArtifacts() {
  document.querySelectorAll('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep])').forEach((el) => {
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden', 'true');
  });
  document.body?.removeAttribute('data-rich-money');
}
function miniCard(row, type = 'post') {
  const img = row.media_url || row.public_url || row.thumbnail_url || row.cover_url || row.file_url || '';
  return `<article class="card">${img ? `<img src="${img}" alt="">` : ''}<b>${safe(row.title, type === 'post' ? 'Rich Bizness Post' : 'Upload')}</b><p>${safe(row.body || row.description, 'Profile-owned content.')}</p><small>${safe(row.section || row.category || type, type)}</small></article>`;
}

async function getProfileTarget() {
  if (requestedId) return getProfile(requestedId);
  if (requestedUsername) {
    const clean = requestedUsername.replace(/^@/, '').trim();
    const { data, error } = await supabase.from('profiles').select('*').eq('username', clean).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  return getProfile(ownerUser.id);
}

async function loadCounts(userId) {
  const [posts, uploads, followers] = await Promise.all([
    supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('followers').select('id', { count: 'exact', head: true }).eq('following_id', userId)
  ]);
  set('#postsCount', fmt(posts.count));
  set('#uploadsCount', fmt(uploads.count));
  set('#followersCount', fmt(followers.count));
}

async function loadOwnedContent(userId) {
  const [posts, uploads] = await Promise.all([
    supabase.from('feed_posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
    supabase.from('uploads').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(8)
  ]);
  const postBox = $('#profilePosts');
  const uploadBox = $('#profileUploads');
  if (postBox) postBox.innerHTML = posts.error ? `<div class="empty">${posts.error.message}</div>` : (posts.data || []).length ? posts.data.map((r) => miniCard(r, 'post')).join('') : '<div class="empty">No posts yet.</div>';
  if (uploadBox) uploadBox.innerHTML = uploads.error ? `<div class="empty">${uploads.error.message}</div>` : (uploads.data || []).length ? uploads.data.map((r) => miniCard(r, 'upload')).join('') : '<div class="empty">No uploads yet.</div>';
}

async function loadAccess(profile) {
  const [creator, secret] = await Promise.all([
    supabase.from('creator_available_balances').select('available_cents').eq('artist_user_id', profile.id).maybeSingle(),
    supabase.from('rb_secret_rooms').select('id', { count: 'exact', head: true }).eq('is_active', true)
  ]);
  const creatorText = profile.is_creator || profile.is_artist || profile.is_seller || creator.data ? money(creator.data?.available_cents || 0) : 'Creator locked';
  const secretText = profile.vault_unlocked ? `${profile.rb_secret_rank || 'VAULT'} • ${secret.count || 0} rooms` : `${Math.max(0, 500 - Number(profile.rich_points || 0))} XP to unlock`;
  set('#creatorAccess', isOwner ? creatorText : (profile.is_creator || profile.is_artist || profile.is_seller ? 'Creator profile' : 'Public profile'));
  set('#secretAccess', isOwner ? secretText : (profile.vault_unlocked ? profile.rb_secret_rank || 'VAULT' : 'Public view'));
}

function ensureSystemsPanel() {
  let panel = $('#profileSystems');
  if (!panel) {
    document.querySelector('.profile-money-grid')?.insertAdjacentHTML('afterend', '<section id="profileSystems" class="profile-money-grid"></section>');
    panel = $('#profileSystems');
  }
  return panel;
}

async function loadSystems(profile) {
  const base = [
    supabase.from('user_badges').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('profile_theme_settings').select('*').eq('user_id', profile.id).maybeSingle(),
    supabase.from('route_access_rules').select('required_role').eq('is_active', true).limit(60)
  ];
  if (isOwner) base.push(
    supabase.from('user_sessions').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_active', true),
    supabase.from('trust_events').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('platform_analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
  );
  const [badges, themeResult, accessResult, sessions, trust, analytics] = await Promise.all(base);
  const role = String(profile.role || 'user').toLowerCase();
  const accessRows = (accessResult.data || []).filter((row) => !row.required_role || row.required_role === role || role === 'founder' || role === 'admin');
  const panel = ensureSystemsPanel();
  if (panel) panel.innerHTML = `
    <article class="identity-stat"><b>${fmt(badges.count)}</b><small>Badges</small></article>
    <article class="identity-stat"><b>${safe(themeResult.data?.profile_layout || themeResult.data?.background_style, 'Default')}</b><small>Theme</small></article>
    <article class="identity-stat"><b>${fmt(accessRows.length)}</b><small>Access</small></article>
    <article class="identity-stat"><b>${isOwner ? fmt(sessions?.count) : 'PRIVATE'}</b><small>Sessions</small></article>
    <article class="identity-stat"><b>${isOwner ? fmt(trust?.count) : 'PRIVATE'}</b><small>Trust</small></article>
    <article class="identity-stat"><b>${isOwner ? fmt(analytics?.count) : 'PRIVATE'}</b><small>Analytics</small></article>`;
  if (themeResult.data?.background_url) $('#profileHero').style.backgroundImage = `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.72)),url(${themeResult.data.background_url})`;
}

function tuneOwnerControls() {
  document.querySelectorAll('a[href="/edit.html"],a[href="/settings.html"]').forEach((el) => {
    if (!isOwner) {
      el.textContent = el.getAttribute('href') === '/edit.html' ? 'FOLLOW' : 'MESSAGE';
      el.href = el.textContent === 'FOLLOW' ? '#' : `/messages.html?user=${encodeURIComponent(viewedProfile?.id || '')}`;
      el.dataset.profileAction = el.textContent.toLowerCase();
    }
  });
  const creatorBtn = document.querySelector('a[href="/creator.html"]');
  if (creatorBtn && !isOwner) { creatorBtn.textContent = 'View Feed'; creatorBtn.href = `/feed.html?user=${encodeURIComponent(viewedProfile?.id || '')}`; }
}

function render(profile, meta) {
  viewedProfile = profile;
  isOwner = Boolean(ownerUser?.id && ownerUser.id === profile.id);
  const cfg = meta?.metadata || {};
  const level = Number(profile.rich_level || meta?.level || 1);
  const points = Number(profile.rich_points || meta?.xp || 0);
  set('#displayName', safe(profile.display_name, 'Rich Bizness User').toUpperCase());
  set('#username', '@' + safe(profile.username, 'rich_user'));
  set('#bio', safe(profile.bio, 'Building a Rich Bizness lane across the universe.'));
  set('#rank', safe(profile.rank_title, 'BIZ LEGEND'));
  set('#level', level);
  set('#xp', fmt(points));
  set('#balance', isOwner ? money(profile.balance_cents) : 'PUBLIC');
  if ($('#xpFill')) $('#xpFill').style.width = Math.max(0, Math.min(100, (points % 1000) / 10)) + '%';
  if ($('#profileCard')) $('#profileCard').style.backgroundImage = profile.banner_url ? `url(${profile.banner_url})` : '';
  const avatar = $('#avatarFace');
  if (avatar) {
    avatar.classList.add('live-avatar');
    avatar.dataset.aura = meta?.aura || cfg.aura || 'Emerald Gold';
    avatar.dataset.motion = cfg.motion || 'Boss Idle';
    if (profile.avatar_url) { avatar.textContent = ''; avatar.style.backgroundImage = `url(${profile.avatar_url})`; }
    else { avatar.textContent = safe(profile.display_name || profile.username || 'RB').split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'RB'; avatar.style.backgroundImage = ''; }
  }
  tuneOwnerControls();
}

async function logProfileView(profile) {
  if (loggedViewId === profile.id) return;
  loggedViewId = profile.id;
  const sessionId = sessionStorage.getItem('rb_session_id') || crypto.randomUUID();
  sessionStorage.setItem('rb_session_id', sessionId);
  await supabase.from('platform_analytics_events').insert({ user_id: ownerUser?.id || null, session_id: sessionId, event_name: 'profile_view', section: 'profile', target_table: 'profiles', target_id: profile.id, device_type: innerWidth < 768 ? 'mobile' : 'desktop', platform: navigator.platform || 'web', route: location.pathname + location.search, metadata: { owner_view: isOwner } }).then(() => {}, () => {});
}

async function paint() {
  if (paintFlight) return paintFlight;
  paintFlight = (async () => {
    calmProfileArtifacts();
    const profile = await getProfileTarget();
    if (!profile) { say('Profile not found.'); return; }
    const meta = await getMetaAvatar(profile.id).catch(() => null);
    render(profile, meta);
    await Promise.all([loadCounts(profile.id), loadOwnedContent(profile.id), loadAccess(profile), loadSystems(profile)]);
    if (isOwner) try { await loadXp(profile.id); } catch (_) {}
    logProfileView(profile);
    say(isOwner ? 'Profile empire connected.' : 'Viewing public profile.');
  })();
  try { return await paintFlight; } finally { paintFlight = null; }
}

function schedulePaint() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => paint().catch((error) => say(error.message || String(error))), 250);
}

async function boot() {
  try {
    calmProfileArtifacts();
    const state = await getAuthoritativeIdentity();
    ownerUser = state.user;
    if (!ownerUser) { location.replace('/auth.html?next=' + encodeURIComponent(location.pathname + location.search)); return; }
    try { await bootXp(); } catch (_) {}
    await paint();
    const targetId = viewedProfile?.id || ownerUser.id;
    if (profileChannel) await supabase.removeChannel(profileChannel);
    profileChannel = supabase.channel('profile-owner-' + targetId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + targetId }, schedulePaint)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_avatars', filter: 'user_id=eq.' + targetId }, schedulePaint)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts', filter: 'user_id=eq.' + targetId }, schedulePaint)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads', filter: 'user_id=eq.' + targetId }, schedulePaint)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_levels', filter: 'user_id=eq.' + targetId }, schedulePaint)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges', filter: 'user_id=eq.' + targetId }, schedulePaint)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_theme_settings', filter: 'user_id=eq.' + targetId }, schedulePaint)
      .subscribe();
  } catch (error) {
    console.warn(error);
    say(error.message || String(error));
  }
}

addEventListener('pagehide', () => { if (profileChannel) supabase.removeChannel(profileChannel); });
boot();
