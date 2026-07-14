import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';

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

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char] ?? char));

const money = (cents: number | null | undefined) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2
}).format((cents ?? 0) / 100);

export async function mountPortalPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const user = getAuthSnapshot().user;
  const identityRoute = user ? ROUTES.profile : ROUTES.tapIn;
  const identityLabel = user ? 'PROFILE' : 'TAP IN';
  const { data: profile } = user ? await supabase
    .from('profiles')
    .select('display_name,username,avatar_url,balance_cents,rich_points,rich_level,rank_title,online_status')
    .eq('id', user.id)
    .maybeSingle() : { data: null };

  const name = profile?.display_name ?? profile?.username ?? user?.email?.split('@')[0] ?? 'RICH BIZNESS';
  const avatar = profile?.avatar_url;

  app.innerHTML = `
    <main class="portal-stage">
      <div class="portal-cosmos" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="portal-noise" aria-hidden="true"></div>
      <div class="portal-glow portal-glow--green" aria-hidden="true"></div>
      <div class="portal-glow portal-glow--gold" aria-hidden="true"></div>

      <header class="portal-topbar">
        <a class="portal-profile" href="${identityRoute}" aria-label="${identityLabel}">
          <span class="portal-profile__avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : 'RB'}</span>
          <span class="portal-profile__copy">
            <small>${user ? 'WELCOME BACK' : 'RICH ACCESS'}</small>
            <strong>${esc(name)}</strong>
            <em>${user ? `LEVEL ${profile?.rich_level ?? 1}` : 'TAP IN TO SYNC'}</em>
          </span>
        </a>

        <div class="portal-brand">
          <small>RICH BIZNESS LLC</small>
          <strong>UNIVERSE</strong>
          <span>CREATOR ECOSYSTEM</span>
        </div>
      </header>

      <section class="portal-world" aria-label="Rich Bizness Universe portal">
        <div class="portal-orbit portal-orbit--outer" aria-hidden="true"></div>
        <div class="portal-orbit portal-orbit--middle" aria-hidden="true"></div>
        <div class="portal-orbit portal-orbit--inner" aria-hidden="true"></div>
        <div class="portal-scan" aria-hidden="true"></div>

        ${destinations.map(({ label, icon, href, position }, index) => `
          <a class="portal-node portal-node--${position}" href="${href}" aria-label="Open ${label}" style="--node:${index}">
            <span class="portal-node__halo" aria-hidden="true"></span>
            <span class="portal-node__icon">${icon}</span>
            <span class="portal-node__label">${label}</span>
          </a>
        `).join('')}

        <a class="portal-core" href="${identityRoute}" aria-label="Activate Rich Bizness Universe">
          <span class="portal-core__energy" aria-hidden="true"></span>
          <span class="portal-core__ring portal-core__ring--one" aria-hidden="true"></span>
          <span class="portal-core__ring portal-core__ring--two" aria-hidden="true"></span>
          <span class="portal-core__content">
            <small>RICH BIZNESS LLC</small>
            <strong>${user ? 'ENTER' : 'ACTIVATE'}</strong>
            <span>${user ? 'OPEN YOUR UNIVERSE' : 'TAP TO CREATE YOUR ID'}</span>
          </span>
        </a>
      </section>

      <aside class="portal-actions" aria-label="Quick actions">
        <a href="/search.html" aria-label="Search"><span>⌕</span><small>SEARCH</small></a>
        <a href="/messages.html" aria-label="Messages"><span>✦</span><small>DM</small></a>
        <a href="/notifications.html" aria-label="Notifications"><span>◌</span><small>ALERTS</small></a>
        <a href="${identityRoute}" aria-label="${identityLabel}"><span>◎</span><small>${identityLabel}</small></a>
      </aside>

      <footer class="portal-stats">
        <article><small>BALANCE</small><strong>${money(profile?.balance_cents)}</strong></article>
        <article><small>RICH POINTS</small><strong>${Number(profile?.rich_points ?? 0).toLocaleString()}</strong></article>
        <article><small>RANK</small><strong>${esc(profile?.rank_title ?? 'BIZ LEGEND')}</strong></article>
        <article><small>ONLINE</small><strong>${esc((profile?.online_status ?? (user ? 'LIVE' : 'GUEST')).toUpperCase())}</strong></article>
      </footer>
    </main>`;
}
