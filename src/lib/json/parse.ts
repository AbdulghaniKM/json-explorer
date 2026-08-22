import type { JsonValue } from './types';

export interface JsonParseError {
  message: string;
  line: number;
  column: number;
  index: number;
}

export type JsonParseResult = { ok: true; value: JsonValue } | { ok: false; error: JsonParseError };

export const positionOf = (text: string, index: number): { line: number; column: number } => {
  const clamped = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: clamped - lastBreak };
};

export const indexOfPosition = (text: string, line: number, column: number): number => {
  const lines = text.split('\n');
  let index = 0;
  for (let i = 0; i < Math.min(line - 1, lines.length); i++) index += lines[i].length + 1;
  return index + Math.max(0, column - 1);
};

const cleanMessage = (raw: string): string =>
  raw
    .replace(/^JSON\.parse:\s*/i, '')
    .replace(/^JSON Parse error:\s*/i, '')
    .replace(/\s*in JSON at position \d+.*$/i, '')
    .replace(/\s*at line \d+ column \d+ of the JSON data\.?$/i, '')
    .replace(/\s*of the JSON data\.?$/i, '')
    .trim();

const toParseError = (error: unknown, text: string): JsonParseError => {
  const raw = error instanceof Error ? error.message : String(error);
  const message = cleanMessage(raw) || 'Invalid JSON';

  const byPosition = raw.match(/position\s+(\d+)/i);
  if (byPosition) {
    const index = Number(byPosition[1]);
    return { message, index, ...positionOf(text, index) };
  }

  const byLine = raw.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (byLine) {
    const line = Number(byLine[1]);
    const column = Number(byLine[2]);
    return { message, line, column, index: indexOfPosition(text, line, column) };
  }

  return { message, line: 1, column: 1, index: 0 };
};

export const parseJson = (text: string): JsonParseResult => {
  if (!text.trim()) {
    return {
      ok: false,
      error: { message: 'Nothing to parse yet', line: 1, column: 1, index: 0 },
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch (error) {
    return { ok: false, error: toParseError(error, text) };
  }
};

export const errorContext = (text: string, error: JsonParseError): string => {
  const line = text.split('\n')[error.line - 1] ?? '';
  const start = Math.max(0, error.column - 40);
  return line.slice(start, start + 80);
};
