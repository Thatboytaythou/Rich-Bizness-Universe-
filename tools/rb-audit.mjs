import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignore = new Set(['.git','node_modules','dist','.vercel']);
const ignoreFiles = new Set(['tools/rb-audit.mjs']);
const allowedExt = new Set(['.html','.js','.mjs','.css','.json','.ts','.tsx','.jsx']);
const coreRoutes = new Set(['messages.html','meta.html','store.html','notifications.html','sports.html','music.html','radio.html','podcast.html','live.html','watch.html','profile.html','index.html','auth.html','edit.html','settings.html']);

const checks = [
  { name:'old identity stack', pattern:/identity-stack\.css\?v=identity-stack-[12]/g },
  { name:'old clean css', pattern:/(auth|profile|avatar|avatar-characters|gaming|podcast|store|gallery|sports)-clean\.css/g },
  { name:'old section runtime', pattern:/section-runtime\.js|section-page\.css/g },
  { name:'dead avatar xp boot', pattern:/avatar-xp\.js/g },
  { name:'profile portal-card collision', pattern:/identity-portal-card\s+profile-card-lock/g },
  { name:'meta portal-card collision', pattern:/identity-portal-card\s+meta-world-stage/g },
  { name:'avatar outer ring collision', pattern:/avatar-glow-ring/g },
  { name:'stale route cache key', pattern:/profile-avatar-separate-2|avatar-extreme-2|selector-extreme-1|tap-in-foundation-[23]|realtime-2|avatar-core-8|drop-feed-4/g },
  { name:'stale identity import', pattern:/rb-identity\.js\?v=tap-in-foundation-[23]/g },
  { name:'profile photo/avatar class collision', pattern:/class="avatar"\s+id="avatarFace"/g },
  { name:'homepage hard mobile column', pattern:/rb-home-portal[\s\S]{0,260}minmax\(340px/g },
  { name:'duplicate homepage realtime risk', pattern:/channel\('home-profile-'[\s\S]{0,160}channel\('home-profile-'/g }
];

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else if (allowedExt.has(path.extname(entry.name))) {
      const rel = path.relative(root, full).replaceAll('\\', '/');
      if (!ignoreFiles.has(rel)) files.push(full);
    }
  }
  return files;
}

const files = await walk(root);
const hits = [];
for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const check of checks) {
    const matches = [...text.matchAll(check.pattern)];
    for (const match of matches) {
      const line = text.slice(0, match.index).split('\n').length;
      hits.push({ file: rel, line, check: check.name, match: match[0].slice(0, 120) });
    }
  }
  if (coreRoutes.has(rel)) {
    const lineCount = text.split('\n').length;
    if (lineCount < 8 && text.includes('<script type="module">')) {
      hits.push({ file: rel, line: 1, check: 'hidden one-line route ownership', match: 'inline module logic compressed into one-line HTML' });
    }
    if (text.includes('<script type="module">import') && !text.includes('src="/src/')) {
      hits.push({ file: rel, line: 1, check: 'inline route owner logic', match: 'move route logic into /src owner file' });
    }
  }
}

if (hits.length) {
  console.error('\nRB AUDIT FAILED: duplicate/clashing patterns found\n');
  for (const h of hits) console.error(`${h.file}:${h.line} — ${h.check} — ${h.match}`);
  process.exit(1);
}

console.log(`RB AUDIT CLEAN: checked ${files.length} source files.`);
