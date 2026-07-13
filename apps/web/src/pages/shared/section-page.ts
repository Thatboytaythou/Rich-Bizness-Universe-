import { mountAppShell } from '../../app-shell';
import { supabase } from '../../core/supabase/client';

export type SectionPageConfig = Readonly<{
  title: string;
  route: string;
  table: string;
  section?: string;
  emptyMessage: string;
  columns?: string;
}>;

export async function mountSectionPage(config: SectionPageConfig): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing application root');
  const page = mountAppShell(root, { title: config.title, activeRoute: config.route });
  page.innerHTML = `<section class="rb-section"><header><p>RICH BIZNESS LLC</p><h1>${escapeHtml(config.title)}</h1></header><div data-state="loading">Loading…</div></section>`;

  let query = supabase.from(config.table).select(config.columns ?? '*').order('created_at', { ascending: false }).limit(30);
  if (config.section) query = query.eq('section', config.section);
  const { data, error } = await query;
  const state = page.querySelector<HTMLElement>('[data-state]');
  if (!state) return;

  if (error) {
    state.dataset.state = 'error';
    state.textContent = error.message;
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  state.dataset.state = rows.length ? 'ready' : 'empty';
  state.innerHTML = rows.length
    ? `<div class="rb-card-grid">${rows.map(renderRecord).join('')}</div>`
    : `<div class="rb-empty"><strong>${escapeHtml(config.emptyMessage)}</strong><p>New content will appear here in realtime.</p></div>`;
}

function renderRecord(record: Record<string, unknown>): string {
  const title = String(record.title ?? record.name ?? record.display_name ?? 'Untitled');
  const description = String(record.description ?? record.bio ?? record.caption ?? '');
  const media = String(record.cover_url ?? record.thumbnail_url ?? record.media_url ?? record.image_url ?? '');
  return `<article class="rb-card">${media ? `<img src="${escapeHtml(media)}" alt="" loading="lazy">` : ''}<div><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div></article>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
