<template>
  <div class="flex flex-col gap-3" :style="{ '--panel-h': panelHeight }">
    <!-- Bleeds into main's px-3 so nothing shows past its edges while content scrolls under.
         z-20 sits below the header (z-30) and above the panels. Only pinned from `md`: on a
         phone it wraps to three rows, and parking that under an already two-row header would
         cost more of the screen than reaching the buttons is worth. -->
    <div
      ref="toolbarRef"
      class="z-20 -mx-3 flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 md:sticky md:top-(--header-h)"
    >
      <slot name="toolbar" />
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
  /**
   * The shell every tool page sits in: a toolbar that stays put and reachable while the page
   * scrolls, and a `--panel-h` underneath it that already accounts for the room it takes.
   *
   * The height is measured rather than assumed because the toolbar wraps to two or three rows
   * on a narrow window, and a panel sized against the one-row case would push the page into a
   * scroll that the sticky toolbar is meant to make unnecessary.
   */
  const toolbarRef = ref<HTMLElement | null>(null);
  const toolbarHeight = ref(0);

  useResizeObserver(toolbarRef, ([entry]) => {
    toolbarHeight.value = Math.round(
      entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height,
    );
  });

  /**
   * Redeclared here rather than fed into the :root formula: a custom property resolves its
   * var()s on the element that declares it, so a --panel-h computed on :root would keep the
   * zero it saw there however tall this toolbar turns out to be. Mirrors style.css.
   *
   * The trailing 0.75rem is this element's own `gap-3`, which sits between the toolbar and
   * the panels and is the one piece of chrome --chrome-h does not already count.
   */
  const panelHeight = computed(
    () => `calc(100svh - var(--header-h) - var(--chrome-h) - ${toolbarHeight.value}px - 0.75rem)`,
  );
</script>
