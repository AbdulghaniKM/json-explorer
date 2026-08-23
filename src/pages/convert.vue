<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <JsonTargetSelect v-model="active" />

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
            v-if="showSampleData"
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
  import { showSampleData } from '@/composables/usePreferences';
  import { formatBytes, type ConvertTarget, type EngineResponseOf } from '@/lib/json';
  import { CONVERT_TARGETS } from '@/config/convert';
  import { runOffThread } from '@/composables/useJsonEngine';
  import { CLIPBOARD_LIMIT, useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/convert',
    head: 'Convert JSON — TypeScript, C#, .NET DTO, Zod, YAML, CSV',
  });

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
    () => CONVERT_TARGETS.find((target) => target.id === active.value) ?? CONVERT_TARGETS[0],
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
      // Clear the flag too: an earlier run may still be in flight, and its stale-token
      // return would otherwise leave the "Converting…" badge showing forever.
      converting.value = false;
      return;
    }

    converting.value = true;

    try {
      const response = await runOffThread<EngineResponseOf<'convert'>>({
        kind: 'convert',
        text: store.source,
        target: active.value,
        rootName: rootName.value,
        delimiter: delimiter.value,
      });

      if (current !== token) return;

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
    } finally {
      if (current === token) converting.value = false;
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
