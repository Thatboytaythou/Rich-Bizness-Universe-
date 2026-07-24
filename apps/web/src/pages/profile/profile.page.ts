import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './profile-universe.css';
import './profile-command-upgrade.css';

type JsonRow = Record<string, any>;
type Snapshot = {
  restricted?: boolean;
  viewer?: JsonRow;
  profile?: JsonRow;
  theme?: JsonRow;
  settings?: JsonRow;
  level?: JsonRow;
  avatar?: JsonRow;
  loadout?: JsonRow;
  creator?: JsonRow;
  seller?: JsonRow;
  gamer?: JsonRow;
  sports?: JsonRow;
  counts?: JsonRow;
  badges?: JsonRow[];
  feed?: JsonRow[];
  music?: JsonRow[];
  products?: JsonRow[];
  gaming?: JsonRow[];
  sports_content?: JsonRow[];
  worlds?: JsonRow[];
  activity?: JsonRow[];
};

const esc = (value: any) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
const money = (cents: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents ?? 0) / 100);
const compact = (value: any) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value ?? 0));
const media = (item: JsonRow) => item.thumbnail_url ?? item.cover_url ?? item.image_url ?? item.media_url ?? item.file_url ?? item.clip_url ?? item.background_url ?? '';
const relative = (value: any) => {
  if (!value) return '';
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (seconds < 60) return 'NOW';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
};
const safeExternal = (value: any) => {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

function socialLinks(profile: JsonRow): string {
  const links = [
    ['WEB', profile.website_url],
    ['IG', profile.instagram_url],
    ['YT', profile.youtube_url],
    ['TT', profile.tiktok_url],
    ['FB', profile.facebook_url],
    ['SC', profile.snapchat_url],
  ].map(([label, url]) => [label, safeExternal(url)]).filter(([, url]) => url);

  return links.length
    ? `<div class="profile-socials">${links.map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(label)} profile">${esc(label)}</a>`).join('')}</div>`
    : '';
}

function contentCard(item: JsonRow, type: string): string {
  const image = media(item);
  const title = item.title ?? item.body ?? item.caption ?? item.description ?? item.world_type ?? type;
  const meta = [item.genre, item.sport, item.team_name, item.product_type, item.world_type].filter(Boolean).join(' · ');
  const href = type === 'MUSIC'
    ? `/music.html?track=${item.id}`
    : type === 'STORE'
      ? `/store.html?product=${item.id}`
      : type === 'GAMING'
        ? `/gaming.html?clip=${item.id}`
        : type === 'SPORTS'
          ? `/sports.html?post=${item.id}`
          : type === 'META'
            ? `/meta.html?world=${item.id}`
            : `/feed.html?post=${item.id}`;

  return `<a class="pu-card" href="${href}">
    ${image ? `<img src="${esc(image)}" alt="${esc(title)}" loading="lazy" decoding="async">` : '<div class="pu-card__empty" aria-hidden="true">RB</div>'}
    <div class="pu-card__shade"></div>
    <div class="pu-card__copy">
      <small>${type}${item.created_at ? ` · ${relative(item.created_at)}` : ''}</small>
      <strong>${esc(title)}</strong>
      ${meta ? `<span>${esc(meta)}</span>` : ''}
      <em>${compact(item.view_count ?? item.views ?? item.play_count ?? item.visit_count ?? 0)} views · ${compact(item.like_count ?? item.likes ?? 0)} likes</em>
    </div>
  </a>`;
}

function stat(label: string, value: any, sub = ''): string {
  return `<article><small>${label}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</article>`;
}

function ownerControl(href: string, icon: string, label: string, detail: string, className = ''): string {
  return `<a class="pu-owner-control ${className}" href="${href}"><i aria-hidden="true">${icon}</i><span><strong>${label}</strong><small>${detail}</small></span><b aria-hidden="true">→</b></a>`;
}

function getViewSessionId(profileId: string): string {
  const key = `rb:profile-view:${profileId}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export async function mountProfilePage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');

  const session = getAuthSnapshot().session;
  const params = new URLSearchParams(location.search);
  const requested = params.get('id') || params.get('user') || params.get('u');

  if (!session && !requested) {
    location.replace(`/tap-in.html?next=${encodeURIComponent('/profile.html')}`);
    return;
  }

  const profileId = requested || session!.user.id;
  const [{ data, error }, { data: adminData }] = await Promise.all([
    supabase.rpc('rb_profile_universe_snapshot', { p_profile_id: profileId }),
    session ? supabase.rpc('rb_is_admin', {}) : Promise.resolve({ data: false } as any),
  ]);

  if (error) {
    root.innerHTML = `<main class="pu-fail"><a href="/portal.html">← PORTAL</a><h1>PROFILE ENGINE OFFLINE</h1><p>${esc(error.message)}</p></main>`;
    return;
  }

  const snap = (data ?? {}) as unknown as Snapshot;
  const profile = snap.profile ?? {};
  const viewer = snap.viewer ?? {};
  const counts = snap.counts ?? {};
  const level = snap.level ?? {};
  const avatar = snap.avatar ?? {};
  const isOwner = Boolean(viewer.is_owner);
  const isAdmin = Boolean(adminData);
  const display = profile.display_name ?? profile.username ?? avatar.display_name ?? 'Rich Member';
  const avatarUrl = profile.avatar_url ?? avatar.avatar_url ?? '/brand/icons/profile-placeholder.svg';
  const banner = profile.banner_url ?? '/images/brand/Avatar-hero-Banner.png.jpeg';

  if (snap.restricted) {
    root.innerHTML = `<main class="pu-restricted"><a href="/portal.html" aria-label="Return to Portal">←</a><img src="${esc(avatarUrl)}" alt="${esc(display)}"><h1>${esc(display)}</h1><p>@${esc(profile.username ?? 'member')}</p><strong>PRIVATE RICH ID</strong><span>This profile is available to approved followers.</span></main>`;
    return;
  }

  if (!isOwner) {
    void supabase.rpc('rb_profile_record_view', {
      p_profile_id: profileId,
      p_session_id: getViewSessionId(profileId),
      p_source: 'profile-page',
    });
  }

  const xpCurrent = Number(level.xp_current ?? avatar.xp ?? 0);
  const xpNext = Math.max(Number(level.xp_next ?? 1000), 1);
  const xpPct = Math.min(100, Math.round((xpCurrent / xpNext) * 100));
  const tabs = [
    ['feed', 'DROPS', snap.feed ?? []],
    ['music', 'MUSIC', snap.music ?? []],
    ['store', 'STORE', snap.products ?? []],
    ['gaming', 'GAMING', snap.gaming ?? []],
    ['sports', 'SPORTS', snap.sports_content ?? []],
    ['meta', 'META', snap.worlds ?? []],
  ] as const;
  const roles = [
    profile.is_verified && 'VERIFIED',
    profile.is_creator && 'CREATOR',
    profile.is_artist && 'ARTIST',
    profile.is_seller && 'SELLER',
    snap.gamer && 'GAMER',
    snap.sports && 'SPORTS',
    isAdmin && 'ADMIN',
  ].filter(Boolean);

  const ownerActions = [
    ownerControl('/edit-profile.html', '✎', 'EDIT PROFILE', 'Identity, bio, avatar and banner', 'is-primary'),
    ownerControl('/settings.html', '⚙', 'SETTINGS', 'Privacy, motion, theme and notifications'),
    ownerControl('/avatar.html', '◆', 'CHOOSE AVATAR', 'Select your character identity'),
    ownerControl('/avatar-characters.html', '◉', '3D CHARACTER LOBBY', 'Enter the live controllable avatar space'),
    ownerControl('/creator.html', '✦', 'CREATOR SECRET DOOR', 'Open your four creator dimensions'),
    ownerControl('/upload.html', '↑', 'UPLOAD', 'Drop content into the universe'),
    isAdmin ? ownerControl('/admin.html', '⌘', 'ADMIN COMMAND', 'Moderation, platform and system control', 'is-admin') : '',
  ].filter(Boolean).join('');

  root.innerHTML = `<main class="profile-universe ${isOwner ? 'is-owner' : 'is-public'}" style="--profile-bg:url('${esc(snap.theme?.background_url ?? banner)}')">
    <div class="pu-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="pu-top">
      <a href="/portal.html" aria-label="Return to Portal">←</a>
      <div><small>RICH BIZNESS UNIVERSAL IDENTITY</small><strong>${isOwner ? 'MY COMMAND CENTER' : 'PUBLIC PROFILE'}</strong></div>
      <a href="${isOwner ? '/settings.html' : `/messages.html?to=${profileId}`}" aria-label="${isOwner ? 'Open settings' : 'Send message'}">${isOwner ? '⚙' : '✦'}</a>
    </header>

    <section class="pu-hero">
      <div class="pu-banner" style="background-image:linear-gradient(180deg,rgba(1,4,2,.04),rgba(1,4,2,.94)),url('${esc(banner)}')"></div>
      <div class="pu-hero-grid">
        <div class="pu-avatar"><img src="${esc(avatarUrl)}" alt="${esc(display)}"><span class="${profile.online_status === 'online' ? 'online' : ''}"></span><b>${avatar.is_realistic_3d ? '3D' : 'RB'}</b></div>
        <div class="pu-identity">
          <div class="pu-kickers"><span>${profile.is_verified ? '◆ VERIFIED RICH ID' : 'RICH BIZNESS MEMBER'}</span>${roles.map(role => `<span>${esc(role)}</span>`).join('')}</div>
          <h1>${esc(display)}</h1><p>@${esc(profile.username ?? 'member')}</p>
          <blockquote>${esc(profile.bio ?? 'Building a Rich Bizness universe.')}</blockquote>${socialLinks(profile)}
        </div>
        <aside class="pu-level"><small>RICH LEVEL</small><strong>${esc(level.level ?? profile.rich_level ?? avatar.level ?? 1)}</strong><span>${esc(level.rank_title ?? profile.rank_title ?? avatar.rank ?? 'Rookie Rich')}</span><div><i style="width:${xpPct}%"></i></div><em>${compact(xpCurrent)} / ${compact(xpNext)} XP</em></aside>
      </div>
    </section>

    ${isOwner ? `<section class="pu-owner-deck"><header><div><small>OWNER CONTROLS</small><h2>RUN YOUR WHOLE RICH ID</h2><p>Edit, customize, manage and enter every identity layer without hunting through the page.</p></div><span>${isAdmin ? 'ADMIN VERIFIED' : 'OWNER VERIFIED'}</span></header><div>${ownerActions}</div></section>` : ''}

    <section class="pu-metrics">${stat('FOLLOWERS', compact(counts.followers))}${stat('FOLLOWING', compact(counts.following))}${stat('TOTAL DROPS', compact(counts.posts))}${stat('PROFILE VIEWS', compact(counts.views))}${stat('RICH POINTS', compact(level.rich_points ?? profile.rich_points))}${stat('TRUST', `${level.trust_score ?? profile.trust_score ?? 100}%`)}</section>

    ${!isOwner ? `<nav class="pu-actions" aria-label="Profile actions"><button type="button" id="followButton" class="primary">${viewer.following ? 'FOLLOWING' : 'FOLLOW'}</button><a href="/messages.html?to=${profileId}">MESSAGE</a><a href="/creator.html?id=${profileId}">CREATOR PAGE</a><a href="/store.html?seller=${profileId}">STORE</a><button type="button" id="shareButton">SHARE</button></nav>` : ''}

    <section class="pu-command">
      <article class="pu-command__avatar"><div><small>UNIVERSAL CHARACTER</small><h2>${esc((avatar.character_type ?? 'CUSTOM').toUpperCase())}</h2><p>${esc(avatar.aura ?? 'Emerald Gold')} aura · ${avatar.is_controllable ? 'Realtime controllable' : 'Identity ready'} · ${esc(snap.loadout?.version ?? 1)} loadout</p></div><div class="pu-character-links"><a href="/avatar.html">CHOOSE CHARACTER</a><a href="/avatar-characters.html">ENTER 3D LOBBY</a></div></article>
      ${stat('BALANCE', money(profile.balance_cents), 'Wallet + creator funds')}${stat('CREATOR', snap.creator ? 'ACTIVE' : 'LOCKED', snap.creator?.creator_title ?? 'Build creator presence')}${stat('SELLER', snap.seller ? 'ACTIVE' : 'LOCKED', snap.seller?.seller_rank ?? 'Open Rich Store')}${stat('GAMER', snap.gamer?.rank_title ?? 'ROOKIE', `${compact(snap.gamer?.wins ?? 0)} wins`)}${stat('SPORTS', snap.sports?.rank_title ?? 'FAN', `${compact(snap.sports?.points ?? 0)} points`)}
    </section>

    <section class="pu-badges"><header><div><small>ACHIEVEMENT VAULT</small><h2>BADGES + STATUS</h2></div><span>${compact(counts.badges)} UNLOCKED</span></header><div>${(snap.badges ?? []).length ? (snap.badges ?? []).map(badge => `<article class="${badge.equipped ? 'equipped' : ''}"><i>${esc(badge.icon ?? '◆')}</i><div><strong>${esc(badge.title)}</strong><small>${esc(badge.rarity)} · ${esc(badge.badge_type)}</small></div></article>`).join('') : '<p>No badges unlocked yet.</p>'}</div></section>

    <section class="pu-library"><header><div><small>COMPLETE PROFILE UNIVERSE</small><h2>YOUR CONTENT WORLDS</h2></div><div class="pu-tabs" role="tablist">${tabs.map(([key, label, items]) => `<button type="button" role="tab" data-tab="${key}">${label}<span>${compact(items.length)}</span></button>`).join('')}</div></header>${tabs.map(([key, label, items]) => `<div class="pu-panel" data-panel="${key}" role="tabpanel">${items.length ? items.map(item => contentCard(item, label)).join('') : `<div class="pu-empty">NO ${label} YET</div>`}</div>`).join('')}</section>

    <section class="pu-activity"><header><small>RECENT POWER MOVES</small><h2>XP + UNIVERSE ACTIVITY</h2></header><div>${(snap.activity ?? []).length ? (snap.activity ?? []).map(activity => `<article><span>+${esc(activity.xp_amount ?? 0)} XP</span><div><strong>${esc(String(activity.event_key ?? 'activity').replaceAll('_', ' ').toUpperCase())}</strong><small>${esc(activity.section ?? 'global')} · ${relative(activity.created_at)}</small></div><em>+${esc(activity.rich_points_amount ?? 0)} RP</em></article>`).join('') : '<p>No activity recorded yet.</p>'}</div></section>
  </main>`;

  const activateTab = (key: string) => {
    const valid = tabs.some(([tab]) => tab === key) ? key : 'feed';
    document.querySelectorAll<HTMLElement>('[data-tab]').forEach(tab => {
      const active = tab.dataset.tab === valid;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === valid));
    params.set('tab', valid);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.tab ?? 'feed')));
  activateTab(params.get('tab') ?? 'feed');

  const follow = document.querySelector<HTMLButtonElement>('#followButton');
  follow?.addEventListener('click', async () => {
    if (!session) {
      location.assign(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    follow.disabled = true;
    const original = follow.textContent;
    follow.textContent = 'SYNCING';
    const { data: result, error: followError } = await supabase.rpc('rb_profile_toggle_follow', { p_profile_id: profileId });
    if (followError) {
      follow.textContent = original;
      follow.title = followError.message;
    } else {
      const response = result as any;
      follow.textContent = response.following ? 'FOLLOWING' : 'FOLLOW';
      const followerMetric = document.querySelector<HTMLElement>('.pu-metrics article:first-child strong');
      if (followerMetric) followerMetric.textContent = compact(response.followers);
      if (response.following) void supabase.rpc('rb_award_xp', { p_event_key: 'profile_followed', p_section: 'profile', p_source_table: 'followers' });
    }
    follow.disabled = false;
  });

  document.querySelector<HTMLButtonElement>('#shareButton')?.addEventListener('click', async () => {
    const url = `${location.origin}/profile.html?id=${profileId}`;
    try {
      if (navigator.share) await navigator.share({ title: `${display} · Rich Bizness`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // The user cancelled the share sheet.
    }
  });

  const channel = supabase.channel(`profile-universe:${profileId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` }, () => location.reload())
    .subscribe();

  window.addEventListener('pagehide', () => { void supabase.removeChannel(channel); }, { once: true });
}
