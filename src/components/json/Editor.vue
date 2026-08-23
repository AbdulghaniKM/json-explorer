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
        <UiAppButton
          v-if="editable"
          :icon="wrapLines ? 'icon-[solar--text-square-linear]' : 'icon-[solar--text-field-linear]'"
          icon-only
          size="xs"
          :tooltip="wrapLines ? 'Wrapping on — click for one line per line' : 'Wrapping off'"
          @click="wrapLines = !wrapLines"
        />
        <slot name="actions" />
      </div>
    </header>

    <JsonLineViewer
      v-if="!editable || reading"
      ref="viewerRef"
      :text="modelValue"
      :error-line="error?.line ?? 0"
    />

    <!--
      One grid row per source line: the line number in the first column, the line's text in the
      second. This is what makes wrapping work properly. A textarea is a single block, so its
      wrap points cannot be predicted (the browser also breaks after hyphens and slashes) and a
      per-line hanging indent is impossible inside one. Here the browser lays out each line as
      its own block and reports the height, so the number beside it is level by construction
      rather than by arithmetic, and each cell can hang its own indent. The textarea sits on top
      as the input surface only, sharing the column width so it wraps exactly the same way.
    -->
    <div
      v-else
      ref="scrollRef"
      class="relative min-h-0 flex-1"
      :class="wrapLines ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto'"
      @scroll.passive="onScroll"
    >
      <div
        class="code-lines min-h-full py-3"
        :class="wrapLines ? '' : 'w-max'"
        :style="{ '--gutter-w': gutterWidth }"
      >
        <div
          v-for="line in gridLines"
          :key="line.number"
          class="code-line font-mono text-(length:--code-size) leading-(--code-line)"
          :class="wrapLines ? 'break-words whitespace-pre-wrap' : 'whitespace-pre'"
          :data-error="line.number === error?.line ? '' : undefined"
          :style="line.style"
        >
          <span
            v-for="level in line.guides"
            :key="level"
            class="pointer-events-none absolute inset-y-0 w-px opacity-30"
            :class="`depth-${(level - 1) % 6}`"
            :style="{
              insetInlineStart: `calc(${gutterWidth} + 0.75rem + ${(level - 1) * indentUnit}ch)`,
              backgroundColor: 'currentColor',
            }"
            aria-hidden="true"
          />
          <span v-if="useHighlight" v-html="line.html" />
          <template v-else>{{ line.text }}</template>
        </div>
      </div>

      <!-- The gutter's own surface, behind the numbers the counter draws. -->
      <div
        class="pointer-events-none sticky start-0 top-0 z-0 hidden border-e border-border bg-muted/30 sm:block"
        :style="{ width: gutterWidth, height: '100%', marginBottom: '-100%' }"
        aria-hidden="true"
      />

      <!-- Transparent text, visible caret: the grid behind it is what the reader sees. Same
           width, font and wrapping rules, so the caret lands where the glyph is. -->
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :placeholder="placeholderText"
        :readonly="readonly"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        :wrap="wrapLines ? 'soft' : 'off'"
        class="absolute inset-y-0 end-0 w-full resize-none overflow-hidden bg-transparent px-3 py-3 font-mono text-(length:--code-size) leading-(--code-line) text-transparent caret-primary outline-none"
        :class="wrapLines ? 'break-words whitespace-pre-wrap' : 'whitespace-pre'"
        :style="textareaInset"
        @input="onInput"
        @keydown.tab="onTab"
      />
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
      v-else-if="reading"
      class="flex items-center gap-2 border-t border-border bg-card px-2.5 py-1 font-mono text-[11px] text-warning"
    >
      <span aria-hidden="true">▲</span>
      <span class="truncate">
        wrapped view — laying {{ compact(lineCount) }} lines out at once is too slow to type in
      </span>
      <button
        type="button"
        class="ms-auto shrink-0 underline-offset-2 hover:underline"
        @click="wrapLines = false"
      >
        unwrap to edit
      </button>
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
  import { indentAt } from '@/lib/json/lines';
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

  /**
   * Past this, one block per line costs more to lay out than typing can absorb — measured at
   * roughly 170ms per thousand lines, so a seventeen-thousand-line file spends three seconds
   * on every keystroke. Above it the wrapped view hands over to the virtualized read-only
   * viewer, which wraps and indents identically but only builds the rows in sight.
   */
  const GRID_LINE_LIMIT = 4000;
  /** How far a wrapped row may be pushed in before the indent costs more than it gives. */
  const MAX_HANG = 12;
  /** Characters scanned for the document's indent unit before settling for the default. */
  const SCAN_LIMIT = 100_000;
  /** Past this the bars are noise rather than orientation. */
  const MAX_GUIDES = 40;
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

  /** Wrapped but too long to lay out per line, so it is shown rather than edited. */
  const reading = computed(
    () => editable.value && wrapLines.value && lineCount.value > GRID_LINE_LIMIT,
  );

  const lineCount = computed(() => {
    if (props.lines !== null) return props.lines;
    if (!editable.value) return 0;
    return countLines(props.modelValue);
  });

  const gutterChars = computed(() => Math.max(3, String(lineCount.value).length + 1.5));
  const gutterWidth = computed(() => `${gutterChars.value}ch`);

  /**
   * Wrapping is a trade: no horizontal scrollbar, but a line can occupy several rows. It is
   * remembered across tools because it is a reading preference, not a per-document one.
   */
  const wrapLines = useStorage('json-explorer:wrap-lines', true);

  /**
   * The indent unit the document itself uses, read from the first line that has one. Guides on
   * a guessed two-space grid sit between the columns of a four-space document, which is worse
   * than drawing none.
   */
  const indentUnit = computed(() => {
    const text = props.modelValue;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) !== 10) continue;
      let width = 0;
      let at = i + 1;
      while (at < text.length && (text.charCodeAt(at) === 32 || text.charCodeAt(at) === 9)) {
        width++;
        at++;
      }
      if (width > 0) return width;
      if (i > SCAN_LIMIT) break;
    }
    return 2;
  });

  /**
   * One entry per source line, which the grid turns into a row.
   *
   * Capped: past the limit a row per line is more DOM than a browser will lay out smoothly, so
   * the numbering stops rather than the tab. The document is still fully readable and editable.
   */
  const gridLines = computed(() => {
    const text = props.modelValue;
    const unit = indentUnit.value;
    const highlight = useHighlight.value;
    const hangs = wrapLines.value;
    const gutter = gutterWidth.value;

    const out: Array<{
      number: number;
      text: string;
      html: string;
      guides: number;
      style: Record<string, string>;
    }> = [];

    let start = 0;
    let number = 0;

    const push = (end: number) => {
      const raw = text.slice(start, end);
      let width = 0;
      while (width < raw.length && (raw.charCodeAt(width) === 32 || raw.charCodeAt(width) === 9)) {
        width++;
      }
      const indent = Math.min(width, MAX_HANG);
      out.push({
        number: ++number,
        text: raw || ' ',
        html: highlight ? highlightJson(raw) || '&nbsp;' : '',
        guides: Math.min(Math.floor(width / unit), MAX_GUIDES),
        // A cell is its own block, so a negative first-line indent over matching padding is a
        // real hanging indent here — the thing a single-block textarea cannot express.
        style:
          hangs && indent > 0
            ? {
                paddingInlineStart: `calc(${gutter} + 0.75rem + ${indent}ch)`,
                textIndent: `-${indent}ch`,
              }
            : { paddingInlineStart: `calc(${gutter} + 0.75rem)` },
      });
    };

    for (let i = 0; i < text.length && out.length < GRID_LINE_LIMIT; i++) {
      if (text.charCodeAt(i) !== 10) continue;
      push(i);
      start = i + 1;
    }
    if (out.length < GRID_LINE_LIMIT) push(text.length);

    return out;
  });

  /** Puts the textarea's text over the same column the lines occupy, past the gutter. */
  const textareaInset = computed(() => ({
    paddingInlineStart: `calc(${gutterWidth.value} + 0.75rem)`,
  }));

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

    // Scroll to the row the browser actually put the line on, rather than a computed one:
    // the grid knows where it is, and a wrapped line above would throw any calculation off.
    void nextTick(() => {
      const row = scrollRef.value?.querySelectorAll('.grid > div')[(position.line - 1) * 2];
      row?.scrollIntoView({ block: 'center' });
    });
  };

  const focus = () => textareaRef.value?.focus();

  defineExpose({ focus });
</script>
