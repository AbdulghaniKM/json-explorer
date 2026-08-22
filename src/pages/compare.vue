<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--transfer-vertical-linear]"
        label="Swap A ⇄ B"
        @click="store.swap"
      />
      <UiAppButton
        variant="ghost"
        size="sm"
        icon="icon-[solar--document-add-linear]"
        label="Sample pair"
        @click="store.loadSample"
      />
      <label
        class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted"
      >
        <input v-model="ignoreArrayOrder" type="checkbox" class="accent-primary" />
        Ignore array order
      </label>
      <label
        class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted"
      >
        <input v-model="onlyChanges" type="checkbox" class="accent-primary" />
        Only differences
      </label>

      <div v-if="diff" class="ms-auto flex flex-wrap items-center gap-1.5">
        <UiAppBadge v-if="diff.summary.identical" variant="success">Documents match</UiAppBadge>
        <template v-else>
          <UiAppBadge variant="success">+{{ diff.summary.added }} added</UiAppBadge>
          <UiAppBadge variant="error">−{{ diff.summary.removed }} removed</UiAppBadge>
          <UiAppBadge variant="warning">~{{ diff.summary.changed }} changed</UiAppBadge>
          <UiAppBadge variant="muted">{{ diff.summary.unchanged }} unchanged</UiAppBadge>
        </template>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <JsonEditor
        v-model="store.source"
        label="A — original"
        class="h-[32vh]"
        :error="store.error"
        :valid="store.isValid"
      >
        <template #actions>
          <UiAppButton
            icon="icon-[solar--upload-minimalistic-linear]"
            icon-only
            size="xs"
            tooltip="Open a file"
            @click="openInto('source')"
          />
          <UiAppButton
            icon="icon-[solar--magic-stick-3-linear]"
            icon-only
            size="xs"
            tooltip="Beautify"
            @click="beautify"
          />
        </template>
      </JsonEditor>

      <JsonEditor
        v-model="store.compare"
        label="B — changed"
        class="h-[32vh]"
        :error="store.compareError"
        :valid="store.compareError === null && store.compare.trim().length > 0"
      >
        <template #actions>
          <UiAppButton
            icon="icon-[solar--upload-minimalistic-linear]"
            icon-only
            size="xs"
            tooltip="Open a file"
            @click="openInto('compare')"
          />
          <UiAppButton
            icon="icon-[solar--copy-linear]"
            icon-only
            size="xs"
            tooltip="Copy A into B"
            @click="store.setCompare(store.source)"
          />
        </template>
      </JsonEditor>
    </div>

    <JsonPanel
      title="Differences"
      icon="icon-[solar--transfer-horizontal-linear]"
      :badge="
        diff
          ? `${diff.summary.added + diff.summary.removed + diff.summary.changed} changes`
          : undefined
      "
      class="min-h-[38vh]"
    >
      <JsonDiffTree v-if="diff" :root="diff.root" :only-changes="onlyChanges" class="flex-1" />

      <UiAppEmptyState
        v-else
        class="flex-1"
        icon="icon-[solar--danger-triangle-linear]"
        variant="danger"
        title="Both sides need valid JSON"
        :description="blockingMessage"
      />
    </JsonPanel>
  </div>
</template>

<script setup lang="ts">
  import { diffJson } from '@/lib/json';
  import { useJsonFile } from '@/composables/useJsonFile';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/compare',
    head: 'Compare JSON — semantic diff',
  });

  const { store, beautify } = useJsonWorkspace();
  const { openFile } = useJsonFile();
  const { success } = useToast();

  const ignoreArrayOrder = ref(false);
  const onlyChanges = ref(false);

  const diff = computed(() => {
    if (!store.isValid || store.compareError !== null) return null;
    return diffJson(store.value, store.compareValue, { ignoreArrayOrder: ignoreArrayOrder.value });
  });

  const blockingMessage = computed(() => {
    if (!store.isValid) return `A: ${store.error?.message ?? 'invalid JSON'}`;
    return `B: ${store.compareError?.message ?? 'invalid JSON'}`;
  });

  const openInto = async (side: 'source' | 'compare') => {
    const loaded = await openFile();
    if (!loaded) return;
    if (side === 'source') store.replaceSource(loaded.text);
    else store.setCompare(loaded.text);
    success(`Loaded ${loaded.name}`);
  };
</script>
