import type { JsonIndex, JsonStats } from './scan';
import type { JsonParseError } from './parse';
import type { IndentStyle, JsonValue } from './types';
import type { DiffNode, DiffSummary } from './diff';
import { scanJson } from './scan';
import { emitJson, indentText } from './emit';
import { parseJson } from './parse';
import { escapeToJsonString, removeEmptyValues, unescapeJsonString } from './format';
import { parseNdjson, repairJson } from './repair';
import { diffJson } from './diff';
import {
  csharpFromShape,
  dotnetFromShape,
  jsonToCsv,
  jsonToQueryString,
  jsonToYaml,
  shapeOfIndex,
  typeScriptFromShape,
  zodFromShape,
  type JsonShape,
} from './convert';

export type TransformOp =
  | 'beautify'
  | 'minify'
  | 'sortAsc'
  | 'sortDesc'
  | 'removeEmpty'
  | 'escape'
  | 'unescape'
  | 'repair';

export type ConvertTarget = 'typescript' | 'csharp' | 'dotnet' | 'zod' | 'yaml' | 'csv' | 'query';

export const PARSE_LIMIT = 32 * 1024 * 1024;
export const REPAIR_LIMIT = 24 * 1024 * 1024;
export const DIFF_LIMIT = 64 * 1024 * 1024;
export const DIFF_NODE_BUDGET = 400_000;

export type EngineRequest =
  | { id: number; kind: 'scan'; text: string }
  | { id: number; kind: 'validate'; text: string }
  | { id: number; kind: 'transform'; text: string; op: TransformOp; indent: IndentStyle }
  | {
      id: number;
      kind: 'convert';
      text: string;
      target: ConvertTarget;
      rootName: string;
      delimiter: string;
    }
  | { id: number; kind: 'diff'; left: string; right: string; ignoreArrayOrder: boolean }
  | { id: number; kind: 'generate'; records: number };

export type EngineResponse =
  | { id: number; kind: 'scan'; ok: true; index: JsonIndex; stats: JsonStats }
  | { id: number; kind: 'scan'; ok: false; error: JsonParseError }
  | { id: number; kind: 'validate'; ok: true; stats: JsonStats }
  | { id: number; kind: 'validate'; ok: false; error: JsonParseError }
  | { id: number; kind: 'transform'; ok: true; text: string; note?: string }
  | { id: number; kind: 'transform'; ok: false; message: string }
  | {
      id: number;
      kind: 'convert';
      ok: true;
      preview: string;
      truncated: boolean;
      size: number;
      text: string;
    }
  | { id: number; kind: 'convert'; ok: false; message: string }
  | { id: number; kind: 'diff'; ok: true; root: DiffNode; summary: DiffSummary }
  | { id: number; kind: 'diff'; ok: false; message: string }
  | { id: number; kind: 'generate'; ok: true; text: string }
  | { id: number; kind: 'generate'; ok: false; message: string };

export type EngineResponseOf<K extends EngineResponse['kind']> = Extract<
  EngineResponse,
  { kind: K }
>;

export type EngineCall = EngineRequest extends infer T
  ? T extends { id: number }
    ? Omit<T, 'id'>
    : never
  : never;

export interface EngineOutcome {
  response: EngineResponse;
  transfer: Transferable[];
}

const PREVIEW_CHARS = 120_000;

/**
 * Tools that materialize the document in memory walk it recursively, so they overflow the
 * stack somewhere past a few thousand levels. Refuse well before that with a message that
 * says what is actually wrong, instead of letting a RangeError escape.
 */
export const MAX_VALUE_DEPTH = 500;

const megabytes = (value: number) => `${Math.round(value / (1024 * 1024))} MB`;

/** Iterative, so measuring the depth can never overflow the stack itself. */
export const exceedsDepth = (value: JsonValue, limit = MAX_VALUE_DEPTH): boolean => {
  const values: JsonValue[] = [value];
  const depths: number[] = [1];

  while (values.length > 0) {
    const current = values.pop() as JsonValue;
    const depth = depths.pop() as number;
    if (depth > limit) return true;

    if (Array.isArray(current)) {
      for (const item of current) {
        values.push(item);
        depths.push(depth + 1);
      }
    } else if (current !== null && typeof current === 'object') {
      for (const key of Object.keys(current)) {
        values.push((current as Record<string, JsonValue>)[key]);
        depths.push(depth + 1);
      }
    }
  }

  return false;
};

const tooDeep = `This document is nested more than ${MAX_VALUE_DEPTH} levels deep. Explore, format and analyze still work — this tool has to hold the whole document in memory.`;

/**
 * A failure response shaped for the kind that was requested, so callers keep narrowing on
 * `response.ok` and never have to special-case a crash.
 */
export const engineFailure = (request: EngineRequest, message: string): EngineResponse => {
  if (request.kind === 'scan' || request.kind === 'validate') {
    return {
      id: request.id,
      kind: request.kind,
      ok: false,
      error: { message, index: 0, line: 1, column: 1 },
    };
  }
  return { id: request.id, kind: request.kind, ok: false, message };
};

export const failureMessageFor = (error: unknown): string =>
  error instanceof RangeError
    ? 'This document is too deeply nested or too large for this operation.'
    : 'Something went wrong processing this document.';

const parseForTools = (text: string): { value: JsonValue } | { message: string } => {
  if (text.length > PARSE_LIMIT) {
    return {
      message: `This document is larger than ${megabytes(PARSE_LIMIT)}. Explore, format and analyze still work — this tool needs to materialize the whole document in memory.`,
    };
  }
  const parsed = parseJson(text);
  if (!parsed.ok) return { message: `Line ${parsed.error.line}: ${parsed.error.message}` };
  if (exceedsDepth(parsed.value)) return { message: tooDeep };
  return { value: parsed.value };
};

const transform = (request: Extract<EngineRequest, { kind: 'transform' }>): EngineResponse => {
  const { id, text, op, indent } = request;

  if (op === 'escape') {
    if (text.length > PARSE_LIMIT) {
      return {
        id,
        kind: 'transform',
        ok: false,
        message: `Too large to escape (over ${megabytes(PARSE_LIMIT)}).`,
      };
    }
    return { id, kind: 'transform', ok: true, text: escapeToJsonString(text) };
  }

  if (op === 'unescape') {
    try {
      return { id, kind: 'transform', ok: true, text: unescapeJsonString(text) };
    } catch {
      return {
        id,
        kind: 'transform',
        ok: false,
        message: 'This does not look like an escaped JSON string.',
      };
    }
  }

  if (op === 'repair') {
    if (text.length > REPAIR_LIMIT) {
      return {
        id,
        kind: 'transform',
        ok: false,
        message: `Repair is limited to ${megabytes(REPAIR_LIMIT)} documents.`,
      };
    }
    const repaired = repairJson(text);
    const parsed = parseJson(repaired.text);
    if (parsed.ok) {
      const scan = scanJson(repaired.text);
      if (scan.ok) {
        return {
          id,
          kind: 'transform',
          ok: true,
          text: emitJson(repaired.text, scan.index, { indent: indentText(indent) }),
          note: 'Repaired and reformatted',
        };
      }
    }
    const lines = parseNdjson(text);
    if (lines) {
      return {
        id,
        kind: 'transform',
        ok: true,
        text: JSON.stringify(lines, null, indentText(indent)),
        note: `Merged ${lines.length.toLocaleString('en-US')} newline-delimited records into an array`,
      };
    }
    return {
      id,
      kind: 'transform',
      ok: false,
      message: 'Could not repair this input automatically.',
    };
  }

  if (op === 'removeEmpty') {
    const parsed = parseForTools(text);
    if ('message' in parsed) return { id, kind: 'transform', ok: false, message: parsed.message };
    return {
      id,
      kind: 'transform',
      ok: true,
      text: JSON.stringify(removeEmptyValues(parsed.value), null, indentText(indent)),
    };
  }

  const scan = scanJson(text);
  if (!scan.ok) {
    return {
      id,
      kind: 'transform',
      ok: false,
      message: `Line ${scan.error.line}: ${scan.error.message}`,
    };
  }

  const indentValue = op === 'minify' ? '' : indentText(indent);
  const sort = op === 'sortAsc' ? 'asc' : op === 'sortDesc' ? 'desc' : null;

  return {
    id,
    kind: 'transform',
    ok: true,
    text: emitJson(text, scan.index, { indent: indentValue, sort }),
  };
};

const SHAPE_TARGETS = new Set<ConvertTarget>(['typescript', 'csharp', 'dotnet', 'zod']);

const renderShape = (target: ConvertTarget, shape: JsonShape, rootName: string): string => {
  if (target === 'typescript') return typeScriptFromShape(shape, rootName || 'Root');
  if (target === 'csharp') return csharpFromShape(shape, rootName || 'Root');
  if (target === 'dotnet') return dotnetFromShape(shape, rootName || 'Root');
  return zodFromShape(shape, rootName || 'root');
};

const renderValue = (target: ConvertTarget, value: JsonValue, delimiter: string): string => {
  if (target === 'yaml') return jsonToYaml(value);
  if (target === 'csv') return jsonToCsv(value, delimiter);
  return jsonToQueryString(value);
};

const convert = (request: Extract<EngineRequest, { kind: 'convert' }>): EngineResponse => {
  const { id, text, target, rootName, delimiter } = request;
  const failure = (message: string): EngineResponse => ({
    id,
    kind: 'convert',
    ok: false,
    message,
  });

  let output = '';
  try {
    if (SHAPE_TARGETS.has(target)) {
      const scanned = scanJson(text);
      if (!scanned.ok) return failure(`Line ${scanned.error.line}: ${scanned.error.message}`);
      // shapeOfIndex and the renderers recurse per level, so gate on the depth the scan
      // already measured rather than letting them overflow.
      if (scanned.stats.depth > MAX_VALUE_DEPTH) return failure(tooDeep);
      output = renderShape(target, shapeOfIndex(text, scanned.index), rootName);
    } else {
      const parsed = parseForTools(text);
      if ('message' in parsed) return failure(parsed.message);
      output = renderValue(target, parsed.value, delimiter);
    }
  } catch {
    return failure('This document could not be converted.');
  }

  const truncated = output.length > PREVIEW_CHARS;
  return {
    id,
    kind: 'convert',
    ok: true,
    preview: truncated ? `${output.slice(0, PREVIEW_CHARS)}\n…` : output,
    truncated,
    size: output.length,
    text: output,
  };
};

const diff = (request: Extract<EngineRequest, { kind: 'diff' }>): EngineResponse => {
  const { id, left, right, ignoreArrayOrder } = request;

  if (left.length > DIFF_LIMIT || right.length > DIFF_LIMIT) {
    return {
      id,
      kind: 'diff',
      ok: false,
      message: `Comparing is limited to ${megabytes(DIFF_LIMIT)} per side.`,
    };
  }

  const a = parseJson(left);
  if (!a.ok)
    return { id, kind: 'diff', ok: false, message: `A · line ${a.error.line}: ${a.error.message}` };
  const b = parseJson(right);
  if (!b.ok)
    return { id, kind: 'diff', ok: false, message: `B · line ${b.error.line}: ${b.error.message}` };

  if (exceedsDepth(a.value) || exceedsDepth(b.value)) {
    return { id, kind: 'diff', ok: false, message: tooDeep };
  }

  const result = diffJson(a.value, b.value, { ignoreArrayOrder, maxNodes: DIFF_NODE_BUDGET });
  return { id, kind: 'diff', ok: true, root: result.root, summary: result.summary };
};

const CITIES = ['Manchester', 'Basrah', 'Lisbon', 'Osaka', 'Nairobi', 'Bogotá', 'Tallinn', 'Perth'];
const STATUSES = ['pending', 'shipped', 'delivered', 'refunded', 'cancelled'];
const TAGS = ['input', 'usb-c', 'sale', 'bulk', 'fragile', 'digital', 'refurbished'];

const generate = (records: number): string => {
  const parts: string[] = ['{\n  "generatedAt": "2026-08-22T00:00:00Z",\n  "records": [\n'];
  let buffer = '';

  for (let i = 0; i < records; i++) {
    const tagCount = 1 + (i % 3);
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) tags.push(`"${TAGS[(i + t) % TAGS.length]}"`);

    buffer += `    {"id":${i},"ref":"ord_${(i * 2654435761) % 99999999}","status":"${
      STATUSES[i % STATUSES.length]
    }","paid":${i % 3 !== 0},"customer":{"id":${1000 + (i % 5000)},"name":"Customer ${i}","city":"${
      CITIES[i % CITIES.length]
    }","vip":${i % 17 === 0}},"items":[{"sku":"SKU-${i % 9999}","qty":${1 + (i % 5)},"price":${(
      (i % 900) +
      9.99
    ).toFixed(
      2,
    )},"tags":[${tags.join(',')}]},{"sku":"SKU-${(i * 7) % 9999}","qty":${1 + (i % 2)},"price":${(
      (i % 120) +
      4.5
    ).toFixed(2)},"tags":[]}],"totals":{"net":${((i % 900) + 14.49).toFixed(2)},"tax":${(
      (i % 90) +
      2.9
    ).toFixed(
      2,
    )},"grand":${((i % 990) + 17.39).toFixed(2)}},"notes":${i % 11 === 0 ? 'null' : `"note ${i}"`}}${
      i < records - 1 ? ',' : ''
    }\n`;

    if (buffer.length > 65_536) {
      parts.push(buffer);
      buffer = '';
    }
  }

  parts.push(buffer);
  parts.push('  ]\n}\n');
  return parts.join('');
};

/**
 * Never throws. A crash here would leave the caller's promise unsettled forever, which in
 * turn latches the store's `busy` flag and blocks every later operation, so every failure
 * has to come back as an ordinary `ok: false` response instead.
 */
export const handleEngineRequest = (request: EngineRequest): EngineOutcome => {
  try {
    return runEngineRequest(request);
  } catch (error) {
    return { response: engineFailure(request, failureMessageFor(error)), transfer: [] };
  }
};

const runEngineRequest = (request: EngineRequest): EngineOutcome => {
  if (request.kind === 'scan') {
    const result = scanJson(request.text);
    if (!result.ok) {
      return {
        response: { id: request.id, kind: 'scan', ok: false, error: result.error },
        transfer: [],
      };
    }
    const { index } = result;
    return {
      response: { id: request.id, kind: 'scan', ok: true, index, stats: result.stats },
      transfer: [
        index.type.buffer,
        index.keyStart.buffer,
        index.keyEnd.buffer,
        index.valueStart.buffer,
        index.valueEnd.buffer,
        index.parent.buffer,
        index.childIndex.buffer,
        index.childCount.buffer,
        index.subtreeEnd.buffer,
        index.depth.buffer,
      ] as Transferable[],
    };
  }

  if (request.kind === 'validate') {
    const result = scanJson(request.text);
    return {
      response: result.ok
        ? { id: request.id, kind: 'validate', ok: true, stats: result.stats }
        : { id: request.id, kind: 'validate', ok: false, error: result.error },
      transfer: [],
    };
  }

  if (request.kind === 'transform') return { response: transform(request), transfer: [] };
  if (request.kind === 'convert') return { response: convert(request), transfer: [] };
  if (request.kind === 'diff') return { response: diff(request), transfer: [] };

  return {
    response: { id: request.id, kind: 'generate', ok: true, text: generate(request.records) },
    transfer: [],
  };
};
