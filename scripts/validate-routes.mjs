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
  'apps/web/creator-dimensions.html',
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
  'apps/web/avatar-characters.html',
  'apps/web/rich-chess.html',
  'apps/web/smoke-room-cards.html',
  'apps/web/dj-radio-run.html',
  'apps/web/money-road-runner.html',
  'apps/web/rich-samurais-son-ninja.html',
  'apps/web/aura-shinobi-clash.html',
  'apps/web/boss-walk-battle.html',
  'apps/web/smoke-burst-arena.html',
  'apps/web/hero-villain-showdown.html',
  'apps/web/empire-builder.html',
  'apps/web/market-flip.html',
  'apps/web/vault-unlock.html',
  'apps/web/portal-room-rush.html',
  'apps/web/avatar-free-roam.html',
  'apps/web/smoke-city-hustle.html',
  'apps/web/treehouse-ride.html',
  'apps/web/studio-showdown.html',
  'apps/web/rich-court-king.html',
  'apps/web/diamond-bat-flip.html',
  'apps/web/golf-green-gold.html',
  'apps/web/gym-grind-reps.html',
  'apps/web/cash-rain-catcher.html',
  'apps/web/portal-dash.html',
  'apps/web/bizness-party-room.html',
  'apps/web/rich-color-clash.html',
  'apps/web/rich-spades-royale.html',
  'apps/web/rich-checkers-elite.html',
  'apps/web/crown-connect-four.html'
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

console.log(`Route contract valid for ${implementedEntries.length} canonical entry points.`);
