# JSON Explorer

A small, fast set of JSON tools that run entirely in the browser. Nothing is uploaded — the
document you paste never leaves the page.

**Live:** https://json-explorer-mauve.vercel.app

| Tool                   | What it does                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Explore** `/`        | Collapsible tree with type colouring, search across keys and values, match navigation, path and value copy |
| **Format** `/format`   | Beautify, minify, sort keys, drop empty values, escape/unescape, and repair malformed JSON                 |
| **Compare** `/compare` | Structural diff that ignores key order, with optional array-order-insensitive matching                     |
| **Analyze** `/analyze` | Characters, lines, raw/minified/gzip size, value-type distribution, depth, key counts and extremes         |
| **Convert** `/convert` | TypeScript interfaces, Zod schema, YAML, CSV and query strings                                             |

## Highlights

- **Editor** — line-number gutter, syntax highlighting, drag-and-drop file loading, and syntax
  errors reported as `line:column` with click-to-jump.
- **Repair** — one click fixes comments, single quotes, unquoted keys, trailing commas, smart
  quotes, `True`/`False`/`None`, `NaN`/`undefined`, unclosed brackets, and newline-delimited JSON.
- **Search** — matches keys and values, auto-expands the path to each hit, and can hide everything
  that does not match.
- **Big documents** — parsing is debounced, tree children render only when expanded, and long
  arrays render in chunks.
- **Shared workspace** — the document follows you between tools and is restored from
  `localStorage` on the next visit.
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
│   ├── parse.ts           # JSON.parse wrapper with line/column error positions
│   ├── format.ts          # Beautify, minify, sort keys, drop empties, escape
│   ├── repair.ts          # Tolerant scanner for malformed JSON + NDJSON
│   ├── stats.ts           # Iterative walker: counts, depth, keys, extremes, gzip
│   ├── diff.ts            # Semantic diff with added/removed/changed rollups
│   ├── search.ts          # Key/value search returning node ids to expand
│   ├── convert.ts         # TypeScript, Zod, YAML, CSV, query string emitters
│   ├── highlight.ts       # HTML-escaped tokenizer for the editor overlay
│   └── path.ts            # Path formatting, node ids, type helpers
├── components/json/       # Editor, Tree, TreeNode, DiffTree, DiffNode, Panel, StatCard
├── composables/           # useJsonTree, useJsonWorkspace, useJsonFile, useClipboard, …
├── stores/json.store.ts   # Shared workspace: source, compare, indent, undo, persistence
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

## Deployment

Deployed on Vercel from `main`. `vercel.json` sets the SPA rewrite so deep links like `/compare`
resolve on refresh. Because `pnpm build` type-checks before bundling, the generated declaration
files (`src/auto-imports.d.ts`, `src/components.d.ts`, `src/types/routes.gen.d.ts`) are committed
so a fresh clone builds without a prior dev run.

## Credits

Built on the [VueTail](https://github.com/AbdulghaniKM/vuetail-template) starter; UI primitives
come from its [component registry](https://github.com/AbdulghaniKM/vuetail-components)
(`pnpm add-component <Name>`).
