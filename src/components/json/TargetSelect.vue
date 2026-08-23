<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      class="flex h-9 w-56 items-center gap-2 border border-border bg-card px-2.5 text-start text-sm transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="flex size-6 shrink-0 items-center justify-center bg-primary/10">
        <UiAppIcon :name="selected.icon" :size="0.9" class="text-primary" />
      </span>
      <span class="min-w-0 flex-1 truncate font-medium text-foreground">{{ selected.label }}</span>
      <UiAppIcon
        name="icon-[solar--alt-arrow-down-linear]"
        :size="0.85"
        class="shrink-0 text-muted-foreground transition-transform"
        :class="open && 'rotate-180'"
      />
    </button>

    <div
      v-if="open"
      role="listbox"
      aria-label="Conversion target"
      class="absolute start-0 z-40 mt-2 w-[19rem] overflow-hidden border border-border bg-popover py-1"
      @keydown="onListKeydown"
    >
      <template v-for="group in CONVERT_GROUPS" :key="group">
        <p
          class="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          {{ group }}
        </p>
        <button
          v-for="option in targetsIn(group)"
          :key="option.id"
          :ref="(element) => registerOption(option.id, element)"
          type="button"
          role="option"
          :aria-selected="option.id === modelValue"
          class="flex w-full items-start gap-2.5 px-3 py-2 text-start transition-colors focus-visible:outline-none"
          :class="
            option.id === highlighted
              ? 'bg-primary/10'
              : option.id === modelValue
                ? 'bg-muted/60'
                : 'hover:bg-muted'
          "
          @click="choose(option.id)"
          @mousemove="highlighted = option.id"
        >
          <UiAppIcon
            :name="option.icon"
            :size="0.95"
            class="mt-0.5 shrink-0"
            :class="option.id === modelValue ? 'text-primary' : 'text-muted-foreground'"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-foreground">{{ option.label }}</span>
            <span class="block text-[11px] leading-snug text-muted-foreground">
              {{ option.summary }}
            </span>
          </span>
          <UiAppIcon
            v-if="option.id === modelValue"
            name="icon-[solar--check-circle-bold]"
            :size="0.95"
            class="mt-0.5 shrink-0 text-primary"
          />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ConvertTarget } from '@/lib/json';
  import { CONVERT_GROUPS, CONVERT_TARGETS, type ConvertGroup } from '@/config/convert';

  const props = defineProps<{ modelValue: ConvertTarget }>();
  const emit = defineEmits<{ 'update:modelValue': [ConvertTarget] }>();

  const rootRef = ref<HTMLElement | null>(null);
  const open = ref(false);
  const highlighted = ref<ConvertTarget>(props.modelValue);
  const optionElements = new Map<ConvertTarget, HTMLElement>();

  const selected = computed(
    () => CONVERT_TARGETS.find((target) => target.id === props.modelValue) ?? CONVERT_TARGETS[0],
  );

  const targetsIn = (group: ConvertGroup) =>
    CONVERT_TARGETS.filter((target) => target.group === group);

  const registerOption = (id: ConvertTarget, element: unknown) => {
    if (element instanceof HTMLElement) optionElements.set(id, element);
    else optionElements.delete(id);
  };

  const focusHighlighted = () => {
    void nextTick(() => optionElements.get(highlighted.value)?.focus());
  };

  const close = () => {
    open.value = false;
  };

  const toggle = () => {
    open.value = !open.value;
    if (!open.value) return;
    highlighted.value = props.modelValue;
    focusHighlighted();
  };

  const choose = (id: ConvertTarget) => {
    emit('update:modelValue', id);
    close();
  };

  const step = (delta: number) => {
    const ids = CONVERT_TARGETS.map((target) => target.id);
    const from = ids.indexOf(highlighted.value);
    highlighted.value = ids[(from + delta + ids.length) % ids.length];
    focusHighlighted();
  };

  const onTriggerKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!open.value) toggle();
    else step(event.key === 'ArrowDown' ? 1 : -1);
  };

  const onListKeydown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(highlighted.value);
      return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') close();
  };

  onClickOutside(rootRef, close);
</script>
