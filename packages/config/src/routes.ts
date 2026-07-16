export const ROUTES = Object.freeze({
  home: '/',
  portal: '/portal.html',
  portalPage: '/portal.html',
  tapIn: '/tap-in.html',
  profile: '/profile.html',
  editProfile: '/edit-profile.html',
  settings: '/settings.html',
  notifications: '/notifications.html',
  messages: '/messages.html',
  search: '/search.html',
  upload: '/upload.html',
  creator: '/creator.html',
  admin: '/admin.html',
  feed: '/feed.html',
  gallery: '/gallery.html',
  live: '/live.html',
  watch: '/watch.html',
  music: '/music.html',
  podcast: '/podcast.html',
  radio: '/radio.html',
  sports: '/sports.html',
  store: '/store.html',
  gaming: '/gaming.html',
  meta: '/meta.html',
  avatar: '/avatar.html'
} as const);

export type RouteKey = keyof typeof ROUTES;

export function safeInternalRoute(value: string | null | undefined, fallback = ROUTES.portal): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}