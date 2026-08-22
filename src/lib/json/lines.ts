/**
 * Line/row geometry for the read-only large-document viewer.
 *
 * A minified document is a single enormous line, so the viewer cannot render one row per
 * source line - it would show only the first chunk with nothing to scroll. These helpers
 * map source lines onto wrapped *display rows* so the whole document stays reachable.
 */

export interface LineIndex {
  /** Offset of the first character of each line; `starts[count]` is text.length + 1. */
  starts: Uint32Array;
  count: number;
}

export const buildLineStarts = (text: string): LineIndex => {
  if (!text) return { starts: new Uint32Array(0), count: 0 };

  let count = 1;
  let from = text.indexOf('\n');
  while (from !== -1) {
    count++;
    from = text.indexOf('\n', from + 1);
  }

  const starts = new Uint32Array(count + 1);
  let line = 1;
  starts[0] = 0;
  let position = text.indexOf('\n');
  while (position !== -1 && line <= count) {
    starts[line++] = position + 1;
    position = text.indexOf('\n', position + 1);
  }
  starts[count] = text.length + 1;

  return { starts, count };
};

export interface RowIndex {
  /** `prefix[line]` is the first display row of that line; `prefix[count]` is the total. */
  prefix: Uint32Array;
  rowCount: number;
}

export const lineLengthAt = (index: LineIndex, textLength: number, line: number): number => {
  const from = index.starts[line];
  const to = index.starts[line + 1] ?? textLength + 1;
  return Math.max(0, to - from - 1);
};

export const buildRowPrefix = (
  index: LineIndex,
  textLength: number,
  wrapChars: number,
): RowIndex => {
  const prefix = new Uint32Array(index.count + 1);
  let rows = 0;

  for (let line = 0; line < index.count; line++) {
    prefix[line] = rows;
    const length = lineLengthAt(index, textLength, line);
    // An empty line still occupies one row.
    rows += length > wrapChars ? Math.ceil(length / wrapChars) : 1;
  }

  prefix[index.count] = rows;
  return { prefix, rowCount: rows };
};

/** The line owning `row`: the largest line whose first display row is <= row. */
export const lineOfRow = (rows: RowIndex, lineCount: number, row: number): number => {
  if (lineCount <= 0) return 0;
  let low = 0;
  let high = lineCount - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (rows.prefix[middle] <= row) low = middle;
    else high = middle - 1;
  }
  return low;
};

export interface RowSlice {
  line: number;
  /** 0 for the first row of a line, then 1, 2, … for its continuations. */
  segment: number;
  start: number;
  end: number;
}

export const sliceForRow = (
  index: LineIndex,
  rows: RowIndex,
  textLength: number,
  wrapChars: number,
  row: number,
  line: number,
): RowSlice => {
  const lineStart = index.starts[line];
  const lineEnd = Math.max(lineStart, (index.starts[line + 1] ?? textLength + 1) - 1);
  const segment = row - rows.prefix[line];
  const start = lineStart + segment * wrapChars;
  return { line, segment, start, end: Math.min(lineEnd, start + wrapChars) };
};
