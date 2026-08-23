<template>
  <div class="flex flex-col gap-3">
    <!-- Hero -->
    <section class="relative overflow-hidden border border-border bg-card">
      <LandingMatrixRain class="opacity-[0.18]" :glyph-size="13" />

      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-card/70 to-card"
        aria-hidden="true"
      />

      <div class="relative grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:p-8">
        <div class="flex flex-col justify-center">
          <p class="flex items-center gap-2 text-[11px] tracking-[0.18em] text-primary uppercase">
            <span class="inline-block h-px w-6 bg-primary" aria-hidden="true" />
            browser-only json toolkit
          </p>

          <h1
            class="mt-4 text-3xl leading-[1.1] font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Read 191&nbsp;MB of JSON
            <br />
            <span class="text-primary">without leaving the tab.</span>
          </h1>

          <p class="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            A flat typed-array index instead of an object graph, a worker for anything heavy, and
            virtualized rendering. 1.6&nbsp;million rows expand as fast as five. Nothing is ever
            uploaded.
          </p>

          <div class="mt-6 flex flex-wrap items-center gap-2">
            <UiAppButton
              variant="primary"
              size="md"
              icon="icon-[solar--folder-with-files-linear]"
              label="Open the explorer"
              @click="router.push('/explore')"
            />
            <UiAppButton
              variant="outline"
              size="md"
              icon="icon-[solar--magnifer-linear]"
              label="Run a command"
              @click="palette.show()"
            />
            <kbd
              class="hidden border border-border px-1.5 py-1 text-[11px] text-muted-foreground sm:inline"
            >
              ^K
            </kbd>
          </div>
        </div>

        <LandingTerminalDemo :source="SAMPLE_JSON" class="min-h-[18rem] lg:min-h-[22rem]" />
      </div>
    </section>

    <!-- Numbers -->
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="metric in METRICS" :key="metric.label" class="border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-2.5 py-1">
          <span class="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {{ metric.label }}
          </span>
        </div>
        <div class="px-2.5 py-2">
          <p class="text-2xl leading-none font-semibold text-foreground tabular-nums">
            {{ metric.value }}
          </p>
          <p class="mt-1.5 text-[11px] text-muted-foreground">{{ metric.hint }}</p>
        </div>
      </div>
    </section>

    <!-- Tools -->
    <section class="border border-border bg-card">
      <header class="flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
        <span class="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Five tools
        </span>
      </header>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="(tool, position) in TOOLS"
          :key="tool.path"
          :to="tool.path"
          class="group flex items-start gap-3 border-e border-b border-border p-3 transition-none last:border-e-0 hover:bg-accent"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground group-hover:border-primary group-hover:text-primary"
          >
            <UiAppIcon :name="tool.icon" :size="1" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <span class="text-sm font-medium text-foreground">{{ tool.label }}</span>
              <span class="text-[11px] text-muted-foreground">alt&nbsp;{{ position + 1 }}</span>
            </span>
            <span class="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              {{ tool.description }}
            </span>
          </span>
          <span
            class="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
            aria-hidden="true"
          >
            →
          </span>
        </RouterLink>
      </div>
    </section>

    <!-- How -->
    <section class="grid gap-3 lg:grid-cols-3">
      <article
        v-for="note in ARCHITECTURE"
        :key="note.title"
        class="border border-border bg-card p-3"
      >
        <h2 class="flex items-center gap-2 text-sm font-medium text-foreground">
          <span class="text-primary" aria-hidden="true">{{ note.glyph }}</span>
          {{ note.title }}
        </h2>
        <p class="mt-2 text-[11px] leading-relaxed text-muted-foreground">{{ note.body }}</p>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { SAMPLE_JSON } from '@/lib/json/sample';
  import { useCommandPalette } from '@/composables/useCommandPalette';

  definePage({
    route: '/',
    head: 'JSON Explorer — view, format, diff and analyze JSON in the browser',
  });

  const router = useRouter();
  const palette = useCommandPalette();

  // Measured on a generated 33 MB / 2.8 M node document, the same figures the README quotes.
  const METRICS = [
    { label: 'Largest tested', value: '191 MB', hint: 'types in about five seconds' },
    { label: 'Rows virtualized', value: '1.6 M', hint: 'expanding costs the same as five' },
    { label: 'Per node', value: '~35 B', hint: 'ten typed arrays, no object graph' },
    { label: 'Uploaded', value: '0 B', hint: 'every byte stays on your device' },
  ];

  const ARCHITECTURE = [
    {
      glyph: '▚',
      title: 'A flat index, not an object graph',
      body: 'One pass over the raw text fills ten typed arrays — type, offsets, parent, child count, subtree end, depth. Values are sliced out of the source only when a row is actually drawn.',
    },
    {
      glyph: '◇',
      title: 'Format without parsing',
      body: 'Beautify, minify and sort re-emit straight from the source text, so 12345678901234567890 and 178.0 survive a round trip that JSON.parse and stringify would quietly rewrite.',
    },
    {
      glyph: '◱',
      title: 'Honest limits',
      body: 'Tools that genuinely need the whole document in memory say so and cap out rather than hanging the tab. The explorer, formatter and analyzer keep working well past those caps.',
    },
  ];
</script>
