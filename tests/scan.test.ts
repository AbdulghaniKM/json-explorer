import { describe, expect, it } from 'vitest';
import { emitJson } from '../src/lib/json/emit';
import { scanJson } from '../src/lib/json/scan';

const scanOk = (text: string) => {
  const r = scanJson(text);
  if (!r.ok) throw new Error(`scan failed: ${r.error.message} @${r.error.line}:${r.error.column}`);
  return r;
};

/** Minify straight from the index. */
const roundTrip = (text: string) => {
  const { index } = scanOk(text);
  return emitJson(text, index, {});
};

describe('scanJson - valid documents', () => {
  const cases: [string, string][] = [
    ['empty object', '{}'],
    ['empty array', '[]'],
    ['nested empties', '{"a":{},"b":[],"c":[{}],"d":[[]]}'],
    ['root number', '123'],
    ['root string', '"hi"'],
    ['root true', 'true'],
    ['root false', 'false'],
    ['root null', 'null'],
    ['flat object', '{"a":1,"b":"two","c":true,"d":null}'],
    ['nested', '{"a":{"b":{"c":[1,2,{"d":3}]}}}'],
    ['array of objects', '[{"a":1},{"a":2},{"a":3}]'],
    ['escaped quotes', '{"a":"he said \\"hi\\""}'],
    ['escaped backslash', '{"a":"c:\\\\path"}'],
    ['escaped control chars', '{"a":"line\\nbreak\\ttab\\r\\f\\b"}'],
    ['unicode escape', '{"a":"\\u00e9\\u4e2d\\u0000"}'],
    ['escaped solidus', '{"a":"a\\/b"}'],
    ['literal unicode', '{"caf\u00e9":"na\u00efve \u4e2d\u6587 \ud83c\udf89"}'],
    ['surrogate pair escape', '{"a":"\\ud83c\\udf89"}'],
    ['numbers', '[-1,1e5,1E5,1e+5,1e-5,-0.5,0,-0]'],
    ['deep nesting', `${'['.repeat(200)}1${']'.repeat(200)}`],
    ['whitespace everywhere', ' {\n\t"a" : [ 1 , 2 ] \r\n} '],
    ['empty key and value', '{"":""}'],
    ['duplicate keys', '{"a":1,"a":2}'],
  ];

  for (const [name, text] of cases) {
    it(`accepts ${name}`, () => {
      expect(scanJson(text).ok, `expected ok for: ${text}`).toBe(true);
    });
  }

  // The engine re-emits source tokens verbatim rather than normalising them the way
  // JSON.parse/stringify would, so it is only equivalent for already-canonical input.
  const canonical = cases.filter(
    ([name]) =>
      ![
        'unicode escape',
        'escaped solidus',
        'surrogate pair escape',
        'numbers',
        'duplicate keys',
      ].includes(name),
  );

  for (const [name, text] of canonical) {
    it(`minifies ${name} like JSON.parse/stringify`, () => {
      expect(roundTrip(text)).toBe(JSON.stringify(JSON.parse(text)));
    });
  }

  it('preserves escape spelling rather than normalising it', () => {
    const text = '{"a":"a\\/b\\u00e9"}';
    expect(roundTrip(text)).toBe(text);
    expect(JSON.parse(roundTrip(text)).a).toBe(JSON.parse(text).a);
  });

  it('preserves every key of a duplicate-key object', () => {
    const text = '{"a":1,"a":2}';
    expect(roundTrip(text)).toBe(text);
  });
});

describe('scanJson - number token preservation', () => {
  it('preserves big integers beyond Number precision', () => {
    const text = '{"id":12345678901234567890}';
    expect(roundTrip(text)).toBe(text);
    expect(JSON.stringify(JSON.parse(text))).not.toBe(text);
  });

  it('preserves trailing-zero decimals', () => {
    const text = '{"a":178.0,"b":1.500,"c":1e10}';
    expect(roundTrip(text)).toBe(text);
  });
});

describe('scanJson - rejects invalid documents', () => {
  const bad: [string, string][] = [
    ['empty input', ''],
    ['whitespace only', '   \n\t '],
    ['trailing comma object', '{"a":1,}'],
    ['trailing comma array', '[1,2,]'],
    ['unquoted key', '{a:1}'],
    ['single quotes', `{'a':1}`],
    ['unclosed object', '{"a":1'],
    ['unclosed array', '[1,2'],
    ['unclosed string', '{"a":"x}'],
    ['missing colon', '{"a" 1}'],
    ['missing comma', '{"a":1 "b":2}'],
    ['bare word', 'undefined'],
    ['NaN', '[NaN]'],
    ['Infinity', '[Infinity]'],
    ['leading zero', '[01]'],
    ['leading plus', '[+1]'],
    ['bare dot number', '[.5]'],
    ['trailing dot number', '[1.]'],
    ['hex number', '[0x10]'],
    ['comment suffix', '{"a":1} // note'],
    ['trailing garbage', '{"a":1}x'],
    ['two roots', '{} {}'],
    ['python literal', '{"a":True}'],
    ['raw newline in string', '{"a":"line\nbreak"}'],
    ['raw tab in string', '{"a":"col\tumn"}'],
    ['bad escape', '{"a":"\\q"}'],
    ['short unicode escape', '{"a":"\\u12"}'],
  ];

  for (const [name, text] of bad) {
    it(`rejects ${name}`, () => {
      expect(scanJson(text).ok, `expected failure for: ${JSON.stringify(text)}`).toBe(false);
    });
  }
});

describe('scanJson - prototype safety', () => {
  it('does not pollute Object.prototype via __proto__ key', () => {
    expect(scanJson('{"__proto__":{"polluted":true},"constructor":{"x":1}}').ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('counts __proto__ as a normal key', () => {
    expect(scanOk('{"__proto__":1}').stats.totalKeys).toBe(1);
  });
});

describe('scanJson - line endings and BOM', () => {
  it('handles CRLF', () => {
    expect(scanJson('{\r\n"a": 1\r\n}').ok).toBe(true);
  });

  it('has a defined answer for a UTF-8 BOM', () => {
    expect(typeof scanJson('\uFEFF{"a":1}').ok).toBe('boolean');
  });
});

describe('emitJson - beautify', () => {
  it('beautifies with 2 spaces', () => {
    const text = '{"a":1,"b":[1,2]}';
    const { index } = scanOk(text);
    expect(emitJson(text, index, { indent: '  ' })).toBe(JSON.stringify(JSON.parse(text), null, 2));
  });

  it('beautifies nested structures like JSON.stringify', () => {
    const text = '{"a":{"b":{"c":[1,2,{"d":3}]}},"e":[],"f":{}}';
    const { index } = scanOk(text);
    expect(emitJson(text, index, { indent: '  ' })).toBe(JSON.stringify(JSON.parse(text), null, 2));
  });

  it('beautify then rescan then minify is stable', () => {
    const text = '{"a":{"b":[1,2,{"c":"x"}]},"d":null}';
    const { index } = scanOk(text);
    expect(roundTrip(emitJson(text, index, { indent: '  ' }))).toBe(text);
  });
});

describe('emitJson - sort keys', () => {
  it('sorts ascending at every level', () => {
    const text = '{"b":1,"a":{"d":1,"c":2}}';
    const { index } = scanOk(text);
    expect(emitJson(text, index, { sort: 'asc' })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it('sorts descending', () => {
    const text = '{"a":1,"b":2}';
    const { index } = scanOk(text);
    expect(emitJson(text, index, { sort: 'desc' })).toBe('{"b":2,"a":1}');
  });

  it('does not reorder array elements', () => {
    const text = '[3,1,2]';
    const { index } = scanOk(text);
    expect(emitJson(text, index, { sort: 'asc' })).toBe('[3,1,2]');
  });
});

describe('scanJson - stats', () => {
  it('reports type counts and depth', () => {
    const { stats } = scanOk('{"a":[1,"x",true,null],"b":{"c":1}}');
    expect(stats.rootType).toBe('object');
    expect(stats.counts.number).toBe(2);
    expect(stats.counts.string).toBe(1);
    expect(stats.counts.boolean).toBe(1);
    expect(stats.counts.null).toBe(1);
    expect(stats.counts.array).toBe(1);
    expect(stats.counts.object).toBe(2);
    expect(stats.depth).toBeGreaterThanOrEqual(2);
  });

  it('counts bytes as UTF-8, not UTF-16 units', () => {
    const text = '{"a":"\u20ac"}';
    expect(scanOk(text).stats.bytes).toBe(new TextEncoder().encode(text).length);
  });

  it('counts astral-plane characters as 4 UTF-8 bytes', () => {
    const text = '{"a":"\ud83c\udf89"}';
    expect(scanOk(text).stats.bytes).toBe(new TextEncoder().encode(text).length);
  });
});
