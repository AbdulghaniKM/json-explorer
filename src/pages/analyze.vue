<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <UiAppButton
        variant="primary"
        size="sm"
        icon="icon-[solar--upload-minimalistic-linear]"
        label="Open file"
        @click="open"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--document-add-linear]"
        label="Sample"
        @click="store.loadSample"
      />
      <UiAppBadge v-if="store.scanning" variant="info">Indexing…</UiAppBadge>
      <UiAppBadge :variant="store.isValid ? 'success' : store.isEmpty ? 'muted' : 'error'">
        {{ store.isEmpty ? 'Empty' : store.isValid ? 'Valid JSON' : 'Invalid JSON' }}
      </UiAppBadge>
      <UiAppBadge v-if="stats" variant="surface">root: {{ stats.rootType }}</UiAppBadge>
      <UiAppBadge v-if="stats" variant="muted">indexed in {{ stats.scanMs }} ms</UiAppBadge>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <JsonEditor
        v-model="store.source"
        label="Source"
        class="h-[30vh] lg:h-[calc(100vh-13rem)]"
        :error="store.error"
        :valid="store.isValid"
        :lines="stats?.lines ?? null"
      />

      <div v-if="stats" class="flex flex-col gap-3">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <JsonStatCard
            label="Characters"
            :value="format(stats.characters)"
            :hint="`${format(stats.charactersNoWhitespace)} without whitespace`"
            icon="icon-[solar--text-field-linear]"
          />
          <JsonStatCard
            label="Nodes"
            :value="format(stats.totalNodes)"
            :hint="`${format(stats.lines)} lines`"
            icon="icon-[solar--structure-linear]"
          />
          <JsonStatCard
            label="Size"
            :value="formatBytes(stats.bytes)"
            :hint="`minified ${formatBytes(stats.minifiedBytes)}`"
            icon="icon-[solar--database-linear]"
          />
          <JsonStatCard
            label="Gzip"
            :value="gzipLabel"
            :hint="gzipHint"
            icon="icon-[solar--archive-minimalistic-linear]"
          />
        </div>

        <div class="grid gap-3 lg:grid-cols-2">
          <JsonPanel title="Value types" icon="icon-[solar--pallete-2-linear]">
            <ul class="space-y-2.5 p-3">
              <li v-for="row in typeRows" :key="row.type">
                <div class="mb-1 flex items-center justify-between text-xs">
                  <span class="font-medium text-text capitalize">{{ row.type }}</span>
                  <span class="font-mono text-text-muted tabular-nums">
                    {{ format(row.count) }} · {{ row.percent }}%
                  </span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full"
                    :class="row.color"
                    :style="{ width: `${row.percent}%` }"
                  />
                </div>
              </li>
            </ul>
          </JsonPanel>

          <JsonPanel title="Structure" icon="icon-[solar--ruler-cross-pen-linear]">
            <dl class="divide-y divide-border/60 text-sm">
              <div
                v-for="row in structureRows"
                :key="row.label"
                class="flex items-center justify-between gap-3 px-3 py-2"
              >
                <dt class="text-text-muted">{{ row.label }}</dt>
                <dd
                  class="max-w-[60%] truncate text-end font-mono text-text tabular-nums"
                  :title="String(row.value)"
                >
                  {{ row.value }}
                </dd>
              </div>
            </dl>
          </JsonPanel>
        </div>

        <JsonPanel
          title="Most repeated keys"
          icon="icon-[solar--hashtag-linear]"
          :badge="stats.keyStatsPartial ? 'sampled' : undefined"
        >
          <div v-if="stats.topKeys.length" class="flex flex-wrap gap-2 p-3">
            <span
              v-for="entry in stats.topKeys"
              :key="entry.key"
              class="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-text"
            >
              {{ entry.key }}
              <span class="rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">
                {{ format(entry.count) }}
              </span>
            </span>
          </div>
          <p v-else class="p-3 text-sm text-text-muted">No object keys in this document.</p>
        </JsonPanel>
      </div>

      <UiAppEmptyState
        v-else
        class="rounded-xl border border-border bg-surface"
        icon="icon-[solar--chart-square-linear]"
        :variant="store.isEmpty ? 'neutral' : store.scanning ? 'info' : 'danger'"
        :title="
          store.scanning
            ? 'Indexing the document…'
            : store.isEmpty
              ? 'Nothing to analyze yet'
              : 'Invalid JSON'
        "
        :description="
          store.scanning
            ? 'Statistics are collected during the index pass.'
            : store.isEmpty
              ? 'Paste or open a document to see counts, size, depth and key statistics.'
              : store.error?.message
        "
      >
        <UiAppButton
          v-if="store.isEmpty"
          variant="primary"
          label="Load sample"
          @click="store.loadSample"
        />
      </UiAppEmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { formatBytes, gzipSize, pathOf } from '@/lib/json';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';

  definePage({
    route: '/analyze',
    head: 'Analyze JSON — size, depth and key stats',
  });

  const GZIP_LIMIT = 32 * 1024 * 1024;

  const { store, open } = useJsonWorkspace();

  const gzip = ref<number | null>(null);
  const gzipSkipped = ref(false);

  const stats = computed(() => store.stats);

  const format = (value: number) => value.toLocaleString('en-US');

  const gzipLabel = computed(() => {
    if (gzipSkipped.value) return '—';
    return gzip.value === null ? '…' : formatBytes(gzip.value);
  });

  const gzipHint = computed(() => {
    if (gzipSkipped.value) return 'skipped above 32 MB';
    if (gzip.value === null || !stats.value?.bytes) return 'compressing…';
    return `${Math.round((gzip.value / stats.value.bytes) * 100)}% of raw size`;
  });

  const typeColors: Record<string, string> = {
    object: 'bg-primary',
    array: 'bg-secondary',
    string: 'bg-success',
    number: 'bg-warning',
    boolean: 'bg-info',
    null: 'bg-text-muted',
  };

  const typeRows = computed(() => {
    if (!stats.value) return [];
    const total = stats.value.totalNodes || 1;
    return Object.entries(stats.value.counts)
      .map(([type, count]) => ({
        type,
        count,
        percent: Math.round((count / total) * 100),
        color: typeColors[type] ?? 'bg-muted',
      }))
      .sort((a, b) => b.count - a.count);
  });

  const nodePath = (node: number | undefined) => {
    const index = store.index;
    if (!index || node === undefined) return '';
    return pathOf(store.source, index, node);
  };

  const structureRows = computed(() => {
    const current = stats.value;
    if (!current) return [];
    return [
      { label: 'Max depth', value: current.depth },
      { label: 'Total keys', value: format(current.totalKeys) },
      {
        label: 'Unique keys',
        value: current.keyStatsPartial
          ? `${format(current.uniqueKeys)}+`
          : format(current.uniqueKeys),
      },
      { label: 'Empty values', value: format(current.emptyValues) },
      {
        label: 'Largest array',
        value: current.largestArray
          ? `${format(current.largestArray.length)} @ ${nodePath(current.largestArray.node)}`
          : '—',
      },
      {
        label: 'Longest string',
        value: current.longestString
          ? `${format(current.longestString.length)} @ ${nodePath(current.longestString.node)}`
          : '—',
      },
      {
        label: 'Number range',
        value: current.numberRange
          ? `${current.numberRange.min} … ${current.numberRange.max}${current.numberStatsPartial ? ' (sampled)' : ''}`
          : '—',
      },
      {
        label: 'Minify saving',
        value: current.bytes
          ? `${(((current.bytes - current.minifiedBytes) / current.bytes) * 100).toFixed(1)}%`
          : '—',
      },
    ];
  });

  watch(
    () => store.stats,
    async (current) => {
      gzip.value = null;
      gzipSkipped.value = false;
      if (!current) return;
      if (current.bytes > GZIP_LIMIT) {
        gzipSkipped.value = true;
        return;
      }
      const text = store.source;
      const size = await gzipSize(text);
      if (text === store.source) gzip.value = size;
    },
    { immediate: true },
  );
</script>
