import type { JsonValueType } from './types';
import { positionOf, type JsonParseError } from './parse';

export const NODE_OBJECT = 0;
export const NODE_ARRAY = 1;
export const NODE_STRING = 2;
export const NODE_NUMBER = 3;
export const NODE_BOOLEAN = 4;
export const NODE_NULL = 5;

export const NODE_TYPE_NAMES: JsonValueType[] = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'null',
];

export const MAX_NODES = 8_000_000;

/**
 * Depth is stored per node in a Uint16Array, and emitJson caches one indent string per
 * level, so unbounded nesting would silently wrap the depth and balloon that cache.
 * Far deeper than any real document, and well past what JSON.parse itself survives.
 */
export const MAX_DEPTH = 10_000;

export interface JsonIndex {
  count: number;
  type: Uint8Array;
  keyStart: Uint32Array;
  keyEnd: Uint32Array;
  valueStart: Uint32Array;
  valueEnd: Uint32Array;
  parent: Int32Array;
  childIndex: Uint32Array;
  childCount: Uint32Array;
  subtreeEnd: Uint32Array;
  depth: Uint16Array;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface JsonStats {
  characters: number;
  charactersNoWhitespace: number;
  lines: number;
  bytes: number;
  minifiedBytes: number;
  rootType: JsonValueType;
  depth: number;
  totalNodes: number;
  counts: Record<JsonValueType, number>;
  totalKeys: number;
  uniqueKeys: number;
  topKeys: KeyCount[];
  keyStatsPartial: boolean;
  largestArray: { node: number; length: number } | null;
  longestString: { node: number; length: number } | null;
  numberRange: { min: number; max: number } | null;
  numberStatsPartial: boolean;
  emptyValues: number;
  scanMs: number;
}

export type ScanResult =
  | { ok: true; index: JsonIndex; stats: JsonStats }
  | { ok: false; error: JsonParseError };

const KEY_SAMPLE_LIMIT = 400_000;
const KEY_UNIQUE_LIMIT = 4000;
const NUMBER_SAMPLE_LIMIT = 1_000_000;

export const utf8Length = (text: string): number => {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
};

export const countLines = (text: string): number => {
  if (!text) return 0;
  let lines = 1;
  let from = text.indexOf('\n');
  while (from !== -1) {
    lines++;
    from = text.indexOf('\n', from + 1);
  }
  return lines;
};

const countNonWhitespace = (text: string): number => {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) total++;
  }
  return total;
};

interface Tables {
  type: Uint8Array;
  keyStart: Uint32Array;
  keyEnd: Uint32Array;
  valueStart: Uint32Array;
  valueEnd: Uint32Array;
  parent: Int32Array;
  childIndex: Uint32Array;
  childCount: Uint32Array;
  subtreeEnd: Uint32Array;
  depth: Uint16Array;
}

const allocate = (capacity: number): Tables => ({
  type: new Uint8Array(capacity),
  keyStart: new Uint32Array(capacity),
  keyEnd: new Uint32Array(capacity),
  valueStart: new Uint32Array(capacity),
  valueEnd: new Uint32Array(capacity),
  parent: new Int32Array(capacity),
  childIndex: new Uint32Array(capacity),
  childCount: new Uint32Array(capacity),
  subtreeEnd: new Uint32Array(capacity),
  depth: new Uint16Array(capacity),
});

const growTables = (tables: Tables, capacity: number): Tables => {
  const next = allocate(capacity);
  next.type.set(tables.type);
  next.keyStart.set(tables.keyStart);
  next.keyEnd.set(tables.keyEnd);
  next.valueStart.set(tables.valueStart);
  next.valueEnd.set(tables.valueEnd);
  next.parent.set(tables.parent);
  next.childIndex.set(tables.childIndex);
  next.childCount.set(tables.childCount);
  next.subtreeEnd.set(tables.subtreeEnd);
  next.depth.set(tables.depth);
  return next;
};

const trim = (tables: Tables, count: number): JsonIndex => ({
  count,
  type: tables.type.slice(0, count),
  keyStart: tables.keyStart.slice(0, count),
  keyEnd: tables.keyEnd.slice(0, count),
  valueStart: tables.valueStart.slice(0, count),
  valueEnd: tables.valueEnd.slice(0, count),
  parent: tables.parent.slice(0, count),
  childIndex: tables.childIndex.slice(0, count),
  childCount: tables.childCount.slice(0, count),
  subtreeEnd: tables.subtreeEnd.slice(0, count),
  depth: tables.depth.slice(0, count),
});

const measureMinified = (index: JsonIndex): number => {
  let total = 0;
  for (let id = 0; id < index.count; id++) {
    if (index.keyEnd[id] > index.keyStart[id]) total += index.keyEnd[id] - index.keyStart[id] + 3;
    const type = index.type[id];
    if (type === NODE_OBJECT || type === NODE_ARRAY) {
      total += 2;
      const children = index.childCount[id];
      if (children > 1) total += children - 1;
    } else {
      total += index.valueEnd[id] - index.valueStart[id];
    }
  }
  return total;
};

export const scanJson = (text: string): ScanResult => {
  const started = Date.now();
  const length = text.length;

  let capacity = Math.min(MAX_NODES, Math.max(1024, Math.ceil(length / 14) + 16));
  let tables = allocate(capacity);
  let count = 0;

  let i = 0;
  let parent = -1;
  let depth = 0;
  let keyStart = 0;
  let keyEnd = 0;

  const stack: number[] = [];

  const counts: Record<JsonValueType, number> = {
    object: 0,
    array: 0,
    string: 0,
    number: 0,
    boolean: 0,
    null: 0,
  };

  const keyCounts = new Map<string, number>();
  let keySamples = 0;
  let keyStatsPartial = false;
  let totalKeys = 0;
  let maxDepth = 0;
  let emptyValues = 0;
  let numberSamples = 0;
  let numberStatsPartial = false;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let largestArray: JsonStats['largestArray'] = null;
  let longestString: JsonStats['longestString'] = null;

  const fail = (message: string, at = i): ScanResult => ({
    ok: false,
    error: { message, index: at, ...positionOf(text, at) },
  });

  const skipWhitespace = () => {
    while (i < length) {
      const code = text.charCodeAt(i);
      if (code === 32 || code === 10 || code === 9 || code === 13) i++;
      else break;
    }
  };

  // Set by readStringEnd when it returns -1, so callers can report why.
  let stringError = 'Unterminated string';
  let stringErrorAt = 0;

  const isHex = (code: number): boolean =>
    (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70);

  const readStringEnd = (from: number): number => {
    let j = from + 1;
    while (j < length) {
      const code = text.charCodeAt(j);
      if (code === 92) {
        const esc = text.charCodeAt(j + 1);
        // " \ / b f n r t u
        if (
          esc === 34 ||
          esc === 92 ||
          esc === 47 ||
          esc === 98 ||
          esc === 102 ||
          esc === 110 ||
          esc === 114 ||
          esc === 116
        ) {
          j += 2;
          continue;
        }
        if (esc === 117) {
          if (
            j + 5 >= length ||
            !isHex(text.charCodeAt(j + 2)) ||
            !isHex(text.charCodeAt(j + 3)) ||
            !isHex(text.charCodeAt(j + 4)) ||
            !isHex(text.charCodeAt(j + 5))
          ) {
            stringError = 'A \\u escape needs four hex digits';
            stringErrorAt = j;
            return -1;
          }
          j += 6;
          continue;
        }
        if (Number.isNaN(esc)) break;
        stringError = `Invalid escape sequence \\${text[j + 1]}`;
        stringErrorAt = j;
        return -1;
      }
      if (code === 34) return j + 1;
      if (code < 0x20) {
        stringError = 'Strings cannot contain a raw control character';
        stringErrorAt = j;
        return -1;
      }
      j++;
    }
    stringError = 'Unterminated string';
    stringErrorAt = from;
    return -1;
  };

  const addNode = (nodeType: number, valueStart: number): number => {
    if (count === capacity) {
      if (capacity >= MAX_NODES) return -1;
      capacity = Math.min(MAX_NODES, capacity * 2);
      tables = growTables(tables, capacity);
    }
    const id = count++;
    tables.type[id] = nodeType;
    tables.keyStart[id] = keyStart;
    tables.keyEnd[id] = keyEnd;
    tables.valueStart[id] = valueStart;
    tables.valueEnd[id] = valueStart;
    tables.parent[id] = parent;
    tables.depth[id] = depth;
    tables.subtreeEnd[id] = id + 1;
    tables.childCount[id] = 0;

    if (parent >= 0) {
      tables.childIndex[id] = tables.childCount[parent];
      tables.childCount[parent]++;
    } else {
      tables.childIndex[id] = 0;
    }

    if (keyEnd > keyStart) {
      totalKeys++;
      if (keySamples < KEY_SAMPLE_LIMIT) {
        keySamples++;
        const key = text.slice(keyStart, keyEnd);
        const existing = keyCounts.get(key);
        if (existing !== undefined) keyCounts.set(key, existing + 1);
        else if (keyCounts.size < KEY_UNIQUE_LIMIT) keyCounts.set(key, 1);
        else keyStatsPartial = true;
      } else {
        keyStatsPartial = true;
      }
    }

    counts[NODE_TYPE_NAMES[nodeType]]++;
    keyStart = 0;
    keyEnd = 0;
    return id;
  };

  // Set by readKey when it returns false, so callers can report why.
  let keyError = 'Expected a property name in double quotes';
  let keyErrorAt = 0;

  const readKey = (): boolean => {
    skipWhitespace();
    if (text.charCodeAt(i) !== 34) {
      keyError = 'Expected a property name in double quotes';
      keyErrorAt = i;
      return false;
    }
    const end = readStringEnd(i);
    if (end < 0) {
      keyError = stringError;
      keyErrorAt = stringErrorAt;
      return false;
    }
    keyStart = i + 1;
    keyEnd = end - 1;
    i = end;
    skipWhitespace();
    if (text.charCodeAt(i) !== 58) {
      keyError = 'Expected a colon after the property name';
      keyErrorAt = i;
      return false;
    }
    i++;
    skipWhitespace();
    return true;
  };

  const closeContainer = () => {
    const top = stack.pop() as number;
    tables.valueEnd[top] = i;
    tables.subtreeEnd[top] = count;
    if (tables.childCount[top] === 0) emptyValues++;
    if (tables.type[top] === NODE_ARRAY) {
      const size = tables.childCount[top];
      if (!largestArray || size > largestArray.length) largestArray = { node: top, length: size };
    }
    parent = stack.length ? stack[stack.length - 1] : -1;
    depth--;
  };

  skipWhitespace();
  if (i >= length) return fail('Nothing to parse yet', 0);

  for (;;) {
    const code = text.charCodeAt(i);

    if (code === 123 || code === 91) {
      const isObject = code === 123;
      const id = addNode(isObject ? NODE_OBJECT : NODE_ARRAY, i);
      if (id < 0)
        return fail(`This document has more than ${MAX_NODES.toLocaleString('en-US')} nodes`);
      stack.push(id);
      parent = id;
      depth++;
      if (depth > MAX_DEPTH) {
        return fail(
          `This document is nested more than ${MAX_DEPTH.toLocaleString('en-US')} levels deep`,
          i,
        );
      }
      if (depth > maxDepth) maxDepth = depth;
      i++;
      skipWhitespace();
      const next = text.charCodeAt(i);
      if ((isObject && next === 125) || (!isObject && next === 93)) {
        i++;
        closeContainer();
      } else if (isObject) {
        if (!readKey()) return fail(keyError, keyErrorAt);
        continue;
      } else {
        continue;
      }
    } else if (code === 34) {
      const end = readStringEnd(i);
      if (end < 0) return fail(stringError, stringErrorAt);
      const id = addNode(NODE_STRING, i);
      if (id < 0)
        return fail(`This document has more than ${MAX_NODES.toLocaleString('en-US')} nodes`);
      tables.valueEnd[id] = end;
      const size = end - i - 2;
      if (size === 0) emptyValues++;
      if (!longestString || size > longestString.length) longestString = { node: id, length: size };
      i = end;
    } else if (code === 116 || code === 102 || code === 110) {
      const word = code === 116 ? 'true' : code === 102 ? 'false' : 'null';
      if (text.startsWith(word, i)) {
        const id = addNode(code === 110 ? NODE_NULL : NODE_BOOLEAN, i);
        if (id < 0)
          return fail(`This document has more than ${MAX_NODES.toLocaleString('en-US')} nodes`);
        i += word.length;
        tables.valueEnd[id] = i;
        if (code === 110) emptyValues++;
      } else {
        return fail(`Unexpected token ${text[i]}`);
      }
    } else if (code === 45 || (code >= 48 && code <= 57)) {
      // RFC 8259 number grammar: -? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?
      let j = i;
      if (text.charCodeAt(j) === 45) j++;

      if (text.charCodeAt(j) === 48) {
        j++;
        const after = text.charCodeAt(j);
        if (after >= 48 && after <= 57) return fail('Numbers cannot have a leading zero', i);
      } else {
        const intStart = j;
        while (j < length) {
          const c = text.charCodeAt(j);
          if (c >= 48 && c <= 57) j++;
          else break;
        }
        if (j === intStart) return fail('Expected a digit after the minus sign', i);
      }

      if (text.charCodeAt(j) === 46) {
        j++;
        const fracStart = j;
        while (j < length) {
          const c = text.charCodeAt(j);
          if (c >= 48 && c <= 57) j++;
          else break;
        }
        if (j === fracStart) return fail('Expected a digit after the decimal point', i);
      }

      const exponent = text.charCodeAt(j);
      if (exponent === 101 || exponent === 69) {
        j++;
        const sign = text.charCodeAt(j);
        if (sign === 43 || sign === 45) j++;
        const expStart = j;
        while (j < length) {
          const c = text.charCodeAt(j);
          if (c >= 48 && c <= 57) j++;
          else break;
        }
        if (j === expStart) return fail('Expected a digit in the exponent', i);
      }

      const id = addNode(NODE_NUMBER, i);
      if (id < 0)
        return fail(`This document has more than ${MAX_NODES.toLocaleString('en-US')} nodes`);
      tables.valueEnd[id] = j;
      if (numberSamples < NUMBER_SAMPLE_LIMIT) {
        numberSamples++;
        const value = Number(text.slice(i, j));
        if (Number.isFinite(value)) {
          if (value < min) min = value;
          if (value > max) max = value;
        }
      } else {
        numberStatsPartial = true;
      }
      i = j;
    } else {
      return fail(`Unexpected token ${text[i] ?? 'end of input'}`);
    }

    for (;;) {
      skipWhitespace();

      if (stack.length === 0) {
        if (i >= length) {
          const index = trim(tables, count);
          const nonWhitespace = countNonWhitespace(text);
          const minifiedChars = measureMinified(index);
          const byteRatio = length > 0 ? utf8Length(text) / length : 1;
          return {
            ok: true,
            index,
            stats: {
              characters: length,
              charactersNoWhitespace: nonWhitespace,
              lines: countLines(text),
              bytes: Math.round(length * byteRatio),
              minifiedBytes: Math.round(minifiedChars * byteRatio),
              rootType: NODE_TYPE_NAMES[index.type[0]],
              depth: maxDepth,
              totalNodes: count,
              counts,
              totalKeys,
              uniqueKeys: keyCounts.size,
              topKeys: [...keyCounts.entries()]
                .map(([key, value]) => ({ key, count: value }))
                .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
                .slice(0, 12),
              keyStatsPartial,
              largestArray,
              longestString,
              numberRange: numberSamples > 0 && Number.isFinite(min) ? { min, max } : null,
              numberStatsPartial,
              emptyValues,
              scanMs: Date.now() - started,
            },
          };
        }
        return fail('Unexpected content after the end of the document');
      }

      const top = stack[stack.length - 1];
      const isObject = tables.type[top] === NODE_OBJECT;
      const next = text.charCodeAt(i);

      if (next === 44) {
        i++;
        skipWhitespace();
        if (isObject && !readKey()) return fail(keyError, keyErrorAt);
        break;
      }

      if ((isObject && next === 125) || (!isObject && next === 93)) {
        i++;
        closeContainer();
        continue;
      }

      if (i >= length) return fail(isObject ? "Expected ',' or '}'" : "Expected ',' or ']'");
      return fail(isObject ? "Expected ',' or '}'" : "Expected ',' or ']'");
    }
  }
};
