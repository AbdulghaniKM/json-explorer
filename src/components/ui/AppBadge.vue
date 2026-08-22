<template>
  <span
    class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium"
    :class="variantClass"
  >
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  const props = withDefaults(
    defineProps<{
      label?: string;
      variant?:
        | 'primary'
        | 'success'
        | 'warning'
        | 'error'
        | 'info'
        | 'surface'
        | 'outline'
        | 'muted';
    }>(),
    {
      variant: 'primary',
    },
  );

  const variantClass = computed(() => {
    return {
      primary: 'bg-primary/10 text-primary',
      success: 'bg-success/10 text-success',
      warning: 'bg-warning/10 text-warning',
      error: 'bg-error/10 text-error',
      info: 'bg-info/10 text-info',
      surface: 'bg-surface border border-border text-text',
      outline: 'border border-border text-text',
      muted: 'bg-muted text-text-muted',
    }[props.variant];
  });
</script>
