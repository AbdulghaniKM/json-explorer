import { describe, expect, it } from 'vitest';
import { jsonToCsv, jsonToQueryString } from '../src/lib/json/convert';
import { deepEqual, diffJson } from '../src/lib/json/diff';
import {
  engineFailure,
  exceedsDepth,
  handleEngineRequest,
  MAX_VALUE_DEPTH,
  type EngineRequest,
} from '../src/lib/json/engine';
import { removeEmptyValues } from '../src/lib/json/format';
import { repairJson } from '../src/lib/json/repair';
import { MAX_DEPTH, scanJson } from '../src/lib/json/scan';

const nest = (depth: number, open: string, close: string, core = '1') =>
  open.repeat(depth) + core + close.repeat(depth);

const nestedValue = (depth: number) => {
  let value: unknown = 1;
  for (let i = 0; i < depth; i++) value = { nested: value };
  return value;
};

describe('handleEngineRequest never throws', () => {
  // A throw here leaves the caller's promise unsettled, which latches the store's `busy`
  // flag and blocks every later operation for the rest of the session.
  const deepText = nest(5000, '[', ']');
  // Built as text: JSON.stringify would itself overflow on a value this deep.
  const deepObject = nest(5000, '{"nested":', '}');

  // These materialize the document and walk it recursively, so they must decline cleanly.
  const recursive: [string, EngineRequest][] = [
    [
      'diff of deeply nested arrays',
      { id: 1, kind: 'diff', left: deepText, right: deepText, ignoreArrayOrder: false },
    ],
    [
      'diff of deeply nested objects',
      { id: 2, kind: 'diff', left: deepObject, right: deepObject, ignoreArrayOrder: false },
    ],
    [
      'removeEmpty on deep nesting',
      { id: 3, kind: 'transform', text: deepObject, op: 'removeEmpty', indent: '2' },
    ],
    [
      'yaml convert on deep nesting',
      {
        id: 5,
        kind: 'convert',
        text: deepObject,
        target: 'yaml',
        rootName: 'Root',
        delimiter: ',',
      },
    ],
    [
      'csv convert on deep nesting',
      { id: 6, kind: 'convert', text: deepObject, target: 'csv', rootName: 'Root', delimiter: ',' },
    ],
    [
      'typescript convert on deep nesting',
      {
        id: 7,
        kind: 'convert',
        text: deepObject,
        target: 'typescript',
        rootName: 'Root',
        delimiter: ',',
      },
    ],
  ];

  for (const [name, request] of recursive) {
    it(`declines ${name} with a response, not a throw`, () => {
      let outcome: ReturnType<typeof handleEngineRequest> | undefined;
      expect(() => {
        outcome = handleEngineRequest(request);
      }).not.toThrow();

      // Always a reply, always carrying the id the caller is waiting on.
      expect(outcome?.response).toBeDefined();
      expect(outcome?.response.id).toBe(request.id);
      expect(outcome?.response.ok).toBe(false);
    });
  }

  // The index-based tools are iterative, so deep nesting must still work - that is the
  // documented promise that explore/format/analyze keep going where other tools cap out.
  const iterative: [string, EngineRequest][] = [
    ['scan of deep nesting', { id: 8, kind: 'scan', text: deepText }],
    ['validate of deep nesting', { id: 9, kind: 'validate', text: deepText }],
    [
      'beautify on deep nesting',
      { id: 4, kind: 'transform', text: deepText, op: 'beautify', indent: '2' },
    ],
    [
      'minify on deep nesting',
      { id: 11, kind: 'transform', text: deepText, op: 'minify', indent: '2' },
    ],
  ];

  for (const [name, request] of iterative) {
    it(`still succeeds at ${name}`, () => {
      const outcome = handleEngineRequest(request);
      expect(outcome.response.id).toBe(request.id);
      expect(outcome.response.ok).toBe(true);
    });
  }

  it('explains why rather than reporting a generic failure', () => {
    const response = handleEngineRequest(recursive[0][1]).response;
    expect(response.ok).toBe(false);
    if (!response.ok && 'message' in response) {
      expect(response.message).toMatch(/nested/i);
    }
  });

  it('still answers ordinary requests', () => {
    const response = handleEngineRequest({ id: 10, kind: 'validate', text: '{"a":1}' }).response;
    expect(response.ok).toBe(true);
  });
});

describe('engineFailure', () => {
  it('shapes the failure to match the request kind', () => {
    const kinds: EngineRequest[] = [
      { id: 1, kind: 'scan', text: '' },
      { id: 2, kind: 'validate', text: '' },
      { id: 3, kind: 'transform', text: '', op: 'beautify', indent: '2' },
      { id: 4, kind: 'convert', text: '', target: 'yaml', rootName: '', delimiter: ',' },
      { id: 5, kind: 'diff', left: '', right: '', ignoreArrayOrder: false },
      { id: 6, kind: 'generate', records: 1 },
    ];

    for (const request of kinds) {
      const response = engineFailure(request, 'boom');
      expect(response.kind, request.kind).toBe(request.kind);
      expect(response.id).toBe(request.id);
      expect(response.ok).toBe(false);
    }
  });
});

describe('exceedsDepth', () => {
  it('does not overflow measuring pathological nesting', () => {
    expect(() => exceedsDepth(nestedValue(200_000) as never)).not.toThrow();
    expect(exceedsDepth(nestedValue(200_000) as never)).toBe(true);
  });

  it('accepts documents within the limit', () => {
    expect(exceedsDepth(nestedValue(MAX_VALUE_DEPTH - 5) as never)).toBe(false);
  });

  it('handles flat documents cheaply', () => {
    expect(exceedsDepth(Array.from({ length: 10_000 }, (_, i) => i) as never)).toBe(false);
  });
});

describe('scanJson depth cap', () => {
  it('rejects nesting past the cap instead of wrapping the depth field', () => {
    const result = scanJson(nest(MAX_DEPTH + 10, '[', ']'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/nested/i);
  });

  it('still accepts deep-but-sane nesting, with an unwrapped per-node depth', () => {
    const depth = 3000;
    const result = scanJson(nest(depth, '[', ']'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stats.depth).toBe(depth);
      // The innermost node must report its true depth, not a 16-bit wrap of it.
      expect(result.index.depth[result.index.count - 1]).toBe(depth);
    }
  });
});

describe('prototype-named keys are treated as data', () => {
  it('converts a record with a constructor column instead of crashing', () => {
    expect(() => jsonToCsv([{ a: 1 }, { constructor: 2 }] as never)).not.toThrow();
    expect(() => jsonToCsv([{ a: 1 }, { toString: 2 }] as never)).not.toThrow();
    expect(() => jsonToCsv([{ valueOf: 1 }] as never)).not.toThrow();
  });

  // Built via JSON.parse, not an object literal: `{__proto__: x}` in source sets the
  // prototype, whereas a parsed document carries __proto__ as a real own property.
  const withProtoKey = () => JSON.parse('{"__proto__":"hello","b":1}');

  it('keeps a __proto__ column in CSV output', () => {
    const csv = jsonToCsv(withProtoKey());
    expect(csv).toContain('__proto__');
    expect(csv).toContain('hello');
  });

  it('keeps a __proto__ field in a query string', () => {
    expect(jsonToQueryString(withProtoKey())).toContain('__proto__=hello');
  });

  it('does not emit native function source when repairing', () => {
    for (const input of ['{constructor: 1}', '{__proto__: 1}', '{a: toString}', '{valueOf: 2}']) {
      const { text } = repairJson(input);
      expect(text, input).not.toContain('native code');
      expect(text, input).not.toContain('[object Object]');
    }
  });

  it('reports a removed prototype-named key as removed, not changed', () => {
    const { root } = diffJson({ toString: 'x' } as never, {} as never);
    expect(root.children?.[0]?.kind).toBe('removed');
  });

  it('compares objects with prototype-named keys correctly', () => {
    expect(deepEqual({ toString: 'x' } as never, {} as never)).toBe(false);
    expect(deepEqual({ constructor: 1 } as never, { constructor: 1 } as never)).toBe(true);
  });

  it('keeps a __proto__ key through removeEmptyValues', () => {
    const cleaned = removeEmptyValues(JSON.parse('{"__proto__":"hello","a":1,"b":null}'));
    expect(JSON.stringify(cleaned)).toContain('__proto__');
  });

  it('never pollutes Object.prototype', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true}}');
    jsonToCsv(hostile);
    jsonToQueryString(hostile);
    removeEmptyValues(hostile);
    repairJson('{__proto__: {"polluted": true}}');
    diffJson(hostile, {});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
