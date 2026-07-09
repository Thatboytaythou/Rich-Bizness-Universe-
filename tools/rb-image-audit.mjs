import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const imageRoot = path.join(root, 'images');
const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const rows = [];
const byBase = new Map();

async function walk(dir) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (exts.has(path.extname(entry.name).toLowerCase())) {
      const info = await stat(full);
      const rel = path.relative(root, full).replaceAll('\\', '/');
      const base = entry.name.toLowerCase().replace(/\.(png|jpg|jpeg|webp|gif|svg|avif)$/i, '').replace(/[-_ ]?copy[ -_]?\d*$/i, '');
      rows.push({ rel, size: info.size, base });
      const list = byBase.get(base) || [];
      list.push({ rel, size: info.size });
      byBase.set(base, list);
    }
  }
}

await walk(imageRoot);
const duplicates = [...byBase.entries()].filter(([, list]) => list.length > 1);
console.log(`RB IMAGE AUDIT: ${rows.length} image assets found.`);
if (duplicates.length) {
  console.log(`RB IMAGE AUDIT WARNING: ${duplicates.length} possible duplicate image groups.`);
  for (const [base, list] of duplicates) {
    console.log(`\n${base}`);
    for (const item of list) console.log(`- ${item.rel} (${item.size} bytes)`);
  }
}
