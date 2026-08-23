import { describe, expect, it } from 'vitest';
import {
  buildLineStarts,
  buildRowPrefix,
  countWrappedRows,
  indentAt,
  lineOfRow,
  sliceForRow,
  wrapLine,
} from '../src/lib/json/lines';

/** The text of each display row, which is what a reader actually sees. */
const rowsOf = (text: string, cols: number, hang = 0): string[] => {
  const breaks = wrapLine(text, 0, text.length, cols, hang);
  return breaks.map((start, i) => text.slice(start, breaks[i + 1] ?? text.length));
};

describe('wrapLine - breaks between words', () => {
  it('keeps a word whole rather than splitting it at the edge', () => {
    expect(rowsOf('alpha beta gamma', 12)).toEqual(['alpha beta ', 'gamma']);
  });

  it('does not wrap a line that fits', () => {
    expect(rowsOf('alpha beta', 12)).toEqual(['alpha beta']);
  });

  it('wraps exactly at the column when a word ends there', () => {
    expect(rowsOf('abcd efgh', 4)).toEqual(['abcd ', 'efgh']);
  });

  it('lets the spaces at a break hang instead of pushing the word down early', () => {
    // "aa" fits; the space that follows would exceed the row but must not force a break.
    expect(rowsOf('aa bbb', 3)).toEqual(['aa ', 'bbb']);
  });

  it('splits only a word that is longer than a whole row', () => {
    expect(rowsOf('supercalifragilistic', 6)).toEqual(['superc', 'alifra', 'gilist', 'ic']);
  });

  it('fills the rest of a row before breaking through an over-long word', () => {
    expect(rowsOf('ab cdefghij', 5)).toEqual(['ab ', 'cdefg', 'hij']);
  });

  it('treats an empty line as one row', () => {
    expect(wrapLine('', 0, 0, 10)).toEqual([0]);
    expect(countWrappedRows('', 0, 0, 10)).toBe(1);
  });

  it('never loses or duplicates a character', () => {
    const line = '  "description": "A meta-markup language, used to create markup languages",';
    for (const cols of [8, 13, 20, 31, 47, 200]) {
      expect(rowsOf(line, cols).join('')).toBe(line);
    }
  });
});

describe('wrapLine - continuation rows keep their line indent', () => {
  const line = '        "para": "alpha beta gamma delta epsilon zeta"';

  it('reserves the hang from every row after the first', () => {
    const plain = countWrappedRows(line, 0, line.length, 30, 0);
    const hung = countWrappedRows(line, 0, line.length, 30, 8);
    // Narrower continuations cannot need fewer rows.
    expect(hung).toBeGreaterThanOrEqual(plain);
  });

  it('still reassembles the original line', () => {
    expect(rowsOf(line, 30, 8).join('')).toBe(line);
  });

  it('leaves a line that fits on one row alone', () => {
    expect(rowsOf('  "a": 1', 40, 2)).toEqual(['  "a": 1']);
  });
});

describe('indentAt', () => {
  it('measures leading spaces up to the cap', () => {
    expect(indentAt('      "a": 1', 0, 12, 10)).toBe(6);
    expect(indentAt('      "a": 1', 0, 12, 4)).toBe(4);
    expect(indentAt('"a": 1', 0, 6, 10)).toBe(0);
  });

  it('counts tabs as one column each', () => {
    expect(indentAt('\t\t"a": 1', 0, 8, 10)).toBe(2);
  });
});

describe('buildRowPrefix and sliceForRow', () => {
  const text = ['{', '  "a": 1,', '  "long": "alpha beta gamma delta epsilon"', '}'].join('\n');
  const index = buildLineStarts(text);
  const rows = buildRowPrefix(text, index, text.length, 24, 6);

  it('gives every line at least one row', () => {
    expect(rows.rowCount).toBeGreaterThanOrEqual(index.count);
  });

  it('maps each row back to the line that owns it', () => {
    for (let row = 0; row < rows.rowCount; row++) {
      const line = lineOfRow(rows, index.count, row);
      expect(rows.prefix[line]).toBeLessThanOrEqual(row);
      expect(rows.prefix[line + 1]).toBeGreaterThan(row);
    }
  });

  it('slices rows that reassemble their source line exactly', () => {
    for (let line = 0; line < index.count; line++) {
      let rebuilt = '';
      for (let row = rows.prefix[line]; row < rows.prefix[line + 1]; row++) {
        rebuilt += text.slice(...sliceBounds(row, line));
      }
      const from = index.starts[line];
      const to =
        from + (line + 1 < index.count ? index.starts[line + 1] - from - 1 : text.length - from);
      expect(rebuilt).toBe(text.slice(from, to));
    }
  });

  const sliceBounds = (row: number, line: number): [number, number] => {
    const slice = sliceForRow(index, rows, text.length, row, line);
    return [slice.start, slice.end];
  };

  it('reports the indent only on continuation rows', () => {
    const wrapped = 2;
    const first = sliceForRow(index, rows, text.length, rows.prefix[wrapped], wrapped);
    expect(first.segment).toBe(0);
    expect(first.indent).toBe(0);

    if (rows.prefix[wrapped + 1] - rows.prefix[wrapped] > 1) {
      const next = sliceForRow(index, rows, text.length, rows.prefix[wrapped] + 1, wrapped);
      expect(next.segment).toBe(1);
      expect(next.indent).toBe(2);
    }
  });
});

describe('wrapLine - hostile input', () => {
  it('terminates on a column count of zero or less', () => {
    expect(wrapLine('abc', 0, 3, 0)).toEqual([0]);
    expect(wrapLine('abc', 0, 3, -5)).toEqual([0]);
  });

  it('terminates when the hang swallows the whole row', () => {
    expect(() => countWrappedRows('a b c d e f g', 0, 13, 4, 99)).not.toThrow();
    expect(countWrappedRows('a b c d e f g', 0, 13, 4, 99)).toBeGreaterThan(0);
  });

  it('handles a line of only spaces', () => {
    expect(countWrappedRows('     ', 0, 5, 3)).toBe(1);
  });

  it('handles a very long unbroken run without stalling', () => {
    const run = 'x'.repeat(50_000);
    expect(countWrappedRows(run, 0, run.length, 80)).toBe(Math.ceil(50_000 / 80));
  });
});
