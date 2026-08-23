<template>
  <div :style="{ height: `${height}rem` }">
    <ApexChart
      :key="`${theme}-${type}`"
      :type="type"
      height="100%"
      width="100%"
      :options="options"
      :series="series"
    />
  </div>
</template>

<script setup lang="ts">
  import type { ApexOptions } from 'apexcharts';
  import { SERIES_FILL } from '@/config/charts';
  import { useTheme } from '@/composables/useTheme';

  // Charting only the analyze page needs, so it stays out of the entry chunk — and only the
  // renderers this app draws with are registered, not every ApexCharts type.
  const ApexChart = defineAsyncComponent(async () => {
    const [component] = await Promise.all([
      import('vue3-apexcharts/core'),
      import('apexcharts/bar'),
      import('apexcharts/area'),
    ]);
    return component.default;
  });

  const props = withDefaults(
    defineProps<{
      type: 'bar' | 'area';
      series: Array<{ name: string; data: number[] }>;
      /** Category labels, in the same order as the single series. */
      categories: string[];
      /** Chart body height in rem, so it scales with the root font size. */
      height?: number;
      horizontal?: boolean;
      /** Lays the series end to end in one bar — a part-to-whole strip. */
      stacked?: boolean;
      /** One fill per series. Omit for the single-hue magnitude default. */
      fills?: string[];
      /** Turns a raw value into the text shown on the mark and in the tooltip. */
      formatter?: (value: number) => string;
    }>(),
    {
      height: 13,
      horizontal: false,
      stacked: false,
      fills: undefined,
      formatter: (value: number) => value.toLocaleString('en-US'),
    },
  );

  const { theme, colors } = useTheme();

  const fills = computed(() => props.fills ?? [SERIES_FILL[theme.value]]);

  // Bar-end labels are drawn outside the mark, so the scale needs headroom or the widest
  // bar pushes its own label past the plot edge. A stack already fills its track.
  const axisMax = computed(() => {
    if (props.stacked) return undefined;
    const peak = Math.max(0, ...props.series.flatMap((entry) => entry.data));
    return peak > 0 ? peak * 1.22 : undefined;
  });

  /** Only a lone horizontal bar has room to carry a value at its end. */
  const showValueLabels = computed(() => props.horizontal && !props.stacked);

  // Several fills across a single series can only mean one fill per category — an ordinal
  // ramp. ApexCharts keys `colors` by series unless the bars are distributed.
  const distributed = computed(() => fills.value.length > 1 && props.series.length === 1);

  /** Series names reach the tooltip as markup, and this component does not choose them. */
  const escapeHtml = (value: string): string =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
    );

  interface TooltipContext {
    seriesIndex: number;
    dataPointIndex: number;
    w: { globals: { series: number[][]; seriesNames: string[]; colors: string[] } };
  }

  /**
   * The hovered segment, with its share of the row — the number a part-to-whole strip is read
   * for, and the one thing the bar's length alone cannot be measured off by eye.
   */
  const segmentTooltip = ({ seriesIndex, dataPointIndex, w }: TooltipContext): string => {
    const value = w.globals.series[seriesIndex]?.[dataPointIndex] ?? 0;
    const total = w.globals.series.reduce((sum, row) => sum + (row[dataPointIndex] ?? 0), 0);
    const share = total > 0 ? Math.round((value / total) * 100) : 0;
    const name = escapeHtml(w.globals.seriesNames[seriesIndex] ?? '');
    const swatch = escapeHtml(w.globals.colors[seriesIndex] ?? 'currentColor');

    return `<div class="flex items-center gap-2 px-2 py-1 font-mono text-[11px]">
      <span class="size-2 shrink-0" style="background:${swatch}"></span>
      <span class="capitalize">${name}</span>
      <span class="tabular-nums">${escapeHtml(props.formatter(value))}</span>
      <span class="text-muted-foreground tabular-nums">${share}%</span>
    </div>`;
  };

  const options = computed<ApexOptions>(() => ({
    chart: {
      type: props.type,
      stacked: props.stacked,
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      fontFamily: 'inherit',
      parentHeightOffset: 0,
      animations: { enabled: true, speed: 240 },
    },
    theme: { mode: theme.value },
    colors: fills.value,
    plotOptions: {
      bar: {
        horizontal: props.horizontal,
        distributed: distributed.value,
        borderRadius: 0,
        borderRadiusApplication: 'end',
        barHeight: props.stacked ? '100%' : '62%',
        columnWidth: '58%',
        dataLabels: { position: 'top' },
      },
    },
    // A 2px surface gap between stacked segments, so touching fills stay countable.
    // `straight`, never `smooth`: the categories are discrete buckets, and a spline would
    // draw values between them that the document does not contain.
    stroke: props.stacked
      ? { show: true, width: 2, colors: [colors.value.card] }
      : { show: props.type === 'area', width: 2, curve: 'straight' },
    // ApexCharts paints bar fills at 0.85 over the surface and ignores `fill.opacity`, so the
    // palettes in config/charts.ts are pre-compensated for that blend rather than fought here.
    fill:
      props.type === 'area'
        ? {
            type: 'gradient',
            gradient: { shadeIntensity: 0, opacityFrom: 0.32, opacityTo: 0.04, stops: [0, 100] },
          }
        : { type: 'solid' },
    dataLabels: {
      enabled: showValueLabels.value,
      textAnchor: 'start',
      offsetX: 8,
      formatter: (value) => props.formatter(Number(value)),
      style: { fontSize: '0.6875rem', fontWeight: 500, colors: [colors.value.mutedForeground] },
    },
    markers: { size: 0, hover: { size: 5 } },
    grid: {
      borderColor: colors.value.border,
      strokeDashArray: 0,
      padding: { top: 0, right: showValueLabels.value ? 32 : 4, bottom: 0, left: 4 },
      xaxis: { lines: { show: props.horizontal } },
      yaxis: { lines: { show: !props.horizontal } },
    },
    xaxis: {
      categories: props.categories,
      max: props.horizontal ? axisMax.value : undefined,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        show: !props.horizontal,
        style: { colors: colors.value.mutedForeground, fontSize: '0.6875rem' },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        show: !props.stacked,
        style: { colors: colors.value.mutedForeground, fontSize: '0.6875rem' },
        formatter: (value) => (props.horizontal ? String(value) : props.formatter(Number(value))),
      },
    },
    states: { hover: { filter: { type: 'lighten' } } },
    // A stack answers "what is this segment?", so the tooltip is the one under the cursor
    // rather than the whole row: shared would list all six types however carefully you aimed,
    // and the legend beneath the chart already carries that list.
    tooltip: props.stacked
      ? {
          theme: theme.value,
          shared: false,
          intersect: true,
          custom: segmentTooltip,
        }
      : {
          theme: theme.value,
          shared: false,
          intersect: false,
          y: { formatter: (value) => props.formatter(Number(value)) },
        },
    legend: { show: false },
  }));
</script>
