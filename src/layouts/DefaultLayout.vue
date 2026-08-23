<template>
  <div class="flex min-h-screen flex-col bg-background">
    <a
      href="#main"
      class="focus: sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
    >
      Skip to content
    </a>

    <header class="sticky top-0 z-30 border-b border-border bg-card">
      <div class="mx-auto flex h-(--header-h) w-full max-w-[1400px] items-center gap-3 px-3">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2">
          <span class="flex size-8 items-center justify-center bg-primary text-primary-foreground">
            <UiAppIcon name="icon-[solar--code-square-linear]" :size="1.125" />
          </span>
          <span class="text-sm font-semibold text-foreground sm:text-base">{{ appName }}</span>
        </RouterLink>

        <nav class="ms-3 hidden items-stretch self-stretch md:flex">
          <RouterLink
            v-for="tool in TOOLS"
            :key="tool.path"
            :to="tool.path"
            class="flex h-(--header-h) items-center gap-1.5 border-b-2 px-3 font-mono text-xs tracking-tight transition-none"
            :class="
              isActive(tool.path)
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
            "
          >
            <UiAppIcon :name="tool.icon" :size="0.95" />
            {{ tool.label }}
          </RouterLink>
        </nav>

        <div class="ms-auto flex items-center gap-1">
          <button
            type="button"
            class="me-1 hidden items-center gap-2 border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-none hover:border-primary/50 hover:text-foreground sm:flex"
            @click="palette.show()"
          >
            <UiAppIcon name="icon-[solar--magnifer-linear]" :size="0.85" />
            <span>run a command</span>
            <kbd class="border border-border px-1 py-0.5 text-[10px]">^K</kbd>
          </button>
          <div ref="shortcutsRef" class="relative">
            <UiAppButton
              icon="icon-[solar--keyboard-linear]"
              icon-only
              tooltip="Keyboard shortcuts"
              @click="showShortcuts = !showShortcuts"
            />
            <div
              v-if="showShortcuts"
              class="absolute end-0 z-40 mt-2 w-64 border border-border bg-popover p-3"
            >
              <p class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Shortcuts
              </p>
              <ul class="space-y-1.5 text-xs text-muted-foreground">
                <li v-for="item in SHORTCUTS" :key="item.keys" class="flex items-center gap-2">
                  <kbd
                    class="border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {{ item.keys }}
                  </kbd>
                  <span>{{ item.label }}</span>
                </li>
              </ul>
            </div>
          </div>
          <UiSettingsMenu />
          <UiThemeToggle />
        </div>
      </div>

      <nav class="flex overflow-x-auto border-t border-border md:hidden">
        <RouterLink
          v-for="tool in TOOLS"
          :key="tool.path"
          :to="tool.path"
          class="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-[11px] transition-none"
          :class="
            isActive(tool.path)
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
          "
        >
          <UiAppIcon :name="tool.icon" :size="0.9" />
          {{ tool.label }}
        </RouterLink>
      </nav>
    </header>

    <main id="main" class="mx-auto w-full max-w-[1400px] flex-1 px-3 py-3">
      <slot />
    </main>

    <UiCommandPalette />

    <footer class="sticky bottom-0 z-20 border-t border-border bg-card">
      <div
        class="mx-auto flex w-full max-w-[1400px] items-center gap-3 overflow-x-auto px-3 py-1 font-mono text-[11px] whitespace-nowrap text-muted-foreground"
      >
        <span v-if="onLanding" class="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <span class="text-primary" aria-hidden="true">▊</span>
          json-explorer
        </span>
        <span
          v-else
          class="flex shrink-0 items-center gap-1.5"
          :class="status.tone"
          :title="store.error?.message"
        >
          <span aria-hidden="true">{{ status.glyph }}</span>
          {{ status.label }}
        </span>

        <template v-if="store.stats && !onLanding">
          <span class="text-border" aria-hidden="true">│</span>
          <span class="shrink-0 tabular-nums">{{ nodeLabel }} nodes</span>
          <span class="text-border" aria-hidden="true">│</span>
          <span class="shrink-0 tabular-nums">{{ formatBytes(store.stats.bytes) }}</span>
          <span class="text-border" aria-hidden="true">│</span>
          <span class="shrink-0 tabular-nums">depth {{ store.stats.depth }}</span>
        </template>

        <span class="ms-auto flex shrink-0 items-center gap-1.5">
          <UiAppIcon name="icon-[solar--shield-check-linear]" :size="0.8" />
          local only
        </span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
  import { useCommandPalette, type Command } from '@/composables/useCommandPalette';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { usePreferences } from '@/composables/usePreferences';
  import { useTheme } from '@/composables/useTheme';
  import { formatBytes } from '@/lib/json';

  const { appName } = useAppConfig();
  const route = useRoute();
  const router = useRouter();

  // The layout already owns the workspace shortcuts, so the palette reuses those actions
  // rather than re-implementing them. `shortcuts: false` keeps it from binding a second copy
  // of Ctrl+O/S/B/M on top of whatever the current page registered.
  const workspace = useJsonWorkspace({ shortcuts: false });
  const { store } = workspace;
  const { toggleTheme, isDark } = useTheme();
  const { sampleData } = usePreferences();
  const palette = useCommandPalette();

  const navigation: Command[] = TOOLS.map((tool, position) => ({
    id: `go:${tool.path}`,
    label: tool.label,
    group: 'Go to',
    icon: tool.icon,
    keywords: tool.description,
    shortcut: `Alt ${position + 1}`,
    run: () => router.push(tool.path),
  }));

  const transform = (
    id: string,
    label: string,
    icon: string,
    op: Parameters<typeof workspace.run>[0],
    shortcut?: string,
  ): Command => ({
    id,
    label,
    group: 'Transform',
    icon,
    shortcut,
    available: () => !store.isEmpty,
    run: () => workspace.run(op),
  });

  palette.register([
    ...navigation,
    {
      id: 'doc:open',
      label: 'Open a file',
      group: 'Document',
      icon: 'icon-[solar--upload-minimalistic-linear]',
      shortcut: 'Ctrl O',
      run: workspace.open,
    },
    {
      id: 'doc:save',
      label: 'Download JSON',
      group: 'Document',
      icon: 'icon-[solar--download-minimalistic-linear]',
      shortcut: 'Ctrl S',
      available: () => !store.isEmpty,
      run: workspace.save,
    },
    {
      id: 'doc:copy',
      label: 'Copy document',
      group: 'Document',
      icon: 'icon-[solar--copy-linear]',
      available: () => !store.isEmpty,
      run: workspace.copyAll,
    },
    {
      id: 'doc:sample',
      label: 'Load the sample document',
      group: 'Document',
      icon: 'icon-[solar--document-add-linear]',
      available: () => sampleData.value,
      run: store.loadSample,
    },
    {
      id: 'doc:clear',
      label: 'Clear the workspace',
      group: 'Document',
      icon: 'icon-[solar--trash-bin-minimalistic-linear]',
      available: () => !store.isEmpty,
      run: store.clear,
    },
    {
      id: 'doc:undo',
      label: 'Undo the last change',
      group: 'Document',
      icon: 'icon-[solar--undo-left-linear]',
      available: () => store.canUndo,
      run: store.undo,
    },
    transform(
      'tx:beautify',
      'Beautify',
      'icon-[solar--magic-stick-3-linear]',
      'beautify',
      'Ctrl B',
    ),
    transform('tx:minify', 'Minify', 'icon-[solar--minimize-square-linear]', 'minify', 'Ctrl M'),
    transform(
      'tx:sortAsc',
      'Sort keys A→Z',
      'icon-[solar--sort-from-top-to-bottom-linear]',
      'sortAsc',
    ),
    transform(
      'tx:sortDesc',
      'Sort keys Z→A',
      'icon-[solar--sort-from-bottom-to-top-linear]',
      'sortDesc',
    ),
    transform(
      'tx:removeEmpty',
      'Remove empty values',
      'icon-[solar--eraser-linear]',
      'removeEmpty',
    ),
    transform('tx:repair', 'Repair malformed JSON', 'icon-[solar--health-linear]', 'repair'),
    transform(
      'tx:escape',
      'Escape to a JSON string',
      'icon-[solar--quote-up-square-linear]',
      'escape',
    ),
    transform(
      'tx:unescape',
      'Unescape a JSON string',
      'icon-[solar--quote-down-square-linear]',
      'unescape',
    ),
    {
      id: 'ui:theme',
      label: 'Toggle light / dark',
      group: 'Appearance',
      icon: 'icon-[solar--moon-linear]',
      keywords: 'theme colour scheme',
      run: toggleTheme,
    },
    {
      id: 'ui:sample',
      label: 'Toggle the sample document',
      group: 'Appearance',
      icon: 'icon-[solar--document-add-linear]',
      keywords: 'settings preference demo',
      run: () => {
        sampleData.value = !sampleData.value;
      },
    },
  ]);

  const shortcutsRef = ref<HTMLElement | null>(null);
  const showShortcuts = ref(false);

  onClickOutside(shortcutsRef, () => {
    showShortcuts.value = false;
  });

  const SHORTCUTS = [
    { keys: 'Ctrl K', label: 'Command palette' },
    { keys: 'Alt 1–5', label: 'Jump to a tool' },
    { keys: 'Ctrl O', label: 'Open a file' },
    { keys: 'Ctrl S', label: 'Download JSON' },
    { keys: 'Ctrl B', label: 'Beautify' },
    { keys: 'Ctrl M', label: 'Minify' },
    { keys: '/', label: 'Search the tree' },
  ];

  const status = computed(() => {
    if (store.scanning) return { glyph: '◐', label: 'indexing', tone: 'text-info' };
    if (store.isEmpty) return { glyph: '○', label: 'empty', tone: 'text-muted-foreground' };
    if (store.isValid) return { glyph: '●', label: 'valid', tone: 'text-success' };
    return { glyph: '✕', label: 'invalid', tone: 'text-error' };
  });

  const nodeLabel = computed(() => (store.stats?.totalNodes ?? 0).toLocaleString('en-US'));

  // The landing page has no document, so a status of "empty" would read as a fault rather
  // than a fact.
  const onLanding = computed(() => route.path === '/');

  const isActive = (path: string) => route.path.startsWith(path);

  useKeyboard({
    'ctrl+k': () => {
      palette.toggle();
      return true;
    },
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
