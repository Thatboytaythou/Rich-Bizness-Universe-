import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignore = new Set(['.git','node_modules','dist','.vercel']);
const allowedExt = new Set(['.html','.js','.mjs','.css','.json','.ts','.tsx','.jsx']);

const checks = [
  { name:'old identity stack', pattern:/identity-stack\.css\?v=identity-stack-[12]/g },
  { name:'old clean css', pattern:/(auth|profile|avatar|avatar-characters|gaming|podcast|store|gallery|sports)-clean\.css/g },
  { name:'old section runtime', pattern:/section-runtime\.js|section-page\.css/g },
  { name:'dead avatar xp boot', pattern:/avatar-xp\.js/g },
  { name:'profile portal-card collision', pattern:/identity-portal-card\s+profile-card-lock/g },
  { name:'avatar outer ring collision', pattern:/avatar-glow-ring/g },
  { name:'stale route cache key', pattern:/profile-avatar-separate-2|avatar-extreme-2|selector-extreme-1|tap-in-foundation-[23]|realtime-2|avatar-core-8|drop-feed-4/g },
  { name:'profile photo/avatar class collision', pattern:/class="avatar"\s+id="avatarFace"/g },
  { name:'duplicate homepage realtime risk', pattern:/channel\('home-profile-'[\s\S]{0,160}channel\('home-profile-'/g }
];

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else if (allowedExt.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const files = await walk(root);
const hits = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const check of checks) {
    const matches = [...text.matchAll(check.pattern)];
    for (const match of matches) {
      const line = text.slice(0, match.index).split('\n').length;
      hits.push({ file: rel, line, check: check.name, match: match[0].slice(0, 120) });
    }
  }
}

if (hits.length) {
  console.error('\nRB AUDIT FAILED: duplicate/clashing patterns found\n');
  for (const h of hits) console.error(`${h.file}:${h.line} — ${h.check} — ${h.match}`);
  process.exit(1);
}

console.log(`RB AUDIT CLEAN: checked ${files.length} source files.`);
