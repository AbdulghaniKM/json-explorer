<template>
  <div class="flex min-h-screen flex-col bg-background">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
    >
      Skip to content
    </a>

    <header class="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-xl">
      <div class="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
            <UiAppIcon name="icon-[solar--code-square-linear]" :size="1.125" />
          </span>
          <span class="text-sm font-semibold text-text sm:text-base">{{ appName }}</span>
        </RouterLink>

        <nav class="ms-2 hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="tool in TOOLS"
            :key="tool.path"
            :to="tool.path"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              isActive(tool.path)
                ? 'bg-primary/10 text-primary'
                : 'text-text-muted hover:bg-muted hover:text-text'
            "
          >
            <UiAppIcon :name="tool.icon" :size="0.95" />
            {{ tool.label }}
          </RouterLink>
        </nav>

        <div class="ms-auto flex items-center gap-1">
          <div ref="shortcutsRef" class="relative">
            <UiAppButton
              icon="icon-[solar--keyboard-linear]"
              icon-only
              tooltip="Keyboard shortcuts"
              @click="showShortcuts = !showShortcuts"
            />
            <div
              v-if="showShortcuts"
              class="absolute end-0 z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg"
            >
              <p class="mb-2 text-xs font-semibold tracking-wider text-text-muted uppercase">
                Shortcuts
              </p>
              <ul class="space-y-1.5 text-xs text-text-muted">
                <li v-for="item in SHORTCUTS" :key="item.keys" class="flex items-center gap-2">
                  <kbd
                    class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-text"
                  >
                    {{ item.keys }}
                  </kbd>
                  <span>{{ item.label }}</span>
                </li>
              </ul>
            </div>
          </div>
          <UiThemeToggle />
        </div>
      </div>

      <nav class="flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-1.5 md:hidden">
        <RouterLink
          v-for="tool in TOOLS"
          :key="tool.path"
          :to="tool.path"
          class="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
          :class="
            isActive(tool.path)
              ? 'bg-primary/10 text-primary'
              : 'text-text-muted hover:bg-muted hover:text-text'
          "
        >
          <UiAppIcon :name="tool.icon" :size="0.9" />
          {{ tool.label }}
        </RouterLink>
      </nav>
    </header>

    <main id="main" class="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4">
      <slot />
    </main>

    <footer class="border-t border-border/60 px-4 py-4">
      <div
        class="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 text-xs text-text-muted"
      >
        <span class="flex items-center gap-1.5">
          <UiAppIcon name="icon-[solar--shield-check-linear]" :size="0.9" />
          Everything runs in your browser. Nothing is uploaded.
        </span>
        <span>Vue 3 · Tailwind v4 · TypeScript</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
  const { appName } = useAppConfig();
  const route = useRoute();
  const router = useRouter();

  const shortcutsRef = ref<HTMLElement | null>(null);
  const showShortcuts = ref(false);

  onClickOutside(shortcutsRef, () => {
    showShortcuts.value = false;
  });

  const SHORTCUTS = [
    { keys: 'Alt 1–5', label: 'Switch tool' },
    { keys: 'Ctrl O', label: 'Open a file' },
    { keys: 'Ctrl S', label: 'Download JSON' },
    { keys: 'Ctrl B', label: 'Beautify' },
    { keys: 'Ctrl M', label: 'Minify' },
    { keys: '/', label: 'Search the tree' },
  ];

  const isActive = (path: string) =>
    path === '/' ? route.path === '/' : route.path.startsWith(path);

  useKeyboard({
    'alt+1': () => {
      router.push(TOOLS[0].path);
      return true;
    },
    'alt+2': () => {
      router.push(TOOLS[1].path);
      return true;
    },
    'alt+3': () => {
      router.push(TOOLS[2].path);
      return true;
    },
    'alt+4': () => {
      router.push(TOOLS[3].path);
      return true;
    },
    'alt+5': () => {
      router.push(TOOLS[4].path);
      return true;
    },
  });

  watch(
    () => route.path,
    () => {
      showShortcuts.value = false;
    },
  );
</script>
