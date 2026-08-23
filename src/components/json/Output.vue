<template>
  <div class="relative min-h-0 flex-1 overflow-auto bg-background/40">
    <pre
      v-if="text"
      class="p-3 font-mono text-(length:--code-size) leading-(--code-line) whitespace-pre text-text"
    ><code>{{ text }}</code></pre>
    <div v-else class="flex h-full items-center justify-center p-6 text-sm text-text-muted">
      {{ placeholder }}
    </div>
  </div>
</template>

<script setup lang="ts">
  withDefaults(defineProps<{ text: string; placeholder?: string }>(), {
    placeholder: 'Output will appear here.',
  });
</script>
