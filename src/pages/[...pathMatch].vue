<template>
  <UiAppEmptyState
    icon="icon-[solar--compass-square-linear]"
    title="Page not found"
    description="That route does not exist. Every tool lives in the navigation above."
    variant="neutral"
  >
    <RouterLink
      to="/"
      class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      Back to the explorer
    </RouterLink>
  </UiAppEmptyState>
</template>

<script setup lang="ts">
  definePage({
    head: 'Page not found',
  });
</script>
