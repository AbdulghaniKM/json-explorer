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
        Hide unchanged branches
      </label>

      <div class="ms-auto flex flex-wrap items-center gap-1.5">
        <UiAppBadge v-if="comparing" variant="info">Comparing…</UiAppBadge>
        <template v-else-if="summary">
          <UiAppBadge v-if="summary.identical" variant="success">Documents match</UiAppBadge>
          <template v-else>
            <UiAppBadge variant="success">+{{ format(summary.added) }} added</UiAppBadge>
            <UiAppBadge variant="error">−{{ format(summary.removed) }} removed</UiAppBadge>
            <UiAppBadge variant="warning">~{{ format(summary.changed) }} changed</UiAppBadge>
            <UiAppBadge variant="muted">{{ format(summary.unchanged) }} unchanged</UiAppBadge>
          </template>
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
        :lines="store.stats?.lines ?? null"
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
        :lines="store.compareStats?.lines ?? null"
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
      :badge="changeBadge"
      class="min-h-[38vh]"
    >
      <JsonDiffTree v-if="root" :root="root" :only-changes="onlyChanges" class="flex-1" />

      <UiAppEmptyState
        v-else
        class="flex-1"
        :icon="comparing ? 'icon-[solar--bolt-linear]' : 'icon-[solar--danger-triangle-linear]'"
        :variant="comparing ? 'info' : 'danger'"
        :title="comparing ? 'Comparing in a worker…' : 'Cannot compare yet'"
        :description="comparing ? 'Both documents are parsed off the main thread.' : message"
      />
    </JsonPanel>
  </div>
</template>

<script setup lang="ts">
  import type { DiffNode, DiffSummary, EngineResponseOf } from '@/lib/json';
  import { runOffThread } from '@/composables/useJsonEngine';
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
  const onlyChanges = ref(true);

  const root = shallowRef<DiffNode | null>(null);
  const summary = shallowRef<DiffSummary | null>(null);
  const message = ref('');
  const comparing = ref(false);

  const format = (value: number) => value.toLocaleString('en-US');

  const changeBadge = computed(() => {
    if (!summary.value) return undefined;
    const total = summary.value.added + summary.value.removed + summary.value.changed;
    return `${format(total)} changes`;
  });

  let token = 0;

  const compare = async () => {
    const current = ++token;
    const left = store.source;
    const right = store.compare;

    if (!left.trim() || !right.trim()) {
      root.value = null;
      summary.value = null;
      message.value = 'Both sides need a JSON document.';
      // Clear the flag too: an earlier run may still be in flight, and its stale-token
      // return would otherwise leave the "Comparing…" state showing forever.
      comparing.value = false;
      return;
    }

    comparing.value = true;

    try {
      const response = await runOffThread<EngineResponseOf<'diff'>>({
        kind: 'diff',
        left,
        right,
        ignoreArrayOrder: ignoreArrayOrder.value,
      });

      if (current !== token) return;

      if (response.ok) {
        root.value = response.root;
        summary.value = response.summary;
        message.value = '';
      } else {
        root.value = null;
        summary.value = null;
        message.value = response.message;
      }
    } finally {
      if (current === token) comparing.value = false;
    }
  };

  const openInto = async (side: 'source' | 'compare') => {
    const loaded = await openFile();
    if (!loaded) return;
    if (side === 'source') store.replaceSource(loaded.text);
    else store.setCompare(loaded.text);
    success(`Loaded ${loaded.name}`);
  };

  watchDebounced([() => store.source, () => store.compare, ignoreArrayOrder], compare, {
    debounce: 350,
    maxWait: 2000,
    immediate: true,
  });
</script>
