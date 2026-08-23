<template>
  <div class="border border-border bg-card">
    <div class="flex items-center gap-1.5 border-b border-border bg-muted/40 px-2.5 py-1">
      <UiAppIcon v-if="icon" :name="icon" class="text-muted-foreground" :size="0.75" />
      <span
        class="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
      >
        {{ label }}
      </span>
    </div>
    <div class="px-2.5 py-2">
      <p class="font-mono text-2xl leading-none font-semibold text-foreground tabular-nums">
        {{ value }}
      </p>
      <p
        v-if="hint"
        class="mt-1.5 truncate font-mono text-[11px] text-muted-foreground"
        :title="hint"
      >
        {{ hint }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{ label: string; value: string | number; hint?: string; icon?: string }>();
</script>
