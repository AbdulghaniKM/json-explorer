import { onMounted, onUnmounted, ref } from 'vue';
import { DENSITY } from '@/config/density';

/**
 * The width of one character in the code font, in CSS pixels.
 *
 * Measured rather than assumed. Two callers depend on it and both break silently if it is
 * wrong: the wrap column (how many characters fit a row before it has to break) and the
 * read-only viewer's indent guides, which have to sit on the same grid the glyphs do. The
 * `ch` unit looks like the obvious answer but resolves against whatever font and size the
 * element itself inherited — a guide outside the `<pre>` measures a different character than
 * the code it is meant to line up with.
 *
 * Re-measured once the webfont finishes loading: until then the fallback metrics differ, and
 * a viewer laid out against them keeps that stale grid for the rest of the session.
 */
export const useCharWidth = () => {
  const charWidth = ref(DENSITY.codeFontSize * 0.6);

  const measure = () => {
    if (typeof document === 'undefined') return;

    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(SAMPLE);
    probe.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;top:-9999px';
    probe.style.fontFamily = 'var(--font-mono)';
    probe.style.fontSize = `${DENSITY.codeFontSize}px`;

    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width / SAMPLE;
    probe.remove();

    if (width > 0) charWidth.value = width;
  };

  onMounted(() => {
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
  });

  onUnmounted(() => window.removeEventListener('resize', measure));

  return { charWidth, measure };
};

/** Enough characters that sub-pixel rounding on any one of them washes out. */
const SAMPLE = 100;
