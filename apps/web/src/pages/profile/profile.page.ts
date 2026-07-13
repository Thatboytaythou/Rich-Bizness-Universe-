import { supabase } from '../../core/supabase/client';

function money(cents: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
}

export async function mountProfilePage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/tap-in.html?next=${encodeURIComponent('/profile.html')}`);
    return;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,username,display_name,bio,avatar_url,banner_url,rich_level,rank_title,rich_points,balance_cents,online_status,is_creator,is_verified')
    .eq('id', session.user.id)
    .single();

  if (error) throw error;

  root.innerHTML = `
    <main class="page-shell profile-page">
      <section class="glass-card profile-hero">
        <div class="profile-banner" style="background-image:url('${profile.banner_url ?? ''}')"></div>
        <div class="profile-identity">
          <img class="profile-avatar" src="${profile.avatar_url ?? '/brand/icons/profile-placeholder.svg'}" alt="Profile avatar" />
          <div>
            <p class="eyebrow">${profile.is_verified ? 'VERIFIED · ' : ''}${profile.online_status ?? 'offline'}</p>
            <h1>${profile.display_name ?? profile.username ?? 'Rich Member'}</h1>
            <p>@${profile.username ?? 'member'}</p>
            <p>${profile.bio ?? 'Build your Rich Bizness identity.'}</p>
          </div>
        </div>
      </section>
      <section class="stats-grid">
        <article class="glass-card"><span>LEVEL</span><strong>${profile.rich_level ?? 1}</strong></article>
        <article class="glass-card"><span>RANK</span><strong>${profile.rank_title ?? 'Starter'}</strong></article>
        <article class="glass-card"><span>RICH POINTS</span><strong>${profile.rich_points ?? 0}</strong></article>
        <article class="glass-card"><span>BALANCE</span><strong>${money(profile.balance_cents)}</strong></article>
      </section>
      <nav class="action-grid" aria-label="Profile actions">
        <a class="glass-card" href="/edit-profile.html">Edit Profile</a>
        <a class="glass-card" href="/settings.html">Settings</a>
        <a class="glass-card" href="/messages.html">Messages</a>
        <a class="glass-card" href="/avatar.html">3D Avatar</a>
        <a class="glass-card" href="/gaming.html">Game Progress</a>
        <a class="glass-card" href="/creator.html">Creator Hub</a>
      </nav>
    </main>`;
}
