import { supabase } from './supabase-client.js';
import { RB_CONFIG } from './config.js';

const page = document.body.dataset.identityPage || 'profile';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let user = null;
let viewedId = null;
let channel = null;
let disposed = false;
let busy = false;

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const safeUrl = (value, allowLocal = true) => {
  const raw = clean(value, 1000);
  if (!raw) return '';
  if (allowLocal && raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
const say = (text, error = false) => {
  const node = $('#identityStatus');
  if (!node) return;
  node.textContent = text;
  node.dataset.error = error ? 'true' : 'false';
};

async function requireUser() {
  if (!supabase) throw new Error('Supabase connection unavailable');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  user = data.user || null;
  return user;
}

async function ensureProfile() {
  if (!user) return null;
  const { data, error } = await supabase.from(RB_CONFIG.tables.profiles).select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const metadata = user.user_metadata || {};
  const row = {
    id: user.id,
    username: clean(metadata.username || user.email?.split('@')[0] || `rich_${user.id.slice(0, 8)}`, 32).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32),
    display_name: clean(metadata.display_name || 'Rich Bizness Member', 80),
    full_name: clean(metadata.full_name || metadata.display_name || '', 120),
    avatar_url: safeUrl(metadata.avatar_url) || null,
    onboarding_state: 'complete',
    has_profile_identity: true,
    last_route: location.pathname
  };
  const { data: created, error: insertError } = await supabase.from(RB_CONFIG.tables.profiles).upsert(row, { onConflict: 'id' }).select('*').single();
  if (insertError) throw insertError;
  return created;
}

async function loadIdentity(id) {
  const [profileResult, levelResult, avatarResult, themeResult, postsResult, followersResult, followingResult] = await Promise.all([
    supabase.from(RB_CONFIG.tables.profiles).select('*').eq('id', id).maybeSingle(),
    supabase.from(RB_CONFIG.tables.userLevels).select('*').eq('user_id', id).maybeSingle(),
    supabase.from(RB_CONFIG.tables.metaAvatars).select('*').eq('user_id', id).maybeSingle(),
    supabase.from(RB_CONFIG.tables.profileThemes).select('*').eq('user_id', id).maybeSingle(),
    supabase.from(RB_CONFIG.tables.feedPosts).select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from(RB_CONFIG.tables.followers).select('id', { count: 'exact', head: true }).eq('following_id', id),
    supabase.from(RB_CONFIG.tables.followers).select('id', { count: 'exact', head: true }).eq('follower_id', id)
  ]);
  for (const result of [profileResult, levelResult, avatarResult, themeResult, postsResult, followersResult, followingResult]) if (result.error) throw result.error;
  return {
    profile: profileResult.data,
    level: levelResult.data,
    avatar: avatarResult.data,
    theme: themeResult.data,
    posts: postsResult.count || 0,
    followers: followersResult.count || 0,
    following: followingResult.count || 0
  };
}

function applyBackground(node, value) {
  if (!node) return;
  const url = safeUrl(value);
  node.style.backgroundImage = url ? `linear-gradient(180deg,rgba(4,10,4,.12),rgba(0,0,0,.82)),url("${url.replace(/["\\]/g, '')}")` : '';
}

function renderProfile(data) {
  const p = data.profile || {};
  const level = data.level || {};
  const avatar = data.avatar || {};
  const avatarUrl = safeUrl(avatar.avatar_url || p.avatar_url) || '/images/brand/Avatar-hero-Banner.png.jpeg';
  const bannerUrl = safeUrl(p.banner_url || data.theme?.background_url);
  $('#profileAvatar')?.setAttribute('src', avatarUrl);
  $('#profileAvatar')?.setAttribute('alt', `${p.display_name || 'Rich Bizness'} avatar`);
  applyBackground($('#profileBanner'), bannerUrl);
  if ($('#profileName')) $('#profileName').textContent = p.display_name || p.full_name || 'Rich Bizness Member';
  if ($('#profileHandle')) $('#profileHandle').textContent = `@${p.username || 'richmember'}`;
  if ($('#profileBio')) $('#profileBio').textContent = p.bio || 'Building an empire inside the Rich Bizness Universe.';
  if ($('#rankTitle')) $('#rankTitle').textContent = level.rank_title || p.rank_title || 'Smoke Rookie';
  if ($('#levelValue')) $('#levelValue').textContent = level.level ?? p.rich_level ?? 1;
  if ($('#pointsValue')) $('#pointsValue').textContent = level.rich_points ?? p.rich_points ?? 0;
  if ($('#balanceValue')) $('#balanceValue').textContent = money(p.balance_cents);
  if ($('#followersValue')) $('#followersValue').textContent = data.followers;
  if ($('#followingValue')) $('#followingValue').textContent = data.following;
  if ($('#postsValue')) $('#postsValue').textContent = data.posts;
  const next = Math.max(Number(level.xp_next || 100), 1);
  const current = Math.max(Number(level.xp_current || 0), 0);
  if ($('#xpText')) $('#xpText').textContent = `${current} / ${next} XP`;
  if ($('#xpFill')) $('#xpFill').style.width = `${Math.min(100, (current / next) * 100)}%`;
  const roleChips = [p.is_creator && 'CREATOR', p.is_artist && 'ARTIST', p.is_seller && 'SELLER', p.is_verified && 'VERIFIED', avatar.aura && `AURA: ${avatar.aura}`].filter(Boolean);
  const chips = $('#identityChips');
  if (chips) chips.replaceChildren(...roleChips.map((text) => { const span = document.createElement('span'); span.className = 'chip'; span.textContent = text; return span; }));
  const owner = user?.id === viewedId;
  $('#ownerActions')?.toggleAttribute('hidden', !owner);
  $('#guestActions')?.toggleAttribute('hidden', owner || !user);
}

async function bootProfile() {
  const params = new URLSearchParams(location.search);
  viewedId = params.get('id') || user?.id || null;
  if (!viewedId) {
    say('TAP IN TO LOAD YOUR RICH ID', true);
    return;
  }
  const data = await loadIdentity(viewedId);
  if (!data.profile) throw new Error('Profile not found');
  renderProfile(data);
  say('IDENTITY LOCKED IN');
  channel = supabase.channel(`identity-profile-${viewedId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: RB_CONFIG.tables.profiles, filter: `id=eq.${viewedId}` }, refreshProfile)
    .on('postgres_changes', { event: '*', schema: 'public', table: RB_CONFIG.tables.userLevels, filter: `user_id=eq.${viewedId}` }, refreshProfile)
    .on('postgres_changes', { event: '*', schema: 'public', table: RB_CONFIG.tables.metaAvatars, filter: `user_id=eq.${viewedId}` }, refreshProfile)
    .subscribe();
}

let refreshTimer = 0;
function refreshProfile() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (disposed || !viewedId) return;
    try { renderProfile(await loadIdentity(viewedId)); } catch {}
  }, 180);
}

function fillForm(profile) {
  const fields = ['display_name','username','full_name','bio','avatar_url','banner_url','website_url','instagram_url','youtube_url','tiktok_url','facebook_url','snapchat_url','favorite_section'];
  fields.forEach((name) => { const input = document.querySelector(`[name="${name}"]`); if (input) input.value = profile?.[name] || ''; });
}

async function bootEdit() {
  if (!user) return location.replace(`/auth.html?next=${encodeURIComponent('/edit.html')}`);
  const profile = await ensureProfile();
  fillForm(profile);
  say('PROFILE READY');
  $('#profileForm')?.addEventListener('submit', saveProfile);
}

async function saveProfile(event) {
  event.preventDefault();
  if (busy || !user) return;
  busy = true;
  say('SAVING YOUR EMPIRE CARD...');
  try {
    const form = new FormData(event.currentTarget);
    const username = clean(form.get('username'), 32).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!/^[a-z0-9_]{3,32}$/.test(username)) throw new Error('Username must be 3-32 letters, numbers, or underscores');
    const row = {
      id: user.id,
      display_name: clean(form.get('display_name'), 80),
      username,
      full_name: clean(form.get('full_name'), 120),
      bio: clean(form.get('bio'), 500),
      avatar_url: safeUrl(form.get('avatar_url')) || null,
      banner_url: safeUrl(form.get('banner_url')) || null,
      website_url: safeUrl(form.get('website_url'), false) || null,
      instagram_url: safeUrl(form.get('instagram_url'), false) || null,
      youtube_url: safeUrl(form.get('youtube_url'), false) || null,
      tiktok_url: safeUrl(form.get('tiktok_url'), false) || null,
      facebook_url: safeUrl(form.get('facebook_url'), false) || null,
      snapchat_url: safeUrl(form.get('snapchat_url'), false) || null,
      favorite_section: clean(form.get('favorite_section'), 24) || null,
      has_avatar: Boolean(safeUrl(form.get('avatar_url'))),
      has_profile_identity: true,
      onboarding_state: 'complete',
      last_route: '/edit.html',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(RB_CONFIG.tables.profiles).upsert(row, { onConflict: 'id' });
    if (error) throw error;
    say('PROFILE LOCKED IN');
  } catch (error) { say(error.message || 'PROFILE SAVE FAILED', true); }
  finally { busy = false; }
}

async function bootSettings() {
  if (!user) return location.replace(`/auth.html?next=${encodeURIComponent('/settings.html')}`);
  const { data, error } = await supabase.from(RB_CONFIG.tables.userSettings).select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  const defaults = { language:'rich', timezone:'America/New_York', default_theme:'smoke-cloud', accent_color:'#9dff63', motion_level:'full', profile_visibility:'public', dm_privacy:'followers', notification_level:'all', cinema_mode:true, tv_mode:true };
  const row = { ...defaults, ...(data || {}) };
  Object.entries(row).forEach(([key, value]) => { const input = document.querySelector(`[name="${key}"]`); if (!input) return; if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = value ?? ''; });
  $('#settingsForm')?.addEventListener('submit', saveSettings);
  say('SETTINGS READY');
}

async function saveSettings(event) {
  event.preventDefault();
  if (busy || !user) return;
  busy = true;
  say('SAVING YOUR VIBE...');
  try {
    const form = event.currentTarget;
    const row = {
      user_id: user.id,
      language: form.language.value,
      timezone: clean(form.timezone.value, 80),
      default_theme: form.default_theme.value,
      accent_color: /^#[0-9a-f]{6}$/i.test(form.accent_color.value) ? form.accent_color.value : '#9dff63',
      motion_level: form.motion_level.value,
      profile_visibility: form.profile_visibility.value,
      dm_privacy: form.dm_privacy.value,
      notification_level: form.notification_level.value,
      cinema_mode: form.cinema_mode.checked,
      tv_mode: form.tv_mode.checked,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(RB_CONFIG.tables.userSettings).upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    say('VIBE SAVED');
  } catch (error) { say(error.message || 'SETTINGS SAVE FAILED', true); }
  finally { busy = false; }
}

async function bootAvatar() {
  if (!user) return location.replace(`/auth.html?next=${encodeURIComponent('/avatar.html')}`);
  const [avatarResult, presetsResult] = await Promise.all([
    supabase.from(RB_CONFIG.tables.metaAvatars).select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('avatar_character_presets').select('*').eq('is_active', true).order('created_at')
  ]);
  if (avatarResult.error) throw avatarResult.error;
  if (presetsResult.error) throw presetsResult.error;
  const avatar = avatarResult.data || {};
  $('#avatarName').value = avatar.display_name || user.user_metadata?.display_name || 'Rich Avatar';
  $('#avatarUrl').value = avatar.avatar_url || '';
  $('#avatarAura').value = avatar.aura || 'green-gold';
  $('#avatarRank').value = avatar.rank || 'Traveler';
  updateAvatarPreview();
  const grid = $('#presetGrid');
  if (grid) {
    grid.replaceChildren(...(presetsResult.data || []).map((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset';
      button.dataset.key = preset.preset_key;
      button.innerHTML = `<b>${clean(preset.title,80)}</b><br><span>${clean(preset.aura,60)} • ${clean(preset.motion,60)}</span>`;
      button.addEventListener('click', () => {
        $$('.preset').forEach((node) => node.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        $('#avatarAura').value = preset.aura || 'green-gold';
        $('#avatarMotion').value = preset.motion || 'Boss Idle';
        $('#avatarOutfit').value = preset.outfit || 'Rich Default';
      });
      return button;
    }));
  }
  $('#avatarUrl')?.addEventListener('input', updateAvatarPreview);
  $('#avatarForm')?.addEventListener('submit', saveAvatar);
  say('AVATAR LAB READY');
}

function updateAvatarPreview() {
  const url = safeUrl($('#avatarUrl')?.value) || '/images/brand/Avatar-hero-Banner.png.jpeg';
  $('#avatarPreview')?.setAttribute('src', url);
}

async function saveAvatar(event) {
  event.preventDefault();
  if (busy || !user) return;
  busy = true;
  say('LOCKING AVATAR...');
  try {
    const row = {
      user_id: user.id,
      display_name: clean($('#avatarName')?.value, 80),
      avatar_url: safeUrl($('#avatarUrl')?.value) || null,
      aura: clean($('#avatarAura')?.value, 60) || 'green-gold',
      rank: clean($('#avatarRank')?.value, 60) || 'Traveler',
      is_active: true,
      metadata: { outfit: clean($('#avatarOutfit')?.value, 80), motion: clean($('#avatarMotion')?.value, 80), source: 'identity-owner-v1' },
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(RB_CONFIG.tables.metaAvatars).upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    await supabase.from(RB_CONFIG.tables.profiles).update({ avatar_url: row.avatar_url, has_avatar: Boolean(row.avatar_url), updated_at: new Date().toISOString() }).eq('id', user.id);
    updateAvatarPreview();
    say('AVATAR LOCKED IN');
  } catch (error) { say(error.message || 'AVATAR SAVE FAILED', true); }
  finally { busy = false; }
}

async function boot() {
  try {
    await requireUser();
    if (page === 'profile') await bootProfile();
    if (page === 'edit') await bootEdit();
    if (page === 'settings') await bootSettings();
    if (page === 'avatar') await bootAvatar();
  } catch (error) { say(error.message || 'IDENTITY SYSTEM FAILED', true); }
}

window.addEventListener('pagehide', () => {
  disposed = true;
  clearTimeout(refreshTimer);
  if (channel && supabase) supabase.removeChannel(channel);
}, { once: true });

boot();
