import type { JsonValue } from './types';

export const minifyJson = (value: JsonValue): string => JSON.stringify(value);

const isEmpty = (value: JsonValue): boolean => {
  if (value === null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

export const removeEmptyValues = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((item) => removeEmptyValues(item)).filter((item) => !isEmpty(item));
  }
  if (value === null || typeof value !== 'object') return value;

  const cleaned: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value as Record<string, JsonValue>)) {
    const next = removeEmptyValues(item);
    if (!isEmpty(next)) cleaned[key] = next;
  }
  return cleaned;
};

export const escapeToJsonString = (text: string): string => JSON.stringify(text);

export const unescapeJsonString = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'string') return parsed;
  }
  const parsed = JSON.parse(`"${trimmed.replace(/"/g, '\\"')}"`) as unknown;
  return typeof parsed === 'string' ? parsed : trimmed;
};

export const byteLength = (text: string): number => new TextEncoder().encode(text).length;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
