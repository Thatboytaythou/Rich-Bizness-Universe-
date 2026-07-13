export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;

const routeShell = () => import('./features/route-shell/route-shell.page');

const pageModules: Record<string, () => Promise<PageModule>> = {
  feed: () => import('./pages/feed/feed.page'),
  gallery: () => import('./pages/gallery/gallery.page'),
  live: () => import('./pages/live/live.page'),
  music: () => import('./pages/music/music.page'),
  sports: () => import('./pages/sports/sports.page'),
  store: () => import('./pages/store/store.page'),
  meta: () => import('./pages/meta/meta.page'),
  creator: () => import('./pages/creator/creator.page'),
  admin: () => import('./pages/admin/admin.page'),
  'edit-profile': routeShell,
  settings: routeShell,
  notifications: routeShell,
  messages: routeShell,
  search: routeShell,
  upload: routeShell,
  watch: routeShell,
  avatar: routeShell
};

export async function loadPageModule(page: string): Promise<PageModule | null> {
  const loader = pageModules[page];
  if (!loader) return null;
  return loader();
}
