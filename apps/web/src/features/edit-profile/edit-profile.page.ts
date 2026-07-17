import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './edit-profile.css';

type ProfileDraft = {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  snapchat_url: string | null;
  favorite_section: string | null;
  rich_level: number | null;
  rank_title: string | null;
};

type SaveResult = {
  saved?: boolean;
  profile?: {
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
  };
};

const PROFILE_COLUMNS = 'username,display_name,bio,avatar_url,banner_url,website_url,instagram_url,youtube_url,tiktok_url,facebook_url,snapchat_url,favorite_section,rich_level,rank_title';
const FAVORITE_SECTIONS = ['portal', 'feed', 'gallery', 'live', 'watch', 'music', 'podcast', 'radio', 'sports', 'store', 'gaming', 'meta', 'profile'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const esc = (value: string | null | undefined): string => (value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
const field = (form: HTMLFormElement, name: string): string | null => {
  const value = new FormData(form).get(name)?.toString().trim() ?? '';
  return value || null;
};
const normalizeUsername = (value: string | null): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
const optionalUrl = (value: string | null, label: string): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${label} must be a complete http:// or https:// link.`);
  }
};

async function uploadProfileAsset(userId: string, bucket: 'avatars' | 'profile-banners', file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 8 MB or smaller.');
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const role = bucket === 'avatars' ? 'avatar' : 'banner';
  const path = `${userId}/${role}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: true
  });
  if (error) throw error;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.editProfileOwner === 'mounted') return;
  root.dataset.editProfileOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(ROUTES.editProfile)}`);
    return;
  }

  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).single();
  if (error) throw error;
  const profile = data as ProfileDraft;
  const avatarFallback = '/brand/icons/profile-placeholder.svg';
  const avatarInitial = profile.avatar_url || avatarFallback;
  const bannerInitial = profile.banner_url || '/images/brand/Avatar-hero-Banner.png.jpeg';

  root.innerHTML = `<main class="edit-profile-shell">
    <header class="edit-profile-header">
      <a href="${ROUTES.profile}" aria-label="Back to profile">←</a>
      <div><p>RICH BIZNESS IDENTITY ENGINE</p><h1>Edit Profile</h1></div>
      <span id="saveState">READY</span>
    </header>

    <form id="profileForm" class="edit-profile-form" novalidate>
      <section class="edit-profile-media">
        <label class="banner-picker" id="bannerPreview" style="background-image:url('${esc(bannerInitial)}')">
          <input id="bannerFile" type="file" accept="image/*" hidden>
          <span>CHANGE BANNER</span>
        </label>
        <label class="avatar-picker">
          <img id="avatarPreview" src="${esc(avatarInitial)}" alt="Profile avatar preview">
          <input id="avatarFile" type="file" accept="image/*" hidden>
          <span>CHANGE AVATAR</span>
        </label>
        <div class="identity-preview">
          <small>LIVE IDENTITY PREVIEW</small>
          <strong id="previewName">${esc(profile.display_name || 'Rich Bizness User')}</strong>
          <span id="previewHandle">@${esc(profile.username || 'rich_user')}</span>
          <em>${esc(profile.rank_title || 'Biz Legend')} · Level ${profile.rich_level ?? 1}</em>
        </div>
      </section>

      <section class="identity-shortcuts">
        <a href="${ROUTES.avatar}">AVATAR SELECTOR</a>
        <a href="${ROUTES.avatarCharacters}">3D AVATAR LOBBY</a>
        <a href="${ROUTES.settings}">IDENTITY SETTINGS</a>
      </section>

      <section class="edit-profile-section">
        <header><small>CORE IDENTITY</small><h2>Public profile</h2><p>Your name, handle and bio power Profile, Meta, Live, Gaming and creator surfaces.</p></header>
        <div class="edit-profile-grid">
          <label><span>DISPLAY NAME</span><input name="display_name" maxlength="60" required value="${esc(profile.display_name)}"></label>
          <label><span>USERNAME</span><input name="username" minlength="3" maxlength="30" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${esc(profile.username)}"><small>3–30 lowercase letters, numbers or underscores</small></label>
          <label class="wide"><span>BIO</span><textarea name="bio" maxlength="300" rows="4">${esc(profile.bio)}</textarea><small id="bioCount">${profile.bio?.length ?? 0}/300</small></label>
          <label><span>FAVORITE SECTION</span><select name="favorite_section">${FAVORITE_SECTIONS.map((section) => `<option value="${section}"${profile.favorite_section === section ? ' selected' : ''}>${section.toUpperCase()}</option>`).join('')}</select></label>
        </div>
      </section>

      <section class="edit-profile-section">
        <header><small>CONNECTED PRESENCE</small><h2>Links and socials</h2><p>Only complete http:// or https:// links are saved.</p></header>
        <div class="edit-profile-grid social-grid">
          <label><span>WEBSITE</span><input name="website_url" inputmode="url" placeholder="https://" value="${esc(profile.website_url)}"></label>
          <label><span>INSTAGRAM</span><input name="instagram_url" inputmode="url" placeholder="https://" value="${esc(profile.instagram_url)}"></label>
          <label><span>YOUTUBE</span><input name="youtube_url" inputmode="url" placeholder="https://" value="${esc(profile.youtube_url)}"></label>
          <label><span>TIKTOK</span><input name="tiktok_url" inputmode="url" placeholder="https://" value="${esc(profile.tiktok_url)}"></label>
          <label><span>FACEBOOK</span><input name="facebook_url" inputmode="url" placeholder="https://" value="${esc(profile.facebook_url)}"></label>
          <label><span>SNAPCHAT</span><input name="snapchat_url" inputmode="url" placeholder="https://" value="${esc(profile.snapchat_url)}"></label>
        </div>
      </section>

      <div class="edit-profile-save-zone">
        <p id="formMessage" class="form-message" role="status" aria-live="polite">Profile, Meta avatar and Rich ID will sync together.</p>
        <button id="saveButton" class="save-profile-button" type="submit">SAVE IDENTITY</button>
      </div>
    </form>
  </main>`;

  const form = root.querySelector<HTMLFormElement>('#profileForm')!;
  const avatarFile = root.querySelector<HTMLInputElement>('#avatarFile')!;
  const bannerFile = root.querySelector<HTMLInputElement>('#bannerFile')!;
  const avatarPreview = root.querySelector<HTMLImageElement>('#avatarPreview')!;
  const bannerPreview = root.querySelector<HTMLElement>('#bannerPreview')!;
  const previewName = root.querySelector<HTMLElement>('#previewName')!;
  const previewHandle = root.querySelector<HTMLElement>('#previewHandle')!;
  const message = root.querySelector<HTMLElement>('#formMessage')!;
  const saveState = root.querySelector<HTMLElement>('#saveState')!;
  const saveButton = root.querySelector<HTMLButtonElement>('#saveButton')!;
  const bio = form.elements.namedItem('bio') as HTMLTextAreaElement;
  const displayNameInput = form.elements.namedItem('display_name') as HTMLInputElement;
  const usernameInput = form.elements.namedItem('username') as HTMLInputElement;
  const bioCount = root.querySelector<HTMLElement>('#bioCount')!;

  let avatarUrl = profile.avatar_url;
  let bannerUrl = profile.banner_url;
  let avatarObjectUrl: string | null = null;
  let bannerObjectUrl: string | null = null;
  let destroyed = false;

  const markUnsaved = () => { if (saveState.textContent !== 'SAVING') saveState.textContent = 'UNSAVED'; };
  const replaceObjectUrl = (current: string | null, file: File): string => {
    if (current) URL.revokeObjectURL(current);
    return URL.createObjectURL(file);
  };
  const refreshIdentityPreview = () => {
    previewName.textContent = displayNameInput.value.trim() || 'Rich Bizness User';
    previewHandle.textContent = `@${normalizeUsername(usernameInput.value) || 'rich_user'}`;
  };

  avatarFile.onchange = () => {
    const file = avatarFile.files?.[0];
    if (!file) return;
    avatarObjectUrl = replaceObjectUrl(avatarObjectUrl, file);
    avatarPreview.src = avatarObjectUrl;
    markUnsaved();
  };
  bannerFile.onchange = () => {
    const file = bannerFile.files?.[0];
    if (!file) return;
    bannerObjectUrl = replaceObjectUrl(bannerObjectUrl, file);
    bannerPreview.style.backgroundImage = `url("${bannerObjectUrl}")`;
    markUnsaved();
  };
  bio.oninput = () => { bioCount.textContent = `${bio.value.length}/300`; markUnsaved(); };
  displayNameInput.oninput = () => { refreshIdentityPreview(); markUnsaved(); };
  usernameInput.oninput = () => {
    const normalized = normalizeUsername(usernameInput.value);
    if (usernameInput.value !== normalized) usernameInput.value = normalized;
    refreshIdentityPreview();
    markUnsaved();
  };
  form.addEventListener('input', markUnsaved);

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveState.textContent = 'SAVING';
    message.textContent = 'Synchronizing your Rich Bizness identity…';

    try {
      const username = normalizeUsername(field(form, 'username'));
      const displayName = field(form, 'display_name');
      if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error('Username must be 3–30 lowercase letters, numbers, or underscores.');
      if (!displayName) throw new Error('Display name is required.');

      const avatar = avatarFile.files?.[0];
      const banner = bannerFile.files?.[0];
      if (avatar) avatarUrl = await uploadProfileAsset(user.id, 'avatars', avatar);
      if (banner) bannerUrl = await uploadProfileAsset(user.id, 'profile-banners', banner);

      const payload = {
        p_username: username,
        p_display_name: displayName,
        p_bio: field(form, 'bio'),
        p_avatar_url: avatarUrl,
        p_banner_url: bannerUrl,
        p_favorite_section: field(form, 'favorite_section') ?? 'portal',
        p_website_url: optionalUrl(field(form, 'website_url'), 'Website'),
        p_instagram_url: optionalUrl(field(form, 'instagram_url'), 'Instagram'),
        p_youtube_url: optionalUrl(field(form, 'youtube_url'), 'YouTube'),
        p_tiktok_url: optionalUrl(field(form, 'tiktok_url'), 'TikTok'),
        p_facebook_url: optionalUrl(field(form, 'facebook_url'), 'Facebook'),
        p_snapchat_url: optionalUrl(field(form, 'snapchat_url'), 'Snapchat')
      };

      const { data: saved, error: saveError } = await supabase.rpc('rb_save_profile_identity', payload);
      if (saveError) throw saveError;
      const result = (saved ?? {}) as SaveResult;
      if (!result.saved) throw new Error('Profile identity was not saved.');

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          username,
          display_name: displayName,
          full_name: displayName,
          avatar_url: avatarUrl,
          banner_url: bannerUrl
        }
      });
      if (authError) throw new Error(`Profile saved, but Auth identity mirror needs retry: ${authError.message}`);

      avatarFile.value = '';
      bannerFile.value = '';
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      if (bannerObjectUrl) URL.revokeObjectURL(bannerObjectUrl);
      avatarObjectUrl = null;
      bannerObjectUrl = null;
      if (avatarUrl) avatarPreview.src = avatarUrl;
      if (bannerUrl) bannerPreview.style.backgroundImage = `url("${bannerUrl}")`;
      message.textContent = 'Profile, Rich ID and Meta avatar are synchronized.';
      saveState.textContent = 'SAVED';
    } catch (caught) {
      message.textContent = caught instanceof Error ? caught.message : 'Unable to save profile.';
      saveState.textContent = 'ERROR';
    } finally {
      if (!destroyed) saveButton.disabled = false;
    }
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    if (bannerObjectUrl) URL.revokeObjectURL(bannerObjectUrl);
    root.dataset.editProfileOwner = '';
  };
  window.addEventListener('pagehide', cleanup, { once: true });
}
