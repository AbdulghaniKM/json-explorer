<template>
  <section class="flex min-h-0 flex-col overflow-hidden border border-border bg-card">
    <header
      v-if="title || $slots.actions || $slots.title"
      class="flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5"
    >
      <UiAppIcon v-if="icon" :name="icon" class="shrink-0 text-muted-foreground" />
      <h2
        class="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
      >
        <slot name="title">{{ title }}</slot>
      </h2>
      <span
        v-if="badge"
        class="border border-border px-1.5 font-mono text-[11px] text-muted-foreground"
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
