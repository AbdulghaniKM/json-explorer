import { describe, expect, it } from 'vitest';
import { handleEngineRequest, repairNote } from '../src/lib/json/engine';
import { repairJson } from '../src/lib/json/repair';

const repaired = (broken: string) => {
  const { text } = repairJson(broken);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`repair produced unparseable output: ${text}\n${(error as Error).message}`);
  }
};

describe('repairJson - brackets', () => {
  const cases: [string, string, unknown][] = [
    ['unclosed object', '{"a":1', { a: 1 }],
    ['unclosed array', '[1,2', [1, 2]],
    ['unclosed nesting', '{"a":[1,{"b":2', { a: [1, { b: 2 }] }],
    ['unclosed string and object', '{"a": "hello', { a: 'hello' }],
    ['missing opening brace', '"a": 1, "b": 2}', { a: 1, b: 2 }],
    ['missing opening bracket', '1, 2, 3]', [1, 2, 3]],
    ['missing both openers', '"a": [1, 2}]', [{ a: [1, 2] }]],
    ['missing brace around bare members', 'a: 1, b: 2', { a: 1, b: 2 }],
    ['stray closing brace', '{"a":1}}', { a: 1 }],
    ['stray closing bracket', '[1,2]]]', [1, 2]],
    ['array closed by a brace', '{"a": [1, 2}', { a: [1, 2] }],
    ['object closed by a bracket', '[{"a":1]', [{ a: 1 }]],
  ];

  for (const [name, broken, expected] of cases) {
    it(`repairs ${name}`, () => {
      expect(repaired(broken)).toEqual(expected);
    });
  }
});

describe('repairJson - separators', () => {
  const cases: [string, string, unknown][] = [
    ['trailing comma in an object', '{"a":1,}', { a: 1 }],
    ['trailing comma in an array', '[1,2,]', [1, 2]],
    ['leading comma', '{,"a":1}', { a: 1 }],
    ['doubled comma', '[1,,2]', [1, 2]],
    ['missing comma between members', '{"a":1 "b":2}', { a: 1, b: 2 }],
    ['missing comma between items', '[1 2 3]', [1, 2, 3]],
    ['missing comma between objects', '[{"a":1} {"b":2}]', [{ a: 1 }, { b: 2 }]],
    ['missing colon', '{"a" 1}', { a: 1 }],
    ['equals instead of a colon', '{a = 1}', { a: 1 }],
    ['fat arrow instead of a colon', '{a => 1}', { a: 1 }],
    ['semicolons between members', '{a:1; b:2}', { a: 1, b: 2 }],
    ['a value that was never written', '{"a": , "b": 2}', { a: null, b: 2 }],
  ];

  for (const [name, broken, expected] of cases) {
    it(`repairs ${name}`, () => {
      expect(repaired(broken)).toEqual(expected);
    });
  }
});

describe('repairJson - quoting', () => {
  const cases: [string, string, unknown][] = [
    ['single quotes', "{'a':'b'}", { a: 'b' }],
    ['backticks', '{`a`: `b`}', { a: 'b' }],
    ['curly quotes', '{\u201ca\u201d: \u2018b\u2019}', { a: 'b' }],
    ['bare keys', '{a:1,b:2}', { a: 1, b: 2 }],
    ['a bare key containing a space', '{my key: 1}', { 'my key': 1 }],
    ['bare values', '{a: hello world}', { a: 'hello world' }],
    ['bare values in an array', '[alpha, beta]', ['alpha', 'beta']],
    ['a bare url', '{url: https://example.com/a?b=1}', { url: 'https://example.com/a?b=1' }],
    ['a bare clock time', '{t: 12:30}', { t: '12:30' }],
    ['an apostrophe inside single quotes', "{'note': 'it's here'}", { note: "it's here" }],
    ['a raw tab inside a string', '{"a": "one\ttwo"}', { a: 'one\ttwo' }],
    ['a raw newline inside single quotes', "{a: 'one\ntwo'}", { a: 'one\ntwo' }],
    ['an invalid escape', '{"a": "\\q"}', { a: '\\q' }],
    ['an invalid unicode escape', '{"a": "\\uZZ12"}', { a: '\\uZZ12' }],
    ['concatenated strings', '{"a": "one" + "two"}', { a: 'onetwo' }],
    [
      'a string closed by the next key',
      '{"a": "unterminated, "b": 1}',
      { a: 'unterminated, ', b: 1 },
    ],
  ];

  for (const [name, broken, expected] of cases) {
    it(`repairs ${name}`, () => {
      expect(repaired(broken)).toEqual(expected);
    });
  }
});

describe('repairJson - literals and numbers', () => {
  const cases: [string, string, unknown][] = [
    ['python literals', '{"a":True,"b":False,"c":None}', { a: true, b: false, c: null }],
    ['undefined and NaN', '{"a":undefined,"b":NaN}', { a: null, b: null }],
    ['Infinity', '{"a":Infinity,"b":-Infinity}', { a: null, b: null }],
    ['a leading decimal point', '{"a": .5}', { a: 0.5 }],
    ['a trailing decimal point', '{"a": 5.}', { a: 5 }],
    ['an explicit plus sign', '{"a": +7}', { a: 7 }],
    ['leading zeros', '{"a": 007}', { a: 7 }],
    ['a hexadecimal number', '{"a": 0x1F}', { a: 31 }],
    ['a binary number', '{"a": 0b101}', { a: 5 }],
    ['an octal number', '{"a": 0o17}', { a: 15 }],
    ['a truncated exponent', '{"a": 1e}', { a: 1 }],
    ['numeric separators', '{"a": 1_000}', { a: 1000 }],
  ];

  for (const [name, broken, expected] of cases) {
    it(`repairs ${name}`, () => {
      expect(repaired(broken)).toEqual(expected);
    });
  }

  it('keeps a version number as a string rather than mangling it', () => {
    expect(repaired('{v: 1.2.3, released: 2024-01-01}')).toEqual({
      v: '1.2.3',
      released: '2024-01-01',
    });
  });

  it('keeps a measurement with a unit as a string', () => {
    expect(repaired('{width: 5px}')).toEqual({ width: '5px' });
  });
});

describe('repairJson - surrounding noise', () => {
  const cases: [string, string, unknown][] = [
    ['a line comment', '{"a":1} // trailing note', { a: 1 }],
    ['a block comment', '{/* note */"a":1}', { a: 1 }],
    ['a hash comment', '# note\n{"a":1}', { a: 1 }],
    ['a markdown code fence', '```json\n{"a": 1,}\n```', { a: 1 }],
    ['prose before the document', 'Here is your JSON:\n{"a":1}', { a: 1 }],
    ['prose after the document', '{"a":1}\nHope that helps!', { a: 1 }],
    ['an escaped document', '{\\"a\\": 1, \\"b\\": [1,2]}', { a: 1, b: [1, 2] }],
    ['a byte order mark', '\ufeff{"a":1,}', { a: 1 }],
    ['a non-breaking space', '{"a":\u00a01}', { a: 1 }],
  ];

  for (const [name, broken, expected] of cases) {
    it(`repairs ${name}`, () => {
      expect(repaired(broken)).toEqual(expected);
    });
  }
});

describe('repairJson - several documents in one input', () => {
  it('merges newline-delimited records into an array', () => {
    expect(repaired('{"a":1}\n{"b":2}\n{"c":3}')).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('merges concatenated documents into an array', () => {
    expect(repaired('{"a":1}{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('merges documents that were comma-separated but never wrapped', () => {
    expect(repaired('{"a":1},\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('repairJson - leaves sound documents alone', () => {
  const untouched = [
    '{"a":1,"b":[1,2]}',
    '{\n  "a": 1\n}',
    '[]',
    'null',
    '"just a string"',
    '{"a": 12345678901234567890123}',
    '{"p": "C:\\\\Users\\\\me"}',
  ];

  for (const good of untouched) {
    it(`returns ${good} unchanged`, () => {
      const { text, changed, fixes } = repairJson(good);
      expect(changed).toBe(false);
      expect(fixes).toEqual([]);
      expect(text).toBe(good);
    });
  }

  it('does not corrupt content that merely looks like a keyword', () => {
    expect(repaired('{"a":"True is a word, undefined too",}')).toEqual({
      a: 'True is a word, undefined too',
    });
  });

  it('does not treat // inside a string as a comment', () => {
    expect(repaired('{"url":"https://example.com/x",}')).toEqual({
      url: 'https://example.com/x',
    });
  });

  it('does not treat a hash inside a string as a comment', () => {
    expect(repaired('{"tag":"#winning",}')).toEqual({ tag: '#winning' });
  });

  it('leaves an empty input alone rather than inventing a document', () => {
    expect(repairJson('   ')).toEqual({ text: '   ', changed: false, fixes: [] });
  });
});

describe('repairJson - reporting', () => {
  it('names each correction it made', () => {
    const { fixes } = repairJson("{a: 'x',}");
    expect(fixes).toContain('quoted bare keys');
    expect(fixes).toContain('normalized quote characters');
    expect(fixes).toContain('removed trailing commas');
  });

  it('reports nothing for a document that needed no work', () => {
    expect(repairJson('{"a":1}').fixes).toEqual([]);
  });

  it('never repeats a correction', () => {
    const { fixes } = repairJson('{a:1,b:2,c:3}');
    expect(fixes).toEqual(['quoted bare keys']);
  });

  it('reports a changed document with at least one reason', () => {
    const { changed, fixes } = repairJson('[1,2,]');
    expect(changed).toBe(true);
    expect(fixes.length).toBeGreaterThan(0);
  });
});

describe('repairJson - hostile input', () => {
  const nest = (depth: number, open: string, close: string) =>
    open.repeat(depth) + '1' + close.repeat(depth);

  it('does not overflow the stack on pathological nesting', () => {
    expect(() => repairJson(nest(50_000, '[', ''))).not.toThrow();
    expect(() => repairJson(nest(50_000, '{"a":[', ''))).not.toThrow();
  });

  it('still produces valid JSON from pathological nesting', () => {
    expect(() => JSON.parse(repairJson(nest(5000, '[', '')).text)).not.toThrow();
  });

  it('does not emit native function source', () => {
    for (const input of ['{constructor: 1}', '{__proto__: 1}', '{a: toString}', '{valueOf: 2}']) {
      const { text } = repairJson(input);
      expect(text, input).not.toContain('native code');
      expect(text, input).not.toContain('[object Object]');
    }
  });

  it('keeps prototype-named keys as ordinary data', () => {
    expect(repaired('{__proto__: 1, constructor: 2}')).toEqual(
      JSON.parse('{"__proto__":1,"constructor":2}'),
    );
  });

  it('never pollutes Object.prototype', () => {
    repairJson('{__proto__: {"polluted": true}}');
    repairJson('{"__proto__": {"polluted": true},}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('terminates on input that is only punctuation', () => {
    for (const input of [',,,', ':::', '}}}', '[[[', '{{{', '""""', "'''"]) {
      expect(() => repairJson(input), input).not.toThrow();
    }
  });
});

describe('repair through the engine', () => {
  const repair = (text: string) =>
    handleEngineRequest({ id: 1, kind: 'transform', text, op: 'repair', indent: '2' }).response;

  it('returns reformatted JSON for a badly broken document', () => {
    const response = repair("{a: 'x' b: [1 2,");
    expect(response.ok).toBe(true);
    if (response.ok && 'text' in response) {
      expect(JSON.parse(response.text)).toEqual({ a: 'x', b: [1, 2] });
      expect(response.text).toContain('\n  ');
    }
  });

  it('declines an input with nothing to repair', () => {
    const response = repair('   ');
    expect(response.ok).toBe(false);
  });

  it('reports the corrections instead of a generic claim', () => {
    const response = repair('[1,2,]');
    expect(response.ok).toBe(true);
    if (response.ok && 'note' in response) {
      expect(response.note).toContain('removed trailing commas');
    }
  });

  it('survives pathological nesting with a response, not a throw', () => {
    const text = '['.repeat(50_000);
    expect(() =>
      handleEngineRequest({ id: 2, kind: 'transform', text, op: 'repair', indent: '2' }),
    ).not.toThrow();
  });
});

describe('repairNote', () => {
  it('says a sound document only needed reformatting', () => {
    expect(repairNote({ text: '', changed: false, fixes: [] })).toBe('Already valid — reformatted');
  });

  it('lists the corrections it made', () => {
    expect(repairNote({ text: '', changed: true, fixes: ['removed comments'] })).toBe(
      'Repaired — removed comments',
    );
  });

  it('summarizes once the list grows long', () => {
    const fixes = ['one', 'two', 'three', 'four', 'five'];
    expect(repairNote({ text: '', changed: true, fixes })).toBe(
      'Repaired — one, two, three and 2 more',
    );
  });
});
