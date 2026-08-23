<template>
  <span :class="$attrs.class">
    <!-- The animated glyphs are decorative; assistive tech reads the settled text instead of
         a stream of ones and zeroes. -->
    <span class="sr-only">{{ text }}</span>

    <span aria-hidden="true" class="inline-flex flex-wrap">
      <!-- v-text, not an interpolation: the formatter reflows `{{ }}` onto its own line,
           and Vue would then pad every 1ch cell with the surrounding whitespace. -->
      <span
        v-for="(letter, index) in letters"
        :key="index"
        v-text="letter.display"
        class="inline-block w-[1ch] text-center tabular-nums"
        :class="letter.scrambling ? 'text-primary' : ''"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
  /**
   * Ported from Matrix Text by @dorianbaffier (Kokonut UI, MIT) — 21st.dev.
   * https://github.com/kokonut-labs/kokonutui
   *
   * Four things changed on the way across:
   *  - The original never clears its timers, so unmounting mid-run leaves them firing against
   *    a dead component. Every handle is tracked and cleared here.
   *  - It hardcoded #00ff00 and a green text-shadow; this reads --color-primary so it follows
   *    the theme, and drops the glow, which does not belong in a hairline system.
   *  - It had no prefers-reduced-motion path. This one settles immediately instead.
   *  - Its aria-label described the animation rather than exposing the words, so the text was
   *    unreadable to a screen reader.
   */
  defineOptions({ inheritAttrs: false });

  const props = withDefaults(
    defineProps<{
      text: string;
      /** Wait before the first letter flips, so the section can settle first. */
      initialDelay?: number;
      /** How long a single letter spends scrambling. */
      letterDuration?: number;
      /** Gap between one letter starting and the next. */
      stagger?: number;
    }>(),
    { initialDelay: 250, letterDuration: 420, stagger: 45 },
  );

  const NBSP = ' ';

  interface Letter {
    display: string;
    scrambling: boolean;
  }

  const cell = (char: string, scrambling = false): Letter => ({
    display: char === ' ' ? NBSP : char,
    scrambling,
  });

  const settled = (): Letter[] => [...props.text].map((char) => cell(char));

  const letters = ref<Letter[]>(settled());

  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, delay: number) => {
    const handle = setTimeout(() => {
      timers.delete(handle);
      fn();
    }, delay);
    timers.add(handle);
  };

  const clearAll = () => {
    for (const handle of timers) clearTimeout(handle);
    timers.clear();
  };

  const scrambleOne = (index: number) => {
    const original = props.text[index];
    if (original === ' ') return;

    letters.value[index] = cell(Math.random() > 0.5 ? '1' : '0', true);
    later(() => {
      letters.value[index] = cell(original);
    }, props.letterDuration);
  };

  const run = () => {
    [...props.text].forEach((_, index) => later(() => scrambleOne(index), index * props.stagger));
  };

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    later(run, props.initialDelay);
  });

  onUnmounted(clearAll);

  watch(
    () => props.text,
    () => {
      clearAll();
      letters.value = settled();
    },
  );
</script>
