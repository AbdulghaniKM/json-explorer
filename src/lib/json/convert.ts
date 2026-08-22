import type { JsonValue } from './types';
import { valueType } from './path';

type TypeNode =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' | 'unknown' }
  | { kind: 'array'; element: TypeNode }
  | { kind: 'object'; fields: Map<string, { node: TypeNode; optional: boolean }> }
  | { kind: 'union'; options: TypeNode[] };

const primitive = (name: 'string' | 'number' | 'boolean' | 'null' | 'unknown'): TypeNode => ({
  kind: 'primitive',
  name,
});

const signature = (node: TypeNode): string => {
  if (node.kind === 'primitive') return node.name;
  if (node.kind === 'array') return `array<${signature(node.element)}>`;
  if (node.kind === 'union') return `union<${node.options.map(signature).sort().join('|')}>`;
  return `object<${[...node.fields.entries()]
    .map(([key, field]) => `${key}${field.optional ? '?' : ''}:${signature(field.node)}`)
    .sort()
    .join(',')}>`;
};

const unify = (a: TypeNode, b: TypeNode): TypeNode => {
  if (signature(a) === signature(b)) return a;

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

const infer = (value: JsonValue): TypeNode => {
  const type = valueType(value);

  if (type === 'array') {
    const items = value as JsonValue[];
    if (items.length === 0) return { kind: 'array', element: primitive('unknown') };
    return { kind: 'array', element: items.map(infer).reduce(unify) };
  }

  if (type === 'object') {
    const fields = new Map<string, { node: TypeNode; optional: boolean }>();
    for (const [key, item] of Object.entries(value as Record<string, JsonValue>)) {
      fields.set(key, { node: infer(item), optional: false });
    }
    return { kind: 'object', fields };
  }

  if (type === 'string') return primitive('string');
  if (type === 'number') return primitive('number');
  if (type === 'boolean') return primitive('boolean');
  return primitive('null');
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

export const jsonToTypeScript = (value: JsonValue, rootName = 'Root'): string => {
  const interfaces: Array<{ name: string; body: string }> = [];
  const bySignature = new Map<string, string>();
  const usedNames = new Set<string>();

  const uniqueName = (base: string): string => {
    const name = pascalCase(base) || 'Item';
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    let counter = 2;
    while (usedNames.has(`${name}${counter}`)) counter++;
    usedNames.add(`${name}${counter}`);
    return `${name}${counter}`;
  };

  const render = (node: TypeNode, name: string): string => {
    if (node.kind === 'primitive') return node.name;
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

  const rootType = render(infer(value), rootName);
  const declarations = interfaces.map((item) => `export interface ${item.name} ${item.body}`);

  if (!interfaces.some((item) => item.name === rootType)) {
    declarations.push(`export type ${pascalCase(rootName)} = ${rootType};`);
  }

  return declarations.reverse().join('\n\n');
};

export const jsonToZod = (value: JsonValue, rootName = 'root'): string => {
  const render = (node: TypeNode, depth: number): string => {
    const pad = '  '.repeat(depth);
    const inner = '  '.repeat(depth + 1);

    if (node.kind === 'primitive') {
      if (node.name === 'null') return 'z.null()';
      if (node.name === 'unknown') return 'z.unknown()';
      return `z.${node.name}()`;
    }

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
    `export const ${schemaName} = ${render(infer(value), 0)};`,
    '',
    `export type ${typeName} = z.infer<typeof ${schemaName}>;`,
  ].join('\n');
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
