# JSON Explorer

A small, fast set of JSON tools that run entirely in the browser — built for documents that are
too big for the usual online formatters. Nothing is uploaded; the document you paste never leaves
the page.

**Live:** https://json-explorer-mauve.vercel.app

| Tool                   | What it does                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Explore** `/`        | Collapsible tree with type colouring, search across keys and values, match navigation, path and value copy |
| **Format** `/format`   | Beautify, minify, sort keys, drop empty values, escape/unescape, and repair malformed JSON                 |
| **Compare** `/compare` | Structural diff that ignores key order, with optional array-order-insensitive matching                     |
| **Analyze** `/analyze` | Characters, lines, raw/minified/gzip size, and charted value-type, nesting-depth and key-frequency counts  |
| **Convert** `/convert` | TypeScript interfaces, C# classes, .NET DTO records, Zod schema, YAML, CSV and query strings               |

## Built for large documents

Most JSON viewers call `JSON.parse`, build a JS object graph, and render a DOM node per value.
That collapses somewhere around a few megabytes. JSON Explorer does none of those things.

- **A flat index instead of an object graph.** A single-pass scanner walks the raw text and fills
  ten typed arrays — type, key/value offsets, parent, child count, subtree end, depth — about
  **35 bytes per node** with no per-node JS object and no recursion. Values are read back by
  slicing the source text when a row is actually drawn.
- **Everything heavy runs in a Web Worker.** Scanning, formatting, converting, comparing and
  sample generation are off the main thread, so the UI never freezes. Stale results are dropped by
  request id, and the parse debounce scales with document size.
- **Virtualized rendering.** The tree and the large-document viewer render only the rows in view,
  so expanding a 1.6 million row document costs the same as expanding a small one.
- **Format without parsing.** Beautify, minify and sort keys re-emit straight from the source text
  using the index — no intermediate object graph, and **source tokens are preserved exactly**, so
  `12345678901234567890` and `178.0` survive a round trip that `JSON.parse`/`stringify` would
  quietly rewrite.
- **Search by offset, not by walk.** Queries run as a native `indexOf` sweep over the text, and
  each hit is mapped back to its node with a binary search over the index — no tree traversal.
- **Types without parsing.** TypeScript, C#, .NET DTO and Zod generation infers its shape from the same flat
  index, interning identical shapes as it goes, so a 191 MB document types in ~5 s and has no size
  cap at all.
- **Honest limits.** Tools that genuinely need the whole document in memory (YAML, CSV and query
  conversion, compare, repair, drop-empties) say so and cap out instead of hanging the tab; the
  explorer, formatter, analyzer and type generators keep working past those caps.

Measured on this machine with a generated 33 MB / 2.8 M node document (Node 22):

| Operation                                 | Time    |
| ----------------------------------------- | ------- |
| Index the document (incl. statistics)     | ~1.0 s  |
| `JSON.parse` on the same input (baseline) | ~0.4 s  |
| Build 100k visible rows (depth 2)         | ~30 ms  |
| Build 1.6M visible rows                   | ~150 ms |
| Search, case-insensitive, whole document  | ~50 ms  |
| Minify 33 MB                              | ~2.2 s  |
| Beautify to 64 MB                         | ~4.2 s  |

The **Explore** tab has a generator (20k / 100k / 200k records, up to ~66 MB) so you can stress
the viewer without hunting for a big file.

## Highlights

- **Editor** — line-number gutter, syntax highlighting, drag-and-drop file loading, and syntax
  errors reported as `line:column` with click-to-jump. Past 3 MB it switches to a read-only
  virtualized viewer (a `<textarea>` cannot hold tens of megabytes) — every tool still works.
- **Repair** — one click fixes comments, single quotes, unquoted keys, trailing commas, smart
  quotes, `True`/`False`/`None`, `NaN`/`undefined`, unclosed brackets, and newline-delimited JSON.
- **Search** — matches keys and values, expands the path to each hit, and can hide everything that
  does not match.
- **Shared workspace** — the document follows you between tools; documents under 500 kB are
  restored from `localStorage` on the next visit.
- **Keyboard** — `Alt 1–5` switch tools, `Ctrl O` open, `Ctrl S` download, `Ctrl B` beautify,
  `Ctrl M` minify, `/` focus the tree search.

## Stack

Vue 3.5 (`<script setup>`) · Tailwind CSS v4 · TypeScript 6 · Vite 8 (Rolldown) · Pinia 3 ·
Vue Router 5 · Zod 4 · Iconify · Oxlint + Oxfmt.

There is no backend and no runtime HTTP client — every tool is pure client-side computation.

## Getting started

```bash
pnpm install
pnpm dev
```

| Script         | Purpose                                      |
| -------------- | -------------------------------------------- |
| `pnpm dev`     | Dev server                                   |
| `pnpm build`   | Type-check (`vue-tsc`) then production build |
| `pnpm preview` | Serve the production build                   |
| `pnpm check`   | Lint + format check + type-check             |
| `pnpm fix`     | Autofix lint issues and format               |

## Project structure

```
src/
├── lib/json/              # Framework-free JSON engine
│   ├── scan.ts            # Single-pass indexer: typed-array node tables + statistics
│   ├── tree.ts            # Index navigation: rows, paths, children, depth expansion
│   ├── find.ts            # indexOf sweep + binary search from offset back to node
│   ├── emit.ts            # Beautify / minify / sort straight from the source text
│   ├── engine.ts          # Worker request handlers and the size caps for each tool
│   ├── parse.ts           # JSON.parse wrapper with line/column error positions
│   ├── repair.ts          # Tolerant scanner for malformed JSON + NDJSON
│   ├── diff.ts            # Semantic diff with a node budget
│   ├── convert.ts         # TypeScript, C#, .NET DTO, Zod, YAML, CSV, query string emitters
│   ├── format.ts          # Escape, unescape, drop-empties, byte formatting
│   ├── compress.ts        # Streaming gzip size via CompressionStream
│   ├── highlight.ts       # HTML-escaped tokenizer for the editor overlay
│   └── path.ts            # Path formatting and value types for the diff
├── workers/json.worker.ts # Thin wrapper that runs the engine off the main thread
├── components/json/       # Editor, VirtualTree, LineViewer, DiffTree, Panel, StatCard
├── composables/           # useJsonEngine (worker client), useJsonTree, useJsonWorkspace, …
├── stores/json.store.ts   # Workspace: text, index, stats, undo, debounced scans, persistence
├── pages/                 # index (explore), format, compare, analyze, convert
├── layouts/               # App shell with tool navigation
└── config/                # Identity, theme, SEO, tool registry
```

The router is file-based: each page under `src/pages/` registers itself, and `definePage({ route,
head, layout })` sets its path and document title.

## Theming

Colours live in `src/config/app.config.ts` (`theme.light` / `theme.dark`) and are applied as CSS
variables at boot. JSON token colours and diff highlight colours are defined in `src/style.css`
(`--token-*`, `--diff-*`). Light and dark follow the system preference and can be toggled in the
header.

## Preferences

The gear in the header holds two switches, persisted to `localStorage` under
`json-explorer:preferences` and read by `src/composables/usePreferences.ts`:

- **Sample document** — whether a first visit pre-fills the workspace with the demo order and
  whether the Sample buttons appear on each tool. Turning it off clears an untouched workspace;
  turning it back on refills an empty one. Neither ever overwrites text you typed.
- **Sampled markers** — whether analyze flags the statistics it stops counting exactly on very
  large documents (key counts past 400k keys, the number range past its sample limit).

## Deployment

Deployed on Vercel from `main`. `vercel.json` sets the SPA rewrite so deep links like `/compare`
resolve on refresh. Because `pnpm build` type-checks before bundling, the generated declaration
files (`src/auto-imports.d.ts`, `src/components.d.ts`, `src/types/routes.gen.d.ts`) are committed
so a fresh clone builds without a prior dev run.

## Credits

Built on the [VueTail](https://github.com/AbdulghaniKM/vuetail-template) starter; UI primitives
come from its [component registry](https://github.com/AbdulghaniKM/vuetail-components)
(`pnpm add-component <Name>`).
