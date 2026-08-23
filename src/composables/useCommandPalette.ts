import { computed, ref } from 'vue';

export type CommandGroup = 'Go to' | 'Document' | 'Transform' | 'Appearance';

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  icon: string;
  /** Extra words the filter should match on but that are not shown. */
  keywords?: string;
  /** Rendered as a hint on the right of the row. */
  shortcut?: string;
  /** The return value is discarded — `unknown` so callers can pass `router.push` directly. */
  run: () => unknown;
  /** Hidden rather than disabled — a palette should only list what will work. */
  available?: () => boolean;
}

export const COMMAND_GROUPS: CommandGroup[] = ['Go to', 'Document', 'Transform', 'Appearance'];

const open = ref(false);
const query = ref('');

/**
 * Ranks a command against the query. Returns -1 for no match.
 *
 * Subsequence matching, not substring: `bty` finds "Beautify" the way a shell's fuzzy history
 * search would. A prefix hit outranks a word-boundary hit, which outranks a scattered one, so
 * typing `co` puts "Copy" above "Compare".
 */
const score = (command: Command, needle: string): number => {
  if (!needle) return 0;

  const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index === 0) return 1000;
  if (index > 0) return haystack[index - 1] === ' ' ? 900 - index : 700 - index;

  let cursor = 0;
  let gaps = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, cursor);
    if (found === -1) return -1;
    gaps += found - cursor;
    cursor = found + 1;
  }
  return 400 - gaps;
};

export const useCommandPalette = (source?: () => Command[]) => {
  const commands = ref<Command[]>([]);

  const register = (list: Command[]) => {
    commands.value = list;
  };

  if (source) register(source());

  const matches = computed(() => {
    const needle = query.value.trim().toLowerCase();
    return commands.value
      .filter((command) => command.available?.() ?? true)
      .map((command) => ({ command, rank: score(command, needle) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.command);
  });

  const groups = computed(() =>
    COMMAND_GROUPS.map((group) => ({
      group,
      items: matches.value.filter((command) => command.group === group),
    })).filter((section) => section.items.length > 0),
  );

  const show = () => {
    query.value = '';
    open.value = true;
  };

  const hide = () => {
    open.value = false;
  };

  const toggle = () => (open.value ? hide() : show());

  return { open, query, commands, register, matches, groups, show, hide, toggle };
};
