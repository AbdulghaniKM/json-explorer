<template>
  <div ref="rootRef" class="relative">
    <AppButton
      icon="icon-[solar--settings-linear]"
      icon-only
      :tooltip="open ? undefined : 'Settings'"
      :aria-expanded="open"
      @click="open = !open"
    />

    <div v-if="open" class="absolute end-0 z-40 mt-2 w-72 border border-border bg-popover p-3">
      <p class="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Settings
      </p>

      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-foreground">Sample document</p>
          <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Start with a demo order and show the Sample buttons on every tool.
          </p>
        </div>
        <AppSwitch v-model="sampleData" class="mt-0.5" label="Sample document" />
      </div>

      <div class="mt-3 flex items-start gap-3 border-t border-border/60 pt-3">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-foreground">Sampled markers</p>
          <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Flag the statistics that stop counting exactly on very large documents.
          </p>
        </div>
        <AppSwitch v-model="sampledMarkers" class="mt-0.5" label="Sampled markers" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import AppButton from './AppButton.vue';
  import AppSwitch from './AppSwitch.vue';
  import { usePreferences } from '@/composables/usePreferences';
  import { useJsonStore } from '@/stores/json.store';
  import { SAMPLE_JSON, SAMPLE_JSON_ALT } from '@/lib/json';

  const store = useJsonStore();
  const { sampleData, sampledMarkers } = usePreferences();

  const rootRef = ref<HTMLElement | null>(null);
  const open = ref(false);

  onClickOutside(rootRef, () => {
    open.value = false;
  });

  // Turning the sample off clears a workspace the user has never touched, and turning it back
  // on refills an empty one — but neither ever overwrites something they typed.
  watch(sampleData, (enabled) => {
    if (enabled) {
      if (store.isEmpty) store.loadSample();
      return;
    }
    if (store.source === SAMPLE_JSON) store.clear();
    if (store.compare === SAMPLE_JSON_ALT) store.setCompare('');
  });
</script>
