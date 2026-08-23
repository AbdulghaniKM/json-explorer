<template>
  <button
    type="button"
    :aria-label="`Switch to ${nextMode} theme`"
    :title="`Theme: ${mode}`"
    class="inline-flex size-(--control-h) items-center justify-center border border-transparent text-muted-foreground transition-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
    @click="cycle"
  >
    <UiAppIcon :name="iconName" :size="1.125" />
  </button>
</template>

<script setup lang="ts">
  type ThemeMode = 'light' | 'dark';

  const { mode, setTheme } = useTheme();
  const order: ThemeMode[] = ['light', 'dark'];

  const nextMode = computed<ThemeMode>(() => {
    const idx = order.indexOf(mode.value as ThemeMode);
    return order[(idx + 1) % order.length];
  });

  const iconName = computed(() => {
    switch (mode.value) {
      case 'light':
        return 'icon-[solar--sun-linear]';
      default:
        return 'icon-[solar--moon-linear]';
    }
  });

  function cycle() {
    setTheme(nextMode.value);
  }
</script>
