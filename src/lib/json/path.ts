import type { JsonPathSegment, JsonValue, JsonValueType } from './types';

export const valueType = (value: JsonValue): JsonValueType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
};

export const isContainer = (value: JsonValue): boolean =>
  value !== null && typeof value === 'object';

export const childCount = (value: JsonValue): number => {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === 'object') return Object.keys(value).length;
  return 0;
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const pathToString = (segments: JsonPathSegment[]): string => {
  let out = '$';
  for (const segment of segments) {
    if (typeof segment === 'number') out += `[${segment}]`;
    else if (IDENTIFIER.test(segment)) out += `.${segment}`;
    else out += `[${JSON.stringify(segment)}]`;
  }
  return out;
};

export const pathToId = (segments: JsonPathSegment[]): string =>
  segments.map((s) => (typeof s === 'number' ? `#${s}` : `.${s}`)).join('');

export const ancestorIds = (segments: JsonPathSegment[]): string[] => {
  const ids: string[] = [];
  for (let i = 0; i < segments.length; i++) ids.push(pathToId(segments.slice(0, i)));
  return ids;
};

export const getAtPath = (root: JsonValue, segments: JsonPathSegment[]): JsonValue | undefined => {
  let current: JsonValue | undefined = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      if (typeof segment !== 'number') return undefined;
      current = current[segment];
    } else {
      current = (current as Record<string, JsonValue>)[String(segment)];
    }
    if (current === undefined) return undefined;
  }
  return current;
};

export const previewValue = (value: JsonValue, maxLength = 72): string => {
  const type = valueType(value);
  if (type === 'string') return `"${value as string}"`.slice(0, maxLength);
  if (type === 'object' || type === 'array') {
    const raw = JSON.stringify(value) ?? '';
    return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw;
  }
  return String(value);
};

export const formatNumber = (value: number): string => value.toLocaleString('en-US');
