export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    routes: ['/', '/auth.html', '/profile.html', '/avatar.html', '/feed.html', '/upload.html', '/live.html', '/watch.html', '/music.html', '/podcast.html', '/radio.html', '/gaming.html', '/sports.html', '/gallery.html', '/store.html', '/meta.html', '/messages.html', '/notifications.html', '/edit.html', '/settings.html']
  });
}
