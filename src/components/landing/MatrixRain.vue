<template>
  <canvas
    ref="canvasRef"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 h-full w-full"
  />
</template>

<script setup lang="ts">
  /**
   * Phosphor rain behind the hero. Three things keep it from being a battery tax:
   * it stops when scrolled out of view or the tab is hidden, it repaints on a fixed ~16 fps
   * budget rather than every frame, and it never starts at all under prefers-reduced-motion.
   */
  const props = withDefaults(defineProps<{ glyphSize?: number; opacity?: number }>(), {
    glyphSize: 14,
    opacity: 0.5,
  });

  // Katakana is the canonical Matrix glyph set; the braces and brackets are ours.
  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789{}[]",:.';
  const FRAME_MS = 60;
  const TRAIL_FADE = 0.06;

  const canvasRef = ref<HTMLCanvasElement | null>(null);

  let context: CanvasRenderingContext2D | null = null;
  let columns: number[] = [];
  let frame = 0;
  let lastPaint = 0;
  let running = false;
  let ratio = 1;

  const readColor = (name: string, fallback: string) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  const resize = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);

    const count = Math.ceil(width / props.glyphSize);
    // Seed above the fold so the first frame is already mid-storm rather than a clean sweep.
    columns = Array.from({ length: count }, () => Math.random() * -height);
  };

  const paint = (timestamp: number) => {
    if (!running) return;
    frame = requestAnimationFrame(paint);
    if (timestamp - lastPaint < FRAME_MS) return;
    lastPaint = timestamp;

    const canvas = canvasRef.value;
    if (!context || !canvas) return;

    const width = canvas.width / ratio;
    const height = canvas.height / ratio;

    // Painting a translucent slab of the page colour is what leaves the trails.
    context.fillStyle = readColor('--color-background', '#111113');
    context.globalAlpha = TRAIL_FADE;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = props.opacity;
    context.fillStyle = readColor('--color-primary', '#00e05c');
    context.font = `${props.glyphSize}px ${readColor('--font-mono', 'monospace')}`;
    context.textBaseline = 'top';

    columns.forEach((y, column) => {
      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      context?.fillText(glyph, column * props.glyphSize, y);
      columns[column] = y > height && Math.random() > 0.975 ? 0 : y + props.glyphSize;
    });
  };

  const start = () => {
    if (running) return;
    running = true;
    lastPaint = 0;
    frame = requestAnimationFrame(paint);
  };

  const stop = () => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const onVisibility = () => (document.hidden ? stop() : start());

  let observer: IntersectionObserver | null = null;
  let motionQuery: MediaQueryList | null = null;

  const sync = () => {
    if (motionQuery?.matches) stop();
    else start();
  };

  onMounted(() => {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    resize();
    if (motionQuery.matches) return;

    observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) start();
      else stop();
    });
    if (canvasRef.value) observer.observe(canvasRef.value);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', resize);
    motionQuery.addEventListener('change', sync);
  });

  onUnmounted(() => {
    stop();
    observer?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    motionQuery?.removeEventListener('change', sync);
  });
</script>
