import { supabase } from '../../core/supabase/client';

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char] ?? char));

function money(cents: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
}

export async function mountProfilePage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');

  const { data: { session } } = await supabase.auth.getSession();
  const params = new URLSearchParams(location.search);
  const requestedId = params.get('id') || params.get('user') || params.get('u');
  if (!session && !requestedId) {
    location.replace(`/tap-in.html?next=${encodeURIComponent('/profile.html')}`);
    return;
  }

  const profileId = requestedId || session!.user.id;
  const isOwner = session?.user.id === profileId;
  const [profileResult, avatarResult, followersResult, followingResult, postsResult, feedResult] = await Promise.all([
    supabase.from('profiles').select('id,username,display_name,bio,avatar_url,banner_url,website_url,rich_level,rank_title,rich_points,balance_cents,online_status,is_creator,is_verified,has_avatar').eq('id', profileId).maybeSingle(),
    supabase.from('meta_avatars').select('display_name,avatar_url,aura,rank,level,xp,character_type,is_realistic_3d,is_controllable').eq('user_id', profileId).maybeSingle(),
    supabase.from('followers').select('follower_id', { count: 'exact', head: true }).eq('following_id', profileId),
    supabase.from('followers').select('following_id', { count: 'exact', head: true }).eq('follower_id', profileId),
    supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', profileId),
    supabase.from('feed_posts').select('id,title,body,media_url,file_url,thumbnail_url,cover_url,media_type,post_type,section,created_at').eq('user_id', profileId).order('created_at', { ascending: false }).limit(12)
  ]);

  const profile = profileResult.data;
  const avatar = avatarResult.data;
  if (!profile) {
    root.innerHTML = `<main class="profile-missing"><a href="/portal.html">← PORTAL</a><h1>PROFILE NOT FOUND</h1><p>This Rich Bizness identity is not available.</p></main>`;
    return;
  }

  const displayName = profile.display_name ?? profile.username ?? avatar?.display_name ?? 'Rich Member';
  const avatarUrl = profile.avatar_url ?? avatar?.avatar_url ?? '/brand/icons/profile-placeholder.svg';
  const bannerUrl = profile.banner_url ?? '/images/brand/Avatar-hero-Banner.png.jpeg';
  const feed = feedResult.data ?? [];

  root.innerHTML = `
    <main class="profile-shell">
      <header class="profile-topbar">
        <a href="/portal.html" aria-label="Back to portal">←</a>
        <div><small>RICH BIZNESS IDENTITY</small><strong>${isOwner ? 'MY PROFILE' : 'CREATOR PROFILE'}</strong></div>
        <a href="${isOwner ? '/settings.html' : `/messages.html?to=${profile.id}`}" aria-label="${isOwner ? 'Settings' : 'Message'}">${isOwner ? '⚙' : '✦'}</a>
      </header>

      <section class="profile-hero">
        <div class="profile-banner" style="background-image:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.92)),url('${esc(bannerUrl)}')"></div>
        <div class="profile-hero-glow" aria-hidden="true"></div>
        <div class="profile-identity">
          <div class="profile-avatar-wrap"><img class="profile-avatar" src="${esc(avatarUrl)}" alt="${esc(displayName)}"><i class="${profile.online_status === 'online' ? 'online' : ''}"></i></div>
          <div class="profile-name-block">
            <p>${profile.is_verified ? '◆ VERIFIED RICH ID' : 'RICH BIZNESS MEMBER'}</p>
            <h1>${esc(displayName)}</h1>
            <span>@${esc(profile.username ?? 'member')}</span>
            <small>${esc(profile.bio ?? 'Building a Rich Bizness universe.')}</small>
          </div>
          <div class="profile-rank-seal"><span>LEVEL</span><strong>${profile.rich_level ?? avatar?.level ?? 1}</strong><small>${esc(profile.rank_title ?? avatar?.rank ?? 'Starter')}</small></div>
        </div>
      </section>

      <section class="profile-statbar">
        <article><strong>${followersResult.count ?? 0}</strong><span>FOLLOWERS</span></article>
        <article><strong>${followingResult.count ?? 0}</strong><span>FOLLOWING</span></article>
        <article><strong>${postsResult.count ?? 0}</strong><span>POSTS</span></article>
        <article><strong>${Number(profile.rich_points ?? 0).toLocaleString()}</strong><span>RICH POINTS</span></article>
      </section>

      <section class="profile-command-grid">
        <article class="profile-command profile-command--identity">
          <div><small>IDENTITY CORE</small><h2>${esc(avatar?.character_type ?? 'CUSTOM')} AVATAR</h2><p>${esc(avatar?.aura ?? 'Emerald Gold')} aura · ${avatar?.is_controllable ? 'CONTROLLABLE' : 'READY TO BUILD'}</p></div>
          <a href="/avatar.html">OPEN 3D AVATAR</a>
        </article>
        <article class="profile-command"><small>RICH BALANCE</small><strong>${money(profile.balance_cents)}</strong><span>Creator and store balance</span></article>
        <article class="profile-command"><small>CREATOR STATUS</small><strong>${profile.is_creator ? 'ACTIVE' : 'UNLOCK'}</strong><span>${profile.is_creator ? 'Creator tools enabled' : 'Build your creator hub'}</span></article>
        <article class="profile-command"><small>ONLINE STATE</small><strong>${esc((profile.online_status ?? 'offline').toUpperCase())}</strong><span>Realtime universe presence</span></article>
      </section>

      <nav class="profile-actions" aria-label="Profile actions">
        ${isOwner ? `
          <a href="/edit-profile.html">EDIT PROFILE</a>
          <a href="/upload.html">UPLOAD</a>
          <a href="/creator.html">CREATOR HUB</a>
          <a href="/settings.html">SETTINGS</a>
        ` : `
          <button id="followButton" type="button">FOLLOW</button>
          <a href="/messages.html?to=${profile.id}">MESSAGE</a>
          <a href="/creator.html?id=${profile.id}">CREATOR PAGE</a>
          <a href="/store.html?seller=${profile.id}">STORE</a>
        `}
      </nav>

      <section class="profile-content">
        <header><div><small>RECENT DROPS</small><h2>THE UNIVERSE OF ${esc(displayName.toUpperCase())}</h2></div><a href="/feed.html?user=${profile.id}">VIEW ALL</a></header>
        <div class="profile-feed-grid">
          ${feed.length ? feed.map((post) => {
            const media = post.thumbnail_url ?? post.cover_url ?? post.media_url ?? post.file_url;
            return `<a class="profile-drop" href="/feed.html?post=${post.id}">${media ? `<img src="${esc(media)}" alt="">` : '<div class="profile-drop-placeholder">RB</div>'}<span>${esc(post.title ?? post.body ?? post.section ?? 'Rich Drop')}</span><small>${esc((post.post_type ?? post.media_type ?? post.section ?? 'POST').toUpperCase())}</small></a>`;
          }).join('') : '<div class="profile-empty">No drops yet. This universe is ready to be built.</div>'}
        </div>
      </section>
    </main>`;

  if (!isOwner && session) {
    const followButton = document.querySelector<HTMLButtonElement>('#followButton');
    const { data: existing } = await supabase.from('followers').select('follower_id').eq('follower_id', session.user.id).eq('following_id', profileId).maybeSingle();
    let following = Boolean(existing);
    const renderFollow = () => { if (followButton) followButton.textContent = following ? 'FOLLOWING' : 'FOLLOW'; };
    renderFollow();
    followButton?.addEventListener('click', async () => {
      followButton.disabled = true;
      if (following) await supabase.from('followers').delete().eq('follower_id', session.user.id).eq('following_id', profileId);
      else await supabase.from('followers').insert({ follower_id: session.user.id, following_id: profileId });
      following = !following;
      followButton.disabled = false;
      renderFollow();
    });
  }
}
