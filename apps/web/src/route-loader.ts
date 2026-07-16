export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;

export type PageDefinition = Readonly<{
  initializeAuth: boolean;
  load: () => Promise<PageModule>;
}>;

const pageModules: Readonly<Record<string, PageDefinition>> = Object.freeze({
  portal: {
    initializeAuth: true,
    load: () => import('./pages/portal/portal.page')
  },
  'tap-in': {
    initializeAuth: false,
    load: () => import('./pages/tap-in/tap-in.page')
  },
  profile: {
    initializeAuth: false,
    load: () => import('./pages/profile/profile.page')
  },
  gaming: {
    initializeAuth: true,
    load: () => import('./pages/gaming/gaming.page')
  },
  feed: { initializeAuth: true, load: () => import('./pages/feed/feed.page') },
  gallery: { initializeAuth: true, load: () => import('./pages/gallery/gallery.page') },
  live: { initializeAuth: true, load: () => import('./pages/live/live.page') },
  music: { initializeAuth: true, load: () => import('./pages/music/music.page') },
  podcast: { initializeAuth: true, load: () => import('./pages/podcast/podcast.page') },
  radio: { initializeAuth: true, load: () => import('./pages/radio/radio.page') },
  sports: { initializeAuth: true, load: () => import('./pages/sports/sports.page') },
  store: { initializeAuth: true, load: () => import('./pages/store/store.page') },
  meta: { initializeAuth: true, load: () => import('./pages/meta/meta.page') },
  creator: { initializeAuth: true, load: () => import('./pages/creator/creator.page') },
  admin: { initializeAuth: true, load: () => import('./pages/admin/admin.page') },
  'edit-profile': { initializeAuth: true, load: () => import('./features/edit-profile/edit-profile.entry') },
  settings: { initializeAuth: true, load: () => import('./features/communications/settings.page') },
  notifications: { initializeAuth: true, load: () => import('./features/communications/notifications.page') },
  messages: { initializeAuth: true, load: () => import('./features/communications/messages.page') },
  upload: { initializeAuth: true, load: () => import('./features/upload/upload.page') },
  search: { initializeAuth: true, load: () => import('./features/search/search.page') },
  watch: { initializeAuth: true, load: () => import('./features/watch/watch.page') },
  avatar: { initializeAuth: true, load: () => import('./features/avatar/avatar.entry') }
});

export function getPageDefinition(page: string): PageDefinition | null {
  return pageModules[page] ?? null;
}
