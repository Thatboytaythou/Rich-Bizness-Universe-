import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';

const destinations = [
  { label: 'LIVE', icon: '◉', href: '/live.html', position: 'top' },
  { label: 'GALLERY', icon: '▣', href: '/gallery.html', position: 'top-left' },
  { label: 'MUSIC', icon: '♪', href: '/music.html', position: 'top-right' },
  { label: 'UPLOAD', icon: '⬆', href: '/upload.html', position: 'left' },
  { label: 'GAMING', icon: '🎮', href: ROUTES.gaming, position: 'right' },
  { label: 'SPORTS', icon: '🏆', href: '/sports.html', position: 'bottom-left' },
  { label: 'META', icon: '◎', href: '/meta.html', position: 'bottom' },
  { label: 'STORE', icon: '🛒', href: '/store.html', position: 'bottom-right' }
] as const;

export async function mountPortalPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const user = getAuthSnapshot().user;
  const identityRoute = user ? ROUTES.profile : ROUTES.tapIn;
  const identityLabel = user ? 'PROFILE' : 'TAP IN';

  app.innerHTML = `
    <main class="portal-stage">
      <div class="portal-noise" aria-hidden="true"></div>
      <div class="portal-glow portal-glow--green" aria-hidden="true"></div>
      <div class="portal-glow portal-glow--gold" aria-hidden="true"></div>

      <header class="portal-topbar">
        <a class="portal-profile" href="${identityRoute}" aria-label="${identityLabel}">
          <span class="portal-profile__avatar">RB</span>
          <span class="portal-profile__copy">
            <small>WELCOME BACK</small>
            <strong>${user?.email?.split('@')[0] ?? 'RICH BIZNESS'}</strong>
          </span>
        </a>

        <div class="portal-brand">
          <small>LLC</small>
          <strong>RICH BIZNESS</strong>
        </div>
      </header>

      <section class="portal-world" aria-label="Rich Bizness Universe portal">
        <div class="portal-orbit portal-orbit--outer" aria-hidden="true"></div>
        <div class="portal-orbit portal-orbit--middle" aria-hidden="true"></div>
        <div class="portal-orbit portal-orbit--inner" aria-hidden="true"></div>

        ${destinations.map(({ label, icon, href, position }) => `
          <a class="portal-node portal-node--${position}" href="${href}" aria-label="Open ${label}">
            <span class="portal-node__icon">${icon}</span>
            <span class="portal-node__label">${label}</span>
          </a>
        `).join('')}

        <a class="portal-core" href="${user ? ROUTES.profile : ROUTES.tapIn}" aria-label="Activate Rich Bizness Universe">
          <span class="portal-core__energy" aria-hidden="true"></span>
          <span class="portal-core__ring portal-core__ring--one" aria-hidden="true"></span>
          <span class="portal-core__ring portal-core__ring--two" aria-hidden="true"></span>
          <span class="portal-core__content">
            <small>RICH BIZNESS LLC</small>
            <strong>ACTIVATE</strong>
            <span>TAP TO ENTER</span>
          </span>
        </a>
      </section>

      <aside class="portal-actions" aria-label="Quick actions">
        <a href="/search.html" aria-label="Search">⌕</a>
        <a href="/messages.html" aria-label="Messages">✦</a>
        <a href="/notifications.html" aria-label="Notifications">◌</a>
        <a href="${identityRoute}" aria-label="${identityLabel}">◎</a>
      </aside>

      <footer class="portal-stats">
        <article><small>BALANCE</small><strong>$0.00</strong></article>
        <article><small>RICH POINTS</small><strong>0</strong></article>
        <article><small>RANK</small><strong>BIZ LEGEND</strong></article>
        <article><small>ONLINE</small><strong>LIVE</strong></article>
      </footer>
    </main>`;
}
