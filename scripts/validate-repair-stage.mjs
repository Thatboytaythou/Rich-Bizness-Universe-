import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`REPAIR GATE: ${message}`);
  process.exitCode = 1;
};

const mustExist = [
  'apps/web/index.html',
  'apps/web/gaming.html',
  'apps/web/avatar.html',
  'apps/web/avatar-characters.html',
  'apps/web/src/route-loader.ts',
  'apps/web/src/features/avatar/avatar.skinned.runtime.ts'
];

for (const relative of mustExist) {
  if (!existsSync(resolve(root, relative))) fail(`missing canonical source ${relative}`);
}

const forbiddenLegacy = [
  'gaming.html',
  'apps/web/src/features/avatar/avatar.gta.rig.ts'
];

for (const relative of forbiddenLegacy) {
  if (existsSync(resolve(root, relative))) fail(`legacy/duplicate owner still present: ${relative}`);
}

const routeLoader = readFileSync(resolve(root, 'apps/web/src/route-loader.ts'), 'utf8');
const requiredOwners = [
  "home: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-home-v1'",
  "profile: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-profile-v2'",
  "gaming: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gaming-v6'",
  "avatar: guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-lobby-v1'",
  "'avatar-characters': guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-characters-v1'"
];

for (const marker of requiredOwners) {
  if (!routeLoader.includes(marker)) fail(`canonical route owner drifted: ${marker}`);
}

if (!process.exitCode) console.log('REPAIR GATE: canonical source ownership passed');
