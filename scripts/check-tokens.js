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

/**
 * Tailwind bakes each @theme hex into a literal fallback for every opacity-modified utility,
 * emitted ahead of the @supports(color-mix) block that reads the live variable. If @theme and
 * theme.dark disagree, engines without color-mix render a palette nobody has seen since the
 * two were last in step — and no other check looks at it.
 */
const checkThemeDrift = () => {
  const css = readFileSync('src/style.css', 'utf8');
  const config = readFileSync('src/config/app.config.ts', 'utf8');

  const from = config.indexOf('dark: {');
  const dark = config.slice(from, config.indexOf('  },', from));
  const kebab = (name) => name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  const drift = [];
  for (const [, key, hex] of dark.matchAll(/(\w+): '(#[0-9a-f]{6})'/g)) {
    const variable = `--color-${kebab(key)}`;
    // Double-escaped: this is a template literal, so a single backslash would reach the
    // RegExp constructor as a bare "s" and the pattern would silently never match.
    const declared = css.match(new RegExp(`${variable}:\\s*(#[0-9a-f]{6})`));
    if (declared && declared[1] !== hex) {
      drift.push(`${variable}  @theme ${declared[1]}  !=  theme.dark ${hex}`);
    }
  }
  return drift;
};

const drift = checkThemeDrift();
if (drift.length > 0) {
  console.error(`[tokens] ${drift.length} @theme value(s) out of step with theme.dark:`);
  for (const line of drift) console.error(`  ${line}`);
  process.exit(1);
}

if (findings.length > 0) {
  console.error(`[tokens] ${findings.length} pre-rename utility class(es) found:`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('[tokens] the current names are documented on ColorPalette in src/config/types.ts');
  process.exit(1);
}

console.log('[tokens] no pre-rename utility classes; @theme matches theme.dark');
