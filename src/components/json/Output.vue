<template>
  <div class="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background/40">
    <!-- Wraps rather than scrolls sideways: a generated interface or a CSV row runs far past
         the panel, and reading it should not mean dragging a scrollbar for every line. -->
    <pre
      v-if="text"
      class="p-3 font-mono text-(length:--code-size) leading-(--code-line) break-all whitespace-pre-wrap text-foreground"
    ><code>{{ text }}</code></pre>
    <div v-else class="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {{ placeholder }}
    </div>
  </div>
</template>

<script setup lang="ts">
  withDefaults(defineProps<{ text: string; placeholder?: string }>(), {
    placeholder: 'Output will appear here.',
  });
</script>
