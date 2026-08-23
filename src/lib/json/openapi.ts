import type { JsonObject, JsonValue } from './types';

/**
 * A reader for Swagger 2.0 and OpenAPI 3.x documents.
 *
 * Everything here is defensive. The input is whatever JSON the user happened to paste, so a
 * missing `paths`, a string where an object belongs, or a `$ref` pointing nowhere has to end
 * as a thinner result rather than a throw — this feeds a viewer, not a validator.
 */

export type ApiVersion = 'swagger-2' | 'openapi-3';

export interface ApiParameter {
  name: string;
  location: string;
  required: boolean;
  type: string;
  description: string;
}

export interface ApiBody {
  required: boolean;
  mediaTypes: string[];
  type: string;
}

export interface ApiResponse {
  status: string;
  description: string;
  mediaTypes: string[];
  type: string;
}

export interface ApiOperation {
  id: string;
  method: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  deprecated: boolean;
  parameters: ApiParameter[];
  body: ApiBody | null;
  responses: ApiResponse[];
  security: string[];
}

export interface ApiDocument {
  version: ApiVersion;
  title: string;
  apiVersion: string;
  description: string;
  servers: string[];
  operations: ApiOperation[];
  tags: string[];
  methods: string[];
  schemaCount: number;
}

/** In the order they belong in a reference, not alphabetically. */
export const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
] as const;

const METHOD_SET = new Set<string>(HTTP_METHODS);

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `Object.hasOwn`, so a document with a `constructor` or `__proto__` key stays data. */
const own = (source: JsonValue | undefined, key: string): JsonValue | undefined =>
  isObject(source) && Object.hasOwn(source, key) ? source[key] : undefined;

const asString = (value: JsonValue | undefined): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

const asArray = (value: JsonValue | undefined): JsonValue[] => (Array.isArray(value) ? value : []);

const stringsOf = (value: JsonValue | undefined): string[] =>
  asArray(value).filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);

/** The last segment of a `$ref`, which is the name a reader recognises. */
const refName = (ref: string): string => {
  const parts = ref.split('/');
  return parts[parts.length - 1] || ref;
};

/**
 * A short, human-readable name for a schema — `Pet`, `Pet[]`, `string`. Deliberately shallow:
 * this labels a row in a list, and following every `$ref` to render a full shape is the job of
 * the document itself.
 */
const typeOf = (schema: JsonValue | undefined): string => {
  if (!isObject(schema)) return '';

  const ref = asString(own(schema, '$ref'));
  if (ref) return refName(ref);

  const items = own(schema, 'items');
  const declared = asString(own(schema, 'type'));
  if (declared === 'array' || items !== undefined) {
    const inner = typeOf(items);
    return inner ? `${inner}[]` : 'array';
  }

  for (const composite of ['allOf', 'oneOf', 'anyOf']) {
    const members = asArray(own(schema, composite));
    if (members.length) {
      const names = members.map(typeOf).filter(Boolean);
      if (names.length) return names.join(composite === 'allOf' ? ' & ' : ' | ');
    }
  }

  const format = asString(own(schema, 'format'));
  if (declared && format) return `${declared}<${format}>`;
  return declared;
};

const readParameters = (raw: JsonValue | undefined): ApiParameter[] =>
  asArray(raw)
    .filter(isObject)
    .map((parameter) => {
      // Swagger 2 puts the type on the parameter; OpenAPI 3 moves it into `schema`.
      const schema = own(parameter, 'schema');
      const inline = asString(own(parameter, 'type'));
      return {
        name: asString(own(parameter, 'name')) || refName(asString(own(parameter, '$ref'))),
        location: asString(own(parameter, 'in')) || 'query',
        required: own(parameter, 'required') === true,
        type: typeOf(schema) || inline,
        description: asString(own(parameter, 'description')),
      };
    })
    .filter((parameter) => parameter.name.length > 0);

/** OpenAPI 3 keys media types under `content`; Swagger 2 lists them on the operation. */
const readContent = (
  holder: JsonValue | undefined,
  fallbackTypes: string[],
): { mediaTypes: string[]; type: string } => {
  const content = own(holder, 'content');
  if (isObject(content)) {
    const mediaTypes = Object.keys(content);
    const first = mediaTypes.length ? own(content, mediaTypes[0]) : undefined;
    return { mediaTypes, type: typeOf(own(first, 'schema')) };
  }
  return { mediaTypes: fallbackTypes, type: typeOf(own(holder, 'schema')) };
};

const readBody = (
  operation: JsonObject,
  parameters: JsonValue[],
  consumes: string[],
): ApiBody | null => {
  const requestBody = own(operation, 'requestBody');
  if (isObject(requestBody)) {
    const { mediaTypes, type } = readContent(requestBody, consumes);
    return { required: own(requestBody, 'required') === true, mediaTypes, type };
  }

  // Swagger 2: the body is a parameter with `in: body`.
  const bodyParameter = parameters
    .filter(isObject)
    .find((parameter) => asString(own(parameter, 'in')) === 'body');
  if (!bodyParameter) return null;

  return {
    required: own(bodyParameter, 'required') === true,
    mediaTypes: consumes,
    type: typeOf(own(bodyParameter, 'schema')),
  };
};

const readResponses = (raw: JsonValue | undefined, produces: string[]): ApiResponse[] => {
  if (!isObject(raw)) return [];
  return Object.keys(raw)
    .map((status) => {
      const response = own(raw, status);
      const { mediaTypes, type } = readContent(response, produces);
      return {
        status,
        description: asString(own(response, 'description')),
        mediaTypes,
        type,
      };
    })
    .sort((a, b) => a.status.localeCompare(b.status, 'en'));
};

const readSecurity = (raw: JsonValue | undefined): string[] =>
  asArray(raw)
    .filter(isObject)
    .flatMap((entry) => Object.keys(entry));

const readServers = (root: JsonObject): string[] => {
  const servers = asArray(own(root, 'servers'))
    .filter(isObject)
    .map((server) => asString(own(server, 'url')))
    .filter(Boolean);
  if (servers.length) return servers;

  // Swagger 2 spells the same thing as host + basePath + schemes.
  const host = asString(own(root, 'host'));
  const basePath = asString(own(root, 'basePath'));
  if (!host && !basePath) return [];
  const schemes = stringsOf(own(root, 'schemes'));
  if (!schemes.length) return [`${host}${basePath}`];
  return schemes.map((scheme) => `${scheme}://${host}${basePath}`);
};

const countSchemas = (root: JsonObject): number => {
  const schemas = own(own(root, 'components'), 'schemas') ?? own(root, 'definitions');
  return isObject(schemas) ? Object.keys(schemas).length : 0;
};

/** True when the document declares itself as Swagger or OpenAPI and carries a `paths` object. */
export const isApiDocument = (value: JsonValue): boolean => {
  if (!isObject(value)) return false;
  const declared = asString(own(value, 'openapi')) || asString(own(value, 'swagger'));
  return declared.length > 0 && isObject(own(value, 'paths'));
};

export const readApiDocument = (value: JsonValue): ApiDocument | null => {
  if (!isObject(value)) return null;

  const openapi = asString(own(value, 'openapi'));
  const swagger = asString(own(value, 'swagger'));
  if (!openapi && !swagger) return null;

  const paths = own(value, 'paths');
  if (!isObject(paths)) return null;

  const info = own(value, 'info');
  const documentConsumes = stringsOf(own(value, 'consumes'));
  const documentProduces = stringsOf(own(value, 'produces'));
  const documentSecurity = readSecurity(own(value, 'security'));

  const operations: ApiOperation[] = [];

  for (const path of Object.keys(paths)) {
    const item = own(paths, path);
    if (!isObject(item)) continue;

    // Parameters declared once for the path apply to every operation under it.
    const shared = asArray(own(item, 'parameters'));

    for (const method of HTTP_METHODS) {
      const operation = own(item, method);
      if (!isObject(operation)) continue;

      const parameters = [...shared, ...asArray(own(operation, 'parameters'))];
      const consumes = stringsOf(own(operation, 'consumes'));
      const produces = stringsOf(own(operation, 'produces'));
      const declaresSecurity = Object.hasOwn(operation, 'security');

      operations.push({
        id: `${method}:${path}`,
        method: method.toUpperCase(),
        path,
        operationId: asString(own(operation, 'operationId')),
        summary: asString(own(operation, 'summary')),
        description: asString(own(operation, 'description')),
        tags: stringsOf(own(operation, 'tags')),
        deprecated: own(operation, 'deprecated') === true,
        parameters: readParameters(parameters).filter((parameter) => parameter.location !== 'body'),
        body: readBody(operation, parameters, consumes.length ? consumes : documentConsumes),
        responses: readResponses(
          own(operation, 'responses'),
          produces.length ? produces : documentProduces,
        ),
        security: declaresSecurity ? readSecurity(own(operation, 'security')) : documentSecurity,
      });
    }
  }

  const tags = [...new Set(operations.flatMap((operation) => operation.tags))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  );
  const methods = HTTP_METHODS.map((method) => method.toUpperCase()).filter((method) =>
    operations.some((operation) => operation.method === method),
  );

  return {
    version: openapi ? 'openapi-3' : 'swagger-2',
    title: asString(own(info, 'title')) || 'Untitled API',
    apiVersion: asString(own(info, 'version')),
    description: asString(own(info, 'description')),
    servers: readServers(value),
    operations,
    tags,
    methods,
    schemaCount: countSchemas(value),
  };
};

/** Kept out of the components so the method colours stay one decision in one place. */
export const methodTone = (method: string): string => {
  switch (method) {
    case 'GET':
      return 'text-info border-info/50';
    case 'POST':
      return 'text-success border-success/50';
    case 'PUT':
    case 'PATCH':
      return 'text-warning border-warning/50';
    case 'DELETE':
      return 'text-error border-error/50';
    default:
      return 'text-muted-foreground border-border';
  }
};

export { METHOD_SET };
