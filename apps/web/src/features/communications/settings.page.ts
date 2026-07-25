import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './communications.css';
import './settings-universe.css';

type JsonMap = Record<string, unknown>;
type UserSettings = {
  language?: string; timezone?: string; default_theme?: string; profile_visibility?: string;
  dm_privacy?: string; motion_level?: string; notification_level?: string; accent_color?: string;
  cinema_mode?: boolean; tv_mode?: boolean;
};
type ThemeSettings = {
  background_style?: string; banner_overlay?: string; profile_layout?: string; avatar_frame?: string;
  font_style?: string; button_style?: string; smoke_fx?: boolean; glow_fx?: boolean; depth_3d?: boolean;
};

const bool = (source: JsonMap, key: string, fallback: boolean) => typeof source[key] === 'boolean' ? source[key] as boolean : fallback;
const selected = (value: unknown, expected: string) => String(value ?? '') === expected ? ' selected' : '';
const checked = (value: boolean) => value ? ' checked' : '';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character] ?? character));

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root || root.dataset.settingsOwner === 'mounted') return;
  root.dataset.settingsOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(ROUTES.settings)}`);
    return;
  }

  const [{ data: profileData, error: profileError }, { data: settingsData, error: settingsError }, { data: themeData, error: themeError }] = await Promise.all([
    supabase.from('profiles').select('display_name,username,avatar_url,privacy_config,notification_config,online_status').eq('id', user.id).single(),
    supabase.from('user_settings').select('language,timezone,default_theme,profile_visibility,dm_privacy,motion_level,notification_level,accent_color,cinema_mode,tv_mode').eq('user_id', user.id).maybeSingle(),
    supabase.from('profile_theme_settings').select('background_style,banner_overlay,profile_layout,avatar_frame,font_style,button_style,smoke_fx,glow_fx,depth_3d').eq('user_id', user.id).maybeSingle()
  ]);
  const loadError = profileError ?? settingsError ?? themeError;
  if (loadError) throw loadError;

  const profile = (profileData ?? {}) as JsonMap;
  const privacy = (profile.privacy_config ?? {}) as JsonMap;
  const notify = (profile.notification_config ?? {}) as JsonMap;
  const settings = (settingsData ?? {}) as UserSettings;
  const theme = (themeData ?? {}) as ThemeSettings;
  const timezone = settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/New_York';
  const displayName = String(profile.display_name ?? profile.username ?? 'Rich Bizness Member');
  const avatarUrl = String(profile.avatar_url ?? '/brand/icons/profile-placeholder.svg');

  root.innerHTML = `<main class="comm-shell settings-shell"><div class="comm-wrap">
    <header class="comm-head settings-head"><a href="${ROUTES.profile}" aria-label="Back to profile">←</a><div><p>RICH BIZNESS CONTROL CENTER</p><h1>Settings</h1></div><span id="saveState" class="comm-pill">READY</span></header>

    <section class="settings-hero">
      <div class="settings-identity"><img src="${esc(avatarUrl)}" alt="${esc(displayName)}"><div><small>ACTIVE RICH ID</small><h2>${esc(displayName)}</h2><span>${esc(user.email ?? 'SIGNED-IN ACCOUNT')}</span></div></div>
      <div class="settings-health"><article><small>SESSION</small><strong>VERIFIED</strong></article><article><small>PROFILE</small><strong>${esc(String(settings.profile_visibility ?? 'public').toUpperCase())}</strong></article><article><small>MOTION</small><strong>${esc(String(settings.motion_level ?? 'full').toUpperCase())}</strong></article><article><small>ALERTS</small><strong>${esc(String(settings.notification_level ?? 'all').toUpperCase())}</strong></article></div>
    </section>

    <nav class="settings-jump" aria-label="Settings shortcuts"><a href="#notifications">NOTIFICATIONS</a><a href="#privacy">PRIVACY</a><a href="#experience">EXPERIENCE</a><a href="#design">PROFILE DESIGN</a><a href="#security">SECURITY</a><a href="${ROUTES.editProfile}">EDIT PROFILE</a><a href="${ROUTES.notifications}">INBOX</a><a href="${ROUTES.messages}">RICH-DM</a><a href="${ROUTES.avatar}">AVATAR</a><a href="${ROUTES.portal}">PORTAL</a></nav>

    <form id="settingsForm" class="comm-card comm-form settings-grid" novalidate>
      <section id="notifications" class="settings-section"><header><small>ALERT ENGINE</small><h2>Notifications</h2><p>Control what reaches you across Rich-DM, Live, Music, Store, Sports and Gaming.</p></header>
        <label class="toggle-row"><span><strong>Direct messages</strong><br>Rich-DM alerts, replies, reactions, and calls.</span><input type="checkbox" name="dm"${checked(bool(notify,'dm',true))}></label>
        <label class="toggle-row"><span><strong>Live alerts</strong><br>Creators, VIP rooms, broadcasts, and replays.</span><input type="checkbox" name="live"${checked(bool(notify,'live',true))}></label>
        <label class="toggle-row"><span><strong>Music + podcast + radio</strong><br>Drops, releases, episodes, and stations.</span><input type="checkbox" name="music"${checked(bool(notify,'music',true))}></label>
        <label class="toggle-row"><span><strong>Store alerts</strong><br>Orders, sales, payouts, and drops.</span><input type="checkbox" name="store"${checked(bool(notify,'store',true))}></label>
        <label class="toggle-row"><span><strong>Sports alerts</strong><br>Picks, broadcasts, clips, and teams.</span><input type="checkbox" name="sports"${checked(bool(notify,'sports',true))}></label>
        <label class="toggle-row"><span><strong>Game alerts</strong><br>Challenges, rewards, sessions, and tournaments.</span><input type="checkbox" name="gaming"${checked(bool(notify,'gaming',true))}></label>
        <label><span>ALERT LEVEL</span><select name="notification_level"><option value="all"${selected(settings.notification_level ?? 'all','all')}>ALL ACTIVITY</option><option value="important"${selected(settings.notification_level,'important')}>IMPORTANT ONLY</option><option value="silent"${selected(settings.notification_level,'silent')}>SILENT</option></select></label>
      </section>

      <section id="privacy" class="settings-section"><header><small>ACCESS CONTROL</small><h2>Privacy & Presence</h2><p>Define who can see, follow, message, call and comment on your Rich ID.</p></header>
        <label><span>PROFILE VISIBILITY</span><select name="profile_visibility"><option value="public"${selected(settings.profile_visibility ?? 'public','public')}>PUBLIC</option><option value="followers"${selected(settings.profile_visibility,'followers')}>FOLLOWERS ONLY</option><option value="private"${selected(settings.profile_visibility,'private')}>PRIVATE</option></select></label>
        <label><span>WHO CAN MESSAGE ME</span><select name="dm_privacy"><option value="everyone"${selected(settings.dm_privacy,'everyone')}>EVERYONE</option><option value="followers"${selected(settings.dm_privacy ?? 'followers','followers')}>FOLLOWERS</option><option value="none"${selected(settings.dm_privacy,'none')}>NO ONE</option></select></label>
        ${[['show_online','Show online status','Let members see when you are active.'],['allow_messages','Allow messages','Members can start conversations with you.'],['allow_follows','Allow follows','Members can follow your public identity.'],['allow_comments','Allow comments','Enable comments on your public creator content.'],['allow_calls','Allow calls','Permit eligible members to request Rich Calls.']].map(([key,title,copy])=>`<label class="toggle-row"><span><strong>${title}</strong><br>${copy}</span><input type="checkbox" name="${key}"${checked(bool(privacy,key,true))}></label>`).join('')}
      </section>

      <section id="experience" class="settings-section"><header><small>UNIVERSE RUNTIME</small><h2>Experience</h2><p>Control language, timezone, motion, cinematic depth and screen behavior.</p></header>
        <label><span>LANGUAGE</span><select name="language"><option value="en"${selected(settings.language ?? 'en','en')}>ENGLISH</option><option value="es"${selected(settings.language,'es')}>SPANISH</option></select></label>
        <label><span>TIMEZONE</span><input name="timezone" value="${esc(timezone)}" maxlength="64"></label>
        <label><span>DEFAULT THEME</span><select name="default_theme"><option value="rich-universe"${selected(settings.default_theme ?? 'rich-universe','rich-universe')}>RICH UNIVERSE</option><option value="emerald-night"${selected(settings.default_theme,'emerald-night')}>EMERALD NIGHT</option><option value="gold-cinema"${selected(settings.default_theme,'gold-cinema')}>GOLD CINEMA</option></select></label>
        <label><span>MOTION LEVEL</span><select name="motion_level"><option value="full"${selected(settings.motion_level ?? 'full','full')}>FULL CINEMATIC</option><option value="balanced"${selected(settings.motion_level,'balanced')}>BALANCED</option><option value="reduced"${selected(settings.motion_level,'reduced')}>REDUCED</option></select></label>
        <label><span>ACCENT COLOR</span><input name="accent_color" type="color" value="${esc(settings.accent_color ?? '#31ff63')}"></label>
        <label class="toggle-row"><span><strong>Cinema mode</strong><br>Use full Rich Bizness visual depth.</span><input type="checkbox" name="cinema_mode"${checked(settings.cinema_mode !== false)}></label>
        <label class="toggle-row"><span><strong>TV mode</strong><br>Use expanded layouts on large screens.</span><input type="checkbox" name="tv_mode"${checked(settings.tv_mode === true)}></label>
      </section>

      <section id="design" class="settings-section"><header><small>VISUAL IDENTITY</small><h2>Profile Design</h2><p>Shape your profile atmosphere, frame, typography, buttons and depth.</p></header>
        <label><span>BACKGROUND STYLE</span><select name="background_style"><option value="cinematic"${selected(theme.background_style ?? 'cinematic','cinematic')}>CINEMATIC</option><option value="portal"${selected(theme.background_style,'portal')}>PORTAL</option><option value="smoke-cloud"${selected(theme.background_style,'smoke-cloud')}>SMOKE CLOUD</option></select></label>
        <label><span>BANNER OVERLAY</span><select name="banner_overlay"><option value="cinematic"${selected(theme.banner_overlay ?? 'cinematic','cinematic')}>CINEMATIC</option><option value="dark"${selected(theme.banner_overlay,'dark')}>DARK</option><option value="clear"${selected(theme.banner_overlay,'clear')}>CLEAR</option></select></label>
        <label><span>PROFILE LAYOUT</span><select name="profile_layout"><option value="universe"${selected(theme.profile_layout ?? 'universe','universe')}>UNIVERSE</option><option value="creator"${selected(theme.profile_layout,'creator')}>CREATOR</option><option value="compact"${selected(theme.profile_layout,'compact')}>COMPACT</option></select></label>
        <label><span>AVATAR FRAME</span><select name="avatar_frame"><option value="emerald-gold"${selected(theme.avatar_frame ?? 'emerald-gold','emerald-gold')}>EMERALD GOLD</option><option value="diamond"${selected(theme.avatar_frame,'diamond')}>DIAMOND</option><option value="minimal"${selected(theme.avatar_frame,'minimal')}>MINIMAL</option></select></label>
        <label><span>FONT STYLE</span><select name="font_style"><option value="system"${selected(theme.font_style ?? 'system','system')}>SYSTEM ELITE</option><option value="cinematic"${selected(theme.font_style,'cinematic')}>CINEMATIC</option><option value="serif"${selected(theme.font_style,'serif')}>LUXURY SERIF</option></select></label>
        <label><span>BUTTON STYLE</span><select name="button_style"><option value="glass"${selected(theme.button_style ?? 'glass','glass')}>GLASS</option><option value="solid"${selected(theme.button_style,'solid')}>SOLID</option><option value="neon"${selected(theme.button_style,'neon')}>NEON</option></select></label>
        ${[['smoke_fx','Smoke FX','Enable profile atmosphere effects.'],['glow_fx','Glow FX','Enable neon profile lighting.'],['depth_3d','3D depth','Enable layered cinematic profile depth.']].map(([key,title,copy])=>`<label class="toggle-row"><span><strong>${title}</strong><br>${copy}</span><input type="checkbox" name="${key}"${checked((theme as any)[key] !== false)}></label>`).join('')}
      </section>

      <section id="security" class="settings-security settings-section"><header><small>ACCOUNT CORE</small><h2>Account & Security</h2><p>Your session is protected by the shared Supabase Auth bootstrap.</p></header><div class="settings-account"><strong>${esc(user.email ?? 'SIGNED-IN ACCOUNT')}</strong><span>Session verified · Rich ID connected · Auth mirror active</span></div><div class="settings-account-actions"><a class="comm-button" href="${ROUTES.editProfile}">EDIT IDENTITY</a><button id="sessionState" class="comm-button" type="button">VERIFY SESSION</button><button id="signOut" class="comm-button danger" type="button">SIGN OUT</button></div></section>

      <div class="settings-save-zone"><div><strong id="saveSummary">ALL SYSTEMS READY</strong><p id="status" class="status-line" role="status" aria-live="polite">Changes synchronize across Profile, Rich-DM, Notifications, Calls, Comments and the full visual universe.</p></div><button id="saveButton" class="comm-button primary" type="submit">SAVE UNIVERSE SETTINGS</button></div>
    </form></div></main>`;

  const form = root.querySelector<HTMLFormElement>('#settingsForm')!;
  const status = root.querySelector<HTMLElement>('#status')!;
  const saveSummary = root.querySelector<HTMLElement>('#saveSummary')!;
  const saveState = root.querySelector<HTMLElement>('#saveState')!;
  const saveButton = root.querySelector<HTMLButtonElement>('#saveButton')!;
  const signOutButton = root.querySelector<HTMLButtonElement>('#signOut')!;
  const sessionButton = root.querySelector<HTMLButtonElement>('#sessionState')!;
  const accentInput = form.elements.namedItem('accent_color') as HTMLInputElement;
  let dirty = false;
  let saving = false;
  let destroyed = false;

  const updatePreview = () => {
    const data = new FormData(form);
    document.documentElement.style.setProperty('--rb-user-accent', String(data.get('accent_color') ?? '#31ff63'));
    root.dataset.motionLevel = String(data.get('motion_level') ?? 'full');
    root.dataset.cinemaMode = data.has('cinema_mode') ? 'on' : 'off';
  };

  updatePreview();
  accentInput.addEventListener('input', updatePreview);
  sessionButton.onclick = () => { saveSummary.textContent = 'SESSION VERIFIED'; status.textContent = `Session verified for ${user.email ?? 'this account'}.`; };
  const markDirty = () => {
    if (saving || destroyed) return;
    dirty = true;
    saveState.textContent = 'UNSAVED';
    saveSummary.textContent = 'CHANGES READY TO SYNC';
    status.textContent = 'Review your controls, then save to synchronize the entire Rich Bizness universe.';
    updatePreview();
  };
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', guard);

  signOutButton.onclick = async () => {
    signOutButton.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) { status.textContent = error.message; signOutButton.disabled = false; return; }
    location.replace(ROUTES.home);
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    saveButton.disabled = true;
    saveState.textContent = 'SAVING';
    saveSummary.textContent = 'SYNCHRONIZING UNIVERSE';
    status.textContent = 'Applying privacy, notifications, experience and profile design settings…';
    const data = new FormData(form);
    const notificationConfig = { dm:data.has('dm'), live:data.has('live'), music:data.has('music'), store:data.has('store'), sports:data.has('sports'), gaming:data.has('gaming') };
    const privacyConfig = { show_online:data.has('show_online'), allow_messages:data.has('allow_messages'), allow_follows:data.has('allow_follows'), allow_comments:data.has('allow_comments'), allow_calls:data.has('allow_calls') };
    const { error } = await supabase.rpc('rb_save_universe_settings', {
      p_notification_config:notificationConfig, p_privacy_config:privacyConfig,
      p_language:String(data.get('language') ?? 'en'), p_timezone:String(data.get('timezone') ?? 'America/New_York'),
      p_default_theme:String(data.get('default_theme') ?? 'rich-universe'), p_profile_visibility:String(data.get('profile_visibility') ?? 'public'),
      p_dm_privacy:String(data.get('dm_privacy') ?? 'followers'), p_motion_level:String(data.get('motion_level') ?? 'full'),
      p_notification_level:String(data.get('notification_level') ?? 'all'), p_accent_color:String(data.get('accent_color') ?? '#31ff63'),
      p_cinema_mode:data.has('cinema_mode'), p_tv_mode:data.has('tv_mode'), p_background_style:String(data.get('background_style') ?? 'cinematic'),
      p_banner_overlay:String(data.get('banner_overlay') ?? 'cinematic'), p_profile_layout:String(data.get('profile_layout') ?? 'universe'),
      p_avatar_frame:String(data.get('avatar_frame') ?? 'emerald-gold'), p_font_style:String(data.get('font_style') ?? 'system'),
      p_button_style:String(data.get('button_style') ?? 'glass'), p_smoke_fx:data.has('smoke_fx'), p_glow_fx:data.has('glow_fx'), p_depth_3d:data.has('depth_3d')
    });
    if (error) {
      saveState.textContent = 'ERROR';
      saveSummary.textContent = 'SYNC FAILED';
      status.textContent = error.message;
    } else {
      dirty = false;
      saveState.textContent = 'SAVED';
      saveSummary.textContent = 'UNIVERSE SYNCHRONIZED';
      status.textContent = 'Settings synchronized across Profile, Rich-DM, notifications, privacy, calls, comments and visual experience.';
      void supabase.rpc('rb_award_xp', { p_event_key: 'settings_updated', p_section: 'settings', p_source_table: 'user_settings' });
    }
    saving = false;
    if (!destroyed) saveButton.disabled = false;
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('beforeunload', guard);
    root.dataset.settingsOwner = '';
  };
  window.addEventListener('pagehide', cleanup, { once:true });
}
