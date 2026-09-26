// Copies src/utils/categoryMatcher.ts into the Supabase functions folder.
//
// Edge Functions are bundled from inside supabase/, so they cannot import the app's source
// directly. The category rules are the one thing both sides must agree on, so the server
// copy is generated from the app file. `npm run verify:server` fails if it drifts.
//
// Usage: node scripts/sync-server.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src/utils/categoryMatcher.ts');
const target = join(root, 'supabase/functions/_shared/categoryMatcher.ts');

const HEADER = `// GENERATED from src/utils/categoryMatcher.ts by scripts/sync-server.mjs. Do not edit here:
// change the app file and run \`npm run sync:server\`.
`;
const IMPORT = /import \{ CategoryType \} from '\.\.\/types\/finance';\r?\n/;

export function generate() {
  const src = readFileSync(source, 'utf8');
  if (!IMPORT.test(src)) throw new Error('categoryMatcher.ts no longer imports CategoryType the expected way; update scripts/sync-server.mjs');
  return HEADER + src.replace(IMPORT, "import type { Category as CategoryType } from './types.ts';\n").replace(/\r\n/g, '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = generate();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    } catch {}
    if (current !== out) {
      console.error('supabase/functions/_shared/categoryMatcher.ts is out of date. Run: npm run sync:server');
      process.exit(1);
    }
    console.log('categoryMatcher copy is up to date');
  } else {
    writeFileSync(target, out);
    console.log('wrote', target);
  }
}
