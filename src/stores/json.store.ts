import {
  escapeToJsonString,
  formatJson,
  minifyJson,
  parseJson,
  parseNdjson,
  removeEmptyValues,
  repairJson,
  sortJsonKeys,
  unescapeJsonString,
  SAMPLE_JSON,
  SAMPLE_JSON_ALT,
  type IndentStyle,
  type JsonParseError,
  type JsonValue,
} from '@/lib/json';

const STORAGE_KEY = 'json-explorer:workspace';
const MAX_PERSISTED_CHARS = 500_000;
const MAX_HISTORY = 25;

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

export const useJsonStore = defineStore('json-workspace', () => {
  const persisted = readPersisted();

  const source = ref(persisted.source ?? SAMPLE_JSON);
  const compare = ref(persisted.compare ?? SAMPLE_JSON_ALT);
  const indent = ref<IndentStyle>(persisted.indent ?? '2');
  const history = ref<string[]>([]);

  const debouncedSource = refDebounced(source, 120);
  const debouncedCompare = refDebounced(compare, 120);

  const parsed = computed(() => parseJson(debouncedSource.value));
  const parsedCompare = computed(() => parseJson(debouncedCompare.value));

  const value = computed<JsonValue | null>(() => (parsed.value.ok ? parsed.value.value : null));
  const compareValue = computed<JsonValue | null>(() =>
    parsedCompare.value.ok ? parsedCompare.value.value : null,
  );

  const error = computed<JsonParseError | null>(() =>
    parsed.value.ok ? null : parsed.value.error,
  );
  const compareError = computed<JsonParseError | null>(() =>
    parsedCompare.value.ok ? null : parsedCompare.value.error,
  );

  const isEmpty = computed(() => source.value.trim().length === 0);
  const isValid = computed(() => parsed.value.ok);
  const canUndo = computed(() => history.value.length > 0);

  const commit = (next: string) => {
    if (next === source.value) return;
    history.value.push(source.value);
    if (history.value.length > MAX_HISTORY) history.value.shift();
    source.value = next;
  };

  const undo = () => {
    const previous = history.value.pop();
    if (previous !== undefined) source.value = previous;
  };

  const withValue = (transform: (input: JsonValue) => string): boolean => {
    const result = parseJson(source.value);
    if (!result.ok) return false;
    commit(transform(result.value));
    return true;
  };

  const beautify = () => withValue((input) => formatJson(input, indent.value));
  const minify = () => withValue((input) => minifyJson(input));
  const sortKeys = (direction: 'asc' | 'desc' = 'asc') =>
    withValue((input) => formatJson(sortJsonKeys(input, direction), indent.value));
  const removeEmpty = () =>
    withValue((input) => formatJson(removeEmptyValues(input), indent.value));

  const escapeString = () => {
    commit(escapeToJsonString(source.value));
    return true;
  };

  const unescapeString = () => {
    try {
      commit(unescapeJsonString(source.value));
      return true;
    } catch {
      return false;
    }
  };

  const repair = (): boolean => {
    if (parseJson(source.value).ok) return true;

    const repaired = repairJson(source.value);
    const afterRepair = parseJson(repaired.text);
    if (afterRepair.ok) {
      commit(formatJson(afterRepair.value, indent.value));
      return true;
    }

    const ndjson = parseNdjson(source.value);
    if (ndjson) {
      commit(formatJson(ndjson, indent.value));
      return true;
    }

    return false;
  };

  const setSource = (text: string) => {
    source.value = text;
  };

  const replaceSource = (text: string) => commit(text);
  const setCompare = (text: string) => {
    compare.value = text;
  };

  const swap = () => {
    const current = source.value;
    source.value = compare.value;
    compare.value = current;
  };

  const loadSample = () => {
    commit(SAMPLE_JSON);
    compare.value = SAMPLE_JSON_ALT;
  };

  const clear = () => {
    commit('');
  };

  watchDebounced(
    [source, compare, indent],
    () => {
      if (typeof localStorage === 'undefined') return;
      try {
        const payload: PersistedWorkspace = {
          source: source.value.length > MAX_PERSISTED_CHARS ? '' : source.value,
          compare: compare.value.length > MAX_PERSISTED_CHARS ? '' : compare.value,
          indent: indent.value,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        return;
      }
    },
    { debounce: 400, maxWait: 2000 },
  );

  return {
    source,
    text: debouncedSource,
    compare,
    indent,
    parsed,
    parsedCompare,
    value,
    compareValue,
    error,
    compareError,
    isEmpty,
    isValid,
    canUndo,
    setSource,
    setCompare,
    replaceSource,
    beautify,
    minify,
    sortKeys,
    removeEmpty,
    escapeString,
    unescapeString,
    repair,
    undo,
    swap,
    loadSample,
    clear,
  };
});
