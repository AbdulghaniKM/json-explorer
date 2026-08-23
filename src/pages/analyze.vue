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
        v-if="showSampleData"
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
        class="h-[30vh] lg:h-(--panel-h)"
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
          <JsonPanel
            title="Value types"
            icon="icon-[solar--pallete-2-linear]"
            :badge="`${format(stats.totalNodes)} nodes`"
          >
            <div class="p-3">
              <JsonChart
                type="bar"
                horizontal
                :height="13"
                :categories="typeChart.categories"
                :series="typeChart.series"
                :formatter="format"
              />
              <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-2">
                <li
                  v-for="row in typeRows"
                  :key="row.type"
                  class="flex items-center gap-1.5 text-[11px]"
                >
                  <span class="text-muted-foreground capitalize">{{ row.type }}</span>
                  <span class="font-mono text-foreground tabular-nums">
                    {{ format(row.count) }}
                  </span>
                  <span class="font-mono text-muted-foreground tabular-nums">
                    {{ row.percent }}%
                  </span>
                </li>
              </ul>
            </div>
          </JsonPanel>

          <JsonPanel
            title="Nesting profile"
            icon="icon-[solar--layers-linear]"
            :badge="`${stats.depth} levels`"
          >
            <div class="p-3">
              <JsonChart
                type="bar"
                :height="13"
                :categories="depthChart.categories"
                :series="depthChart.series"
                :formatter="format"
              />
              <p class="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                Nodes at each level of nesting. Level
                <span class="font-mono text-foreground tabular-nums">
                  {{ depthChart.peak.level }}
                </span>
                is the busiest, holding
                <span class="font-mono text-foreground tabular-nums">
                  {{ format(depthChart.peak.count) }}
                </span>
                of them.
              </p>
            </div>
          </JsonPanel>
        </div>

        <div class="grid gap-3 lg:grid-cols-2">
          <JsonPanel
            title="Most repeated keys"
            icon="icon-[solar--hashtag-linear]"
            :badge="keysBadge"
          >
            <div v-if="keyChart.categories.length" class="p-3">
              <JsonChart
                type="bar"
                horizontal
                :height="Math.max(9, keyChart.categories.length * 1.5)"
                :categories="keyChart.categories"
                :series="keyChart.series"
                :formatter="format"
              />
            </div>
            <p v-else class="p-3 text-sm text-muted-foreground">No object keys in this document.</p>
          </JsonPanel>

          <JsonPanel title="Structure" icon="icon-[solar--ruler-cross-pen-linear]">
            <dl class="divide-y divide-border/60 font-mono text-xs">
              <div
                v-for="row in structureRows"
                :key="row.label"
                class="flex items-center justify-between gap-3 px-2.5 py-1.5 hover:bg-accent"
              >
                <dt class="shrink-0 text-muted-foreground">{{ row.label }}</dt>
                <dd
                  class="max-w-[60%] truncate text-end font-mono text-foreground tabular-nums"
                  :title="String(row.value)"
                >
                  {{ row.value }}
                </dd>
              </div>
            </dl>
          </JsonPanel>
        </div>

        <JsonPanel
          title="Size breakdown"
          icon="icon-[solar--archive-minimalistic-linear]"
          :badge="`${minifySaving} smaller minified`"
        >
          <div class="p-3">
            <JsonChart
              type="bar"
              horizontal
              :height="7.5"
              :categories="sizeChart.categories"
              :series="sizeChart.series"
              :formatter="formatBytes"
            />
          </div>
        </JsonPanel>
      </div>

      <UiAppEmptyState
        v-else
        class="border border-border bg-card"
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
          v-if="store.isEmpty && showSampleData"
          variant="primary"
          label="Load sample"
          @click="store.loadSample"
        />
        <UiAppButton
          v-else-if="store.isEmpty"
          variant="primary"
          icon="icon-[solar--upload-minimalistic-linear]"
          label="Open a file"
          @click="open"
        />
      </UiAppEmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { formatBytes, gzipSize, pathOf } from '@/lib/json';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { showSampleData, showSampledMarkers } from '@/composables/usePreferences';

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

  const typeRows = computed(() => {
    if (!stats.value) return [];
    const total = stats.value.totalNodes || 1;
    return Object.entries(stats.value.counts)
      .map(([type, count]) => ({ type, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  });

  const typeChart = computed(() => {
    const present = typeRows.value.filter((row) => row.count > 0);
    return {
      categories: present.map((row) => row.type),
      series: [{ name: 'Nodes', data: present.map((row) => row.count) }],
    };
  });

  /** Levels past this fold into one trailing bucket, so a deep document stays readable. */
  const DEPTH_LEVELS = 14;

  const depthChart = computed(() => {
    const index = store.index;
    if (!index) return { categories: [], series: [], peak: { level: 0, count: 0 } };

    const buckets: number[] = Array.from({ length: DEPTH_LEVELS + 1 }, () => 0);
    for (let id = 0; id < index.count; id++) {
      buckets[Math.min(index.depth[id], DEPTH_LEVELS)]++;
    }

    const last = buckets.reduce((found, count, level) => (count > 0 ? level : found), 0);
    const data = buckets.slice(0, last + 1);
    const categories = data.map((_, level) =>
      level === DEPTH_LEVELS ? `${DEPTH_LEVELS}+` : String(level),
    );

    let peak = { level: 0, count: 0 };
    data.forEach((count, level) => {
      if (count > peak.count) peak = { level, count };
    });

    return { categories, series: [{ name: 'Nodes', data }], peak };
  });

  const keyChart = computed(() => {
    const entries = stats.value?.topKeys.slice(0, 12) ?? [];
    return {
      categories: entries.map((entry) => entry.key),
      series: [{ name: 'Occurrences', data: entries.map((entry) => entry.count) }],
    };
  });

  const sizeChart = computed(() => {
    const current = stats.value;
    if (!current) return { categories: [], series: [] };

    const categories = ['Raw', 'Minified'];
    const data = [current.bytes, current.minifiedBytes];
    if (gzip.value !== null) {
      categories.push('Gzip');
      data.push(gzip.value);
    }

    return { categories, series: [{ name: 'Bytes', data }] };
  });

  const minifySaving = computed(() => {
    const current = stats.value;
    if (!current?.bytes) return '0%';
    return `${(((current.bytes - current.minifiedBytes) / current.bytes) * 100).toFixed(1)}%`;
  });

  const keysBadge = computed(() => {
    if (stats.value?.keyStatsPartial && showSampledMarkers.value) return 'sampled';
    return `${format(stats.value?.uniqueKeys ?? 0)} unique`;
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
        value:
          current.keyStatsPartial && showSampledMarkers.value
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
          ? `${current.numberRange.min} … ${current.numberRange.max}${
              current.numberStatsPartial && showSampledMarkers.value ? ' (sampled)' : ''
            }`
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
