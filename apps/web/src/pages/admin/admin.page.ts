import { getAuthSnapshot } from '../../core/auth/auth-store';
import { ROUTES } from '../../core/config/routes';
import { supabase } from '../../core/supabase/client';
import './admin.css';

type Row = Record<string, any>;
type Snapshot = {
  role: Row;
  permissions: { moderate: boolean; users: boolean; platform: boolean; money: boolean };
  reviews: Row[]; reports: Row[]; health: Row[]; jobs: Row[]; requests: Row[]; webhooks: Row[];
  flags: Row[]; announcements: Row[]; audits: Row[]; trust: Row[]; analytics: Row[]; roles: Row[];
  counts: { pending_reviews: number; open_reports: number; failed_jobs: number; failed_webhooks: number; failed_requests: number; tracked_value_cents: number | null };
  generated_at: string;
};

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const when = (value: unknown) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(String(value))) : '';
const cash = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0) / 100);
const dangerStates = new Set(['failed', 'critical', 'rejected', 'escalated', 'open', 'error', 'hidden']);
const warningStates = new Set(['pending', 'queued', 'warning', 'received', 'processing']);
const badge = (value: unknown) => { const text = String(value ?? 'unknown').toLowerCase(); return `<span class="deep-badge ${dangerStates.has(text) ? 'danger' : warningStates.has(text) ? 'warn' : ''}">${esc(text.toUpperCase())}</span>`; };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app');
  if (root.dataset.adminOwner === 'mounted') return;
  root.dataset.adminOwner = 'mounted';

  const user = getAuthSnapshot().user;
  if (!user) { location.replace(`${ROUTES.tapIn}?next=${encodeURIComponent(ROUTES.admin)}`); return; }

  root.innerHTML = `<main class="deep-shell"><div class="deep-wrap">
    <header class="deep-top"><a href="${ROUTES.portal}" aria-label="Back to Portal">←</a><div><p>RICH BIZNESS PLATFORM OPERATIONS</p><h1>Admin Core</h1></div><span id="adminRole" class="deep-live">SECURE</span></header>
    <section class="deep-hero"><div><small>MODERATION • HEALTH • WEBHOOKS • MONEY • TRUST</small><h2>CONTROL THE UNIVERSE</h2><p>One protected command center for platform health, moderation, jobs, webhooks, feature control, analytics, money signals, audit history, roles, and trust.</p><div class="deep-actions"><button id="refresh" class="deep-btn primary" type="button">REFRESH SYSTEM</button><a class="deep-btn" href="${ROUTES.notifications}">ADMIN ALERTS</a><a class="deep-btn" href="${ROUTES.creator}">CREATOR CORE</a></div></div></section>
    <section id="stats" class="deep-stats"></section><nav id="tabs" class="deep-tabs" aria-label="Admin sections"></nav><section id="content"></section><p id="status" class="deep-status" role="status"></p>
  </div></main>`;

  const roleNode = root.querySelector<HTMLElement>('#adminRole')!;
  const stats = root.querySelector<HTMLElement>('#stats')!;
  const tabs = root.querySelector<HTMLElement>('#tabs')!;
  const content = root.querySelector<HTMLElement>('#content')!;
  const status = root.querySelector<HTMLElement>('#status')!;
  const refresh = root.querySelector<HTMLButtonElement>('#refresh')!;

  let snapshot: Snapshot | null = null;
  let lane = 'overview';
  let loading = false;
  let queued = false;
  let destroyed = false;
  let statusTimer: number | undefined;
  let realtimeTimer: number | undefined;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const setStatus = (message: string) => {
    if (destroyed) return;
    status.textContent = message;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { if (!destroyed && status.textContent === message) status.textContent = ''; }, 3500);
  };

  const lanes = [['overview','OVERVIEW'],['moderation','MODERATION'],['systems','SYSTEMS'],['platform','PLATFORM'],['analytics','ANALYTICS + MONEY'],['audit','AUDIT + TRUST'],['roles','ROLES']];
  const renderTabs = () => {
    tabs.innerHTML = lanes.map(([key,label]) => `<button class="deep-tab ${lane === key ? 'active' : ''}" data-lane="${key}" type="button">${label}</button>`).join('');
    tabs.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => button.onclick = () => { lane = button.dataset.lane!; renderTabs(); render(); });
  };

  const render = () => {
    if (!snapshot || destroyed) return;
    const s = snapshot;
    roleNode.textContent = String(s.role.role_label || s.role.role_key || 'SECURE').toUpperCase();
    const failedOps = Number(s.counts.failed_jobs ?? 0) + Number(s.counts.failed_webhooks ?? 0) + Number(s.counts.failed_requests ?? 0);
    stats.innerHTML = `<article><small>PENDING REVIEW</small><strong>${Number(s.counts.pending_reviews ?? 0).toLocaleString()}</strong></article><article><small>OPEN REPORTS</small><strong>${Number(s.counts.open_reports ?? 0).toLocaleString()}</strong></article><article><small>FAILED OPS</small><strong>${failedOps.toLocaleString()}</strong></article><article><small>TRACKED VALUE</small><strong>${s.permissions.money ? cash(s.counts.tracked_value_cents) : 'PROTECTED'}</strong></article>`;

    if (lane === 'overview') {
      const cards = [['Review Queue',s.reviews.length,'content_review_queue'],['Moderation Reports',s.reports.length,'moderation_reports'],['System Checks',s.health.length,'system_health_checks'],['API Jobs',s.jobs.length,'api_jobs'],['Webhook Events',s.webhooks.length,'api_webhook_events'],['API Requests',s.requests.length,'api_request_logs'],['Analytics Events',s.analytics.length,'platform_analytics_events'],['Feature Flags',s.flags.length,'feature_flags'],['Audit Logs',s.audits.length,'admin_audit_logs'],['Admin Roles',s.roles.length,'admin_roles']];
      content.innerHTML = `<section class="deep-grid">${cards.map(([title,count,source]) => `<article class="deep-card"><div class="deep-card-body"><span class="deep-badge">${esc(source)}</span><h3>${esc(title)}</h3><p>${Number(count).toLocaleString()} secured records loaded</p></div></article>`).join('')}</section>`;
    } else if (lane === 'moderation') {
      content.innerHTML = `<section class="deep-section"><header><div><small>CONTENT REVIEW</small><h2>Moderation queue</h2></div></header><div class="deep-list">${s.reviews.length ? s.reviews.map((row) => `<article><div><h3>${esc(row.review_type || row.target_table || 'Content review')}</h3><p>${esc(row.flagged_reason || row.admin_note || row.target_id)} · ${when(row.created_at)}</p></div><div class="deep-actions">${badge(row.status || 'pending')}${s.permissions.moderate ? `<button class="deep-btn" data-review="approved" data-id="${row.id}" type="button">APPROVE</button><button class="deep-btn deep-danger" data-review="rejected" data-id="${row.id}" type="button">REJECT</button>` : ''}</div></article>`).join('') : '<div class="deep-empty">Review queue clear.</div>'}</div></section><section class="deep-section"><header><div><small>USER REPORTS</small><h2>Moderation reports</h2></div></header><div class="deep-list">${s.reports.length ? s.reports.map((row) => `<article><div><h3>${esc(row.reason || 'Report')}</h3><p>${esc(row.details || row.target_table || '')} · priority ${esc(row.priority || 'normal')} · ${when(row.created_at)}</p></div>${badge(row.status || 'open')}</article>`).join('') : '<div class="deep-empty">No active reports.</div>'}</div></section>`;
    } else if (lane === 'systems') {
      const operations = [...s.jobs.map((row) => ({ title: row.job_type, subtitle: `${row.error_message || row.target_table || ''} · attempts ${row.attempts ?? 0}/${row.max_attempts ?? 0}`, state: row.status, time: row.created_at })), ...s.webhooks.map((row) => ({ title: `${row.provider}: ${row.event_type}`, subtitle: row.error_message || row.event_id, state: row.status, time: row.created_at }))];
      content.innerHTML = `<section class="deep-section"><header><div><small>SERVICE HEALTH</small><h2>System checks</h2></div></header><div class="deep-list">${s.health.map((row) => `<article><div><h3>${esc(row.service)}</h3><p>${esc(row.message || 'No message')} · ${row.latency_ms ?? 0}ms · ${when(row.checked_at)}</p></div>${badge(row.status)}</article>`).join('') || '<div class="deep-empty">No health data.</div>'}</div></section><section class="deep-section"><header><div><small>PROCESSING</small><h2>Jobs + webhooks</h2></div></header><div class="deep-list">${operations.map((row) => `<article><div><h3>${esc(row.title)}</h3><p>${esc(row.subtitle)} · ${when(row.time)}</p></div>${badge(row.state)}</article>`).join('') || '<div class="deep-empty">No jobs or webhook events.</div>'}</div></section>`;
    } else if (lane === 'platform') {
      content.innerHTML = `<section class="deep-section"><header><div><small>FEATURE CONTROL</small><h2>Flags</h2></div></header><div class="deep-list">${s.flags.map((row) => `<article><div><h3>${esc(row.title || row.flag_key)}</h3><p>${esc(row.description || row.section || 'global')} · rollout ${row.rollout_percent ?? 100}%</p></div>${s.permissions.platform ? `<button class="deep-btn ${row.is_enabled ? 'primary' : ''}" data-flag="${row.id}" data-enabled="${String(!row.is_enabled)}" type="button">${row.is_enabled ? 'ENABLED' : 'DISABLED'}</button>` : badge(row.is_enabled ? 'enabled' : 'disabled')}</article>`).join('') || '<div class="deep-empty">No feature flags.</div>'}</div></section><section class="deep-section"><header><div><small>ANNOUNCEMENTS</small><h2>Platform broadcasts</h2></div></header><div class="deep-list">${s.announcements.map((row) => `<article><div><h3>${esc(row.emoji || '')} ${esc(row.title)}</h3><p>${esc(row.body || '')} · ${esc(row.target_section || 'global')}</p></div>${badge(row.is_active ? 'active' : 'inactive')}</article>`).join('') || '<div class="deep-empty">No announcements.</div>'}</div></section>`;
    } else if (lane === 'analytics') {
      const average = s.requests.length ? Math.round(s.requests.reduce((sum,row) => sum + Number(row.latency_ms ?? 0), 0) / s.requests.length) : 0;
      content.innerHTML = `<section class="deep-stats"><article><small>EVENTS</small><strong>${s.analytics.length}</strong></article><article><small>VALUE SIGNAL</small><strong>${s.permissions.money ? cash(s.counts.tracked_value_cents) : 'PROTECTED'}</strong></article><article><small>API ERRORS</small><strong>${Number(s.counts.failed_requests ?? 0)}</strong></article><article><small>AVG LATENCY</small><strong>${average}ms</strong></article></section><section class="deep-section"><header><div><small>PLATFORM ANALYTICS</small><h2>Recent events</h2></div></header><div class="deep-list">${s.analytics.map((row) => `<article><div><h3>${esc(row.event_name)}</h3><p>${esc(row.section || row.route || 'platform')} · ${esc(row.device_type || row.platform || 'unknown')} · ${when(row.created_at)}</p></div><strong>${s.permissions.money && row.value_cents ? cash(row.value_cents) : esc(row.target_table || '')}</strong></article>`).join('') || '<div class="deep-empty">No analytics events.</div>'}</div></section>`;
    } else if (lane === 'audit') {
      content.innerHTML = `<section class="deep-section"><header><div><small>ADMIN AUDIT</small><h2>Recent actions</h2></div></header><div class="deep-list">${s.audits.map((row) => `<article><div><h3>${esc(row.action)}</h3><p>${esc(row.target_table || 'platform')} · ${when(row.created_at)}</p></div>${badge(row.severity || 'normal')}</article>`).join('') || '<div class="deep-empty">No audit records.</div>'}</div></section><section class="deep-section"><header><div><small>TRUST NETWORK</small><h2>Trust events</h2></div></header><div class="deep-list">${s.trust.map((row) => `<article><div><h3>${esc(row.event_type)}</h3><p>${esc(row.reason || row.target_table || '')} · ${when(row.created_at)}</p></div><strong class="${Number(row.score_delta) < 0 ? 'deep-danger' : ''}">${Number(row.score_delta) > 0 ? '+' : ''}${row.score_delta ?? 0}</strong></article>`).join('') || '<div class="deep-empty">No trust events.</div>'}</div></section>`;
    } else {
      content.innerHTML = `<section class="deep-section"><header><div><small>ADMIN RBAC</small><h2>Roles and permissions</h2></div></header><div class="deep-list">${s.roles.map((row) => `<article><div><h3>${esc(row.role_label || row.role_key)}</h3><p>Level ${row.permission_level ?? 0} · moderate ${row.can_moderate ? 'yes' : 'no'} · users ${row.can_manage_users ? 'yes' : 'no'} · money ${row.can_manage_money ? 'yes' : 'no'} · platform ${row.can_manage_platform ? 'yes' : 'no'}</p></div>${badge(row.is_active ? 'active' : 'inactive')}</article>`).join('') || '<div class="deep-empty">No admin roles.</div>'}</div></section>`;
    }

    content.querySelectorAll<HTMLButtonElement>('[data-review]').forEach((button) => button.onclick = async () => {
      if (!snapshot?.permissions.moderate) return;
      const decision = button.dataset.review!;
      if (!confirm(`${decision.toUpperCase()} THIS REVIEW?`)) return;
      button.disabled = true;
      const { error } = await supabase.rpc('rb_admin_action', { p_action: 'review_decision', p_target_id: button.dataset.id, p_value: { status: decision } });
      if (error) setStatus(error.message); else { setStatus(`REVIEW ${decision.toUpperCase()}`); await load(); }
      button.disabled = false;
    });

    content.querySelectorAll<HTMLButtonElement>('[data-flag]').forEach((button) => button.onclick = async () => {
      if (!snapshot?.permissions.platform) return;
      const enabled = button.dataset.enabled === 'true';
      if (!confirm(`${enabled ? 'ENABLE' : 'DISABLE'} THIS FEATURE FLAG?`)) return;
      button.disabled = true;
      const { error } = await supabase.rpc('rb_admin_action', { p_action: 'feature_flag', p_target_id: button.dataset.flag, p_value: { enabled } });
      if (error) setStatus(error.message); else { setStatus(`FEATURE FLAG ${enabled ? 'ENABLED' : 'DISABLED'}`); await load(); }
      button.disabled = false;
    });
  };

  const load = async (): Promise<void> => {
    if (destroyed) return;
    if (loading) { queued = true; return; }
    loading = true;
    refresh.disabled = true;
    setStatus('SYNCING ADMIN CORE…');
    try {
      const { data, error } = await supabase.rpc('rb_admin_snapshot', { p_limit: 100 });
      if (error) throw error;
      snapshot = data as Snapshot;
      renderTabs();
      render();
      setStatus(`SYSTEM VERIFIED · ${when(snapshot.generated_at)}`);
    } catch (caught) {
      root.innerHTML = `<main class="deep-shell"><div class="deep-wrap"><header class="deep-top"><a href="${ROUTES.portal}">←</a><div><p>RICH BIZNESS SECURITY</p><h1>Restricted</h1></div></header><section class="deep-hero"><div><small>ADMIN ACCESS REQUIRED</small><h2>FOUNDER GATE</h2><p>${esc(caught instanceof Error ? caught.message : 'This command center is protected by server-owned roles and permission levels.')}</p></div></section></div></main>`;
    } finally {
      loading = false;
      refresh.disabled = false;
      if (queued && !destroyed) { queued = false; await load(); }
    }
  };

  refresh.onclick = () => void load();
  await load();

  const scheduleReload = () => {
    if (destroyed) return;
    if (realtimeTimer) clearTimeout(realtimeTimer);
    realtimeTimer = window.setTimeout(() => void load(), 350);
  };

  channel = supabase.channel(`admin-core:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'content_review_queue' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moderation_reports' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'api_jobs' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'api_webhook_events' }, scheduleReload)
    .subscribe();

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    if (statusTimer) clearTimeout(statusTimer);
    if (realtimeTimer) clearTimeout(realtimeTimer);
    if (channel) void supabase.removeChannel(channel);
    delete root.dataset.adminOwner;
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}