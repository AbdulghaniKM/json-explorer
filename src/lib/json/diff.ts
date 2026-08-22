import type { JsonPathSegment, JsonValue, JsonValueType } from './types';
import { valueType } from './path';

export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffNode {
  id: string;
  key: JsonPathSegment | null;
  path: JsonPathSegment[];
  kind: DiffKind;
  left?: JsonValue;
  right?: JsonValue;
  leftType?: JsonValueType;
  rightType?: JsonValueType;
  children?: DiffNode[];
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
}

const MISSING = Symbol('missing');

type Side = JsonValue | typeof MISSING;

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

const matchByValue = (left: JsonValue[], right: JsonValue[]): Array<[Side, Side]> => {
  const pairs: Array<[Side, Side]> = [];
  const taken = new Set<number>();

  for (const item of left) {
    const index = right.findIndex((candidate, i) => !taken.has(i) && deepEqual(item, candidate));
    if (index === -1) pairs.push([item, MISSING]);
    else {
      taken.add(index);
      pairs.push([item, right[index]]);
    }
  }

  right.forEach((item, index) => {
    if (!taken.has(index)) pairs.push([MISSING, item]);
  });

  return pairs;
};

const build = (
  key: JsonPathSegment | null,
  path: JsonPathSegment[],
  left: Side,
  right: Side,
  options: DiffOptions,
): DiffNode => {
  const id = idFor(path);

  if (left === MISSING) {
    return {
      id,
      key,
      path,
      kind: 'added',
      right: right as JsonValue,
      rightType: valueType(right as JsonValue),
    };
  }

  if (right === MISSING) {
    return {
      id,
      key,
      path,
      kind: 'removed',
      left: left as JsonValue,
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

    const children = keys.map((childKey) =>
      build(
        childKey,
        [...path, childKey],
        childKey in leftObject ? leftObject[childKey] : MISSING,
        childKey in rightObject ? rightObject[childKey] : MISSING,
        options,
      ),
    );

    return {
      id,
      key,
      path,
      kind: rollup(children),
      left: leftValue,
      right: rightValue,
      leftType,
      rightType,
      children,
    };
  }

  if (leftType === 'array' && rightType === 'array') {
    const leftArray = leftValue as JsonValue[];
    const rightArray = rightValue as JsonValue[];

    const pairs: Array<[Side, Side]> = options.ignoreArrayOrder
      ? matchByValue(leftArray, rightArray)
      : Array.from({ length: Math.max(leftArray.length, rightArray.length) }, (_, index) => [
          index < leftArray.length ? leftArray[index] : MISSING,
          index < rightArray.length ? rightArray[index] : MISSING,
        ]);

    const children = pairs.map(([leftItem, rightItem], index) =>
      build(index, [...path, index], leftItem, rightItem, options),
    );

    return {
      id,
      key,
      path,
      kind: rollup(children),
      left: leftValue,
      right: rightValue,
      leftType,
      rightType,
      children,
    };
  }

  const equal = deepEqual(leftValue, rightValue);
  return {
    id,
    key,
    path,
    kind: equal ? 'unchanged' : 'changed',
    left: leftValue,
    right: rightValue,
    leftType,
    rightType,
  };
};

export const summarize = (node: DiffNode): DiffSummary => {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, unchanged: 0, identical: true };
  const stack: DiffNode[] = [node];

  while (stack.length) {
    const current = stack.pop() as DiffNode;
    if (current.children?.length) {
      stack.push(...current.children);
      continue;
    }
    if (current.kind === 'added') summary.added++;
    else if (current.kind === 'removed') summary.removed++;
    else if (current.kind === 'changed') summary.changed++;
    else summary.unchanged++;
  }

  summary.identical = summary.added === 0 && summary.removed === 0 && summary.changed === 0;
  return summary;
};

export const diffJson = (
  left: JsonValue,
  right: JsonValue,
  options: DiffOptions = {},
): { root: DiffNode; summary: DiffSummary } => {
  const root = build(null, [], left, right, options);
  return { root, summary: summarize(root) };
};
