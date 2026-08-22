<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <UiAppButton
        variant="primary"
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
        icon="icon-[solar--sort-from-top-to-bottom-linear]"
        label="Sort A→Z"
        @click="sort('asc')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--sort-from-bottom-to-top-linear]"
        label="Sort Z→A"
        @click="sort('desc')"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--broom-linear]"
        label="Repair"
        tooltip="Fix comments, single quotes, trailing commas, unquoted keys"
        @click="repair"
      />
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--scissors-linear]"
        label="Drop empties"
        tooltip="Remove null, empty strings, arrays and objects"
        @click="dropEmpty"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--quit-full-screen-linear]"
        label="Escape"
        tooltip="Turn the document into a JSON string literal"
        @click="escape"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--full-screen-linear]"
        label="Unescape"
        tooltip="Turn a JSON string literal back into JSON"
        @click="unescape"
      />

      <div class="ms-auto flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-text-muted">
          Indent
          <select
            v-model="store.indent"
            class="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
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
        class="h-[60vh] lg:h-[calc(100vh-13rem)]"
        :error="store.error"
        :valid="store.isValid"
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
            @click="repair"
          >
            Try to fix it
          </button>
        </template>
      </JsonEditor>

      <div class="flex flex-col gap-3">
        <JsonPanel title="Document" icon="icon-[solar--file-text-linear]">
          <dl class="divide-y divide-border/60 text-sm">
            <div
              v-for="row in summary"
              :key="row.label"
              class="flex items-center justify-between gap-3 px-3 py-2"
            >
              <dt class="text-text-muted">{{ row.label }}</dt>
              <dd class="font-mono text-text tabular-nums">{{ row.value }}</dd>
            </div>
          </dl>
        </JsonPanel>

        <JsonPanel title="Messy input?" icon="icon-[solar--broom-linear]">
          <div class="space-y-3 p-3 text-sm text-text-muted">
            <p>
              Repair handles comments, single quotes, unquoted keys, trailing commas, Python-style
              <code class="font-mono text-text">True/False/None</code>
              , unclosed brackets and newline-delimited JSON.
            </p>
            <UiAppButton
              variant="surface"
              size="sm"
              icon="icon-[solar--document-add-linear]"
              label="Load a messy example"
              full-width
              @click="loadMessy"
            />
          </div>
        </JsonPanel>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { SAMPLE_MESSY, byteLength, formatBytes, minifyJson } from '@/lib/json';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/format',
    head: 'Format JSON — beautify, minify, sort, repair',
  });

  const { store, open, save, copyAll, beautify, minify, repair } = useJsonWorkspace();
  const { success, error: toastError } = useToast();

  const sort = (direction: 'asc' | 'desc') => {
    if (!store.sortKeys(direction))
      toastError('Fix the syntax error first', { title: 'Invalid JSON' });
  };

  const dropEmpty = () => {
    if (!store.removeEmpty()) toastError('Fix the syntax error first', { title: 'Invalid JSON' });
  };

  const escape = () => {
    store.escapeString();
    success('Escaped as a JSON string');
  };

  const unescape = () => {
    if (store.unescapeString()) success('Unescaped');
    else toastError('This does not look like an escaped JSON string');
  };

  const loadMessy = () => {
    store.replaceSource(SAMPLE_MESSY);
  };

  const onFileLoaded = (name: string) => success(`Loaded ${name}`);

  const summary = computed(() => {
    const raw = store.text;
    const minified = store.isValid ? minifyJson(store.value) : '';
    return [
      { label: 'Characters', value: raw.length.toLocaleString('en-US') },
      { label: 'Lines', value: (raw ? raw.split('\n').length : 0).toLocaleString('en-US') },
      { label: 'Size', value: formatBytes(byteLength(raw)) },
      { label: 'Minified', value: minified ? formatBytes(byteLength(minified)) : '—' },
      {
        label: 'Saved',
        value: minified ? formatBytes(Math.max(0, byteLength(raw) - byteLength(minified))) : '—',
      },
    ];
  });
</script>
