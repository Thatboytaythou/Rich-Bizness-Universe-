const routes = [
  '/', '/auth.html', '/profile.html', '/avatar.html', '/avatar-characters/', '/feed.html', '/upload.html', '/search.html', '/live.html', '/watch.html', '/music.html', '/podcast.html', '/radio.html', '/gaming.html', '/games/', '/sports.html', '/gallery.html', '/store.html', '/meta.html', '/messages.html', '/notifications.html', '/creator.html', '/admin.html', '/edit.html', '/settings.html', '/rb-secret-door.html'
];

export default function handler(req, res) {
  res.status(200).json({ ok: true, routes });
}
