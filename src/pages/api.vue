<template>
  <JsonWorkbench>
    <template #toolbar>
      <UiAppButton
        variant="primary"
        size="sm"
        icon="icon-[solar--upload-minimalistic-linear]"
        label="Open swagger.json"
        @click="open"
      />
      <UiAppButton
        v-if="showSampleData"
        variant="ghost"
        size="sm"
        icon="icon-[solar--document-add-linear]"
        label="Sample API"
        @click="store.replaceSource(SAMPLE_OPENAPI)"
      />

      <template v-if="api">
        <UiAppBadge variant="surface">
          {{ api.version === 'openapi-3' ? 'OpenAPI 3' : 'Swagger 2' }}
        </UiAppBadge>
        <UiAppBadge variant="muted">{{ api.operations.length }} operations</UiAppBadge>
        <UiAppBadge v-if="api.schemaCount" variant="muted">
          {{ api.schemaCount }} schemas
        </UiAppBadge>
      </template>
      <UiAppBadge v-else-if="!store.isEmpty" variant="warning">Not an API document</UiAppBadge>

      <div class="ms-auto flex flex-wrap items-center gap-1.5">
        <button
          v-for="method in api?.methods ?? []"
          :key="method"
          type="button"
          class="border px-1.5 py-0.5 font-mono text-[11px] transition-none"
          :class="
            activeMethods.has(method)
              ? methodTone(method)
              : 'border-border text-muted-foreground/50 hover:text-foreground'
          "
          @click="toggleMethod(method)"
        >
          {{ method }}
        </button>
      </div>
    </template>

    <JsonSplitPane
      storage-key="api"
      :initial="34"
      :min="20"
      :max="70"
      label="Resize the document and the API"
      class="lg:h-(--panel-h)"
    >
      <template #a>
        <JsonEditor
          v-model="store.source"
          label="Source"
          class="h-(--editor-h) lg:h-auto"
          :error="store.error"
          :valid="store.isValid"
          :lines="store.stats?.lines ?? null"
          @file="onFileLoaded"
        />
      </template>

      <template #b>
        <JsonPanel
          v-if="api"
          :title="api.title"
          icon="icon-[solar--routing-2-linear]"
          :badge="api.apiVersion ? `v${api.apiVersion}` : undefined"
        >
          <div class="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
            <div class="relative min-w-0 flex-1">
              <UiAppIcon
                name="icon-[solar--magnifer-linear]"
                class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                :size="0.875"
              />
              <input
                v-model="query"
                type="search"
                placeholder="Search paths, summaries and operation ids…"
                class="h-8 w-full border border-border bg-background ps-8 pe-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <select
              v-model="activeTag"
              class="h-8 max-w-40 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">All tags</option>
              <option v-for="tag in api.tags" :key="tag" :value="tag">{{ tag }}</option>
            </select>
            <span class="font-mono text-xs text-muted-foreground tabular-nums">
              {{ visible.length }}/{{ api.operations.length }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <p v-if="api.servers.length" class="border-b border-border/60 px-3 py-1.5">
              <span class="font-mono text-[11px] text-muted-foreground">
                {{ api.servers.join(' · ') }}
              </span>
            </p>

            <ul v-if="visible.length" class="divide-y divide-border/60">
              <li v-for="operation in visible" :key="operation.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-accent"
                  @click="toggle(operation.id)"
                >
                  <span
                    class="w-14 shrink-0 border px-1 text-center font-mono text-[11px] font-semibold"
                    :class="methodTone(operation.method)"
                  >
                    {{ operation.method }}
                  </span>
                  <span
                    class="truncate font-mono text-(length:--code-size) text-foreground"
                    :class="operation.deprecated ? 'line-through opacity-60' : ''"
                  >
                    {{ operation.path }}
                  </span>
                  <span class="truncate text-xs text-muted-foreground">
                    {{ operation.summary }}
                  </span>
                  <UiAppIcon
                    :name="
                      expanded.has(operation.id)
                        ? 'icon-[solar--alt-arrow-down-linear]'
                        : 'icon-[solar--alt-arrow-right-linear]'
                    "
                    class="ms-auto shrink-0 text-muted-foreground"
                    :size="0.75"
                  />
                </button>

                <div
                  v-if="expanded.has(operation.id)"
                  class="space-y-3 border-t border-border/60 bg-muted/20 px-3 py-2.5 text-xs"
                >
                  <p v-if="operation.description" class="text-muted-foreground">
                    {{ operation.description }}
                  </p>

                  <div v-if="operation.parameters.length">
                    <p class="mb-1 font-semibold text-muted-foreground uppercase">Parameters</p>
                    <dl class="divide-y divide-border/50 border border-border/60">
                      <div
                        v-for="parameter in operation.parameters"
                        :key="`${parameter.location}:${parameter.name}`"
                        class="flex items-baseline gap-2 px-2 py-1"
                      >
                        <dt class="font-mono text-foreground">{{ parameter.name }}</dt>
                        <span class="font-mono text-[11px] text-muted-foreground">
                          {{ parameter.location }}
                        </span>
                        <span v-if="parameter.required" class="font-mono text-[11px] text-error">
                          required
                        </span>
                        <dd class="ms-auto font-mono text-[11px] text-info">
                          {{ parameter.type }}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div v-if="operation.body">
                    <p class="mb-1 font-semibold text-muted-foreground uppercase">Request body</p>
                    <p
                      class="flex flex-wrap items-baseline gap-2 border border-border/60 px-2 py-1"
                    >
                      <span class="font-mono text-info">{{ operation.body.type || 'schema' }}</span>
                      <span v-if="operation.body.required" class="font-mono text-[11px] text-error">
                        required
                      </span>
                      <span class="ms-auto font-mono text-[11px] text-muted-foreground">
                        {{ operation.body.mediaTypes.join(', ') || 'application/json' }}
                      </span>
                    </p>
                  </div>

                  <div v-if="operation.responses.length">
                    <p class="mb-1 font-semibold text-muted-foreground uppercase">Responses</p>
                    <dl class="divide-y divide-border/50 border border-border/60">
                      <div
                        v-for="response in operation.responses"
                        :key="response.status"
                        class="flex items-baseline gap-2 px-2 py-1"
                      >
                        <dt class="font-mono" :class="statusTone(response.status)">
                          {{ response.status }}
                        </dt>
                        <span class="truncate text-muted-foreground">
                          {{ response.description }}
                        </span>
                        <dd v-if="response.type" class="ms-auto font-mono text-[11px] text-info">
                          {{ response.type }}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <p v-if="operation.security.length" class="text-muted-foreground">
                    <span class="font-semibold uppercase">Security</span>
                    ·
                    <span class="font-mono">{{ operation.security.join(', ') }}</span>
                  </p>
                </div>
              </li>
            </ul>

            <UiAppEmptyState
              v-else
              icon="icon-[solar--magnifer-linear]"
              variant="neutral"
              title="No operations match"
              description="Clear the search, the tag, or the method filters."
            />
          </div>
        </JsonPanel>

        <UiAppEmptyState
          v-else
          class="border border-border bg-card"
          icon="icon-[solar--routing-2-linear]"
          :variant="store.isEmpty ? 'neutral' : 'danger'"
          :title="store.isEmpty ? 'No API document yet' : 'Not an OpenAPI document'"
          :description="
            store.isEmpty
              ? 'Open a swagger.json or openapi.json, or paste one into the editor.'
              : 'This document has no `openapi` or `swagger` version and no `paths` object.'
          "
        >
          <UiAppButton
            v-if="showSampleData"
            variant="primary"
            label="Load a sample API"
            @click="store.replaceSource(SAMPLE_OPENAPI)"
          />
        </UiAppEmptyState>
      </template>
    </JsonSplitPane>
  </JsonWorkbench>
</template>

<script setup lang="ts">
  import { methodTone, parseJson, readApiDocument } from '@/lib/json';
  import { SAMPLE_OPENAPI } from '@/lib/json/sample';
  import { showSampleData } from '@/composables/usePreferences';
  import { useJsonWorkspace } from '@/composables/useJsonWorkspace';
  import { useToast } from '@/composables/useToast';

  definePage({
    route: '/api',
    head: 'Swagger & OpenAPI viewer — endpoints, parameters and responses',
  });

  const { store, open } = useJsonWorkspace();
  const { success } = useToast();

  const onFileLoaded = (name: string) => success(`Loaded ${name}`);

  const query = ref('');
  const activeTag = ref('');
  const expanded = ref(new Set<string>());
  const hiddenMethods = ref(new Set<string>());

  /**
   * Parsed on the main thread rather than through the engine: an API description is a
   * hand-written file measured in hundreds of kilobytes, not the multi-megabyte documents the
   * worker exists for, and the reader is only ever reading one.
   */
  const api = computed(() => {
    if (store.source.length > API_LIMIT) return null;
    const parsed = parseJson(store.source);
    return parsed.ok ? readApiDocument(parsed.value) : null;
  });

  const API_LIMIT = 8 * 1024 * 1024;

  const activeMethods = computed(() => {
    const methods = api.value?.methods ?? [];
    return new Set(methods.filter((method) => !hiddenMethods.value.has(method)));
  });

  const toggleMethod = (method: string) => {
    const next = new Set(hiddenMethods.value);
    if (next.has(method)) next.delete(method);
    else next.add(method);
    hiddenMethods.value = next;
  };

  const toggle = (id: string) => {
    const next = new Set(expanded.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded.value = next;
  };

  const visible = computed(() => {
    const document = api.value;
    if (!document) return [];
    const needle = query.value.trim().toLowerCase();

    return document.operations.filter((operation) => {
      if (!activeMethods.value.has(operation.method)) return false;
      if (activeTag.value && !operation.tags.includes(activeTag.value)) return false;
      if (!needle) return true;
      return (
        operation.path.toLowerCase().includes(needle) ||
        operation.summary.toLowerCase().includes(needle) ||
        operation.operationId.toLowerCase().includes(needle)
      );
    });
  });

  const statusTone = (status: string): string => {
    if (status.startsWith('2')) return 'text-success';
    if (status.startsWith('3')) return 'text-info';
    if (status.startsWith('4')) return 'text-warning';
    if (status.startsWith('5')) return 'text-error';
    return 'text-muted-foreground';
  };

  // A new document is a new API; keeping rows open from the last one is just confusing.
  watch(
    () => store.documentId,
    () => {
      expanded.value = new Set();
      query.value = '';
      activeTag.value = '';
    },
  );
</script>
