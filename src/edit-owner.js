import { supabase } from './supabase-client.js';
import { ensureProfile, getAuthoritativeIdentity, slugName } from './rb-identity.js?v=identity-owner-2';

const $ = (selector) => document.querySelector(selector);
const fields = ['display_name','username','bio','avatar_url','banner_url','website_url','instagram_url','youtube_url','tiktok_url','facebook_url','snapchat_url','favorite_section','role'];
const allowedRoles = new Set(['user','member','creator','artist','seller']);
const allowedSections = new Set(['feed','live','watch','music','podcast','radio','store','gaming','sports','gallery','meta','profile']);
const maxImageBytes = 12 * 1024 * 1024;

let user = null;
let profile = null;
let saving = false;
let dirty = false;
let uploadFlight = null;

const money = (value) => '$' + (Number(value || 0) / 100).toFixed(2);
const setStatus = (text) => { const el = $('#editStatus'); if (el) el.textContent = text; };
const initials = (value = 'RB') => String(value || 'RB').split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'RB';

function normalizeUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Links must use http or https.');
  return url.toString();
}

function formValue(id) {
  const el = $('#' + id);
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

function paint() {
  const name = formValue('display_name') || 'Rich Bizness User';
  const bio = formValue('bio') || 'Building a Rich Bizness lane across the universe.';
  const avatarUrl = formValue('avatar_url');
  const bannerUrl = formValue('banner_url');

  $('#editPreviewName').textContent = name;
  $('#editPreviewBio').textContent = bio;
  $('#editPreview').style.backgroundImage = bannerUrl ? `url("${bannerUrl.replaceAll('"', '%22')}")` : '';

  const avatar = $('#editAvatarPreview');
  if (avatarUrl) {
    avatar.textContent = '';
    avatar.style.backgroundImage = `url("${avatarUrl.replaceAll('"', '%22')}")`;
  } else {
    avatar.textContent = initials(name);
    avatar.style.backgroundImage = '';
  }
}

function markDirty() {
  dirty = true;
  paint();
  setStatus('Unsaved profile changes.');
}

async function uploadImage(file, bucket, kind) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error(`${kind} must be an image.`);
  if (file.size > maxImageBytes) throw new Error(`${kind} must be 12 MB or smaller.`);
  if (uploadFlight) return uploadFlight;

  uploadFlight = (async () => {
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${user.id}/${kind.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  })();

  try { return await uploadFlight; }
  finally { uploadFlight = null; }
}

async function loadCounts() {
  const [posts, uploads, followers] = await Promise.all([
    supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('followers').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
  ]);
  $('#editPosts').textContent = Number(posts.count || 0).toLocaleString();
  $('#editUploads').textContent = Number(uploads.count || 0).toLocaleString();
  $('#editFollowers').textContent = Number(followers.count || 0).toLocaleString();
}

async function usernameAvailable(username) {
  const { data, error } = await supabase.from('profiles').select('id').eq('username', username).neq('id', user.id).limit(1);
  if (error) throw error;
  return !data?.length;
}

function collectRow() {
  const row = Object.fromEntries(fields.map((id) => [id, formValue(id)]));
  row.display_name = row.display_name.slice(0, 80);
  row.username = slugName(row.username || row.display_name).slice(0, 32);
  row.bio = row.bio.slice(0, 500);
  row.role = allowedRoles.has(row.role) ? row.role : 'member';
  row.favorite_section = allowedSections.has(row.favorite_section) ? row.favorite_section : 'feed';

  for (const id of ['website_url','instagram_url','youtube_url','tiktok_url','facebook_url','snapchat_url']) row[id] = normalizeUrl(row[id]);
  for (const id of ['avatar_url','banner_url']) row[id] = row[id] ? normalizeUrl(row[id]) : '';

  row.is_creator = row.role === 'creator';
  row.is_artist = row.role === 'artist';
  row.is_seller = row.role === 'seller';
  row.has_avatar = Boolean(row.avatar_url);
  row.has_profile_identity = true;
  row.onboarding_state = 'complete';
  row.updated_at = new Date().toISOString();
  return row;
}

async function saveProfile(event) {
  event.preventDefault();
  if (saving) return;
  saving = true;
  const submit = event.submitter;
  if (submit) submit.disabled = true;

  try {
    setStatus('Saving profile empire...');
    const row = collectRow();
    if (!row.display_name) throw new Error('Display name is required.');
    if (!row.username || !/^[a-z0-9_]{3,32}$/.test(row.username)) throw new Error('Username must be 3–32 letters, numbers, or underscores.');
    if (!(await usernameAvailable(row.username))) throw new Error('That username is already taken.');

    const { data, error } = await supabase.from('profiles').update(row).eq('id', user.id).select('*').single();
    if (error) throw error;
    profile = data;
    dirty = false;
    setStatus('Profile empire saved.');
    setTimeout(() => location.assign('/profile.html'), 350);
  } catch (error) {
    setStatus(error.message || String(error));
  } finally {
    saving = false;
    if (submit) submit.disabled = false;
  }
}

async function boot() {
  try {
    const state = await getAuthoritativeIdentity();
    user = state.user;
    if (!user) {
      location.replace('/auth.html?next=' + encodeURIComponent('/edit.html'));
      return;
    }

    profile = await ensureProfile(user);
    fields.forEach((id) => {
      const el = $('#' + id);
      if (el) el.value = profile?.[id] || '';
    });
    if (!formValue('username')) $('#username').value = slugName(profile?.display_name || user.email || 'rich_user');
    if (!formValue('role')) $('#role').value = 'member';
    if (!formValue('favorite_section')) $('#favorite_section').value = 'feed';

    $('#editXp').textContent = Number(profile?.rich_points || 0).toLocaleString();
    $('#editMoney').textContent = money(profile?.balance_cents);
    $('#editRank').textContent = profile?.rank_title || 'BIZ LEGEND';

    paint();
    await loadCounts();
    dirty = false;
    setStatus('Profile editor ready.');
  } catch (error) {
    setStatus(error.message || String(error));
  }
}

fields.forEach((id) => $('#' + id)?.addEventListener('input', markDirty));

$('#avatarFile')?.addEventListener('change', async (event) => {
  try {
    setStatus('Uploading profile photo...');
    $('#avatar_url').value = await uploadImage(event.target.files?.[0], 'avatars', 'Profile Photo');
    markDirty();
  } catch (error) { setStatus(error.message || String(error)); }
});

$('#bannerFile')?.addEventListener('change', async (event) => {
  try {
    setStatus('Uploading hero banner...');
    $('#banner_url').value = await uploadImage(event.target.files?.[0], 'profile-banners', 'Hero Banner');
    markDirty();
  } catch (error) { setStatus(error.message || String(error)); }
});

$('#profileEditForm')?.addEventListener('submit', saveProfile);
addEventListener('beforeunload', (event) => { if (dirty && !saving) event.preventDefault(); });

boot();