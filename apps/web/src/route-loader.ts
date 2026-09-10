export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;
export type AuthPolicy = 'public' | 'optional' | 'required';
export type PageRegistration = Readonly<{ auth: AuthPolicy; owner: string; load: () => Promise<PageModule> }>;

type MountModule = Readonly<Record<string, unknown>>;
type RegistrationOptions = Readonly<{
  auth: AuthPolicy;
  owner: string;
  loadModule: () => Promise<MountModule>;
  exportName?: string;
  preload?: readonly (() => Promise<unknown>)[];
}>;

const OWNER_KEY = 'pageOwner';
const MOUNTED_KEY = 'pageMounted';
const EPOCH_KEY = 'pageEpoch';
const CLEANUP_KEY = '__rbPageCleanup';

type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

async function runPreviousCleanup(): Promise<void> {
  const host = window as CleanupHost;
  const cleanup = host[CLEANUP_KEY as keyof CleanupHost] as (() => void | Promise<void>) | null | undefined;
  host.__rbPageCleanup = null;
  if (typeof cleanup === 'function') await cleanup();
}

function resetMountState(app: HTMLElement): void {
  app.replaceChildren();
  delete app.dataset[OWNER_KEY];
  delete app.dataset[MOUNTED_KEY];
}

function guardedRegistration({ auth, owner, loadModule, exportName = 'mount', preload = [] }: RegistrationOptions): PageRegistration {
  return {
    auth,
    owner,
    load: async () => {
      if (preload.length) await Promise.all(preload.map((load) => load()));
      const module = await loadModule();
      const mount = module[exportName];
      if (typeof mount !== 'function') throw new Error(`Missing ${exportName}() for ${owner}`);

      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');

          const epoch = String(Number(app.dataset[EPOCH_KEY] ?? '0') + 1);
          app.dataset[EPOCH_KEY] = epoch;

          const activeOwner = app.dataset[OWNER_KEY];
          const alreadyMounted = activeOwner === owner && app.dataset[MOUNTED_KEY] === 'true';
          if (alreadyMounted) return;

          await runPreviousCleanup();
          resetMountState(app);
          app.dataset[OWNER_KEY] = owner;
          app.dataset[MOUNTED_KEY] = 'false';

          try {
            await (mount as () => void | Promise<void>)();
            if (app.dataset[EPOCH_KEY] !== epoch) return;
            app.dataset[MOUNTED_KEY] = 'true';
          } catch (error) {
            if (app.dataset[EPOCH_KEY] === epoch) resetMountState(app);
            throw error;
          }
        }
      };
    }
  };
}

const gameRegistration = (slug: string): PageRegistration => {
  const moduleName = slug;
  const exportName = 'mount';
  const owners = `rich-bizness-game-${slug}-v1`;
  const loaders: Record<string, () => Promise<MountModule>> = {
    'rich-chess': () => import('./pages/games/rich-chess.page'),
    'smoke-room-cards': () => import('./pages/games/smoke-room-cards.page'),
    'dj-radio-run': () => import('./pages/games/dj-radio-run.page'),
    'money-road-runner': () => import('./pages/games/money-road-runner.page'),
    'rich-samurais-son-ninja': () => import('./pages/games/rich-samurais-son-ninja.page'),
    'aura-shinobi-clash': () => import('./pages/games/aura-shinobi-clash.page'),
    'boss-walk-battle': () => import('./pages/games/boss-walk-battle.page'),
    'smoke-burst-arena': () => import('./pages/games/smoke-burst-arena.page'),
    'hero-villain-showdown': () => import('./pages/games/hero-villain-showdown.page'),
    'empire-builder': () => import('./pages/games/empire-builder.page'),
    'market-flip': () => import('./pages/games/market-flip.page'),
    'vault-unlock': () => import('./pages/games/vault-unlock.page'),
    'portal-room-rush': () => import('./pages/games/portal-room-rush.page'),
    'avatar-free-roam': () => import('./pages/games/avatar-free-roam.page'),
    'smoke-city-hustle': () => import('./pages/games/smoke-city-hustle.page'),
    'treehouse-ride': () => import('./pages/games/treehouse-ride.page'),
    'studio-showdown': () => import('./pages/games/studio-showdown.page'),
    'rich-court-king': () => import('./pages/games/rich-court-king.page'),
    'diamond-bat-flip': () => import('./pages/games/diamond-bat-flip.page'),
    'golf-green-gold': () => import('./pages/games/golf-green-gold.page'),
    'gym-grind-reps': () => import('./pages/games/gym-grind-reps.page'),
    'cash-rain-catcher': () => import('./pages/games/cash-rain-catcher.page'),
    'portal-dash': () => import('./pages/games/portal-dash.page'),
    'bizness-party-room': () => import('./pages/games/bizness-party-room.page'),
    'rich-color-clash': () => import('./pages/games/rich-color-clash.page'),
    'rich-spades-royale': () => import('./pages/games/rich-spades-royale.page'),
    'rich-checkers-elite': () => import('./pages/games/rich-checkers-elite.page'),
    'crown-connect-four': () => import('./pages/games/crown-connect-four.page')
  };

  const loadModule = loaders[slug];
  if (!loadModule) throw new Error(`No game loader registered for ${moduleName}`);
  return guardedRegistration({ auth: 'optional', owner: owners, exportName, loadModule });
};

const pageModules: Record<string, PageRegistration> = {
  home: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-home-v1', exportName: 'mountHomePage', loadModule: () => import('./pages/home/home.page') }),
  'tap-in': guardedRegistration({ auth: 'optional', owner: 'rich-bizness-tap-in-v2', exportName: 'mountTapInPage', loadModule: () => import('./pages/tap-in/tap-in.page') }),
  profile: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-profile-v2', preload: [() => import('./pages/profile/profile-motion.css')], loadModule: () => import('./pages/profile/profile.page') }),
  portal: guardedRegistration({ auth: 'required', owner: 'rich-bizness-portal-v3', exportName: 'mountPortalPage', loadModule: () => import('./pages/portal/portal.universe') }),
  gaming: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gaming-v6', exportName: 'mountGamingPage', loadModule: () => import('./pages/gaming/gaming.v4.page') }),
  feed: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-feed-v3', loadModule: () => import('./pages/feed/feed.page') }),
  gallery: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gallery-v3', loadModule: () => import('./pages/gallery/gallery.page') }),
  live: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-live-v5', preload: [() => import('./pages/live/live-universe.css'), () => import('./styles/live-command-v4.css')], loadModule: () => import('./pages/live/live.page') }),
  music: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-music-v4', loadModule: () => import('./pages/music/music.page') }),
  podcast: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-podcast-v4', loadModule: () => import('./pages/podcast/podcast.page') }),
  radio: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-radio-v4', loadModule: () => import('./pages/radio/radio.page') }),
  sports: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-sports-v3', loadModule: () => import('./pages/sports/sports.page') }),
  store: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-store-v2', loadModule: () => import('./pages/store/store.page') }),
  meta: guardedRegistration({ auth: 'required', owner: 'rich-bizness-meta-v3', preload: [() => import('./pages/meta/meta-premium.css')], loadModule: () => import('./pages/meta/meta.page') }),
  creator: guardedRegistration({ auth: 'required', owner: 'rich-bizness-creator-v4', loadModule: () => import('./pages/creator/creator.page') }),
  'creator-dimensions': guardedRegistration({ auth: 'required', owner: 'rich-bizness-creator-dimensions-v3', loadModule: () => import('./pages/creator/creator-dimensions.page') }),
  admin: guardedRegistration({ auth: 'required', owner: 'rich-bizness-admin-v3', preload: [() => import('./pages/admin/admin-secret-motion.css')], loadModule: () => import('./pages/admin/admin.page') }),
  'edit-profile': guardedRegistration({ auth: 'required', owner: 'rich-bizness-edit-profile-v2', preload: [() => import('./features/edit-profile/edit-profile-motion.css')], loadModule: () => import('./features/edit-profile/edit-profile.page') }),
  settings: guardedRegistration({ auth: 'required', owner: 'rich-bizness-settings-v2', preload: [() => import('./features/communications/settings-motion.css')], loadModule: () => import('./features/communications/settings.page') }),
  notifications: guardedRegistration({ auth: 'required', owner: 'rich-bizness-notifications-v2', preload: [() => import('./features/communications/notifications-motion.css')], loadModule: () => import('./features/communications/notifications.page') }),
  messages: guardedRegistration({ auth: 'required', owner: 'rich-bizness-messages-v3', preload: [() => import('./features/communications/messages-motion.css')], loadModule: () => import('./features/communications/messages.page') }),
  upload: guardedRegistration({ auth: 'required', owner: 'rich-bizness-upload-v3', loadModule: () => import('./features/upload/upload.page') }),
  search: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-search-v3', loadModule: () => import('./features/search/search.page') }),
  watch: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-watch-v4', loadModule: () => import('./features/watch/watch.page') }),
  avatar: guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-lobby-v1', loadModule: () => import('./features/avatar/avatar.lobby.page') }),
  'avatar-characters': guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-characters-v1', loadModule: () => import('./features/avatar/avatar.characters.page') }),
  'avatar-free-roam': gameRegistration('avatar-free-roam'),
  'rich-chess': gameRegistration('rich-chess'),
  'smoke-room-cards': gameRegistration('smoke-room-cards'),
  'dj-radio-run': gameRegistration('dj-radio-run'),
  'money-road-runner': gameRegistration('money-road-runner'),
  'rich-samurais-son-ninja': gameRegistration('rich-samurais-son-ninja'),
  'aura-shinobi-clash': gameRegistration('aura-shinobi-clash'),
  'boss-walk-battle': gameRegistration('boss-walk-battle'),
  'smoke-burst-arena': gameRegistration('smoke-burst-arena'),
  'hero-villain-showdown': gameRegistration('hero-villain-showdown'),
  'empire-builder': gameRegistration('empire-builder'),
  'market-flip': gameRegistration('market-flip'),
  'vault-unlock': gameRegistration('vault-unlock'),
  'portal-room-rush': gameRegistration('portal-room-rush'),
  'smoke-city-hustle': gameRegistration('smoke-city-hustle'),
  'treehouse-ride': gameRegistration('treehouse-ride'),
  'studio-showdown': gameRegistration('studio-showdown'),
  'rich-court-king': gameRegistration('rich-court-king'),
  'diamond-bat-flip': gameRegistration('diamond-bat-flip'),
  'golf-green-gold': gameRegistration('golf-green-gold'),
  'gym-grind-reps': gameRegistration('gym-grind-reps'),
  'cash-rain-catcher': gameRegistration('cash-rain-catcher'),
  'portal-dash': gameRegistration('portal-dash'),
  'bizness-party-room': gameRegistration('bizness-party-room'),
  'rich-color-clash': gameRegistration('rich-color-clash'),
  'rich-spades-royale': gameRegistration('rich-spades-royale'),
  'rich-checkers-elite': gameRegistration('rich-checkers-elite'),
  'crown-connect-four': gameRegistration('crown-connect-four')
};

export function getPageRegistration(page: string): PageRegistration | null {
  return pageModules[page] ?? null;
}
