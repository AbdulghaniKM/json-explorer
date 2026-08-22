import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import { computed, inject, nextTick, ref, shallowRef, watch } from 'vue';
import {
  EMPTY_FIND,
  allContainers,
  buildRows,
  containersToDepth,
  findInIndex,
  isContainerNode,
  pathOf,
  rowsForFilter,
  type JsonIndex,
} from '@/lib/json';

export interface JsonTreeApi {
  rows: ShallowRef<Int32Array>;
  rowCount: Ref<number>;
  query: Ref<string>;
  caseSensitive: Ref<boolean>;
  onlyMatches: Ref<boolean>;
  matches: ShallowRef<Int32Array>;
  matchCount: Ref<number>;
  matchSet: ShallowRef<Set<number>>;
  matchesTruncated: Ref<boolean>;
  activeIndex: Ref<number>;
  activeNode: ComputedRef<number>;
  selectedId: Ref<number>;
  selectedPath: ComputedRef<string>;
  expandedCount: ComputedRef<number>;
  scrollTarget: Ref<number>;
  isExpanded: (id: number) => boolean;
  toggle: (id: number) => void;
  expandSubtree: (id: number) => void;
  collapseSubtree: (id: number) => void;
  expandToDepth: (depth: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
  select: (id: number) => void;
  nextMatch: () => void;
  previousMatch: () => void;
  rowOf: (id: number) => number;
}

export const JSON_TREE_KEY: InjectionKey<JsonTreeApi> = Symbol('json-tree');

export const EXPAND_ALL_LIMIT = 400_000;

export const useJsonTree = (
  text: Ref<string>,
  index: Ref<JsonIndex | null>,
  documentId: Ref<number>,
  defaultDepth = 2,
): JsonTreeApi => {
  const expanded = new Set<number>();
  const revision = ref(0);

  const rows = shallowRef(new Int32Array(0));
  const rowCount = ref(0);
  const buffer = shallowRef(new Int32Array(0));

  const query = ref('');
  const debouncedQuery = refDebounced(query, 180);
  const caseSensitive = ref(false);
  const onlyMatches = ref(false);

  const matches = shallowRef(EMPTY_FIND.matches);
  const matchCount = ref(0);
  const matchesTruncated = ref(false);
  const matchSet = shallowRef(new Set<number>());
  const activeIndex = ref(0);
  const selectedId = ref(-1);
  const scrollTarget = ref(-1);

  const touch = () => {
    revision.value++;
  };

  const activeNode = computed(() =>
    matchCount.value > 0 ? matches.value[Math.min(activeIndex.value, matchCount.value - 1)] : -1,
  );

  const selectedPath = computed(() => {
    const current = index.value;
    if (!current || selectedId.value < 0 || selectedId.value >= current.count) return '$';
    return pathOf(text.value, current, selectedId.value);
  });

  const expandedCount = computed(() => {
    void revision.value;
    return expanded.size;
  });

  const filterSet = computed(() => {
    const current = index.value;
    if (!current || !onlyMatches.value || !debouncedQuery.value.trim() || matchCount.value === 0) {
      return null;
    }
    return rowsForFilter(current, matches.value, matchCount.value);
  });

  const rebuild = () => {
    const current = index.value;
    if (!current) {
      rowCount.value = 0;
      rows.value = new Int32Array(0);
      return;
    }
    if (buffer.value.length < current.count) buffer.value = new Int32Array(current.count);
    rowCount.value = buildRows(current, expanded, buffer.value, filterSet.value);
    rows.value = buffer.value.subarray(0, rowCount.value);
  };

  const applyDefaults = () => {
    const current = index.value;
    expanded.clear();
    if (current) for (const id of containersToDepth(current, defaultDepth)) expanded.add(id);
    touch();
  };

  watch(documentId, () => {
    selectedId.value = -1;
    activeIndex.value = 0;
    applyDefaults();
  });

  watch(index, (current, previous) => {
    if (!current) {
      rebuild();
      return;
    }
    if (!previous || expanded.size === 0) {
      applyDefaults();
      return;
    }
    for (const id of expanded)
      if (id >= current.count || !isContainerNode(current, id)) expanded.delete(id);
    touch();
  });

  watch([debouncedQuery, caseSensitive, index], () => {
    const current = index.value;
    const needle = debouncedQuery.value.trim();
    if (!current || !needle) {
      matches.value = EMPTY_FIND.matches;
      matchCount.value = 0;
      matchesTruncated.value = false;
      matchSet.value = new Set();
      return;
    }

    const result = findInIndex(text.value, current, needle, { caseSensitive: caseSensitive.value });
    matches.value = result.matches;
    matchCount.value = result.count;
    matchesTruncated.value = result.truncated;
    matchSet.value = new Set(
      Array.from(result.matches.subarray(0, Math.min(result.count, 20_000))),
    );
    activeIndex.value = 0;
    if (result.count > 0) revealNode(result.matches[0]);
  });

  watch([revision, filterSet, index], rebuild, { immediate: true });

  const isExpanded = (id: number) => expanded.has(id);

  const toggle = (id: number) => {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    touch();
  };

  const expandSubtree = (id: number) => {
    const current = index.value;
    if (!current) return;
    const end = current.subtreeEnd[id];
    let added = 0;
    for (let node = id; node < end && added < EXPAND_ALL_LIMIT; node++) {
      if (isContainerNode(current, node) && current.childCount[node] > 0) {
        expanded.add(node);
        added++;
      }
    }
    touch();
  };

  const collapseSubtree = (id: number) => {
    const current = index.value;
    if (!current) return;
    const end = current.subtreeEnd[id];
    for (let node = id; node < end; node++) expanded.delete(node);
    touch();
  };

  const expandToDepth = (depth: number) => {
    const current = index.value;
    expanded.clear();
    if (current) for (const id of containersToDepth(current, depth)) expanded.add(id);
    touch();
  };

  const expandAll = () => {
    const current = index.value;
    expanded.clear();
    if (current) for (const id of allContainers(current, EXPAND_ALL_LIMIT)) expanded.add(id);
    touch();
  };

  const collapseAll = () => {
    expanded.clear();
    touch();
  };

  const select = (id: number) => {
    selectedId.value = id;
  };

  const rowOf = (id: number): number => {
    const list = rows.value;
    let low = 0;
    let high = rowCount.value - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (list[middle] === id) return middle;
      if (list[middle] < id) low = middle + 1;
      else high = middle - 1;
    }
    return -1;
  };

  function revealNode(id: number) {
    const current = index.value;
    if (!current) return;
    let parent = current.parent[id];
    while (parent >= 0) {
      expanded.add(parent);
      parent = current.parent[parent];
    }
    selectedId.value = id;
    touch();
    nextTick(() => {
      scrollTarget.value = rowOf(id);
    });
  }

  const nextMatch = () => {
    if (matchCount.value === 0) return;
    activeIndex.value = (activeIndex.value + 1) % matchCount.value;
    revealNode(matches.value[activeIndex.value]);
  };

  const previousMatch = () => {
    if (matchCount.value === 0) return;
    activeIndex.value = (activeIndex.value - 1 + matchCount.value) % matchCount.value;
    revealNode(matches.value[activeIndex.value]);
  };

  return {
    rows,
    rowCount,
    query,
    caseSensitive,
    onlyMatches,
    matches,
    matchCount,
    matchSet,
    matchesTruncated,
    activeIndex,
    activeNode,
    selectedId,
    selectedPath,
    expandedCount,
    scrollTarget,
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
    rowOf,
  };
};

export const useJsonTreeApi = (): JsonTreeApi => {
  const api = inject(JSON_TREE_KEY);
  if (!api) throw new Error('JsonTree context is missing');
  return api;
};
