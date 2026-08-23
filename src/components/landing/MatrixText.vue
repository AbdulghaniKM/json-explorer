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

  const noise = (): string => (Math.random() > 0.5 ? '1' : '0');

  const scrambled = (): Letter[] =>
    [...props.text].map((char) => (char === ' ' ? cell(char) : cell(noise(), true)));

  // Decided during setup, not on mount: initialising to the settled text would paint the real
  // headline for one frame, scramble it, and decode it back — showing the answer before the
  // effect that reveals it.
  const stillTyped =
    typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const letters = ref<Letter[]>(stillTyped ? settled() : scrambled());

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
    if (flicker) clearInterval(flicker);
    flicker = null;
  };

  /** Keeps the not-yet-decoded letters flickering so the reveal has something to reveal. */
  let flicker: ReturnType<typeof setInterval> | null = null;

  const run = () => {
    flicker = setInterval(() => {
      letters.value = letters.value.map((letter) =>
        letter.scrambling ? cell(noise(), true) : letter,
      );
    }, 60);

    [...props.text].forEach((char, index) => {
      if (char === ' ') return;
      later(
        () => {
          letters.value[index] = cell(char);
          if (index === props.text.length - 1 && flicker) {
            clearInterval(flicker);
            flicker = null;
          }
        },
        index * props.stagger + props.letterDuration,
      );
    });

    // The last character may be a space, which never gets a settle timer of its own.
    later(
      () => {
        if (!flicker) return;
        clearInterval(flicker);
        flicker = null;
        letters.value = settled();
      },
      props.text.length * props.stagger + props.letterDuration + 80,
    );
  };

  onMounted(() => {
    if (stillTyped) return;
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
