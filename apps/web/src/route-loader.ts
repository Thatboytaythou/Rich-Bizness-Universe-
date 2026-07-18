export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;
export type AuthPolicy = 'public' | 'optional' | 'required';
export type PageRegistration = Readonly<{
  auth: AuthPolicy;
  load: () => Promise<PageModule>;
}>;

const pageModules: Record<string, PageRegistration> = {
  home: { auth: 'optional', load: async () => { const module = await import('./pages/home/home.page'); return { mount: module.mountHomePage }; } },
  'tap-in': { auth: 'optional', load: async () => { const module = await import('./pages/tap-in/tap-in.page'); return { mount: module.mountTapInPage }; } },
  profile: {
    auth: 'optional',
    load: async () => {
      await import('./pages/profile/profile-motion.css');
      const module = await import('./pages/profile/profile.page');
      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');
          if (app.dataset.pageOwner === 'rich-bizness-profile-v2') return;
          app.dataset.pageOwner = 'rich-bizness-profile-v2';
          app.replaceChildren();
          await module.mountProfilePage();
        }
      };
    }
  },
  portal: {
    auth: 'required',
    load: async () => {
      const module = await import('./pages/portal/portal.universe');
      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');
          if (app.dataset.pageOwner === 'rich-bizness-portal-v3') return;
          app.dataset.pageOwner = 'rich-bizness-portal-v3';
          app.replaceChildren();
          await module.mountPortalPage();
        }
      };
    }
  },
  gaming: { auth: 'optional', load: async () => { const module = await import('./pages/gaming/gaming.v4.page'); return { mount: module.mountGamingPage }; } },
  feed: { auth: 'optional', load: async () => { await import('./pages/feed/feed-elite.css'); return import('./pages/feed/feed.page'); } },
  gallery: { auth: 'optional', load: () => import('./pages/gallery/gallery.page') },
  live: { auth: 'optional', load: async () => { await import('./styles/live-command-v4.css'); return import('./pages/live/live.page'); } },
  music: { auth: 'optional', load: () => import('./pages/music/music.page') },
  podcast: { auth: 'optional', load: () => import('./pages/podcast/podcast.page') },
  radio: { auth: 'optional', load: () => import('./pages/radio/radio.page') },
  sports: { auth: 'optional', load: () => import('./pages/sports/sports.page') },
  store: { auth: 'optional', load: () => import('./pages/store/store.page') },
  meta: {
    auth: 'required',
    load: async () => {
      await import('./pages/meta/meta-premium.css');
      const module = await import('./pages/meta/meta.page');
      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');
          if (app.dataset.pageOwner === 'rich-bizness-meta-v3') return;
          app.dataset.pageOwner = 'rich-bizness-meta-v3';
          app.replaceChildren();
          await module.mount();
        }
      };
    }
  },
  creator: { auth: 'required', load: () => import('./pages/creator/creator.page') },
  'creator-dimensions': { auth: 'required', load: () => import('./pages/creator/creator-dimensions.page') },
  admin: { auth: 'required', load: () => import('./pages/admin/admin.page') },
  'edit-profile': { auth: 'required', load: () => import('./features/edit-profile/edit-profile.entry') },
  settings: { auth: 'required', load: () => import('./features/communications/settings.page') },
  notifications: { auth: 'required', load: () => import('./features/communications/notifications.page') },
  messages: { auth: 'required', load: () => import('./features/communications/messages.page') },
  upload: { auth: 'required', load: () => import('./features/upload/upload.page') },
  search: { auth: 'optional', load: () => import('./features/search/search.page') },
  watch: { auth: 'optional', load: async () => { await import('./features/watch/watch-elite.css'); return import('./features/watch/watch.page'); } },
  avatar: {
    auth: 'required',
    load: async () => {
      const module = await import('./features/avatar/avatar.selector.page');
      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');
          if (app.dataset.pageOwner === 'rich-bizness-avatar-selector-v2') return;
          app.dataset.pageOwner = 'rich-bizness-avatar-selector-v2';
          app.replaceChildren();
          await module.mount();
        }
      };
    }
  },
  'avatar-characters': {
    auth: 'required',
    load: async () => {
      const module = await import('./features/avatar/avatar.human.page');
      return {
        mount: async () => {
          const app = document.querySelector<HTMLElement>('#app');
          if (!app) throw new Error('Missing #app mount');
          if (app.dataset.pageOwner === 'rich-bizness-avatar-lobby-v3') return;
          app.dataset.pageOwner = 'rich-bizness-avatar-lobby-v3';
          app.replaceChildren();
          await module.mount();
        }
      };
    }
  }
};

export function getPageRegistration(page: string): PageRegistration | null {
  return pageModules[page] ?? null;
}
