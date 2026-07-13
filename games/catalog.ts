export type GameStatus = 'building' | 'alpha' | 'beta' | 'ready';

export type GameCatalogEntry = Readonly<{
  slug: string;
  title: string;
  route: string;
  manifest: string;
  entry: string;
  genre: string;
  status: GameStatus;
  mobile: boolean;
  multiplayer: boolean;
}>;

const defineGame = (
  slug: string,
  title: string,
  genre: string,
  options: Partial<Pick<GameCatalogEntry, 'status' | 'mobile' | 'multiplayer'>> = {}
): GameCatalogEntry => Object.freeze({
  slug,
  title,
  genre,
  route: `/games/${slug}/`,
  manifest: `./${slug}/manifest.ts`,
  entry: `./${slug}/game.ts`,
  status: options.status ?? 'building',
  mobile: options.mobile ?? true,
  multiplayer: options.multiplayer ?? false
});

export const GAME_CATALOG = Object.freeze([
  defineGame('avatar-free-roam', 'Avatar Free Roam', 'simulation', { status: 'alpha', multiplayer: true }),
  defineGame('bizness-party-room', 'Bizness Party Room', 'party', { multiplayer: true }),
  defineGame('boss-walk-battle', 'Boss Walk Battle', 'rhythm-combat', { multiplayer: true }),
  defineGame('cash-rain-catcher', 'Cash Rain Catcher', 'arcade'),
  defineGame('diamond-bat-flip', 'Diamond Bat Flip', 'sports-arcade'),
  defineGame('dj-radio-run', 'DJ Radio Run', 'rhythm-runner'),
  defineGame('empire-builder', 'Empire Builder', 'strategy'),
  defineGame('golf-green-gold', 'Golf Green Gold', 'sports'),
  defineGame('gym-grind-reps', 'Gym Grind Reps', 'fitness-arcade'),
  defineGame('hero-villain-showdown', 'Hero Villain Showdown', 'action-rpg', { multiplayer: true }),
  defineGame('market-flip', 'Market Flip', 'strategy-simulation'),
  defineGame('money-road-runner', 'Money Road Runner', 'runner'),
  defineGame('portal-dash', 'Portal Dash', 'arcade-runner'),
  defineGame('portal-room-rush', 'Portal Room Rush', 'party-action', { multiplayer: true }),
  defineGame('rich-chess', 'Rich Chess', 'board-strategy', { multiplayer: true }),
  defineGame('rich-court-king', 'Rich Court King', 'basketball', { multiplayer: true }),
  defineGame('rich-runner', 'Rich Runner', 'runner'),
  defineGame('smoke-burst-arena', 'Smoke Burst Arena', 'arena-action', { multiplayer: true }),
  defineGame('smoke-city-hustle', 'Smoke City Hustle', 'open-world-action', { multiplayer: true }),
  defineGame('smoke-room-cards', 'Smoke Room Cards', 'cards', { multiplayer: true }),
  defineGame('smoke-tap', 'Smoke Tap', 'idle-arcade'),
  defineGame('studio-showdown', 'Studio Showdown', 'music-battle', { multiplayer: true }),
  defineGame('treehouse-ride', 'Treehouse Ride', 'driving-adventure'),
  defineGame('vault-unlock', 'Vault Unlock', 'puzzle')
] satisfies readonly GameCatalogEntry[]);

if (GAME_CATALOG.length !== 24) {
  throw new Error(`Expected 24 games, received ${GAME_CATALOG.length}`);
}

const slugs = new Set(GAME_CATALOG.map((game) => game.slug));
if (slugs.size !== GAME_CATALOG.length) {
  throw new Error('Duplicate game slug detected in GAME_CATALOG');
}

export const GAME_BY_SLUG = Object.freeze(
  Object.fromEntries(GAME_CATALOG.map((game) => [game.slug, game])) as Record<string, GameCatalogEntry>
);

export const getGameBySlug = (slug: string): GameCatalogEntry | null => GAME_BY_SLUG[slug] ?? null;
