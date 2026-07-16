export type PageModule = Readonly<{ mount: () => void | Promise<void> }>;
export type AuthPolicy = 'public' | 'optional' | 'required';
export type PageRegistration = Readonly<{
  auth: AuthPolicy;
  load: () => Promise<PageModule>;
}>;

const pageModules: Record<string, PageRegistration> = {
  home: { auth: 'public', load: async () => { const module = await import('./pages/home/home.page'); return { mount: module.mountHomePage }; } },
  'tap-in': { auth: 'public', load: async () => { const module = await import('./pages/tap-in/tap-in.page'); return { mount: module.mountTapInPage }; } },
  profile: { auth: 'optional', load: async () => { const module = await import('./pages/profile/profile.page'); return { mount: module.mountProfilePage }; } },
  portal: { auth: 'required', load: async () => { const module = await import('./pages/portal/portal.page'); return { mount: module.mountPortalPage }; } },
  gaming: { auth: 'optional', load: async () => { const module = await import('./pages/gaming/gaming.page'); return { mount: module.mountGamingPage }; } },
  feed: { auth: 'optional', load: () => import('./pages/feed/feed.page') },
  gallery: { auth: 'optional', load: () => import('./pages/gallery/gallery.page') },
  live: { auth: 'optional', load: () => import('./pages/live/live.page') },
  music: { auth: 'optional', load: () => import('./pages/music/music.page') },
  podcast: { auth: 'optional', load: () => import('./pages/podcast/podcast.page') },
  radio: { auth: 'optional', load: () => import('./pages/radio/radio.page') },
  sports: { auth: 'optional', load: () => import('./pages/sports/sports.page') },
  store: { auth: 'optional', load: () => import('./pages/store/store.page') },
  meta: { auth: 'optional', load: () => import('./pages/meta/meta.page') },
  creator: { auth: 'optional', load: () => import('./pages/creator/creator.page') },
  admin: { auth: 'optional', load: () => import('./pages/admin/admin.page') },
  'edit-profile': { auth: 'optional', load: () => import('./features/edit-profile/edit-profile.entry') },
  settings: { auth: 'optional', load: () => import('./features/communications/settings.page') },
  notifications: { auth: 'optional', load: () => import('./features/communications/notifications.page') },
  messages: { auth: 'optional', load: () => import('./features/communications/messages.page') },
  upload: { auth: 'optional', load: () => import('./features/upload/upload.page') },
  search: { auth: 'optional', load: () => import('./features/search/search.page') },
  watch: { auth: 'optional', load: () => import('./features/watch/watch.page') },
  avatar: { auth: 'required', load: () => import('./features/avatar/avatar.entry') },
  'avatar-characters': { auth: 'required', load: () => import('./features/avatar/avatar.characters.entry') }
};

export function getPageRegistration(page: string): PageRegistration | null {
  return pageModules[page] ?? null;
}
