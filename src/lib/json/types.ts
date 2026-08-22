export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export type JsonPathSegment = string | number;

export type IndentStyle = '2' | '4' | 'tab';
