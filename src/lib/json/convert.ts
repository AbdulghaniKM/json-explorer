import type { JsonValue } from './types';
import type { JsonIndex } from './scan';
import { NODE_ARRAY, NODE_BOOLEAN, NODE_NUMBER, NODE_OBJECT, NODE_STRING } from './scan';
import { valueType } from './path';

type PrimitiveName = 'string' | 'integer' | 'long' | 'number' | 'boolean' | 'null' | 'unknown';

type TypeNode =
  | { kind: 'primitive'; name: PrimitiveName }
  | { kind: 'array'; element: TypeNode }
  | { kind: 'object'; fields: Map<string, { node: TypeNode; optional: boolean }> }
  | { kind: 'union'; options: TypeNode[] };

const primitive = (name: PrimitiveName): TypeNode => ({
  kind: 'primitive',
  name,
});

const INT32_MAX = 2147483647;

const NUMERIC_RANK: Partial<Record<PrimitiveName, number>> = { integer: 0, long: 1, number: 2 };

const numberKind = (value: number): PrimitiveName => {
  if (!Number.isInteger(value)) return 'number';
  return Math.abs(value) > INT32_MAX ? 'long' : 'integer';
};

const widerNumber = (a: PrimitiveName, b: PrimitiveName): PrimitiveName | null => {
  const rankA = NUMERIC_RANK[a];
  const rankB = NUMERIC_RANK[b];
  if (rankA === undefined || rankB === undefined) return null;
  return rankA >= rankB ? a : b;
};

const signatures = new WeakMap<TypeNode, string>();

const describe = (node: TypeNode): string => {
  if (node.kind === 'primitive') return node.name;
  if (node.kind === 'array') return `array<${signature(node.element)}>`;
  if (node.kind === 'union') return `union<${node.options.map(signature).sort().join('|')}>`;
  return `object<${[...node.fields.entries()]
    .map(([key, field]) => `${key}${field.optional ? '?' : ''}:${signature(field.node)}`)
    .sort()
    .join(',')}>`;
};

const signature = (node: TypeNode): string => {
  const cached = signatures.get(node);
  if (cached !== undefined) return cached;
  const value = describe(node);
  signatures.set(node, value);
  return value;
};

const unify = (a: TypeNode, b: TypeNode): TypeNode => {
  if (signature(a) === signature(b)) return a;

  if (a.kind === 'primitive' && b.kind === 'primitive') {
    const numeric = widerNumber(a.name, b.name);
    if (numeric) return primitive(numeric);
  }

  if (a.kind === 'object' && b.kind === 'object') {
    const fields = new Map<string, { node: TypeNode; optional: boolean }>();
    const keys = new Set([...a.fields.keys(), ...b.fields.keys()]);
    for (const key of keys) {
      const left = a.fields.get(key);
      const right = b.fields.get(key);
      if (left && right) {
        fields.set(key, {
          node: unify(left.node, right.node),
          optional: left.optional || right.optional,
        });
      } else {
        const only = (left ?? right) as { node: TypeNode; optional: boolean };
        fields.set(key, { node: only.node, optional: true });
      }
    }
    return { kind: 'object', fields };
  }

  if (a.kind === 'array' && b.kind === 'array') {
    return { kind: 'array', element: unify(a.element, b.element) };
  }

  const options = [
    ...(a.kind === 'union' ? a.options : [a]),
    ...(b.kind === 'union' ? b.options : [b]),
  ];

  const seen = new Map<string, TypeNode>();
  for (const option of options) {
    const key = signature(option);
    if (!seen.has(key)) seen.set(key, option);
  }

  const unique = [...seen.values()];
  return unique.length === 1 ? unique[0] : { kind: 'union', options: unique };
};

export type JsonShape = TypeNode;

const keyTextOf = (text: string, index: JsonIndex, id: number): string => {
  const raw = text.slice(index.keyStart[id], index.keyEnd[id]);
  return raw.includes('\\') ? (JSON.parse(`"${raw}"`) as string) : raw;
};

const createInterner = () => {
  const pool = new Map<string, TypeNode>();
  const ids = new WeakMap<TypeNode, number>();

  const reference = (node: TypeNode): string => {
    const id = ids.get(node);
    return id === undefined ? signature(node) : String(id);
  };

  const keyOf = (node: TypeNode): string => {
    if (node.kind === 'primitive') return `p${node.name}`;
    if (node.kind === 'array') return `a${reference(node.element)}`;
    if (node.kind === 'union') return `u${node.options.map(reference).sort().join('.')}`;
    return `o${[...node.fields.entries()]
      .map(([key, field]) => `${key}${field.optional ? '?' : ''}:${reference(field.node)}`)
      .sort()
      .join(',')}`;
  };

  return (node: TypeNode): TypeNode => {
    const key = keyOf(node);
    const existing = pool.get(key);
    if (existing) return existing;
    ids.set(node, pool.size);
    pool.set(key, node);
    return node;
  };
};

export const shapeOfIndex = (text: string, index: JsonIndex): JsonShape => {
  if (index.count === 0) return primitive('unknown');
  const intern = createInterner();

  const shapeOf = (id: number): TypeNode => {
    const type = index.type[id];
    const end = index.subtreeEnd[id];

    if (type === NODE_OBJECT) {
      const fields = new Map<string, { node: TypeNode; optional: boolean }>();
      for (let child = id + 1; child < end; child = index.subtreeEnd[child]) {
        fields.set(keyTextOf(text, index, child), { node: shapeOf(child), optional: false });
      }
      return intern({ kind: 'object', fields });
    }

    if (type === NODE_ARRAY) {
      let element: TypeNode | null = null;
      for (let child = id + 1; child < end; child = index.subtreeEnd[child]) {
        const item = shapeOf(child);
        if (element === null) element = item;
        else if (element !== item) element = intern(unify(element, item));
      }
      return intern({ kind: 'array', element: element ?? intern(primitive('unknown')) });
    }

    if (type === NODE_STRING) return intern(primitive('string'));
    if (type === NODE_NUMBER) {
      const raw = Number(text.slice(index.valueStart[id], index.valueEnd[id]));
      return intern(primitive(numberKind(raw)));
    }
    if (type === NODE_BOOLEAN) return intern(primitive('boolean'));
    return intern(primitive('null'));
  };

  return shapeOf(0);
};

const pascalCase = (input: string): string =>
  input
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'Item';

const singular = (name: string): string => {
  if (/ies$/i.test(name)) return `${name.slice(0, -3)}y`;
  if (/(ss|us|is)$/i.test(name)) return name;
  if (/s$/i.test(name)) return name.slice(0, -1);
  return name;
};

const isSafeKey = (key: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);

const createNameFactory = () => {
  const used = new Set<string>();

  return (base: string): string => {
    const name = pascalCase(base);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    let counter = 2;
    while (used.has(`${name}${counter}`)) counter++;
    used.add(`${name}${counter}`);
    return `${name}${counter}`;
  };
};

const TYPESCRIPT_TYPES: Record<PrimitiveName, string> = {
  string: 'string',
  integer: 'number',
  long: 'number',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
  unknown: 'unknown',
};

const ZOD_TYPES: Record<PrimitiveName, string> = {
  string: 'z.string()',
  integer: 'z.number()',
  long: 'z.number()',
  number: 'z.number()',
  boolean: 'z.boolean()',
  null: 'z.null()',
  unknown: 'z.unknown()',
};

const CSHARP_TYPES: Record<PrimitiveName, string> = {
  string: 'string',
  integer: 'int',
  long: 'long',
  number: 'double',
  boolean: 'bool',
  null: 'object',
  unknown: 'object',
};

export const typeScriptFromShape = (shape: JsonShape, rootName = 'Root'): string => {
  const interfaces: Array<{ name: string; body: string }> = [];
  const bySignature = new Map<string, string>();
  const uniqueName = createNameFactory();

  const render = (node: TypeNode, name: string): string => {
    if (node.kind === 'primitive') return TYPESCRIPT_TYPES[node.name];
    if (node.kind === 'array') return `${wrap(render(node.element, singular(name)))}[]`;
    if (node.kind === 'union') {
      return node.options.map((option, index) => render(option, `${name}${index + 1}`)).join(' | ');
    }

    const key = signature(node);
    const existing = bySignature.get(key);
    if (existing) return existing;

    const interfaceName = uniqueName(name);
    bySignature.set(key, interfaceName);

    const lines: string[] = [];
    for (const [field, meta] of node.fields) {
      const rendered = render(meta.node, `${interfaceName}${pascalCase(field)}`);
      const safeKey = isSafeKey(field) ? field : JSON.stringify(field);
      lines.push(`  ${safeKey}${meta.optional ? '?' : ''}: ${rendered};`);
    }

    interfaces.push({
      name: interfaceName,
      body: lines.length ? `{\n${lines.join('\n')}\n}` : 'Record<string, never>',
    });

    return interfaceName;
  };

  const wrap = (expression: string): string =>
    expression.includes(' | ') ? `(${expression})` : expression;

  const rootType = render(shape, rootName);
  const declarations = interfaces.map((item) =>
    item.body.startsWith('{')
      ? `export interface ${item.name} ${item.body}`
      : `export type ${item.name} = ${item.body};`,
  );

  if (!interfaces.some((item) => item.name === rootType)) {
    declarations.push(`export type ${pascalCase(rootName)} = ${rootType};`);
  }

  return declarations.reverse().join('\n\n');
};

export const zodFromShape = (shape: JsonShape, rootName = 'root'): string => {
  const render = (node: TypeNode, depth: number): string => {
    const pad = '  '.repeat(depth);
    const inner = '  '.repeat(depth + 1);

    if (node.kind === 'primitive') return ZOD_TYPES[node.name];

    if (node.kind === 'array') return `z.array(${render(node.element, depth)})`;

    if (node.kind === 'union') {
      return `z.union([${node.options.map((option) => render(option, depth)).join(', ')}])`;
    }

    if (node.fields.size === 0) return 'z.object({})';

    const lines = [...node.fields.entries()].map(([key, meta]) => {
      const safeKey = isSafeKey(key) ? key : JSON.stringify(key);
      return `${inner}${safeKey}: ${render(meta.node, depth + 1)}${meta.optional ? '.optional()' : ''},`;
    });

    return `z.object({\n${lines.join('\n')}\n${pad}})`;
  };

  const sanitized = rootName.replace(/[^A-Za-z0-9]/g, '') || 'root';
  const schemaName = `${sanitized}Schema`;
  const typeName = pascalCase(rootName);

  return [
    "import { z } from 'zod';",
    '',
    `export const ${schemaName} = ${render(shape, 0)};`,
    '',
    `export type ${typeName} = z.infer<typeof ${schemaName}>;`,
  ].join('\n');
};

const csharpIdentifier = (key: string): string => {
  const name = pascalCase(key);
  return /^[0-9]/.test(name) ? `_${name}` : name;
};

export const csharpFromShape = (shape: JsonShape, rootName = 'Root'): string => {
  const classes: Array<{ name: string; members: string[] }> = [];
  const bySignature = new Map<string, string>();
  const uniqueName = createNameFactory();
  let usesCollections = false;

  const memberName = (className: string, key: string, taken: Set<string>): string => {
    const identifier = csharpIdentifier(key);
    const base = identifier === className ? `${identifier}Value` : identifier;
    let name = base;
    let counter = 2;
    while (taken.has(name)) name = `${base}${counter++}`;
    taken.add(name);
    return name;
  };

  const member = (key: string, type: string, name: string): string =>
    `    [JsonPropertyName(${JSON.stringify(key)})]\n    public ${type} ${name} { get; set; }`;

  const render = (node: TypeNode, name: string): string => {
    if (node.kind === 'primitive') return CSHARP_TYPES[node.name];
    if (node.kind === 'union') return 'object';
    if (node.kind === 'array') {
      usesCollections = true;
      return `List<${render(node.element, singular(name))}>`;
    }

    const key = signature(node);
    const existing = bySignature.get(key);
    if (existing) return existing;

    const className = uniqueName(name);
    bySignature.set(key, className);

    const taken = new Set<string>();
    const members = [...node.fields.entries()].map(([field, meta]) => {
      const type = render(meta.node, `${className}${pascalCase(field)}`);
      return member(field, meta.optional ? `${type}?` : type, memberName(className, field, taken));
    });

    classes.push({ name: className, members });
    return className;
  };

  const rootType = render(shape, rootName);
  const usage = `// JsonSerializer.Deserialize<${rootType}>(json);`;
  if (classes.length === 0) return usage;

  const usings = [
    usesCollections ? 'using System.Collections.Generic;' : '',
    'using System.Text.Json.Serialization;',
  ]
    .filter(Boolean)
    .join('\n');

  const declarations = classes
    .reverse()
    .map((item) =>
      item.members.length
        ? `public class ${item.name}\n{\n${item.members.join('\n\n')}\n}`
        : `public class ${item.name} { }`,
    );

  return [usings, usage, ...declarations].join('\n\n');
};

const NEEDS_QUOTES = /^$|^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|:\s|\s#|[\n\r\t]/;
const RESERVED = /^(true|false|null|yes|no|on|off|~)$/i;

const yamlScalar = (value: JsonValue): string => {
  const type = valueType(value);
  if (type === 'null') return 'null';
  if (type === 'boolean' || type === 'number') return String(value);

  const text = value as string;
  if (NEEDS_QUOTES.test(text) || RESERVED.test(text) || /^-?\d/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
};

export const jsonToYaml = (value: JsonValue, indent = 0): string => {
  const type = valueType(value);
  const pad = '  '.repeat(indent);

  if (type === 'array') {
    const items = value as JsonValue[];
    if (items.length === 0) return `${pad}[]`;
    return items
      .map((item) => {
        const itemType = valueType(item);
        if (itemType === 'object' || itemType === 'array') {
          const nested = jsonToYaml(item, indent + 1);
          return `${pad}- ${nested.slice((indent + 1) * 2)}`;
        }
        return `${pad}- ${yamlScalar(item)}`;
      })
      .join('\n');
  }

  if (type === 'object') {
    const entries = Object.entries(value as Record<string, JsonValue>);
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([key, item]) => {
        const safeKey = /^[A-Za-z0-9_.-]+$/.test(key) ? key : JSON.stringify(key);
        const itemType = valueType(item);
        if (itemType === 'object' || itemType === 'array') {
          const isEmpty =
            itemType === 'array'
              ? (item as JsonValue[]).length === 0
              : Object.keys(item as Record<string, JsonValue>).length === 0;
          if (isEmpty) return `${pad}${safeKey}: ${itemType === 'array' ? '[]' : '{}'}`;
          return `${pad}${safeKey}:\n${jsonToYaml(item, indent + 1)}`;
        }
        return `${pad}${safeKey}: ${yamlScalar(item)}`;
      })
      .join('\n');
  }

  return `${pad}${yamlScalar(value)}`;
};

const flattenRow = (value: JsonValue, prefix = ''): Record<string, string> => {
  const row: Record<string, string> = {};
  const type = valueType(value);

  if (type === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, JsonValue>)) {
      Object.assign(row, flattenRow(item, prefix ? `${prefix}.${key}` : key));
    }
    return row;
  }

  if (type === 'array') {
    row[prefix || 'value'] = JSON.stringify(value);
    return row;
  }

  row[prefix || 'value'] = type === 'null' ? '' : String(value);
  return row;
};

const escapeCsv = (cell: string, delimiter: string): string => {
  if (cell.includes(delimiter) || cell.includes('"') || /[\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
};

export const jsonToCsv = (value: JsonValue, delimiter = ','): string => {
  const type = valueType(value);
  const records = type === 'array' ? (value as JsonValue[]) : type === 'object' ? [value] : [value];

  if (records.length === 0) return '';

  const rows = records.map((record) => flattenRow(record));
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }

  const header = columns.map((column) => escapeCsv(column, delimiter)).join(delimiter);
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(row[column] ?? '', delimiter)).join(delimiter),
  );

  return [header, ...body].join('\n');
};

export const jsonToQueryString = (value: JsonValue): string => {
  const params = new URLSearchParams();
  const row = flattenRow(value);
  for (const [key, item] of Object.entries(row)) params.append(key, item);
  return params.toString();
};
