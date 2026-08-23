<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <UiAppButton
        variant="primary"
        size="sm"
        icon="icon-[solar--magic-stick-3-linear]"
        label="Beautify"
        :loading="store.busy === 'beautify'"
        @click="run('beautify')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--minimize-square-3-linear]"
        label="Minify"
        :loading="store.busy === 'minify'"
        @click="run('minify')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--sort-from-top-to-bottom-linear]"
        label="Sort A→Z"
        :loading="store.busy === 'sortAsc'"
        @click="run('sortAsc')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--sort-from-bottom-to-top-linear]"
        label="Sort Z→A"
        :loading="store.busy === 'sortDesc'"
        @click="run('sortDesc')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--broom-linear]"
        label="Repair"
        tooltip="Fix comments, single quotes, trailing commas, unquoted keys"
        :loading="store.busy === 'repair'"
        @click="run('repair')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--scissors-linear]"
        label="Drop empties"
        tooltip="Remove null, empty strings, arrays and objects"
        :loading="store.busy === 'removeEmpty'"
        @click="run('removeEmpty')"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--quit-full-screen-linear]"
        label="Escape"
        tooltip="Turn the document into a JSON string literal"
        @click="run('escape')"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--full-screen-linear]"
        label="Unescape"
        tooltip="Turn a JSON string literal back into JSON"
        @click="run('unescape')"
      />

      <div class="ms-auto flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
          Indent
          <select
            v-model="store.indent"
            class="h-8 border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <UiAppButton
          icon="icon-[solar--undo-left-linear]"
          icon-only
          size="sm"
          tooltip="Undo last transform"
          :disabled="!store.canUndo"
          @click="store.undo"
        />
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <JsonEditor
        v-model="store.source"
        label="Editor"
        class="h-[60vh] lg:h-(--panel-h)"
        :error="store.error"
        :valid="store.isValid"
        :lines="store.stats?.lines ?? null"
        @file="onFileLoaded"
      >
        <template #actions>
          <UiAppButton
            icon="icon-[solar--upload-minimalistic-linear]"
            icon-only
            size="xs"
            tooltip="Open a file"
            @click="open"
          />
          <UiAppButton
            icon="icon-[solar--copy-linear]"
            icon-only
            size="xs"
            tooltip="Copy"
            @click="copyAll"
          />
          <UiAppButton
            icon="icon-[solar--download-minimalistic-linear]"
            icon-only
            size="xs"
            tooltip="Download"
            @click="save"
          />
          <UiAppButton
            v-if="showSampleData"
            icon="icon-[solar--document-add-linear]"
            icon-only
            size="xs"
            tooltip="Load the sample"
            @click="store.loadSample"
          />
          <UiAppButton
            icon="icon-[solar--trash-bin-minimalistic-linear]"
            icon-only
            size="xs"
            tooltip="Clear"
            @click="store.clear"
          />
        </template>
        <template #error-action>
          <button
            type="button"
            class="ms-auto font-medium text-primary hover:underline"
            @click="run('repair')"
          >
            Try to fix it
          </button>
        </template>
      </JsonEditor>

      <div class="flex flex-col gap-3">
        <JsonPanel title="Document" icon="icon-[solar--file-text-linear]">
          <dl class="divide-y divide-border/60 font-mono text-xs">
            <div
              v-for="row in summary"
              :key="row.label"
              class="flex items-center justify-between gap-3 px-2.5 py-1.5 hover:bg-accent"
            >
              <dt class="shrink-0 text-muted-foreground">{{ row.label }}</dt>
              <dd class="font-mono text-foreground tabular-nums">{{ row.value }}</dd>
            </div>
          </dl>
        </JsonPanel>

        <JsonPanel title="Large documents" icon="icon-[solar--bolt-linear]">
          <div class="space-y-2 p-3 text-sm text-muted-foreground">
            <p>
              Beautify, minify and sort stream straight from the source text using the index, so
              they never build an in-memory copy of the document. They run in a worker.
            </p>
            <p>Repair, drop-empties and escape need the whole document in memory and are capped.</p>
          </div>
        </JsonPanel>

        <JsonPanel title="Messy input?" icon="icon-[solar--broom-linear]">
          <div class="space-y-3 p-3 text-sm text-muted-foreground">
            <p>
              Repair handles comments, single quotes, unquoted keys, trailing commas, Python-style
              <code class="font-mono text-foreground">True/False/None</code>
              , unclosed brackets and newline-delimited JSON.
            </p>
            <UiAppButton
              variant="surface"
              size="sm"
              icon="icon-[solar--document-add-linear]"
              label="Load a messy example"
              full-width
              @click="store.loadMessy"
            />
          </div>
        </JsonPanel>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { showSampleData } from '@/composables/usePreferences';
  import { formatBytes } from '@/lib/json';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/format',
    head: 'Format JSON — beautify, minify, sort, repair',
  });

  const { store, open, save, copyAll, run } = useJsonWorkspace();
  const { success } = useToast();

  const onFileLoaded = (name: string) => success(`Loaded ${name}`);

  const summary = computed(() => {
    const stats = store.stats;
    if (!stats) {
      return [
        { label: 'Characters', value: store.source.length.toLocaleString('en-US') },
        { label: 'Status', value: store.isEmpty ? 'empty' : 'invalid' },
      ];
    }
    return [
      { label: 'Characters', value: stats.characters.toLocaleString('en-US') },
      { label: 'Lines', value: stats.lines.toLocaleString('en-US') },
      { label: 'Nodes', value: stats.totalNodes.toLocaleString('en-US') },
      { label: 'Size', value: formatBytes(stats.bytes) },
      { label: 'Minified', value: formatBytes(stats.minifiedBytes) },
      {
        label: 'Saved',
        value: formatBytes(Math.max(0, stats.bytes - stats.minifiedBytes)),
      },
      { label: 'Indexed in', value: `${stats.scanMs} ms` },
    ];
  });
</script>
