<template>
  <div class="flex min-h-0 flex-col overflow-hidden border border-border bg-card">
    <header class="flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
      <span
        class="font-mono text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
      >
        {{ label }}
      </span>
      <span class="ms-auto border border-border px-1.5 font-mono text-[11px] text-muted-foreground">
        {{ lines.length }} L
      </span>
    </header>

    <div class="relative min-h-0 flex-1 overflow-hidden p-3">
      <!-- The finished session, rendered invisibly, holds the box open from the first frame.
           Without it the card grows a line at a time as the text streams and shunts the rest
           of the page down with it. -->
      <pre
        v-text="fullSession"
        aria-hidden="true"
        class="invisible font-mono text-(length:--code-size) leading-(--code-line) whitespace-pre"
      />

      <pre
        class="absolute inset-0 p-3 font-mono text-(length:--code-size) leading-(--code-line) whitespace-pre"
      ><span class="text-primary select-none">$ </span><span v-text="typedCommand" /><span
        v-if="phase === 'command'"
        class="caret ms-px inline-block h-[0.95em] w-[0.5em] translate-y-[0.15em] bg-primary"
        aria-hidden="true"
      /><template v-if="phase !== 'command'">
<code v-html="body"></code><span
        v-if="phase === 'output'"
        class="caret ms-px inline-block h-[0.95em] w-[0.5em] translate-y-[0.15em] bg-primary"
        aria-hidden="true"
      /></template></pre>
    </div>

    <footer
      class="flex items-center gap-2 border-t border-border bg-card px-2.5 py-1 font-mono text-[11px]"
      :class="phase === 'done' ? 'text-success' : 'text-muted-foreground'"
    >
      <span aria-hidden="true">{{ phase === 'done' ? '●' : '◐' }}</span>
      <span>
        {{ phase === 'done' ? `valid · ${lines.length} lines · ${bytes} B` : 'parsing…' }}
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
  import { highlightJson } from '@/lib/json/highlight';

  const props = withDefaults(
    defineProps<{
      command: string;
      source: string;
      label?: string;
      /** Characters revealed per tick. The command types slower, one key at a time. */
      speed?: number;
    }>(),
    { label: 'session', speed: 7 },
  );

  type Phase = 'command' | 'output' | 'done';

  const phase = ref<Phase>('command');
  const commandShown = ref(0);
  const outputShown = ref(0);

  const lines = computed(() => props.source.split('\n'));
  const nodes = computed(() => props.source.split('\n').length);
  const bytes = computed(() => new TextEncoder().encode(props.source).length);

  const typedCommand = computed(() => props.command.slice(0, commandShown.value));

  /** What the pane will hold once it has finished typing, used only to reserve the space. */
  const fullSession = computed(
    () => `$ ${props.command}
${props.source}`,
  );

  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Highlighting a partial document would leave an unterminated string on almost every frame,
  // so the stream is escaped plainly and only handed to the real highlighter once it lands.
  const body = computed(() =>
    phase.value === 'done'
      ? highlightJson(props.source)
      : escapeHtml(props.source.slice(0, outputShown.value)),
  );

  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const finish = () => {
    stop();
    commandShown.value = props.command.length;
    outputShown.value = props.source.length;
    phase.value = 'done';
  };

  const tick = () => {
    if (phase.value === 'command') {
      commandShown.value += 1;
      if (commandShown.value >= props.command.length) phase.value = 'output';
      return;
    }
    outputShown.value += props.speed;
    if (outputShown.value >= props.source.length) finish();
  };

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    timer = setInterval(tick, 28);
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
