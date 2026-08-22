import type { JsonIndex } from './scan';
import { NODE_ARRAY, NODE_OBJECT, NODE_STRING, NODE_TYPE_NAMES } from './scan';
import type { JsonValueType } from './types';

export const isContainerNode = (index: JsonIndex, id: number): boolean =>
  index.type[id] === NODE_OBJECT || index.type[id] === NODE_ARRAY;

export const nodeTypeOf = (index: JsonIndex, id: number): JsonValueType =>
  NODE_TYPE_NAMES[index.type[id]];

export const hasKey = (index: JsonIndex, id: number): boolean => index.keyEnd[id] > 0;

export const keyTextOf = (text: string, index: JsonIndex, id: number): string | null =>
  hasKey(index, id) ? text.slice(index.keyStart[id], index.keyEnd[id]) : null;

export const rawTextOf = (text: string, index: JsonIndex, id: number, maxLength = 400): string => {
  const start = index.valueStart[id];
  const end = Math.min(index.valueEnd[id], start + maxLength);
  const slice = text.slice(start, end);
  return end < index.valueEnd[id] ? `${slice}…` : slice;
};

export const stringValueOf = (
  text: string,
  index: JsonIndex,
  id: number,
  maxLength = 400,
): string => {
  if (index.type[id] !== NODE_STRING) return rawTextOf(text, index, id, maxLength);
  const start = index.valueStart[id] + 1;
  const end = Math.min(index.valueEnd[id] - 1, start + maxLength);
  const slice = text.slice(start, end);
  return end < index.valueEnd[id] - 1 ? `${slice}…` : slice;
};

export const subtreeTextOf = (text: string, index: JsonIndex, id: number): string =>
  text.slice(index.valueStart[id], index.valueEnd[id]);

export const childrenOf = (index: JsonIndex, id: number, limit = Infinity): number[] => {
  const total = Math.min(index.childCount[id], limit);
  const out: number[] = [];
  let child = id + 1;
  for (let k = 0; k < total; k++) {
    out.push(child);
    child = index.subtreeEnd[child];
  }
  return out;
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const pathOf = (text: string, index: JsonIndex, id: number): string => {
  const segments: string[] = [];
  let current = id;
  for (;;) {
    const parent = index.parent[current];
    if (parent < 0) break;
    if (index.type[parent] === NODE_ARRAY) {
      segments.push(`[${index.childIndex[current]}]`);
    } else {
      const key = text.slice(index.keyStart[current], index.keyEnd[current]);
      segments.push(IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`);
    }
    current = parent;
  }
  segments.reverse();
  return `$${segments.join('')}`;
};

export const ancestorsOf = (index: JsonIndex, id: number): number[] => {
  const out: number[] = [];
  let current = index.parent[id];
  while (current >= 0) {
    out.push(current);
    current = index.parent[current];
  }
  return out;
};

export const containersToDepth = (index: JsonIndex, depth: number): Set<number> => {
  const expanded = new Set<number>();
  for (let id = 0; id < index.count; id++) {
    if (index.depth[id] < depth && isContainerNode(index, id) && index.childCount[id] > 0) {
      expanded.add(id);
    }
  }
  return expanded;
};

export const allContainers = (index: JsonIndex, limit = 500_000): Set<number> => {
  const expanded = new Set<number>();
  for (let id = 0; id < index.count && expanded.size < limit; id++) {
    if (isContainerNode(index, id) && index.childCount[id] > 0) expanded.add(id);
  }
  return expanded;
};

export const buildRows = (
  index: JsonIndex,
  expanded: Set<number>,
  buffer: Int32Array,
  filter?: Set<number> | null,
): number => {
  let id = 0;
  let out = 0;
  const limit = buffer.length;

  if (filter) {
    while (id < index.count && out < limit) {
      if (filter.has(id)) {
        buffer[out++] = id;
        if (isContainerNode(index, id) && index.childCount[id] > 0) {
          id += 1;
          continue;
        }
      }
      id = index.subtreeEnd[id];
    }
    return out;
  }

  while (id < index.count && out < limit) {
    buffer[out++] = id;
    if (isContainerNode(index, id) && index.childCount[id] > 0 && expanded.has(id)) id += 1;
    else id = index.subtreeEnd[id];
  }

  return out;
};

export const rowsForFilter = (
  index: JsonIndex,
  matches: Int32Array,
  count: number,
): Set<number> => {
  const keep = new Set<number>();
  for (let k = 0; k < count; k++) {
    let current = matches[k];
    keep.add(current);
    current = index.parent[current];
    while (current >= 0 && !keep.has(current)) {
      keep.add(current);
      current = index.parent[current];
    }
  }
  return keep;
};
