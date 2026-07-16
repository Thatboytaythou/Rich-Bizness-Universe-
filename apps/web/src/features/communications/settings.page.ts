import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './communications.css';
import './settings-universe.css';

type JsonMap = Record<string, unknown>;
type UserSettings = {
  language?: string;
  timezone?: string;
  default_theme?: string;
  profile_visibility?: string;
  dm_privacy?: string;
  motion_level?: string;
  notification_level?: string;
  accent_color?: string;
  cinema_mode?: boolean;
  tv_mode?: boolean;
  metadata?: JsonMap;
};
type ThemeSettings = {
  background_style?: string;
  banner_overlay?: string;
  profile_layout?: string;
  avatar_frame?: string;
  font_style?: string;
  button_style?: string;
  smoke_fx?: boolean;
  glow_fx?: boolean;
  depth_3d?: boolean;
  metadata?: JsonMap;
};

function bool(source: JsonMap, key: string, fallback: boolean): boolean {
  return typeof source[key] === 'boolean' ? source[key] as boolean : fallback;
}

function selected(value: unknown, expected: string): string {
  return String(value ?? '') === expected ? ' selected' : '';
}

function checked(value: boolean): string {
  return value ? ' checked' : '';
}

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.settingsOwner === 'mounted') return;
  root.dataset.settingsOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(ROUTES.settings)}`);
    return;
  }

  const [
    { data: profileData, error: profileError },
    { data: userSettingsData, error: userSettingsError },
    { data: themeData, error: themeError }
  ] = await Promise.all([
    supabase.from('profiles').select('privacy_config,notification_config,online_status').eq('id', user.id).single(),
    supabase.from('user_settings').select('language,timezone,default_theme,profile_visibility,dm_privacy,motion_level,notification_level,accent_color,cinema_mode,tv_mode,metadata').eq('user_id', user.id).maybeSingle(),
    supabase.from('profile_theme_settings').select('background_style,banner_overlay,profile_layout,avatar_frame,font_style,button_style,smoke_fx,glow_fx,depth_3d,metadata').eq('user_id', user.id).maybeSingle()
  ]);

  if (profileError) throw profileError;
  if (userSettingsError) throw userSettingsError;
  if (themeError) throw themeError;

  const privacy = ((profileData as any)?.privacy_config ?? {}) as JsonMap;
  const notify = ((profileData as any)?.notification_config ?? {}) as JsonMap;
  const userSettings = (userSettingsData ?? {}) as UserSettings;
  const theme = (themeData ?? {}) as ThemeSettings;

  root.innerHTML = `<main class="comm-shell"><div class="comm-wrap">
    <header class="comm-head">
      <a href="${ROUTES.profile}" aria-label="Back to profile">←</a>
      <div><p>RICH BIZNESS CONTROL CENTER</p><h1>Settings</h1></div>
      <span id="saveState" class="comm-pill">READY</span>
    </header>

    <nav class="settings-jump" aria-label="Settings shortcuts">
      <a href="${ROUTES.editProfile}">EDIT PROFILE</a>
      <a href="${ROUTES.notifications}">NOTIFICATIONS</a>
      <a href="${ROUTES.messages}">MESSAGES</a>
      <a href="${ROUTES.avatar}">AVATAR</a>
      <a href="${ROUTES.portal}">PORTAL</a>
    </nav>

    <form id="settingsForm" class="comm-card comm-form" novalidate>
      <section>
        <h2>Notifications</h2>
        <label class="toggle-row"><span><strong>Direct messages</strong><br/>Rich-DM alerts, replies, reactions, and calls.</span><input type="checkbox" name="dm"${checked(bool(notify, 'dm', true))}></label>
        <label class="toggle-row"><span><strong>Live alerts</strong><br/>Creators, VIP rooms, broadcasts, and replays.</span><input type="checkbox" name="live"${checked(bool(notify, 'live', true))}></label>
        <label class="toggle-row"><span><strong>Music + podcast + radio</strong><br/>Drops, releases, comments, episodes, and stations.</span><input type="checkbox" name="music"${checked(bool(notify, 'music', true))}></label>
        <label class="toggle-row"><span><strong>Store alerts</strong><br/>Orders, sales, comments, payouts, and drops.</span><input type="checkbox" name="store"${checked(bool(notify, 'store', true))}></label>
        <label class="toggle-row"><span><strong>Sports alerts</strong><br/>Picks, broadcasts, clips, teams, and activity.</span><input type="checkbox" name="sports"${checked(bool(notify, 'sports', true))}></label>
        <label class="toggle-row"><span><strong>Game alerts</strong><br/>Challenges, rewards, sessions, and tournaments.</span><input type="checkbox" name="gaming"${checked(bool(notify, 'gaming', true))}></label>
        <label><span>ALERT LEVEL</span><select name="notification_level"><option value="all"${selected(userSettings.notification_level, 'all')}>ALL ACTIVITY</option><option value="important"${selected(userSettings.notification_level ?? 'important', 'important')}>IMPORTANT ONLY</option><option value="silent"${selected(userSettings.notification_level, 'silent')}>SILENT</option></select></label>
      </section>

      <section>
        <h2>Privacy & Presence</h2>
        <label><span>PROFILE VISIBILITY</span><select name="profile_visibility"><option value="public"${selected(userSettings.profile_visibility ?? 'public', 'public')}>PUBLIC</option><option value="followers"${selected(userSettings.profile_visibility, 'followers')}>FOLLOWERS ONLY</option><option value="private"${selected(userSettings.profile_visibility, 'private')}>PRIVATE</option></select></label>
        <label><span>WHO CAN MESSAGE ME</span><select name="dm_privacy"><option value="everyone"${selected(userSettings.dm_privacy, 'everyone')}>EVERYONE</option><option value="followers"${selected(userSettings.dm_privacy ?? 'followers', 'followers')}>FOLLOWERS</option><option value="none"${selected(userSettings.dm_privacy, 'none')}>NO ONE</option></select></label>
        <label class="toggle-row"><span><strong>Show online status</strong><br/>Let members see when you are active.</span><input type="checkbox" name="show_online"${checked(bool(privacy, 'show_online', true))}></label>
        <label class="toggle-row"><span><strong>Allow messages</strong><br/>Members can start conversations with you.</span><input type="checkbox" name="allow_messages"${checked(bool(privacy, 'allow_messages', true))}></label>
        <label class="toggle-row"><span><strong>Allow follows</strong><br/>Members can follow your public identity.</span><input type="checkbox" name="allow_follows"${checked(bool(privacy, 'allow_follows', true))}></label>
        <label class="toggle-row"><span><strong>Allow comments</strong><br/>Enable comments on your public creator content.</span><input type="checkbox" name="allow_comments"${checked(bool(privacy, 'allow_comments', true))}></label>
        <label class="toggle-row"><span><strong>Allow calls</strong><br/>Permit eligible members to request Rich Calls.</span><input type="checkbox" name="allow_calls"${checked(bool(privacy, 'allow_calls', true))}></label>
      </section>

      <section>
        <h2>Universe Experience</h2>
        <label><span>LANGUAGE</span><select name="language"><option value="en"${selected(userSettings.language ?? 'en', 'en')}>ENGLISH</option><option value="es"${selected(userSettings.language, 'es')}>SPANISH</option></select></label>
        <label><span>TIMEZONE</span><input name="timezone" value="${String(userSettings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/New_York')}" maxlength="64"></label>
        <label><span>DEFAULT THEME</span><select name="default_theme"><option value="rich-universe"${selected(userSettings.default_theme ?? 'rich-universe', 'rich-universe')}>RICH UNIVERSE</option><option value="emerald-night"${selected(userSettings.default_theme, 'emerald-night')}>EMERALD NIGHT</option><option value="gold-cinema"${selected(userSettings.default_theme, 'gold-cinema')}>GOLD CINEMA</option></select></label>
        <label><span>MOTION LEVEL</span><select name="motion_level"><option value="full"${selected(userSettings.motion_level ?? 'full', 'full')}>FULL CINEMATIC</option><option value="balanced"${selected(userSettings.motion_level, 'balanced')}>BALANCED</option><option value="reduced"${selected(userSettings.motion_level, 'reduced')}>REDUCED</option></select></label>
        <label><span>ACCENT COLOR</span><input name="accent_color" type="color" value="${String(userSettings.accent_color ?? '#31ff63')}"></label>
        <label class="toggle-row"><span><strong>Cinema mode</strong><br/>Use full Rich Bizness visual depth.</span><input type="checkbox" name="cinema_mode"${checked(userSettings.cinema_mode !== false)}></label>
        <label class="toggle-row"><span><strong>TV mode</strong><br/>Use expanded layouts on large screens.</span><input type="checkbox" name="tv_mode"${checked(userSettings.tv_mode === true)}></label>
      </section>

      <section>
        <h2>Profile Design</h2>
        <label><span>BACKGROUND STYLE</span><select name="background_style"><option value="cinematic"${selected(theme.background_style ?? 'cinematic', 'cinematic')}>CINEMATIC</option><option value="portal"${selected(theme.background_style, 'portal')}>PORTAL</option><option value="smoke-cloud"${selected(theme.background_style, 'smoke-cloud')}>SMOKE CLOUD</option></select></label>
        <label><span>BANNER OVERLAY</span><select name="banner_overlay"><option value="cinematic"${selected(theme.banner_overlay ?? 'cinematic', 'cinematic')}>CINEMATIC</option><option value="dark"${selected(theme.banner_overlay, 'dark')}>DARK</option><option value="clear"${selected(theme.banner_overlay, 'clear')}>CLEAR</option></select></label>
        <label><span>PROFILE LAYOUT</span><select name="profile_layout"><option value="universe"${selected(theme.profile_layout ?? 'universe', 'universe')}>UNIVERSE</option><option value="creator"${selected(theme.profile_layout, 'creator')}>CREATOR</option><option value="compact"${selected(theme.profile_layout, 'compact')}>COMPACT</option></select></label>
        <label><span>AVATAR FRAME</span><select name="avatar_frame"><option value="emerald-gold"${selected(theme.avatar_frame ?? 'emerald-gold', 'emerald-gold')}>EMERALD GOLD</option><option value="diamond"${selected(theme.avatar_frame, 'diamond')}>DIAMOND</option><option value="minimal"${selected(theme.avatar_frame, 'minimal')}>MINIMAL</option></select></label>
        <label><span>FONT STYLE</span><select name="font_style"><option value="system"${selected(theme.font_style ?? 'system', 'system')}>SYSTEM ELITE</option><option value="cinematic"${selected(theme.font_style, 'cinematic')}>CINEMATIC</option><option value="serif"${selected(theme.font_style, 'serif')}>LUXURY SERIF</option></select></label>
        <label><span>BUTTON STYLE</span><select name="button_style"><option value="glass"${selected(theme.button_style ?? 'glass', 'glass')}>GLASS</option><option value="solid"${selected(theme.button_style, 'solid')}>SOLID</option><option value="neon"${selected(theme.button_style, 'neon')}>NEON</option></select></label>
        <label class="toggle-row"><span><strong>Smoke FX</strong><br/>Enable profile atmosphere effects.</span><input type="checkbox" name="smoke_fx"${checked(theme.smoke_fx !== false)}></label>
        <label class="toggle-row"><span><strong>Glow FX</strong><br/>Enable neon profile lighting.</span><input type="checkbox" name="glow_fx"${checked(theme.glow_fx !== false)}></label>
        <label class="toggle-row"><span><strong>3D depth</strong><br/>Enable layered cinematic profile depth.</span><input type="checkbox" name="depth_3d"${checked(theme.depth_3d !== false)}></label>
      </section>

      <section class="settings-security">
        <h2>Account & Security</h2>
        <div class="settings-account"><strong>${user.email ?? 'SIGNED-IN ACCOUNT'}</strong><span>Session protected by Supabase Auth.</span></div>
        <div class="settings-account-actions">
          <a class="comm-button" href="${ROUTES.editProfile}">EDIT IDENTITY</a>
          <button id="refreshSession" class="comm-button" type="button">VERIFY SESSION</button>
          <button id="signOut" class="comm-button danger" type="button">SIGN OUT</button>
        </div>
      </section>

      <p id="status" class="status-line" role="status"></p>
      <button id="saveButton" class="comm-button primary" type="submit">SAVE UNIVERSE SETTINGS</button>
    </form>
  </div></main>`;

  const form = root.querySelector<HTMLFormElement>('#settingsForm')!;
  const status = root.querySelector<HTMLElement>('#status')!;
  const saveState = root.querySelector<HTMLElement>('#saveState')!;
  const saveButton = root.querySelector<HTMLButtonElement>('#saveButton')!;
  const accentInput = form.elements.namedItem('accent_color') as HTMLInputElement | null;
  const refreshSessionButton = root.querySelector<HTMLButtonElement>('#refreshSession')!;
  const signOutButton = root.querySelector<HTMLButtonElement>('#signOut')!;

  if (accentInput) {
    document.documentElement.style.setProperty('--rb-user-accent', accentInput.value);
    accentInput.addEventListener('input', () => document.documentElement.style.setProperty('--rb-user-accent', accentInput.value));
  }

  let dirty = false;
  let saving = false;
  let destroyed = false;

  const markDirty = () => {
    if (saving || destroyed) return;
    dirty = true;
    saveState.textContent = 'UNSAVED';
    status.textContent = '';
  };

  const guard = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };

  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  window.addEventListener('beforeunload', guard);

  refreshSessionButton.onclick = async () => {
    refreshSessionButton.disabled = true;
    const { data, error } = await supabase.auth.getUser();
    status.textContent = error || !data.user ? 'Session verification failed.' : 'Session verified and protected.';
    refreshSessionButton.disabled = false;
  };

  signOutButton.onclick = async () => {
    signOutButton.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      status.textContent = error.message;
      signOutButton.disabled = false;
      return;
    }
    location.replace(ROUTES.home);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    saveButton.disabled = true;
    saveState.textContent = 'SAVING';
    status.textContent = '';

    const data = new FormData(form);
    const now = new Date().toISOString();
    const notificationConfig = {
      ...notify,
      dm: data.has('dm'),
      live: data.has('live'),
      music: data.has('music'),
      store: data.has('store'),
      sports: data.has('sports'),
      gaming: data.has('gaming')
    };
    const privacyConfig = {
      ...privacy,
      show_online: data.has('show_online'),
      allow_messages: data.has('allow_messages'),
      allow_follows: data.has('allow_follows'),
      allow_comments: data.has('allow_comments'),
      allow_calls: data.has('allow_calls')
    };
    const userPayload = {
      user_id: user.id,
      language: String(data.get('language') ?? 'en'),
      timezone: String(data.get('timezone') ?? 'America/New_York').trim().slice(0, 64),
      default_theme: String(data.get('default_theme') ?? 'rich-universe'),
      profile_visibility: String(data.get('profile_visibility') ?? 'public'),
      dm_privacy: String(data.get('dm_privacy') ?? 'followers'),
      motion_level: String(data.get('motion_level') ?? 'full'),
      notification_level: String(data.get('notification_level') ?? 'important'),
      accent_color: String(data.get('accent_color') ?? '#31ff63'),
      cinema_mode: data.has('cinema_mode'),
      tv_mode: data.has('tv_mode'),
      metadata: { ...(userSettings.metadata ?? {}), source: 'settings-page', version: 2 },
      updated_at: now
    };
    const themePayload = {
      user_id: user.id,
      background_style: String(data.get('background_style') ?? 'cinematic'),
      banner_overlay: String(data.get('banner_overlay') ?? 'cinematic'),
      profile_layout: String(data.get('profile_layout') ?? 'universe'),
      avatar_frame: String(data.get('avatar_frame') ?? 'emerald-gold'),
      font_style: String(data.get('font_style') ?? 'system'),
      button_style: String(data.get('button_style') ?? 'glass'),
      smoke_fx: data.has('smoke_fx'),
      glow_fx: data.has('glow_fx'),
      depth_3d: data.has('depth_3d'),
      metadata: { ...(theme.metadata ?? {}), source: 'settings-page', version: 2 },
      updated_at: now
    };

    try {
      const [
        { error: profileUpdateError },
        { error: settingsUpdateError },
        { error: themeUpdateError }
      ] = await Promise.all([
        supabase.from('profiles').update({ notification_config: notificationConfig, privacy_config: privacyConfig, online_status: data.has('show_online') ? 'online' : 'hidden', updated_at: now }).eq('id', user.id),
        supabase.from('user_settings').upsert(userPayload, { onConflict: 'user_id' }),
        supabase.from('profile_theme_settings').upsert(themePayload, { onConflict: 'user_id' })
      ]);
      const updateError = profileUpdateError ?? settingsUpdateError ?? themeUpdateError;
      if (updateError) throw updateError;

      dirty = false;
      saveState.textContent = 'SAVED';
      status.textContent = 'Universe settings saved across Profile, Rich-DM, notifications, calls, comments, privacy, and visual experience.';
    } catch (caught) {
      saveState.textContent = 'ERROR';
      status.textContent = caught instanceof Error ? caught.message : 'Unable to save settings.';
    } finally {
      saving = false;
      saveButton.disabled = false;
    }
  });

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('beforeunload', guard);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}