import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'json-explorer:preferences';

export interface Preferences {
  /** Pre-fill the workspace with the demo document and offer the "Sample" buttons. */
  sampleData: boolean;
  /** Show the "sampled" markers analyze puts on statistics it stopped counting exactly. */
  sampledMarkers: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  sampleData: true,
  sampledMarkers: true,
};

const readStored = (): Preferences => {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      sampleData: parsed.sampleData ?? DEFAULT_PREFERENCES.sampleData,
      sampledMarkers: parsed.sampledMarkers ?? DEFAULT_PREFERENCES.sampledMarkers,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

const preferences = ref<Preferences>(readStored());

watch(
  preferences,
  (current) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      return;
    }
  },
  { deep: true },
);

export const showSampleData = computed(() => preferences.value.sampleData);
export const showSampledMarkers = computed(() => preferences.value.sampledMarkers);

export const usePreferences = () => {
  const sampleData = computed({
    get: () => preferences.value.sampleData,
    set: (value: boolean) => {
      preferences.value.sampleData = value;
    },
  });

  const sampledMarkers = computed({
    get: () => preferences.value.sampledMarkers,
    set: (value: boolean) => {
      preferences.value.sampledMarkers = value;
    },
  });

  return { sampleData, sampledMarkers };
};
