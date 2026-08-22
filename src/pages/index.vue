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
        variant="surface"
        size="sm"
        icon="icon-[solar--magic-stick-3-linear]"
        label="Beautify"
        @click="beautify"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--minimize-square-3-linear]"
        label="Minify"
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
        variant="ghost"
        size="sm"
        icon="icon-[solar--document-add-linear]"
        label="Sample"
        @click="store.loadSample"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--trash-bin-minimalistic-linear]"
        label="Clear"
        @click="store.clear"
      />

      <div class="ms-auto flex flex-wrap items-center gap-1.5">
        <UiAppBadge :variant="store.isValid ? 'success' : store.isEmpty ? 'muted' : 'error'">
          {{ store.isEmpty ? 'Empty' : store.isValid ? 'Valid JSON' : 'Invalid JSON' }}
        </UiAppBadge>
        <UiAppBadge v-if="stats" variant="surface">{{ stats.totalNodes }} nodes</UiAppBadge>
        <UiAppBadge v-if="stats" variant="surface">depth {{ stats.depth }}</UiAppBadge>
        <UiAppBadge v-if="stats" variant="surface">{{ formatBytes(stats.bytes) }}</UiAppBadge>
      </div>
    </div>

    <div class="grid min-h-0 gap-3" :class="showEditor ? 'lg:grid-cols-2' : 'lg:grid-cols-1'">
      <JsonEditor
        v-show="showEditor"
        v-model="store.source"
        label="Source"
        class="h-[42vh] lg:h-[calc(100vh-13rem)]"
        :error="store.error"
        :valid="store.isValid"
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

      <JsonPanel
        title="Tree"
        icon="icon-[solar--folder-with-files-linear]"
        class="h-[52vh] lg:h-[calc(100vh-13rem)]"
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
            tooltip="Expand all"
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
              class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              :size="0.875"
            />
            <input
              ref="searchRef"
              v-model="tree.query.value"
              type="search"
              placeholder="Search keys and values…"
              class="h-8 w-full rounded-lg border border-border bg-background ps-8 pe-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          <div v-if="tree.query.value.trim()" class="flex items-center gap-1">
            <span class="font-mono text-xs text-text-muted">
              {{ tree.matches.value.length ? tree.activeIndex.value + 1 : 0 }}/{{
                tree.matches.value.length
              }}
            </span>
            <UiAppButton
              icon="icon-[solar--alt-arrow-up-linear]"
              icon-only
              size="xs"
              tooltip="Previous match"
              @click="tree.previousMatch"
            />
            <UiAppButton
              icon="icon-[solar--alt-arrow-down-linear]"
              icon-only
              size="xs"
              tooltip="Next match"
              @click="tree.nextMatch"
            />
            <UiAppButton
              icon="icon-[solar--filter-linear]"
              icon-only
              size="xs"
              :variant="tree.onlyMatches.value ? 'primary' : 'ghost'"
              tooltip="Show matches only"
              @click="tree.onlyMatches.value = !tree.onlyMatches.value"
            />
          </div>

          <select
            v-model.number="depth"
            class="h-8 rounded-lg border border-border bg-background px-2 text-sm text-text outline-none focus:border-primary"
            @change="tree.expandToDepth(depth)"
          >
            <option :value="1">Depth 1</option>
            <option :value="2">Depth 2</option>
            <option :value="3">Depth 3</option>
            <option :value="5">Depth 5</option>
            <option :value="99">All</option>
          </select>
        </div>

        <JsonTree v-if="store.isValid" :value="store.value" :api="tree" class="flex-1" />

        <UiAppEmptyState
          v-else
          class="flex-1"
          icon="icon-[solar--danger-triangle-linear]"
          :variant="store.isEmpty ? 'neutral' : 'danger'"
          :title="store.isEmpty ? 'Nothing to explore yet' : 'Invalid JSON'"
          :description="
            store.isEmpty
              ? 'Paste JSON in the editor, drop a file, or load the sample document.'
              : store.error?.message
          "
        >
          <UiAppButton
            v-if="store.isEmpty"
            variant="primary"
            label="Load sample"
            @click="store.loadSample"
          />
          <UiAppButton v-else variant="primary" label="Try to fix it" @click="repair" />
        </UiAppEmptyState>

        <footer
          class="flex items-center gap-2 border-t border-border/70 bg-muted/30 px-3 py-2 font-mono text-xs text-text-muted"
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
    </div>
  </div>
</template>

<script setup lang="ts">
  import { analyzeJson, formatBytes } from '@/lib/json';
  import { useJsonTree } from '@/composables/useJsonTree';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useClipboard } from '@/composables/useClipboard';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/',
    head: 'JSON Explorer — tree viewer',
  });

  const { store, open, save, copyAll, beautify, minify, repair } = useJsonWorkspace();
  const { copy } = useClipboard();
  const { success } = useToast();

  const showEditor = ref(true);
  const depth = ref(2);
  const searchRef = ref<HTMLInputElement | null>(null);

  const tree = useJsonTree(computed(() => store.value));

  const stats = computed(() => (store.isValid ? analyzeJson(store.value, store.text) : null));

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
