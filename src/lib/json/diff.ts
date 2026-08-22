import type { JsonPathSegment, JsonValue, JsonValueType } from './types';
import { valueType } from './path';
import { minifyJson } from './format';

export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffNode {
  id: string;
  key: JsonPathSegment | null;
  path: JsonPathSegment[];
  kind: DiffKind;
  leftText?: string;
  rightText?: string;
  leftType?: JsonValueType;
  rightType?: JsonValueType;
  children?: DiffNode[];
  truncated?: boolean;
  unchangedLeaves?: number;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  identical: boolean;
}

export interface DiffOptions {
  ignoreArrayOrder?: boolean;
  maxNodes?: number;
}

const PREVIEW_CHARS = 200;

const clip = (text: string): string =>
  text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}\u2026` : text;

const previewOf = (value: JsonValue): string => {
  const type = valueType(value);
  if (type === 'string') return clip(value as string);
  if (type === 'object' || type === 'array') return clip(minifyJson(value));
  return String(value);
};

const MISSING = Symbol('missing');

type Side = JsonValue | typeof MISSING;

type Pair = [left: Side, right: Side, index: number];

export const deepEqual = (a: JsonValue, b: JsonValue): boolean => {
  if (a === b) return true;
  const typeA = valueType(a);
  const typeB = valueType(b);
  if (typeA !== typeB) return false;

  if (typeA === 'array') {
    const arrA = a as JsonValue[];
    const arrB = b as JsonValue[];
    if (arrA.length !== arrB.length) return false;
    return arrA.every((item, index) => deepEqual(item, arrB[index]));
  }

  if (typeA === 'object') {
    const objA = a as Record<string, JsonValue>;
    const objB = b as Record<string, JsonValue>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => key in objB && deepEqual(objA[key], objB[key]));
  }

  return false;
};

const idFor = (path: JsonPathSegment[]): string =>
  path.map((s) => (typeof s === 'number' ? `#${s}` : `.${s}`)).join('');

const rollup = (children: DiffNode[]): DiffKind =>
  children.every((child) => child.kind === 'unchanged') ? 'unchanged' : 'changed';

const unchangedLeavesIn = (children: DiffNode[]): number =>
  children.reduce(
    (total, child) => (child.kind === 'unchanged' ? total + (child.unchangedLeaves ?? 1) : total),
    0,
  );

const HASH_SEED = 0x811c9dc5;
const HASH_PRIME = 16777619;
const HASH_SAMPLE = 256;

const hashText = (text: string, seed: number): number => {
  let hash = seed ^ text.length;
  const limit = Math.min(text.length, HASH_SAMPLE);
  for (let index = 0; index < limit; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), HASH_PRIME);
  return hash | 0;
};

const hashOf = (value: JsonValue): number => {
  const type = valueType(value);

  if (type === 'object') {
    let total = 0;
    for (const [key, item] of Object.entries(value as Record<string, JsonValue>)) {
      total = (total + Math.imul(hashText(key, HASH_SEED), 31) + hashOf(item)) | 0;
    }
    return Math.imul(total ^ 0x9e3779b9, 2246822519) | 0;
  }

  if (type === 'array') {
    let total = 0x1b873593;
    for (const item of value as JsonValue[]) total = (Math.imul(total, 31) + hashOf(item)) | 0;
    return total | 0;
  }

  if (type === 'string') return hashText(value as string, HASH_SEED);
  if (type === 'number') return hashText(String(value), 0x2f6f2f6f);
  if (type === 'boolean') return value === true ? 0x1111 : 0x2222;
  return 0x3333;
};

const bucketsOf = (items: JsonValue[]): Map<number, number[]> => {
  const buckets = new Map<number, number[]>();
  items.forEach((item, index) => {
    const hash = hashOf(item);
    const bucket = buckets.get(hash);
    if (bucket) bucket.push(index);
    else buckets.set(hash, [index]);
  });
  return buckets;
};

const takeEqual = (
  buckets: Map<number, number[]>,
  item: JsonValue,
  candidates: JsonValue[],
  after: number,
): number => {
  const bucket = buckets.get(hashOf(item));
  if (!bucket) return -1;

  for (let position = 0; position < bucket.length; position++) {
    const index = bucket[position];
    if (index <= after) continue;
    if (!deepEqual(item, candidates[index])) continue;
    bucket.splice(position, 1);
    return index;
  }

  return -1;
};

const joinPairs = (
  left: JsonValue[],
  right: JsonValue[],
  partnerOf: (index: number) => number | undefined,
): Pair[] => {
  const pairs: Pair[] = [];
  const taken = new Set<number>();

  left.forEach((item, index) => {
    const partner = partnerOf(index);
    if (partner === undefined) {
      pairs.push([item, MISSING, index]);
      return;
    }
    taken.add(partner);
    pairs.push([item, right[partner], index]);
  });

  right.forEach((item, index) => {
    if (!taken.has(index)) pairs.push([MISSING, item, index]);
  });

  return pairs;
};

const matchByValue = (left: JsonValue[], right: JsonValue[]): Pair[] => {
  const buckets = bucketsOf(right);
  const partners = left.map((item) => takeEqual(buckets, item, right, -1));
  return joinPairs(left, right, (index) => (partners[index] === -1 ? undefined : partners[index]));
};

const IDENTITY_KEYS = ['id', '_id', 'uuid', 'guid', 'key', 'code', 'slug', 'name'];

const identityOf = (value: JsonValue | undefined): string | null => {
  if (value === undefined) return null;
  const type = valueType(value);
  if (type === 'string') return `s${value as string}`;
  if (type === 'number' || type === 'boolean') return `v${String(value)}`;
  return null;
};

const identitiesFor = (items: JsonValue[], key: string): string[] | null => {
  const identities: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (valueType(item) !== 'object') return null;
    const identity = identityOf((item as Record<string, JsonValue>)[key]);
    if (identity === null || seen.has(identity)) return null;
    seen.add(identity);
    identities.push(identity);
  }

  return identities;
};

const matchByIdentity = (left: JsonValue[], right: JsonValue[]): Pair[] | null => {
  if (left.length === 0 || right.length === 0) return null;
  if (valueType(left[0]) !== 'object' || valueType(right[0]) !== 'object') return null;
  const candidates = Object.keys(left[0] as Record<string, JsonValue>);

  for (const key of IDENTITY_KEYS) {
    if (!candidates.includes(key)) continue;
    const leftIds = identitiesFor(left, key);
    if (!leftIds) continue;
    const rightIds = identitiesFor(right, key);
    if (!rightIds) continue;

    const positions = new Map<string, number>();
    rightIds.forEach((identity, index) => positions.set(identity, index));
    return joinPairs(left, right, (index) => positions.get(leftIds[index]));
  }

  return null;
};

const alignInOrder = (left: JsonValue[], right: JsonValue[]): Pair[] => {
  const buckets = bucketsOf(right);
  const partners: number[] = [];
  let anchor = -1;

  for (const item of left) {
    const match = takeEqual(buckets, item, right, anchor);
    partners.push(match);
    if (match !== -1) anchor = match;
  }

  const pairs: Pair[] = [];
  const pending: number[] = [];
  let cursor = 0;

  const drain = (until: number) => {
    const spare: number[] = [];
    for (; cursor < until; cursor++) spare.push(cursor);

    for (let step = 0; step < Math.max(pending.length, spare.length); step++) {
      const from = pending[step];
      const to = spare[step];
      if (from !== undefined && to !== undefined) pairs.push([left[from], right[to], from]);
      else if (from !== undefined) pairs.push([left[from], MISSING, from]);
      else pairs.push([MISSING, right[to], to]);
    }

    pending.length = 0;
  };

  partners.forEach((match, index) => {
    if (match === -1) {
      pending.push(index);
      return;
    }
    drain(match);
    pairs.push([left[index], right[match], index]);
    cursor = match + 1;
  });

  drain(right.length);
  return pairs;
};

const pairItems = (left: JsonValue[], right: JsonValue[], options: DiffOptions): Pair[] =>
  options.ignoreArrayOrder
    ? matchByValue(left, right)
    : (matchByIdentity(left, right) ?? alignInOrder(left, right));

interface Budget {
  remaining: number;
}

const build = (
  key: JsonPathSegment | null,
  path: JsonPathSegment[],
  left: Side,
  right: Side,
  options: DiffOptions,
  budget: Budget,
): DiffNode => {
  const id = left === MISSING ? `${idFor(path)}+` : idFor(path);

  if (left === MISSING) {
    return {
      id,
      key,
      path,
      kind: 'added',
      rightText: previewOf(right as JsonValue),
      rightType: valueType(right as JsonValue),
    };
  }

  if (right === MISSING) {
    return {
      id,
      key,
      path,
      kind: 'removed',
      leftText: previewOf(left as JsonValue),
      leftType: valueType(left as JsonValue),
    };
  }

  const leftValue = left as JsonValue;
  const rightValue = right as JsonValue;
  const leftType = valueType(leftValue);
  const rightType = valueType(rightValue);

  if (leftType === 'object' && rightType === 'object') {
    const leftObject = leftValue as Record<string, JsonValue>;
    const rightObject = rightValue as Record<string, JsonValue>;
    const keys = [...new Set([...Object.keys(leftObject), ...Object.keys(rightObject)])];

    if (budget.remaining <= 0) {
      return {
        id,
        key,
        path,
        kind: deepEqual(leftValue, rightValue) ? 'unchanged' : 'changed',
        leftText: previewOf(leftValue),
        rightText: previewOf(rightValue),
        leftType,
        rightType,
        truncated: true,
      };
    }
    budget.remaining -= keys.length;

    const children = keys.map((childKey) =>
      build(
        childKey,
        [...path, childKey],
        childKey in leftObject ? leftObject[childKey] : MISSING,
        childKey in rightObject ? rightObject[childKey] : MISSING,
        options,
        budget,
      ),
    );

    const kind = rollup(children);
    const unchangedLeaves = unchangedLeavesIn(children);
    if (kind === 'unchanged') return { id, key, path, kind, leftType, rightType, unchangedLeaves };

    return {
      id,
      key,
      path,
      kind,
      leftType,
      rightType,
      unchangedLeaves,
      children: children.filter((child) => child.kind !== 'unchanged'),
    };
  }

  if (leftType === 'array' && rightType === 'array') {
    const leftArray = leftValue as JsonValue[];
    const rightArray = rightValue as JsonValue[];

    const pairs = pairItems(leftArray, rightArray, options);

    if (budget.remaining <= 0) {
      return {
        id,
        key,
        path,
        kind: deepEqual(leftValue, rightValue) ? 'unchanged' : 'changed',
        leftText: previewOf(leftValue),
        rightText: previewOf(rightValue),
        leftType,
        rightType,
        truncated: true,
      };
    }
    budget.remaining -= pairs.length;

    const children = pairs.map(([leftItem, rightItem, position]) =>
      build(position, [...path, position], leftItem, rightItem, options, budget),
    );

    const kind = rollup(children);
    const unchangedLeaves = unchangedLeavesIn(children);
    if (kind === 'unchanged') return { id, key, path, kind, leftType, rightType, unchangedLeaves };

    return {
      id,
      key,
      path,
      kind,
      leftType,
      rightType,
      unchangedLeaves,
      children: children.filter((child) => child.kind !== 'unchanged'),
    };
  }

  const equal = deepEqual(leftValue, rightValue);
  return {
    id,
    key,
    path,
    kind: equal ? 'unchanged' : 'changed',
    leftText: previewOf(leftValue),
    rightText: previewOf(rightValue),
    leftType,
    rightType,
  };
};

export const summarize = (node: DiffNode): DiffSummary => {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, unchanged: 0, identical: true };
  const stack: DiffNode[] = [node];

  while (stack.length) {
    const current = stack.pop() as DiffNode;
    summary.unchanged += current.unchangedLeaves ?? 0;

    if (current.children?.length) {
      for (const child of current.children) stack.push(child);
      continue;
    }
    if (current.kind === 'added') summary.added++;
    else if (current.kind === 'removed') summary.removed++;
    else if (current.kind === 'changed') summary.changed++;
    else if (current.unchangedLeaves === undefined) summary.unchanged++;
  }

  summary.identical = summary.added === 0 && summary.removed === 0 && summary.changed === 0;
  return summary;
};

export const diffJson = (
  left: JsonValue,
  right: JsonValue,
  options: DiffOptions = {},
): { root: DiffNode; summary: DiffSummary } => {
  const budget: Budget = { remaining: options.maxNodes ?? Number.POSITIVE_INFINITY };
  const root = build(null, [], left, right, options, budget);
  return { root, summary: summarize(root) };
};
