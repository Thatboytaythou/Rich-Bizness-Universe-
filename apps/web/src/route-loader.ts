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

          const activeOwner = app.dataset.pageOwner;
          if (activeOwner === owner && app.dataset.pageMounted === 'true') return;
          if (activeOwner && activeOwner !== owner) {
            throw new Error(`Route owner conflict: ${activeOwner} tried to overlap ${owner}`);
          }

          app.dataset.pageOwner = owner;
          app.dataset.pageMounted = 'false';
          app.replaceChildren();

          try {
            await (mount as () => void | Promise<void>)();
            app.dataset.pageMounted = 'true';
          } catch (error) {
            delete app.dataset.pageMounted;
            delete app.dataset.pageOwner;
            app.replaceChildren();
            throw error;
          }
        }
      };
    }
  };
}

const pageModules: Record<string, PageRegistration> = {
  home: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-home-v1', exportName: 'mountHomePage', loadModule: () => import('./pages/home/home.page') }),
  'tap-in': guardedRegistration({ auth: 'optional', owner: 'rich-bizness-tap-in-v2', exportName: 'mountTapInPage', loadModule: () => import('./pages/tap-in/tap-in.page') }),

  profile: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-profile-v2', exportName: 'mountProfilePage', preload: [() => import('./pages/profile/profile-motion.css')], loadModule: () => import('./pages/profile/profile.page') }),
  portal: guardedRegistration({ auth: 'required', owner: 'rich-bizness-portal-v3', exportName: 'mountPortalPage', loadModule: () => import('./pages/portal/portal.universe') }),
  gaming: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gaming-v5', exportName: 'mountGamingPage', loadModule: () => import('./pages/gaming/gaming.v4.page') }),
  feed: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-feed-v3', loadModule: () => import('./pages/feed/feed.page') }),
  gallery: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gallery-v3', loadModule: () => import('./pages/gallery/gallery.page') }),
  live: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-live-v4', preload: [() => import('./pages/live/live-universe.css'), () => import('./styles/live-command-v4.css')], loadModule: () => import('./pages/live/live.page') }),
  music: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-music-v3', loadModule: () => import('./pages/music/music.page') }),
  podcast: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-podcast-v3', loadModule: () => import('./pages/podcast/podcast.page') }),
  radio: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-radio-v3', loadModule: () => import('./pages/radio/radio.page') }),
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
  watch: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-watch-v3', loadModule: () => import('./features/watch/watch.page') }),
  avatar: guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-selector-v2', loadModule: () => import('./features/avatar/avatar.selector.page') }),
  'avatar-characters': guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-lobby-v3', loadModule: () => import('./features/avatar/avatar.human.page') })
};

export function getPageRegistration(page: string): PageRegistration | null {
  return pageModules[page] ?? null;
}
