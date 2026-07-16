export const GAMES = Object.freeze([
  { slug: 'rich-chess', route: '/rich-chess', title: 'Rich Chess' },
  { slug: 'smoke-room-cards', route: '/smoke-room-cards', title: 'Smoke Room Cards' },
  { slug: 'dj-radio-run', route: '/dj-radio-run', title: 'DJ Radio Run' },
  { slug: 'money-road-runner', route: '/money-road-runner', title: 'Money Road Runner' },
  { slug: 'rich-samurais-son-ninja', route: '/rich-samurais-son-ninja', title: "Rich Samurai's Son Ninja" },
  { slug: 'aura-shinobi-clash', route: '/aura-shinobi-clash', title: 'Aura Shinobi Clash' },
  { slug: 'boss-walk-battle', route: '/boss-walk-battle', title: 'Boss Walk Battle' },
  { slug: 'smoke-burst-arena', route: '/smoke-burst-arena', title: 'Smoke Burst Arena' },
  { slug: 'hero-villain-showdown', route: '/hero-villain-showdown', title: 'Hero Villain Showdown' },
  { slug: 'empire-builder', route: '/empire-builder', title: 'Empire Builder' },
  { slug: 'market-flip', route: '/market-flip', title: 'Market Flip' },
  { slug: 'vault-unlock', route: '/vault-unlock', title: 'Vault Unlock' },
  { slug: 'portal-room-rush', route: '/portal-room-rush', title: 'Portal Room Rush' },
  { slug: 'avatar-free-roam', route: '/avatar-free-roam', title: 'Avatar Free Roam' },
  { slug: 'smoke-city-hustle', route: '/smoke-city-hustle', title: 'Smoke City Hustle' },
  { slug: 'treehouse-ride', route: '/treehouse-ride', title: 'Treehouse Ride' },
  { slug: 'studio-showdown', route: '/studio-showdown', title: 'Studio Showdown' },
  { slug: 'rich-court-king', route: '/rich-court-king', title: 'Rich Court King' },
  { slug: 'diamond-bat-flip', route: '/diamond-bat-flip', title: 'Diamond Bat Flip' },
  { slug: 'golf-green-gold', route: '/golf-green-gold', title: 'Golf Green Gold' },
  { slug: 'gym-grind-reps', route: '/gym-grind-reps', title: 'Gym Grind Reps' },
  { slug: 'cash-rain-catcher', route: '/cash-rain-catcher', title: 'Cash Rain Catcher' },
  { slug: 'portal-dash', route: '/portal-dash', title: 'Portal Dash' },
  { slug: 'bizness-party-room', route: '/bizness-party-room', title: 'Bizness Party Room' },
  { slug: 'rich-color-clash', route: '/rich-color-clash', title: 'Rich Color Clash' },
  { slug: 'rich-spades-royale', route: '/rich-spades-royale', title: 'Rich Spades Royale' },
  { slug: 'rich-checkers-elite', route: '/rich-checkers-elite', title: 'Rich Checkers Elite' },
  { slug: 'crown-connect-four', route: '/crown-connect-four', title: 'Crown Connect Four' }
] as const);

export type GameDefinition = (typeof GAMES)[number];
export type GameSlug = GameDefinition['slug'];

export const GAME_BY_SLUG = Object.freeze(
  Object.fromEntries(GAMES.map((game) => [game.slug, game])) as Record<GameSlug, GameDefinition>
);
