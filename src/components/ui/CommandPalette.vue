<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[9995] flex items-start justify-center bg-background/80 px-4 pt-[12vh]"
      @mousedown.self="hide"
    >
      <div
        class="flex max-h-[70vh] w-full max-w-[40rem] flex-col overflow-hidden border border-primary/40 bg-popover font-mono"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <span aria-hidden="true" class="shrink-0 text-primary select-none">&gt;</span>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="run a command…"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search commands"
            class="min-w-0 flex-1 bg-transparent text-sm text-foreground caret-primary outline-none placeholder:text-muted-foreground"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="runActive"
            @keydown.esc.prevent="hide"
          />
          <kbd
            class="shrink-0 border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            ESC
          </kbd>
        </div>

        <div ref="listRef" class="min-h-0 flex-1 overflow-y-auto py-1">
          <template v-for="section in groups" :key="section.group">
            <p
              class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              {{ section.group }}
            </p>
            <button
              v-for="command in section.items"
              :key="command.id"
              :ref="(element) => registerRow(command.id, element)"
              type="button"
              role="option"
              :aria-selected="command.id === activeId"
              class="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-sm transition-none"
              :class="
                command.id === activeId
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent'
              "
              @mousemove="activeId = command.id"
              @click="execute(command)"
            >
              <UiAppIcon :name="command.icon" :size="0.9" class="shrink-0 opacity-70" />
              <span class="min-w-0 flex-1 truncate">{{ command.label }}</span>
              <kbd
                v-if="command.shortcut"
                class="shrink-0 border px-1.5 py-0.5 text-[10px]"
                :class="
                  command.id === activeId
                    ? 'border-primary-foreground/40'
                    : 'border-border text-muted-foreground'
                "
              >
                {{ command.shortcut }}
              </kbd>
            </button>
          </template>

          <p v-if="!groups.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
            no command matches “{{ query }}”
          </p>
        </div>

        <div
          class="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground"
        >
          <span>↑↓ move</span>
          <span>⏎ run</span>
          <span class="ms-auto">{{ matches.length }} of {{ commands.length }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import UiAppIcon from './AppIcon.vue';
  import { useCommandPalette, type Command } from '@/composables/useCommandPalette';

  const { open, query, commands, matches, groups, hide } = useCommandPalette();

  const inputRef = ref<HTMLInputElement | null>(null);
  const listRef = ref<HTMLElement | null>(null);
  const activeId = ref('');
  const rows = new Map<string, HTMLElement>();

  const registerRow = (id: string, element: unknown) => {
    if (element instanceof HTMLElement) rows.set(id, element);
    else rows.delete(id);
  };

  const move = (delta: number) => {
    const list = matches.value;
    if (!list.length) return;
    const from = list.findIndex((command) => command.id === activeId.value);
    const next = list[(Math.max(0, from) + delta + list.length) % list.length];
    activeId.value = next.id;
    void nextTick(() => rows.get(next.id)?.scrollIntoView({ block: 'nearest' }));
  };

  const execute = (command: Command) => {
    hide();
    command.run();
  };

  const runActive = () => {
    const command = matches.value.find((entry) => entry.id === activeId.value) ?? matches.value[0];
    if (command) execute(command);
  };

  // The first match is always the one Enter runs, so the highlight has to follow the filter.
  watch(matches, (list) => {
    if (!list.some((command) => command.id === activeId.value)) activeId.value = list[0]?.id ?? '';
  });

  watch(open, (visible) => {
    if (!visible) return;
    activeId.value = matches.value[0]?.id ?? '';
    void nextTick(() => inputRef.value?.focus());
  });
</script>
