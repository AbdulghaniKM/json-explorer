import type { JsonValue } from './types';
import { parseJson } from './parse';

export interface RepairResult {
  text: string;
  changed: boolean;
}

const QUOTES: Record<string, string> = {
  '"': '"',
  "'": "'",
  '‘': '’',
  '’': '’',
  '“': '”',
  '”': '”',
  '`': '`',
};

const KEYWORDS: Record<string, string> = {
  true: 'true',
  false: 'false',
  null: 'null',
  True: 'true',
  False: 'false',
  None: 'null',
  TRUE: 'true',
  FALSE: 'false',
  NULL: 'null',
  undefined: 'null',
  NaN: 'null',
  nan: 'null',
  Infinity: 'null',
};

const VALID_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

const isIdentifierStart = (ch: string): boolean => /[A-Za-z_$]/.test(ch);
const isIdentifierPart = (ch: string): boolean => /[A-Za-z0-9_$]/.test(ch);

export const repairJson = (input: string): RepairResult => {
  const text = input.replace(/^\uFEFF/, '').trim();
  const length = text.length;
  let out = '';
  let i = 0;

  const skipTrivia = (from: number): number => {
    let j = from;
    while (j < length) {
      const ch = text[j];
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        j++;
        continue;
      }
      if (ch === '/' && text[j + 1] === '/') {
        while (j < length && text[j] !== '\n') j++;
        continue;
      }
      if (ch === '/' && text[j + 1] === '*') {
        j += 2;
        while (j < length && !(text[j] === '*' && text[j + 1] === '/')) j++;
        j += 2;
        continue;
      }
      break;
    }
    return j;
  };

  while (i < length) {
    const ch = text[i];

    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipTrivia(i);
      continue;
    }

    if (ch in QUOTES) {
      const closing = QUOTES[ch];
      let value = '';
      i++;
      while (i < length) {
        const current = text[i];
        if (current === '\\') {
          const next = text[i + 1] ?? '';
          if (VALID_ESCAPES.has(next)) value += `\\${next}`;
          else if (next === "'") value += "'";
          else value += next;
          i += 2;
          continue;
        }
        if (current === closing) {
          i++;
          break;
        }
        if (current === '"') {
          value += '\\"';
          i++;
          continue;
        }
        if (current === '\n') {
          value += '\\n';
          i++;
          continue;
        }
        if (current === '\r') {
          value += '\\r';
          i++;
          continue;
        }
        if (current === '\t') {
          value += '\\t';
          i++;
          continue;
        }
        value += current;
        i++;
      }
      out += `"${value}"`;
      continue;
    }

    if (ch === ',') {
      const next = skipTrivia(i + 1);
      const following = text[next];
      if (following === '}' || following === ']' || next >= length) {
        i++;
        continue;
      }
      out += ',';
      i++;
      continue;
    }

    if (isIdentifierStart(ch)) {
      let word = '';
      while (i < length && isIdentifierPart(text[i])) {
        word += text[i];
        i++;
      }
      out += word in KEYWORDS ? KEYWORDS[word] : JSON.stringify(word);
      continue;
    }

    out += ch;
    i++;
  }

  const balanced = closeOpenContainers(out);
  return { text: balanced, changed: balanced !== input };
};

const closeOpenContainers = (text: string): string => {
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = inString ? `${text}"` : text;
  while (stack.length) out += stack.pop() === '{' ? '}' : ']';
  return out;
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
