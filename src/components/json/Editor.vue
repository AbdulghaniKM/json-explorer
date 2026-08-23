<template>
  <div
    class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface"
    :class="dragging ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <header class="flex items-center gap-2 border-b border-border/70 px-3 py-2">
      <span class="text-xs font-semibold tracking-wider text-text-muted uppercase">
        {{ label }}
      </span>
      <span class="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-text-muted">
        {{ lineLabel }} · {{ charLabel }}
      </span>
      <span
        v-if="!editable"
        class="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning"
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

    <div v-else class="relative min-h-0 flex-1">
      <div class="flex h-full min-h-0">
        <div
          ref="gutterRef"
          class="hidden shrink-0 overflow-hidden border-e border-border/60 bg-muted/40 py-3 text-end font-mono text-[13px] leading-[1.6] text-text-muted/70 select-none sm:block"
          :style="{ width: gutterWidth }"
        >
          <div
            v-for="line in gutterLines"
            :key="line"
            class="px-2"
            :class="line === error?.line ? 'bg-error/15 font-semibold text-error' : ''"
          >
            {{ line }}
          </div>
        </div>

        <div class="relative min-w-0 flex-1">
          <pre
            v-if="useHighlight"
            ref="highlightRef"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden p-3 font-mono text-[13px] leading-[1.6] whitespace-pre"
          ><code v-html="highlighted"></code></pre>

          <textarea
            ref="textareaRef"
            :value="modelValue"
            :placeholder="placeholderText"
            :readonly="readonly"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            wrap="off"
            class="absolute inset-0 h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-[1.6] whitespace-pre caret-primary outline-none"
            :class="useHighlight ? 'text-transparent' : 'text-text'"
            @input="onInput"
            @scroll="syncScroll"
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
        class="flex items-center gap-2 rounded-xl border border-dashed border-primary px-4 py-3 text-sm font-medium text-primary"
      >
        <UiAppIcon name="icon-[solar--upload-minimalistic-linear]" />
        Drop a JSON file to load it
      </div>
    </div>

    <footer
      v-if="!editable"
      class="flex items-center gap-2 border-t border-border/70 bg-warning/5 px-3 py-2 text-xs text-warning"
    >
      <UiAppIcon name="icon-[solar--bolt-linear]" class="shrink-0" />
      Large document — rendered in a virtual viewer. Editing is off; every tool still works.
    </footer>

    <footer
      v-else-if="error && modelValue.trim()"
      class="flex items-center gap-2 border-t border-border/70 bg-error/5 px-3 py-2 text-xs text-error"
    >
      <UiAppIcon name="icon-[solar--danger-triangle-linear]" class="shrink-0" />
      <button
        type="button"
        class="font-mono underline-offset-2 hover:underline"
        @click="jumpToError"
      >
        line {{ error.line }}:{{ error.column }}
      </button>
      <span class="truncate text-text-muted">{{ error.message }}</span>
      <slot name="error-action" />
    </footer>

    <footer
      v-else-if="valid && modelValue.trim()"
      class="flex items-center gap-2 border-t border-border/70 bg-success/5 px-3 py-2 text-xs text-success"
    >
      <UiAppIcon name="icon-[solar--check-circle-linear]" class="shrink-0" />
      Valid JSON
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
  const highlightRef = ref<HTMLPreElement | null>(null);
  const gutterRef = ref<HTMLDivElement | null>(null);
  const viewerRef = ref<InstanceType<typeof JsonLineViewer> | null>(null);
  const dragging = ref(false);

  const editable = computed(() => props.modelValue.length <= EDIT_LIMIT);

  const lineCount = computed(() => {
    if (props.lines !== null) return props.lines;
    if (!editable.value) return 0;
    return countLines(props.modelValue);
  });

  const gutterLines = computed(() => {
    const total = Math.min(lineCount.value, 5000);
    return Array.from({ length: Math.max(total, 1) }, (_, position) => position + 1);
  });

  const gutterWidth = computed(() => `${Math.max(3, String(lineCount.value).length + 1.5)}ch`);

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

  const syncScroll = () => {
    const source = textareaRef.value;
    if (!source) return;
    if (highlightRef.value) {
      highlightRef.value.scrollTop = source.scrollTop;
      highlightRef.value.scrollLeft = source.scrollLeft;
    }
    if (gutterRef.value) gutterRef.value.scrollTop = source.scrollTop;
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
    target.scrollTop = Math.max(0, (position.line - 4) * 20.8);
    syncScroll();
  };

  const focus = () => textareaRef.value?.focus();

  watch(
    () => props.modelValue,
    () => nextTick(syncScroll),
  );

  defineExpose({ focus });
</script>
