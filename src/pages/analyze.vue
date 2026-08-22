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
      <UiAppBadge :variant="store.isValid ? 'success' : store.isEmpty ? 'muted' : 'error'">
        {{ store.isEmpty ? 'Empty' : store.isValid ? 'Valid JSON' : 'Invalid JSON' }}
      </UiAppBadge>
      <UiAppBadge v-if="stats" variant="surface">root: {{ stats.rootType }}</UiAppBadge>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <JsonEditor
        v-model="store.source"
        label="Source"
        class="h-[30vh] lg:h-[calc(100vh-13rem)]"
        :error="store.error"
        :valid="store.isValid"
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
            label="Lines"
            :value="format(stats.lines)"
            :hint="`${format(stats.totalNodes)} nodes total`"
            icon="icon-[solar--align-left-linear]"
          />
          <JsonStatCard
            label="Size"
            :value="formatBytes(stats.bytes)"
            :hint="`minified ${formatBytes(stats.minifiedBytes)}`"
            icon="icon-[solar--database-linear]"
          />
          <JsonStatCard
            label="Gzip"
            :value="gzip === null ? '—' : formatBytes(gzip)"
            :hint="gzip === null ? 'not available' : `${gzipRatio}% of raw size`"
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

          <JsonPanel title="Structure" icon="icon-[solar--structure-linear]">
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

        <JsonPanel title="Most repeated keys" icon="icon-[solar--hashtag-linear]">
          <div v-if="stats.topKeys.length" class="flex flex-wrap gap-2 p-3">
            <span
              v-for="entry in stats.topKeys"
              :key="entry.key"
              class="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-text"
            >
              {{ entry.key }}
              <span class="rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">
                {{ entry.count }}
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
        :variant="store.isEmpty ? 'neutral' : 'danger'"
        :title="store.isEmpty ? 'Nothing to analyze yet' : 'Invalid JSON'"
        :description="
          store.isEmpty
            ? 'Paste or open a document to see character counts, size, depth and key statistics.'
            : store.error?.message
        "
      >
        <UiAppButton variant="primary" label="Load sample" @click="store.loadSample" />
      </UiAppEmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { analyzeJson, formatBytes, gzipSize } from '@/lib/json';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';

  definePage({
    route: '/analyze',
    head: 'Analyze JSON — size, depth and key stats',
  });

  const { store, open } = useJsonWorkspace();

  const gzip = ref<number | null>(null);

  const stats = computed(() => (store.isValid ? analyzeJson(store.value, store.text) : null));

  const format = (value: number) => value.toLocaleString('en-US');

  const gzipRatio = computed(() => {
    if (gzip.value === null || !stats.value?.bytes) return 0;
    return Math.round((gzip.value / stats.value.bytes) * 100);
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

  const structureRows = computed(() => {
    const current = stats.value;
    if (!current) return [];
    return [
      { label: 'Max depth', value: current.depth },
      { label: 'Total keys', value: format(current.totalKeys) },
      { label: 'Unique keys', value: format(current.uniqueKeys) },
      { label: 'Empty values', value: format(current.emptyValues) },
      {
        label: 'Largest array',
        value: current.largestArray
          ? `${current.largestArray.length} @ ${current.largestArray.path}`
          : '—',
      },
      {
        label: 'Longest string',
        value: current.longestString
          ? `${current.longestString.length} @ ${current.longestString.path}`
          : '—',
      },
      {
        label: 'Number range',
        value: current.numberRange
          ? `${current.numberRange.min} … ${current.numberRange.max}`
          : '—',
      },
      { label: 'Minify saving', value: `${current.savedPercent.toFixed(1)}%` },
    ];
  });

  watchEffect(async () => {
    const text = store.text;
    gzip.value = text.trim() ? await gzipSize(text) : null;
  });
</script>
