import type { JsonIndex } from './scan';
import { NODE_ARRAY, NODE_OBJECT } from './scan';

export interface FindOptions {
  caseSensitive?: boolean;
  keys?: boolean;
  values?: boolean;
  limit?: number;
}

export interface FindResult {
  matches: Int32Array;
  count: number;
  truncated: boolean;
  caseSensitive: boolean;
}

export const EMPTY_FIND: FindResult = {
  matches: new Int32Array(0),
  count: 0,
  truncated: false,
  caseSensitive: false,
};

export const LOWERCASE_LIMIT = 60_000_000;

const spanStart = (index: JsonIndex, id: number): number =>
  index.keyEnd[id] > 0 ? index.keyStart[id] - 1 : index.valueStart[id];

const nodeAtOffset = (index: JsonIndex, offset: number): number => {
  let low = 0;
  let high = index.count - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (spanStart(index, middle) <= offset) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

export const findInIndex = (
  text: string,
  index: JsonIndex,
  query: string,
  options: FindOptions = {},
): FindResult => {
  const needleRaw = query;
  if (!needleRaw || index.count === 0) return EMPTY_FIND;

  const searchKeys = options.keys ?? true;
  const searchValues = options.values ?? true;
  const limit = options.limit ?? 10_000;

  const canLower = text.length <= LOWERCASE_LIMIT;
  const caseSensitive = options.caseSensitive === true || !canLower;
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? needleRaw : needleRaw.toLowerCase();

  const matches = new Int32Array(Math.min(limit, index.count));
  let count = 0;
  let truncated = false;
  let previous = -1;
  let from = haystack.indexOf(needle);

  while (from !== -1) {
    const id = nodeAtOffset(index, from);
    if (id >= 0 && id !== previous) {
      const keyHit =
        searchKeys &&
        index.keyEnd[id] > 0 &&
        from >= index.keyStart[id] - 1 &&
        from < index.keyEnd[id] + 1;
      const container = index.type[id] === NODE_OBJECT || index.type[id] === NODE_ARRAY;
      const valueHit =
        searchValues && !container && from >= index.valueStart[id] && from < index.valueEnd[id];

      if (keyHit || valueHit) {
        matches[count++] = id;
        previous = id;
        if (count >= limit) {
          truncated = true;
          break;
        }
      }
    }
    from = haystack.indexOf(needle, from + 1);
  }

  return { matches: matches.subarray(0, count), count, truncated, caseSensitive };
};
