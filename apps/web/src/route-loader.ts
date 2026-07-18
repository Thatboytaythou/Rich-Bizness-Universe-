export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;
export type AuthPolicy = 'public' | 'optional' | 'required';
export type PageRegistration = Readonly<{
  auth: AuthPolicy;
  load: () => Promise<PageModule>;
}>;

const pageModules: Record<string, PageRegistration> = {
  home: { auth: 'optional', load: async () => { const module = await import('./pages/home/home.page'); return { mount: module.mountHomePage }; } },
  'tap-in': { auth: 'optional', load: async () => { await import('./pages/tap-in/tap-in.elite.css'); const module = await import('./pages/tap-in/tap-in.page'); return { mount: module.mountTapInPage }; } },
  profile: { auth: 'optional', load: async () => { const module = await import('./pages/profile/profile.page'); return { mount: module.mountProfilePage }; } },
  portal: { auth: 'required', load: async () => { const module = await import('./pages/portal/portal.page'); return { mount: module.mountPortalPage }; } },
  gaming: { auth: 'optional', load: async () => { const module = await import('./pages/gaming/gaming.v4.page'); return { mount: module.mountGamingPage }; } },
  feed: { auth: 'optional', load: async () => { await import('./pages/feed/feed-elite.css'); return import('./pages/feed/feed.page'); } },
  gallery: { auth: 'optional', load: () => import('./pages/gallery/gallery.page') },
  live: { auth: 'optional', load: async () => { await import('./styles/live-command-v4.css'); return import('./pages/live/live.page'); } },
  music: { auth: 'optional', load: () => import('./pages/music/music.page') },
  podcast: { auth: 'optional', load: () => import('./pages/podcast/podcast.page') },
  radio: { auth: 'optional', load: () => import('./pages/radio/radio.page') },
  sports: { auth: 'optional', load: () => import('./pages/sports/sports.page') },
  store: { auth: 'optional', load: () => import('./pages/store/store.page') },
  meta: { auth: 'required', load: () => import('./pages/meta/meta.page') },
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
  avatar: { auth: 'required', load: () => import('./features/avatar/avatar.entry') },
  'avatar-characters': { auth: 'required', load: () => import('./features/avatar/avatar.characters.entry') }
};

export function getPageRegistration(page: string): PageRegistration | null {
  return pageModules[page] ?? null;
}