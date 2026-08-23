import type { JsonValue } from './types';
import { parseJson } from './parse';

export interface RepairResult {
  text: string;
  changed: boolean;
  /** Lowercase phrases naming each correction, in the order it was first applied. */
  fixes: string[];
}

type NoteFix = (fix: string) => void;

/**
 * The reader recurses once per container, so it has to stop well short of the stack limit.
 * Matches the depth the in-memory tools accept, and is far past any real document.
 */
const MAX_DEPTH = 500;

const FIX = {
  byteOrderMark: 'stripped a byte order mark',
  codeFence: 'removed a markdown code fence',
  prose: 'dropped text around the document',
  unescaped: 'unescaped a quoted document',
  comments: 'removed comments',
  whitespace: 'replaced non-standard whitespace',
  quotes: 'normalized quote characters',
  unterminated: 'closed unterminated strings',
  escapes: 'repaired invalid escape sequences',
  control: 'escaped raw control characters',
  concatenation: 'joined concatenated strings',
  bareKey: 'quoted bare keys',
  bareValue: 'quoted bare values',
  literal: 'replaced non-JSON literals',
  number: 'normalized malformed numbers',
  separator: 'corrected key separators',
  missingComma: 'inserted missing commas',
  semicolon: 'replaced semicolon separators',
  strayComma: 'removed stray commas',
  trailingComma: 'removed trailing commas',
  emptyValue: 'filled empty values with null',
  missingOpener: 'added missing opening brackets',
  missingCloser: 'added missing closing brackets',
  mismatched: 'corrected mismatched brackets',
  strayCloser: 'removed stray closing brackets',
  merged: 'merged several top-level values into an array',
  tooDeep: `replaced nesting deeper than ${MAX_DEPTH} levels with null`,
} as const;

const CLOSING_QUOTE = new Map<string, string>([
  ['"', '"'],
  ["'", "'"],
  ['`', '`'],
  ['\u2018', '\u2019'],
  ['\u2019', '\u2019'],
  ['\u201c', '\u201d'],
  ['\u201d', '\u201d'],
  ['\u00ab', '\u00bb'],
  ['\u2039', '\u203a'],
]);

const ESCAPED_CHARS = new Map<string, string>([
  ['"', '"'],
  ['\\', '\\'],
  ['/', '/'],
  ['b', '\b'],
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ["'", "'"],
  ['`', '`'],
  ['\n', ''],
]);

const LITERALS = new Map<string, string>([
  ['true', 'true'],
  ['True', 'true'],
  ['TRUE', 'true'],
  ['false', 'false'],
  ['False', 'false'],
  ['FALSE', 'false'],
  ['null', 'null'],
  ['Null', 'null'],
  ['NULL', 'null'],
  ['None', 'null'],
  ['NONE', 'null'],
  ['nil', 'null'],
  ['Nil', 'null'],
  ['NIL', 'null'],
  ['undefined', 'null'],
  ['NaN', 'null'],
  ['nan', 'null'],
  ['NAN', 'null'],
  ['Infinity', 'null'],
  ['-Infinity', 'null'],
  ['+Infinity', 'null'],
  ['inf', 'null'],
  ['-inf', 'null'],
]);

const STRUCTURAL = new Set(['{', '}', '[', ']', ',', ':', ';']);

const OPENER_FOR = new Map<string, string>([
  ['}', '{'],
  [']', '['],
]);

const DIGIT = /[0-9]/;
const WORD_CHAR = /[A-Za-z0-9]/;
const HEX_QUAD = /^[0-9a-fA-F]{4}$/;
const TRAILING_SPACE = /\s+$/;
const TRAILING_QUOTE = /["'`‘’“”]+$/;

/** A number cannot end mid-word: `5px`, `1.2.3` and `2024-01-01` are strings, not numbers. */
const NUMBER_SUFFIX = /[A-Za-z0-9._+:-]/;
const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** Sticky, so tokens are matched in place instead of slicing multi-megabyte documents. */
const NUMBER_TOKEN =
  /[+-]?(?:0[xX][0-9a-fA-F][0-9a-fA-F_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d*)?)/y;
const KEYWORD_TOKEN = /(?:true|false|null)(?![\w$])/y;

/** The first fenced block in a chat reply, closed or not, with any prose around it. */
const FENCE_BLOCK = /(?:^|\n)[ \t]*```[a-z0-9]*[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*```|$)/i;
const BARE_QUOTE = /(?:^|[^\\])"/;
const QUOTED_MEMBER = /^["'\u2018\u2019\u201c\u201d][^\n]*?["'\u2018\u2019\u201c\u201d][ \t]*:/;
const BARE_MEMBER = /^[A-Za-z_$][\w$]*[ \t]*:/;

const isQuote = (ch: string): boolean => CLOSING_QUOTE.has(ch);

export const repairJson = (input: string): RepairResult => {
  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const strippedMark = source !== input;

  if (parseJson(source).ok) {
    return { text: source, changed: strippedMark, fixes: strippedMark ? [FIX.byteOrderMark] : [] };
  }
  if (!source.trim()) return { text: input, changed: false, fixes: [] };

  const fixes: string[] = [];
  const noteFix: NoteFix = (fix) => {
    if (!fixes.includes(fix)) fixes.push(fix);
  };
  if (strippedMark) noteFix(FIX.byteOrderMark);

  const text = repairDocument(prepare(source.trim(), noteFix), noteFix);
  return { text, changed: text !== input, fixes };
};

const prepare = (text: string, noteFix: NoteFix): string => {
  const unfenced = stripCodeFence(text, noteFix).trim();
  const unescaped = unescapeDocument(unfenced, noteFix).trim();
  return restoreMissingOpeners(unescaped, noteFix);
};

const stripCodeFence = (text: string, noteFix: NoteFix): string => {
  const fenced = FENCE_BLOCK.exec(text);
  if (!fenced) return text;
  noteFix(FIX.codeFence);
  return fenced[1];
};

/** Documents pasted out of logs arrive escaped — `{\"a\":1}` — with every quote backslashed. */
const unescapeDocument = (text: string, noteFix: NoteFix): string => {
  if (!text.includes('\\"') || BARE_QUOTE.test(text)) return text;
  const parsed = parseJson(`"${text.replace(/\r/g, '').replace(/\n/g, '\\n')}"`);
  if (!parsed.ok || typeof parsed.value !== 'string') return text;
  noteFix(FIX.unescaped);
  return parsed.value;
};

/** A fragment copied out of the middle of a document — `"a": 1}` — is missing its opener. */
const restoreMissingOpeners = (text: string, noteFix: NoteFix): string => {
  if (text[0] === '{' || text[0] === '[') return text;

  const orphans = orphanClosers(text);
  if (orphans.length) {
    noteFix(FIX.missingOpener);
    return `${orphans.map(openerFor).reverse().join('')}${text}`;
  }

  if (QUOTED_MEMBER.test(text) || (BARE_MEMBER.test(text) && !text.includes('{'))) {
    noteFix(FIX.missingOpener);
    return `{${text}`;
  }
  return text;
};

const openerFor = (closer: string): string => OPENER_FOR.get(closer) ?? '{';

/** Closing brackets that never had an opener, in the order they appear. */
const orphanClosers = (text: string): string[] => {
  const stack: string[] = [];
  const orphans: string[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (isQuote(ch)) {
      i = skipQuoted(text, i);
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      // A foreign closer ends the container it interrupts and then falls through to the
      // parent, which is how the reader below treats it too.
      while (stack.length && stack[stack.length - 1] !== openerFor(ch)) stack.pop();
      if (stack.length) stack.pop();
      else orphans.push(ch);
    }
    i++;
  }
  return orphans;
};

const skipQuoted = (text: string, from: number): number => {
  const closer = CLOSING_QUOTE.get(text[from]) ?? '"';
  let i = from + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === closer) return i + 1;
    i++;
  }
  return text.length;
};

const normalizeNumber = (token: string): string | null => {
  const compact = token.replace(/_/g, '');
  const sign = compact[0] === '-' ? '-' : '';
  const body = compact.replace(/^[+-]/, '');

  if (/^0[xXbBoO]/.test(body)) {
    const value = Number(body);
    return Number.isFinite(value) ? `${sign}${value}` : null;
  }

  const digits = body
    .replace(/[eE][+-]?$/, '')
    .replace(/\.(?=[eE]|$)/, '')
    .replace(/^\./, '0.')
    .replace(/^0+(?=\d)/, '');

  const candidate = `${sign}${digits}`;
  return JSON_NUMBER.test(candidate) ? candidate : null;
};

/**
 * A tolerant recursive-descent reader. It never throws: every malformed construct is
 * corrected in place or skipped, so the emitted text is always valid JSON.
 */
const repairDocument = (text: string, noteFix: NoteFix): string => {
  const length = text.length;
  let index = 0;

  const at = (offset = 0): string => text[index + offset] ?? '';

  const isAtLineStart = (): boolean => {
    for (let i = index - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '\n') return true;
      if (ch !== ' ' && ch !== '\t' && ch !== '\r') return false;
    }
    return true;
  };

  const skipLineComment = () => {
    noteFix(FIX.comments);
    while (index < length && text[index] !== '\n') index++;
  };

  const skipBlockComment = () => {
    noteFix(FIX.comments);
    index += 2;
    while (index < length && !(text[index] === '*' && text[index + 1] === '/')) index++;
    index = Math.min(index + 2, length);
  };

  const isJsonSpace = (ch: string): boolean =>
    ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r';

  /** Form feeds, vertical tabs, non-breaking spaces and stray marks JSON does not allow. */
  const isForeignSpace = (ch: string): boolean =>
    ch === '\f' || ch === '\v' || ch === '\u00a0' || ch === '\ufeff';

  const skipTrivia = () => {
    while (index < length) {
      const ch = text[index];
      if (isJsonSpace(ch)) {
        index++;
        continue;
      }
      if (isForeignSpace(ch)) {
        noteFix(FIX.whitespace);
        index++;
        continue;
      }
      if (ch === '/' && text[index + 1] === '*') {
        skipBlockComment();
        continue;
      }
      if (ch === '/' && text[index + 1] === '/') {
        skipLineComment();
        continue;
      }
      if (ch === '#' && isAtLineStart()) {
        skipLineComment();
        continue;
      }
      break;
    }
  };

  // Remembers the offset past which a quote character no longer occurs, so unterminated
  // strings cannot turn the look-ahead below into a quadratic scan.
  const exhaustedQuotes = new Map<string, number>();

  const hasQuoteAhead = (closer: string, from: number): boolean => {
    const exhausted = exhaustedQuotes.get(closer);
    if (exhausted !== undefined && from >= exhausted) return false;
    for (let i = from; i < length; i++) {
      if (text[i] === '\\') {
        i++;
        continue;
      }
      if (text[i] === closer) return true;
    }
    exhaustedQuotes.set(closer, from);
    return false;
  };

  /**
   * In `'it's here'` a quote glued to a letter is an apostrophe, since a real closer still
   * follows. Double quotes keep the strict rule: the first one always ends the string.
   */
  const closesString = (closer: string): boolean =>
    closer === '"' || !WORD_CHAR.test(at(1)) || !hasQuoteAhead(closer, index + 1);

  const readEscape = (): string => {
    const next = at(1);
    if (!next) {
      noteFix(FIX.escapes);
      index++;
      return '\\';
    }
    if (next === 'u') {
      const hex = text.slice(index + 2, index + 6);
      if (HEX_QUAD.test(hex)) {
        index += 6;
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      noteFix(FIX.escapes);
      index += 2;
      return '\\u';
    }
    const decoded = ESCAPED_CHARS.get(next);
    index += 2;
    if (decoded !== undefined) return decoded;
    // An unknown escape is a literal backslash the author forgot to double, as in `C:\temp`.
    noteFix(FIX.escapes);
    return `\\${next}`;
  };

  const readString = (): string => {
    const closer = CLOSING_QUOTE.get(text[index]) ?? '"';
    if (text[index] !== '"') noteFix(FIX.quotes);
    index++;

    const terminated = hasQuoteAhead(closer, index);
    if (!terminated) noteFix(FIX.unterminated);

    let value = '';
    let chunk = index;
    while (index < length) {
      const ch = text[index];
      if (ch === '\\') {
        value += text.slice(chunk, index) + readEscape();
        chunk = index;
        continue;
      }
      if (ch === closer && closesString(closer)) {
        value += text.slice(chunk, index);
        index++;
        return value;
      }
      if (!terminated && (ch === '\n' || ch === '\r')) break;
      if (ch < ' ') noteFix(FIX.control);
      index++;
    }

    value += text.slice(chunk, index);
    return terminated ? value : value.replace(TRAILING_SPACE, '');
  };

  const readStringValue = (): string => {
    let value = readString();
    for (;;) {
      const resume = index;
      skipTrivia();
      if (at() !== '+') {
        index = resume;
        break;
      }
      index++;
      skipTrivia();
      if (!isQuote(at())) {
        index = resume;
        break;
      }
      noteFix(FIX.concatenation);
      value += readString();
    }
    return JSON.stringify(value);
  };

  const readNumber = (): string | null => {
    NUMBER_TOKEN.lastIndex = index;
    const matched = NUMBER_TOKEN.exec(text);
    if (!matched) return null;

    const token = matched[0];
    if (NUMBER_SUFFIX.test(at(token.length))) return null;

    const normalized = normalizeNumber(token);
    if (normalized === null) return null;
    index += token.length;
    if (normalized !== token) noteFix(FIX.number);
    return normalized;
  };

  const readBareToken = (): string => {
    const start = index;
    while (index < length) {
      const ch = text[index];
      if (ch === '\n' || ch === '\r' || isQuote(ch)) break;
      if (ch === ':') {
        // `https://…` and `12:30` keep their colon; anything else starts the next member.
        if (at(1) === '/' && at(2) === '/') {
          index += 3;
          continue;
        }
        if (!DIGIT.test(at(1))) break;
      } else if (STRUCTURAL.has(ch)) break;
      if (ch === '/' && (at(1) === '/' || at(1) === '*') && !WORD_CHAR.test(at(-1))) break;
      index++;
    }
    return text.slice(start, index).trim();
  };

  const readBareValue = (): string | null => {
    const token = readBareToken();
    if (!token) return null;

    const literal = LITERALS.get(token);
    if (literal !== undefined) {
      if (literal !== token) noteFix(FIX.literal);
      return literal;
    }
    noteFix(FIX.bareValue);
    return JSON.stringify(token);
  };

  const readKey = (): string | null => {
    if (isQuote(at())) return JSON.stringify(readString());

    const start = index;
    while (index < length) {
      const ch = text[index];
      if (STRUCTURAL.has(ch) || ch === '=' || ch === '\n' || ch === '\r') break;
      index++;
    }
    // A trailing quote is the orphaned opener of a key whose partner closed the value
    // before it, as in `{"a": "unterminated, "b": 1}`.
    const key = text.slice(start, index).trim().replace(TRAILING_QUOTE, '');
    if (!key) return null;
    noteFix(FIX.bareKey);
    return JSON.stringify(key);
  };

  const readKeySeparator = () => {
    skipTrivia();
    if (at() === ':') {
      index++;
      return;
    }
    noteFix(FIX.separator);
    if (at() === '=') {
      index++;
      if (at() === '>') index++;
    }
  };

  const readItemSeparator = (): boolean => {
    const ch = at();
    if (ch !== ',' && ch !== ';') return false;
    if (ch === ';') noteFix(FIX.semicolon);
    index++;
    return true;
  };

  let depth = 0;

  /** Emits null in place of a container too deep to recurse into, and steps over it. */
  const skipDeepContainer = (): string => {
    noteFix(FIX.tooDeep);
    let level = 0;
    while (index < length) {
      const ch = text[index];
      if (isQuote(ch)) {
        index = skipQuoted(text, index);
        continue;
      }
      if (ch === '{' || ch === '[') level++;
      else if (ch === '}' || ch === ']') {
        level--;
        index++;
        if (level <= 0) break;
        continue;
      }
      index++;
    }
    return 'null';
  };

  const readContainer = (opener: string): string => {
    if (depth >= MAX_DEPTH) return skipDeepContainer();
    depth++;
    const container = opener === '{' ? readObject() : readArray();
    depth--;
    return container;
  };

  const readValue = (): string | null => {
    skipTrivia();
    const ch = at();
    if (ch === '{' || ch === '[') return readContainer(ch);
    if (!ch || STRUCTURAL.has(ch)) return null;
    if (isQuote(ch)) return readStringValue();
    return readNumber() ?? readBareValue();
  };

  const readObject = (): string => {
    index++;
    const members: string[] = [];
    let pendingComma = false;

    for (;;) {
      skipTrivia();
      const ch = at();

      if (!ch || ch === '}' || ch === ']') {
        if (pendingComma) noteFix(FIX.trailingComma);
        if (ch === '}') index++;
        // A foreign closer belongs to the parent container, so it is left in place.
        else noteFix(ch ? FIX.mismatched : FIX.missingCloser);
        break;
      }

      if (readItemSeparator()) {
        if (pendingComma || !members.length) noteFix(FIX.strayComma);
        pendingComma = true;
        continue;
      }

      const key = readKey();
      if (key === null) {
        index++;
        continue;
      }

      readKeySeparator();
      const value = readValue();
      if (value === null) noteFix(FIX.emptyValue);
      members.push(`${key}:${value ?? 'null'}`);
      pendingComma = false;

      skipTrivia();
      if (readItemSeparator()) {
        pendingComma = true;
        continue;
      }
      const after = at();
      if (after && after !== '}' && after !== ']') noteFix(FIX.missingComma);
    }

    return `{${members.join(',')}}`;
  };

  const readArray = (): string => {
    index++;
    const items: string[] = [];
    let pendingComma = false;

    for (;;) {
      skipTrivia();
      const ch = at();

      if (!ch || ch === ']' || ch === '}') {
        if (pendingComma) noteFix(FIX.trailingComma);
        if (ch === ']') index++;
        else noteFix(ch ? FIX.mismatched : FIX.missingCloser);
        break;
      }

      if (readItemSeparator()) {
        if (pendingComma || !items.length) noteFix(FIX.strayComma);
        pendingComma = true;
        continue;
      }

      const value = readValue();
      if (value === null) {
        index++;
        continue;
      }
      items.push(value);
      pendingComma = false;

      skipTrivia();
      if (readItemSeparator()) {
        pendingComma = true;
        continue;
      }
      const after = at();
      if (after && after !== ']' && after !== '}') noteFix(FIX.missingComma);
    }

    return `[${items.join(',')}]`;
  };

  const startsDocument = (): boolean => {
    const ch = at();
    if (ch === '{' || ch === '[' || ch === '}' || ch === ']' || isQuote(ch)) return true;
    if (ch === '-' || ch === '+' || DIGIT.test(ch)) return true;
    KEYWORD_TOKEN.lastIndex = index;
    return KEYWORD_TOKEN.test(text);
  };

  const skipLeadingProse = () => {
    skipTrivia();
    if (startsDocument()) return;
    const brace = text.indexOf('{', index);
    const bracket = text.indexOf('[', index);
    const start = brace === -1 ? bracket : bracket === -1 ? brace : Math.min(brace, bracket);
    if (start === -1) return;
    index = start;
    noteFix(FIX.prose);
  };

  const readDocument = (): string => {
    const values: string[] = [];
    skipLeadingProse();

    while (index < length) {
      skipTrivia();
      if (index >= length) break;

      const ch = at();
      if (ch === '}' || ch === ']') {
        index++;
        noteFix(FIX.strayCloser);
        continue;
      }
      if (readItemSeparator()) continue;

      const value = readValue();
      if (value === null) {
        index++;
        continue;
      }
      values.push(value);

      skipTrivia();
      while (readItemSeparator()) skipTrivia();
      if (index < length && !startsDocument()) {
        noteFix(FIX.prose);
        break;
      }
    }

    if (!values.length) return '';
    if (values.length === 1) return values[0];
    noteFix(FIX.merged);
    return `[${values.join(',')}]`;
  };

  return readDocument();
};

export const parseNdjson = (text: string): JsonValue[] | null => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return null;

  const values: JsonValue[] = [];
  for (const line of lines) {
    const result = parseJson(line);
    if (!result.ok) return null;
    values.push(result.value);
  }
  return values;
};
