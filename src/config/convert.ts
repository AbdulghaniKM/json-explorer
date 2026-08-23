import type { ConvertTarget } from '@/lib/json';

export type ConvertGroup = 'Types & schemas' | 'Data formats';

export interface ConvertTargetOption {
  id: ConvertTarget;
  label: string;
  group: ConvertGroup;
  icon: string;
  extension: string;
  mime: string;
  /** One line, shown beside the label in the target menu. */
  summary: string;
  /** The full caveat, shown under the output panel. */
  hint: string;
  usesRootName?: boolean;
}

export const CONVERT_TARGETS: ConvertTargetOption[] = [
  {
    id: 'typescript',
    label: 'TypeScript',
    group: 'Types & schemas',
    icon: 'icon-[solar--code-linear]',
    extension: 'ts',
    mime: 'text/plain',
    summary: 'Interfaces with optional keys',
    hint: 'Interfaces are merged across array items — keys missing from some items become optional.',
    usesRootName: true,
  },
  {
    id: 'csharp',
    label: 'C# classes',
    group: 'Types & schemas',
    icon: 'icon-[solar--code-file-linear]',
    extension: 'cs',
    mime: 'text/plain',
    summary: 'Mutable classes for System.Text.Json',
    hint: 'Classes for System.Text.Json in .NET Core — every property carries [JsonPropertyName], and keys missing from some array items become nullable.',
    usesRootName: true,
  },
  {
    id: 'dotnet',
    label: '.NET DTO',
    group: 'Types & schemas',
    icon: 'icon-[solar--layers-minimalistic-linear]',
    extension: 'cs',
    mime: 'text/plain',
    summary: 'Immutable records with required init',
    hint: 'Sealed records for modern .NET — properties always present are required, anything nullable or missing becomes T?, and arrays come back as IReadOnlyList<T>.',
    usesRootName: true,
  },
  {
    id: 'zod',
    label: 'Zod',
    group: 'Types & schemas',
    icon: 'icon-[solar--shield-check-linear]',
    extension: 'ts',
    mime: 'text/plain',
    summary: 'Runtime schema plus inferred type',
    hint: 'A runtime schema plus an inferred type, ready to paste into a Zod project.',
    usesRootName: true,
  },
  {
    id: 'yaml',
    label: 'YAML',
    group: 'Data formats',
    icon: 'icon-[solar--file-text-linear]',
    extension: 'yaml',
    mime: 'text/yaml',
    summary: 'The same document, indented',
    hint: 'Strings are quoted only when YAML would otherwise read them as another type.',
  },
  {
    id: 'csv',
    label: 'CSV',
    group: 'Data formats',
    icon: 'icon-[solar--checklist-minimalistic-linear]',
    extension: 'csv',
    mime: 'text/csv',
    summary: 'Flattened rows for a spreadsheet',
    hint: 'Nested objects are flattened to dotted column names; nested arrays stay as JSON.',
  },
  {
    id: 'query',
    label: 'Query string',
    group: 'Data formats',
    icon: 'icon-[solar--link-minimalistic-2-linear]',
    extension: 'txt',
    mime: 'text/plain',
    summary: 'URL-encoded key/value pairs',
    hint: 'Flattened key/value pairs, URL-encoded — handy for reproducing an API call.',
  },
];

export const CONVERT_GROUPS: ConvertGroup[] = ['Types & schemas', 'Data formats'];
