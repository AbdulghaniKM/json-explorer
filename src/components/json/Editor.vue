<template>
  <div
    class="flex min-h-0 flex-col overflow-hidden border border-border bg-card"
    :class="dragging ? 'border-primary' : ''"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <header class="flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
      <span
        class="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
      >
        {{ label }}
      </span>
      <span class="border border-border px-1.5 font-mono text-[11px] text-muted-foreground">
        {{ lineLabel }} · {{ charLabel }}
      </span>
      <span
        v-if="!editable"
        class="border border-warning/50 px-1.5 font-mono text-[11px] tracking-[0.06em] text-warning uppercase"
      >
        read-only
      </span>
      <div class="ms-auto flex items-center gap-1">
        <slot name="actions" />
      </div>
    </header>

    <JsonLineViewer
      v-if="!editable"
      ref="viewerRef"
      :text="modelValue"
      :error-line="error?.line ?? 0"
    />

    <!--
      The scroll lives here, on the wrapper, and the textarea is laid out at its full wrapped
      height inside it. That is what keeps the highlight registered with the text: when the
      textarea scrolls itself it grows a scrollbar, its content box narrows by that scrollbar,
      and it then wraps at a different column than the overlay behind it — which has no
      scrollbar and never narrowed. One scroll container means one width for both, and the
      gutter travels with them instead of being synced to them.
    -->
    <div
      v-else
      ref="scrollRef"
      class="relative min-h-0 flex-1 overflow-y-auto"
      @scroll.passive="onScroll"
    >
      <div class="flex min-h-full">
        <!-- Each cell is as tall as the rows its line wraps onto, so the numbers stay level
             with the code instead of drifting one row further off with every wrapped line.
             Only the cells in view are rendered — a three-megabyte document runs to six figures
             of lines, and a div for each is far more than the numbers are worth. -->
        <div
          class="hidden shrink-0 border-e border-border bg-muted/30 py-3 text-end font-mono text-(length:--code-size) leading-(--code-line) text-muted-foreground/60 select-none sm:block"
          :style="{ width: gutterWidth }"
        >
          <div class="relative" :style="{ height: `${wrapped.total * codeLine}px` }">
            <div
              v-for="line in gutterLines"
              :key="line.number"
              class="absolute inset-x-0 px-2"
              :class="line.number === error?.line ? 'bg-error/15 font-semibold text-error' : ''"
              :style="{ top: `${line.top}px`, height: `${line.rows * codeLine}px` }"
            >
              {{ line.number }}
            </div>
          </div>
        </div>

        <div
          ref="contentRef"
          class="relative min-w-0 flex-1"
          :style="{ height: `${columnHeight}px` }"
        >
          <pre
            v-if="useHighlight"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 p-3 font-mono text-(length:--code-size) leading-(--code-line) break-all whitespace-pre-wrap"
          ><code v-html="highlighted"></code></pre>

          <!-- `break-all` on both layers, not just `pre-wrap`: breaking only at spaces would
               put the overlay and the textarea on different rows for the same line, and the
               gutter maths below assumes a break at the column edge. -->
          <textarea
            ref="textareaRef"
            :value="modelValue"
            :placeholder="placeholderText"
            :readonly="readonly"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            wrap="soft"
            class="absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent p-3 font-mono text-(length:--code-size) leading-(--code-line) break-all whitespace-pre-wrap caret-primary outline-none"
            :class="useHighlight ? 'text-transparent' : 'text-foreground'"
            @input="onInput"
            @keydown.tab="onTab"
          />
        </div>
      </div>
    </div>

    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80"
    >
      <div
        class="flex items-center gap-2 border border-dashed border-primary bg-card px-4 py-3 font-mono text-sm text-primary"
      >
        <UiAppIcon name="icon-[solar--upload-minimalistic-linear]" />
        Drop a JSON file to load it
      </div>
    </div>

    <footer
      v-if="!editable"
      class="flex items-center gap-2 border-t border-border bg-card px-2.5 py-1 font-mono text-[11px] text-warning"
    >
      <span aria-hidden="true">▲</span>
      <span class="truncate">virtual viewer — editing off, every tool still works</span>
    </footer>

    <footer
      v-else-if="error && modelValue.trim()"
      class="flex items-center gap-2 border-t border-border bg-card px-2.5 py-1 font-mono text-[11px] text-error"
    >
      <span aria-hidden="true">✕</span>
      <button
        type="button"
        class="shrink-0 underline-offset-2 hover:underline"
        @click="jumpToError"
      >
        {{ error.line }}:{{ error.column }}
      </button>
      <span class="truncate text-muted-foreground">{{ error.message }}</span>
      <slot name="error-action" />
    </footer>

    <footer
      v-else-if="valid && modelValue.trim()"
      class="flex items-center gap-2 border-t border-border bg-card px-2.5 py-1 font-mono text-[11px] text-success"
    >
      <span aria-hidden="true">●</span>
      <span>valid</span>
      <slot name="valid-action" />
    </footer>
  </div>
</template>

<script setup lang="ts">
  import { HIGHLIGHT_LIMIT, countLines, highlightJson, type JsonParseError } from '@/lib/json';
  import { EDIT_LIMIT } from '@/stores/json.store';
  import { useJsonFile } from '@/composables/useJsonFile';
  import JsonLineViewer from './LineViewer.vue';
  import { showSampleData } from '@/composables/usePreferences';
  import { useCharWidth } from '@/composables/useCharWidth';
  import { DENSITY } from '@/config/density';

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      label?: string;
      placeholder?: string;
      error?: JsonParseError | null;
      valid?: boolean;
      readonly?: boolean;
      lines?: number | null;
    }>(),
    {
      label: 'JSON',
      placeholder: '',
      error: null,
      valid: false,
      readonly: false,
      lines: null,
    },
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string];
    file: [name: string];
  }>();

  const placeholderText = computed(() => {
    if (props.placeholder) return props.placeholder;
    return showSampleData.value
      ? 'Paste JSON here, drop a file, or load the sample…'
      : 'Paste JSON here, or drop a file…';
  });

  const { fromDrop } = useJsonFile();

  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const scrollRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);
  const viewerRef = ref<InstanceType<typeof JsonLineViewer> | null>(null);
  const dragging = ref(false);

  /** Matches the `p-3` on the textarea and its overlay. */
  const TEXT_PADDING = 12;
  const MIN_WRAP_CHARS = 20;
  /** Rows kept above and below the viewport, so a fast scroll never shows a bare column. */
  const GUTTER_OVERSCAN = 20;

  const codeLine = DENSITY.codeLineHeight;
  const { charWidth } = useCharWidth();
  const contentWidth = ref(600);
  const viewportHeight = ref(400);
  const scrollTop = ref(0);

  let frame = 0;

  // Coalesced to a frame: the gutter window is recomputed from this, and a scroll event per
  // wheel notch would rebuild it several times before the browser paints once.
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      scrollTop.value = scrollRef.value?.scrollTop ?? 0;
    });
  };

  onUnmounted(() => {
    if (frame) cancelAnimationFrame(frame);
  });

  useResizeObserver(contentRef, ([entry]) => {
    contentWidth.value = entry.contentRect.width;
  });

  useResizeObserver(scrollRef, ([entry]) => {
    viewportHeight.value = entry.contentRect.height;
  });

  const editable = computed(() => props.modelValue.length <= EDIT_LIMIT);

  const lineCount = computed(() => {
    if (props.lines !== null) return props.lines;
    if (!editable.value) return 0;
    return countLines(props.modelValue);
  });

  const gutterChars = computed(() => Math.max(3, String(lineCount.value).length + 1.5));
  const gutterWidth = computed(() => `${gutterChars.value}ch`);

  /** Characters that fit one row of the text column, which is where a soft wrap lands. */
  const wrapChars = computed(() => {
    const usable = contentWidth.value - TEXT_PADDING * 2;
    return Math.max(MIN_WRAP_CHARS, Math.floor(usable / charWidth.value));
  });

  /**
   * Rows each source line wraps onto, plus the row each line starts at.
   *
   * One pass over the text, and no cap: the gutter is windowed to the viewport instead, so a
   * document of any length costs the same number of DOM nodes. `starts` is what turns a scroll
   * offset back into a line number without walking from the top every frame.
   */
  const wrapped = computed(() => {
    const text = props.modelValue;
    const cols = wrapChars.value;
    const rows: number[] = [];
    const starts: number[] = [];
    let total = 0;
    let lineLength = 0;

    const push = () => {
      starts.push(total);
      const count = Math.max(1, Math.ceil(lineLength / cols));
      rows.push(count);
      total += count;
      lineLength = 0;
    };

    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) push();
      else lineLength++;
    }
    push();

    return { rows, starts, total };
  });

  /** The line owning a display row, by binary search over the row each line starts at. */
  const lineAtRow = (starts: number[], row: number): number => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= row) low = middle;
      else high = middle - 1;
    }
    return low;
  };

  const gutterLines = computed(() => {
    const { rows, starts } = wrapped.value;
    const firstRow = Math.max(0, Math.floor(scrollTop.value / codeLine) - GUTTER_OVERSCAN);
    const lastRow =
      Math.ceil((scrollTop.value + viewportHeight.value) / codeLine) + GUTTER_OVERSCAN;

    const first = lineAtRow(starts, firstRow);
    const last = lineAtRow(starts, lastRow);

    const visible: Array<{ number: number; rows: number; top: number }> = [];
    for (let line = first; line <= last && line < rows.length; line++) {
      visible.push({ number: line + 1, rows: rows[line], top: starts[line] * codeLine });
    }
    return visible;
  });

  /** Tall enough for every wrapped row, and never shorter than the box it scrolls inside. */
  const columnHeight = computed(() =>
    Math.max(wrapped.value.total * codeLine + TEXT_PADDING * 2, viewportHeight.value),
  );

  const useHighlight = computed(() => editable.value && props.modelValue.length <= HIGHLIGHT_LIMIT);
  const highlighted = computed(() =>
    useHighlight.value ? `${highlightJson(props.modelValue)}\n` : '',
  );

  const compact = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 10_000) return `${Math.round(value / 1000)}k`;
    return value.toLocaleString('en-US');
  };

  const lineLabel = computed(() => `${compact(lineCount.value)} L`);
  const charLabel = computed(() => `${compact(props.modelValue.length)} ch`);

  const onInput = (event: Event) => {
    emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
  };

  const onTab = (event: KeyboardEvent) => {
    if (props.readonly) return;
    event.preventDefault();
    const target = event.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = target;
    emit('update:modelValue', `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`);
    nextTick(() => {
      target.selectionStart = selectionStart + 2;
      target.selectionEnd = selectionStart + 2;
    });
  };

  const onDragLeave = (event: DragEvent) => {
    if (event.currentTarget === event.target) dragging.value = false;
  };

  const onDrop = async (event: DragEvent) => {
    dragging.value = false;
    const loaded = await fromDrop(event);
    if (!loaded) return;
    emit('update:modelValue', loaded.text);
    emit('file', loaded.name);
  };

  const jumpToError = () => {
    const target = textareaRef.value;
    const position = props.error;
    if (!position) return;

    if (!editable.value) {
      viewerRef.value?.scrollToLine(position.line);
      return;
    }
    if (!target) return;

    const lines = props.modelValue.split('\n', position.line);
    let offset = 0;
    for (let i = 0; i < position.line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
    offset += Math.max(0, position.column - 1);

    target.focus();
    target.setSelectionRange(offset, offset);

    // The row the line starts at, not the line number: a wrapped line occupies several rows.
    const rowsAbove = wrapped.value.starts[position.line - 1] ?? 0;
    if (scrollRef.value) {
      scrollRef.value.scrollTop = Math.max(0, (rowsAbove - 4) * codeLine);
      scrollTop.value = scrollRef.value.scrollTop;
    }
  };

  const focus = () => textareaRef.value?.focus();

  defineExpose({ focus });
</script>
