import type { JsonPathSegment, JsonValue } from './types';
import { pathToId, valueType } from './path';

export interface SearchResult {
  matches: string[];
  matchSet: Set<string>;
  expand: Set<string>;
}

export const emptySearch = (): SearchResult => ({
  matches: [],
  matchSet: new Set(),
  expand: new Set(),
});

const matchesText = (haystack: string, needle: string, caseSensitive: boolean): boolean =>
  caseSensitive ? haystack.includes(needle) : haystack.toLowerCase().includes(needle);

export const searchJson = (root: JsonValue, query: string, caseSensitive = false): SearchResult => {
  const trimmed = query.trim();
  if (!trimmed) return emptySearch();

  const needle = caseSensitive ? trimmed : trimmed.toLowerCase();
  const matches: string[] = [];
  const matchSet = new Set<string>();
  const expand = new Set<string>();

  const walk = (value: JsonValue, path: JsonPathSegment[], keyLabel: string | null) => {
    const id = pathToId(path);
    const type = valueType(value);

    let hit = keyLabel !== null && matchesText(keyLabel, needle, caseSensitive);
    if (!hit && type !== 'object' && type !== 'array') {
      hit = matchesText(
        type === 'string' ? (value as string) : String(value),
        needle,
        caseSensitive,
      );
    }

    if (hit) {
      matches.push(id);
      matchSet.add(id);
      for (let i = 0; i < path.length; i++) expand.add(pathToId(path.slice(0, i)));
    }

    if (type === 'array') {
      (value as JsonValue[]).forEach((item, index) => walk(item, [...path, index], String(index)));
      return;
    }

    if (type === 'object') {
      for (const [key, item] of Object.entries(value as Record<string, JsonValue>)) {
        walk(item, [...path, key], key);
      }
    }
  };

  walk(root, [], null);

  return { matches, matchSet, expand };
};

export const collectExpandableIds = (root: JsonValue, maxDepth = Infinity): string[] => {
  const ids: string[] = [];

  const walk = (value: JsonValue, path: JsonPathSegment[], depth: number) => {
    const type = valueType(value);
    if (type !== 'object' && type !== 'array') return;
    if (depth > maxDepth) return;
    ids.push(pathToId(path));
    if (type === 'array') {
      (value as JsonValue[]).forEach((item, index) => walk(item, [...path, index], depth + 1));
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, JsonValue>)) {
      walk(item, [...path, key], depth + 1);
    }
  };

  walk(root, [], 1);
  return ids;
};
