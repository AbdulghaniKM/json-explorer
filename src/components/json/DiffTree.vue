<template>
  <div class="min-h-0 overflow-auto p-2">
    <JsonDiffNode :node="root" :depth="0" :only-changes="onlyChanges" />
  </div>
</template>

<script setup lang="ts">
  import type { DiffNode } from '@/lib/json';

  defineProps<{ root: DiffNode; onlyChanges?: boolean }>();
</script>
