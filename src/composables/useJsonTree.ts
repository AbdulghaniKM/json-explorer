import type { InjectionKey, Ref } from 'vue';
import { computed, inject, ref, watch } from 'vue';
import {
  collectExpandableIds,
  emptySearch,
  pathToId,
  pathToString,
  searchJson,
  type JsonPathSegment,
  type JsonValue,
} from '@/lib/json';

export interface JsonTreeApi {
  expanded: Ref<Set<string>>;
  query: Ref<string>;
  caseSensitive: Ref<boolean>;
  onlyMatches: Ref<boolean>;
  selectedId: Ref<string | null>;
  selectedPath: Ref<string>;
  matches: Ref<string[]>;
  matchSet: Ref<Set<string>>;
  onPath: Ref<Set<string>>;
  activeId: Ref<string | null>;
  activeIndex: Ref<number>;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  expandSubtree: (id: string, value: JsonValue) => void;
  collapseSubtree: (id: string) => void;
  expandToDepth: (depth: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
  select: (id: string, path: JsonPathSegment[]) => void;
  nextMatch: () => void;
  previousMatch: () => void;
}

export const JSON_TREE_KEY: InjectionKey<JsonTreeApi> = Symbol('json-tree');

export const useJsonTree = (source: Ref<JsonValue | null>, defaultDepth = 2): JsonTreeApi => {
  const expanded = ref(new Set<string>());
  const query = ref('');
  const caseSensitive = ref(false);
  const onlyMatches = ref(false);
  const selectedId = ref<string | null>(null);
  const selectedPath = ref('$');
  const activeIndex = ref(0);
  const initialized = ref(false);

  const search = computed(() =>
    source.value === null
      ? emptySearch()
      : searchJson(source.value, query.value, caseSensitive.value),
  );

  const matches = computed(() => search.value.matches);
  const matchSet = computed(() => search.value.matchSet);
  const onPath = computed(() => search.value.expand);
  const activeId = computed(() => matches.value[activeIndex.value] ?? null);

  const isExpanded = (id: string) => expanded.value.has(id);

  const toggle = (id: string) => {
    if (expanded.value.has(id)) expanded.value.delete(id);
    else expanded.value.add(id);
  };

  const expandSubtree = (id: string, value: JsonValue) => {
    for (const relative of collectExpandableIds(value)) expanded.value.add(`${id}${relative}`);
  };

  const collapseSubtree = (id: string) => {
    const doomed: string[] = [];
    for (const current of expanded.value) {
      if (current === id || current.startsWith(id)) doomed.push(current);
    }
    for (const current of doomed) expanded.value.delete(current);
  };

  const expandToDepth = (depth: number) => {
    initialized.value = true;
    expanded.value = new Set(
      source.value === null ? [] : collectExpandableIds(source.value, depth),
    );
  };

  const expandAll = () => expandToDepth(Infinity);

  const collapseAll = () => {
    initialized.value = true;
    expanded.value = new Set();
  };

  const select = (id: string, path: JsonPathSegment[]) => {
    selectedId.value = id;
    selectedPath.value = pathToString(path);
  };

  const nextMatch = () => {
    if (!matches.value.length) return;
    activeIndex.value = (activeIndex.value + 1) % matches.value.length;
  };

  const previousMatch = () => {
    if (!matches.value.length) return;
    activeIndex.value = (activeIndex.value - 1 + matches.value.length) % matches.value.length;
  };

  watch(
    source,
    (value) => {
      if (!value || initialized.value) return;
      expanded.value = new Set(collectExpandableIds(value, defaultDepth));
      initialized.value = true;
    },
    { immediate: true },
  );

  watch(matches, (list) => {
    activeIndex.value = 0;
    for (const id of onPath.value) expanded.value.add(id);
    if (list.length) {
      const first = list[0];
      for (let i = 1; i < first.length; i++) {
        if (first[i] === '.' || first[i] === '#') expanded.value.add(first.slice(0, i));
      }
    }
  });

  watch(activeId, (id) => {
    if (!id) return;
    for (let i = 1; i < id.length; i++) {
      if (id[i] === '.' || id[i] === '#') expanded.value.add(id.slice(0, i));
    }
    expanded.value.add('');
  });

  return {
    expanded,
    query,
    caseSensitive,
    onlyMatches,
    selectedId,
    selectedPath,
    matches,
    matchSet,
    onPath,
    activeId,
    activeIndex,
    isExpanded,
    toggle,
    expandSubtree,
    collapseSubtree,
    expandToDepth,
    expandAll,
    collapseAll,
    select,
    nextMatch,
    previousMatch,
  };
};

export const useJsonTreeApi = (): JsonTreeApi => {
  const api = inject(JSON_TREE_KEY);
  if (!api) throw new Error('JsonTree context is missing');
  return api;
};

export const nodeId = pathToId;
