<template>
  <div
    ref="viewportRef"
    class="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
    @scroll.passive="onScroll"
  >
    <div :style="{ height: `${totalHeight}px` }" class="relative min-w-full">
      <div class="absolute inset-x-0 top-0" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="line in visibleLines"
          :key="line.key"
          class="flex items-start"
          :style="{ height: `${ROW_HEIGHT}px` }"
        >
          <span
            class="sticky start-0 shrink-0 border-e border-border/60 bg-muted/40 px-2 text-end font-mono text-(length:--code-size) leading-(--code-line) text-muted-foreground select-none"
            :class="line.number === errorLine ? 'bg-error/15 font-semibold text-error' : ''"
            :style="{ width: gutterWidth }"
          >
            <span v-if="line.continued" :title="`Line ${line.number}, continued`">↳</span>
            <template v-else>{{ line.number }}</template>
          </span>
          <!-- The guides sit outside the <pre>, so this wrapper has to carry the same font and
               size or their `ch` measures a different character than the code does and every
               level drifts a little further right. -->
          <div class="relative min-w-0 flex-1 font-mono text-(length:--code-size)">
            <span
              v-for="level in line.guides"
              :key="level"
              class="line-guide"
              :class="`depth-${(level - 1) % 6}`"
              :style="{
                insetInlineStart: `calc(${(level - 1) * unit}ch + 0.75rem)`,
                width: `${unit}ch`,
              }"
            />
            <pre
              class="ps-3 font-mono text-(length:--code-size) leading-(--code-line) whitespace-pre"
              :style="
                line.indent ? { paddingInlineStart: `calc(0.75rem + ${line.indent}ch)` } : undefined
              "
            ><code v-html="line.html"></code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { highlightJson } from '@/lib/json';
  import {
    buildLineStarts,
    buildRowPrefix,
    lineOfRow,
    sliceForRow,
    type RowIndex,
  } from '@/lib/json/lines';
  import { useCharWidth } from '@/composables/useCharWidth';
  import { DENSITY } from '@/config/density';

  const props = withDefaults(defineProps<{ text: string; errorLine?: number }>(), { errorLine: 0 });

  /** The `ps-3` on each row, and room for the scrollbar so the last column never clips. */
  const TEXT_INSET = 12;
  const SCROLLBAR_ALLOWANCE = 14;

  const { charWidth } = useCharWidth();

  const ROW_HEIGHT = DENSITY.codeLineHeight;
  const OVERSCAN = 10;
  const MIN_LINE_CHARS = 24;
  /**
   * Width held back from every row so a wrapped one can be pushed in to its line's own
   * indentation. Without it a continuation starts at the left edge and reads as a new key at
   * the outermost level, which is the opposite of what the indentation is telling you.
   */
  const HANG_CHARS = 6;
  const MAX_GUIDES = 40;

  const viewportRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(600);
  const viewportWidth = ref(800);
  const offsets = shallowRef<Uint32Array<ArrayBufferLike>>(new Uint32Array(0));
  const lineCount = ref(0);
  const unit = ref(2);
  // Display rows, which differ from source lines once a long line is wrapped.
  const rowIndex = shallowRef<RowIndex | null>(null);
  const rowCount = ref(0);

  const detectIndentUnit = (text: string): number => {
    let from = text.indexOf('\n');
    let inspected = 0;
    while (from !== -1 && inspected < 200) {
      const next = text.indexOf('\n', from + 1);
      const end = next === -1 ? Math.min(text.length, from + 200) : next;
      let width = 0;
      for (let i = from + 1; i < end; i++) {
        const code = text.charCodeAt(i);
        if (code === 9) return 1;
        if (code !== 32) break;
        width++;
      }
      if (width > 0) return width;
      from = next;
      inspected++;
    }
    return 2;
  };

  const buildOffsets = (text: string) => {
    if (!text) {
      offsets.value = new Uint32Array(0);
      lineCount.value = 0;
      return;
    }

    unit.value = detectIndentUnit(text);

    const index = buildLineStarts(text);
    offsets.value = index.starts;
    lineCount.value = index.count;
  };

  const gutterChars = computed(() => Math.max(3.5, String(lineCount.value).length + 1.5));
  const gutterWidth = computed(() => `${gutterChars.value}ch`);

  /**
   * How many characters fit one row. Wrapping at the viewport edge is what keeps this viewer
   * free of horizontal scrolling: rows stay a fixed height, which the virtualizer depends on,
   * while a minified document still breaks across as many rows as it needs.
   */
  const wrapChars = computed(() => {
    const gutter = gutterChars.value * charWidth.value;
    const padding = TEXT_INSET + SCROLLBAR_ALLOWANCE + HANG_CHARS * charWidth.value;
    const usable = viewportWidth.value - gutter - padding;
    return Math.max(MIN_LINE_CHARS, Math.floor(usable / charWidth.value));
  });

  const buildRows = () => {
    if (!offsets.value.length) {
      rowIndex.value = null;
      rowCount.value = 0;
      return;
    }
    const index = { starts: offsets.value, count: lineCount.value };
    const rows = buildRowPrefix(props.text, index, props.text.length, wrapChars.value, HANG_CHARS);
    rowIndex.value = rows;
    rowCount.value = rows.rowCount;
  };

  const totalHeight = computed(() => rowCount.value * ROW_HEIGHT);

  const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN));
  const endRow = computed(() =>
    Math.min(
      rowCount.value,
      Math.ceil((scrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN,
    ),
  );
  const offsetY = computed(() => startRow.value * ROW_HEIGHT);

  const leadingWidth = (raw: string): number => {
    let width = 0;
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      if (code !== 32 && code !== 9) break;
      width++;
    }
    return width;
  };

  const leadingLevels = (width: number): number =>
    Math.min(Math.floor(width / unit.value), MAX_GUIDES);

  const visibleLines = computed(() => {
    const starts = offsets.value;
    const rows = rowIndex.value;
    const out: Array<{
      key: number;
      number: number;
      html: string;
      guides: number;
      indent: number;
      continued: boolean;
    }> = [];
    if (!starts.length || !rows) return out;

    const index = { starts, count: lineCount.value };
    const from = startRow.value;
    const to = endRow.value;
    let line = lineOfRow(rows, lineCount.value, from);

    for (let row = from; row < to; row++) {
      // Rows ascend, so walk forward rather than binary searching each one.
      while (line + 1 < lineCount.value && rows.prefix[line + 1] <= row) line++;

      const slice = sliceForRow(index, rows, props.text.length, row, line);
      const raw = props.text.slice(slice.start, slice.end);

      out.push({
        key: row,
        number: line + 1,
        html: highlightJson(raw) || '&nbsp;',
        guides: slice.segment === 0 ? leadingLevels(leadingWidth(raw)) : 0,
        indent: slice.indent,
        continued: slice.segment > 0,
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
    viewportWidth.value = element.clientWidth;
    scrollTop.value = element.scrollTop;
  };

  const scrollToLine = (line: number) => {
    const element = viewportRef.value;
    if (!element) return;
    // Source lines and display rows diverge once a long line wraps, so jump to the row
    // where the line actually starts.
    const prefix = rowIndex.value?.prefix;
    const index = Math.min(Math.max(0, line - 1), Math.max(0, lineCount.value - 1));
    const row = prefix && prefix.length > index ? prefix[index] : index;
    element.scrollTop = Math.max(0, (row - 4) * ROW_HEIGHT);
    scrollTop.value = element.scrollTop;
  };

  watch(() => props.text, buildOffsets, { immediate: true });

  // Rows depend on both the document and how wide a row may be, so a resize re-wraps rather
  // than leaving the reader with rows cut to the old width.
  watch([offsets, wrapChars], buildRows, { immediate: true });

  useResizeObserver(viewportRef, measure);

  onMounted(measure);

  onUnmounted(() => {
    if (frame) cancelAnimationFrame(frame);
  });

  defineExpose({ scrollToLine });
</script>
