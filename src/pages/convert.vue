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
        v-if="currentTarget.usesRootName"
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
        <UiAppBadge v-if="converting" variant="info">Converting…</UiAppBadge>
        <UiAppBadge v-else-if="size" variant="surface">{{ formatBytes(size) }}</UiAppBadge>
        <UiAppButton
          variant="surface"
          size="sm"
          icon="icon-[solar--copy-linear]"
          label="Copy"
          :disabled="!full || size > CLIPBOARD_LIMIT"
          @click="copyOutput"
        />
        <UiAppButton
          variant="surface"
          size="sm"
          icon="icon-[solar--download-minimalistic-linear]"
          label="Download"
          :disabled="!preview"
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
        :lines="store.stats?.lines ?? null"
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
        :badge="truncated ? 'preview truncated' : undefined"
        class="h-[40vh] lg:h-[calc(100vh-13rem)]"
      >
        <JsonOutput :text="preview" :placeholder="placeholder" />
      </JsonPanel>
    </div>

    <p class="text-xs text-text-muted">{{ currentTarget.hint }}</p>
  </div>
</template>

<script setup lang="ts">
  import { formatBytes, type ConvertTarget, type EngineResponseOf } from '@/lib/json';
  import { runOffThread } from '@/composables/useJsonEngine';
  import { CLIPBOARD_LIMIT, useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/convert',
    head: 'Convert JSON — TypeScript, C#, Zod, YAML, CSV',
  });

  const TARGETS: Array<{
    id: ConvertTarget;
    label: string;
    icon: string;
    extension: string;
    mime: string;
    hint: string;
    usesRootName?: boolean;
  }> = [
    {
      id: 'typescript',
      label: 'TypeScript',
      icon: 'icon-[solar--code-linear]',
      extension: 'ts',
      mime: 'text/plain',
      hint: 'Interfaces are merged across array items — keys missing from some items become optional.',
      usesRootName: true,
    },
    {
      id: 'csharp',
      label: 'C#',
      icon: 'icon-[solar--code-file-linear]',
      extension: 'cs',
      mime: 'text/plain',
      hint: 'Classes for System.Text.Json in .NET Core — every property carries [JsonPropertyName], and keys missing from some array items become nullable.',
      usesRootName: true,
    },
    {
      id: 'zod',
      label: 'Zod',
      icon: 'icon-[solar--shield-check-linear]',
      extension: 'ts',
      mime: 'text/plain',
      hint: 'A runtime schema plus an inferred type, ready to paste into a Zod project.',
      usesRootName: true,
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
  const { error: toastError } = useToast();

  const active = ref<ConvertTarget>('typescript');
  const rootName = ref('Root');
  const delimiter = ref(',');

  const preview = ref('');
  const full = ref('');
  const truncated = ref(false);
  const size = ref(0);
  const converting = ref(false);
  const failure = ref('');

  const currentTarget = computed(
    () => TARGETS.find((target) => target.id === active.value) ?? TARGETS[0],
  );

  const placeholder = computed(() => {
    if (failure.value) return failure.value;
    if (store.isEmpty) return 'Paste JSON on the left to convert it.';
    return 'Fix the JSON to see the conversion.';
  });

  let token = 0;

  const convert = async () => {
    const current = ++token;
    if (!store.isValid) {
      preview.value = '';
      full.value = '';
      size.value = 0;
      failure.value = '';
      return;
    }

    converting.value = true;
    const response = await runOffThread<EngineResponseOf<'convert'>>({
      kind: 'convert',
      text: store.source,
      target: active.value,
      rootName: rootName.value,
      delimiter: delimiter.value,
    });

    if (current !== token) return;
    converting.value = false;

    if (response.ok) {
      preview.value = response.preview;
      full.value = response.text;
      truncated.value = response.truncated;
      size.value = response.size;
      failure.value = '';
    } else {
      preview.value = '';
      full.value = '';
      truncated.value = false;
      size.value = 0;
      failure.value = response.message;
    }
  };

  const copyOutput = () => {
    if (!full.value || size.value > CLIPBOARD_LIMIT) {
      toastError('This output is too large for the clipboard — download it instead');
      return;
    }
    copy(full.value, true);
  };

  const downloadOutput = () => {
    if (!full.value) return;
    download(full.value, `data.${currentTarget.value.extension}`, currentTarget.value.mime);
  };

  watchDebounced([() => store.source, () => store.isValid, active, rootName, delimiter], convert, {
    debounce: 300,
    maxWait: 2000,
    immediate: true,
  });
</script>
