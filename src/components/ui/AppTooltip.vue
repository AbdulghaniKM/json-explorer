<template>
  <div
    ref="triggerRef"
    class="group relative inline-flex"
    :aria-describedby="content && show ? tipId : undefined"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onLeave"
  >
    <slot />
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <span
        v-if="content && show"
        :id="tipId"
        ref="tipRef"
        role="tooltip"
        class="pointer-events-none fixed z-[9990] max-w-xs rounded-lg px-3 py-1.5 text-xs leading-snug font-medium whitespace-normal shadow-lg"
        :class="themeClass"
        :style="{ left: `${tip.left}px`, top: `${tip.top}px` }"
      >
        {{ content }}
        <span class="absolute size-2" :class="[arrowClass, arrowEdgeClass]" :style="arrowStyle" />
      </span>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, nextTick, ref, useId, watch } from 'vue';
  import { useBreakpoint } from '@/composables/useBreakpoint';

  type Side = 'top' | 'bottom' | 'left' | 'right';

  interface Props {
    content?: string;
    placement?: 'top' | 'bottom' | 'start' | 'end';
    dark?: boolean;
    delay?: number;
    disableOnMobile?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    content: '',
    placement: 'top',
    dark: true,
    delay: 200,
    disableOnMobile: false,
  });

  const GAP = 8;
  const EDGE = 8;

  const OPPOSITE: Record<Side, Side> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };

  const { isMobile } = useBreakpoint();
  const show = ref(false);
  const tipId = useId();
  const triggerRef = ref<HTMLElement | null>(null);
  const tipRef = ref<HTMLElement | null>(null);
  const tip = ref({ side: 'top' as Side, left: 0, top: 0, arrowX: 0, arrowY: 0 });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

  const inlineSide = (towardStart: boolean): Side => {
    const rightToLeft = getComputedStyle(document.documentElement).direction === 'rtl';
    return towardStart === rightToLeft ? 'right' : 'left';
  };

  const preferredSide = (): Side =>
    props.placement === 'start' || props.placement === 'end'
      ? inlineSide(props.placement === 'start')
      : props.placement;

  const fits = (side: Side, anchor: DOMRect, box: DOMRect) => {
    if (side === 'top') return anchor.top - box.height - GAP >= EDGE;
    if (side === 'bottom') return anchor.bottom + box.height + GAP <= window.innerHeight - EDGE;
    if (side === 'left') return anchor.left - box.width - GAP >= EDGE;
    return anchor.right + box.width + GAP <= window.innerWidth - EDGE;
  };

  const chooseSide = (anchor: DOMRect, box: DOMRect): Side => {
    const wanted = preferredSide();
    if (fits(wanted, anchor, box)) return wanted;
    return fits(OPPOSITE[wanted], anchor, box) ? OPPOSITE[wanted] : wanted;
  };

  const coordsFor = (side: Side, anchor: DOMRect, box: DOMRect) => {
    const stacked = side === 'top' || side === 'bottom';
    const centerX = anchor.left + anchor.width / 2;
    const centerY = anchor.top + anchor.height / 2;

    const left = stacked
      ? clamp(centerX - box.width / 2, EDGE, window.innerWidth - box.width - EDGE)
      : side === 'left'
        ? anchor.left - box.width - GAP
        : anchor.right + GAP;

    const top = stacked
      ? side === 'top'
        ? anchor.top - box.height - GAP
        : anchor.bottom + GAP
      : clamp(centerY - box.height / 2, EDGE, window.innerHeight - box.height - EDGE);

    return {
      left,
      top,
      arrowX: clamp(centerX - left, EDGE, box.width - EDGE),
      arrowY: clamp(centerY - top, EDGE, box.height - EDGE),
    };
  };

  const place = () => {
    const trigger = triggerRef.value;
    const element = tipRef.value;
    if (!trigger || !element) return;

    const anchor = trigger.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const side = chooseSide(anchor, box);
    tip.value = { side, ...coordsFor(side, anchor, box) };
  };

  function onEnter() {
    if (props.disableOnMobile && isMobile.value) return;
    timeoutId = setTimeout(() => {
      show.value = true;
    }, props.delay);
  }

  function onLeave() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    show.value = false;
  }

  const trackViewport = (listen: boolean) => {
    const method = listen ? 'addEventListener' : 'removeEventListener';
    window[method]('scroll', place, true);
    window[method]('resize', place);
  };

  watch(show, async (visible) => {
    trackViewport(visible);
    if (!visible) return;
    await nextTick();
    place();
  });

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId);
    trackViewport(false);
  });

  const themeClass = computed(() =>
    props.dark
      ? 'bg-text text-surface ring-1 ring-surface/10'
      : 'bg-surface text-text border border-border shadow-md',
  );

  const arrowClass = computed(() => (props.dark ? 'bg-text' : 'bg-surface border border-border'));

  const arrowEdgeClass = computed(
    () =>
      ({
        top: 'border-t-0 border-s-0',
        bottom: 'border-b-0 border-e-0',
        left: 'border-b-0 border-s-0',
        right: 'border-t-0 border-e-0',
      })[tip.value.side],
  );

  const arrowStyle = computed(() => {
    const { side, arrowX, arrowY } = tip.value;
    const stacked = side === 'top' || side === 'bottom';
    const transform = `${stacked ? 'translateX(-50%)' : 'translateY(-50%)'} rotate(45deg)`;

    if (side === 'top') return { bottom: '-0.25rem', left: `${arrowX}px`, transform };
    if (side === 'bottom') return { top: '-0.25rem', left: `${arrowX}px`, transform };
    if (side === 'left') return { right: '-0.25rem', top: `${arrowY}px`, transform };
    return { left: '-0.25rem', top: `${arrowY}px`, transform };
  });
</script>
