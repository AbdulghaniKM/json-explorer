<template>
  <div :style="{ height: `${height}rem` }">
    <ApexChart
      :key="theme"
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
  import { useTheme } from '@/composables/useTheme';

  // Charting only the analyze page needs, so it stays out of the entry chunk — and only the
  // bar/column renderer is registered, not every ApexCharts type.
  const ApexChart = defineAsyncComponent(async () => {
    const [component] = await Promise.all([
      import('vue3-apexcharts/core'),
      import('apexcharts/bar'),
    ]);
    return component.default;
  });

  const props = withDefaults(
    defineProps<{
      type: 'bar';
      series: Array<{ name: string; data: number[] }>;
      /** Category labels, in the same order as the single series. */
      categories: string[];
      /** Chart body height in rem, so it scales with the root font size. */
      height?: number;
      horizontal?: boolean;
      /** Turns a raw value into the text shown on the bar end and in the tooltip. */
      formatter?: (value: number) => string;
    }>(),
    { height: 13, horizontal: false, formatter: (value: number) => value.toLocaleString('en-US') },
  );

  // Deliberately calmer than --primary. A large fill of #00e05c fails the dataviz checker's
  // lightness band against the dark canvas and glares; these two pass band, chroma floor and
  // 3:1 contrast on both surfaces. Re-run the checker before changing them.
  const MARK_COLOR = { light: '#0f7a3d', dark: '#16a34a' } as const;

  const { theme, colors } = useTheme();

  // Bar-end labels are drawn outside the mark, so the scale needs headroom or the widest
  // bar pushes its own label past the plot edge.
  const axisMax = computed(() => {
    const peak = Math.max(0, ...props.series.flatMap((entry) => entry.data));
    return peak > 0 ? peak * 1.22 : undefined;
  });

  const options = computed<ApexOptions>(() => ({
    chart: {
      type: 'bar',
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      fontFamily: 'inherit',
      parentHeightOffset: 0,
      animations: { enabled: true, speed: 240 },
    },
    theme: { mode: theme.value },
    colors: [MARK_COLOR[theme.value]],
    plotOptions: {
      bar: {
        horizontal: props.horizontal,
        borderRadius: 0,
        borderRadiusApplication: 'end',
        barHeight: '62%',
        columnWidth: '58%',
        dataLabels: { position: 'top' },
      },
    },
    dataLabels: {
      enabled: props.horizontal,
      textAnchor: 'start',
      offsetX: 8,
      formatter: (value) => props.formatter(Number(value)),
      style: { fontSize: '0.6875rem', fontWeight: 500, colors: [colors.value.mutedForeground] },
    },
    grid: {
      borderColor: colors.value.border,
      strokeDashArray: 0,
      padding: { top: 0, right: props.horizontal ? 32 : 4, bottom: 0, left: 4 },
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
        style: { colors: colors.value.mutedForeground, fontSize: '0.6875rem' },
        formatter: (value) => (props.horizontal ? String(value) : props.formatter(Number(value))),
      },
    },
    states: { hover: { filter: { type: 'lighten' } } },
    tooltip: {
      theme: theme.value,
      y: { formatter: (value) => props.formatter(Number(value)) },
    },
    legend: { show: false },
  }));
</script>
