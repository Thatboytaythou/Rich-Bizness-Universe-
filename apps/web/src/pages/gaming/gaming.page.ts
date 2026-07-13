import { supabase } from '../../core/supabase/client';

type GameRow = {
  slug: string;
  title: string;
  description: string | null;
  game_type: string | null;
  play_url: string | null;
  runtime_status: string | null;
  is_playable: boolean | null;
  cover_url: string | null;
};

export async function mountGamingPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');

  const { data, error } = await supabase
    .from('games')
    .select('slug,title,description,game_type,play_url,runtime_status,is_playable,cover_url')
    .eq('is_active', true)
    .order('title');

  if (error) throw error;
  const games = (data ?? []) as GameRow[];

  root.innerHTML = `
    <main class="page-shell gaming-page">
      <header class="section-hero glass-card">
        <p class="eyebrow">24 SOLO WORLDS</p>
        <h1>Rich Bizness Gaming</h1>
        <p>Every title owns its own route, runtime, controls, save data and Supabase progress.</p>
      </header>
      <section class="game-grid">
        ${games.map((game) => `
          <article class="game-card glass-card" data-game="${game.slug}">
            <div class="game-art" style="background-image:url('${game.cover_url ?? ''}')"></div>
            <p class="eyebrow">${game.game_type ?? 'game'} · ${game.runtime_status ?? 'catalog_only'}</p>
            <h2>${game.title}</h2>
            <p>${game.description ?? 'Standalone Rich Bizness game world.'}</p>
            <a class="game-launch ${game.is_playable ? '' : 'is-locked'}" href="${game.play_url ?? `/games/${game.slug}/`}" aria-disabled="${!game.is_playable}">
              ${game.is_playable ? 'PLAY NOW' : 'RUNTIME BUILDING'}
            </a>
          </article>`).join('')}
      </section>
    </main>`;
}
