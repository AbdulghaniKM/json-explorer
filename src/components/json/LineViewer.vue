<template>
  <div ref="viewportRef" class="relative min-h-0 flex-1 overflow-auto" @scroll.passive="onScroll">
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
          <div class="relative">
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
            ><code v-html="line.html"></code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { highlightJson } from '@/lib/json';
  import { buildLineStarts, buildRowPrefix, lineOfRow, sliceForRow } from '@/lib/json/lines';
  import { DENSITY } from '@/config/density';

  const props = withDefaults(defineProps<{ text: string; errorLine?: number }>(), { errorLine: 0 });

  const ROW_HEIGHT = DENSITY.codeLineHeight;
  const OVERSCAN = 10;
  const MAX_LINE_CHARS = 2000;
  const MAX_GUIDES = 40;

  const viewportRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(600);
  const offsets = shallowRef<Uint32Array<ArrayBufferLike>>(new Uint32Array(0));
  const lineCount = ref(0);
  const unit = ref(2);
  // Display rows, which differ from source lines once a long line is wrapped.
  const rowPrefix = shallowRef<Uint32Array<ArrayBufferLike>>(new Uint32Array(0));
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
      rowPrefix.value = new Uint32Array(0);
      rowCount.value = 0;
      return;
    }

    unit.value = detectIndentUnit(text);

    const index = buildLineStarts(text);
    offsets.value = index.starts;
    lineCount.value = index.count;

    // A minified document is a single enormous line. Rendering one row per source line
    // would show only its first MAX_LINE_CHARS characters with nothing to scroll, so wrap
    // long lines across as many display rows as they need.
    const rows = buildRowPrefix(index, text.length, MAX_LINE_CHARS);
    rowPrefix.value = rows.prefix;
    rowCount.value = rows.rowCount;
  };

  const totalHeight = computed(() => rowCount.value * ROW_HEIGHT);
  const gutterWidth = computed(() => `${Math.max(3.5, String(lineCount.value).length + 1.5)}ch`);

  const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN));
  const endRow = computed(() =>
    Math.min(
      rowCount.value,
      Math.ceil((scrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN,
    ),
  );
  const offsetY = computed(() => startRow.value * ROW_HEIGHT);

  const leadingLevels = (raw: string): number => {
    let width = 0;
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      if (code !== 32 && code !== 9) break;
      width++;
    }
    return Math.min(Math.floor(width / unit.value), MAX_GUIDES);
  };

  const visibleLines = computed(() => {
    const starts = offsets.value;
    const prefix = rowPrefix.value;
    const out: Array<{
      key: number;
      number: number;
      html: string;
      guides: number;
      continued: boolean;
    }> = [];
    if (!starts.length || !prefix.length) return out;

    const index = { starts, count: lineCount.value };
    const rows = { prefix, rowCount: rowCount.value };
    const from = startRow.value;
    const to = endRow.value;
    let line = lineOfRow(rows, lineCount.value, from);

    for (let row = from; row < to; row++) {
      // Rows ascend, so walk forward rather than binary searching each one.
      while (line + 1 < lineCount.value && prefix[line + 1] <= row) line++;

      const slice = sliceForRow(index, rows, props.text.length, MAX_LINE_CHARS, row, line);
      const raw = props.text.slice(slice.start, slice.end);

      out.push({
        key: row,
        number: line + 1,
        html: highlightJson(raw) || '&nbsp;',
        guides: slice.segment === 0 ? leadingLevels(raw) : 0,
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
    scrollTop.value = element.scrollTop;
  };

  const scrollToLine = (line: number) => {
    const element = viewportRef.value;
    if (!element) return;
    // Source lines and display rows diverge once a long line wraps, so jump to the row
    // where the line actually starts.
    const prefix = rowPrefix.value;
    const index = Math.min(Math.max(0, line - 1), Math.max(0, lineCount.value - 1));
    const row = prefix.length > index ? prefix[index] : index;
    element.scrollTop = Math.max(0, (row - 4) * ROW_HEIGHT);
    scrollTop.value = element.scrollTop;
  };

  watch(() => props.text, buildOffsets, { immediate: true });

  onMounted(() => {
    measure();
    window.addEventListener('resize', measure);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', measure);
    if (frame) cancelAnimationFrame(frame);
  });

  defineExpose({ scrollToLine });
</script>
