<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    class="relative inline-flex h-5 w-9 shrink-0 items-center border transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
    :class="modelValue ? 'border-primary bg-primary/20' : 'border-input bg-transparent'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="size-3 transition-none"
      :class="
        modelValue
          ? 'translate-x-[1.1875rem] bg-primary'
          : 'translate-x-[0.1875rem] bg-muted-foreground'
      "
    />
  </button>
</template>

<script setup lang="ts">
  defineProps<{ modelValue: boolean; label?: string }>();

  const emit = defineEmits<{ 'update:modelValue': [boolean] }>();
</script>
