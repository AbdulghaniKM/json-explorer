<template>
  <span
    class="inline-flex items-center justify-center border px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium tracking-[0.06em] whitespace-nowrap uppercase"
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
    // The border carries the identity and the fill stays near-transparent, so a row of these
    // reads as a status strip rather than a row of pills.
    return {
      primary: 'border-primary/50 bg-primary/10 text-primary',
      success: 'border-success/50 bg-success/10 text-success',
      warning: 'border-warning/50 bg-warning/10 text-warning',
      error: 'border-error/50 bg-error/10 text-error',
      info: 'border-info/50 bg-info/10 text-info',
      surface: 'border-border bg-card text-foreground',
      outline: 'border-border text-muted-foreground',
      muted: 'border-transparent bg-muted text-muted-foreground',
    }[props.variant];
  });
</script>
