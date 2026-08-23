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
  /** Offset each display row begins at, so a row maps to its text in constant time. */
  rowStarts: Uint32Array;
  /** Columns each line's continuation rows are pushed in by — its own indentation. */
  hang: Uint16Array;
}

const SPACE = 32;
const TAB = 9;

const isBlank = (code: number): boolean => code === SPACE || code === TAB;

const HYPHEN = 45;
const SLASH = 47;

/**
 * A line may also break straight after a hyphen or a slash, which is what the browser does
 * (Unicode line breaking treats both as break-after). Both are everywhere in JSON — dates,
 * kebab-case keys, `$ref` paths — so ignoring them would put this count a row out wherever one
 * fell near the edge, and the gutter with it.
 */
const breaksAfter = (code: number): boolean => code === HYPHEN || code === SLASH;

/** Leading whitespace of the line at `start`, in columns, capped at `limit`. */
export const indentAt = (text: string, start: number, end: number, limit: number): number => {
  let width = 0;
  for (let i = start; i < end && isBlank(text.charCodeAt(i)); i++) width++;
  return Math.min(width, limit);
};

/**
 * Where each display row of one line begins, under greedy word wrapping.
 *
 * This mirrors what the browser does for `white-space: pre-wrap` with `overflow-wrap:
 * break-word`, and it has to mirror it exactly: the gutter sizes each line's cell from these
 * counts, so a row of disagreement puts every number below it out of step with its code.
 *
 *   - a break is taken before a word that will not fit, never inside it;
 *   - the spaces at that break hang past the edge rather than forcing an earlier one;
 *   - a word too long for any row is the one case that splits, filling each row as it goes;
 *   - continuation rows lose `hang` columns, which is what indents them under their line.
 */
export const wrapLine = (
  text: string,
  start: number,
  end: number,
  cols: number,
  hang = 0,
): number[] => {
  const breaks = [start];
  if (cols <= 0 || end <= start) return breaks;

  const continued = Math.max(1, cols - hang);
  let available = cols;
  let column = 0;
  let i = start;

  const breakAt = (offset: number) => {
    breaks.push(offset);
    available = continued;
    column = 0;
  };

  while (i < end) {
    let afterSpaces = i;
    while (afterSpaces < end && isBlank(text.charCodeAt(afterSpaces))) afterSpaces++;
    const spaces = afterSpaces - i;

    // An atom is a run that cannot be split: up to the next space, or just past the first
    // hyphen or slash, whichever comes first.
    let afterWord = afterSpaces;
    while (afterWord < end && !isBlank(text.charCodeAt(afterWord))) {
      const code = text.charCodeAt(afterWord);
      afterWord++;
      if (breaksAfter(code)) break;
    }
    const word = afterWord - afterSpaces;

    // Trailing spaces hang off the end; they never pull the next row down on their own.
    if (word === 0) {
      column += spaces;
      break;
    }

    if (column + spaces + word <= available) {
      column += spaces + word;
      i = afterWord;
      continue;
    }

    if (word <= continued) {
      breakAt(afterSpaces);
      column = word;
      i = afterWord;
      continue;
    }

    // Longer than any row. `overflow-wrap: break-word` moves it down to a fresh row first and
    // only then breaks through it — it does not fill the tail of the row it did not fit on.
    // `column + spaces`, not `column`: leading indentation counts as something already on the
    // row, so a word too long to fit still moves down past it before it is broken.
    let offset = afterSpaces;
    if (column + spaces > 0) breakAt(offset);
    let room = available;
    while (offset < afterWord) {
      const take = Math.min(room, afterWord - offset);
      offset += take;
      column += take;
      if (offset < afterWord) {
        breakAt(offset);
        room = continued;
      }
    }
    i = afterWord;
  }

  return breaks;
};

/** Display rows one line occupies. Cheaper than `wrapLine` when the offsets are not needed. */
export const countWrappedRows = (
  text: string,
  start: number,
  end: number,
  cols: number,
  hang = 0,
): number => wrapLine(text, start, end, cols, hang).length;

export const lineLengthAt = (index: LineIndex, textLength: number, line: number): number => {
  const from = index.starts[line];
  const to = index.starts[line + 1] ?? textLength + 1;
  return Math.max(0, to - from - 1);
};

export const buildRowPrefix = (
  text: string,
  index: LineIndex,
  textLength: number,
  wrapChars: number,
  maxHang = 0,
): RowIndex => {
  const prefix = new Uint32Array(index.count + 1);
  const hang = new Uint16Array(index.count);
  const starts: number[] = [];

  for (let line = 0; line < index.count; line++) {
    prefix[line] = starts.length;
    const from = index.starts[line];
    const to = from + lineLengthAt(index, textLength, line);
    const indent = maxHang > 0 ? indentAt(text, from, to, maxHang) : 0;
    hang[line] = indent;
    // An empty line still occupies one row, which `wrapLine` already returns.
    for (const offset of wrapLine(text, from, to, wrapChars, indent)) starts.push(offset);
  }

  prefix[index.count] = starts.length;
  return {
    prefix,
    rowCount: starts.length,
    rowStarts: Uint32Array.from(starts),
    hang,
  };
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
  /** Columns this row is pushed in by: zero on a line's first row, its indent after that. */
  indent: number;
}

export const sliceForRow = (
  index: LineIndex,
  rows: RowIndex,
  textLength: number,
  row: number,
  line: number,
): RowSlice => {
  const lineStart = index.starts[line];
  const lineEnd = Math.max(lineStart, (index.starts[line + 1] ?? textLength + 1) - 1);
  const segment = row - rows.prefix[line];
  const start = rows.rowStarts[row] ?? lineStart;
  const nextRow = row + 1;
  const withinLine = nextRow < rows.prefix[line + 1];
  const end = withinLine ? (rows.rowStarts[nextRow] ?? lineEnd) : lineEnd;
  return {
    line,
    segment,
    start,
    end: Math.max(start, Math.min(lineEnd, end)),
    indent: segment > 0 ? rows.hang[line] : 0,
  };
};
