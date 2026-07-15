import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const implementedEntries = [
  'apps/web/index.html',
  'apps/web/tap-in.html',
  'apps/web/profile.html',
  'apps/web/edit-profile.html',
  'apps/web/settings.html',
  'apps/web/notifications.html',
  'apps/web/messages.html',
  'apps/web/search.html',
  'apps/web/upload.html',
  'apps/web/creator.html',
  'apps/web/admin.html',
  'apps/web/feed.html',
  'apps/web/gallery.html',
  'apps/web/live.html',
  'apps/web/watch.html',
  'apps/web/music.html',
  'apps/web/podcast.html',
  'apps/web/radio.html',
  'apps/web/sports.html',
  'apps/web/store.html',
  'apps/web/gaming.html',
  'apps/web/meta.html',
  'apps/web/avatar.html',
  'apps/web/rich-chess.html',
  'apps/web/smoke-room-cards.html',
  'apps/web/dj-radio-run.html',
  'apps/web/money-road-runner.html'
];

const missing = [];
for (const entry of implementedEntries) {
  try {
    await access(resolve(root, entry));
  } catch {
    missing.push(entry);
  }
}

if (missing.length) {
  console.error(`Missing implemented route entries: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Route contract valid for ${implementedEntries.length} implemented entry points.`);