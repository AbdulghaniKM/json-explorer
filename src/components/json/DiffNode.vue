<template>
  <div v-if="visible">
    <div
      class="group flex items-start gap-1.5 rounded-md py-[3px] pe-2 font-mono text-[13px] leading-6"
      :class="rowClass"
      :style="{ paddingInlineStart: padStart }"
      @click="toggle"
    >
      <span v-if="guides" class="my-[-0.1875rem] flex self-stretch">
        <span
          v-for="level in guides"
          :key="level"
          class="indent-guide"
          :class="`depth-${(level - 1) % 6}`"
        />
      </span>

      <button
        v-if="hasChildren"
        type="button"
        class="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded text-text-muted hover:bg-border hover:text-text"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        @click.stop="toggle"
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

      <span class="w-4 shrink-0 text-center font-semibold" :class="markerClass">{{ marker }}</span>

      <span v-if="node.key !== null" class="shrink-0">
        <span :class="typeof node.key === 'number' ? 'text-text-muted' : 'tok-key'">
          {{ typeof node.key === 'number' ? node.key : `"${node.key}"` }}
        </span>
        <span class="tok-punct">:</span>
      </span>

      <template v-if="isContainer">
        <span class="text-text-muted">
          {{ node.leftType === 'array' ? '[…]' : '{…}' }}
          <span v-if="summaryLabel" class="text-[11px]">{{ summaryLabel }}</span>
        </span>
      </template>

      <template v-else>
        <span
          v-if="node.kind !== 'added'"
          class="min-w-0 truncate"
          :class="
            node.kind === 'changed' ? 'text-error line-through decoration-error/40' : leftClass
          "
        >
          {{ leftDisplay }}
        </span>
        <UiAppIcon
          v-if="node.kind === 'changed'"
          name="icon-[solar--arrow-right-linear]"
          :size="0.75"
          class="mt-[6px] shrink-0 text-text-muted"
        />
        <span v-if="node.kind !== 'removed'" class="min-w-0 truncate" :class="rightClass">
          {{ rightDisplay }}
        </span>
      </template>

      <button
        type="button"
        class="ms-auto shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
        title="Copy path"
        @click.stop="copyPath"
      >
        <UiAppIcon name="icon-[solar--link-minimalistic-2-linear]" :size="0.75" />
      </button>
    </div>

    <div v-if="hasChildren && expanded">
      <DiffNode
        v-for="child in visibleChildren"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :only-changes="onlyChanges"
      />
      <button
        v-if="hiddenChildren > 0"
        type="button"
        class="rounded-md py-[3px] pe-2 text-start font-mono text-[13px] leading-6 text-text-muted underline-offset-2 hover:text-text hover:underline"
        :style="{ paddingInlineStart: childPadStart }"
        @click.stop="showMore"
      >
        Show {{ Math.min(hiddenChildren, CHILD_PAGE).toLocaleString('en-US') }} more of
        {{ hiddenChildren.toLocaleString('en-US') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { pathToString } from '@/lib/json';
  import type { DiffNode as DiffNodeType } from '@/lib/json';
  import { useClipboard } from '@/composables/useClipboard';

  const props = withDefaults(
    defineProps<{ node: DiffNodeType; depth?: number; onlyChanges?: boolean }>(),
    { depth: 0, onlyChanges: false },
  );

  const { copy } = useClipboard();

  const MAX_GUIDES = 40;

  const guides = computed(() => Math.min(props.depth, MAX_GUIDES));
  const padStart = computed(
    () => `calc(${props.depth - guides.value} * var(--indent-width) + 0.25rem)`,
  );

  // The diff tree is not virtualized: every rendered node is a real component instance.
  // A diff with tens of thousands of changed siblings would mount them all at once and
  // freeze the tab, so reveal them in pages instead.
  const CHILD_PAGE = 200;
  const shownChildren = ref(CHILD_PAGE);

  const visibleChildren = computed(() => props.node.children?.slice(0, shownChildren.value) ?? []);
  const hiddenChildren = computed(() =>
    Math.max(0, (props.node.children?.length ?? 0) - shownChildren.value),
  );
  const childPadStart = computed(() => `calc(${props.depth + 1} * var(--indent-width) + 1.75rem)`);

  const showMore = () => {
    shownChildren.value += CHILD_PAGE;
  };

  // Collapsing and re-expanding a huge node should not leave every page mounted.
  watch(
    () => props.node,
    () => {
      shownChildren.value = CHILD_PAGE;
    },
  );

  const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0);
  const isContainer = computed(() => hasChildren.value || props.node.unchangedLeaves !== undefined);
  const expanded = ref(props.node.kind !== 'unchanged' && props.depth < 6);

  const toggle = () => {
    if (hasChildren.value) expanded.value = !expanded.value;
  };

  const visible = computed(() => !props.onlyChanges || props.node.kind !== 'unchanged');

  const marker = computed(
    () => ({ added: '+', removed: '−', changed: '~', unchanged: '' })[props.node.kind],
  );

  const markerClass = computed(
    () =>
      ({
        added: 'text-success',
        removed: 'text-error',
        changed: 'text-warning',
        unchanged: 'text-transparent',
      })[props.node.kind],
  );

  const rowClass = computed(
    () =>
      ({
        added: 'diff-added',
        removed: 'diff-removed',
        changed: 'diff-changed',
        unchanged: 'hover:bg-muted/60',
      })[props.node.kind],
  );

  const count = (value: number) => value.toLocaleString('en-US');

  const summaryLabel = computed(() => {
    const node = props.node;
    if (node.kind === 'unchanged') return `${count(node.unchangedLeaves ?? 0)} unchanged`;

    const changes = node.children?.length ?? 0;
    const hidden = node.unchangedLeaves ?? 0;
    if (expanded.value) return hidden ? `${count(hidden)} unchanged hidden` : '';
    return changes ? `${count(changes)} changed` : '';
  });

  const display = (text: string | undefined, type?: string) => {
    if (text === undefined) return '';
    return type === 'string' ? `"${text}"` : text;
  };

  const leftDisplay = computed(() => display(props.node.leftText, props.node.leftType));
  const rightDisplay = computed(() => display(props.node.rightText, props.node.rightType));

  const typeClass = (type?: string) =>
    ({
      string: 'tok-str',
      number: 'tok-num',
      boolean: 'tok-bool',
      null: 'tok-null',
    })[type ?? ''] ?? 'text-text';

  const leftClass = computed(() => typeClass(props.node.leftType));
  const rightClass = computed(() =>
    props.node.kind === 'added' || props.node.kind === 'changed'
      ? 'text-success'
      : typeClass(props.node.rightType),
  );

  const copyPath = () => copy(pathToString(props.node.path), true);

  watch(
    () => props.node,
    (node) => {
      expanded.value = node.kind !== 'unchanged' && props.depth < 6;
    },
  );
</script>
