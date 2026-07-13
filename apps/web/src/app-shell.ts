import { ROUTES } from '@rb/config/routes';

export type AppShellOptions = Readonly<{
  title: string;
  activeRoute?: string;
  showBack?: boolean;
}>;

const NAV_ITEMS = [
  ['Portal', ROUTES.portal],
  ['Feed', ROUTES.feed],
  ['Music', ROUTES.music],
  ['Live', ROUTES.live],
  ['Gaming', ROUTES.gaming],
  ['Profile', ROUTES.profile]
] as const;

export function mountAppShell(root: HTMLElement, options: AppShellOptions): HTMLElement {
  root.innerHTML = `
    <div class="rb-app-shell">
      <header class="rb-topbar">
        ${options.showBack ? '<button type="button" data-action="back" aria-label="Go back">←</button>' : ''}
        <a class="rb-brand" href="${ROUTES.portal}">RICH BIZNESS LLC</a>
        <a class="rb-profile-link" href="${ROUTES.profile}">ME</a>
      </header>
      <main class="rb-page" id="rb-page" tabindex="-1" aria-label="${escapeHtml(options.title)}"></main>
      <nav class="rb-bottom-nav" aria-label="Primary navigation">
        ${NAV_ITEMS.map(([label, href]) => `<a href="${href}"${options.activeRoute === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
    </div>`;

  root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => history.back());
  const page = root.querySelector<HTMLElement>('#rb-page');
  if (!page) throw new Error('Application shell failed to mount');
  return page;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
