<template>
  <div ref="containerRef" class="min-h-0 overflow-auto p-2">
    <JsonTreeNode :value="value" :path="[]" :key-label="null" :depth="0" />
  </div>
</template>

<script setup lang="ts">
  import type { JsonValue } from '@/lib/json';
  import { JSON_TREE_KEY, type JsonTreeApi } from '@/composables/useJsonTree';

  const props = defineProps<{ value: JsonValue; api: JsonTreeApi }>();

  provide(JSON_TREE_KEY, props.api);

  const containerRef = ref<HTMLDivElement | null>(null);

  watch(
    () => props.api.activeId.value,
    (id) => {
      if (!id && id !== '') return;
      nextTick(() => {
        const element = document.getElementById(`node${id}`);
        element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    },
  );
</script>
