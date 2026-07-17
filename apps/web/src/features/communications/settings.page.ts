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
    supabase.from('profiles').select('privacy_config,notification_config,online_status').eq('id', user.id).single(),
    supabase.from('user_settings').select('language,timezone,default_theme,profile_visibility,dm_privacy,motion_level,notification_level,accent_color,cinema_mode,tv_mode').eq('user_id', user.id).maybeSingle(),
    supabase.from('profile_theme_settings').select('background_style,banner_overlay,profile_layout,avatar_frame,font_style,button_style,smoke_fx,glow_fx,depth_3d').eq('user_id', user.id).maybeSingle()
  ]);
  const loadError = profileError ?? settingsError ?? themeError;
  if (loadError) throw loadError;

  const privacy = ((profileData as any)?.privacy_config ?? {}) as JsonMap;
  const notify = ((profileData as any)?.notification_config ?? {}) as JsonMap;
  const settings = (settingsData ?? {}) as UserSettings;
  const theme = (themeData ?? {}) as ThemeSettings;
  const timezone = settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/New_York';

  root.innerHTML = `<main class="comm-shell"><div class="comm-wrap">
    <header class="comm-head"><a href="${ROUTES.profile}" aria-label="Back to profile">←</a><div><p>RICH BIZNESS CONTROL CENTER</p><h1>Settings</h1></div><span id="saveState" class="comm-pill">READY</span></header>
    <nav class="settings-jump" aria-label="Settings shortcuts"><a href="${ROUTES.editProfile}">EDIT PROFILE</a><a href="${ROUTES.notifications}">NOTIFICATIONS</a><a href="${ROUTES.messages}">MESSAGES</a><a href="${ROUTES.avatar}">AVATAR</a><a href="${ROUTES.portal}">PORTAL</a></nav>
    <form id="settingsForm" class="comm-card comm-form" novalidate>
      <section><h2>Notifications</h2>
        <label class="toggle-row"><span><strong>Direct messages</strong><br>Rich-DM alerts, replies, reactions, and calls.</span><input type="checkbox" name="dm"${checked(bool(notify,'dm',true))}></label>
        <label class="toggle-row"><span><strong>Live alerts</strong><br>Creators, VIP rooms, broadcasts, and replays.</span><input type="checkbox" name="live"${checked(bool(notify,'live',true))}></label>
        <label class="toggle-row"><span><strong>Music + podcast + radio</strong><br>Drops, releases, episodes, and stations.</span><input type="checkbox" name="music"${checked(bool(notify,'music',true))}></label>
        <label class="toggle-row"><span><strong>Store alerts</strong><br>Orders, sales, payouts, and drops.</span><input type="checkbox" name="store"${checked(bool(notify,'store',true))}></label>
        <label class="toggle-row"><span><strong>Sports alerts</strong><br>Picks, broadcasts, clips, and teams.</span><input type="checkbox" name="sports"${checked(bool(notify,'sports',true))}></label>
        <label class="toggle-row"><span><strong>Game alerts</strong><br>Challenges, rewards, sessions, and tournaments.</span><input type="checkbox" name="gaming"${checked(bool(notify,'gaming',true))}></label>
        <label><span>ALERT LEVEL</span><select name="notification_level"><option value="all"${selected(settings.notification_level ?? 'all','all')}>ALL ACTIVITY</option><option value="important"${selected(settings.notification_level,'important')}>IMPORTANT ONLY</option><option value="silent"${selected(settings.notification_level,'silent')}>SILENT</option></select></label>
      </section>
      <section><h2>Privacy & Presence</h2>
        <label><span>PROFILE VISIBILITY</span><select name="profile_visibility"><option value="public"${selected(settings.profile_visibility ?? 'public','public')}>PUBLIC</option><option value="followers"${selected(settings.profile_visibility,'followers')}>FOLLOWERS ONLY</option><option value="private"${selected(settings.profile_visibility,'private')}>PRIVATE</option></select></label>
        <label><span>WHO CAN MESSAGE ME</span><select name="dm_privacy"><option value="everyone"${selected(settings.dm_privacy,'everyone')}>EVERYONE</option><option value="followers"${selected(settings.dm_privacy ?? 'followers','followers')}>FOLLOWERS</option><option value="none"${selected(settings.dm_privacy,'none')}>NO ONE</option></select></label>
        ${[['show_online','Show online status','Let members see when you are active.'],['allow_messages','Allow messages','Members can start conversations with you.'],['allow_follows','Allow follows','Members can follow your public identity.'],['allow_comments','Allow comments','Enable comments on your public creator content.'],['allow_calls','Allow calls','Permit eligible members to request Rich Calls.']].map(([key,title,copy])=>`<label class="toggle-row"><span><strong>${title}</strong><br>${copy}</span><input type="checkbox" name="${key}"${checked(bool(privacy,key,true))}></label>`).join('')}
      </section>
      <section><h2>Universe Experience</h2>
        <label><span>LANGUAGE</span><select name="language"><option value="en"${selected(settings.language ?? 'en','en')}>ENGLISH</option><option value="es"${selected(settings.language,'es')}>SPANISH</option></select></label>
        <label><span>TIMEZONE</span><input name="timezone" value="${esc(timezone)}" maxlength="64"></label>
        <label><span>DEFAULT THEME</span><select name="default_theme"><option value="rich-universe"${selected(settings.default_theme ?? 'rich-universe','rich-universe')}>RICH UNIVERSE</option><option value="emerald-night"${selected(settings.default_theme,'emerald-night')}>EMERALD NIGHT</option><option value="gold-cinema"${selected(settings.default_theme,'gold-cinema')}>GOLD CINEMA</option></select></label>
        <label><span>MOTION LEVEL</span><select name="motion_level"><option value="full"${selected(settings.motion_level ?? 'full','full')}>FULL CINEMATIC</option><option value="balanced"${selected(settings.motion_level,'balanced')}>BALANCED</option><option value="reduced"${selected(settings.motion_level,'reduced')}>REDUCED</option></select></label>
        <label><span>ACCENT COLOR</span><input name="accent_color" type="color" value="${esc(settings.accent_color ?? '#31ff63')}"></label>
        <label class="toggle-row"><span><strong>Cinema mode</strong><br>Use full Rich Bizness visual depth.</span><input type="checkbox" name="cinema_mode"${checked(settings.cinema_mode !== false)}></label>
        <label class="toggle-row"><span><strong>TV mode</strong><br>Use expanded layouts on large screens.</span><input type="checkbox" name="tv_mode"${checked(settings.tv_mode === true)}></label>
      </section>
      <section><h2>Profile Design</h2>
        <label><span>BACKGROUND STYLE</span><select name="background_style"><option value="cinematic"${selected(theme.background_style ?? 'cinematic','cinematic')}>CINEMATIC</option><option value="portal"${selected(theme.background_style,'portal')}>PORTAL</option><option value="smoke-cloud"${selected(theme.background_style,'smoke-cloud')}>SMOKE CLOUD</option></select></label>
        <label><span>BANNER OVERLAY</span><select name="banner_overlay"><option value="cinematic"${selected(theme.banner_overlay ?? 'cinematic','cinematic')}>CINEMATIC</option><option value="dark"${selected(theme.banner_overlay,'dark')}>DARK</option><option value="clear"${selected(theme.banner_overlay,'clear')}>CLEAR</option></select></label>
        <label><span>PROFILE LAYOUT</span><select name="profile_layout"><option value="universe"${selected(theme.profile_layout ?? 'universe','universe')}>UNIVERSE</option><option value="creator"${selected(theme.profile_layout,'creator')}>CREATOR</option><option value="compact"${selected(theme.profile_layout,'compact')}>COMPACT</option></select></label>
        <label><span>AVATAR FRAME</span><select name="avatar_frame"><option value="emerald-gold"${selected(theme.avatar_frame ?? 'emerald-gold','emerald-gold')}>EMERALD GOLD</option><option value="diamond"${selected(theme.avatar_frame,'diamond')}>DIAMOND</option><option value="minimal"${selected(theme.avatar_frame,'minimal')}>MINIMAL</option></select></label>
        <label><span>FONT STYLE</span><select name="font_style"><option value="system"${selected(theme.font_style ?? 'system','system')}>SYSTEM ELITE</option><option value="cinematic"${selected(theme.font_style,'cinematic')}>CINEMATIC</option><option value="serif"${selected(theme.font_style,'serif')}>LUXURY SERIF</option></select></label>
        <label><span>BUTTON STYLE</span><select name="button_style"><option value="glass"${selected(theme.button_style ?? 'glass','glass')}>GLASS</option><option value="solid"${selected(theme.button_style,'solid')}>SOLID</option><option value="neon"${selected(theme.button_style,'neon')}>NEON</option></select></label>
        ${[['smoke_fx','Smoke FX','Enable profile atmosphere effects.'],['glow_fx','Glow FX','Enable neon profile lighting.'],['depth_3d','3D depth','Enable layered cinematic profile depth.']].map(([key,title,copy])=>`<label class="toggle-row"><span><strong>${title}</strong><br>${copy}</span><input type="checkbox" name="${key}"${checked((theme as any)[key] !== false)}></label>`).join('')}
      </section>
      <section class="settings-security"><h2>Account & Security</h2><div class="settings-account"><strong>${esc(user.email ?? 'SIGNED-IN ACCOUNT')}</strong><span>Session verified by the shared Supabase Auth bootstrap.</span></div><div class="settings-account-actions"><a class="comm-button" href="${ROUTES.editProfile}">EDIT IDENTITY</a><button id="sessionState" class="comm-button" type="button">SESSION VERIFIED</button><button id="signOut" class="comm-button danger" type="button">SIGN OUT</button></div></section>
      <p id="status" class="status-line" role="status" aria-live="polite"></p><button id="saveButton" class="comm-button primary" type="submit">SAVE UNIVERSE SETTINGS</button>
    </form></div></main>`;

  const form = root.querySelector<HTMLFormElement>('#settingsForm')!;
  const status = root.querySelector<HTMLElement>('#status')!;
  const saveState = root.querySelector<HTMLElement>('#saveState')!;
  const saveButton = root.querySelector<HTMLButtonElement>('#saveButton')!;
  const signOutButton = root.querySelector<HTMLButtonElement>('#signOut')!;
  const sessionButton = root.querySelector<HTMLButtonElement>('#sessionState')!;
  const accentInput = form.elements.namedItem('accent_color') as HTMLInputElement;
  let dirty = false;
  let saving = false;
  let destroyed = false;

  document.documentElement.style.setProperty('--rb-user-accent', accentInput.value);
  accentInput.addEventListener('input', () => document.documentElement.style.setProperty('--rb-user-accent', accentInput.value));
  sessionButton.onclick = () => { status.textContent = `Session verified for ${user.email ?? 'this account'}.`; };
  const markDirty = () => { if (!saving && !destroyed) { dirty = true; saveState.textContent = 'UNSAVED'; status.textContent = ''; } };
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
    saving = true; saveButton.disabled = true; saveState.textContent = 'SAVING'; status.textContent = '';
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
    if (error) { saveState.textContent = 'ERROR'; status.textContent = error.message; }
    else { dirty = false; saveState.textContent = 'SAVED'; status.textContent = 'Universe settings synchronized across Profile, Rich-DM, notifications, privacy, calls, comments, and visual experience.'; }
    saving = false; if (!destroyed) saveButton.disabled = false;
  };

  const cleanup = () => { if (destroyed) return; destroyed = true; window.removeEventListener('beforeunload', guard); };
  window.addEventListener('pagehide', cleanup, { once:true });
}