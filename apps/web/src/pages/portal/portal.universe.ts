import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { mountPortalMotion } from './portal.motion';
import './portal.motion.css';

type JsonMap = Record<string, unknown>;
type PortalSnapshot = {
  profile?: JsonMap;
  level?: JsonMap;
  avatar?: JsonMap;
  announcement?: JsonMap;
  unread_notifications?: number;
  unread_threads?: number;
};

const destinations = [
  ['LIVE', '◉', '/live.html', 'top'],
  ['GALLERY', '▣', '/gallery.html', 'top-left'],
  ['MUSIC', '♪', '/music.html', 'top-right'],
  ['UPLOAD', '⬆', '/upload.html', 'left'],
  ['GAMING', '🎮', ROUTES.gaming, 'right'],
  ['SPORTS', '🏆', '/sports.html', 'bottom-left'],
  ['META', '◎', '/meta.html', 'bottom'],
  ['STORE', '🛒', '/store.html', 'bottom-right']
] as const;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] ?? character));

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2
}).format(Number(value ?? 0) / 100);

export async function mountPortalPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const user = getAuthSnapshot().user;
  let snapshot: PortalSnapshot = {};
  if (user) {
    const { data } = await supabase.rpc('rb_portal_universe_snapshot', {});
    snapshot = (data ?? {}) as PortalSnapshot;
  }

  const profile = snapshot.profile ?? {};
  const level = snapshot.level ?? {};
  const avatar = snapshot.avatar ?? {};
  const announcement = snapshot.announcement ?? {};
  const identityRoute = user ? ROUTES.profile : ROUTES.tapIn;
  const name = String(profile.display_name ?? profile.username ?? avatar.display_name ?? user?.email?.split('@')[0] ?? 'RICH BIZNESS');
  const avatarUrl = String(profile.avatar_url ?? avatar.avatar_url ?? '');
  const richLevel = Number(level.level ?? profile.rich_level ?? avatar.level ?? 1);
  const xpCurrent = Number(level.xp_current ?? 0);
  const xpNext = Math.max(1, Number(level.xp_next ?? 100));

  app.innerHTML = `
    <main class="portal-stage portal-stage--motion">
      <canvas id="portalMotionCanvas" class="portal-motion-canvas" aria-hidden="true"></canvas>
      <div class="portal-backdrop" aria-hidden="true"></div>
      <div class="portal-grid" aria-hidden="true"></div>
      <div class="portal-cosmos" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="portal-noise" aria-hidden="true"></div>
      <div class="portal-glow portal-glow--green" aria-hidden="true"></div>
      <div class="portal-glow portal-glow--gold" aria-hidden="true"></div>

      <header class="portal-topbar">
        <a class="portal-profile" href="${identityRoute}">
          <span class="portal-profile__avatar">${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="">` : 'RB'}<i></i></span>
          <span class="portal-profile__copy"><small>${user ? 'WELCOME BACK' : 'RICH ACCESS'}</small><strong>${esc(name)}</strong><em>${user ? `LEVEL ${richLevel}` : 'TAP IN TO SYNC'}</em></span>
        </a>
        <div class="portal-brand"><small>RICH BIZNESS LLC</small><strong>UNIVERSE</strong><span>MOTION PORTAL SYSTEM</span></div>
      </header>

      ${announcement.title ? `<a class="portal-announcement" href="${esc(announcement.action_url ?? announcement.target_url ?? '#')}"><span>${esc(announcement.emoji ?? '✦')}</span><div><small>${esc(announcement.priority ?? 'UPDATE')}</small><strong>${esc(announcement.title)}</strong></div><i>OPEN</i></a>` : ''}

      <section class="portal-world" aria-label="Rich Bizness Universe portal">
        <div class="portal-depth" aria-hidden="true">
          <div class="portal-orbit portal-orbit--outer"></div><div class="portal-orbit portal-orbit--middle"></div><div class="portal-orbit portal-orbit--inner"></div><div class="portal-scan"></div><div class="portal-energy-lines"></div>
        </div>
        ${destinations.map(([label, icon, href, position], index) => `<a class="portal-node portal-node--${position}" href="${href}" style="--node:${index};--delay:${index * 0.12}s"><span class="portal-node__trail"></span><span class="portal-node__halo"></span><span class="portal-node__icon">${icon}</span><span class="portal-node__label">${label}</span><small>ENTER</small></a>`).join('')}
        <a class="portal-core" href="${identityRoute}"><span class="portal-core__energy"></span><span class="portal-core__ring portal-core__ring--one"></span><span class="portal-core__ring portal-core__ring--two"></span><span class="portal-core__ring portal-core__ring--three"></span><span class="portal-core__content"><small>RICH BIZNESS LLC</small><strong>${user ? 'ENTER' : 'ACTIVATE'}</strong><span>${user ? 'OPEN YOUR UNIVERSE' : 'CREATE YOUR RICH ID'}</span><b>${user ? `${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()} XP` : 'TAP TO BEGIN'}</b></span></a>
      </section>

      <aside class="portal-actions">
        <a href="/search.html"><span>⌕</span><small>SEARCH</small></a>
        <a href="/messages.html"><span>✦</span><small>DM</small>${Number(snapshot.unread_threads ?? 0) ? `<b>${snapshot.unread_threads}</b>` : ''}</a>
        <a href="/notifications.html"><span>◌</span><small>ALERTS</small>${Number(snapshot.unread_notifications ?? 0) ? `<b>${snapshot.unread_notifications}</b>` : ''}</a>
        <a href="${identityRoute}"><span>◎</span><small>${user ? 'PROFILE' : 'TAP IN'}</small></a>
      </aside>

      <footer class="portal-stats">
        <article><small>BALANCE</small><strong>${money(profile.balance_cents)}</strong></article>
        <article><small>RICH POINTS</small><strong>${Number(level.rich_points ?? profile.rich_points ?? 0).toLocaleString()}</strong></article>
        <article><small>RANK</small><strong>${esc(level.rank_title ?? profile.rank_title ?? 'BIZ LEGEND')}</strong></article>
        <article><small>ONLINE</small><strong>${esc(String(profile.online_status ?? (user ? 'LIVE' : 'GUEST')).toUpperCase())}</strong></article>
      </footer>
    </main>`;

  mountPortalMotion({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
}
