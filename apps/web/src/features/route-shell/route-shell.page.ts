import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';

const LABELS: Record<string, string> = {
  'edit-profile': 'EDIT PROFILE',
  settings: 'SETTINGS',
  notifications: 'NOTIFICATIONS',
  messages: 'MESSAGES',
  search: 'SEARCH',
  upload: 'UPLOAD',
  watch: 'WATCH',
  avatar: 'AVATAR LAB'
};

async function loadCount(page: string, userId: string): Promise<number | null> {
  const targets: Record<string, { table: string; column: string }> = {
    notifications: { table: 'rich_notifications', column: 'user_id' },
    messages: { table: 'dm_thread_members', column: 'user_id' },
    upload: { table: 'uploads', column: 'user_id' },
    avatar: { table: 'meta_avatars', column: 'user_id' }
  };
  const target = targets[page];
  if (!target) return null;
  const { count, error } = await supabase
    .from(target.table)
    .select('*', { count: 'exact', head: true })
    .eq(target.column, userId);
  if (error) return null;
  return count ?? 0;
}

export async function mount(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const page = document.body.dataset.page ?? 'feature';
  const user = getAuthSnapshot().user;
  if (!user) {
    location.replace(`${ROUTES.tapIn}?next=${encodeURIComponent(location.pathname)}`);
    return;
  }

  const count = await loadCount(page, user.id);
  const label = LABELS[page] ?? page.toUpperCase();

  app.innerHTML = `
    <main class="rb-shell route-shell">
      <header class="route-shell__header">
        <a href="${ROUTES.portal}" class="route-shell__back">← PORTAL</a>
        <span>RICH BIZNESS LLC</span>
      </header>
      <section class="rb-panel route-shell__panel">
        <p class="route-shell__eyebrow">CONNECTED • AUTHENTICATED • REALTIME READY</p>
        <h1>${label}</h1>
        <p class="route-shell__copy">This route is connected to the shared app shell and the active Supabase session.</p>
        ${count === null ? '' : `<strong class="route-shell__count">${count}</strong>`}
        <nav class="route-shell__nav">
          <a href="${ROUTES.profile}">PROFILE</a>
          <a href="${ROUTES.messages}">MESSAGES</a>
          <a href="${ROUTES.notifications}">ALERTS</a>
          <a href="${ROUTES.upload}">UPLOAD</a>
        </nav>
      </section>
    </main>`;
}
