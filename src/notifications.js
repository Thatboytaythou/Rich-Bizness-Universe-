import { supabase } from './supabase-client.js';
import { getSessionUser } from './rb-identity.js?v=identity-owner-2';

const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

let user = null;
let alerts = [];
let alertsChannel = null;
let loadFlight = null;
let refreshTimer = null;
let deviceRegistered = false;

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = String(value ?? '');
}

function safeRoute(value) {
  if (!value) return '';
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : '';
  } catch {
    return '';
  }
}

function alertCard(row) {
  const group = row.group || {};
  const icon = esc(row.emoji || group.icon || '🔔');
  const title = esc(row.title || row.type || group.title || 'Rich Alert');
  const body = esc(row.body || group.description || 'Rich Bizness activity.');
  const category = esc(group.title || row.target_type || row.target_table || 'activity');
  const priority = esc(row.priority || 'normal');
  const route = safeRoute(row.action_url || row.target_url);
  const state = row.is_read ? 'READ' : 'NEW';

  return `<article class="card${row.is_read ? '' : ' hot'}" data-alert="${esc(row.id)}">
    <b>${icon} ${title}</b>
    <p>${body}</p>
    <small>${state} • ${priority} • ${category}</small>
    <p class="identity-buttons">
      ${row.is_read ? '' : `<button class="identity-pill" type="button" data-read="${esc(row.id)}">MARK READ</button>`}
      ${route ? `<a class="identity-pill primary" href="${esc(route)}">${esc(row.action_label || 'OPEN')}</a>` : ''}
    </p>
  </article>`;
}

function render() {
  const unread = alerts.filter((row) => !row.is_read).length;
  setText('#recordCount', alerts.length.toLocaleString());
  setText('#unreadCount', unread.toLocaleString());

  const markAll = $('#markAllRead');
  if (markAll) markAll.disabled = unread === 0;

  const container = $('#sectionCards');
  if (container) {
    container.innerHTML = alerts.length
      ? alerts.map(alertCard).join('')
      : '<div class="empty">No alerts yet.</div>';
  }
}

function deviceToken() {
  let token = localStorage.getItem('rb_push_device_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('rb_push_device_token', token);
  }
  return token;
}

async function registerDevice() {
  if (!user || deviceRegistered) return;
  deviceRegistered = true;

  const payload = {
    user_id: user.id,
    device_token: deviceToken(),
    device_type: innerWidth < 768 ? 'mobile' : 'desktop',
    platform: navigator.platform || 'web',
    device_name: navigator.userAgent.slice(0, 120),
    is_active: true,
    last_seen_at: new Date().toISOString(),
    metadata: { source: 'notifications-page' },
  };

  const { error } = await supabase
    .from('push_devices')
    .upsert(payload, { onConflict: 'user_id,device_token' });

  setText('#deviceState', error ? 'OFF' : 'ON');
}

async function loadAlerts() {
  if (loadFlight) return loadFlight;

  loadFlight = (async () => {
    const { data, error } = await supabase
      .from('rich_notifications')
      .select('*,group:notification_groups(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) throw error;
    alerts = data || [];
    render();
  })();

  try {
    return await loadFlight;
  } finally {
    loadFlight = null;
  }
}

async function markRead(id) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('rich_notifications')
    .update({ is_read: true, is_seen: true, read_at: now, seen_at: now })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;

  await supabase
    .from('notification_reads')
    .upsert({ notification_id: id, user_id: user.id, read_at: now }, { onConflict: 'notification_id,user_id' });

  alerts = alerts.map((row) => row.id === id ? { ...row, is_read: true, is_seen: true, read_at: now, seen_at: now } : row);
  render();
}

async function markAllRead() {
  const unreadIds = alerts.filter((row) => !row.is_read).map((row) => row.id);
  if (!unreadIds.length) return;

  const button = $('#markAllRead');
  if (button) button.disabled = true;
  const now = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('rich_notifications')
      .update({ is_read: true, is_seen: true, read_at: now, seen_at: now })
      .eq('user_id', user.id)
      .in('id', unreadIds);
    if (error) throw error;

    await supabase.from('notification_reads').upsert(
      unreadIds.map((notificationId) => ({ notification_id: notificationId, user_id: user.id, read_at: now })),
      { onConflict: 'notification_id,user_id' },
    );

    alerts = alerts.map((row) => ({ ...row, is_read: true, is_seen: true, read_at: now, seen_at: now }));
    render();
  } finally {
    if (button) button.disabled = false;
  }
}

function scheduleLoad() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => loadAlerts().catch((error) => {
    const container = $('#sectionCards');
    if (container) container.innerHTML = `<div class="empty">${esc(error.message || error)}</div>`;
  }), 150);
}

async function boot() {
  user = await getSessionUser();
  if (!user) {
    location.replace('/auth.html?next=/notifications.html');
    return;
  }

  await Promise.all([registerDevice(), loadAlerts()]);

  alertsChannel = supabase
    .channel(`rich-alerts-${user.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'rich_notifications',
      filter: `user_id=eq.${user.id}`,
    }, scheduleLoad)
    .subscribe();
}

document.addEventListener('click', (event) => {
  const readButton = event.target.closest('[data-read]');
  if (readButton) {
    readButton.disabled = true;
    markRead(readButton.dataset.read).catch((error) => {
      readButton.disabled = false;
      console.warn('[Rich Alerts]', error);
    });
  }
});

$('#markAllRead')?.addEventListener('click', () => markAllRead().catch((error) => console.warn('[Rich Alerts]', error)));

addEventListener('pagehide', () => {
  clearTimeout(refreshTimer);
  if (alertsChannel) supabase.removeChannel(alertsChannel);
}, { once: true });

boot().catch((error) => {
  const container = $('#sectionCards');
  if (container) container.innerHTML = `<div class="empty">${esc(error.message || error)}</div>`;
});
