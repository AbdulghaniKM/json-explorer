<template>
  <JsonWorkbench>
    <template #toolbar>
      <UiAppButton
        variant="primary"
        size="sm"
        icon="icon-[solar--upload-minimalistic-linear]"
        label="Open file"
        @click="open"
      />
      <UiAppButton
        v-if="showSampleData"
        variant="ghost"
        size="sm"
        icon="icon-[solar--document-add-linear]"
        label="Sample"
        @click="store.loadSample"
      />

      <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
        Depth
        <select
          v-model.number="maxDepth"
          class="h-8 border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option v-for="level in [2, 3, 4, 5, 6, 8]" :key="level" :value="level">
            {{ level }}
          </option>
        </select>
      </label>

      <UiAppButton
        variant="surface"
        size="sm"
        icon="icon-[solar--minimize-square-3-linear]"
        label="Fit"
        @click="fit"
      />

      <div class="ms-auto flex flex-wrap items-center gap-1.5">
        <UiAppBadge v-if="graph" variant="surface">{{ graph.shown }} nodes drawn</UiAppBadge>
        <UiAppBadge v-if="graph?.truncated" variant="warning">
          trimmed — raise the depth to see more
        </UiAppBadge>
        <UiAppBadge variant="muted">{{ Math.round(scale * 100) }}%</UiAppBadge>
      </div>
    </template>

    <JsonPanel
      title="Graph"
      icon="icon-[solar--share-linear]"
      :badge="selected ? selected.path : undefined"
      class="h-[60svh] lg:h-(--panel-h)"
    >
      <template #actions>
        <UiAppButton
          v-if="selected"
          icon="icon-[solar--copy-linear]"
          icon-only
          size="xs"
          tooltip="Copy path"
          @click="copyPath"
        />
      </template>

      <div
        v-if="graph"
        ref="stageRef"
        class="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-background/40"
        :class="panning ? 'cursor-grabbing' : ''"
        @pointerdown="onPointerDown"
        @wheel.prevent="onWheel"
      >
        <svg :width="stageWidth" :height="stageHeight" class="block touch-none select-none">
          <g :transform="`translate(${offsetX} ${offsetY}) scale(${scale})`">
            <!-- Links first so a node always paints over the lines that reach it. -->
            <path
              v-for="edge in graph.edges"
              :key="`${edge.from}-${edge.to}`"
              :d="edgePath(edge)"
              fill="none"
              stroke="currentColor"
              class="text-border"
              stroke-width="1"
            />

            <g
              v-for="node in graph.nodes"
              :key="node.id"
              :transform="`translate(${node.x} ${node.y})`"
              class="cursor-pointer"
              @click.stop="select(node)"
            >
              <rect
                :width="NODE_WIDTH"
                :height="NODE_HEIGHT"
                y="-11"
                class="fill-card"
                :class="node.id === selectedId ? 'stroke-primary' : 'stroke-border'"
                :stroke-width="node.id === selectedId ? 2 : 1"
              />
              <text x="8" y="4" class="font-mono text-[11px]">
                <tspan :fill="fillFor(node)" :class="node.truncated ? 'italic' : ''">
                  {{ node.label }}
                </tspan>
                <tspan dx="6" class="fill-current text-muted-foreground">{{ suffix(node) }}</tspan>
              </text>
            </g>
          </g>
        </svg>
      </div>

      <UiAppEmptyState
        v-else
        class="flex-1"
        :icon="
          store.scanning ? 'icon-[solar--bolt-linear]' : 'icon-[solar--danger-triangle-linear]'
        "
        :variant="store.isEmpty ? 'neutral' : store.scanning ? 'info' : 'danger'"
        :title="
          store.scanning
            ? 'Indexing the document…'
            : store.isEmpty
              ? 'Nothing to draw yet'
              : 'Invalid JSON'
        "
        :description="
          store.scanning
            ? 'The graph is laid out from the index, so it waits for the scan.'
            : store.isEmpty
              ? 'Open a file or paste JSON to see its shape as a node graph.'
              : store.error?.message
        "
      >
        <UiAppButton
          v-if="store.isEmpty && showSampleData"
          variant="primary"
          label="Load sample"
          @click="store.loadSample"
        />
      </UiAppEmptyState>
    </JsonPanel>
  </JsonWorkbench>
</template>

<script setup lang="ts">
  import {
    NODE_ARRAY,
    NODE_BOOLEAN,
    NODE_NULL,
    NODE_NUMBER,
    NODE_OBJECT,
    NODE_STRING,
    buildGraph,
    pathOf,
    type GraphEdge,
    type GraphNode,
  } from '@/lib/json';
  import { VALUE_TYPE_SWATCHES } from '@/config/charts';
  import { showSampleData } from '@/composables/usePreferences';
  import { useClipboard } from '@/composables/useClipboard';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useTheme } from '@/composables/useTheme';

  definePage({
    route: '/graph',
    head: 'Visualize JSON as a graph — nodes, links and structure',
  });

  const NODE_WIDTH = 170;
  const NODE_HEIGHT = 22;
  const MIN_SCALE = 0.15;
  const MAX_SCALE = 2.5;

  const { store, open } = useJsonWorkspace();
  const { copy } = useClipboard();
  const { theme } = useTheme();

  const maxDepth = ref(4);
  const stageRef = ref<HTMLElement | null>(null);
  const stageWidth = ref(800);
  const stageHeight = ref(600);
  const scale = ref(1);
  const offsetX = ref(24);
  const offsetY = ref(24);
  const panning = ref(false);
  const selectedId = ref<number | null>(null);

  useResizeObserver(stageRef, ([entry]) => {
    stageWidth.value = entry.contentRect.width;
    stageHeight.value = entry.contentRect.height;
  });

  const graph = computed(() => {
    const index = store.index;
    if (!index || !store.isValid) return null;
    return buildGraph(store.source, index, { maxDepth: maxDepth.value });
  });

  const selected = computed(() => {
    const index = store.index;
    if (!index || selectedId.value === null) return null;
    return { path: pathOf(store.source, index, selectedId.value) };
  });

  // The same validated hues the analyzer uses, so a string is the same colour in both tools.
  const TYPE_SLOT: Record<number, number> = {
    [NODE_OBJECT]: 0,
    [NODE_ARRAY]: 1,
    [NODE_STRING]: 2,
    [NODE_BOOLEAN]: 3,
    [NODE_NUMBER]: 4,
    [NODE_NULL]: 5,
  };

  const fillFor = (node: GraphNode): string =>
    VALUE_TYPE_SWATCHES[theme.value][TYPE_SLOT[node.type] ?? 5];

  const suffix = (node: GraphNode): string => {
    if (node.truncated) return ` … ${node.childCount}`;
    if (node.childCount > 0) return ` ${node.childCount}`;
    return node.value ? ` ${node.value}` : '';
  };

  const edgePath = (edge: GraphEdge): string => {
    const layout = graph.value;
    if (!layout) return '';
    const from = layout.nodes.find((node) => node.id === edge.from);
    const to = layout.nodes.find((node) => node.id === edge.to);
    if (!from || !to) return '';
    const x1 = from.x + NODE_WIDTH;
    const x2 = to.x;
    const mid = (x1 + x2) / 2;
    // A cubic with vertical-free ends, so links leave and arrive horizontally and stay
    // readable where many children fan out from one parent.
    return `M${x1} ${from.y} C${mid} ${from.y} ${mid} ${to.y} ${x2} ${to.y}`;
  };

  const select = (node: GraphNode) => {
    selectedId.value = node.id;
  };

  const copyPath = () => {
    if (selected.value) void copy(selected.value.path, true);
  };

  const fit = () => {
    const layout = graph.value;
    if (!layout || !layout.width || !layout.height) return;
    const margin = 32;
    const next = Math.min(
      (stageWidth.value - margin) / layout.width,
      (stageHeight.value - margin) / layout.height,
    );
    scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    offsetX.value = margin / 2;
    offsetY.value = (stageHeight.value - layout.height * scale.value) / 2;
  };

  const onWheel = (event: WheelEvent) => {
    const stage = stageRef.value;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;

    const next = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, scale.value * (event.deltaY < 0 ? 1.12 : 1 / 1.12)),
    );
    // Keep the point under the cursor still, which is what makes wheel zoom feel anchored.
    const ratio = next / scale.value;
    offsetX.value = pointerX - (pointerX - offsetX.value) * ratio;
    offsetY.value = pointerY - (pointerY - offsetY.value) * ratio;
    scale.value = next;
  };

  let originX = 0;
  let originY = 0;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    panning.value = true;
    originX = event.clientX - offsetX.value;
    originY = event.clientY - offsetY.value;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  useEventListener(window, 'pointermove', (event: PointerEvent) => {
    if (!panning.value) return;
    offsetX.value = event.clientX - originX;
    offsetY.value = event.clientY - originY;
  });

  useEventListener(window, 'pointerup', () => {
    panning.value = false;
  });

  watch([() => store.documentId, maxDepth], () => {
    selectedId.value = null;
  });

  watch(
    [graph, stageWidth, stageHeight],
    ([layout, width]) => {
      if (layout && width > 1) fit();
    },
    { immediate: true },
  );
</script>
