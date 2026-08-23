<template>
  <div
    ref="containerRef"
    class="grid min-h-0 min-w-0 gap-3 lg:gap-0"
    :class="dragging ? 'select-none' : ''"
    :style="split ? gridStyle : undefined"
  >
    <slot name="a" />

    <div
      v-if="split"
      role="separator"
      tabindex="0"
      :aria-orientation="orientation"
      :aria-label="label"
      :aria-valuenow="Math.round(ratio)"
      :aria-valuemin="min"
      :aria-valuemax="max"
      class="group relative flex shrink-0 items-center justify-center bg-border/40 transition-none focus-visible:bg-primary focus-visible:outline-none"
      :class="[
        vertical ? 'h-1.5 cursor-row-resize' : 'w-1.5 cursor-col-resize',
        dragging ? 'bg-primary' : 'hover:bg-primary/60',
      ]"
      @pointerdown="onPointerDown"
      @keydown="onKeydown"
      @dblclick="reset"
    >
      <!-- The grip is the only part with contrast at rest, so the seam reads as draggable
           without drawing a heavy rule between two panels that already have borders. -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute bg-muted-foreground/50 group-hover:bg-primary-foreground"
        :class="vertical ? 'h-0.5 w-8' : 'h-8 w-0.5'"
      />
    </div>

    <slot name="b" />
  </div>
</template>

<script setup lang="ts">
  /**
   * Two panes and a divider you can drag, with the split remembered per key.
   *
   * Only splits from `lg` up. Below that the panes stack in source order and size themselves,
   * because a 6px drag target on a touch screen is a worse answer than a plain column.
   */
  const props = withDefaults(
    defineProps<{
      /** `horizontal` puts the panes side by side; `vertical` stacks them. */
      direction?: 'horizontal' | 'vertical';
      /** Where the split sits, as a percentage claimed by pane A. */
      initial?: number;
      min?: number;
      max?: number;
      /** localStorage suffix. Omit to leave the split unremembered. */
      storageKey?: string;
      label?: string;
      /** Pane A is hidden by the page, so pane B takes the whole width and the divider goes. */
      collapsed?: boolean;
    }>(),
    {
      direction: 'horizontal',
      initial: 50,
      min: 20,
      max: 80,
      storageKey: undefined,
      label: 'Resize panes',
      collapsed: false,
    },
  );

  const STEP = 2;
  const COARSE_STEP = 10;

  const { isDesktop } = useBreakpoint();

  const vertical = computed(() => props.direction === 'vertical');
  const orientation = computed(() => (vertical.value ? 'horizontal' : 'vertical'));

  const clamp = (value: number) => Math.min(props.max, Math.max(props.min, value));

  const stored = props.storageKey
    ? useStorage(`json-explorer:split:${props.storageKey}`, props.initial)
    : ref(props.initial);

  // Guards against a stored value left behind by an earlier min/max, which would otherwise
  // pin the divider outside the range the separator reports.
  const ratio = computed({
    get: () => clamp(stored.value),
    set: (value: number) => {
      stored.value = clamp(value);
    },
  });

  const containerRef = ref<HTMLElement | null>(null);
  const dragging = ref(false);

  const split = computed(() => isDesktop.value && !props.collapsed);

  const gridStyle = computed(() => {
    const track = `minmax(0, ${ratio.value}fr) auto minmax(0, ${100 - ratio.value}fr)`;
    return vertical.value ? { gridTemplateRows: track } : { gridTemplateColumns: track };
  });

  const ratioAt = (event: PointerEvent): number => {
    const bounds = containerRef.value?.getBoundingClientRect();
    if (!bounds) return ratio.value;
    const travelled = vertical.value ? event.clientY - bounds.top : event.clientX - bounds.left;
    const total = vertical.value ? bounds.height : bounds.width;
    return total > 0 ? (travelled / total) * 100 : ratio.value;
  };

  const onPointerMove = (event: PointerEvent) => {
    ratio.value = ratioAt(event);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    dragging.value = true;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!dragging.value) return;
    dragging.value = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  const reset = () => {
    ratio.value = props.initial;
  };

  const KEY_MOVES: Record<string, number> = {
    ArrowLeft: -1,
    ArrowUp: -1,
    ArrowRight: 1,
    ArrowDown: 1,
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Home') {
      ratio.value = props.min;
    } else if (event.key === 'End') {
      ratio.value = props.max;
    } else if (event.key === 'Enter' || event.key === ' ') {
      reset();
    } else {
      const move = KEY_MOVES[event.key];
      if (move === undefined) return;
      ratio.value += move * (event.shiftKey ? COARSE_STEP : STEP);
    }
    event.preventDefault();
  };

  // On the window, not the divider: pointer capture keeps move events coming, but a release
  // outside the viewport would otherwise never arrive and the divider would stay latched.
  useEventListener(window, 'pointermove', (event: PointerEvent) => {
    if (dragging.value) onPointerMove(event);
  });
  useEventListener(window, 'pointerup', onPointerUp);
  useEventListener(window, 'pointercancel', onPointerUp);
</script>
