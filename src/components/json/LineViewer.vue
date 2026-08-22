<template>
  <div ref="viewportRef" class="relative min-h-0 flex-1 overflow-auto" @scroll.passive="onScroll">
    <div :style="{ height: `${totalHeight}px` }" class="relative min-w-full">
      <div class="absolute inset-x-0 top-0" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="line in visibleLines"
          :key="line.number"
          class="flex items-start"
          :style="{ height: `${ROW_HEIGHT}px` }"
        >
          <span
            class="sticky start-0 shrink-0 border-e border-border/60 bg-muted/40 px-2 text-end font-mono text-[13px] leading-[21px] text-text-muted/70 select-none"
            :class="line.number === errorLine ? 'bg-error/15 font-semibold text-error' : ''"
            :style="{ width: gutterWidth }"
          >
            {{ line.number }}
          </span>
          <pre
            class="ps-3 font-mono text-[13px] leading-[21px] whitespace-pre"
          ><code v-html="line.html"></code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { highlightJson } from '@/lib/json';

  const props = withDefaults(defineProps<{ text: string; errorLine?: number }>(), { errorLine: 0 });

  const ROW_HEIGHT = 21;
  const OVERSCAN = 10;
  const MAX_LINE_CHARS = 2000;

  const viewportRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(600);
  const offsets = shallowRef(new Uint32Array(0));
  const lineCount = ref(0);

  const buildOffsets = (text: string) => {
    if (!text) {
      offsets.value = new Uint32Array(0);
      lineCount.value = 0;
      return;
    }

    let estimate = 1;
    let from = text.indexOf('\n');
    while (from !== -1) {
      estimate++;
      from = text.indexOf('\n', from + 1);
    }

    const starts = new Uint32Array(estimate + 1);
    let line = 1;
    starts[0] = 0;
    let position = text.indexOf('\n');
    while (position !== -1 && line <= estimate) {
      starts[line++] = position + 1;
      position = text.indexOf('\n', position + 1);
    }
    starts[estimate] = text.length + 1;

    offsets.value = starts;
    lineCount.value = estimate;
  };

  const totalHeight = computed(() => lineCount.value * ROW_HEIGHT);
  const gutterWidth = computed(() => `${Math.max(3.5, String(lineCount.value).length + 1.5)}ch`);

  const startLine = computed(() =>
    Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN),
  );
  const endLine = computed(() =>
    Math.min(
      lineCount.value,
      Math.ceil((scrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN,
    ),
  );
  const offsetY = computed(() => startLine.value * ROW_HEIGHT);

  const visibleLines = computed(() => {
    const starts = offsets.value;
    const out: Array<{ number: number; html: string }> = [];
    if (!starts.length) return out;

    for (let line = startLine.value; line < endLine.value; line++) {
      const from = starts[line];
      const to = Math.min(starts[line + 1] ?? props.text.length + 1, from + MAX_LINE_CHARS + 1);
      const raw = props.text.slice(from, Math.max(from, to - 1));
      out.push({ number: line + 1, html: highlightJson(raw) || '&nbsp;' });
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
    element.scrollTop = Math.max(0, (line - 4) * ROW_HEIGHT);
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
