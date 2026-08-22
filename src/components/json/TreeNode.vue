<template>
  <div v-if="visible">
    <div
      :id="`node${id}`"
      class="group flex items-start gap-1.5 rounded-md py-[3px] pe-1 font-mono text-[13px] leading-6"
      :class="[
        isActive ? 'bg-primary/15 ring-1 ring-primary/40' : isMatch ? 'bg-warning/15' : '',
        isSelected && !isActive ? 'bg-muted' : '',
        'hover:bg-muted/70',
      ]"
      :style="{ paddingInlineStart: `${depth * 14 + 4}px` }"
      @click="onRowClick"
    >
      <button
        v-if="container"
        type="button"
        class="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-border hover:text-text"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        @click.stop="onToggle"
      >
        <UiAppIcon
          :name="
            expanded
              ? 'icon-[solar--alt-arrow-down-linear]'
              : 'icon-[solar--alt-arrow-right-linear]'
          "
          :size="0.75"
        />
      </button>
      <span v-else class="mt-[3px] size-4 shrink-0" />

      <span v-if="keyLabel !== null" class="shrink-0">
        <span :class="typeof keyLabel === 'number' ? 'text-text-muted' : 'tok-key'">
          {{ typeof keyLabel === 'number' ? keyLabel : `"${keyLabel}"` }}
        </span>
        <span class="tok-punct">:</span>
      </span>

      <template v-if="container">
        <span class="tok-punct">{{ brackets[0] }}</span>
        <template v-if="!expanded">
          <span class="text-text-muted">{{ summary }}</span>
          <span class="tok-punct">{{ brackets[1] }}</span>
        </template>
      </template>

      <span v-else class="min-w-0 truncate" :class="valueClass" :title="rawValue">
        {{ displayValue }}
      </span>

      <span
        v-if="container && expanded"
        class="rounded-full bg-muted px-1.5 text-[11px] text-text-muted"
      >
        {{ count }}
      </span>

      <div
        class="ms-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      >
        <button
          type="button"
          class="rounded p-1 text-text-muted transition-colors hover:bg-border hover:text-text"
          title="Copy path"
          @click.stop="copyPath"
        >
          <UiAppIcon name="icon-[solar--link-minimalistic-2-linear]" :size="0.75" />
        </button>
        <button
          type="button"
          class="rounded p-1 text-text-muted transition-colors hover:bg-border hover:text-text"
          title="Copy value"
          @click.stop="copyValue"
        >
          <UiAppIcon name="icon-[solar--copy-linear]" :size="0.75" />
        </button>
      </div>
    </div>

    <div v-if="container && expanded">
      <TreeNode
        v-for="child in visibleChildren"
        :key="child.id"
        :value="child.value"
        :path="child.path"
        :key-label="child.key"
        :depth="depth + 1"
        :ancestor-matched="ancestorMatched || isMatch"
      />

      <button
        v-if="hiddenChildren > 0"
        type="button"
        class="ms-1 rounded-md px-2 py-1 font-mono text-[12px] text-primary hover:bg-muted"
        :style="{ marginInlineStart: `${(depth + 1) * 14 + 4}px` }"
        @click="limit += CHUNK"
      >
        Show {{ Math.min(hiddenChildren, CHUNK) }} more of {{ count }}
      </button>

      <div
        class="font-mono text-[13px] leading-6 text-text-muted"
        :style="{ paddingInlineStart: `${depth * 14 + 26}px` }"
      >
        <span class="tok-punct">{{ brackets[1] }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    childCount,
    isContainer,
    minifyJson,
    pathToId,
    pathToString,
    valueType,
    type JsonPathSegment,
    type JsonValue,
  } from '@/lib/json';
  import { useJsonTreeApi } from '@/composables/useJsonTree';
  import { useClipboard } from '@/composables/useClipboard';

  const props = withDefaults(
    defineProps<{
      value: JsonValue;
      path: JsonPathSegment[];
      keyLabel?: JsonPathSegment | null;
      depth?: number;
      ancestorMatched?: boolean;
    }>(),
    { keyLabel: null, depth: 0, ancestorMatched: false },
  );

  const CHUNK = 100;

  const tree = useJsonTreeApi();
  const { copy } = useClipboard();
  const limit = ref(CHUNK);

  const id = computed(() => pathToId(props.path));
  const type = computed(() => valueType(props.value));
  const container = computed(() => isContainer(props.value));
  const expanded = computed(() => tree.isExpanded(id.value));
  const count = computed(() => childCount(props.value));

  const isMatch = computed(() => tree.matchSet.value.has(id.value));
  const isActive = computed(() => tree.activeId.value === id.value);
  const isSelected = computed(() => tree.selectedId.value === id.value);

  const visible = computed(() => {
    if (!tree.onlyMatches.value || !tree.query.value.trim()) return true;
    return props.ancestorMatched || isMatch.value || tree.onPath.value.has(id.value);
  });

  const brackets = computed<[string, string]>(() =>
    type.value === 'array' ? ['[', ']'] : ['{', '}'],
  );

  const summary = computed(() => {
    if (count.value === 0) return '';
    return type.value === 'array'
      ? ` ${count.value} item${count.value === 1 ? '' : 's'} `
      : ` ${count.value} key${count.value === 1 ? '' : 's'} `;
  });

  const rawValue = computed(() =>
    type.value === 'string' ? (props.value as string) : String(props.value),
  );

  const displayValue = computed(() => {
    if (type.value === 'string') return `"${props.value as string}"`;
    if (type.value === 'null') return 'null';
    return String(props.value);
  });

  const valueClass = computed(
    () =>
      ({
        string: 'tok-str',
        number: 'tok-num',
        boolean: 'tok-bool',
        null: 'tok-null',
        object: 'tok-punct',
        array: 'tok-punct',
      })[type.value],
  );

  const children = computed(() => {
    if (type.value === 'array') {
      return (props.value as JsonValue[]).map((item, index) => ({
        id: `${id.value}#${index}`,
        key: index as JsonPathSegment,
        value: item,
        path: [...props.path, index],
      }));
    }
    if (type.value === 'object') {
      return Object.entries(props.value as Record<string, JsonValue>).map(([key, item]) => ({
        id: `${id.value}.${key}`,
        key: key as JsonPathSegment,
        value: item,
        path: [...props.path, key],
      }));
    }
    return [];
  });

  const visibleChildren = computed(() => children.value.slice(0, limit.value));
  const hiddenChildren = computed(() => Math.max(0, children.value.length - limit.value));

  const onToggle = (event: MouseEvent) => {
    if (event.altKey) {
      if (expanded.value) tree.collapseSubtree(id.value);
      else tree.expandSubtree(id.value, props.value);
      return;
    }
    tree.toggle(id.value);
  };

  const onRowClick = (event: MouseEvent) => {
    tree.select(id.value, props.path);
    if (container.value) onToggle(event);
  };

  const copyPath = () => copy(pathToString(props.path), true);
  const copyValue = () =>
    copy(type.value === 'string' ? (props.value as string) : minifyJson(props.value), true);

  watch(
    () => props.value,
    () => {
      limit.value = CHUNK;
    },
  );
</script>
