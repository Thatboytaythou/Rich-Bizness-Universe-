import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/media-universe.css';
import '../../styles/gaming-universe.css';

type Row = Record<string, any>;
type Lane = 'games' | 'tournaments' | 'missions' | 'clips' | 'progress' | 'rooms';
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char] ?? char));
const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(Number(value ?? 0) / 100);
const compact = (value: unknown) => new Intl.NumberFormat('en-US', {
  notation: 'compact', maximumFractionDigits: 1
}).format(Number(value ?? 0));
const label = (value: unknown) => String(value || 'elite').replace(/[_-]+/g, ' ').toUpperCase();
const art = (row: Row) => row.cover_url || row.thumbnail_url || row.banner_url || '/images/brand/IMG_5997.png';
const safeLaunch = (value: unknown, fallback = '/gaming.html') => {
  try {
    const url = new URL(String(value || fallback), location.origin);
    return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
};

export async function mountGamingPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.mounted === 'gaming') return;
  root.dataset.mounted = 'gaming';

  const auth = getAuthSnapshot();
  const user = auth.user;
  const userId = user?.id ?? null;
  const profileResult = userId
    ? await supabase.from('profiles').select('username,display_name,avatar_url,rich_level,rich_points,rank_title').eq('id', userId).maybeSingle()
    : { data: null, error: null };
  const profile = (profileResult.data ?? {}) as Row;

  let games: Row[] = [];
  let tournaments: Row[] = [];
  let missions: Row[] = [];
  let clips: Row[] = [];
  let progress: Row[] = [];
  let rewards: Row[] = [];
  let rooms: Row[] = [];
  let lane: Lane = 'games';
  let category = 'all';
  let query = '';
  let featured: Row | null = null;
  let catalogChannel: Channel | null = null;
  let refreshInFlight: Promise<void> | null = null;
  let refreshQueued = false;
  let disposed = false;

  const requested = new URLSearchParams(location.search).get('id');

  root.innerHTML = `<main class="gaming-elite-shell"><div class="gaming-elite-wrap">
    <header class="gaming-command-bar">
      <a class="gaming-back" href="/portal.html" aria-label="Back to Portal">←</a>
      <div class="gaming-command-brand"><span>RICH BIZNESS PLAY NETWORK</span><h1>GAMING UNIVERSE</h1></div>
      <div class="gaming-player-chip"><img src="${esc(profile.avatar_url || '/images/brand/IMG_5997.png')}" alt=""><div><strong>${esc(profile.display_name || profile.username || (user ? 'Rich Player' : 'Public Player'))}</strong><span>${esc(user ? (profile.rank_title || `LEVEL ${profile.rich_level || 1}`) : 'PUBLIC ARCADE')}</span></div></div>
    </header>

    <nav class="gaming-network-rail" aria-label="Gaming network">
      <a href="/watch.html?lane=gaming">WE 🔥 📺</a><a href="/live.html">WE LIT 🔥</a><a href="/feed.html?section=gaming">FEED</a><a href="/upload.html?route=gaming-clips">UPLOAD CLIP</a><a href="/creator.html">CREATOR</a><a href="/store.html?lane=gaming">GAME STORE</a><a href="/profile.html${userId ? `?id=${encodeURIComponent(userId)}` : ''}">PROFILE</a>
    </nav>

    <section id="gamingHero" class="gaming-hero"></section>
    <section id="gamingLiveStrip" class="gaming-live-strip"></section>
    <section id="gamingPlayerDeck" class="gaming-player-deck"></section>

    <nav class="gaming-lanes">${([['games', '◈', 'GAME WORLDS'], ['tournaments', '♛', 'TOURNAMENTS'], ['missions', '✦', 'MISSIONS'], ['rooms', '◉', 'LIVE ROOMS'], ['clips', '▶', 'CLIPS'], ['progress', '↑', 'MY PROGRESS']] as [Lane, string, string][]).map(([value, icon, title], index) => `<button class="gaming-lane ${index ? '' : 'active'}" data-lane="${value}"><span>${icon}</span>${title}</button>`).join('')}</nav>

    <section class="gaming-catalog"><header class="gaming-catalog-head"><div><span class="eyebrow">ELITE GAME COMMAND</span><h2 id="gamingLaneTitle">Game Worlds</h2><p id="gamingLaneCopy">Twenty-eight advanced game worlds with direct launch, multiplayer, tournaments and persistent progression.</p></div><div class="gaming-tools"><label class="gaming-search"><span>⌕</span><input id="gamingSearch" type="search" placeholder="Search games, genres or modes"></label><a class="gaming-upload" href="${user ? '/upload.html?route=gaming-clips' : '/tap-in.html?next=%2Fupload.html%3Froute%3Dgaming-clips'}">UPLOAD CLIP</a></div></header><div id="gamingCategories" class="gaming-categories"></div><div class="gaming-main-grid"><div id="gamingGrid" class="gaming-world-grid"></div><aside id="gamingCommand" class="gaming-inspector"></aside></div></section>

    <section class="gaming-bottom-grid"><article class="gaming-panel"><header><div><span class="eyebrow">LIVE COMPETITION</span><h3>Elite Tournaments</h3></div></header><div id="gamingTournamentList"></div></article><article class="gaming-panel"><header><div><span class="eyebrow">PLAYER VAULT</span><h3>Recent Rewards</h3></div></header><div id="gamingRewardList"></div></article></section>
    <p id="gamingStatus" class="gaming-status" role="status"></p>
  </div></main>`;

  const hero = document.querySelector<HTMLElement>('#gamingHero')!;
  const grid = document.querySelector<HTMLElement>('#gamingGrid')!;
  const command = document.querySelector<HTMLElement>('#gamingCommand')!;
  const cats = document.querySelector<HTMLElement>('#gamingCategories')!;
  const search = document.querySelector<HTMLInputElement>('#gamingSearch')!;
  const liveStrip = document.querySelector<HTMLElement>('#gamingLiveStrip')!;
  const playerDeck = document.querySelector<HTMLElement>('#gamingPlayerDeck')!;
  const tournamentList = document.querySelector<HTMLElement>('#gamingTournamentList')!;
  const rewardList = document.querySelector<HTMLElement>('#gamingRewardList')!;
  const status = document.querySelector<HTMLElement>('#gamingStatus')!;

  const names: Record<Lane, [string, string]> = {
    games: ['Game Worlds', 'Twenty-eight advanced game worlds with direct launch, multiplayer, tournaments and persistent progression.'],
    tournaments: ['Elite Tournaments', 'Ranked seasons, championship brackets and prize pools.'],
    missions: ['Mission Control', 'Daily and world-specific objectives awarding Rich XP.'],
    clips: ['Community Clips', 'Gameplay highlights, boss fights and record moments.'],
    progress: ['Player Progress', user ? 'Every level, score and checkpoint in one command view.' : 'Tap in to synchronize levels, scores and checkpoints.'],
    rooms: ['Live Rooms', 'Active realtime multiplayer rooms across the network.']
  };

  const lanes = (): Record<Lane, Row[]> => ({ games, tournaments, missions, clips, progress, rooms });
  const categories = () => [...new Set(games.map((row) => String(row.game_type || 'other').toLowerCase()))].sort();

  function renderMetrics() {
    const totalXp = progress.reduce((sum, row) => sum + Number(row.xp || 0), 0);
    const best = progress.reduce((score, row) => Math.max(score, Number(row.best_score || 0)), 0);
    const activePlayers = games.reduce((sum, row) => sum + Number(row.active_players || 0), 0);
    const prizePool = tournaments.reduce((sum, row) => sum + Number(row.prize_pool_cents || 0), 0);

    liveStrip.innerHTML = `<article><span class="pulse-dot"></span><small>PLAYABLE WORLDS</small><strong>${games.filter((row) => row.is_playable).length}</strong><p>${games.length === 28 ? 'All 28 production runtimes connected.' : `${games.length} registered worlds connected.`}</p></article><article><small>ACTIVE PLAYERS</small><strong>${compact(activePlayers)}</strong><p>Live across every world.</p></article><article><small>OPEN ROOMS</small><strong>${rooms.length}</strong><p>Realtime multiplayer sessions.</p></article><article><small>PRIZE POOLS</small><strong>${money(prizePool)}</strong><p>Elite tournament rewards.</p></article>`;
    playerDeck.innerHTML = `<article><small>RICH XP</small><strong>${compact(totalXp)}</strong><span>${user ? 'Synced progression' : 'Tap in to sync'}</span></article><article><small>BEST SCORE</small><strong>${compact(best)}</strong><span>Across all worlds</span></article><article><small>RICH POINTS</small><strong>${compact(profile.rich_points || 0)}</strong><span>Player economy</span></article><article><small>REWARDS</small><strong>${rewards.length}</strong><span>Unlocked vault items</span></article>`;
    tournamentList.innerHTML = tournaments.slice(0, 5).map((row) => `<div class="gaming-mini-row"><div><strong>${esc(row.title || row.name || 'Elite Tournament')}</strong><span>${esc(label(row.status || 'OPEN'))}</span></div><b>${money(row.prize_pool_cents)}</b></div>`).join('') || '<div class="gaming-empty">No active tournaments yet.</div>';
    rewardList.innerHTML = user ? (rewards.slice(0, 5).map((row) => `<div class="gaming-mini-row"><div><strong>${esc(row.reward_type || row.badge || 'Game Reward')}</strong><span>${esc(row.status || 'earned')}</span></div><b>${row.xp ? `+${compact(row.xp)} XP` : money(row.amount_cents)}</b></div>`).join('') || '<div class="gaming-empty">Rewards will appear here.</div>') : '<div class="gaming-empty">Tap in to open your player vault.</div>';
  }

  function renderHero() {
    if (!featured) {
      hero.innerHTML = '<div class="gaming-empty">No active worlds.</div>';
      return;
    }
    const playerProgress = progress.find((row) => String(row.game_id) === String(featured!.id));
    const launch = safeLaunch(featured.play_url || `/games/${featured.slug}/`);
    hero.innerHTML = `<article class="gaming-feature" style="--feature-art:url('${esc(art(featured))}')"><div class="gaming-feature-shade"></div><div class="gaming-feature-content"><div class="gaming-feature-badges"><span class="ready"><i></i>${featured.is_playable ? 'PRODUCTION READY' : 'BUILDING'}</span><span>${esc(label(featured.game_type))}</span><span>${esc(label(featured.engine_type || featured.platform_type || 'WEB'))}</span><span>V${esc(featured.version || '1.0')}</span></div><h2>${esc(featured.title)}</h2><p>${esc(featured.description || 'Enter an advanced Rich Bizness world with multiplayer, progression and elite competition.')}</p><div class="gaming-feature-stats"><div><small>LEVEL</small><strong>${playerProgress?.current_level || 1}</strong></div><div><small>BEST</small><strong>${compact(playerProgress?.best_score || 0)}</strong></div><div><small>PLAYERS</small><strong>${compact(featured.active_players || 0)}</strong></div><div><small>PLAYS</small><strong>${compact(featured.total_plays || 0)}</strong></div></div><div class="gaming-feature-actions"><a class="gaming-primary" href="${esc(launch)}">PLAY NOW <span>→</span></a><button id="heroDetails" type="button">GAME DETAILS</button><a href="/watch.html?gaming=${esc(featured.id)}">WATCH CLIPS</a></div></div></article>`;
    document.querySelector<HTMLButtonElement>('#heroDetails')!.onclick = () => open(featured!);
  }

  function renderCats() {
    if (lane !== 'games') {
      cats.hidden = true;
      cats.innerHTML = '';
      return;
    }
    cats.hidden = false;
    cats.innerHTML = [`<button class="${category === 'all' ? 'active' : ''}" data-category="all">ALL <b>${games.length}</b></button>`, ...categories().map((value) => `<button class="${category === value ? 'active' : ''}" data-category="${esc(value)}">${esc(label(value))} <b>${games.filter((row) => String(row.game_type || 'other').toLowerCase() === value).length}</b></button>`)].join('');
    cats.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => {
      button.onclick = () => {
        category = button.dataset.category || 'all';
        renderCats();
        render();
      };
    });
  }

  function rows() {
    return lanes()[lane].filter((row) => {
      const text = `${row.title || ''} ${row.slug || ''} ${row.description || ''} ${row.game_type || ''} ${row.status || ''}`.toLowerCase();
      return (lane !== 'games' || category === 'all' || String(row.game_type || 'other').toLowerCase() === category) && (!query || text.includes(query));
    });
  }

  function render() {
    const [title, copy] = names[lane];
    document.querySelector<HTMLElement>('#gamingLaneTitle')!.textContent = title;
    document.querySelector<HTMLElement>('#gamingLaneCopy')!.textContent = copy;
    const list = rows();
    grid.innerHTML = list.length ? list.map((row, index) => card(row, lane, index)).join('') : '<div class="gaming-empty">No matching worlds.</div>';
    grid.querySelectorAll<HTMLElement>('[data-row]').forEach((element) => {
      element.onclick = () => {
        const row = list.find((entry) => String(entry.id) === element.dataset.row);
        if (!row) return;
        if (lane === 'games') {
          featured = row;
          renderHero();
        }
        open(row);
      };
    });
  }

  function open(row: Row) {
    const playerProgress = progress.find((entry) => String(entry.game_id) === String(row.id)) ?? row;
    const xp = Number(playerProgress.xp || 0);
    const progressPercent = Math.max(4, Math.min(100, Math.round((xp % 500) / 5)));
    const launch = safeLaunch(row.play_url || `/games/${row.slug || ''}/`);
    const capabilities = row.capabilities && typeof row.capabilities === 'object' ? Object.keys(row.capabilities).filter((key) => row.capabilities[key]).slice(0, 4) : [];
    command.innerHTML = `<div class="gaming-inspector-art" style="background-image:linear-gradient(180deg,transparent,rgba(0,0,0,.94)),url('${esc(art(row))}')"><span>${esc(label(row.game_type || row.status))}</span><h3>${esc(row.title || row.game_slug || row.room_code || 'Game World')}</h3></div><div class="gaming-inspector-body"><div class="gaming-detail-line"><span>RUNTIME STATUS</span><strong class="status-ready">${esc(label(row.is_playable ? 'READY' : row.runtime_status || row.status))}</strong></div><div class="gaming-xp"><div><span>LEVEL ${playerProgress.current_level || 1}</span><strong>${compact(xp)} XP</strong></div><i><b style="width:${progressPercent}%"></b></i></div><div class="gaming-detail-grid"><article><small>BEST</small><strong>${compact(playerProgress.best_score || 0)}</strong></article><article><small>PLAYS</small><strong>${compact(row.total_plays || 0)}</strong></article><article><small>ACTIVE</small><strong>${compact(row.active_players || 0)}</strong></article><article><small>ENGINE</small><strong>${esc(label(row.engine_type || row.platform_type || 'WEB'))}</strong></article></div>${capabilities.length ? `<div class="gaming-capabilities">${capabilities.map((value) => `<span>${esc(label(value))}</span>`).join('')}</div>` : ''}${lane === 'games' ? `<a class="gaming-inspector-launch" href="${esc(launch)}">LAUNCH WORLD <span>→</span></a>` : ''}</div>`;
    if (row.id && lane === 'games') history.replaceState({}, '', `/gaming.html?id=${encodeURIComponent(String(row.id))}`);
  }

  async function loadSnapshot() {
    const { data, error } = await supabase.rpc('rb_media_universe_snapshot', {});
    if (error) throw error;
    const gaming = (data as Row)?.gaming ?? {};
    games = (gaming.games ?? []) as Row[];
    tournaments = (gaming.tournaments ?? []) as Row[];
    missions = (gaming.missions ?? []) as Row[];
    clips = (gaming.clips ?? []) as Row[];
    progress = user ? ((gaming.progress ?? []) as Row[]) : [];
    rewards = user ? ((gaming.rewards ?? []) as Row[]) : [];
    rooms = (gaming.rooms ?? []) as Row[];
    featured = games.find((row) => String(row.id) === String(featured?.id || requested)) ?? games.find((row) => row.is_featured) ?? games[0] ?? null;
    renderMetrics();
    renderHero();
    renderCats();
    render();
    if (featured) open(featured);
    status.textContent = games.length === 28 ? 'ALL 28 GAME WORLDS CONNECTED • REALTIME READY' : `${games.length} GAME WORLDS CONNECTED`;
  }

  async function refreshSnapshot() {
    if (refreshInFlight) {
      refreshQueued = true;
      return refreshInFlight;
    }
    refreshInFlight = (async () => {
      try {
        await loadSnapshot();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Gaming refresh failed.';
      }
    })().finally(async () => {
      refreshInFlight = null;
      if (refreshQueued && !disposed) {
        refreshQueued = false;
        await refreshSnapshot();
      }
    });
    return refreshInFlight;
  }

  document.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => {
    button.onclick = () => {
      lane = button.dataset.lane as Lane;
      document.querySelectorAll('[data-lane]').forEach((node) => node.classList.toggle('active', node === button));
      category = 'all';
      query = '';
      search.value = '';
      renderCats();
      render();
      const first = lanes()[lane][0];
      if (first) open(first);
    };
  });
  search.oninput = () => {
    query = search.value.trim().toLowerCase();
    render();
  };

  await loadSnapshot();

  catalogChannel = supabase.channel('gaming-universe-catalog')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => void refreshSnapshot())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_tournaments' }, () => void refreshSnapshot())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_missions' }, () => void refreshSnapshot())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_clips' }, () => void refreshSnapshot())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, () => void refreshSnapshot())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_player_progress', filter: userId ? `user_id=eq.${userId}` : undefined }, () => void refreshSnapshot())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rewards', filter: userId ? `user_id=eq.${userId}` : undefined }, () => void refreshSnapshot())
    .subscribe();

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    search.oninput = null;
    if (catalogChannel) void supabase.removeChannel(catalogChannel);
    catalogChannel = null;
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}

function card(row: Row, lane: Lane, index: number) {
  const title = row.title || row.game_slug || row.mission_key || row.room_code || 'Rich Gaming';
  const badge = lane === 'games' ? (row.is_playable ? 'PLAYABLE' : row.runtime_status) : lane === 'tournaments' ? row.status : lane === 'missions' ? `${row.xp_reward || 0} XP` : lane === 'clips' ? 'CLIP' : lane === 'progress' ? `LEVEL ${row.current_level || 1}` : row.status;
  const metric = lane === 'tournaments' ? money(row.prize_pool_cents) : lane === 'missions' ? `${row.target_value || 0} TARGET` : lane === 'clips' ? `${compact(row.view_count || 0)} VIEWS` : lane === 'progress' ? `${compact(row.best_score || 0)} BEST` : lane === 'rooms' ? row.room_code : `${compact(row.active_players || 0)} ACTIVE`;
  return `<article class="gaming-world-card" data-row="${esc(row.id)}"><div class="gaming-world-art"><img src="${esc(art(row))}" alt=""><span>${esc(label(badge || 'ACTIVE'))}</span><i>${index + 1 < 10 ? '0' : ''}${index + 1}</i></div><div class="gaming-world-body"><div><small>${esc(label(row.game_type || lane))}</small><h3>${esc(title)}</h3></div><p>${esc(row.description || row.caption || row.mission_type || 'Advanced Rich Bizness gaming world.')}</p><footer><span>${esc(String(metric || 'ACTIVE'))}</span><b>${esc(label(row.engine_type || row.platform_type || row.status || 'WEB'))}</b></footer></div></article>`;
}
