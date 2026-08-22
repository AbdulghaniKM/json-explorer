import { describe, expect, it } from 'vitest';
import {
  buildLineStarts,
  buildRowPrefix,
  lineOfRow,
  sliceForRow,
  type LineIndex,
} from '../src/lib/json/lines';

const WRAP = 10;

/** Reconstruct the document from the rows the viewer would draw. */
const renderAllRows = (text: string, wrap = WRAP): string => {
  const index = buildLineStarts(text);
  const rows = buildRowPrefix(index, text.length, wrap);
  const pieces: string[] = [];

  for (let row = 0; row < rows.rowCount; row++) {
    const line = lineOfRow(rows, index.count, row);
    const slice = sliceForRow(index, rows, text.length, wrap, row, line);
    pieces.push(text.slice(slice.start, slice.end));
    // A line ends when the next row belongs to a different line.
    const nextLine = row + 1 < rows.rowCount ? lineOfRow(rows, index.count, row + 1) : -1;
    if (nextLine !== line && row + 1 < rows.rowCount) pieces.push('\n');
  }

  return pieces.join('');
};

describe('buildLineStarts', () => {
  it('handles empty text', () => {
    expect(buildLineStarts('')).toEqual({ starts: new Uint32Array(0), count: 0 });
  });

  it('counts a single line', () => {
    expect(buildLineStarts('abc').count).toBe(1);
  });

  it('counts lines split by newlines', () => {
    expect(buildLineStarts('a\nb\nc').count).toBe(3);
  });

  it('counts a trailing newline as opening a final line', () => {
    expect(buildLineStarts('a\n').count).toBe(2);
  });

  it('records the offset of each line start', () => {
    const { starts } = buildLineStarts('ab\ncd\ne');
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBe(3);
    expect(starts[2]).toBe(6);
  });
});

describe('buildRowPrefix', () => {
  const rowsFor = (text: string, wrap = WRAP) => {
    const index = buildLineStarts(text);
    return buildRowPrefix(index, text.length, wrap);
  };

  it('gives one row to each short line', () => {
    expect(rowsFor('a\nb\nc').rowCount).toBe(3);
  });

  it('gives one row to an empty line', () => {
    expect(rowsFor('\n\n').rowCount).toBe(3);
  });

  it('wraps a long line across several rows', () => {
    // 25 characters at a width of 10 => 3 rows.
    expect(rowsFor('x'.repeat(25)).rowCount).toBe(3);
  });

  it('does not wrap a line of exactly the wrap width', () => {
    expect(rowsFor('x'.repeat(WRAP)).rowCount).toBe(1);
  });

  it('wraps a line one character over the width', () => {
    expect(rowsFor('x'.repeat(WRAP + 1)).rowCount).toBe(2);
  });

  it('makes a single minified line browsable rather than truncated', () => {
    const minified = `{"a":[${Array.from({ length: 500 }, (_, i) => i).join(',')}]}`;
    const rows = rowsFor(minified);
    expect(rows.rowCount).toBeGreaterThan(100);
    // Every character is reachable.
    expect(rows.rowCount * WRAP).toBeGreaterThanOrEqual(minified.length);
  });
});

describe('lineOfRow', () => {
  const text = `${'a'.repeat(25)}\nb\n${'c'.repeat(15)}`;
  const index: LineIndex = buildLineStarts(text);
  const rows = buildRowPrefix(index, text.length, WRAP);

  it('maps every row to the line that owns it', () => {
    // line 0 => rows 0,1,2 | line 1 => row 3 | line 2 => rows 4,5
    const owners = Array.from({ length: rows.rowCount }, (_, row) =>
      lineOfRow(rows, index.count, row),
    );
    expect(owners).toEqual([0, 0, 0, 1, 2, 2]);
  });

  it('is monotonic', () => {
    let previous = -1;
    for (let row = 0; row < rows.rowCount; row++) {
      const line = lineOfRow(rows, index.count, row);
      expect(line).toBeGreaterThanOrEqual(previous);
      previous = line;
    }
  });
});

describe('sliceForRow', () => {
  it('reproduces the document exactly from its rows', () => {
    const documents = [
      'a\nb\nc',
      'x'.repeat(25),
      `${'a'.repeat(25)}\nb\n${'c'.repeat(15)}`,
      '{"a":1,"b":[1,2,3]}',
      `${'{"deeply":'.repeat(30)}1${'}'.repeat(30)}`,
      'short\n'.repeat(50),
    ];

    for (const text of documents) {
      expect(renderAllRows(text), JSON.stringify(text.slice(0, 30))).toBe(text);
    }
  });

  it('reproduces a document at several wrap widths', () => {
    const text = `${'a'.repeat(37)}\n\n${'b'.repeat(8)}\n${'c'.repeat(100)}`;
    for (const wrap of [1, 2, 3, 7, 10, 64, 1000]) {
      expect(renderAllRows(text, wrap), `wrap=${wrap}`).toBe(text);
    }
  });

  it('numbers segments from zero within a line', () => {
    const text = 'x'.repeat(25);
    const index = buildLineStarts(text);
    const rows = buildRowPrefix(index, text.length, WRAP);
    expect(
      [0, 1, 2].map((row) => sliceForRow(index, rows, text.length, WRAP, row, 0).segment),
    ).toEqual([0, 1, 2]);
  });

  it('never returns a slice extending past its line', () => {
    const text = `${'a'.repeat(25)}\nbb`;
    const index = buildLineStarts(text);
    const rows = buildRowPrefix(index, text.length, WRAP);
    for (let row = 0; row < rows.rowCount; row++) {
      const line = lineOfRow(rows, index.count, row);
      const slice = sliceForRow(index, rows, text.length, WRAP, row, line);
      expect(text.slice(slice.start, slice.end)).not.toContain('\n');
    }
  });
});
