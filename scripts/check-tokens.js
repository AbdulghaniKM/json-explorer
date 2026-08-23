#!/usr/bin/env node
/**
 * The design tokens were renamed to shadcn's vocabulary so components lifted from a
 * shadcn-shaped registry keep their Tailwind classes. Nothing in the build fails when an old
 * name comes back: Tailwind simply does not emit the utility, so the element silently renders
 * unstyled. This is the only check that catches that.
 *
 *   node scripts/check-tokens.js
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const LEGACY = [
  'surface',
  'text',
  'text-secondary',
  'text-muted',
  'emphasis',
  'link',
  'link-hover',
];

const PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'divide',
  'fill',
  'stroke',
  'caret',
  'decoration',
  'outline',
  'from',
  'to',
  'via',
  'shadow',
];

// Hyphen-aware boundaries rather than \b, which matches between "t" and "-" and would let
// `text-text` hit the front of `text-text-muted`.
const PATTERN = new RegExp(
  `(?<![-\\w])(?:${PREFIXES.join('|')})-(?:${LEGACY.join('|')})(?![-\\w])`,
  'g',
);

/** Zero usages and vuetail-tracked, so touching it would only create registry drift. */
const EXCLUDED = new Set(['src/components/ui/AppText.vue']);

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const findings = [];

for (const path of walk('src')) {
  if (!/\.(vue|ts)$/.test(path)) continue;
  if (EXCLUDED.has(path.split(sep).join('/'))) continue;

  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(PATTERN)) {
      findings.push(`${path}:${index + 1}  ${match[0]}`);
    }
  });
}

if (findings.length > 0) {
  console.error(`[tokens] ${findings.length} pre-rename utility class(es) found:`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('[tokens] the current names are documented on ColorPalette in src/config/types.ts');
  process.exit(1);
}

console.log('[tokens] no pre-rename utility classes');
