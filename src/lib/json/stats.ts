import type { JsonPathSegment, JsonValue, JsonValueType } from './types';
import { byteLength } from './format';
import { pathToString, valueType } from './path';

export interface KeyCount {
  key: string;
  count: number;
}

export interface JsonStats {
  characters: number;
  charactersNoWhitespace: number;
  lines: number;
  bytes: number;
  prettyBytes: number;
  minifiedBytes: number;
  savedBytes: number;
  savedPercent: number;
  rootType: JsonValueType;
  depth: number;
  totalNodes: number;
  counts: Record<JsonValueType, number>;
  totalKeys: number;
  uniqueKeys: number;
  topKeys: KeyCount[];
  largestArray: { path: string; length: number } | null;
  longestString: { path: string; length: number } | null;
  numberRange: { min: number; max: number } | null;
  emptyValues: number;
}

interface Frame {
  value: JsonValue;
  path: JsonPathSegment[];
  depth: number;
}

export const analyzeJson = (value: JsonValue, raw: string): JsonStats => {
  const counts: Record<JsonValueType, number> = {
    object: 0,
    array: 0,
    string: 0,
    number: 0,
    boolean: 0,
    null: 0,
  };

  const keyCounts = new Map<string, number>();
  const stack: Frame[] = [{ value, path: [], depth: 1 }];

  let depth = 0;
  let totalNodes = 0;
  let totalKeys = 0;
  let emptyValues = 0;
  let largestArray: JsonStats['largestArray'] = null;
  let longestString: JsonStats['longestString'] = null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sawNumber = false;

  while (stack.length) {
    const frame = stack.pop() as Frame;
    const type = valueType(frame.value);

    totalNodes++;
    counts[type]++;
    if ((type === 'object' || type === 'array') && frame.depth > depth) depth = frame.depth;

    if (type === 'array') {
      const items = frame.value as JsonValue[];
      if (items.length === 0) emptyValues++;
      if (!largestArray || items.length > largestArray.length) {
        largestArray = { path: pathToString(frame.path), length: items.length };
      }
      for (let i = items.length - 1; i >= 0; i--) {
        stack.push({ value: items[i], path: [...frame.path, i], depth: frame.depth + 1 });
      }
      continue;
    }

    if (type === 'object') {
      const entries = Object.entries(frame.value as Record<string, JsonValue>);
      if (entries.length === 0) emptyValues++;
      totalKeys += entries.length;
      for (let i = entries.length - 1; i >= 0; i--) {
        const [key, child] = entries[i];
        keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
        stack.push({ value: child, path: [...frame.path, key], depth: frame.depth + 1 });
      }
      continue;
    }

    if (type === 'string') {
      const text = frame.value as string;
      if (text.length === 0) emptyValues++;
      if (!longestString || text.length > longestString.length) {
        longestString = { path: pathToString(frame.path), length: text.length };
      }
      continue;
    }

    if (type === 'number') {
      const num = frame.value as number;
      sawNumber = true;
      if (num < min) min = num;
      if (num > max) max = num;
      continue;
    }

    if (type === 'null') emptyValues++;
  }

  const minified = JSON.stringify(value) ?? '';
  const pretty = JSON.stringify(value, null, 2) ?? '';
  const minifiedBytes = byteLength(minified);
  const prettyBytes = byteLength(pretty);
  const bytes = byteLength(raw);

  const topKeys = [...keyCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 8);

  return {
    characters: raw.length,
    charactersNoWhitespace: raw.replace(/\s/g, '').length,
    lines: raw ? raw.split('\n').length : 0,
    bytes,
    prettyBytes,
    minifiedBytes,
    savedBytes: Math.max(0, bytes - minifiedBytes),
    savedPercent: bytes > 0 ? Math.max(0, ((bytes - minifiedBytes) / bytes) * 100) : 0,
    rootType: valueType(value),
    depth,
    totalNodes,
    counts,
    totalKeys,
    uniqueKeys: keyCounts.size,
    topKeys,
    largestArray,
    longestString,
    numberRange: sawNumber ? { min, max } : null,
    emptyValues,
  };
};

export const gzipSize = async (text: string): Promise<number | null> => {
  if (typeof CompressionStream === 'undefined' || !text) return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    return buffer.byteLength;
  } catch {
    return null;
  }
};
