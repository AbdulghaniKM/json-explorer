<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    :class="modelValue ? 'bg-primary' : 'bg-border'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="size-3.5 rounded-full bg-white shadow-sm transition-transform"
      :class="modelValue ? 'translate-x-[1.125rem]' : 'translate-x-[0.1875rem]'"
    />
  </button>
</template>

<script setup lang="ts">
  defineProps<{ modelValue: boolean; label?: string }>();

  const emit = defineEmits<{ 'update:modelValue': [boolean] }>();
</script>
