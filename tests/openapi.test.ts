import { describe, expect, it } from 'vitest';
import { isApiDocument, readApiDocument } from '../src/lib/json/openapi';
import { SAMPLE_OPENAPI } from '../src/lib/json/sample';

const read = (text: string) => readApiDocument(JSON.parse(text));

describe('readApiDocument - OpenAPI 3', () => {
  const api = read(SAMPLE_OPENAPI);

  it('reads the document envelope', () => {
    expect(api?.version).toBe('openapi-3');
    expect(api?.title).toBe('Orders API');
    expect(api?.apiVersion).toBe('1.4.0');
    expect(api?.servers).toEqual(['https://api.example.com/v1']);
    expect(api?.schemaCount).toBe(3);
  });

  it('finds every operation across every path', () => {
    expect(api?.operations.map((operation) => operation.id).sort()).toEqual([
      'delete:/orders/{orderId}',
      'get:/health',
      'get:/orders',
      'get:/orders/{orderId}',
      'post:/orders',
      'post:/orders/{orderId}/refunds',
    ]);
  });

  it('collects tags and the methods actually used', () => {
    expect(api?.tags).toEqual(['ops', 'orders', 'refunds']);
    expect(api?.methods).toEqual(['GET', 'POST', 'DELETE']);
  });

  it('merges path-level parameters into each operation', () => {
    const get = api?.operations.find((operation) => operation.id === 'get:/orders/{orderId}');
    expect(get?.parameters.map((parameter) => parameter.name)).toEqual(['orderId']);
    expect(get?.parameters[0]).toMatchObject({ location: 'path', required: true, type: 'string' });
  });

  it('names the request body schema and its media type', () => {
    const post = api?.operations.find((operation) => operation.id === 'post:/orders');
    expect(post?.body).toMatchObject({
      required: true,
      type: 'NewOrder',
      mediaTypes: ['application/json'],
    });
  });

  it('reads responses with their schema names', () => {
    const list = api?.operations.find((operation) => operation.id === 'get:/orders');
    expect(list?.responses.map((response) => response.status)).toEqual(['200', '401']);
    expect(list?.responses[0].type).toBe('Order[]');
  });

  it('falls back to document security and honours an explicit opt-out', () => {
    const list = api?.operations.find((operation) => operation.id === 'get:/orders');
    const health = api?.operations.find((operation) => operation.id === 'get:/health');
    expect(list?.security).toEqual(['bearerAuth']);
    expect(health?.security).toEqual([]);
  });
});

describe('readApiDocument - Swagger 2', () => {
  const swagger = read(`{
    "swagger": "2.0",
    "info": { "title": "Legacy", "version": "1.0" },
    "host": "legacy.example.com",
    "basePath": "/api",
    "schemes": ["https"],
    "consumes": ["application/json"],
    "produces": ["application/json"],
    "paths": {
      "/pets": {
        "post": {
          "summary": "Add a pet",
          "parameters": [
            { "name": "body", "in": "body", "required": true, "schema": { "$ref": "#/definitions/Pet" } },
            { "name": "dryRun", "in": "query", "type": "boolean" }
          ],
          "responses": { "200": { "description": "ok", "schema": { "$ref": "#/definitions/Pet" } } }
        }
      }
    },
    "definitions": { "Pet": { "type": "object" } }
  }`);

  it('recognises the older version', () => {
    expect(swagger?.version).toBe('swagger-2');
  });

  it('rebuilds the server url from host, basePath and schemes', () => {
    expect(swagger?.servers).toEqual(['https://legacy.example.com/api']);
  });

  it('promotes an `in: body` parameter to the request body', () => {
    const post = swagger?.operations[0];
    expect(post?.body).toMatchObject({ required: true, type: 'Pet' });
    // …and keeps it out of the parameter list, where it would read as a query field.
    expect(post?.parameters.map((parameter) => parameter.name)).toEqual(['dryRun']);
  });

  it('takes the parameter type from the parameter itself', () => {
    expect(swagger?.operations[0].parameters[0].type).toBe('boolean');
  });

  it('uses document-level produces for a response with no content block', () => {
    expect(swagger?.operations[0].responses[0].mediaTypes).toEqual(['application/json']);
  });
});

describe('readApiDocument - hostile and partial input', () => {
  const cases: [string, string][] = [
    ['a plain object', '{"a":1}'],
    ['an array', '[1,2,3]'],
    ['a version with no paths', '{"openapi":"3.0.0"}'],
    ['paths that is not an object', '{"openapi":"3.0.0","paths":"nope"}'],
  ];

  for (const [name, text] of cases) {
    it(`returns null for ${name}`, () => {
      expect(readApiDocument(JSON.parse(text))).toBeNull();
    });
  }

  it('survives operations built from the wrong types', () => {
    const api = read(`{
      "openapi": "3.0.0",
      "paths": {
        "/x": { "get": { "parameters": "nope", "responses": 42, "tags": [1, null] } },
        "/y": "not an object"
      }
    }`);
    expect(api?.operations).toHaveLength(1);
    expect(api?.operations[0]).toMatchObject({ parameters: [], responses: [], tags: [] });
  });

  it('treats prototype-named keys as ordinary paths', () => {
    const api = readApiDocument(
      JSON.parse('{"openapi":"3.0.0","paths":{"__proto__":{"get":{"summary":"x"}}}}'),
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(api?.operations.map((operation) => operation.path)).toEqual(['__proto__']);
  });

  it('never throws, whatever it is handed', () => {
    for (const value of [null, 1, 'text', [], {}, { openapi: 3, paths: [] }]) {
      expect(() => readApiDocument(value as never)).not.toThrow();
    }
  });
});

describe('isApiDocument', () => {
  it('accepts a document that declares a version and has paths', () => {
    expect(isApiDocument(JSON.parse(SAMPLE_OPENAPI))).toBe(true);
  });

  it('rejects ordinary JSON', () => {
    expect(isApiDocument(JSON.parse('{"paths":{}}'))).toBe(false);
    expect(isApiDocument(JSON.parse('[]'))).toBe(false);
  });
});
