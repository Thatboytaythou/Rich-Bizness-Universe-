import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`REPAIR GATE: ${message}`);
  process.exitCode = 1;
};

const mustExist = [
  'apps/web/index.html',
  'apps/web/tap-in.html',
  'apps/web/portal.html',
  'apps/web/profile.html',
  'apps/web/gaming.html',
  'apps/web/upload.html',
  'apps/web/avatar.html',
  'apps/web/avatar-characters.html',
  'apps/web/src/route-loader.ts',
  'apps/web/src/core/page-contract.ts',
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
  "'tap-in': guardedRegistration({ auth: 'optional', owner: 'rich-bizness-tap-in-v2'",
  "portal: guardedRegistration({ auth: 'required', owner: 'rich-bizness-portal-v3'",
  "profile: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-profile-v2'",
  "gaming: guardedRegistration({ auth: 'optional', owner: 'rich-bizness-gaming-v6'",
  "upload: guardedRegistration({ auth: 'required', owner: 'rich-bizness-upload-v3'",
  "avatar: guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-lobby-v1'",
  "'avatar-characters': guardedRegistration({ auth: 'required', owner: 'rich-bizness-avatar-characters-v1'"
];

for (const marker of requiredOwners) {
  if (!routeLoader.includes(marker)) fail(`canonical route owner drifted: ${marker}`);
}

const contract = readFileSync(resolve(root, 'apps/web/src/core/page-contract.ts'), 'utf8');
const requiredTerms = [
  ["term: 'Home / Index'", "route: '/index.html'"],
  ["term: 'Tap In'", "route: '/tap-in.html'"],
  ["term: 'Portal'", "route: '/portal.html'"],
  ["term: 'Avatar Studio'", "route: '/avatar-characters.html'"],
  ["term: 'Avatar Lobby'", "route: '/avatar.html'"],
  ["term: 'Profile'", "route: '/profile.html'"],
  ["term: 'Gaming'", "route: '/gaming.html'"],
  ["term: 'Upload'", "route: '/upload.html'"]
];

for (const [term, route] of requiredTerms) {
  if (!contract.includes(term) || !contract.includes(route)) fail(`canonical vocabulary drifted: ${term} -> ${route}`);
}

const avatarLobbyHtml = readFileSync(resolve(root, 'apps/web/avatar.html'), 'utf8');
const avatarStudioHtml = readFileSync(resolve(root, 'apps/web/avatar-characters.html'), 'utf8');
if (!avatarLobbyHtml.includes('<title>Avatar Lobby • Rich Bizness</title>')) fail('avatar.html is not labeled Avatar Lobby');
if (!avatarStudioHtml.includes('<title>Avatar Studio • Rich Bizness</title>')) fail('avatar-characters.html is not labeled Avatar Studio');

if (!process.exitCode) console.log('REPAIR GATE: canonical source ownership and vocabulary passed');
