#!/usr/bin/env node
/**
 * The CSP in vercel.json pins the inline theme script in index.html by hash, so that
 * script-src can stay strict (no 'unsafe-inline'). Editing that script changes its hash
 * and would silently break theming in production, so this script re-derives the hashes
 * from the built output and fails the build when vercel.json is out of date.
 *
 *   node scripts/csp-hash.js          verify dist/index.html against vercel.json
 *   node scripts/csp-hash.js --write  update vercel.json with the current hashes
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const HTML = 'dist/index.html';
const CONFIG = 'vercel.json';

// .gitattributes checks the repo out with LF, and Vercel builds on Linux, so the bytes the
// browser hashes always use LF. Normalise here too, otherwise a Windows checkout (CRLF)
// would compute a different hash than the one that actually ships.
const html = readFileSync(HTML, 'utf8').replace(/\r\n/g, '\n');

const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(
  (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
);

if (hashes.length === 0) {
  console.error(`[csp] no inline scripts found in ${HTML} - is the build up to date?`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
const header = config.headers
  ?.flatMap((entry) => entry.headers ?? [])
  .find((h) => h.key.toLowerCase() === 'content-security-policy');

if (!header) {
  console.error(`[csp] no Content-Security-Policy header in ${CONFIG}`);
  process.exit(1);
}

const scriptSrc = header.value.split(';').find((d) => d.trim().startsWith('script-src'));
const missing = hashes.filter((h) => !scriptSrc?.includes(h));

if (process.argv.includes('--write')) {
  header.value = header.value.replace(
    /script-src[^;]*/,
    `script-src 'self' ${hashes.join(' ')}`.trimEnd(),
  );
  writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`[csp] wrote ${hashes.length} hash(es) to ${CONFIG}`);
  process.exit(0);
}

if (missing.length > 0) {
  console.error(
    `[csp] ${CONFIG} is out of date - script-src is missing ${missing.join(', ')}\n` +
      `[csp] run: node scripts/csp-hash.js --write`,
  );
  process.exit(1);
}

console.log(`[csp] script-src covers all ${hashes.length} inline script(s)`);
