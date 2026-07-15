import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { mountPortalMotion } from './portal.motion';
import './portal.motion.css';
import './portal.overdrive.css';
import './portal.index-fix.css';

type JsonMap = Record<string, unknown>;
type Activity = { kind?: string; title?: string; href?: string };
type PortalSnapshot = {
  profile?: JsonMap;
  level?: JsonMap;
  avatar?: JsonMap;
  theme?: JsonMap;
  settings?: JsonMap;
  announcement?: JsonMap;
  background?: JsonMap;
  layout?: JsonMap;
  section_pulse?: Record<string, number>;
  recent_activity?: Activity[];
  unread_notifications?: number;
  unread_threads?: number;
};

type Destination = {
  key: string;
  label: string;
  icon: string;
  href: string;
  position: string;
  kicker: string;
};

const destinations: Destination[] = [
  { key: 'live', label: 'LIVE', icon: '◉', href: '/live.html', position: 'top', kicker: 'BROADCAST' },
  { key: 'gallery', label: 'GALLERY', icon: '▣', href: '/gallery.html', position: 'top-left', kicker: 'VISUALS' },
  { key: 'music', label: 'MUSIC', icon: '♪', href: '/music.html', position: 'top-right', kicker: 'AUDIO' },
  { key: 'upload', label: 'UPLOAD', icon: '⬆', href: '/upload.html', position: 'left', kicker: 'CREATE' },
  { key: 'gaming', label: 'GAMING', icon: '🎮', href: ROUTES.gaming, position: 'right', kicker: 'PLAY' },
  { key: 'sports', label: 'SPORTS', icon: '🏆', href: '/sports.html', position: 'bottom-left', kicker: 'ARENA' },
  { key: 'meta', label: 'META', icon: '◎', href: '/meta.html', position: 'bottom', kicker: 'WORLDS' },
  { key: 'store', label: 'STORE', icon: '🛒', href: '/store.html', position: 'bottom-right', kicker: 'MARKET' }
];

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] ?? character));

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2
}).format(Number(value ?? 0) / 100);

const safeUrl = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('https://')) return raw;
  return '';
};

export async function mountPortalPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const user = getAuthSnapshot().user;
  let snapshot: PortalSnapshot = {};
  if (user) {
    const { data, error } = await supabase.rpc('rb_portal_elite_snapshot', {});
    if (!error) snapshot = (data ?? {}) as PortalSnapshot;
  }

  const profile = snapshot.profile ?? {};
  const level = snapshot.level ?? {};
  const avatar = snapshot.avatar ?? {};
  const theme = snapshot.theme ?? {};
  const settings = snapshot.settings ?? {};
  const announcement = snapshot.announcement ?? {};
  const background = snapshot.background ?? {};
  const pulse = snapshot.section_pulse ?? {};
  const recent = Array.isArray(snapshot.recent_activity) ? snapshot.recent_activity.slice(0, 5) : [];

  const identityRoute = user ? ROUTES.profile : ROUTES.tapIn;
  const name = String(profile.display_name ?? profile.username ?? avatar.display_name ?? user?.email?.split('@')[0] ?? 'RICH BIZNESS');
  const avatarUrl = safeUrl(profile.avatar_url ?? avatar.avatar_url);
  const backgroundUrl = safeUrl(theme.background_url ?? background.background_url);
  const accent = String(settings.accent_color ?? '#31ff63');
  const richLevel = Number(level.level ?? profile.rich_level ?? avatar.level ?? 1);
  const xpCurrent = Number(level.xp_current ?? 0);
  const xpNext = Math.max(1, Number(level.xp_next ?? 100));
  const xpPercent = Math.min(100, Math.max(0, (xpCurrent / xpNext) * 100));
  const motionLevel = String(settings.motion_level ?? 'full').toLowerCase();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || motionLevel === 'reduced' || motionLevel === 'off';

  app.innerHTML = `
    <main class="portal-stage portal-stage--elite" style="--portal-accent:${esc(accent)};${backgroundUrl ? `--portal-bg:url('${esc(backgroundUrl)}');` : ''}">
      <canvas id="portalMotionCanvas" class="portal-motion-canvas" aria-hidden="true"></canvas>
      <div class="portal-bg" aria-hidden="true"></div>
      <div class="portal-vignette" aria-hidden="true"></div>
      <div class="portal-grid" aria-hidden="true"></div>
      <div class="portal-nebula" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="portal-stars" aria-hidden="true">${Array.from({ length: 28 }, (_, index) => `<i style="--star:${index}"></i>`).join('')}</div>

      <header class="portal-topbar">
        <a class="portal-profile" href="${identityRoute}" aria-label="Open ${user ? 'profile' : 'Tap In'}">
          <span class="portal-profile__avatar">${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="">` : 'RB'}<i></i></span>
          <span class="portal-profile__copy">
            <small>${user ? 'WELCOME BACK' : 'RICH ACCESS'}</small>
            <strong>${esc(name)}</strong>
            <em>${user ? `LEVEL ${richLevel}` : 'TAP IN TO SYNC'}</em>
          </span>
        </a>
        <div class="portal-brand" aria-label="Rich Bizness Universe">
          <small>RICH BIZNESS LLC</small>
          <strong>UNIVERSE</strong>
          <span>GLOBAL CREATOR OPERATING SYSTEM</span>
        </div>
      </header>

      ${announcement.title ? `<a class="portal-announcement" href="${esc(safeUrl(announcement.action_url ?? announcement.target_url) || '#')}"><span>${esc(announcement.emoji ?? '✦')}</span><div><small>${esc(announcement.priority ?? 'UPDATE')}</small><strong>${esc(announcement.title)}</strong></div><i>OPEN</i></a>` : ''}

      <section class="portal-world" aria-label="Rich Bizness Universe portal">
        <div class="portal-horizon" aria-hidden="true"></div>
        <div class="portal-orbit-system" aria-hidden="true">
          <div class="portal-orbit portal-orbit--outer"></div>
          <div class="portal-orbit portal-orbit--middle"></div>
          <div class="portal-orbit portal-orbit--inner"></div>
          <div class="portal-orbit portal-orbit--ticks"></div>
          <div class="portal-orbit portal-orbit--signal"></div>
          <div class="portal-beam portal-beam--green"></div>
          <div class="portal-beam portal-beam--gold"></div>
          <div class="portal-scan"></div>
        </div>

        <div class="portal-route-layer">
          ${destinations.map((destination, index) => {
            const count = Number(pulse[destination.key] ?? 0);
            return `<a class="portal-node portal-node--${destination.position}" href="${destination.href}" style="--node:${index};--delay:${index * 0.1}s" aria-label="Open ${destination.label}">
              <span class="portal-node__aura" aria-hidden="true"></span>
              <span class="portal-node__icon">${destination.icon}</span>
              <span class="portal-node__copy"><small>${destination.kicker}</small><strong>${destination.label}</strong></span>
              <b data-count="${count}">${count > 999 ? '999+' : count}</b>
            </a>`;
          }).join('')}
        </div>

        <a class="portal-core" href="${identityRoute}" aria-label="${user ? 'Enter your universe' : 'Create your Rich ID'}">
          <span class="portal-core__halo" aria-hidden="true"></span>
          <span class="portal-core__ring portal-core__ring--one" aria-hidden="true"></span>
          <span class="portal-core__ring portal-core__ring--two" aria-hidden="true"></span>
          <span class="portal-core__iris" aria-hidden="true"></span>
          <span class="portal-core__content">
            <small>RICH BIZNESS LLC</small>
            <strong>${user ? 'ENTER' : 'ACTIVATE'}</strong>
            <span>${user ? 'OPEN YOUR UNIVERSE' : 'CREATE YOUR RICH ID'}</span>
            <b>${user ? `${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()} XP` : 'TAP TO BEGIN'}</b>
            <i><u style="width:${xpPercent}%"></u></i>
          </span>
        </a>
      </section>

      ${recent.length ? `<section class="portal-pulse" aria-label="Universe activity"><span>LIVE PULSE</span><div>${recent.map((item) => `<a href="${esc(safeUrl(item.href) || '#')}"><small>${esc(String(item.kind ?? 'update').toUpperCase())}</small><strong>${esc(item.title ?? 'Rich Bizness update')}</strong></a>`).join('')}</div></section>` : ''}

      <aside class="portal-actions" aria-label="Quick actions">
        <a href="/search.html" aria-label="Search"><span>⌕</span><small>SEARCH</small></a>
        <a href="/messages.html" aria-label="Messages"><span>✦</span><small>DM</small>${Number(snapshot.unread_threads ?? 0) ? `<b>${snapshot.unread_threads}</b>` : ''}</a>
        <a href="/notifications.html" aria-label="Notifications"><span>◌</span><small>ALERTS</small>${Number(snapshot.unread_notifications ?? 0) ? `<b>${snapshot.unread_notifications}</b>` : ''}</a>
        <a href="${identityRoute}" aria-label="${user ? 'Profile' : 'Tap In'}"><span>◎</span><small>${user ? 'PROFILE' : 'TAP IN'}</small></a>
      </aside>

      <footer class="portal-stats">
        <article><small>BALANCE</small><strong>${money(profile.balance_cents)}</strong></article>
        <article><small>RICH POINTS</small><strong>${Number(level.rich_points ?? profile.rich_points ?? 0).toLocaleString()}</strong></article>
        <article><small>RANK</small><strong>${esc(level.rank_title ?? profile.rank_title ?? 'BIZ LEGEND')}</strong></article>
        <article><small>ONLINE</small><strong>${esc(String(profile.online_status ?? (user ? 'LIVE' : 'GUEST')).toUpperCase())}</strong></article>
      </footer>
    </main>`;

  const cleanupMotion = mountPortalMotion({ reduced: reducedMotion });
  const pulseTrack = document.querySelector<HTMLElement>('.portal-pulse > div');
  let pulseTimer: number | null = null;
  if (pulseTrack && !reducedMotion) {
    let pulseIndex = 0;
    pulseTimer = window.setInterval(() => {
      pulseIndex = (pulseIndex + 1) % Math.max(1, recent.length);
      pulseTrack.style.transform = `translateY(-${pulseIndex * 100}%)`;
    }, 4200);
  }
  const cleanup = () => {
    cleanupMotion();
    if (pulseTimer !== null) window.clearInterval(pulseTimer);
  };
  window.addEventListener('beforeunload', cleanup, { once: true });
}