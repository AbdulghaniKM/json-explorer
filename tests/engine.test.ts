import { describe, expect, it } from 'vitest';
import {
  dotnetFromShape,
  jsonToCsv,
  jsonToQueryString,
  jsonToYaml,
  typeScriptFromShape,
} from '../src/lib/json/convert';
import { shapeOfIndex } from '../src/lib/json/convert';
import { deepEqual, diffJson } from '../src/lib/json/diff';
import {
  byteLength,
  escapeToJsonString,
  formatBytes,
  minifyJson,
  removeEmptyValues,
  unescapeJsonString,
} from '../src/lib/json/format';
import { highlightJson } from '../src/lib/json/highlight';
import { parseJson, positionOf } from '../src/lib/json/parse';
import { scanJson } from '../src/lib/json/scan';

describe('highlightJson - XSS safety', () => {
  // Both `v-html` sinks in the app (Editor.vue, LineViewer.vue) are fed only by
  // this function, so escaping here is the only thing standing between a pasted
  // document and script execution.
  const hostile = [
    '{"a":"<script>alert(1)</script>"}',
    '{"<img src=x onerror=alert(1)>":"v"}',
    '{"a":"</code></pre><script>alert(1)</script>"}',
    '{"a":"<svg/onload=alert(1)>"}',
    '{"a":"<iframe src=javascript:alert(1)>"}',
  ];

  for (const text of hostile) {
    it(`escapes tags in ${text.slice(0, 32)}...`, () => {
      const html = highlightJson(text);
      expect(html).not.toContain('<script');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('</code>');
      // The only tags it may emit are its own token spans.
      const tags = html.match(/<[^>]*>/g) ?? [];
      for (const tag of tags) {
        expect(tag).toMatch(/^<\/?span( class="tok-(key|str|num|bool|null)")?>$/);
      }
    });
  }

  it('escapes ampersands before angle brackets (no double-escaping)', () => {
    expect(highlightJson('{"a":"&lt;b&gt;"}')).toContain('&amp;lt;b&amp;gt;');
  });

  it('still highlights ordinary tokens', () => {
    const html = highlightJson('{"a":1,"b":true,"c":null,"d":"x"}');
    expect(html).toContain('tok-key');
    expect(html).toContain('tok-num');
    expect(html).toContain('tok-bool');
    expect(html).toContain('tok-null');
    expect(html).toContain('tok-str');
  });
});

describe('parseJson', () => {
  it('reports a 1-based line and column for an error', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": }\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBeGreaterThanOrEqual(1);
      expect(r.error.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('positionOf is 1-based at the very start', () => {
    expect(positionOf('abc', 0)).toEqual({ line: 1, column: 1 });
  });

  it('positionOf counts newlines', () => {
    expect(positionOf('a\nbc', 3)).toEqual({ line: 2, column: 2 });
  });

  it('parses valid input', () => {
    const r = parseJson('{"a":[1,2]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: [1, 2] });
  });
});

describe('format helpers', () => {
  it('minifies', () => {
    expect(minifyJson({ a: 1, b: [1, 2] })).toBe('{"a":1,"b":[1,2]}');
  });

  it('removes empty values recursively, cascading to containers left empty', () => {
    expect(removeEmptyValues({ a: 1, b: null, c: '', d: [], e: {}, f: { g: null } })).toEqual({
      a: 1,
    });
  });

  it('keeps false and 0, which are not empty', () => {
    expect(removeEmptyValues({ a: false, b: 0 })).toEqual({ a: false, b: 0 });
  });

  it('round-trips escape/unescape', () => {
    const raw = 'line\nbreak "quoted" \\ tab\t';
    expect(unescapeJsonString(escapeToJsonString(raw))).toBe(raw);
  });

  it('measures UTF-8 byte length', () => {
    expect(byteLength('€')).toBe(3);
    expect(byteLength('🎉')).toBe(4);
    expect(byteLength('abc')).toBe(3);
  });

  it('formats byte counts', () => {
    expect(formatBytes(0)).toMatch(/0/);
    expect(formatBytes(1024)).toMatch(/KB|kB/i);
  });
});

describe('deepEqual', () => {
  it('ignores key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('respects array order', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('distinguishes null from missing and from 0', () => {
    expect(deepEqual(null, 0)).toBe(false);
    expect(deepEqual({ a: null }, {})).toBe(false);
  });

  it('distinguishes types that stringify alike', () => {
    expect(deepEqual('1', 1)).toBe(false);
    expect(deepEqual(true, 1)).toBe(false);
  });
});

describe('diffJson', () => {
  it('reports no changes for equal documents', () => {
    const { summary } = diffJson({ a: 1 }, { a: 1 });
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.changed).toBe(0);
  });

  it('counts an added key', () => {
    const { summary } = diffJson({ a: 1 }, { a: 1, b: 2 });
    expect(summary.added).toBe(1);
  });

  it('counts a removed key', () => {
    const { summary } = diffJson({ a: 1, b: 2 }, { a: 1 });
    expect(summary.removed).toBe(1);
  });

  it('counts a changed value', () => {
    const { summary } = diffJson({ a: 1 }, { a: 2 });
    expect(summary.changed).toBe(1);
  });

  it('treats key order as insignificant', () => {
    const { summary } = diffJson({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(summary.added + summary.removed + summary.changed).toBe(0);
  });

  it('can ignore array order', () => {
    // Ordered, a reorder aligns via LCS: the shared element stays, the rest is add/remove.
    const ordered = diffJson([1, 2, 3], [3, 2, 1]);
    expect(ordered.summary.identical).toBe(false);
    expect(ordered.summary.added + ordered.summary.removed).toBeGreaterThan(0);

    const unordered = diffJson([1, 2, 3], [3, 2, 1], { ignoreArrayOrder: true });
    expect(unordered.summary.identical).toBe(true);
  });

  it('reports a replaced element as changed, not add+remove', () => {
    expect(diffJson([1, 2, 3], [1, 2, 4]).summary.changed).toBe(1);
  });

  it('reports appended and truncated elements', () => {
    expect(diffJson([1, 2], [1, 2, 3]).summary.added).toBe(1);
    expect(diffJson([1, 2, 3], [1, 2]).summary.removed).toBe(1);
  });

  it('does not blow the stack on deeply nested input', () => {
    let left: unknown = 1;
    let right: unknown = 2;
    for (let i = 0; i < 400; i++) {
      left = { nested: left };
      right = { nested: right };
    }
    expect(() => diffJson(left as never, right as never)).not.toThrow();
  });
});

const shapeOf = (text: string) => {
  const r = scanJson(text);
  if (!r.ok) throw new Error('scan failed');
  return shapeOfIndex(text, r.index);
};

describe('convert - TypeScript', () => {
  it('emits an interface for a flat object', () => {
    const ts = typeScriptFromShape(shapeOf('{"id":1,"name":"x","ok":true}'), 'Root');
    expect(ts).toContain('interface Root');
    expect(ts).toMatch(/id: number/);
    expect(ts).toMatch(/name: string/);
    expect(ts).toMatch(/ok: boolean/);
  });

  it('quotes keys that are not valid identifiers', () => {
    const ts = typeScriptFromShape(shapeOf('{"not-an-ident":1}'), 'Root');
    expect(ts).toMatch(/["']not-an-ident["']/);
  });
});

describe('convert - shape inference', () => {
  it('keeps a decimal literal a decimal even when it holds a whole number', () => {
    const ts = typeScriptFromShape(shapeOf('{"a":178.0,"b":178}'), 'Root');
    expect(ts).toMatch(/a: number/);
    expect(ts).toMatch(/b: number/);
    const cs = dotnetFromShape(shapeOf('{"a":178.0,"b":178}'), 'Root');
    expect(cs).toMatch(/double A/);
    expect(cs).toMatch(/int B/);
  });

  it('lets a known element type win over an empty array', () => {
    const ts = typeScriptFromShape(shapeOf('{"tags":[["a"],[]]}'), 'Root');
    expect(ts).toMatch(/tags: string\[]\[]/);
    expect(ts).not.toContain('unknown');
  });

  it('widens integers to long past the int32 range', () => {
    expect(dotnetFromShape(shapeOf('{"n":9999999999}'), 'Root')).toMatch(/long N/);
  });
});

describe('convert - .NET DTO', () => {
  it('emits sealed records with required init-only properties', () => {
    const cs = dotnetFromShape(shapeOf('{"id":1,"name":"x"}'), 'Order');
    expect(cs).toContain('public sealed record OrderDto');
    expect(cs).toContain('[JsonPropertyName("id")]');
    expect(cs).toContain('public required int Id { get; init; }');
    expect(cs).toContain('using System.Text.Json.Serialization;');
  });

  it('drops required and adds ? for keys missing from some array items', () => {
    const cs = dotnetFromShape(shapeOf('{"rows":[{"a":1},{"a":1,"b":"x"}]}'), 'Root');
    expect(cs).toContain('public string? B { get; init; }');
    expect(cs).not.toContain('required string? B');
  });

  it('collapses a nullable union into a nullable property', () => {
    const cs = dotnetFromShape(shapeOf('{"rows":[{"a":"x"},{"a":null}]}'), 'Root');
    expect(cs).toContain('public string? A { get; init; }');
    expect(cs).not.toContain('JsonElement');
  });

  it('uses IReadOnlyList and names nested records after their key', () => {
    const cs = dotnetFromShape(shapeOf('{"items":[{"sku":"a"}]}'), 'Root');
    expect(cs).toContain('IReadOnlyList<ItemDto> Items');
    expect(cs).toContain('public sealed record ItemDto');
    expect(cs).toContain('using System.Collections.Generic;');
  });

  it('falls back to JsonElement for a genuinely mixed array', () => {
    const cs = dotnetFromShape(shapeOf('{"mixed":[1,"a"]}'), 'Root');
    expect(cs).toContain('IReadOnlyList<JsonElement>');
    expect(cs).toContain('using System.Text.Json;');
  });

  it('emits a bodyless record for an empty object', () => {
    expect(dotnetFromShape(shapeOf('{"empty":{}}'), 'Root')).toContain(
      'public sealed record EmptyDto;',
    );
  });

  it('pascal-cases keys that are not valid identifiers', () => {
    const cs = dotnetFromShape(shapeOf('{"not-an-ident":1}'), 'Root');
    expect(cs).toContain('[JsonPropertyName("not-an-ident")]');
    expect(cs).toContain('NotAnIdent { get; init; }');
  });
});

describe('convert - YAML', () => {
  it('emits nested mappings and sequences', () => {
    const yaml = jsonToYaml({ a: 1, b: ['x', 'y'], c: { d: true } });
    expect(yaml).toContain('a: 1');
    expect(yaml).toContain('- x');
    expect(yaml).toContain('d: true');
  });

  it('quotes strings that would otherwise parse as another type', () => {
    const yaml = jsonToYaml({ a: 'true', b: '123', c: 'yes', d: '' });
    expect(yaml).toMatch(/a: ["']true["']/);
    expect(yaml).toMatch(/b: ["']123["']/);
  });

  it('escapes strings containing a colon or newline', () => {
    const yaml = jsonToYaml({ a: 'key: value', b: 'line\nbreak' });
    expect(yaml).not.toMatch(/^a: key: value$/m);
  });
});

describe('convert - CSV', () => {
  it('emits a header row and one row per record', () => {
    const csv = jsonToCsv([
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ]);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('a');
    expect(lines[0]).toContain('b');
  });

  it('quotes fields containing the delimiter, quotes or newlines', () => {
    const csv = jsonToCsv([{ a: 'x,y', b: 'say "hi"', c: 'line\nbreak' }]);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('""hi""');
  });

  it('does not let a field break out into extra columns', () => {
    const csv = jsonToCsv([{ a: 'x,y', b: 'z' }]);
    const dataLine = csv.trim().split(/\r?\n/)[1];
    // 2 columns => exactly one delimiter outside quotes
    expect(dataLine.replace(/"[^"]*"/g, '').split(',').length).toBe(2);
  });
});

describe('convert - query string', () => {
  it('encodes keys and values (form-urlencoded, so space is +)', () => {
    const qs = jsonToQueryString({ 'a b': 'c&d', e: 1 });
    expect(qs).toContain('a+b=c%26d');
    expect(qs).toContain('e=1');
    // The separator must survive a round trip through a real parser.
    expect(new URLSearchParams(qs).get('a b')).toBe('c&d');
  });
});
