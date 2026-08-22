<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        <button
          v-for="target in TARGETS"
          :key="target.id"
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          :class="
            active === target.id
              ? 'bg-primary/10 text-primary'
              : 'text-text-muted hover:bg-muted hover:text-text'
          "
          @click="active = target.id"
        >
          <UiAppIcon :name="target.icon" :size="0.95" />
          {{ target.label }}
        </button>
      </div>

      <label
        v-if="active === 'typescript' || active === 'zod'"
        class="flex items-center gap-2 text-xs text-text-muted"
      >
        Root name
        <input
          v-model="rootName"
          type="text"
          class="h-8 w-32 rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>

      <label v-if="active === 'csv'" class="flex items-center gap-2 text-xs text-text-muted">
        Delimiter
        <select
          v-model="delimiter"
          class="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
        >
          <option value=",">Comma</option>
          <option value=";">Semicolon</option>
          <option value="&#9;">Tab</option>
        </select>
      </label>

      <div class="ms-auto flex items-center gap-1">
        <UiAppButton
          variant="surface"
          size="sm"
          icon="icon-[solar--copy-linear]"
          label="Copy"
          :disabled="!output"
          @click="copyOutput"
        />
        <UiAppButton
          variant="surface"
          size="sm"
          icon="icon-[solar--download-minimalistic-linear]"
          label="Download"
          :disabled="!output"
          @click="downloadOutput"
        />
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <JsonEditor
        v-model="store.source"
        label="JSON"
        class="h-[40vh] lg:h-[calc(100vh-13rem)]"
        :error="store.error"
        :valid="store.isValid"
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
            icon="icon-[solar--document-add-linear]"
            icon-only
            size="xs"
            tooltip="Load the sample"
            @click="store.loadSample"
          />
        </template>
      </JsonEditor>

      <JsonPanel
        :title="currentTarget.label"
        :icon="currentTarget.icon"
        :badge="output ? `${output.split('\n').length} lines` : undefined"
        class="h-[40vh] lg:h-[calc(100vh-13rem)]"
      >
        <JsonOutput :text="output" :placeholder="placeholder" />
      </JsonPanel>
    </div>

    <p class="text-xs text-text-muted">{{ currentTarget.hint }}</p>
  </div>
</template>

<script setup lang="ts">
  import {
    jsonToCsv,
    jsonToQueryString,
    jsonToTypeScript,
    jsonToYaml,
    jsonToZod,
  } from '@/lib/json';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';

  definePage({
    route: '/convert',
    head: 'Convert JSON — TypeScript, Zod, YAML, CSV',
  });

  type TargetId = 'typescript' | 'zod' | 'yaml' | 'csv' | 'query';

  const TARGETS: Array<{
    id: TargetId;
    label: string;
    icon: string;
    extension: string;
    mime: string;
    hint: string;
  }> = [
    {
      id: 'typescript',
      label: 'TypeScript',
      icon: 'icon-[solar--code-linear]',
      extension: 'ts',
      mime: 'text/plain',
      hint: 'Interfaces are merged across array items — keys missing from some items become optional.',
    },
    {
      id: 'zod',
      label: 'Zod',
      icon: 'icon-[solar--shield-check-linear]',
      extension: 'ts',
      mime: 'text/plain',
      hint: 'A runtime schema plus an inferred type, ready to paste into a Zod project.',
    },
    {
      id: 'yaml',
      label: 'YAML',
      icon: 'icon-[solar--file-text-linear]',
      extension: 'yaml',
      mime: 'text/yaml',
      hint: 'Strings are quoted only when YAML would otherwise read them as another type.',
    },
    {
      id: 'csv',
      label: 'CSV',
      icon: 'icon-[solar--checklist-minimalistic-linear]',
      extension: 'csv',
      mime: 'text/csv',
      hint: 'Nested objects are flattened to dotted column names; nested arrays stay as JSON.',
    },
    {
      id: 'query',
      label: 'Query string',
      icon: 'icon-[solar--link-minimalistic-2-linear]',
      extension: 'txt',
      mime: 'text/plain',
      hint: 'Flattened key/value pairs, URL-encoded — handy for reproducing an API call.',
    },
  ];

  const { store, open, copy, download } = useJsonWorkspace();

  const active = ref<TargetId>('typescript');
  const rootName = ref('Root');
  const delimiter = ref(',');

  const currentTarget = computed(
    () => TARGETS.find((target) => target.id === active.value) ?? TARGETS[0],
  );

  const output = computed(() => {
    if (!store.isValid) return '';
    const value = store.value;
    try {
      if (active.value === 'typescript') return jsonToTypeScript(value, rootName.value || 'Root');
      if (active.value === 'zod') return jsonToZod(value, rootName.value || 'root');
      if (active.value === 'yaml') return jsonToYaml(value);
      if (active.value === 'csv') return jsonToCsv(value, delimiter.value);
      return jsonToQueryString(value);
    } catch {
      return '';
    }
  });

  const placeholder = computed(() =>
    store.isEmpty ? 'Paste JSON on the left to convert it.' : 'Fix the JSON to see the conversion.',
  );

  const copyOutput = () => copy(output.value, true);

  const downloadOutput = () =>
    download(output.value, `data.${currentTarget.value.extension}`, currentTarget.value.mime);
</script>
