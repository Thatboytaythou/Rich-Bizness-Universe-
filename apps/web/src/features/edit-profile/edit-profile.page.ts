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
};

const PROFILE_COLUMNS = 'username,display_name,bio,avatar_url,banner_url,website_url,instagram_url,youtube_url,tiktok_url,facebook_url,snapchat_url,favorite_section';
const STARTER_AVATARS = [
  '/images/brand/Avatar-hero-Banner.png.jpeg',
  '/brand/icons/profile-placeholder.svg',
  '/images/profile/default-avatar.png'
];

function inputValue(form: HTMLFormElement, name: string): string | null {
  const value = new FormData(form).get(name)?.toString().trim() ?? '';
  return value || null;
}

function safeUsername(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
  return normalized.length >= 3 ? normalized : null;
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character] ?? character);
}

function isCustomAvatar(value: string | null): boolean {
  if (!value) return false;
  return !STARTER_AVATARS.some((starter) => value.includes(starter));
}

async function uploadProfileAsset(userId: string, bucket: 'avatars' | 'profile-banners', file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Image must be 8 MB or smaller.');

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/tap-in.html?next=${encodeURIComponent('/edit-profile.html')}`);
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', session.user.id)
    .single();
  if (error) throw error;
  const profile = data as ProfileDraft;

  root.innerHTML = `
    <main class="edit-profile-shell">
      <header class="edit-profile-header">
        <a href="/profile.html" aria-label="Back to profile">←</a>
        <div><p>RICH BIZNESS IDENTITY</p><h1>Edit Profile</h1></div>
        <span id="saveState">READY</span>
      </header>

      <form id="profileForm" class="edit-profile-form" novalidate>
        <section class="edit-profile-media">
          <label class="banner-picker" id="bannerPreview" style="background-image:url('${escapeHtml(profile.banner_url)}')">
            <input id="bannerFile" type="file" accept="image/*" hidden />
            <span>CHANGE BANNER</span>
          </label>
          <label class="avatar-picker">
            <img id="avatarPreview" src="${escapeHtml(profile.avatar_url) || '/brand/icons/profile-placeholder.svg'}" alt="Profile avatar preview" />
            <input id="avatarFile" type="file" accept="image/*" hidden />
            <span>CHANGE AVATAR</span>
          </label>
        </section>

        <section class="edit-profile-grid">
          <label><span>DISPLAY NAME</span><input name="display_name" maxlength="60" value="${escapeHtml(profile.display_name)}" /></label>
          <label><span>USERNAME</span><input name="username" minlength="3" maxlength="30" autocomplete="username" value="${escapeHtml(profile.username)}" /></label>
          <label class="wide"><span>BIO</span><textarea name="bio" maxlength="300" rows="4">${escapeHtml(profile.bio)}</textarea></label>
          <label><span>FAVORITE SECTION</span><select name="favorite_section">
            ${['portal','feed','gallery','live','music','podcast','radio','sports','store','gaming','meta','profile'].map((section) => `<option value="${section}"${profile.favorite_section === section ? ' selected' : ''}>${section.toUpperCase()}</option>`).join('')}
          </select></label>
          <label><span>WEBSITE</span><input name="website_url" inputmode="url" placeholder="https://" value="${escapeHtml(profile.website_url)}" /></label>
          <label><span>INSTAGRAM</span><input name="instagram_url" inputmode="url" placeholder="https://" value="${escapeHtml(profile.instagram_url)}" /></label>
          <label><span>YOUTUBE</span><input name="youtube_url" inputmode="url" placeholder="https://" value="${escapeHtml(profile.youtube_url)}" /></label>
          <label><span>TIKTOK</span><input name="tiktok_url" inputmode="url" placeholder="https://" value="${escapeHtml(profile.tiktok_url)}" /></label>
          <label><span>FACEBOOK</span><input name="facebook_url" inputmode="url" placeholder="https://" value="${escapeHtml(profile.facebook_url)}" /></label>
          <label><span>SNAPCHAT</span><input name="snapchat_url" inputmode="url" placeholder="https://" value="${escapeHtml(profile.snapchat_url)}" /></label>
        </section>

        <p id="formMessage" class="form-message" role="status"></p>
        <button id="saveButton" class="save-profile-button" type="submit">SAVE PROFILE</button>
      </form>
    </main>`;

  const form = document.querySelector<HTMLFormElement>('#profileForm');
  const avatarFile = document.querySelector<HTMLInputElement>('#avatarFile');
  const bannerFile = document.querySelector<HTMLInputElement>('#bannerFile');
  const avatarPreview = document.querySelector<HTMLImageElement>('#avatarPreview');
  const bannerPreview = document.querySelector<HTMLElement>('#bannerPreview');
  const message = document.querySelector<HTMLElement>('#formMessage');
  const saveState = document.querySelector<HTMLElement>('#saveState');
  const saveButton = document.querySelector<HTMLButtonElement>('#saveButton');
  if (!form || !avatarFile || !bannerFile || !avatarPreview || !bannerPreview || !message || !saveState || !saveButton) throw new Error('Profile editor failed to mount');

  let avatarUrl = profile.avatar_url;
  let bannerUrl = profile.banner_url;

  avatarFile.addEventListener('change', () => {
    const file = avatarFile.files?.[0];
    if (file) avatarPreview.src = URL.createObjectURL(file);
  });
  bannerFile.addEventListener('change', () => {
    const file = bannerFile.files?.[0];
    if (file) bannerPreview.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    saveState.textContent = 'SAVING';
    message.textContent = '';

    try {
      const avatar = avatarFile.files?.[0];
      const banner = bannerFile.files?.[0];
      if (avatar) avatarUrl = await uploadProfileAsset(session.user.id, 'avatars', avatar);
      if (banner) bannerUrl = await uploadProfileAsset(session.user.id, 'profile-banners', banner);

      const username = safeUsername(inputValue(form, 'username'));
      const displayName = inputValue(form, 'display_name');
      if (!username) throw new Error('Username must be at least 3 letters, numbers, or underscores.');
      if (!displayName) throw new Error('Display name is required.');

      const payload = {
        username,
        display_name: displayName,
        full_name: displayName,
        bio: inputValue(form, 'bio'),
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        favorite_section: inputValue(form, 'favorite_section') ?? 'portal',
        website_url: safeUrl(inputValue(form, 'website_url')),
        instagram_url: safeUrl(inputValue(form, 'instagram_url')),
        youtube_url: safeUrl(inputValue(form, 'youtube_url')),
        tiktok_url: safeUrl(inputValue(form, 'tiktok_url')),
        facebook_url: safeUrl(inputValue(form, 'facebook_url')),
        snapchat_url: safeUrl(inputValue(form, 'snapchat_url')),
        has_avatar: isCustomAvatar(avatarUrl),
        has_profile_identity: true,
        onboarding_state: 'complete',
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase.from('profiles').update(payload).eq('id', session.user.id);
      if (updateError) throw updateError;

      const { error: avatarSyncError } = await supabase.from('meta_avatars').upsert({
        user_id: session.user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (avatarSyncError) throw avatarSyncError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { username, display_name: displayName, full_name: displayName, avatar_url: avatarUrl, banner_url: bannerUrl }
      });
      if (authError) throw authError;

      await supabase.rpc('rb_award_xp', {
        p_event_key: 'profile_completed',
        p_section: 'profile',
        p_source_table: 'profiles',
        p_source_id: session.user.id,
        p_amount: null
      });

      message.textContent = 'Profile, avatar identity, and Rich ID saved.';
      saveState.textContent = 'SAVED';
    } catch (caught) {
      message.textContent = caught instanceof Error ? caught.message : 'Unable to save profile.';
      saveState.textContent = 'ERROR';
    } finally {
      saveButton.disabled = false;
    }
  });
}
