import { onMounted, onUnmounted, watch, type Ref } from 'vue';

type ShortcutHandler = (e: KeyboardEvent) => void | boolean;
type ShortcutMap = Record<string, ShortcutHandler>;

function normalizeKey(combo: string): string {
  return combo
    .toLowerCase()
    .split('+')
    .map((k) => k.trim())
    .sort()
    .join('+');
}

function eventToKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');

  const key = e.key.toLowerCase();
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) {
    parts.push(key);
  }

  return parts.sort().join('+');
}

/**
 * Register keyboard shortcuts with automatic cleanup.
 *
 * Basic usage (always active while component is mounted):
 *   useKeyboard({ 'ctrl+k': () => openSearch() })
 *
 * Conditional usage (active only when `enabled` ref is true):
 *   useKeyboard({ 'escape': () => close(), 'enter': () => confirm() }, isOpen)
 */
export function useKeyboard(shortcuts: ShortcutMap, enabled?: Ref<boolean>) {
  const normalizedMap = new Map<string, ShortcutHandler>();

  for (const [combo, handler] of Object.entries(shortcuts)) {
    normalizedMap.set(normalizeKey(combo), handler);
  }

  const handleKeydown = (e: KeyboardEvent) => {
    const pressed = eventToKey(e);
    const handler = normalizedMap.get(pressed);
    if (!handler) return;
    // Handler opts in to preventDefault by returning true.
    // Default: don't swallow the event (Enter-in-input inside modals stays intact).
    const shouldPrevent = handler(e) === true;
    if (shouldPrevent) e.preventDefault();
  };

  const bind = () => document.addEventListener('keydown', handleKeydown);
  const unbind = () => document.removeEventListener('keydown', handleKeydown);

  if (enabled) {
    // Dynamic: bind/unbind based on the ref
    watch(
      enabled,
      (active) => {
        if (active) bind();
        else unbind();
      },
      { immediate: true },
    );
  } else {
    // Static: bind on mount, unbind on unmount
    onMounted(bind);
  }

  onUnmounted(unbind);

  return { bind, unbind };
}
