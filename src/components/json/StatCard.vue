<template>
  <div class="rounded-xl border border-border bg-surface p-4">
    <div class="flex items-center gap-2">
      <UiAppIcon v-if="icon" :name="icon" class="text-text-muted" :size="0.875" />
      <span class="text-xs font-medium tracking-wide text-text-muted uppercase">{{ label }}</span>
    </div>
    <p class="mt-2 font-mono text-2xl font-semibold text-text tabular-nums">{{ value }}</p>
    <p v-if="hint" class="mt-1 truncate text-xs text-text-muted" :title="hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
  defineProps<{ label: string; value: string | number; hint?: string; icon?: string }>();
</script>
