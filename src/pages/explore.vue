<template>
  <JsonWorkbench>
    <template #toolbar>
      <UiAppButton
        variant="primary"
        size="sm"
        icon="icon-[solar--upload-minimalistic-linear]"
        label="Open file"
        @click="open"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--magic-stick-3-linear]"
        label="Beautify"
        :loading="store.busy === 'beautify'"
        @click="beautify"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--minimize-square-3-linear]"
        label="Minify"
        :loading="store.busy === 'minify'"
        @click="minify"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--copy-linear]"
        label="Copy"
        @click="copyAll"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--download-minimalistic-linear]"
        label="Download"
        @click="save"
      />
      <UiAppButton
        v-if="showSampleData"
        variant="ghost"
        size="sm"
        icon="icon-[solar--document-add-linear]"
        label="Sample"
        @click="store.loadSample"
      />

      <div class="flex items-center gap-1 border border-border bg-card ps-2">
        <UiAppIcon name="icon-[solar--bolt-linear]" :size="0.9" class="text-warning" />
        <select
          v-model.number="stressRecords"
          class="h-8 bg-transparent text-xs text-foreground outline-none"
        >
          <option :value="20000">20k records · ~7 MB</option>
          <option :value="100000">100k records · ~33 MB</option>
          <option :value="200000">200k records · ~66 MB</option>
        </select>
        <UiAppButton
          size="xs"
          variant="ghost"
          label="Generate"
          :loading="store.busy === 'generate'"
          @click="generate(stressRecords)"
        />
      </div>

      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--trash-bin-minimalistic-linear]"
        label="Clear"
        @click="store.clear"
      />

      <div class="ms-auto flex flex-wrap items-center gap-1.5">
        <UiAppBadge v-if="store.scanning" variant="info">Indexing…</UiAppBadge>
        <UiAppBadge :variant="store.isValid ? 'success' : store.isEmpty ? 'muted' : 'error'">
          {{ store.isEmpty ? 'Empty' : store.isValid ? 'Valid JSON' : 'Invalid JSON' }}
        </UiAppBadge>
        <UiAppBadge v-if="stats" variant="surface">
          {{ compact(stats.totalNodes) }} nodes
        </UiAppBadge>
        <UiAppBadge v-if="stats" variant="surface">depth {{ stats.depth }}</UiAppBadge>
        <UiAppBadge v-if="stats" variant="surface">{{ formatBytes(stats.bytes) }}</UiAppBadge>
        <UiAppBadge v-if="stats" variant="muted">indexed in {{ stats.scanMs }} ms</UiAppBadge>
      </div>
    </template>

    <JsonSplitPane
      storage-key="explore"
      :initial="45"
      :min="20"
      :max="75"
      :collapsed="!showEditor"
      label="Resize the editor and the tree"
      class="lg:h-(--panel-h)"
    >
      <template #a>
        <JsonEditor
          v-show="showEditor"
          v-model="store.source"
          label="Source"
          class="h-(--editor-h) lg:h-auto"
          :error="store.error"
          :valid="store.isValid"
          :lines="stats?.lines ?? null"
          @file="onFileLoaded"
        >
          <template #actions>
            <UiAppButton
              icon="icon-[solar--undo-left-linear]"
              icon-only
              size="xs"
              tooltip="Undo last transform"
              :disabled="!store.canUndo"
              @click="store.undo"
            />
          </template>
          <template #error-action>
            <button
              type="button"
              class="ms-auto font-medium text-primary hover:underline"
              @click="repair"
            >
              Try to fix it
            </button>
          </template>
        </JsonEditor>
      </template>

      <template #b>
        <JsonPanel
          title="Tree"
          icon="icon-[solar--folder-with-files-linear]"
          :badge="rowLabel"
          class="h-[52svh] lg:h-auto"
        >
          <template #actions>
            <UiAppButton
              :icon="
                showEditor
                  ? 'icon-[solar--maximize-square-3-linear]'
                  : 'icon-[solar--minimize-square-3-linear]'
              "
              icon-only
              size="xs"
              :tooltip="showEditor ? 'Hide the editor' : 'Show the editor'"
              @click="showEditor = !showEditor"
            />
            <UiAppButton
              icon="icon-[solar--list-linear]"
              icon-only
              size="xs"
              tooltip="Expand all (capped for very large documents)"
              @click="tree.expandAll"
            />
            <UiAppButton
              icon="icon-[solar--minimize-square-3-linear]"
              icon-only
              size="xs"
              tooltip="Collapse all"
              @click="tree.collapseAll"
            />
          </template>

          <div class="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
            <div class="relative min-w-0 flex-1">
              <UiAppIcon
                name="icon-[solar--magnifer-linear]"
                class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                :size="0.875"
              />
              <input
                ref="searchRef"
                v-model="tree.query.value"
                type="search"
                placeholder="Search keys and values…"
                class="h-8 w-full border border-border bg-background ps-8 pe-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <!-- Always mounted, disabled when there is nothing to step through: appearing on
                 the first keystroke reflowed the row and moved the controls under the cursor. -->
            <div class="flex items-center gap-1">
              <span
                class="font-mono text-xs tabular-nums"
                :class="hasQuery ? 'text-muted-foreground' : 'text-muted-foreground/40'"
              >
                {{ tree.matchCount.value ? tree.activeIndex.value + 1 : 0 }}/{{
                  compact(tree.matchCount.value)
                }}{{ tree.matchesTruncated.value ? '+' : '' }}
              </span>
              <UiAppButton
                icon="icon-[solar--alt-arrow-up-linear]"
                icon-only
                size="xs"
                tooltip="Previous match"
                :disabled="!tree.matchCount.value"
                @click="tree.previousMatch"
              />
              <UiAppButton
                icon="icon-[solar--alt-arrow-down-linear]"
                icon-only
                size="xs"
                tooltip="Next match"
                :disabled="!tree.matchCount.value"
                @click="tree.nextMatch"
              />
              <UiAppButton
                icon="icon-[solar--filter-linear]"
                icon-only
                size="xs"
                :variant="tree.onlyMatches.value ? 'primary' : 'ghost'"
                tooltip="Show matches only"
                :disabled="!hasQuery"
                @click="tree.onlyMatches.value = !tree.onlyMatches.value"
              />
            </div>

            <select
              v-model.number="depth"
              class="h-8 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
              @change="tree.expandToDepth(depth)"
            >
              <option :value="1">Depth 1</option>
              <option :value="2">Depth 2</option>
              <option :value="3">Depth 3</option>
              <option :value="5">Depth 5</option>
            </select>
          </div>

          <JsonVirtualTree
            v-if="store.index && store.isValid"
            :key="store.documentId"
            :text="store.source"
            :index="store.index"
            :api="tree"
          />

          <UiAppEmptyState
            v-else
            class="flex-1"
            :icon="
              store.scanning ? 'icon-[solar--bolt-linear]' : 'icon-[solar--danger-triangle-linear]'
            "
            :variant="store.isEmpty ? 'neutral' : store.scanning ? 'info' : 'danger'"
            :title="
              store.scanning
                ? 'Indexing the document…'
                : store.isEmpty
                  ? 'Nothing to explore yet'
                  : 'Invalid JSON'
            "
            :description="
              store.scanning
                ? 'Parsing runs in a worker, so the page stays responsive.'
                : store.isEmpty
                  ? 'Paste JSON, drop a file, or generate a large document to stress test the viewer.'
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
            <UiAppButton
              v-else-if="!store.scanning"
              variant="primary"
              label="Try to fix it"
              @click="repair"
            />
          </UiAppEmptyState>

          <footer
            class="flex items-center gap-2 border-t border-border/70 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
          >
            <span class="truncate">{{ tree.selectedPath.value }}</span>
            <UiAppButton
              icon="icon-[solar--copy-linear]"
              icon-only
              size="xs"
              tooltip="Copy path"
              class="ms-auto"
              @click="copyPath"
            />
          </footer>
        </JsonPanel>
      </template>
    </JsonSplitPane>
  </JsonWorkbench>
</template>

<script setup lang="ts">
  import { showSampleData } from '@/composables/usePreferences';
  import { formatBytes } from '@/lib/json';
  import { useJsonTree } from '@/composables/useJsonTree';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useClipboard } from '@/composables/useClipboard';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/explore',
    head: 'Explore JSON — collapsible tree viewer',
  });

  const { store, open, save, copyAll, beautify, minify, repair, generate } = useJsonWorkspace();
  const { copy } = useClipboard();
  const { success } = useToast();

  const showEditor = ref(true);
  const depth = ref(2);
  const stressRecords = ref(100000);
  const searchRef = ref<HTMLInputElement | null>(null);

  const tree = useJsonTree(
    computed(() => store.source),
    computed(() => store.index),
    computed(() => store.documentId),
  );

  const stats = computed(() => store.stats);

  const hasQuery = computed(() => tree.query.value.trim().length > 0);

  const compact = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 10_000) return `${Math.round(value / 1000)}k`;
    return value.toLocaleString('en-US');
  };

  const rowLabel = computed(() =>
    tree.rowCount.value ? `${compact(tree.rowCount.value)} rows` : undefined,
  );

  const copyPath = () => copy(tree.selectedPath.value, true);

  const onFileLoaded = (name: string) => success(`Loaded ${name}`);

  useKeyboard({
    '/': (event) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      searchRef.value?.focus();
      return true;
    },
  });
</script>
