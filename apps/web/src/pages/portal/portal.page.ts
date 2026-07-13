import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';

const destinations = [
  ['LIVE', '/live.html'],
  ['GALLERY', '/gallery.html'],
  ['MUSIC', '/music.html'],
  ['UPLOAD', '/upload.html'],
  ['GAMING', ROUTES.gaming],
  ['SPORTS', '/sports.html'],
  ['META', '/meta.html'],
  ['STORE', '/store.html']
] as const;

export async function mountPortalPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const user = getAuthSnapshot().user;
  app.innerHTML = `
    <main class="portal-shell">
      <header class="topbar">
        <a class="brand" href="${ROUTES.portal}"><span>RB</span><strong>RICH BIZNESS</strong></a>
        <nav><a href="${user ? ROUTES.profile : ROUTES.tapIn}">${user ? 'PROFILE' : 'TAP IN'}</a></nav>
      </header>
      <section class="portal-hero">
        <p class="eyebrow">4K ULTRA CINEMATIC • REALTIME • CREATOR OWNED</p>
        <h1>ENTER THE <em>RICH BIZNESS</em> UNIVERSE.</h1>
        <p>One connected platform for creators, Live, 3D avatars, Meta worlds, commerce, music, sports, social features, and 24 game worlds.</p>
      </section>
      <section class="portal-grid" aria-label="Rich Bizness destinations">
        ${destinations.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
      </section>
    </main>`;
}
