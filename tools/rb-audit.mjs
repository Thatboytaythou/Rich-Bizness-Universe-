import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const reportOnly = process.argv.includes('--report') || process.env.RB_AUDIT_REPORT_ONLY === '1';
const ignore = new Set(['.git','node_modules','dist','.vercel']);
const ignoreFiles = new Set(['tools/rb-audit.mjs']);
const allowedExt = new Set(['.html','.js','.mjs','.css','.json','.ts','.tsx','.jsx']);
const duplicateExt = new Set(['.html','.js','.mjs','.css','.ts','.tsx','.jsx']);
const coreRoutes = new Set(['messages.html','meta.html','store.html','notifications.html','sports.html','music.html','radio.html','podcast.html','live.html','watch.html','profile.html','index.html','auth.html','edit.html','settings.html','feed.html','upload.html','gaming.html','gallery.html']);
const lockedHomepageFiles = new Set(['index.html','styles/main.css','core/engine/omni-engine.js','core/pages/index.js']);

const checks = [
  { name:'old identity stack', pattern:/identity-stack\.css\?v=identity-stack-[12]/g },
  { name:'old clean css', pattern:/(auth|profile|avatar|avatar-characters|gaming|podcast|store|gallery|sports)-clean\.css/g },
  { name:'old section runtime', pattern:/section-runtime\.js|section-page\.css/g },
  { name:'dead avatar xp boot', pattern:/avatar-xp\.js/g },
  { name:'profile portal-card collision', pattern:/identity-portal-card\s+profile-card-lock/g },
  { name:'meta portal-card collision', pattern:/identity-portal-card\s+meta-world-stage/g },
  { name:'avatar outer ring collision', pattern:/class=["'][^"']*avatar-glow-ring[^"']*["']/g },
  { name:'stale route cache key', pattern:/profile-avatar-separate-2|avatar-extreme-2|selector-extreme-1|realtime-2|avatar-core-8|drop-feed-4/g },
  { name:'stale identity import', pattern:/rb-identity\.js\?v=tap-in-foundation-2/g },
  { name:'profile photo/avatar class collision', pattern:/class="avatar"\s+id="avatarFace"/g },
  { name:'duplicate homepage realtime risk', pattern:/channel\('home-profile-'[\s\S]{0,160}channel\('home-profile-'/g },
  { name:'legacy Supabase project ref', pattern:/zsancpcyhdidrlezggrl/g },
  { name:'legacy Supabase URL', pattern:/https:\/\/zsancpcyhdidrlezggrl\.supabase\.co/g },
  { name:'legacy notifications table', pattern:/\.from\(['"]notifications['"]\)/g },
  { name:'live owner column mismatch', pattern:/\.from\(['"]live_streams['"]\)[\s\S]{0,240}\buser_id\b/g },
  { name:'unscoped realtime channel', pattern:/\.on\(['"]postgres_changes['"],\s*\{\s*event:\s*['"]\*['"],\s*schema:\s*['"]public['"],\s*table:\s*['"][^'"]+['"]\s*\}/g },
  { name:'invalid profiles trust_score select', pattern:/\.from\(['"]profiles['"]\)[\s\S]{0,200}select\([^)]*trust_score/g },
  { name:'invalid rb_secret_rooms id dependency', pattern:/\.from\(['"]rb_secret_rooms['"]\)[\s\S]{0,200}select\(['"]id['"]/g },
  { name:'removed global copy layer', pattern:/section-language-foundation\.js/g },
  { name:'removed shared feed-upload owner', pattern:/drop-feed\.js/g },
  { name:'removed meta boot owner', pattern:/features\/meta\/boot\.js/g },
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

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function stripQuery(value) {
  return value.split(/[?#]/, 1)[0];
}

async function resolveLocalImport(sourceFile, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return true;
  const clean = stripQuery(specifier);
  const base = clean.startsWith('/') ? path.join(root, clean.slice(1)) : path.resolve(path.dirname(sourceFile), clean);
  const candidates = [base];
  if (!path.extname(base)) candidates.push(`${base}.js`, `${base}.mjs`, `${base}.ts`, path.join(base, 'index.js'));
  for (const candidate of candidates) if (await exists(candidate)) return true;
  return false;
}

const files = await walk(root);
const hits = [];
const hashes = new Map();

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

  if (rel !== 'src/supabase-client.js' && /\bcreateClient\s*\(/.test(text)) {
    const index = text.search(/\bcreateClient\s*\(/);
    hits.push({ file: rel, line: text.slice(0, index).split('\n').length, check: 'local Supabase client', match: 'use src/supabase-client.js only' });
  }

  if (/from\s+['"]@supabase\/supabase-js['"]/.test(text) && rel !== 'src/supabase-client.js') {
    const index = text.search(/from\s+['"]@supabase\/supabase-js['"]/);
    hits.push({ file: rel, line: text.slice(0, index).split('\n').length, check: 'direct Supabase SDK import', match: 'import shared supabase client instead' });
  }

  const importPatterns = [
    /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /<script[^>]+src=['"]([^'"]+)['"]/g,
    /<link[^>]+href=['"]([^'"]+\.css(?:\?[^'"]*)?)['"]/g,
  ];
  for (const pattern of importPatterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier || /^(https?:|data:|blob:|#|mailto:|tel:)/.test(specifier)) continue;
      if (!(await resolveLocalImport(file, specifier))) {
        const line = text.slice(0, match.index).split('\n').length;
        hits.push({ file: rel, line, check: 'missing local dependency', match: specifier });
      }
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
    const moduleSources = [...text.matchAll(/<script\s+type=["']module["']\s+src=["']([^"']+)["']/g)].map((match) => match[1]);
    if (moduleSources.length > 1) hits.push({ file: rel, line: 1, check: 'multiple route owners', match: moduleSources.join(', ').slice(0, 120) });
  }

  if (lockedHomepageFiles.has(rel) && /TODO|TEMP|DEBUG|console\.log\(/.test(text)) {
    hits.push({ file: rel, line: 1, check: 'locked homepage debug residue', match: 'locked homepage file contains temporary/debug code' });
  }

  const trimmed = text.trim();
  if (duplicateExt.has(path.extname(file)) && trimmed.length >= 120 && !lockedHomepageFiles.has(rel)) {
    const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
    const matches = hashes.get(hash) || [];
    matches.push(rel);
    hashes.set(hash, matches);
  }

  if (/^(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)?export\s*\{\s*\}\s*;?$/.test(trimmed)) {
    hits.push({ file: rel, line: 1, check: 'dead no-op module', match: 'delete file and remove its imports' });
  }
}

for (const matches of hashes.values()) {
  if (matches.length > 1) hits.push({ file: matches[0], line: 1, check: 'identical duplicate files', match: matches.join(', ').slice(0, 180) });
}

if (hits.length) {
  console.error(`\nRB AUDIT FAILED: ${hits.length} duplicate/clashing pattern${hits.length === 1 ? '' : 's'} found\n`);
  for (const h of hits) console.error(`${h.file}:${h.line} — ${h.check} — ${h.match}`);
  if (!reportOnly) process.exit(1);
  console.warn('\nRB AUDIT REPORT ONLY: failures were reported without blocking because --report was explicitly requested.');
} else {
  console.log(`RB AUDIT CLEAN: checked ${files.length} source files, local dependencies, route owners, and duplicate source bodies.`);
}
