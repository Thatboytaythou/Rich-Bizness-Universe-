import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'packages/config/package.json',
  'packages/config/src/index.ts',
  'packages/config/src/routes.ts',
  'packages/config/src/tables.ts',
  'packages/config/src/buckets.ts',
  'packages/config/src/games.ts',
  'apps/web/src/main.ts',
  'apps/web/src/core/supabase/client.ts',
  'vite.config.ts'
];

const missing = requiredFiles.filter((path) => !existsSync(resolve(root, path)));
if (missing.length) {
  throw new Error(`Missing shared package/runtime paths:\n${missing.map((path) => `- ${path}`).join('\n')}`);
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'packages/config/package.json'), 'utf8'));
const exportsMap = packageJson.exports ?? {};
for (const [key, target] of Object.entries(exportsMap)) {
  if (typeof target !== 'string' || !existsSync(resolve(root, 'packages/config', target))) {
    throw new Error(`Invalid @rich-bizness/config export ${key}: ${String(target)}`);
  }
}

const gamesSource = readFileSync(resolve(root, 'packages/config/src/games.ts'), 'utf8');
const slugs = [...gamesSource.matchAll(/slug:\s*'([^']+)'/g)].map((match) => match[1]);
if (slugs.length !== 28) throw new Error(`Expected 28 canonical game slugs, found ${slugs.length}.`);
if (new Set(slugs).size !== slugs.length) throw new Error('Canonical game manifest contains duplicate slugs.');

const routesSource = readFileSync(resolve(root, 'packages/config/src/routes.ts'), 'utf8');
for (const key of ['portal', 'tapIn', 'profile', 'avatar', 'avatarCharacters', 'meta', 'creatorDimensions', 'gaming', 'store']) {
  if (!new RegExp(`\\b${key}:`).test(routesSource)) throw new Error(`Missing canonical route key: ${key}`);
}

const viteSource = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
for (const alias of ['@web', '@rb/config', '@rb/database', '@rb/ui', '@rb/avatar', '@rb/game-runtime']) {
  if (!viteSource.includes(`'${alias}'`)) throw new Error(`Missing Vite workspace alias: ${alias}`);
}

console.log(`Package validation passed: ${Object.keys(exportsMap).length} config exports, ${slugs.length} game contracts, 6 workspace aliases.`);
