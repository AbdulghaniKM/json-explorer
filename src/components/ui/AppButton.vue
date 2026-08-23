<template>
  <AppTooltip v-if="tooltip" :content="tooltip" :placement="tooltipPlacement">
    <button
      :type="type"
      class="btn-base inline-flex cursor-pointer items-center justify-center border font-mono font-medium tracking-tight whitespace-nowrap transition-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
      :class="[sizeClass, variantClass, gapClass, fullWidth && 'w-full']"
      :disabled="disabled || loading"
      :aria-busy="loading || undefined"
      v-bind="$attrs"
    >
      <AppSpinner v-if="loading" :size="spinnerSize" class="shrink-0" />
      <AppIcon v-else-if="icon" :name="icon" :size="iconSize" class="shrink-0" />
      <span v-if="!iconOnly && (label || $slots.default)" class="truncate">
        <slot>{{ loading && loadingLabel ? loadingLabel : label }}</slot>
      </span>
    </button>
  </AppTooltip>
  <button
    v-else
    :type="type"
    class="btn-base inline-flex cursor-pointer items-center justify-center border font-mono font-medium tracking-tight whitespace-nowrap transition-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
    :class="[sizeClass, variantClass, gapClass, fullWidth && 'w-full']"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    v-bind="$attrs"
  >
    <AppSpinner v-if="loading" :size="spinnerSize" class="shrink-0" />
    <AppIcon v-else-if="icon" :name="icon" :size="iconSize" class="shrink-0" />
    <span v-if="!iconOnly && (label || $slots.default)" class="truncate">
      <slot>{{ loading && loadingLabel ? loadingLabel : label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import AppTooltip from './AppTooltip.vue';
  import AppIcon from './AppIcon.vue';
  import AppSpinner from './AppSpinner.vue';

  defineOptions({ inheritAttrs: false });

  const props = withDefaults(
    defineProps<{
      variant?:
        | 'primary'
        | 'accent'
        | 'secondary'
        | 'ghost'
        | 'muted'
        | 'danger'
        | 'success'
        | 'surface'
        | 'outline';
      icon?: string;
      label?: string;
      tooltip?: string;
      tooltipPlacement?: 'top' | 'bottom' | 'start' | 'end';
      iconOnly?: boolean;
      size?: 'xs' | 'sm' | 'md' | 'lg';
      fullWidth?: boolean;
      disabled?: boolean;
      loading?: boolean;
      loadingLabel?: string;
      type?: 'button' | 'submit' | 'reset';
    }>(),
    {
      variant: 'ghost',
      icon: '',
      label: '',
      tooltip: '',
      tooltipPlacement: 'top',
      iconOnly: false,
      size: 'sm',
      fullWidth: false,
      disabled: false,
      loading: false,
      loadingLabel: '',
      type: 'button',
    },
  );

  const sizeClass = computed(() => {
    if (props.iconOnly && !props.fullWidth) {
      return {
        xs: 'size-6 text-xs',
        sm: 'size-(--control-h) text-sm',
        md: 'size-9 text-sm',
        lg: 'size-11 text-base',
      }[props.size];
    }
    return {
      xs: 'h-6 px-2 text-[11px]',
      sm: 'h-(--control-h) px-2.5 text-xs',
      md: 'h-9 px-3.5 text-sm',
      lg: 'h-11 px-5 text-sm',
    }[props.size];
  });

  const gapClass = computed(() => {
    if (props.iconOnly) return 'gap-0';
    return { xs: 'gap-1', sm: 'gap-1.5', md: 'gap-2', lg: 'gap-2.5' }[props.size];
  });

  const variantClass = computed(
    () =>
      ({
        primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary/85',
        accent: 'border-primary bg-primary text-primary-foreground hover:bg-primary/85',
        secondary: 'border-border bg-secondary text-secondary-foreground hover:border-input',
        ghost: 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        muted: 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        danger: 'border-error/40 text-error hover:bg-error/10',
        success: 'border-success/40 text-success hover:bg-success/10',
        surface: 'border-border bg-card text-foreground hover:border-input hover:text-primary',
        outline: 'border-border bg-transparent text-foreground hover:border-input',
      })[props.variant],
  );

  const iconSize = computed(() => ({ xs: 0.7, sm: 0.9, md: 1, lg: 1.125 })[props.size]);
  const spinnerSize = computed(
    () => (({ xs: 'xs', sm: 'xs', md: 'sm', lg: 'sm' }) as const)[props.size],
  );
</script>

<style scoped>
  /* An instant inversion, not a spring. Nothing in this system eases. */
  .btn-base:not(:disabled):active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-foreground);
  }
</style>
