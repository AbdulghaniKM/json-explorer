import {
  SAMPLE_JSON,
  SAMPLE_JSON_ALT,
  SAMPLE_MESSY,
  type IndentStyle,
  type JsonIndex,
  type JsonParseError,
  type JsonStats,
  type EngineResponseOf,
  type TransformOp,
} from '@/lib/json';
import { runOffThread } from '@/composables/useJsonEngine';

const STORAGE_KEY = 'json-explorer:workspace';
const PERSIST_LIMIT = 512_000;
const HISTORY_LIMIT = 2_000_000;
const MAX_HISTORY = 20;

export const EDIT_LIMIT = 3_000_000;

interface PersistedWorkspace {
  source: string;
  compare: string;
  indent: IndentStyle;
}

const readPersisted = (): Partial<PersistedWorkspace> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const scanDelay = (length: number): number => {
  if (length > 20_000_000) return 900;
  if (length > 5_000_000) return 500;
  if (length > 500_000) return 250;
  return 120;
};

export const useJsonStore = defineStore('json-workspace', () => {
  const persisted = readPersisted();

  const source = ref(persisted.source ?? SAMPLE_JSON);
  const compare = ref(persisted.compare ?? SAMPLE_JSON_ALT);
  const indent = ref<IndentStyle>(persisted.indent ?? '2');

  const index = shallowRef<JsonIndex | null>(null);
  const stats = shallowRef<JsonStats | null>(null);
  const error = shallowRef<JsonParseError | null>(null);
  const scanning = ref(false);
  const busy = ref('');
  const note = ref('');

  const compareStats = shallowRef<JsonStats | null>(null);
  const compareError = shallowRef<JsonParseError | null>(null);

  const history = ref<string[]>([]);
  const documentId = ref(0);

  const isEmpty = computed(() => source.value.trim().length === 0);
  const isValid = computed(() => index.value !== null && error.value === null);
  const canUndo = computed(() => history.value.length > 0);
  const editable = computed(() => source.value.length <= EDIT_LIMIT);
  const nodeCount = computed(() => index.value?.count ?? 0);

  let scanToken = 0;
  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  let compareToken = 0;
  let compareTimer: ReturnType<typeof setTimeout> | null = null;

  const runScan = async (text: string) => {
    const token = ++scanToken;
    if (!text.trim()) {
      index.value = null;
      stats.value = null;
      error.value = null;
      scanning.value = false;
      return;
    }

    scanning.value = true;
    const response = await runOffThread<EngineResponseOf<'scan'>>({ kind: 'scan', text });

    if (token !== scanToken) return;
    scanning.value = false;

    if (response.ok) {
      index.value = response.index;
      stats.value = response.stats;
      error.value = null;
    } else {
      index.value = null;
      stats.value = null;
      error.value = response.error;
    }
  };

  const scheduleScan = () => {
    if (scanTimer) clearTimeout(scanTimer);
    const text = source.value;
    scanTimer = setTimeout(() => void runScan(text), scanDelay(text.length));
  };

  const runValidate = async (text: string) => {
    const token = ++compareToken;
    if (!text.trim()) {
      compareStats.value = null;
      compareError.value = null;
      return;
    }
    const response = await runOffThread<EngineResponseOf<'validate'>>({ kind: 'validate', text });
    if (token !== compareToken) return;
    if (response.ok) {
      compareStats.value = response.stats;
      compareError.value = null;
    } else {
      compareStats.value = null;
      compareError.value = response.error;
    }
  };

  const scheduleValidate = () => {
    if (compareTimer) clearTimeout(compareTimer);
    const text = compare.value;
    compareTimer = setTimeout(() => void runValidate(text), scanDelay(text.length));
  };

  watch(source, scheduleScan, { immediate: true });
  watch(compare, scheduleValidate, { immediate: true });

  const pushHistory = (previous: string) => {
    if (previous.length > HISTORY_LIMIT) {
      history.value = [];
      return;
    }
    history.value.push(previous);
    if (history.value.length > MAX_HISTORY) history.value.shift();
  };

  const setSource = (text: string) => {
    source.value = text;
  };

  const replaceSource = (text: string) => {
    if (text === source.value) return;
    pushHistory(source.value);
    source.value = text;
    documentId.value++;
  };

  const setCompare = (text: string) => {
    compare.value = text;
  };

  const undo = () => {
    const previous = history.value.pop();
    if (previous !== undefined) source.value = previous;
  };

  const run = async (op: TransformOp): Promise<{ ok: boolean; message?: string }> => {
    if (busy.value) return { ok: false, message: 'Another operation is still running' };
    busy.value = op;
    note.value = '';

    // `busy` gates every other operation, so it must be cleared on any exit path.
    try {
      const response = await runOffThread<EngineResponseOf<'transform'>>({
        kind: 'transform',
        text: source.value,
        op,
        indent: indent.value,
      });

      if (!response.ok) return { ok: false, message: response.message };

      replaceSource(response.text);
      if (response.note) note.value = response.note;
      return { ok: true, message: response.note };
    } finally {
      busy.value = '';
    }
  };

  const generate = async (records: number): Promise<{ ok: boolean; message?: string }> => {
    if (busy.value) return { ok: false, message: 'Another operation is still running' };
    busy.value = 'generate';

    try {
      const response = await runOffThread<EngineResponseOf<'generate'>>({
        kind: 'generate',
        records,
      });

      if (!response.ok) return { ok: false, message: response.message };

      replaceSource(response.text);
      return { ok: true };
    } finally {
      busy.value = '';
    }
  };

  const swap = () => {
    const current = source.value;
    source.value = compare.value;
    compare.value = current;
  };

  const loadSample = () => {
    replaceSource(SAMPLE_JSON);
    compare.value = SAMPLE_JSON_ALT;
  };

  const loadMessy = () => replaceSource(SAMPLE_MESSY);

  const clear = () => replaceSource('');

  watchDebounced(
    [source, compare, indent],
    () => {
      if (typeof localStorage === 'undefined') return;
      try {
        const payload: PersistedWorkspace = {
          source: source.value.length > PERSIST_LIMIT ? '' : source.value,
          compare: compare.value.length > PERSIST_LIMIT ? '' : compare.value,
          indent: indent.value,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        return;
      }
    },
    { debounce: 600, maxWait: 4000 },
  );

  return {
    source,
    documentId,
    compare,
    indent,
    index,
    stats,
    error,
    compareStats,
    compareError,
    scanning,
    busy,
    note,
    isEmpty,
    isValid,
    canUndo,
    editable,
    nodeCount,
    setSource,
    setCompare,
    replaceSource,
    undo,
    run,
    generate,
    swap,
    loadSample,
    loadMessy,
    clear,
  };
});
