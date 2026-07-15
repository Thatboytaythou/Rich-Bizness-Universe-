export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;
export type PageAuthMode = 'public' | 'optional' | 'required';

export type PageDefinition = Readonly<{
  auth: PageAuthMode;
  load: () => Promise<PageModule>;
}>;

const pageModules: Record<string, PageDefinition> = {
  portal: { auth: 'optional', load: () => import('./pages/portal/portal.page') },
  'tap-in': { auth: 'public', load: () => import('./pages/tap-in/tap-in.page') },
  profile: { auth: 'required', load: () => import('./pages/profile/profile.page') },
  gaming: { auth: 'required', load: () => import('./pages/gaming/gaming.page') },
  feed: { auth: 'required', load: () => import('./pages/feed/feed.page') },
  gallery: { auth: 'required', load: () => import('./pages/gallery/gallery.page') },
  live: { auth: 'required', load: () => import('./pages/live/live.page') },
  music: { auth: 'required', load: () => import('./pages/music/music.page') },
  podcast: { auth: 'required', load: () => import('./pages/podcast/podcast.page') },
  radio: { auth: 'required', load: () => import('./pages/radio/radio.page') },
  sports: { auth: 'required', load: () => import('./pages/sports/sports.page') },
  store: { auth: 'required', load: () => import('./pages/store/store.page') },
  meta: { auth: 'required', load: () => import('./pages/meta/meta.page') },
  creator: { auth: 'required', load: () => import('./pages/creator/creator.page') },
  admin: { auth: 'required', load: () => import('./pages/admin/admin.page') },
  'edit-profile': { auth: 'required', load: () => import('./features/edit-profile/edit-profile.entry') },
  settings: { auth: 'required', load: () => import('./features/communications/settings.page') },
  notifications: { auth: 'required', load: () => import('./features/communications/notifications.page') },
  messages: { auth: 'required', load: () => import('./features/communications/messages.page') },
  upload: { auth: 'required', load: () => import('./features/upload/upload.page') },
  search: { auth: 'required', load: () => import('./features/search/search.page') },
  watch: { auth: 'required', load: () => import('./features/watch/watch.page') },
  avatar: { auth: 'required', load: () => import('./features/avatar/avatar.entry') }
};

export function getPageDefinition(page: string): PageDefinition | null {
  return pageModules[page] ?? null;
}
