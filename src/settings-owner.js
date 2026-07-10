import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity, signOutAndGoHome } from './rb-identity.js?v=identity-owner-2';

const $ = (selector) => document.querySelector(selector);
const fields = ['language','timezone','default_theme','accent_color','motion_level','profile_visibility','dm_privacy','notification_level'];
const metaFields = ['default_upload_route','favorite_start_route'];
const defaults = Object.freeze({
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  default_theme: 'smoke-cloud',
  accent_color: '#9dff63',
  motion_level: 'full',
  profile_visibility: 'public',
  dm_privacy: 'followers',
  notification_level: 'all',
  default_upload_route: 'feed',
  favorite_start_route: '/',
  cinema_mode: true,
  tv_mode: true,
});

let user = null;
let row = {};
let saveFlight = null;
let settingsChannel = null;
let dirty = false;

function status(text, state = 'idle') {
  const el = $('#settingsStatus');
  if (!el) return;
  el.textContent = text;
  el.dataset.state = state;
}

function value(id) {
  const el = $('#' + id);
  return el?.type === 'checkbox' ? !!el.checked : String(el?.value || '').trim();
}

function setValue(id, next) {
  const el = $('#' + id);
  if (!el || next == null) return;
  if (el.type === 'checkbox') el.checked = !!next;
  else el.value = String(next);
}

function safeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : defaults.accent_color;
}

function collect() {
  const data = Object.fromEntries(fields.map((id) => [id, value(id)]));
  data.user_id = user.id;
  data.accent_color = safeColor(data.accent_color);
  data.cinema_mode = value('cinema_mode');
  data.tv_mode = value('tv_mode');
  data.metadata = {
    ...(row.metadata || {}),
    ...Object.fromEntries(metaFields.map((id) => [id, value(id)])),
  };
  return data;
}

function applySettings(next = {}) {
  const metadata = next.metadata || {};
  fields.forEach((id) => setValue(id, next[id] ?? defaults[id]));
  metaFields.forEach((id) => setValue(id, metadata[id] ?? defaults[id]));
  setValue('cinema_mode', next.cinema_mode ?? defaults.cinema_mode);
  setValue('tv_mode', next.tv_mode ?? defaults.tv_mode);
  paint();
}

function paint() {
  const theme = value('default_theme') || defaults.default_theme;
  const motion = value('motion_level') || defaults.motion_level;
  const privacy = value('profile_visibility') || defaults.profile_visibility;
  const accent = safeColor(value('accent_color'));

  $('#setTheme').textContent = theme.split('-')[0];
  $('#setMotion').textContent = motion;
  $('#setPrivacy').textContent = privacy;
  $('#settingsSummary').innerHTML = `
    <article class="card">
      <b>${theme}</b>
      <p>Motion ${motion}, privacy ${privacy}, DMs ${value('dm_privacy')}, alerts ${value('notification_level')}.</p>
      <small>Upload route: ${value('default_upload_route')} • Start: ${value('favorite_start_route')}</small>
    </article>`;

  document.documentElement.dataset.rbTheme = theme;
  document.documentElement.dataset.rbMotion = motion;
  document.documentElement.style.setProperty('--rb-accent-user', accent);
  localStorage.setItem('rb_user_theme', theme);
  localStorage.setItem('rb_user_motion', motion);
  localStorage.setItem('rb_user_accent', accent);
}

async function loadSettings() {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  row = data || {};
  applySettings(row);
  dirty = false;
  status('Settings loaded.', 'ready');
}

async function saveSettings() {
  if (saveFlight) return saveFlight;
  saveFlight = (async () => {
    status('Saving settings...', 'working');
    const payload = collect();
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    row = data;
    applySettings(row);
    dirty = false;
    status('Settings saved.', 'success');
    return row;
  })();

  try {
    return await saveFlight;
  } catch (error) {
    status(error.message || String(error), 'error');
    throw error;
  } finally {
    saveFlight = null;
  }
}

function markDirty() {
  dirty = true;
  paint();
  status('Unsaved changes.', 'dirty');
}

async function resetSettings() {
  if (!user) return;
  row = {};
  applySettings({ metadata: {} });
  dirty = true;
  await saveSettings();
  status('Settings reset.', 'success');
}

function bind() {
  [...fields, ...metaFields, 'cinema_mode', 'tv_mode'].forEach((id) => {
    $('#' + id)?.addEventListener('change', markDirty);
  });

  $('#settingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveSettings().catch(() => null);
  });

  $('#resetSettingsBtn')?.addEventListener('click', () => resetSettings().catch((error) => status(error.message || String(error), 'error')));
  $('#signOutBtn')?.addEventListener('click', () => signOutAndGoHome());

  addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

async function boot() {
  try {
    status('Loading settings...', 'working');
    const state = await getAuthoritativeIdentity();
    user = state.user || null;
    if (!user) {
      location.replace('/auth.html?next=/settings.html');
      return;
    }

    bind();
    await loadSettings();

    settingsChannel = supabase
      .channel('settings-owner-' + user.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: 'user_id=eq.' + user.id,
      }, () => {
        if (!dirty && !saveFlight) loadSettings().catch((error) => status(error.message || String(error), 'error'));
      })
      .subscribe();
  } catch (error) {
    status(error.message || String(error), 'error');
  }
}

addEventListener('pagehide', () => {
  if (settingsChannel) supabase.removeChannel(settingsChannel);
}, { once: true });

boot();
