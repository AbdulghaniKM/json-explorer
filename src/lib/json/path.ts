import type { JsonPathSegment, JsonValue, JsonValueType } from './types';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const valueType = (value: JsonValue): JsonValueType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
};

export const pathToString = (segments: JsonPathSegment[]): string => {
  let out = '$';
  for (const segment of segments) {
    if (typeof segment === 'number') out += `[${segment}]`;
    else if (IDENTIFIER.test(segment)) out += `.${segment}`;
    else out += `[${JSON.stringify(segment)}]`;
  }
  return out;
};
