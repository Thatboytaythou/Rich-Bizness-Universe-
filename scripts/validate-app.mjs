import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SKIP = new Set(['.git', 'node_modules', 'dist', '.vercel']);
const failures = [];
const warnings = [];

async function walk(dir = ROOT) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

function localTarget(fromFile, value) {
  if (!value || /^(https?:|mailto:|tel:|data:|blob:|#|javascript:)/i.test(value)) return null;
  const clean = value.split(/[?#]/)[0];
  if (!clean) return null;
  return clean.startsWith('/') ? join(ROOT, clean) : resolve(dirname(fromFile), clean);
}

function normalizeTarget(path) {
  const target = normalize(path);
  if (target.endsWith('/')) return join(target, 'index.html');
  return target;
}

const files = await walk();
const htmlFiles = files.filter((file) => extname(file) === '.html');
const jsFiles = files.filter((file) => ['.js', '.mjs'].includes(extname(file)));

for (const file of htmlFiles) {
  const text = await readFile(file, 'utf8');
  const moduleScripts = [...text.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  if (moduleScripts.length > 2) failures.push(`${relative(ROOT, file)} loads ${moduleScripts.length} page modules; max is 2 including a shared module.`);

  const refs = [...text.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    const target = localTarget(file, ref);
    if (!target) continue;
    const resolved = normalizeTarget(target);
    if (!await exists(resolved)) failures.push(`${relative(ROOT, file)} references missing ${ref}`);
  }

  if (!/viewport-fit=cover/i.test(text)) warnings.push(`${relative(ROOT, file)} does not declare viewport-fit=cover.`);
}

for (const file of jsFiles) {
  const text = await readFile(file, 'utf8');
  const imports = [...text.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g)].map((m) => m[1]);
  for (const specifier of imports) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
    const target = localTarget(file, specifier);
    if (!target) continue;
    const candidates = [target, `${target}.js`, `${target}.mjs`, join(target, 'index.js')];
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) failures.push(`${relative(ROOT, file)} imports missing ${specifier}`);
  }
}

const configPath = join(ROOT, 'src/config.js');
if (await exists(configPath)) {
  const config = await readFile(configPath, 'utf8');
  const routeValues = [...config.matchAll(/:\s*['"](\/[^'"]*)['"]/g)].map((m) => m[1]).filter((value) => value === '/' || value.endsWith('.html') || value.endsWith('/'));
  for (const route of new Set(routeValues)) {
    const target = route === '/' ? join(ROOT, 'index.html') : normalizeTarget(join(ROOT, route));
    if (!await exists(target)) failures.push(`src/config.js registers missing route ${route}`);
  }
}

const mobileCssPath = join(ROOT, 'src/mobile-regression.css');
const shellJsPath = join(ROOT, 'src/app-shell.js');
if (!await exists(mobileCssPath)) failures.push('Missing src/mobile-regression.css global mobile guard.');
if (await exists(shellJsPath)) {
  const shell = await readFile(shellJsPath, 'utf8');
  if (!shell.includes('/src/mobile-regression.css')) failures.push('src/app-shell.js does not mount the mobile regression guard.');
  if (!shell.includes('safeInternal')) failures.push('src/app-shell.js is missing safe internal route validation.');
}
if (await exists(mobileCssPath)) {
  const mobileCss = await readFile(mobileCssPath, 'utf8');
  if (!mobileCss.includes('safe-area-inset-bottom')) failures.push('Mobile guard is missing bottom safe-area handling.');
  if (!mobileCss.includes('100dvh')) warnings.push('Mobile guard does not use dynamic viewport height.');
  if (!mobileCss.includes('--rb-touch:44px')) failures.push('Mobile guard is missing the 44px minimum tap target lock.');
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(`Checked ${htmlFiles.length} HTML files and ${jsFiles.length} JavaScript modules.`);
if (failures.length) process.exitCode = 1;
else console.log('Application integrity check passed.');