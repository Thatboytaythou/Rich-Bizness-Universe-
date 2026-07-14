export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;

const pageModules: Record<string, () => Promise<PageModule>> = {
  feed: () => import('./pages/feed/feed.page'),
  gallery: () => import('./pages/gallery/gallery.page'),
  live: () => import('./pages/live/live.page'),
  music: () => import('./pages/music/music.page'),
  podcast: () => import('./pages/podcast/podcast.page'),
  radio: () => import('./pages/radio/radio.page'),
  sports: () => import('./pages/sports/sports.page'),
  store: () => import('./pages/store/store.page'),
  meta: () => import('./pages/meta/meta.page'),
  creator: () => import('./pages/creator/creator.page'),
  admin: () => import('./pages/admin/admin.page'),
  'edit-profile': () => import('./features/edit-profile/edit-profile.page'),
  settings: () => import('./features/communications/settings.page'),
  notifications: () => import('./features/communications/notifications.page'),
  messages: () => import('./features/communications/messages.page'),
  upload: () => import('./features/upload/upload.page'),
  search: () => import('./features/search/search.page'),
  watch: () => import('./features/watch/watch.page'),
  avatar: () => import('./features/avatar/avatar.entry')
};

export async function loadPageModule(page: string): Promise<PageModule | null> {
  const loader = pageModules[page];
  if (!loader) return null;
  return loader();
}
