<template>
  <div
    class="app-spinner inline-flex shrink-0 items-center justify-center overflow-visible p-0.5"
    :class="[sizeClass, colorClass]"
    :style="customStyle"
    role="status"
    aria-label="Loading"
  >
    <svg
      class="aspect-square h-full w-full animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      ></circle>
      <path
        class="opacity-100"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <span class="sr-only">Loading...</span>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  interface Props {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
    color?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 'md',
  });

  const sizeClass = computed(() => {
    if (
      typeof props.size === 'number' ||
      (typeof props.size === 'string' && /^\d/.test(props.size))
    ) {
      return '';
    }
    const sizeMap: Record<string, string> = {
      xs: 'size-3',
      sm: 'size-4',
      md: 'size-6',
      lg: 'size-8',
      xl: 'size-12',
    };
    return sizeMap[props.size as string] || sizeMap.md;
  });

  const colorClass = computed(() => {
    if (typeof props.color === 'string' && props.color && props.color.startsWith('text-')) {
      return props.color;
    }
    return 'text-current';
  });

  const customStyle = computed(() => {
    const style: Record<string, string> = {};

    if (typeof props.size === 'number') {
      style.width = `${props.size}rem`;
      style.height = `${props.size}rem`;
    } else if (typeof props.size === 'string' && /^\d/.test(props.size)) {
      const size =
        props.size.includes('rem') || props.size.includes('px') || props.size.includes('%')
          ? props.size
          : `${props.size}rem`;
      style.width = size;
      style.height = size;
    }

    if (typeof props.color === 'string' && props.color && !props.color.startsWith('text-')) {
      style.color = props.color;
    }

    return Object.keys(style).length > 0 ? style : undefined;
  });
</script>

<style scoped>
  /* Ensure the SVG always scales to container */
  svg {
    width: 100%;
    height: 100%;
  }
</style>
