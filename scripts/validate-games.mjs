import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const slugs = [
  'avatar-free-roam','bizness-party-room','boss-walk-battle','cash-rain-catcher',
  'diamond-bat-flip','dj-radio-run','empire-builder','golf-green-gold','gym-grind-reps',
  'hero-villain-showdown','market-flip','money-road-runner','portal-dash','portal-room-rush',
  'rich-chess','rich-court-king','rich-runner','smoke-burst-arena','smoke-city-hustle',
  'smoke-room-cards','smoke-tap','studio-showdown','treehouse-ride','vault-unlock'
];

const requiredFiles = ['manifest.ts', 'game.ts'];
const failures = [];

for (const slug of slugs) {
  for (const filename of requiredFiles) {
    const target = path.join(root, 'games', slug, filename);
    try {
      await access(target, constants.R_OK);
    } catch {
      failures.push(`Missing ${path.relative(root, target)}`);
    }
  }

  const manifestPath = path.join(root, 'games', slug, 'manifest.ts');
  try {
    const manifest = await readFile(manifestPath, 'utf8');
    if (!manifest.includes(`slug:'${slug}'`) && !manifest.includes(`slug: '${slug}'`)) {
      failures.push(`Manifest slug mismatch: games/${slug}/manifest.ts`);
    }
    if (!manifest.includes("entry:'./game.ts'") && !manifest.includes("entry: './game.ts'")) {
      failures.push(`Manifest entry mismatch: games/${slug}/manifest.ts`);
    }
    if (!manifest.includes('standalone:true') && !manifest.includes('standalone: true')) {
      failures.push(`Game is not marked standalone: games/${slug}/manifest.ts`);
    }
  } catch {
    // Missing files were already recorded.
  }
}

if (new Set(slugs).size !== 24) failures.push('The canonical slug list must contain 24 unique games');

if (failures.length) {
  console.error('\nGame validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated ${slugs.length} standalone Rich Bizness games.`);
