<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
    <header
      v-if="title || $slots.actions || $slots.title"
      class="flex items-center gap-2 border-b border-border/70 px-3 py-2"
    >
      <UiAppIcon v-if="icon" :name="icon" class="shrink-0 text-text-muted" />
      <h2 class="text-xs font-semibold tracking-wider text-text-muted uppercase">
        <slot name="title">{{ title }}</slot>
      </h2>
      <span
        v-if="badge"
        class="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-text-muted"
      >
        {{ badge }}
      </span>
      <div class="ms-auto flex flex-wrap items-center justify-end gap-1">
        <slot name="actions" />
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
  defineProps<{ title?: string; icon?: string; badge?: string }>();
</script>
