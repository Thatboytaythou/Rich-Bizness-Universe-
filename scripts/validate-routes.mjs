import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const implementedEntries = [
  'apps/web/index.html'
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

console.log(`Route contract valid for ${implementedEntries.length} implemented entry point.`);
