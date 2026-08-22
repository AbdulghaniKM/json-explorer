<template>
  <div
    class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow"
    :class="dragging ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''"
  >
    <header class="flex items-center gap-2 border-b border-border/70 px-3 py-2">
      <span class="text-xs font-semibold tracking-wider text-text-muted uppercase">
        {{ label }}
      </span>
      <span class="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-text-muted">
        {{ lineCount }} L · {{ formatCount(modelValue.length) }} ch
      </span>
      <div class="ms-auto flex items-center gap-1">
        <slot name="actions" />
      </div>
    </header>

    <div
      class="relative min-h-0 flex-1"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
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
            :placeholder="placeholder"
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

      <div
        v-if="dragging"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[2px]"
      >
        <div
          class="flex items-center gap-2 rounded-xl border border-dashed border-primary px-4 py-3 text-sm font-medium text-primary"
        >
          <UiAppIcon name="icon-[solar--upload-minimalistic-linear]" />
          Drop a JSON file to load it
        </div>
      </div>
    </div>

    <footer
      v-if="error && modelValue.trim()"
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
  import { HIGHLIGHT_LIMIT, highlightJson, type JsonParseError } from '@/lib/json';
  import { useJsonFile } from '@/composables/useJsonFile';

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      label?: string;
      placeholder?: string;
      error?: JsonParseError | null;
      valid?: boolean;
      readonly?: boolean;
    }>(),
    {
      label: 'JSON',
      placeholder: 'Paste JSON here, drop a file, or load the sample…',
      error: null,
      valid: false,
      readonly: false,
    },
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string];
    file: [name: string];
  }>();

  const { fromDrop } = useJsonFile();

  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const highlightRef = ref<HTMLPreElement | null>(null);
  const gutterRef = ref<HTMLDivElement | null>(null);
  const dragging = ref(false);

  const lineCount = computed(() => (props.modelValue ? props.modelValue.split('\n').length : 1));
  const gutterLines = computed(() => {
    const total = Math.min(lineCount.value, 5000);
    return Array.from({ length: total }, (_, index) => index + 1);
  });
  const gutterWidth = computed(() => `${Math.max(3, String(lineCount.value).length + 1.5)}ch`);

  const useHighlight = computed(() => props.modelValue.length <= HIGHLIGHT_LIMIT);
  const highlighted = computed(() => `${highlightJson(props.modelValue)}\n`);

  const formatCount = (count: number) => count.toLocaleString('en-US');

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
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    emit('update:modelValue', next);
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

  const focusPosition = (line: number, column: number) => {
    const target = textareaRef.value;
    if (!target) return;
    const lines = props.modelValue.split('\n');
    let index = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) index += lines[i].length + 1;
    index += Math.max(0, column - 1);
    target.focus();
    target.setSelectionRange(index, index);
    const lineHeight = 20.8;
    target.scrollTop = Math.max(0, (line - 4) * lineHeight);
    syncScroll();
  };

  const jumpToError = () => {
    if (props.error) focusPosition(props.error.line, props.error.column);
  };

  const focus = () => textareaRef.value?.focus();

  watch(
    () => props.modelValue,
    () => nextTick(syncScroll),
  );

  defineExpose({ focus, focusPosition });
</script>
