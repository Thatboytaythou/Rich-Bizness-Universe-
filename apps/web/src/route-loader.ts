export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;
export type AuthPolicy = 'public' | 'optional' | 'required';
export type PageRegistration = Readonly<{ auth: AuthPolicy; load: () => Promise<PageModule> }>;

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
    load: async () => {
      if (preload.length) await Promise.all(preload.map((load) => load()));
      const module = await loadModule();
      const mount = module[exportName];
      if (typeof mount !== 'function') throw new Error(`Missing ${exportName}() for ${owner}`);

      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');
          if (app.dataset.pageOwner === owner) return;

          app.dataset.pageOwner = owner;
          app.replaceChildren();
          await (mount as () => void | Promise<void>)();
        }
      };
    }
  };
}

const pageModules: Record<string, PageRegistration> = {
  home: { auth: 'optional', load: async () => { const module = await import('./pages/home/home.page'); return { mount: module.mountHomePage }; } },
  'tap-in': { auth: 'optional', load: async () => { const module = await import('./pages/tap-in/tap-in.page'); return { mount: module.mountTapInPage }; } },

  profile: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-profile-v2', exportName: 'mountProfilePage', preload: [() => import('./pages/profile/profile-motion.css')], loadModule: () => import('./pages/profile/profile.page') }),
  portal: guardedRegistration({ auth: 'required', owner: 'rich-bizness-portal-v3', exportName: 'mountPortalPage', loadModule: () => import('./pages/portal/portal.universe') }),
  gaming: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gaming-v4', exportName: 'mountGamingPage', loadModule: () => import('./pages/gaming/gaming.v4.page') }),
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
