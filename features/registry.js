export const RB_FEATURES = Object.freeze({
  home: { route: '/', status: 'active' },
  auth: { route: '/auth.html', status: 'active' },
  profile: { route: '/profile.html', status: 'active' },
  edit: { route: '/edit.html', status: 'active' },
  settings: { route: '/settings.html', status: 'active' },
  avatar: { route: '/avatar.html', status: 'active' },
  characters: { route: '/avatar-characters/', status: 'active' },
  meta: { route: '/meta.html', status: 'needs-depth' },
  feed: { route: '/feed.html', status: 'needs-comments' },
  upload: { route: '/upload.html', status: 'active' },
  messages: { route: '/messages.html', status: 'needs-depth' },
  notifications: { route: '/notifications.html', status: 'needs-reads' },
  live: { route: '/live.html', status: 'needs-chat' },
  watch: { route: '/watch.html', status: 'needs-chat' },
  store: { route: '/store.html', status: 'needs-commerce' },
  music: { route: '/music.html', status: 'needs-social' },
  podcast: { route: '/podcast.html', status: 'needs-social' },
  radio: { route: '/radio.html', status: 'needs-sessions' },
  sports: { route: '/sports.html', status: 'needs-picks' },
  gaming: { route: '/gaming.html', status: 'active' },
  games: { route: '/games.html', status: 'active' },
  search: { route: '/search.html', status: 'active' },
  creator: { route: '/creator.html', status: 'needs-money' },
  admin: { route: '/admin.html', status: 'needs-review' },
  vault: { route: '/rb-secret-door.html', status: 'active' }
});

export function featureForPath(pathname = location.pathname) {
  const clean = pathname === '/' ? '/' : pathname.replace(/\/+$/, '') || '/';
  return Object.entries(RB_FEATURES).find(([, value]) => value.route.replace(/\/+$/, '') === clean)?.[0] || 'home';
}
