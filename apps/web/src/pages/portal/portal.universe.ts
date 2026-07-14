import { ROUTES } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import { mountPortalMotion } from './portal.motion';
import './portal.v2.css';

type JsonMap = Record<string, unknown>;
type PortalSnapshot = {
  profile?: JsonMap;
  level?: JsonMap;
  avatar?: JsonMap;
  announcement?: JsonMap;
  background?: JsonMap;
  layout?: JsonMap;
  theme?: JsonMap;
  section_pulse?: JsonMap;
  recent_activity?: JsonMap[];
  unread_notifications?: number;
  unread_threads?: number;
};

type Destination = {
  key: string;
  label: string;
  kicker: string;
  icon: string;
  href: string;
  angle: number;
};

const destinations: Destination[] = [
  { key: 'live', label: 'LIVE', kicker: 'Broadcast', icon: '◉', href: '/live.html', angle: -90 },
  { key: 'gallery', label: 'GALLERY', kicker: 'Visuals', icon: '▣', href: '/gallery.html', angle: -45 },
  { key: 'music', label: 'MUSIC', kicker: 'Audio', icon: '♪', href: '/music.html', angle: 0 },
  { key: 'gaming', label: 'GAMING', kicker: 'Play', icon: '🎮', href: ROUTES.gaming, angle: 45 },
  { key: 'store', label: 'STORE', kicker: 'Commerce', icon: '🛒', href: '/store.html', angle: 90 },
  { key: 'meta', label: 'META', kicker: 'Worlds', icon: '◎', href: '/meta.html', angle: 135 },
  { key: 'sports', label: 'SPORTS', kicker: 'Arena', icon: '🏆', href: '/sports.html', angle: 180 },
  { key: 'upload', label: 'UPLOAD', kicker: 'Create', icon: '⬆', href: '/upload.html', angle: 225 }
];

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] ?? character));

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2
}).format(Number(value ?? 0) / 100);

const compact = (value: unknown) => new Intl.NumberFormat('en-US', {
  notation: 'compact', maximumFractionDigits: 1
}).format(Number(value ?? 0));

export async function mountPortalPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const user = getAuthSnapshot().user;
  let snapshot: PortalSnapshot = {};
  if (user) {
    const { data, error } = await supabase.rpc('rb_portal_universe_snapshot', {});
    if (!error) snapshot = (data ?? {}) as PortalSnapshot;
  }

  const profile = snapshot.profile ?? {};
  const level = snapshot.level ?? {};
  const avatar = snapshot.avatar ?? {};
  const announcement = snapshot.announcement ?? {};
  const background = snapshot.background ?? {};
  const pulse = snapshot.section_pulse ?? {};
  const identityRoute = user ? ROUTES.profile : ROUTES.tapIn;
  const displayName = String(profile.display_name ?? profile.username ?? avatar.display_name ?? user?.email?.split('@')[0] ?? 'RICH BIZNESS');
  const avatarUrl = String(profile.avatar_url ?? avatar.avatar_url ?? '');
  const richLevel = Number(level.level ?? profile.rich_level ?? avatar.level ?? 1);
  const xpCurrent = Number(level.xp_current ?? 0);
  const xpNext = Math.max(1, Number(level.xp_next ?? 1000));
  const xpPercent = Math.min(100, Math.max(0, (xpCurrent / xpNext) * 100));
  const backgroundUrl = String(background.background_url ?? '');
  const unreadMessages = Number(snapshot.unread_threads ?? 0);
  const unreadAlerts = Number(snapshot.unread_notifications ?? 0);

  app.innerHTML = `
    <main class="rb-portal-v2" style="--portal-bg:${backgroundUrl ? `url('${esc(backgroundUrl)}')` : 'none'}">
      <canvas id="portalMotionCanvas" class="rb-portal-v2__canvas" aria-hidden="true"></canvas>
      <div class="rb-portal-v2__background" aria-hidden="true"></div>
      <div class="rb-portal-v2__stars" aria-hidden="true"></div>
      <div class="rb-portal-v2__fog rb-portal-v2__fog--green" aria-hidden="true"></div>
      <div class="rb-portal-v2__fog rb-portal-v2__fog--gold" aria-hidden="true"></div>

      <header class="rb-portal-v2__header">
        <a class="rb-portal-v2__identity" href="${identityRoute}" aria-label="Open ${user ? 'profile' : 'Tap In'}">
          <span class="rb-portal-v2__avatar">${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="">` : '<b>RB</b>'}<i></i></span>
          <span class="rb-portal-v2__identity-copy">
            <small>${user ? 'WELCOME BACK' : 'GLOBAL ACCESS'}</small>
            <strong>${esc(displayName)}</strong>
            <em>${user ? `LEVEL ${richLevel} · ${esc(level.rank_title ?? profile.rank_title ?? 'ROOKIE RICH')}` : 'CREATE YOUR RICH ID'}</em>
          </span>
        </a>

        <div class="rb-portal-v2__brand" aria-label="Rich Bizness Universe">
          <small>RICH BIZNESS LLC</small>
          <strong>UNIVERSE</strong>
          <span>GLOBAL CREATOR OPERATING SYSTEM</span>
        </div>
      </header>

      ${announcement.title ? `
        <a class="rb-portal-v2__announcement" href="${esc(announcement.action_url ?? announcement.target_url ?? '#')}">
          <span>${esc(announcement.emoji ?? '✦')}</span>
          <div><small>${esc(announcement.priority ?? 'PLATFORM UPDATE')}</small><strong>${esc(announcement.title)}</strong></div>
          <b>OPEN</b>
        </a>
      ` : ''}

      <section class="rb-portal-v2__universe" aria-label="Rich Bizness portal navigation">
        <div class="rb-portal-v2__halo rb-portal-v2__halo--outer" aria-hidden="true"></div>
        <div class="rb-portal-v2__halo rb-portal-v2__halo--mid" aria-hidden="true"></div>
        <div class="rb-portal-v2__halo rb-portal-v2__halo--inner" aria-hidden="true"></div>
        <div class="rb-portal-v2__ticks" aria-hidden="true"></div>
        <div class="rb-portal-v2__radar" aria-hidden="true"></div>
        <div class="rb-portal-v2__energy" aria-hidden="true"></div>

        <nav class="rb-portal-v2__dial" aria-label="Universe sections">
          ${destinations.map((item, index) => `
            <a class="rb-portal-v2__node" href="${item.href}" style="--angle:${item.angle}deg;--index:${index}" data-route="${item.key}">
              <span class="rb-portal-v2__node-glow" aria-hidden="true"></span>
              <span class="rb-portal-v2__node-icon">${item.icon}</span>
              <span class="rb-portal-v2__node-copy"><small>${item.kicker}</small><strong>${item.label}</strong></span>
              <b>${compact(pulse[item.key] ?? 0)}</b>
            </a>
          `).join('')}
        </nav>

        <a class="rb-portal-v2__core" href="${identityRoute}" aria-label="${user ? 'Enter your universe' : 'Create your Rich ID'}">
          <span class="rb-portal-v2__core-orbit rb-portal-v2__core-orbit--one" aria-hidden="true"></span>
          <span class="rb-portal-v2__core-orbit rb-portal-v2__core-orbit--two" aria-hidden="true"></span>
          <span class="rb-portal-v2__core-iris" aria-hidden="true"></span>
          <span class="rb-portal-v2__core-copy">
            <small>RICH BIZNESS LLC</small>
            <strong>${user ? 'ENTER' : 'ACTIVATE'}</strong>
            <span>${user ? 'OPEN YOUR UNIVERSE' : 'CREATE YOUR GLOBAL ID'}</span>
            <em>${user ? `${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()} XP` : 'TAP TO BEGIN'}</em>
            <i><b style="width:${xpPercent}%"></b></i>
          </span>
        </a>
      </section>

      <aside class="rb-portal-v2__quick" aria-label="Quick actions">
        <a href="/search.html" aria-label="Search"><span>⌕</span><small>SEARCH</small></a>
        <a href="/messages.html" aria-label="Messages"><span>✦</span><small>RICH DM</small>${unreadMessages ? `<b>${unreadMessages}</b>` : ''}</a>
        <a href="/notifications.html" aria-label="Notifications"><span>◌</span><small>ALERTS</small>${unreadAlerts ? `<b>${unreadAlerts}</b>` : ''}</a>
        <a href="${identityRoute}" aria-label="Profile"><span>◎</span><small>${user ? 'PROFILE' : 'TAP IN'}</small></a>
      </aside>

      <footer class="rb-portal-v2__footer">
        <article><small>BALANCE</small><strong>${money(profile.balance_cents)}</strong></article>
        <article><small>RICH POINTS</small><strong>${Number(level.rich_points ?? profile.rich_points ?? 0).toLocaleString()}</strong></article>
        <article><small>RANK</small><strong>${esc(level.rank_title ?? profile.rank_title ?? 'BIZ LEGEND')}</strong></article>
        <article><small>ONLINE</small><strong>${esc(String(profile.online_status ?? (user ? 'ONLINE' : 'GUEST')).toUpperCase())}</strong></article>
      </footer>
    </main>`;

  const cleanupMotion = mountPortalMotion({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
  const channel = user ? supabase
    .channel(`portal-universe:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_levels', filter: `user_id=eq.${user.id}` }, () => location.reload())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rich_notifications', filter: `user_id=eq.${user.id}` }, () => location.reload())
    .subscribe() : null;

  window.addEventListener('beforeunload', () => {
    cleanupMotion();
    if (channel) void supabase.removeChannel(channel);
  }, { once: true });
}
