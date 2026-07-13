import { supabase } from '../../core/supabase/client';
import './notifications.css';

type NotificationRow = {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  emoji: string | null;
  priority: string | null;
  is_read: boolean | null;
  action_label: string | null;
  action_url: string | null;
  target_url: string | null;
  created_at: string | null;
};

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c] ?? c);

function safePath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function renderItem(item: NotificationRow): string {
  const href = safePath(item.action_url) ?? safePath(item.target_url);
  return `<article class="notice-card${item.is_read ? '' : ' is-unread'}" data-id="${item.id}">
    <div class="notice-icon">${esc(item.emoji) || '💨'}</div>
    <div class="notice-copy">
      <div class="notice-meta"><span>${esc(item.type ?? 'alert').toUpperCase()}</span><time>${item.created_at ? new Date(item.created_at).toLocaleString() : ''}</time></div>
      <h2>${esc(item.title ?? 'Rich Bizness alert')}</h2>
      <p>${esc(item.body)}</p>
      ${href ? `<a href="${href}">${esc(item.action_label ?? 'OPEN')}</a>` : ''}
    </div>
    ${item.is_read ? '' : '<button class="mark-read" type="button">MARK READ</button>'}
  </article>`;
}

export async function mount(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) throw new Error('Missing #app mount');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace(`/tap-in.html?next=${encodeURIComponent('/notifications.html')}`); return; }

  app.innerHTML = `<main class="notice-shell"><header><a href="/">← PORTAL</a><div><p>RICH ALERTS</p><h1>Notifications</h1></div><button id="markAll" type="button">MARK ALL READ</button></header><section id="noticeList" class="notice-list" aria-live="polite"></section></main>`;
  const list = document.querySelector<HTMLElement>('#noticeList');
  const markAll = document.querySelector<HTMLButtonElement>('#markAll');
  if (!list || !markAll) throw new Error('Notifications failed to mount');

  const load = async () => {
    const { data, error } = await supabase.from('rich_notifications').select('id,type,title,body,emoji,priority,is_read,action_label,action_url,target_url,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data ?? []) as NotificationRow[];
    list.innerHTML = rows.length ? rows.map(renderItem).join('') : '<div class="notice-empty">No alerts yet.</div>';
  };

  list.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.mark-read');
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (!button || !card) return;
    button.disabled = true;
    const { error } = await supabase.from('rich_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', card.dataset.id!).eq('user_id', session.user.id);
    if (!error) await load(); else button.disabled = false;
  });

  markAll.addEventListener('click', async () => {
    markAll.disabled = true;
    await supabase.from('rich_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', session.user.id).eq('is_read', false);
    await load();
    markAll.disabled = false;
  });

  await load();
  const channel = supabase.channel(`notifications:${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'rich_notifications', filter: `user_id=eq.${session.user.id}` }, load).subscribe();
  window.addEventListener('pagehide', () => { void supabase.removeChannel(channel); }, { once: true });
}
