<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto p-2">
    <UiAppEmptyState
      v-if="identical"
      class="flex-1"
      icon="icon-[solar--check-circle-linear]"
      variant="success"
      title="No differences"
      description="Both documents describe exactly the same data."
    />
    <JsonDiffNode v-else :node="root" :depth="0" :only-changes="onlyChanges" />
  </div>
</template>

<script setup lang="ts">
  import type { DiffNode } from '@/lib/json';

  const props = defineProps<{ root: DiffNode; onlyChanges?: boolean }>();

  const identical = computed(() => props.root.kind === 'unchanged');
</script>
