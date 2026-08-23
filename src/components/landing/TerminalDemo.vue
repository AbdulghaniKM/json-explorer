<template>
  <div class="flex min-h-0 flex-col overflow-hidden border border-border bg-card">
    <header class="flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
      <span class="flex gap-1" aria-hidden="true">
        <span class="size-2 bg-error/70" />
        <span class="size-2 bg-warning/70" />
        <span class="size-2 bg-success/70" />
      </span>
      <span
        class="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
      >
        {{ title }}
      </span>
      <span class="ms-auto border border-border px-1.5 font-mono text-[11px] text-muted-foreground">
        {{ lineCount }} L
      </span>
    </header>

    <div class="min-h-0 flex-1 overflow-hidden p-3">
      <pre
        class="font-mono text-(length:--code-size) leading-(--code-line) whitespace-pre"
      ><code v-html="rendered"></code><span
        v-if="!done"
        class="caret ms-px inline-block h-[0.95em] w-[0.5em] translate-y-[0.15em] bg-primary"
        aria-hidden="true"
      /></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { highlightJson } from '@/lib/json/highlight';

  const props = withDefaults(defineProps<{ source: string; title?: string; speed?: number }>(), {
    title: 'response.json',
    speed: 9,
  });

  const typed = ref(0);
  const done = ref(false);

  // Highlighting a partial document would leave an unterminated string on most frames, so the
  // slice is escaped plainly until the last character lands and the real highlighter takes over.
  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rendered = computed(() =>
    done.value
      ? highlightJson(props.source)
      : escapeHtml(props.source.slice(0, typed.value)) || '&nbsp;',
  );

  const lineCount = computed(() => props.source.split('\n').length);

  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const finish = () => {
    stop();
    typed.value = props.source.length;
    done.value = true;
  };

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    timer = setInterval(() => {
      typed.value += props.speed;
      if (typed.value >= props.source.length) finish();
    }, 16);
  });

  onUnmounted(stop);
</script>

<style scoped>
  /* steps(1) so it snaps between states — a terminal caret does not fade. */
  .caret {
    animation: caret-blink 1s steps(1) infinite;
  }

  @keyframes caret-blink {
    0%,
    50% {
      opacity: 1;
    }
    50.01%,
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .caret {
      animation: none;
    }
  }
</style>
