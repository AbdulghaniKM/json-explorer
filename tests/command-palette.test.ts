import { describe, expect, it } from 'vitest';
import { useCommandPalette, type Command } from '../src/composables/useCommandPalette';

const command = (id: string, label: string, group: Command['group'] = 'Document'): Command => ({
  id,
  label,
  group,
  icon: '',
  run: () => {},
});

const palette = useCommandPalette();

const search = (text: string, list: Command[]): string[] => {
  palette.register(list);
  palette.query.value = text;
  return palette.matches.value.map((entry) => entry.id);
};

describe('command palette filtering', () => {
  const list = [
    command('beautify', 'Beautify'),
    command('minify', 'Minify'),
    command('copy', 'Copy document'),
    command('compare', 'Compare', 'Go to'),
    command('removeEmpty', 'Remove empty values'),
  ];

  it('lists everything when the query is empty', () => {
    expect(search('', list)).toHaveLength(5);
  });

  it('ranks a prefix match above a match further in', () => {
    expect(search('co', list)[0]).toBe('copy');
  });

  it('matches a scattered subsequence', () => {
    expect(search('bty', list)).toContain('beautify');
  });

  it('matches on the group name', () => {
    expect(search('go to', list)).toEqual(['compare']);
  });

  it('matches on hidden keywords without showing them', () => {
    const withKeywords = [
      { ...command('theme', 'Toggle light / dark'), keywords: 'colour scheme' },
    ];
    expect(search('colour', withKeywords)).toEqual(['theme']);
  });

  it('drops commands that are unavailable', () => {
    const gated = [{ ...command('save', 'Download JSON'), available: () => false }];
    expect(search('', gated)).toEqual([]);
  });

  it('returns nothing when no command matches', () => {
    expect(search('zzzz', list)).toEqual([]);
  });

  // The layout registers the commands and a different component renders them, so every
  // caller has to observe the same registry. Per-instance state made the palette render an
  // empty list with no error anywhere.
  it('shares its registry across separate callers', () => {
    const registrar = useCommandPalette();
    const consumer = useCommandPalette();

    registrar.register(list);
    registrar.query.value = '';

    expect(consumer.matches.value.map((entry) => entry.id)).toEqual(list.map((c) => c.id));
    expect(consumer.commands.value).toHaveLength(list.length);
  });
});
