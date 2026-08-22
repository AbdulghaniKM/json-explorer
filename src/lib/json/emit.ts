import type { JsonIndex } from './scan';
import { NODE_ARRAY, NODE_OBJECT } from './scan';
import type { IndentStyle } from './types';

export interface EmitOptions {
  indent?: string;
  sort?: 'asc' | 'desc' | null;
}

export const indentText = (style: IndentStyle): string =>
  style === 'tab' ? '\t' : ' '.repeat(Number(style));

interface Frame {
  id: number;
  level: number;
  remaining: number;
  next: number;
  order: Int32Array | null;
  position: number;
}

const childList = (index: JsonIndex, id: number): Int32Array => {
  const total = index.childCount[id];
  const out = new Int32Array(total);
  let child = id + 1;
  for (let k = 0; k < total; k++) {
    out[k] = child;
    child = index.subtreeEnd[child];
  }
  return out;
};

export const emitJson = (text: string, index: JsonIndex, options: EmitOptions = {}): string => {
  if (index.count === 0) return '';

  const indent = options.indent ?? '';
  const sort = options.sort ?? null;
  const pretty = indent.length > 0;
  const gap = pretty ? ' ' : '';

  const parts: string[] = [];
  let buffer = '';

  const write = (value: string) => {
    buffer += value;
    if (buffer.length > 262_144) {
      parts.push(buffer);
      buffer = '';
    }
  };

  const prefixes: string[] = [];
  const commaPrefixes: string[] = [];

  const prefixFor = (level: number): string => {
    if (!pretty) return '';
    let cached = prefixes[level];
    if (cached === undefined) {
      cached = `\n${indent.repeat(level)}`;
      prefixes[level] = cached;
    }
    return cached;
  };

  const commaPrefixFor = (level: number): string => {
    let cached = commaPrefixes[level];
    if (cached === undefined) {
      cached = `,${prefixFor(level)}`;
      commaPrefixes[level] = cached;
    }
    return cached;
  };

  const isContainer = (id: number) =>
    index.type[id] === NODE_OBJECT || index.type[id] === NODE_ARRAY;

  const keyOf = (id: number) => text.slice(index.keyStart[id], index.keyEnd[id]);

  const frames: Frame[] = [];

  const openValue = (id: number, level: number) => {
    if (!isContainer(id)) {
      write(text.slice(index.valueStart[id], index.valueEnd[id]));
      return;
    }

    const object = index.type[id] === NODE_OBJECT;
    write(object ? '{' : '[');

    const total = index.childCount[id];
    if (total === 0) {
      write(object ? '}' : ']');
      return;
    }

    let order: Int32Array | null = null;
    if (sort && object) {
      order = childList(index, id);
      const keys = new Map<number, string>();
      for (const child of order) keys.set(child, keyOf(child));
      const sorted = [...order].sort((a, b) => {
        const left = keys.get(a) as string;
        const right = keys.get(b) as string;
        if (left === right) return 0;
        const ascending = left < right ? -1 : 1;
        return sort === 'asc' ? ascending : -ascending;
      });
      order = Int32Array.from(sorted);
    }

    frames.push({ id, level, remaining: total, next: id + 1, order, position: 0 });
  };

  openValue(0, 0);

  let pendingComma = false;

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];

    if (frame.remaining === 0) {
      write(
        pretty
          ? `${prefixFor(frame.level)}${index.type[frame.id] === NODE_OBJECT ? '}' : ']'}`
          : index.type[frame.id] === NODE_OBJECT
            ? '}'
            : ']',
      );
      frames.pop();
      pendingComma = frames.length > 0 && frames[frames.length - 1].remaining > 0;
      continue;
    }

    const child = frame.order ? frame.order[frame.position] : frame.next;
    frame.position++;
    frame.next = index.subtreeEnd[child];
    frame.remaining--;

    const level = frame.level + 1;
    const lead = pendingComma ? commaPrefixFor(level) : prefixFor(level);
    pendingComma = false;

    if (index.keyEnd[child] > 0) write(`${lead}"${keyOf(child)}":${gap}`);
    else if (lead) write(lead);

    openValue(child, level);

    if (!isContainer(child) || index.childCount[child] === 0) pendingComma = frame.remaining > 0;
  }

  parts.push(buffer);
  return parts.join('');
};
