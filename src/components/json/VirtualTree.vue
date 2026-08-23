<template>
  <div
    ref="viewportRef"
    class="relative min-h-0 flex-1 overflow-auto"
    tabindex="0"
    @scroll.passive="onScroll"
  >
    <div :style="{ height: `${totalHeight}px` }" class="relative w-full">
      <div class="absolute inset-x-0 top-0" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="row in visibleRows"
          :key="row.id"
          class="group flex items-center gap-1.5 whitespace-nowrap"
          :class="[
            row.active
              ? 'bg-primary/20 outline-2 -outline-offset-2 outline-primary'
              : row.match
                ? 'bg-warning/8 outline-1 -outline-offset-1 outline-warning/70 outline-dashed'
                : row.selected
                  ? 'bg-muted'
                  : 'hover:bg-muted/60',
          ]"
          :style="{ height: `${ROW_HEIGHT}px`, paddingInlineStart: row.padStart }"
          @click="onRowClick(row, $event)"
        >
          <span v-if="row.guides" class="flex self-stretch">
            <span
              v-for="level in row.guides"
              :key="level"
              class="indent-guide"
              :class="`depth-${(level - 1) % 6}`"
            />
          </span>

          <button
            v-if="row.container && row.childCount > 0"
            type="button"
            class="flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:bg-border hover:text-foreground"
            :aria-label="row.expanded ? 'Collapse' : 'Expand'"
            @click.stop="onToggle(row, $event)"
          >
            <UiAppIcon
              :name="
                row.expanded
                  ? 'icon-[solar--alt-arrow-down-linear]'
                  : 'icon-[solar--alt-arrow-right-linear]'
              "
              :size="0.75"
            />
          </button>
          <span v-else class="size-4 shrink-0" />

          <span v-if="row.key !== null" class="shrink-0 font-mono text-(length:--code-size)">
            <span :class="row.arrayItem ? 'text-muted-foreground' : 'tok-key'">{{ row.key }}</span>
            <span class="tok-punct">:</span>
          </span>

          <span
            v-if="row.container"
            class="shrink-0 font-mono text-(length:--code-size)"
            :class="row.depthClass"
          >
            <span>{{ row.open }}</span>
            <span v-if="!row.expanded" class="text-muted-foreground">{{ row.summary }}</span>
            <span v-if="!row.expanded">{{ row.close }}</span>
          </span>

          <span v-else class="truncate font-mono text-(length:--code-size)" :class="row.tokenClass">
            {{ row.value }}
          </span>

          <span
            v-if="row.container && row.expanded"
            class="shrink-0 bg-muted px-1.5 font-mono text-[11px] text-muted-foreground"
          >
            {{ row.childCount }}
          </span>

          <span class="ms-auto hidden shrink-0 items-center gap-0.5 pe-2 group-hover:flex">
            <button
              type="button"
              class="p-1 text-muted-foreground hover:bg-border hover:text-foreground"
              title="Copy path"
              @click.stop="copyPath(row.id)"
            >
              <UiAppIcon name="icon-[solar--link-minimalistic-2-linear]" :size="0.75" />
            </button>
            <button
              type="button"
              class="p-1 text-muted-foreground hover:bg-border hover:text-foreground"
              title="Copy value"
              @click.stop="copyValue(row.id)"
            >
              <UiAppIcon name="icon-[solar--copy-linear]" :size="0.75" />
            </button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    NODE_ARRAY,
    NODE_BOOLEAN,
    NODE_NULL,
    NODE_NUMBER,
    NODE_OBJECT,
    NODE_STRING,
    hasKey,
    pathOf,
    rawTextOf,
    subtreeTextOf,
    type JsonIndex,
  } from '@/lib/json';
  import { JSON_TREE_KEY, type JsonTreeApi } from '@/composables/useJsonTree';
  import { useClipboard } from '@/composables/useClipboard';
  import { useToast } from '@/composables/useToast';
  import { DENSITY } from '@/config/density';

  const props = defineProps<{ text: string; index: JsonIndex; api: JsonTreeApi }>();

  provide(JSON_TREE_KEY, props.api);

  const ROW_HEIGHT = DENSITY.treeRowHeight;
  const OVERSCAN = 12;
  const VALUE_CHARS = 220;
  const COPY_LIMIT = 4 * 1024 * 1024;

  const { copy } = useClipboard();
  const { error: toastError } = useToast();

  const viewportRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(600);

  const totalHeight = computed(() => props.api.rowCount.value * ROW_HEIGHT);

  const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN));

  const endRow = computed(() =>
    Math.min(
      props.api.rowCount.value,
      Math.ceil((scrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN,
    ),
  );

  const offsetY = computed(() => startRow.value * ROW_HEIGHT);

  const tokenClasses: Record<number, string> = {
    [NODE_STRING]: 'tok-str',
    [NODE_NUMBER]: 'tok-num',
    [NODE_BOOLEAN]: 'tok-bool',
    [NODE_NULL]: 'tok-null',
  };

  const MAX_GUIDES = 40;

  interface TreeRow {
    id: number;
    depth: number;
    guides: number;
    padStart: string;
    depthClass: string;
    container: boolean;
    arrayItem: boolean;
    childCount: number;
    expanded: boolean;
    key: string | null;
    open: string;
    close: string;
    summary: string;
    value: string;
    tokenClass: string;
    match: boolean;
    active: boolean;
    selected: boolean;
  }

  const visibleRows = computed<TreeRow[]>(() => {
    const index = props.index;
    const api = props.api;
    const list = api.rows.value;
    const matches = api.matchSet.value;
    const active = api.activeNode.value;
    const selected = api.selectedId.value;
    const out: TreeRow[] = [];

    for (let position = startRow.value; position < endRow.value; position++) {
      const id = list[position];
      if (id === undefined) break;

      const type = index.type[id];
      const container = type === NODE_OBJECT || type === NODE_ARRAY;
      const parent = index.parent[id];
      const arrayItem = parent >= 0 && index.type[parent] === NODE_ARRAY;
      const childCount = index.childCount[id];
      const expanded = container && api.isExpanded(id);

      const depth = index.depth[id];
      const guides = Math.min(depth, MAX_GUIDES);

      out.push({
        id,
        depth,
        guides,
        padStart: `calc(${depth - guides} * var(--indent-width) + 0.375rem)`,
        depthClass: `depth-${depth % 6}`,
        container,
        arrayItem,
        childCount,
        expanded,
        key: arrayItem
          ? String(index.childIndex[id])
          : hasKey(index, id)
            ? `"${props.text.slice(index.keyStart[id], index.keyEnd[id])}"`
            : null,
        open: type === NODE_ARRAY ? '[' : '{',
        close: type === NODE_ARRAY ? ']' : '}',
        summary: childCount
          ? type === NODE_ARRAY
            ? ` ${childCount.toLocaleString('en-US')} items `
            : ` ${childCount.toLocaleString('en-US')} keys `
          : '',
        value: container ? '' : rawTextOf(props.text, index, id, VALUE_CHARS),
        tokenClass: tokenClasses[type] ?? 'text-foreground',
        match: matches.has(id),
        active: id === active,
        selected: id === selected,
      });
    }

    return out;
  });

  let frame = 0;

  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const element = viewportRef.value;
      if (!element) return;
      scrollTop.value = element.scrollTop;
      viewportHeight.value = element.clientHeight;
    });
  };

  const measure = () => {
    const element = viewportRef.value;
    if (!element) return;
    viewportHeight.value = element.clientHeight;
    scrollTop.value = element.scrollTop;
  };

  const onToggle = (row: TreeRow, event: MouseEvent) => {
    if (event.altKey) {
      if (row.expanded) props.api.collapseSubtree(row.id);
      else props.api.expandSubtree(row.id);
      return;
    }
    props.api.toggle(row.id);
  };

  const onRowClick = (row: TreeRow, event: MouseEvent) => {
    props.api.select(row.id);
    if (row.container && row.childCount > 0) onToggle(row, event);
  };

  const copyPath = (id: number) => copy(pathOf(props.text, props.index, id), true);

  const copyValue = (id: number) => {
    const size = props.index.valueEnd[id] - props.index.valueStart[id];
    if (size > COPY_LIMIT) {
      toastError('This value is too large for the clipboard', { title: 'Not copied' });
      return;
    }
    copy(subtreeTextOf(props.text, props.index, id), true);
  };

  watch(
    () => props.api.scrollTarget.value,
    (position) => {
      if (position < 0) return;
      const element = viewportRef.value;
      if (!element) return;
      const target = position * ROW_HEIGHT - element.clientHeight / 2;
      element.scrollTop = Math.max(0, target);
      scrollTop.value = element.scrollTop;
      props.api.scrollTarget.value = -1;
    },
  );

  watch(
    () => props.api.rowCount.value,
    () => nextTick(measure),
  );

  onMounted(() => {
    measure();
    window.addEventListener('resize', measure);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', measure);
    if (frame) cancelAnimationFrame(frame);
  });
</script>
